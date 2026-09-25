import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { R2ConfigurationError, uploadContentAsset } from '@/lib/r2';
import { isRoleContext, requirePermission } from '@/lib/roles';
import {
  getCalendarSettings,
  mediaCreateData,
  nextAvailableDays,
  POST_INCLUDE,
  serializePost,
} from '@/lib/content-calendar/service';
import { zonedToUtc } from '@/lib/content-calendar/timezone';
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_FILE_BYTES,
  MAX_TOTAL_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  uploadFieldsSchema,
  validationError,
} from '@/lib/content-calendar/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

function safeFileName(value: string): string {
  const baseName = value.split(/[\\/]/).pop() ?? 'archivo';
  return Array.from(baseName)
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join('')
    .slice(0, 255);
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, 'canManageContent');
  if (!isRoleContext(ctx)) return ctx;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: 'Formulario multipart inválido' }, { status: 400 });
  }

  const parsed = uploadFieldsSchema.safeParse({
    startDay: typeof form.get('startDay') === 'string' ? form.get('startDay') : undefined,
    defaultTime: typeof form.get('defaultTime') === 'string' ? form.get('defaultTime') : undefined,
    networks: typeof form.get('networks') === 'string' ? form.get('networks') : undefined,
    title: typeof form.get('title') === 'string' ? form.get('title') : undefined,
    caption: typeof form.get('caption') === 'string' ? form.get('caption') : undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const entries = [...form.getAll('files'), ...form.getAll('file')];
  const files = entries.filter((entry): entry is File => typeof entry !== 'string');
  if (files.length === 0 || files.length > MAX_UPLOAD_FILES) {
    return Response.json({ error: `Debes subir entre 1 y ${MAX_UPLOAD_FILES} archivos` }, { status: 400 });
  }
  if (!parsed.data.startDay && files.length > 10) {
    return Response.json({ error: 'Una publicación admite hasta 10 archivos' }, { status: 400 });
  }
  if (files.some((file) => !ALLOWED_UPLOAD_TYPES.has(file.type) || file.size === 0 || file.size > MAX_FILE_BYTES)) {
    return Response.json({ error: 'Hay archivos con tipo o tamaño no permitido' }, { status: 400 });
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_UPLOAD_BYTES) {
    return Response.json({ error: 'La carga total supera 100 MB' }, { status: 400 });
  }

  let uploaded: Array<{
    url: string;
    r2Key: string;
    kind: 'image' | 'video';
    mimeType: string;
    fileName: string;
    sizeBytes: number;
  }>;
  try {
    uploaded = await Promise.all(files.map(async (file) => {
      const extension = MIME_EXTENSIONS[file.type] ?? 'bin';
      const asset = await uploadContentAsset({
        workspaceId: ctx.workspace.id,
        body: Buffer.from(await file.arrayBuffer()),
        contentType: file.type,
        extension,
      });
      return {
        url: asset.publicUrl,
        r2Key: asset.r2Key,
        kind: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
        mimeType: file.type,
        fileName: safeFileName(file.name),
        sizeBytes: file.size,
      };
    }));
  } catch (error) {
    const message = error instanceof R2ConfigurationError
      ? error.message
      : 'No se pudieron guardar los archivos en el almacenamiento.';
    return Response.json({ error: message }, { status: 503 });
  }

  if (!parsed.data.startDay) {
    const media = mediaCreateData(uploaded);
    return Response.json({ media, file: media[0], url: media[0].url }, { status: 201 });
  }

  const settings = await getCalendarSettings(ctx.workspace.id);
  const days = await nextAvailableDays(
    ctx.workspace.id,
    parsed.data.startDay,
    uploaded.length,
    settings.timezone
  );
  const time = parsed.data.defaultTime ?? settings.defaultPostTime;
  const posts = await prisma.$transaction(uploaded.map((media, index) =>
    prisma.contentPost.create({
      data: {
        workspaceId: ctx.workspace.id,
        createdById: ctx.auth.userId,
        status: 'scheduled',
        scheduledFor: zonedToUtc(days[index], time, settings.timezone),
        networks: parsed.data.networks,
        title: parsed.data.title || media.fileName,
        caption: parsed.data.caption || null,
        mediaType: media.kind === 'video' ? 'video' : 'image',
        media: { create: mediaCreateData([media]) },
      },
      include: POST_INCLUDE,
    })
  ));

  return Response.json(
    { posts: posts.map((post) => serializePost(post, settings.timezone)) },
    { status: 201 }
  );
}

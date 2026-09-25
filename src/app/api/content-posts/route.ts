import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { isRoleContext, requirePermission } from '@/lib/roles';
import {
  getCalendarSettings,
  listPosts,
  mediaCreateData,
  POST_INCLUDE,
  serializePost,
} from '@/lib/content-calendar/service';
import {
  createPostSchema,
  rangeSchema,
  validationError,
} from '@/lib/content-calendar/validation';
import { PATCH as updatePost, DELETE as deletePost } from './[id]/route';
import { isContentAssetKeyForWorkspace } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, 'canViewContent');
  if (!isRoleContext(ctx)) return ctx;

  const url = new URL(req.url);
  const parsed = rangeSchema.safeParse({
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  });
  if (!parsed.success) return validationError(parsed.error);

  const settings = await getCalendarSettings(ctx.workspace.id);
  const posts = await listPosts(
    ctx.workspace.id,
    parsed.data.from,
    parsed.data.to,
    settings.timezone
  );
  return Response.json({ posts: posts.map((post) => serializePost(post, settings.timezone)) });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, 'canManageContent');
  if (!isRoleContext(ctx)) return ctx;

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const {
    media = [],
    mediaUrls = [],
    scheduledFor = null,
    mediaType = 'image',
    ...data
  } = parsed.data;
  const resolvedMedia = media.length > 0
    ? media
    : mediaUrls.map((url) => ({
        url,
        kind: mediaType === 'video' || mediaType === 'reel' ? 'video' as const : 'image' as const,
        r2Key: null,
      }));
  if (resolvedMedia.some((item) => item.r2Key && !isContentAssetKeyForWorkspace(item.r2Key, ctx.workspace.id))) {
    return Response.json({ error: 'Hay archivos que no pertenecen al workspace activo' }, { status: 400 });
  }

  const post = await prisma.contentPost.create({
    data: {
      ...data,
      status: scheduledFor ? 'scheduled' : 'draft',
      scheduledFor,
      mediaType,
      workspaceId: ctx.workspace.id,
      createdById: ctx.auth.userId,
      media: { create: mediaCreateData(resolvedMedia) },
    },
    include: POST_INCLUDE,
  });
  const settings = await getCalendarSettings(ctx.workspace.id);
  return Response.json({ post: serializePost(post, settings.timezone) }, { status: 201 });
}

/** Compatibilidad con el cliente 2A; la ruta canónica de detalle es /[id]. */
export async function PATCH(req: NextRequest) {
  return updatePost(req);
}

/** Compatibilidad con DELETE /api/content-posts?id=... */
export async function DELETE(req: NextRequest) {
  return deletePost(req);
}

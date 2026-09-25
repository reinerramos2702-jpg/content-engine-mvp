import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { isRoleContext, requirePermission } from '@/lib/roles';
import {
  getCalendarSettings,
  getPost,
  mediaCreateData,
  POST_INCLUDE,
  serializePost,
} from '@/lib/content-calendar/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requirePermission(req, 'canManageContent');
  if (!isRoleContext(ctx)) return ctx;
  const { id } = await params;
  const source = await getPost(ctx.workspace.id, id);
  if (!source) return Response.json({ error: 'Publicación no encontrada' }, { status: 404 });

  const post = await prisma.contentPost.create({
    data: {
      workspaceId: ctx.workspace.id,
      createdById: ctx.auth.userId,
      title: source.title ? `${source.title} (copia)`.slice(0, 200) : null,
      caption: source.caption,
      status: 'draft',
      networks: source.networks,
      mediaType: source.mediaType,
      media: {
        create: mediaCreateData(source.media.map((item) => ({
          url: item.url,
          r2Key: item.r2Key,
          kind: item.kind as 'image' | 'video',
          mimeType: item.mimeType,
          fileName: item.fileName,
          sizeBytes: item.sizeBytes,
        }))),
      },
    },
    include: POST_INCLUDE,
  });
  const settings = await getCalendarSettings(ctx.workspace.id);
  return Response.json({ post: serializePost(post, settings.timezone) }, { status: 201 });
}

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
import { updatePostSchema, validationError } from '@/lib/content-calendar/validation';
import { isContentAssetKeyForWorkspace } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const ctx = await requirePermission(req, 'canViewContent');
  if (!isRoleContext(ctx)) return ctx;
  const { id } = await params;
  const post = await getPost(ctx.workspace.id, id);
  if (!post) return Response.json({ error: 'Publicación no encontrada' }, { status: 404 });
  const settings = await getCalendarSettings(ctx.workspace.id);
  return Response.json({ post: serializePost(post, settings.timezone) });
}

export async function PATCH(req: NextRequest, routeContext?: RouteContext) {
  const ctx = await requirePermission(req, 'canManageContent');
  if (!isRoleContext(ctx)) return ctx;

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!input || typeof input !== 'object') {
    return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  const body = input as Record<string, unknown>;
  const id = routeContext
    ? (await routeContext.params).id
    : typeof body.id === 'string' ? body.id : null;
  if (!id) return Response.json({ error: 'El id es requerido' }, { status: 400 });

  const existing = await getPost(ctx.workspace.id, id);
  if (!existing) return Response.json({ error: 'Publicación no encontrada' }, { status: 404 });

  const postInput = { ...body };
  delete postInput.id;
  const parsed = updatePostSchema.safeParse(postInput);
  if (!parsed.success) return validationError(parsed.error);

  const { media, mediaUrls, scheduledFor, mediaType, ...fields } = parsed.data;
  const resolvedMedia = media ?? (mediaUrls
      ? mediaUrls.map((url) => ({
          url,
          kind: mediaType === 'video' || mediaType === 'reel' ? 'video' as const : 'image' as const,
          r2Key: null,
        }))
    : undefined);
  if (resolvedMedia?.some((item) => item.r2Key && !isContentAssetKeyForWorkspace(item.r2Key, ctx.workspace.id))) {
    return Response.json({ error: 'Hay archivos que no pertenecen al workspace activo' }, { status: 400 });
  }
  const scheduleData = scheduledFor !== undefined
    ? { scheduledFor, status: scheduledFor ? 'scheduled' as const : 'draft' as const }
    : {};
  const post = await prisma.contentPost.update({
    where: { id, workspaceId: ctx.workspace.id },
    data: {
      ...fields,
      ...(mediaType !== undefined ? { mediaType } : {}),
      ...scheduleData,
      ...(resolvedMedia ? { media: { deleteMany: {}, create: mediaCreateData(resolvedMedia) } } : {}),
    },
    include: POST_INCLUDE,
  });
  const settings = await getCalendarSettings(ctx.workspace.id);
  return Response.json({ post: serializePost(post, settings.timezone) });
}

export async function DELETE(req: NextRequest, routeContext?: RouteContext) {
  const ctx = await requirePermission(req, 'canManageContent');
  if (!isRoleContext(ctx)) return ctx;
  const id = routeContext
    ? (await routeContext.params).id
    : new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'El id es requerido' }, { status: 400 });
  const existing = await getPost(ctx.workspace.id, id);
  if (!existing) return Response.json({ error: 'Publicación no encontrada' }, { status: 404 });

  await prisma.contentPost.delete({ where: { id, workspaceId: ctx.workspace.id } });
  return Response.json({ ok: true });
}

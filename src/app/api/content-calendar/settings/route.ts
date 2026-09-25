import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { isRoleContext, requirePermission } from '@/lib/roles';
import { getCalendarSettings } from '@/lib/content-calendar/service';
import { settingsSchema, validationError } from '@/lib/content-calendar/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, 'canViewContent');
  if (!isRoleContext(ctx)) return ctx;

  const settings = await getCalendarSettings(ctx.workspace.id);
  return Response.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requirePermission(req, 'canManageContent');
  if (!isRoleContext(ctx)) return ctx;

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const settings = await prisma.contentCalendarSettings.upsert({
    where: { workspaceId: ctx.workspace.id },
    create: { workspaceId: ctx.workspace.id, ...parsed.data },
    update: parsed.data,
  });
  return Response.json({ settings });
}

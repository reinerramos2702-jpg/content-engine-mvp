import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/db', () => ({
  prisma: { contentCalendarSettings: { upsert: vi.fn() } },
}));
vi.mock('@/lib/roles', () => ({
  requirePermission: vi.fn(),
  isRoleContext: vi.fn(),
}));
vi.mock('@/lib/content-calendar/service', () => ({ getCalendarSettings: vi.fn() }));

import { PATCH } from './route';
import { prisma } from '@/lib/db';
import { isRoleContext, requirePermission } from '@/lib/roles';

describe('PATCH /api/content-calendar/settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rechaza falta de permiso sin escribir', async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );
    vi.mocked(isRoleContext).mockReturnValue(false);
    const request = new NextRequest('http://localhost/api/content-calendar/settings', {
      method: 'PATCH',
      body: JSON.stringify({ defaultPostTime: '09:00' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(403);
    expect(prisma.contentCalendarSettings.upsert).not.toHaveBeenCalled();
  });

  it('rechaza que el body intente elegir otro workspace', async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      auth: { userId: 'user-a', email: 'a@example.com' },
      workspace: { id: 'workspace-a', ownerId: 'user-a', name: 'A' },
      role: 'admin',
    });
    vi.mocked(isRoleContext).mockReturnValue(true);
    vi.mocked(prisma.contentCalendarSettings.upsert).mockResolvedValue({
      id: 'settings-a',
      workspaceId: 'workspace-a',
      timezone: 'America/Caracas',
      defaultPostTime: '09:00',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const request = new NextRequest('http://localhost/api/content-calendar/settings', {
      method: 'PATCH',
      body: JSON.stringify({ workspaceId: 'workspace-b', defaultPostTime: '09:00' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    expect(prisma.contentCalendarSettings.upsert).not.toHaveBeenCalled();
  });

  it('escribe configuración únicamente para ctx.workspace.id', async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      auth: { userId: 'user-a', email: 'a@example.com' },
      workspace: { id: 'workspace-a', ownerId: 'user-a', name: 'A' },
      role: 'admin',
    });
    vi.mocked(isRoleContext).mockReturnValue(true);
    vi.mocked(prisma.contentCalendarSettings.upsert).mockResolvedValue({
      id: 'settings-a',
      workspaceId: 'workspace-a',
      timezone: 'America/Caracas',
      defaultPostTime: '09:00',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const request = new NextRequest('http://localhost/api/content-calendar/settings', {
      method: 'PATCH',
      body: JSON.stringify({ defaultPostTime: '09:00' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(prisma.contentCalendarSettings.upsert).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-a' },
      create: { workspaceId: 'workspace-a', defaultPostTime: '09:00' },
      update: { defaultPostTime: '09:00' },
    });
  });
});

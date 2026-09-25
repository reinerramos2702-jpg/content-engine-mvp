import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/db', () => ({
  prisma: {
    contentPost: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/roles', () => ({
  requirePermission: vi.fn(),
  isRoleContext: vi.fn(),
}));
vi.mock('@/lib/r2', () => ({
  R2ConfigurationError: class extends Error {},
  uploadContentAsset: vi.fn(),
}));
vi.mock('@/lib/content-calendar/service', () => ({
  getCalendarSettings: vi.fn(),
  mediaCreateData: vi.fn((media) => media),
  nextAvailableDays: vi.fn(),
  POST_INCLUDE: {},
  serializePost: vi.fn((post) => post),
}));
vi.mock('@/lib/content-calendar/timezone', () => ({
  isValidTimezone: vi.fn(() => true),
  zonedToUtc: vi.fn((day: string, time: string) => new Date(`${day}T${time}:00.000Z`)),
}));

import { prisma } from '@/lib/db';
import { uploadContentAsset } from '@/lib/r2';
import { isRoleContext, requirePermission } from '@/lib/roles';
import { getCalendarSettings, nextAvailableDays } from '@/lib/content-calendar/service';
import { POST } from './route';

const context = {
  auth: { userId: 'user-a', email: 'a@example.com' },
  workspace: { id: 'workspace-a', ownerId: 'user-a', name: 'A' },
  role: 'admin' as const,
};

describe('POST /api/content-posts/upload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aplica RBAC antes de leer o subir archivos', async () => {
    vi.mocked(requirePermission).mockResolvedValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    vi.mocked(isRoleContext).mockReturnValue(false);

    const response = await POST(new NextRequest('http://localhost/api/content-posts/upload', { method: 'POST' }));

    expect(response.status).toBe(403);
    expect(uploadContentAsset).not.toHaveBeenCalled();
  });

  it('sube múltiples archivos bajo el workspace activo y crea posts en transacción', async () => {
    vi.mocked(requirePermission).mockResolvedValue(context);
    vi.mocked(isRoleContext).mockReturnValue(true);
    vi.mocked(uploadContentAsset)
      .mockResolvedValueOnce({ r2Key: `content-calendar/workspace-a/${'a'.repeat(32)}.png`, publicUrl: 'https://cdn.example.com/a.png' })
      .mockResolvedValueOnce({ r2Key: `content-calendar/workspace-a/${'b'.repeat(32)}.png`, publicUrl: 'https://cdn.example.com/b.png' });
    vi.mocked(getCalendarSettings).mockResolvedValue({ timezone: 'UTC', defaultPostTime: '18:00' } as never);
    vi.mocked(nextAvailableDays).mockResolvedValue(['2026-09-25', '2026-09-26']);
    vi.mocked(prisma.contentPost.create)
      .mockReturnValueOnce(Promise.resolve({ id: 'post-a' }) as never)
      .mockReturnValueOnce(Promise.resolve({ id: 'post-b' }) as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([{ id: 'post-a' }, { id: 'post-b' }] as never);
    const form = new FormData();
    form.append('files', new File(['a'], 'a.png', { type: 'image/png' }));
    form.append('files', new File(['b'], 'b.png', { type: 'image/png' }));
    form.append('startDay', '2026-09-25');
    form.append('defaultTime', '18:00');

    const response = await POST(new NextRequest('http://localhost/api/content-posts/upload', { method: 'POST', body: form }));

    expect(response.status).toBe(201);
    expect(uploadContentAsset).toHaveBeenCalledTimes(2);
    expect(uploadContentAsset).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'workspace-a' }));
    expect(prisma.contentPost.create).toHaveBeenCalledTimes(2);
    for (const [call] of vi.mocked(prisma.contentPost.create).mock.calls) {
      expect(call.data).toEqual(expect.objectContaining({ workspaceId: 'workspace-a', createdById: 'user-a' }));
    }
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});

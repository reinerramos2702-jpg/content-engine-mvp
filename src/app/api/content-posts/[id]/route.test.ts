import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/db', () => ({
  prisma: { contentPost: { update: vi.fn(), delete: vi.fn() } },
}));
vi.mock('@/lib/roles', () => ({
  requirePermission: vi.fn(),
  isRoleContext: vi.fn(),
}));
vi.mock('@/lib/content-calendar/service', () => ({
  getCalendarSettings: vi.fn(),
  getPost: vi.fn(),
  mediaCreateData: vi.fn(),
  POST_INCLUDE: {},
  serializePost: vi.fn(),
}));

import { GET, PATCH } from './route';
import { prisma } from '@/lib/db';
import { getPost } from '@/lib/content-calendar/service';
import { isRoleContext, requirePermission } from '@/lib/roles';

const context = {
  auth: { userId: 'user-a', email: 'a@example.com' },
  workspace: { id: 'workspace-a', ownerId: 'user-a', name: 'A' },
  role: 'admin' as const,
};
const params = { params: Promise.resolve({ id: 'post-b' }) };

describe('/api/content-posts/[id] tenant and permission guards', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
  ])('propaga %i antes de consultar datos', async (status, error) => {
    const denied = NextResponse.json({ error }, { status });
    vi.mocked(requirePermission).mockResolvedValue(denied);
    vi.mocked(isRoleContext).mockReturnValue(false);

    const response = await GET(new NextRequest('http://localhost/api/content-posts/post-b'), params);

    expect(response.status).toBe(status);
    expect(requirePermission).toHaveBeenCalledWith(expect.any(NextRequest), 'canViewContent');
    expect(getPost).not.toHaveBeenCalled();
  });

  it('devuelve 404 para un ID ajeno y consulta siempre dentro del workspace activo', async () => {
    vi.mocked(requirePermission).mockResolvedValue(context);
    vi.mocked(isRoleContext).mockReturnValue(true);
    vi.mocked(getPost).mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost/api/content-posts/post-b'), params);

    expect(response.status).toBe(404);
    expect(getPost).toHaveBeenCalledWith('workspace-a', 'post-b');
  });

  it('exige canManageContent antes de editar', async () => {
    const denied = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    vi.mocked(requirePermission).mockResolvedValue(denied);
    vi.mocked(isRoleContext).mockReturnValue(false);

    const response = await PATCH(
      new NextRequest('http://localhost/api/content-posts/post-b', {
        method: 'PATCH',
        body: JSON.stringify({ caption: 'x' }),
      }),
      params
    );

    expect(response.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith(expect.any(NextRequest), 'canManageContent');
    expect(getPost).not.toHaveBeenCalled();
  });

  it('rechaza asociar una clave R2 emitida para otro workspace', async () => {
    vi.mocked(requirePermission).mockResolvedValue(context);
    vi.mocked(isRoleContext).mockReturnValue(true);
    vi.mocked(getPost).mockResolvedValue({ id: 'post-b' } as never);

    const response = await PATCH(
      new NextRequest('http://localhost/api/content-posts/post-b', {
        method: 'PATCH',
        body: JSON.stringify({
          media: [{
            url: 'https://cdn.example.com/image.png',
            kind: 'image',
            r2Key: `content-calendar/workspace-b/${'a'.repeat(32)}.png`,
          }],
        }),
      }),
      params
    );

    expect(response.status).toBe(400);
    expect(prisma.contentPost.update).not.toHaveBeenCalled();
  });
});

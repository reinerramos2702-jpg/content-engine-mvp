import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    contentPost: { findMany: vi.fn() },
    contentCalendarSettings: { upsert: vi.fn() },
  },
}));

import { prisma } from '@/lib/db';
import { nextAvailableDays } from './service';

describe('content calendar auto distribution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa los próximos días libres y limita la consulta al workspace activo', async () => {
    vi.mocked(prisma.contentPost.findMany).mockResolvedValue([
      { scheduledFor: new Date('2026-09-26T22:00:00.000Z') },
    ] as never);

    const days = await nextAvailableDays(
      'workspace-a',
      '2026-09-25',
      3,
      'America/Caracas'
    );

    expect(days).toEqual(['2026-09-25', '2026-09-27', '2026-09-28']);
    expect(prisma.contentPost.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workspaceId: 'workspace-a',
        OR: expect.arrayContaining([{ scheduledFor: null }]),
      }),
    }));
  });
});

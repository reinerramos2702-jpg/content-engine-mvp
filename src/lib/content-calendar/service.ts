import { prisma } from '@/lib/db';
import { addDays, dayKey, DEFAULT_TIMEZONE, timeKey, zonedToUtc } from './timezone';

export const POST_INCLUDE = { media: { orderBy: { sortIndex: 'asc' as const } } };

export async function getCalendarSettings(workspaceId: string) {
  return prisma.contentCalendarSettings.upsert({
    where: { workspaceId },
    create: { workspaceId, timezone: DEFAULT_TIMEZONE },
    update: {},
  });
}

type PostWithMedia = Awaited<ReturnType<typeof getPost>>;

export function serializePost(post: NonNullable<PostWithMedia>, timezone: string) {
  return {
    ...post,
    scheduledFor: post.scheduledFor?.toISOString() ?? null,
    day: post.scheduledFor ? dayKey(post.scheduledFor, timezone) : null,
    time: post.scheduledFor ? timeKey(post.scheduledFor, timezone) : null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    media: post.media.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
  };
}

export function getPost(workspaceId: string, id: string) {
  return prisma.contentPost.findFirst({ where: { id, workspaceId }, include: POST_INCLUDE });
}

export async function listPosts(workspaceId: string, from: string, to: string, timezone: string) {
  const start = zonedToUtc(from, '00:00', timezone);
  const end = zonedToUtc(addDays(to, 1), '00:00', timezone);
  return prisma.contentPost.findMany({
    where: {
      workspaceId,
      OR: [
        { scheduledFor: { gte: start, lt: end } },
        { scheduledFor: null },
      ],
    },
    include: POST_INCLUDE,
    orderBy: [{ scheduledFor: 'asc' }, { sortIndex: 'asc' }],
  });
}

/** Un archivo por día libre, sin reglas de bloqueos (reservadas para 2B). */
export async function nextAvailableDays(workspaceId: string, startDay: string, count: number, timezone: string) {
  const horizonEnd = addDays(startDay, Math.max(180, count * 3));
  const existing = await listPosts(workspaceId, startDay, horizonEnd, timezone);
  const occupied = new Set(existing.flatMap((post) => post.scheduledFor ? [dayKey(post.scheduledFor, timezone)] : []));
  const days: string[] = [];
  let cursor = startDay;
  while (days.length < count) {
    if (!occupied.has(cursor)) days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function mediaCreateData(media: Array<{
  url: string;
  kind: 'image' | 'video';
  mimeType?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  r2Key?: string | null;
}>) {
  return media.map((item, sortIndex) => ({ ...item, sortIndex }));
}

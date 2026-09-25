export type CalendarView = 'week' | 'month';

export type PostStatus =
  | 'draft'
  | 'pending_approval'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'error';

export type Network = 'instagram' | 'facebook';
export type MediaType = 'image' | 'carousel' | 'reel' | 'video';

export interface PostMedia {
  id?: string;
  url: string;
  thumbUrl?: string | null;
  kind?: 'image' | 'video';
  mimeType?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  r2Key?: string | null;
}

export interface ContentPost {
  id: string;
  title?: string | null;
  caption?: string | null;
  day?: string | null;
  time?: string | null;
  scheduledFor?: string | null;
  status: PostStatus;
  networks: Network[];
  mediaType: MediaType;
  media: PostMedia[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CalendarSettings {
  timezone: string;
  maxPostsPerDay: number;
  defaultPostTime: string;
  brandName?: string | null;
  brandHandle?: string | null;
  brandAvatarUrl?: string | null;
  brandPrimary?: string | null;
}

export const DEFAULT_SETTINGS: CalendarSettings = {
  timezone: 'America/Caracas',
  maxPostsPerDay: 1,
  defaultPostTime: '18:00',
};

export const STATUS_META: Record<PostStatus, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'var(--rai-muted)' },
  pending_approval: { label: 'Por aprobar', color: 'var(--rai-warning)' },
  scheduled: { label: 'Programado', color: 'var(--rai-gold)' },
  publishing: { label: 'Publicando', color: 'var(--rai-purple)' },
  published: { label: 'Publicado', color: 'var(--rai-success)' },
  error: { label: 'Error', color: 'var(--rai-error)' },
};

export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const mondayOffset = (result.getDay() + 6) % 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - mondayOffset);
  return result;
}

export function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(1);
  return result;
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function addMonths(date: Date, amount: number): Date {
  const result = startOfMonth(date);
  result.setMonth(result.getMonth() + amount);
  return result;
}

export function toYMD(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateFromYMD(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function postDay(post: ContentPost): string | null {
  return post.day || post.scheduledFor?.slice(0, 10) || null;
}

export function postTime(post: ContentPost): string {
  if (post.time) return post.time;
  if (!post.scheduledFor) return '';
  const parsed = new Date(post.scheduledFor);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function calendarDays(anchor: Date, view: CalendarView): Date[] {
  const first = view === 'week' ? startOfWeek(anchor) : startOfWeek(startOfMonth(anchor));
  const count = view === 'week' ? 7 : 42;
  return Array.from({ length: count }, (_, index) => addDays(first, index));
}

export function visibleRange(anchor: Date, view: CalendarView): { from: string; to: string } {
  const days = calendarDays(anchor, view);
  return { from: toYMD(days[0]), to: toYMD(days[days.length - 1]) };
}

export function groupPostsByDay(posts: ContentPost[]): Record<string, ContentPost[]> {
  return posts.reduce<Record<string, ContentPost[]>>((groups, post) => {
    const day = postDay(post);
    if (!day) return groups;
    (groups[day] ||= []).push(post);
    groups[day].sort((a, b) => postTime(a).localeCompare(postTime(b)));
    return groups;
  }, {});
}

export function scheduledISOString(day: string, time: string, timezone = 'UTC'): string {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, date, hour, minute);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  let guess = target;
  // Dos pasadas cubren cambios de offset por horario de verano cerca del destino.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess -= represented - target;
  }
  return new Date(guess).toISOString();
}

export function distributeFiles(
  fileNames: string[],
  startDay: string,
  time: string,
  maxPerDay: number,
  occupiedDays: string[] = [],
): Array<{ fileName: string; day: string; time: string }> {
  const start = dateFromYMD(startDay);
  const dailyLimit = Math.max(1, Math.floor(maxPerDay));
  const counts = occupiedDays.reduce<Record<string, number>>((result, day) => {
    result[day] = (result[day] || 0) + 1;
    return result;
  }, {});
  let cursor = start;
  return fileNames.map((fileName) => {
    while ((counts[toYMD(cursor)] || 0) >= dailyLimit) cursor = addDays(cursor, 1);
    const day = toYMD(cursor);
    counts[day] = (counts[day] || 0) + 1;
    return { fileName, day, time };
  });
}

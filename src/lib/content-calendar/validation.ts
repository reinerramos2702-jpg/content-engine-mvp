import { z } from 'zod';
import { isValidTimezone } from './timezone';

export const MAX_MEDIA_PER_POST = 10;
export const MAX_UPLOAD_FILES = 10;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_UPLOAD_BYTES = 100 * 1024 * 1024;

export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Fecha inválida');

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida');

export const settingsSchema = z.object({
  timezone: z.string().min(1).max(100).refine(isValidTimezone, 'Zona horaria inválida').optional(),
  defaultPostTime: timeSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No hay cambios para guardar');

const scheduledForSchema = z.string().datetime({ offset: true }).transform((value, ctx) => {
  const date = new Date(value);
  const maxDistance = 5 * 366 * 24 * 60 * 60 * 1000;
  if (Math.abs(date.getTime() - Date.now()) > maxDistance) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La fecha está fuera del rango permitido' });
    return z.NEVER;
  }
  return date;
});

export const mediaInputSchema = z.object({
  url: z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value), 'URL no permitida'),
  kind: z.enum(['image', 'video']),
  mimeType: z.string().max(100).optional().nullable(),
  fileName: z.string().trim().min(1).max(255).optional().nullable(),
  sizeBytes: z.number().int().nonnegative().max(MAX_FILE_BYTES).optional().nullable(),
  r2Key: z.string().max(200).optional().nullable(),
}).strict();

const editablePostFields = {
  title: z.string().trim().max(200).nullable().optional(),
  caption: z.string().max(10_000).nullable().optional(),
  scheduledFor: scheduledForSchema.nullable().optional(),
  sortIndex: z.number().int().min(0).max(10_000).optional(),
  networks: z.array(z.enum(['instagram', 'facebook'])).min(1).max(2).transform((items) => [...new Set(items)]).optional(),
  mediaType: z.enum(['image', 'carousel', 'reel', 'video']).optional(),
  media: z.array(mediaInputSchema).max(MAX_MEDIA_PER_POST).optional(),
  mediaUrls: z.array(
    z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value), 'URL no permitida')
  ).max(MAX_MEDIA_PER_POST).optional(),
};

export const createPostSchema = z.object(editablePostFields).strict();
export const updatePostSchema = z.object(editablePostFields).strict()
  .refine((value) => Object.keys(value).length > 0, 'No hay cambios para guardar');

export const rangeSchema = z.object({ from: daySchema, to: daySchema }).refine(
  ({ from, to }) => from <= to && (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000 <= 92,
  'El rango no puede superar 93 días'
);

export const uploadFieldsSchema = z.object({
  startDay: daySchema.refine((value) => {
    const distance = Math.abs(new Date(`${value}T00:00:00Z`).getTime() - Date.now());
    return distance <= 5 * 366 * 86_400_000;
  }, 'La fecha está fuera del rango permitido').optional(),
  defaultTime: timeSchema.optional(),
  networks: z.string().optional().transform((value, ctx) => {
    if (!value) return ['instagram'] as Array<'instagram' | 'facebook'>;
    const values = [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
    if (values.length === 0 || values.some((item) => item !== 'instagram' && item !== 'facebook')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Red social inválida' });
      return z.NEVER;
    }
    return values as Array<'instagram' | 'facebook'>;
  }),
  title: z.string().trim().max(200).optional(),
  caption: z.string().max(10_000).optional(),
}).strict();

export const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export function validationError(error: z.ZodError): Response {
  return Response.json(
    { error: 'Datos inválidos', details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) },
    { status: 400 }
  );
}

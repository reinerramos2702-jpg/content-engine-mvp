import { describe, expect, it } from 'vitest';
import {
  createPostSchema,
  daySchema,
  rangeSchema,
  settingsSchema,
  uploadFieldsSchema,
} from './validation';

describe('content calendar validation', () => {
  it('acepta un post con múltiples medios válidos', () => {
    const result = createPostSchema.safeParse({
      caption: 'Contenido',
      scheduledFor: '2026-10-01T18:00:00-04:00',
      networks: ['instagram', 'facebook'],
      mediaType: 'carousel',
      media: [
        { url: 'https://cdn.example.com/one.jpg', kind: 'image' },
        { url: 'https://cdn.example.com/two.jpg', kind: 'image' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ['URL no HTTP', { media: [{ url: 'javascript:alert(1)', kind: 'image' }] }],
    ['red desconocida', { networks: ['tiktok'] }],
    ['estado enviado por cliente', { status: 'published' }],
    ['caption demasiado largo', { caption: 'x'.repeat(10_001) }],
  ])('rechaza %s', (_label, input) => {
    expect(createPostSchema.safeParse(input).success).toBe(false);
  });

  it('rechaza fechas inexistentes y rangos superiores a 93 días', () => {
    expect(daySchema.safeParse('2026-02-30').success).toBe(false);
    expect(rangeSchema.safeParse({ from: '2026-01-01', to: '2026-05-01' }).success).toBe(false);
  });

  it('valida timezone y hora por defecto', () => {
    expect(settingsSchema.safeParse({ timezone: 'America/Caracas', defaultPostTime: '08:15' }).success).toBe(true);
    expect(settingsSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false);
    expect(settingsSchema.safeParse({ defaultPostTime: '25:00' }).success).toBe(false);
  });

  it('valida y elimina redes duplicadas del multipart', () => {
    const parsed = uploadFieldsSchema.parse({ networks: 'instagram,instagram,facebook' });
    expect(parsed.networks).toEqual(['instagram', 'facebook']);
    expect(uploadFieldsSchema.safeParse({ networks: 'instagram,tiktok' }).success).toBe(false);
  });
});

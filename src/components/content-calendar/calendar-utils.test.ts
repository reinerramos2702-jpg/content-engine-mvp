import { describe, expect, it } from 'vitest';
import {
  calendarDays,
  distributeFiles,
  groupPostsByDay,
  scheduledISOString,
  startOfWeek,
  toYMD,
  visibleRange,
  type ContentPost,
} from './calendar-utils';

const basePost: ContentPost = {
  id: 'post-1',
  status: 'scheduled',
  networks: ['instagram'],
  mediaType: 'image',
  media: [],
};

describe('calendar-utils', () => {
  it('calcula una semana de lunes a domingo sin depender de UTC', () => {
    const monday = startOfWeek(new Date(2026, 8, 25, 15));
    expect(toYMD(monday)).toBe('2026-09-21');
    expect(calendarDays(monday, 'week').map(toYMD)).toEqual([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ]);
  });

  it('incluye las seis filas visibles al pedir el rango mensual', () => {
    expect(visibleRange(new Date(2026, 8, 25), 'month')).toEqual({
      from: '2026-08-31',
      to: '2026-10-11',
    });
  });

  it('agrupa por día y ordena por hora', () => {
    const groups = groupPostsByDay([
      { ...basePost, id: 'late', day: '2026-09-25', time: '18:00' },
      { ...basePost, id: 'early', day: '2026-09-25', time: '09:00' },
      { ...basePost, id: 'other', scheduledFor: '2026-09-26T12:00:00.000Z' },
    ]);
    expect(groups['2026-09-25'].map((post) => post.id)).toEqual(['early', 'late']);
    expect(groups['2026-09-26'][0].id).toBe('other');
  });

  it('distribuye archivos respetando el máximo diario', () => {
    expect(distributeFiles(['a.jpg', 'b.jpg', 'c.jpg'], '2026-09-25', '18:00', 2, ['2026-09-25'])).toEqual([
      { fileName: 'a.jpg', day: '2026-09-25', time: '18:00' },
      { fileName: 'b.jpg', day: '2026-09-26', time: '18:00' },
      { fileName: 'c.jpg', day: '2026-09-26', time: '18:00' },
    ]);
  });

  it('convierte la hora del calendario a UTC usando su zona horaria', () => {
    expect(scheduledISOString('2026-09-25', '18:00', 'America/Caracas')).toBe('2026-09-25T22:00:00.000Z');
  });
});

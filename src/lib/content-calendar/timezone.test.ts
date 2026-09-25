import { describe, expect, it } from 'vitest';
import { addDays, dayKey, isValidTimezone, timeKey, zonedToUtc } from './timezone';

describe('content calendar timezone helpers', () => {
  it('valida zonas IANA y rechaza valores inventados', () => {
    expect(isValidTimezone('America/Caracas')).toBe(true);
    expect(isValidTimezone('Not/A-Timezone')).toBe(false);
  });

  it('convierte hora local a UTC sin depender de la zona del servidor', () => {
    const utc = zonedToUtc('2026-09-25', '18:30', 'America/Caracas');
    expect(utc.toISOString()).toBe('2026-09-25T22:30:00.000Z');
    expect(dayKey(utc, 'America/Caracas')).toBe('2026-09-25');
    expect(timeKey(utc, 'America/Caracas')).toBe('18:30');
  });

  it('suma días correctamente al cruzar mes y año', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

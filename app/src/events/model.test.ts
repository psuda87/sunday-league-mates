import { describe, expect, it } from 'vitest';
import { emptyMatchForm, nextMatchDay, warsawFields } from './model';
describe('termin meczu w Warszawie', () => {
  it('nie zgaduje godziny ani limitu i używa zatwierdzonych kosztów', () => {
    expect(emptyMatchForm()).toMatchObject({ time: '', capacity: '', duration_minutes: '90', hourly_rate: '180', total_cost: '270' });
  });
  it('używa daty Warszawy, nawet gdy w UTC jest poprzedni dzień', () => {
    expect(nextMatchDay('2026-10-14T22:30:00Z', 4)).toBe('2026-10-15');
    expect(nextMatchDay('2026-10-14T22:30:00Z', 0)).toBe('2026-10-18');
  });
  it('uwzględnia zmianę czasu zimowego i letniego', () => {
    expect(warsawFields('2026-01-08T18:30:00Z').time).toBe('19:30');
    expect(warsawFields('2026-07-02T17:30:00Z').time).toBe('19:30');
  });
});

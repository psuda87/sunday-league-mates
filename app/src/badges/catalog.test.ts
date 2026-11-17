import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BADGES, badgeAsset } from './catalog';

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), '../assets/badges/badges.json'), 'utf8')) as { badges: { code: string; name: string; threshold: number | null }[] };

describe('katalog odznak', () => {
  it('ma 20 unikalnych kodów zgodnych z manifestem', () => {
    expect(BADGES).toHaveLength(20);
    expect(new Set(BADGES.map(b => b.code)).size).toBe(20);
    expect(BADGES.map(b => b.code).sort()).toEqual(manifest.badges.map(b => b.code).sort());
  });
  it('nazwy zgadzają się z manifestem', () => {
    for (const b of BADGES) expect(manifest.badges.find(m => m.code === b.code)?.name).toBe(b.name);
  });
  it('każda odznaka ma grafikę WebP w app/public', () => {
    for (const b of BADGES) expect(existsSync(resolve(process.cwd(), 'public' + badgeAsset(b.code)))).toBe(true);
  });
  it('Turysta został usunięty', () => {
    expect(BADGES.some(b => b.code === 'SLM-ZER-010')).toBe(false);
  });
});

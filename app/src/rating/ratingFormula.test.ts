import { describe, expect, it } from 'vitest';
import { PROVISIONAL_WEIGHTS } from './rating';
import { BONUS_SPAN, RATING_FORMULA_VERSION, computeRating } from './ratingFormula';
import type { RatingInput } from './ratingFormula';

const base: RatingInput = { peerScores: [], ratedMatches: 0, mvpUnits: 0, goals: 0, assists: 0, matchesPlayed: 0, attendance: 0 };
const mature = (over: Partial<RatingInput>): RatingInput => ({ ...base, ratedMatches: 10, matchesPlayed: 10, peerScores: Array(20).fill(7), ...over });

describe('provisional rating formula', () => {
  it('is explicitly versioned as a proposal and weights add up to 100%', () => {
    expect(RATING_FORMULA_VERSION).toMatch(/^proposal/);
    expect(Object.values(PROVISIONAL_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
  it('keeps new players at 7,0 until five rated matches', () => {
    expect(computeRating(base)).toMatchObject({ rating: 7, provisional: true });
    expect(computeRating({ ...base, ratedMatches: 4, peerScores: [10, 10, 10, 10], mvpUnits: 4, goals: 20, matchesPlayed: 4, attendance: 1 })).toMatchObject({ rating: 7, provisional: true });
  });
  it('stays at 7,0 for a neutral mature player', () => {
    expect(computeRating(mature({}))).toMatchObject({ rating: 7, provisional: false });
  });
  it('smooths rare ratings toward the prior', () => {
    const r = computeRating({ ...base, ratedMatches: 5, matchesPlayed: 5, peerScores: [10, 10] });
    expect(r.components.peer).toBeCloseTo((35 + 20) / 7, 10);
    expect(r.rating).toBeLessThan(10);
  });
  it('lets peers dominate: bonuses add at most 0.6 points, MVP at most 0.36', () => {
    const none = computeRating(mature({}));
    const allBonuses = computeRating(mature({ mvpUnits: 100, goals: 1000, assists: 1000, attendance: 1 }));
    expect(allBonuses.rating - none.rating).toBeLessThanOrEqual(0.6 + 1e-9);
    const mvpOnly = computeRating(mature({ mvpUnits: 100 }));
    expect(mvpOnly.rating - none.rating).toBeCloseTo(PROVISIONAL_WEIGHTS.mvp * BONUS_SPAN, 1);
    const peers = computeRating(mature({ peerScores: Array(20).fill(9) }));
    expect(peers.rating - none.rating).toBeGreaterThan(allBonuses.rating - none.rating);
  });
  it('gives diminishing returns for goals and assists', () => {
    const at = (ga: number) => computeRating(mature({ goals: ga })).components.goalsAssists;
    expect(at(10) - at(0)).toBeGreaterThan(at(20) - at(10));
    expect(at(20) - at(10)).toBeGreaterThan(at(40) - at(30));
  });
  it('never penalizes attendance and keeps ratings within 1–10 with two decimals', () => {
    expect(computeRating(mature({ attendance: 0 })).rating).toBe(7);
    expect(computeRating(mature({ attendance: -3 })).rating).toBe(7);
    expect(computeRating(mature({ peerScores: Array(30).fill(1) })).rating).toBeGreaterThanOrEqual(1);
    expect(computeRating(mature({ peerScores: Array(30).fill(10), mvpUnits: 99, goals: 999, attendance: 1 })).rating).toBeLessThanOrEqual(10);
    const r = computeRating(mature({ peerScores: [8, 9, 7, 8, 8, 9, 6] })).rating;
    expect(r).toBe(Math.round(r * 100) / 100);
  });
  it('ignores non-finite peer scores', () => {
    expect(computeRating(mature({ peerScores: [Number.NaN, 7, 7] })).rating).toBe(7);
  });
});

import { describe, expect, it } from 'vitest';
import { BONUS_SPLIT, MONTHLY_BONUS_MAX, RATING_FORMULA_VERSION, applyBonus, monthlyBonus, rollingStep } from './ratingFormula';
import type { MonthStats } from './ratingFormula';

const month = (over: Partial<MonthStats>): MonthStats => ({ played: 4, signed: 4, reserve: 0, goals: 0, assists: 0, mvpUnits: 0, actionWins: 0, ...over });

describe('rating formula 0.2 (mirrors the SQL settlement)', () => {
  it('is version 0.2 and the bonus parts add up to the monthly maximum', () => {
    expect(RATING_FORMULA_VERSION).toBe('0.2');
    expect(Object.values(BONUS_SPLIT).reduce((a, b) => a + b, 0)).toBeCloseTo(MONTHLY_BONUS_MAX, 10);
  });
  it('moves 10% toward the match average (same numbers as tests/rating_module.sql)', () => {
    expect(rollingStep(7, [9, 9, 9])).toBe(7.2);
    expect(rollingStep(7, [6, 6, 5])).toBe(6.867);
    expect(rollingStep(7.4, [8.4, 8.4])).toBe(7.5);
  });
  it('ignores a match with fewer than two ballots and non-finite scores', () => {
    expect(rollingStep(7.3, [10])).toBe(7.3);
    expect(rollingStep(7.3, [Number.NaN, 10])).toBe(7.3);
  });
  it('stays within 1–10', () => {
    expect(rollingStep(9.99, [10, 10])).toBeLessThanOrEqual(10);
    expect(rollingStep(1, [1, 1])).toBe(1);
  });
  it('matches the SQL example: one match, Gold, 2 goals + 1 assist, winning action, one sign-up', () => {
    const bonus = monthlyBonus({ played: 1, signed: 1, reserve: 0, goals: 2, assists: 1, mvpUnits: 1, actionWins: 1 });
    expect(bonus).toBe(Math.round((0.3 + 0.12 * (1 - Math.exp(-0.75)) + 0.1) * 1000) / 1000);
    expect(applyBonus(7.2, bonus)).toBe(7.663);
  });
  it('never exceeds +0.6 and gives nothing without a played match', () => {
    expect(monthlyBonus(month({ mvpUnits: 99, goals: 999, actionWins: 99 }))).toBeLessThanOrEqual(0.6);
    expect(monthlyBonus(month({ played: 0, signed: 0, reserve: 3 }))).toBe(0);
  });
  it('attendance rewards reliability; a reserve sign-up counts like a presence', () => {
    expect(monthlyBonus(month({}))).toBe(0.08);
    expect(monthlyBonus(month({ played: 2, signed: 4 }))).toBe(0.04);
    expect(monthlyBonus(month({ played: 2, signed: 2, reserve: 2 }))).toBe(0.08);
    expect(monthlyBonus(month({ played: 1, signed: 1 }))).toBe(0);
  });
  it('gives diminishing returns for goals and assists and never a penalty', () => {
    const g = (n: number) => monthlyBonus(month({ goals: n })) - monthlyBonus(month({}));
    expect(g(8)).toBeGreaterThan(0);
    expect(g(8) - g(0)).toBeGreaterThan(g(16) - g(8));
    expect(monthlyBonus(month({ goals: -5 }))).toBe(0.08);
  });
  it('a tie gives a quarter of the MVP credit', () => {
    expect(monthlyBonus(month({ signed: 0, played: 1, mvpUnits: 0.25 }))).toBe(0.15);
  });
});

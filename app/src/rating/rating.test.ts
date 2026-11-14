import { describe, expect, it } from 'vitest';
import { accumulatedMvp, canRate, clampRating, formatRating, mvpGoldActive, mvpQuorum, ratingChangeUnlocked, ratingWindowOpen, resolveMvp, starFills, starsFromRating, tieQuartersAfter } from './rating';

const at = (iso: string) => new Date(iso);
const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

describe('rating scale and stars', () => {
  it('starts at 7/10 = 3.5 stars and formats Polish one decimal', () => {
    expect(starsFromRating(7)).toBe(3.5);
    expect(starFills(7)).toEqual([1, 1, 1, 0.5, 0]);
    expect(formatRating(7)).toBe('7,0');
    expect(formatRating(8.26)).toBe('8,3');
  });
  it('supports ratings below 7 down to 1 and clamps invalid input', () => {
    expect(starsFromRating(1)).toBe(0.5);
    expect(clampRating(0)).toBe(1);
    expect(clampRating(11)).toBe(10);
    expect(clampRating(Number.NaN)).toBe(7);
    expect(starFills(10)).toEqual([1, 1, 1, 1, 1]);
  });
  it('unlocks changes only after five rated matches', () => {
    expect(ratingChangeUnlocked(4)).toBe(false);
    expect(ratingChangeUnlocked(5)).toBe(true);
  });
});

describe('rating window and permissions', () => {
  const ended = at('2026-11-14T20:00:00Z');
  it('is open for 48 hours after the match ends', () => {
    expect(ratingWindowOpen(ended, at('2026-11-14T19:59:59Z'))).toBe(false);
    expect(ratingWindowOpen(ended, at('2026-11-16T19:59:59Z'))).toBe(true);
    expect(ratingWindowOpen(ended, at('2026-11-16T20:00:00Z'))).toBe(false);
  });
  it('forbids self-rating, outsiders and out-of-range scores', () => {
    expect(canRate('a', 'b', ids, 8)).toBe(true);
    expect(canRate('a', 'a', ids, 8)).toBe(false);
    expect(canRate('a', 'zz', ids, 8)).toBe(false);
    expect(canRate('zz', 'a', ids, 8)).toBe(false);
    expect(canRate('a', 'b', ids, 0)).toBe(false);
    expect(canRate('a', 'b', ids, 7.5)).toBe(false);
  });
});

describe('MVP voting', () => {
  it('requires at least half of the participants (5/10, 6/12)', () => {
    expect(mvpQuorum(10)).toBe(5);
    expect(mvpQuorum(12)).toBe(6);
    expect(mvpQuorum(7)).toBe(4);
    const four = ids.slice(0, 4).map(v => ({ voterId: v, targetId: 'j' }));
    expect(resolveMvp(four, ids)).toMatchObject({ valid: false, outcome: 'no_quorum', winners: [] });
  });
  it('awards Gold to a clear winner and ignores self, outsider and duplicate votes', () => {
    const votes = [
      ...['a', 'b', 'c', 'd'].map(v => ({ voterId: v, targetId: 'j' })),
      { voterId: 'e', targetId: 'e' }, { voterId: 'x', targetId: 'j' }, { voterId: 'f', targetId: 'zz' },
      { voterId: 'g', targetId: 'i' }, { voterId: 'g', targetId: 'j' }
    ];
    const r = resolveMvp(votes, ids);
    expect(r).toMatchObject({ valid: true, outcome: 'gold', winners: ['j'], counted: 5 });
    expect(r.tally).toEqual({ j: 5 });
  });
  it('reports a tie for first place and accumulates 0.25 units; four ties make one', () => {
    const votes = [
      ...['a', 'b', 'c'].map(v => ({ voterId: v, targetId: 'i' })),
      ...['d', 'e', 'f'].map(v => ({ voterId: v, targetId: 'j' }))
    ];
    const r = resolveMvp(votes, ids);
    expect(r).toMatchObject({ valid: true, outcome: 'tie', winners: ['i', 'j'] });
    let quarters = 0;
    for (let i = 0; i < 3; i++) quarters = tieQuartersAfter(quarters, r, 'i');
    expect(accumulatedMvp(quarters)).toBe(0);
    quarters = tieQuartersAfter(quarters, r, 'i');
    expect(accumulatedMvp(quarters)).toBe(1);
    expect(tieQuartersAfter(0, r, 'a')).toBe(0);
  });
  it('handles an empty match', () => {
    expect(resolveMvp([], [])).toMatchObject({ valid: false, outcome: 'no_quorum' });
  });
});

describe('MVP Gold lifetime', () => {
  const gold = { endedAt: at('2026-11-01T20:00:00Z'), voteValid: true, wonGold: true };
  it('is active for seven days after the awarding match', () => {
    expect(mvpGoldActive([gold], at('2026-11-08T19:59:59Z'))).toBe(true);
    expect(mvpGoldActive([gold], at('2026-11-08T20:00:00Z'))).toBe(false);
    expect(mvpGoldActive([], at('2026-11-02T00:00:00Z'))).toBe(false);
  });
  it('expires after a later valid vote that the player did not win', () => {
    const later = { endedAt: at('2026-11-05T20:00:00Z'), voteValid: true, wonGold: false };
    expect(mvpGoldActive([gold, later], at('2026-11-06T00:00:00Z'))).toBe(false);
  });
  it('is not removed by a later vote without quorum', () => {
    const later = { endedAt: at('2026-11-05T20:00:00Z'), voteValid: false, wonGold: false };
    expect(mvpGoldActive([gold, later], at('2026-11-06T00:00:00Z'))).toBe(true);
    expect(mvpGoldActive([gold, later], at('2026-11-08T20:00:00Z'))).toBe(false);
  });
  it('is renewed from the new match when Gold is won again', () => {
    const again = { endedAt: at('2026-11-05T20:00:00Z'), voteValid: true, wonGold: true };
    expect(mvpGoldActive([again, gold], at('2026-11-12T00:00:00Z'))).toBe(true);
    expect(mvpGoldActive([gold, again], at('2026-11-12T20:00:00Z'))).toBe(false);
  });
});

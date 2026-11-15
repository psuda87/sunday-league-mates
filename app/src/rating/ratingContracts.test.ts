import { describe, expect, it } from 'vitest';
import { matchRatingState, playerRating, ratingOverview, scoreWarnings } from './ratingContracts';

const reported = { goals_a: 0, goals_b: 0, assists_a: 0, assists_b: 0 };
describe('rating contracts', () => {
  it('parses an overview and rejects malformed payloads', () => {
    expect(ratingOverview({ me: { user_id: 'u', rating: 7, final: false, rated_matches: 0 }, gold: ['x'] }).gold).toEqual(['x']);
    expect(() => ratingOverview({ me: { user_id: 'u', rating: '7', final: false }, gold: [] })).toThrow();
    expect(() => ratingOverview({ me: { user_id: 'u', rating: 7, final: false }, gold: [1] })).toThrow();
    expect(() => playerRating(null)).toThrow();
    expect(() => matchRatingState({ event_id: 'e', phase: 'nope', participants: [], my: {}, reported })).toThrow();
  });
  it('reports no warnings without a score or when numbers agree', () => {
    expect(scoreWarnings({ score: null, reported: { ...reported, goals_a: 9 } })).toEqual([]);
    expect(scoreWarnings({ score: { a: 4, b: 2, changed_at: '', changed_by: '' }, reported: { goals_a: 4, goals_b: 1, assists_a: 2, assists_b: 0 } })).toEqual([]);
  });
  it('flags too many goals, too many assists and suspiciously equal assists', () => {
    const w = scoreWarnings({ score: { a: 4, b: 2, changed_at: '', changed_by: '' }, reported: { goals_a: 5, goals_b: 2, assists_a: 5, assists_b: 2 } });
    expect(w).toHaveLength(3);
    expect(w[0]).toContain('wpisali 5 goli, a wynik to 4');
    expect(w[1]).toContain('5 asyst przy 4 golach');
    expect(w[2]).toContain('tyle samo co goli (2)');
  });
});

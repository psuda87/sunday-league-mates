import {expect, it} from 'vitest';
import {editLineup, emptyLineup, lineupChanged} from './lineupEditor';
// UI/profile cases now live in premiumLineupApi.test.tsx with the Stage2A contract.
const initial = (ids = ['1', '2', '3']) => editLineup(emptyLineup('match'), {type: 'preview', ids});
const modelSwap = (state = initial()) => ['1', '2'].reduce((s, id) => editLineup(s, {type: 'choose', id}), editLineup(state, {type: 'mode', mode: 'swap'}));
it('swaps stable participation IDs and recognizes a swap back, independently of object key order', () => {
 const original = initial(); const swapped = modelSwap(original);
 expect(swapped.draft).toEqual({'1': 'b', '2': 'a', '3': 'a'});
 expect(swapped.baseline).toEqual(original.baseline);
 expect(lineupChanged(swapped.baseline, swapped.draft)).toBe(true);
 const back = modelSwap(swapped);
 expect(lineupChanged(back.baseline, back.draft)).toBe(false);
 expect(lineupChanged({'1': 'a', '2': 'b'}, {'2': 'b', '1': 'a'})).toBe(false);
});
it('transfers one player in either direction and restores the original baseline without regeneration', () => {
 const original = initial();
 let changed = editLineup(original, {type: 'mode', mode: 'transfer'});
 changed = editLineup(changed, {type: 'choose', id: '1'});
 changed = editLineup(changed, {type: 'transfer'});
 expect(changed.draft['1']).toBe('b'); expect(changed.draft['2']).toBe('b');
 expect(changed.baseline).toEqual(original.baseline);
 const selected = editLineup(changed, {type: 'choose', id: '2'});
 const restored = editLineup(selected, {type: 'restore'});
 expect(restored.draft).toEqual(original.baseline); expect(restored.selected).toBeNull(); expect(restored.mode).toBeNull();
 const back = editLineup(editLineup(changed, {type: 'choose', id: '1'}), {type: 'transfer'});
 expect(lineupChanged(back.baseline, back.draft)).toBe(false);
});
it('supports 6:5 with distinct guests, and prunes withdrawn entries from both snapshots without adding new people', () => {
 const ids = Array.from({length: 11}, (_, i) => 'entry-' + i);
 const s = initial(ids);
 expect(Object.values(s.draft).filter(v => v === 'a')).toHaveLength(6);
 expect(Object.values(s.draft).filter(v => v === 'b')).toHaveLength(5);
 const changed = editLineup(s, {type: 'roster', eventId: 'match', ids: [...ids.slice(1), 'new-guest']});
 expect(changed.baseline['entry-0']).toBeUndefined(); expect(changed.draft['entry-0']).toBeUndefined();
 expect(changed.draft['new-guest']).toBeUndefined();
 expect(editLineup(s, {type: 'roster', eventId: 'another', ids})).toEqual(emptyLineup('another'));
});
it('has no side effects for incomplete selection, same-player deselection or empty transfer', () => {
 const s = initial();
 let next = editLineup(s, {type: 'mode', mode: 'swap'});
 next = editLineup(next, {type: 'choose', id: '1'}); expect(lineupChanged(next.baseline, next.draft)).toBe(false);
 next = editLineup(next, {type: 'choose', id: '1'}); expect(next.selected).toBeNull();
 expect(editLineup(next, {type: 'transfer'})).toEqual(next);
 expect(editLineup(next, {type: 'choose', id: 'foreign'})).toEqual(next);
});

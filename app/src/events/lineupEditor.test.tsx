import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {editLineup, emptyLineup, lineupChanged} from './lineupEditor';
import PremiumTeams from './PremiumTeams';
import type {MatchEntry} from './premiumContracts';
import type {SessionManager} from '../auth/sessionManager';

afterEach(cleanup);
const entry = (id: string, memberId: string | null = id): MatchEntry => ({id, member_id: memberId, responsible_user_id: memberId ?? 'inviter', display_name: 'Osoba ' + id, responsible_name: 'Zapraszający', status: 'registered', absent: false, contact_phone: null, joined_at: '2030-01-01T00:00:00Z', guest_name: memberId ? null : 'Gość', guest_phone: null});
const initial = (ids = ['1', '2', '3']) => editLineup(emptyLineup('match'), {type: 'preview', ids});
const modelSwap = (state = initial()) => ['1', '2'].reduce((s, id) => editLineup(s, {type: 'choose', id}), editLineup(state, {type: 'mode', mode: 'swap'}));
const dirty = () => document.querySelector('[data-lineup-dirty]')?.getAttribute('data-lineup-dirty');
const click = (name: string) => fireEvent.click(screen.getByRole('button', {name}));

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
it('renders 6:5, swaps back to clean, transfers a guest, restores baseline and never enables server save', () => {
 const people = Array.from({length: 11}, (_, i) => entry(String(i), i < 9 ? String(i) : null));
 render(<PremiumTeams eventId="match" participants={people} cancelled={false} canEdit/>);
 click('Utwórz lokalny podgląd'); expect(dirty()).toBe('false');
 expect(screen.getByRole('region', {name: 'Drużyna A, 6 osób'})).toBeTruthy(); expect(screen.getByRole('region', {name: 'Drużyna B, 5 osób'})).toBeTruthy();
 click('Zamień zawodników'); click('Wybierz do zamiany: Osoba 0'); click('Wybierz do zamiany: Osoba 1'); expect(dirty()).toBe('true');
 click('Wybierz do zamiany: Osoba 0'); click('Wybierz do zamiany: Osoba 1'); expect(dirty()).toBe('false');
 expect(screen.getByRole('button', {name: 'Zapisz'})).toBeDisabled();
 click('Przenieś zawodnika'); click('Wybierz do przeniesienia: Osoba 10'); click('Przenieś do drużyny B');
 expect(screen.getByRole('region', {name: 'Drużyna A, 5 osób'})).toBeTruthy(); expect(screen.getByRole('region', {name: 'Drużyna B, 6 osób'})).toBeTruthy();
 expect(dirty()).toBe('true'); click('Przywróć skład'); expect(dirty()).toBe('false');
 expect(screen.getByRole('region', {name: 'Drużyna A, 6 osób'})).toBeTruthy();
 expect(screen.getByRole('button', {name: 'Zapisz'})).toBeDisabled(); expect(screen.getByText(/backend składów nie istnieje/)).toBeTruthy();
 expect(screen.getByText('Ostatnia zmiana: brak zapisanego składu na serwerze.')).toBeTruthy();
});
const projected = (id = '1') => ({user_id: id, nickname: 'Pseudonim z API', display_name: 'Nazwa udostępniona', full_name: null, contact_phone: null, jersey_number: 27, organizer: false, joined_at: '2030-01-01', share_full_name: false});
function context(call: (action: string, body?: Record<string, unknown>) => Promise<unknown>) {
 const manager = {call: vi.fn(call), subscribe: () => () => {}, getSnapshot: () => snapshot};
 const snapshot = {phase: 'ready', session: {user_id: 'viewer'}};
 return {manager: manager as unknown as SessionManager, userId: 'viewer', groupId: 'group'};
}
it('opens the existing Ultimate card via scoped groups_profile and returns to the same local draft', async () => {
 const port = context(async () => projected());
 const people = [entry('1'), entry('2'), entry('guest', null)];
 render(<PremiumTeams eventId="match" participants={people} cancelled={false} canEdit profileContext={port}/>);
 click('Utwórz lokalny podgląd'); click('Przenieś zawodnika'); click('Wybierz do przeniesienia: Osoba 1'); click('Przenieś do drużyny B'); click('Zakończ przenoszenie');
 click('Otwórz profil: Osoba 1');
 await screen.findByRole('heading', {name: 'Nazwa udostępniona'});
 expect(port.manager.call).toHaveBeenCalledWith('groups_profile', {group_id: 'group', user_id: '1'});
 expect(screen.getByLabelText('Numer koszulki 27')).toBeTruthy(); expect(screen.queryByText('Pseudonim z listy')).toBeNull();
 click('Wróć do składów'); expect(dirty()).toBe('true');
 expect(within(screen.getByRole('region', {name: 'Drużyna B, 2 osób'})).getByText('Osoba 1')).toBeTruthy();
 expect(screen.queryByRole('button', {name: 'Otwórz profil: Osoba guest'})).toBeNull();
 expect(port.manager.call).toHaveBeenCalledTimes(1); // all lineup changes are RAM only
});
it('denies outsider profile navigation and editing, and accepts only the exact requested profile identity', async () => {
 const port = context(async () => projected('foreign'));
 const {rerender} = render(<PremiumTeams eventId="match" participants={[entry('1'), entry('2')]} cancelled={false} canEdit={false} profileContext={port}/>);
 expect(screen.getByRole('button', {name: 'Utwórz lokalny podgląd'})).toBeDisabled();
 expect(screen.queryByRole('button', {name: /Otwórz profil/})).toBeNull(); expect(port.manager.call).not.toHaveBeenCalled();
 rerender(<PremiumTeams eventId="match" participants={[entry('1'), entry('2')]} cancelled={false} canEdit profileContext={port}/>);
 click('Utwórz lokalny podgląd'); click('Otwórz profil: Osoba 1');
 await screen.findByRole('alert'); expect(screen.queryByRole('heading', {name: 'Nazwa udostępniona'})).toBeNull();
 expect(document.querySelector('.slm-ultimate-card')).toBeNull();
});
it('does not fall back to roster personal data after server denial, and drops late profile responses after back', async () => {
 let resolve!: (v: unknown) => void;
 const call = vi.fn().mockRejectedValueOnce(Error('forbidden')).mockImplementationOnce(() => new Promise(r => {resolve = r;}));
 const port = context(call);
 render(<PremiumTeams eventId="match" participants={[entry('1'), entry('2')]} cancelled={false} canEdit profileContext={port}/>);
 click('Utwórz lokalny podgląd'); click('Otwórz profil: Osoba 1'); await screen.findByRole('alert');
 expect(document.querySelector('.slm-ultimate-card')).toBeNull(); click('Spróbuj ponownie');
 await waitFor(() => expect(call).toHaveBeenCalledTimes(2)); click('Wróć do składów');
 await act(async () => resolve(projected()));
 expect(screen.queryByRole('heading', {name: 'Nazwa udostępniona'})).toBeNull(); expect(dirty()).toBe('false');
});

import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {AccountError} from '../auth/api';
import PremiumTeams from './PremiumTeams';
import {lineupFixture, uid} from './lineupFixture.test-support';
import {lineupPair, lineupSnapshot} from './lineupContracts';

it('accepts Tito as an explicitly automatic author without inventing an Auth user', () => {
  const f = lineupFixture(11, true), s = f.read();
  const changed_at = '2026-11-09T12:00:00Z';
  expect(lineupSnapshot({...s, last_change: {actor_type: 'automatic', user_id: null, display_name: 'Tito', changed_at}}, f.eventId).last_change)
    .toEqual({user_id: null, display_name: 'Tito', changed_at});
  expect(() => lineupSnapshot({...s, last_change: {user_id: null, display_name: 'Tito', changed_at}}, f.eventId)).toThrow();
  expect(() => lineupSnapshot({...s, last_change: {actor_type: 'automatic', user_id: uid(1), display_name: 'Tito', changed_at}}, f.eventId)).toThrow();
});

afterEach(cleanup);
const click = (name: string) => fireEvent.click(screen.getByRole('button', {name}));
const dirty = () => document.querySelector('[data-lineup-dirty]')?.getAttribute('data-lineup-dirty');
const swap = () => {click('Zamień zawodników'); click('Wybierz do zamiany: Osoba 0'); click('Wybierz do zamiany: Osoba 1');};
async function mount(f = lineupFixture(), port?: Awaited<ReturnType<typeof f.context>>) {
  const context = port ?? await f.context();
  const props = {eventId: f.eventId, participants: f.people, cancelled: false, canEdit: true, profileContext: context};
  const view = render(<PremiumTeams {...props}/>);
  await screen.findByText(f.read().version ? 'Zapisany skład · lokalna edycja' : 'Propozycja składu · niezapisana');
  return {f, context, props, ...view};
}
it('opens version0 with the Stage1 6:5 proposal and distinct guest IDs, without any automatic save', async () => {
  const {f, container} = await mount();
  expect(screen.getByText('Brak zapisanych zmian')).toBeTruthy();
  expect(screen.getByRole('region', {name: 'Drużyna A, 6 osób'})).toBeTruthy();
  expect(screen.getByRole('region', {name: 'Drużyna B, 5 osób'})).toBeTruthy();
  expect(container.querySelectorAll('.slm-pitch-token')).toHaveLength(11);
  expect(container.querySelectorAll('[data-entry="' + uid(10) + '"], [data-entry="' + uid(11) + '"]')).toHaveLength(2);
  expect(screen.getByRole('button', {name: 'Zapisz'})).toBeEnabled(); expect(f.saves()).toHaveLength(0);
});
it('saves the proposal explicitly, reads back, and reopens the saved shared lineup with its safe author', async () => {
  const {f, unmount, context} = await mount(); click('Zapisz');
  await screen.findByText('Skład zapisany i odświeżony.'); expect(dirty()).toBe('false');
  expect(f.saves()).toHaveLength(1);
  expect(Object.keys(f.saves()[0]).sort()).toEqual(['event_id', 'expected_roster_version', 'expected_version', 'request_id', 'team_a', 'team_b'].sort());
  expect(f.saves()[0].team_a).toContain(uid(11)); expect(f.saves()[0].team_b).toContain(uid(10));
  expect(screen.getByText('Ostatnia zmiana: Autor API')).toBeTruthy(); unmount();
  await mount(f, context); expect(dirty()).toBe('false'); expect(screen.getByRole('button', {name: 'Zapisz'})).toBeDisabled(); expect(f.saves()).toHaveLength(1);
});
it('swaps stable participation IDs, saves the new shared layout, and allocates a new UUID to the next intention', async () => {
  const {f} = await mount(lineupFixture(11, true)); swap(); click('Zapisz');
  await screen.findByText('Skład zapisany i odświeżony.');
  expect(f.read().team_a).toContain(uid(2)); expect(f.read().team_b).toContain(uid(1));
  swap(); click('Zapisz'); await waitFor(() => expect(f.saves()).toHaveLength(2));
  expect(f.saves()[1].request_id).not.toBe(f.saves()[0].request_id);
});
it('transfers a guest A to B (6:5 -> 5:6), restores baseline and leaves both guest entries separate', async () => {
  const {f} = await mount(lineupFixture(11, true));
  click('Przenieś zawodnika'); click('Wybierz do przeniesienia: Osoba 10'); click('Przenieś do drużyny B');
  expect(screen.getByRole('region', {name: 'Drużyna B, 6 osób'})).toBeTruthy(); expect(dirty()).toBe('true');
  click('Przywróć skład'); expect(dirty()).toBe('false'); expect(f.saves()).toHaveLength(0);
  expect(screen.getByRole('region', {name: 'Drużyna A, 6 osób'})).toBeTruthy();
  click('Przenieś zawodnika'); click('Wybierz do przeniesienia: Osoba 10'); click('Przenieś do drużyny B'); click('Zapisz');
  await screen.findByText('Skład zapisany i odświeżony.'); expect(f.read().team_b).toEqual(expect.arrayContaining([uid(10), uid(11)]));
});
it('swap and reverse and transfer and reverse keep save disabled and author/time unchanged', async () => {
  const {f} = await mount(lineupFixture(11, true)), before = f.read().last_change;
  swap(); click('Wybierz do zamiany: Osoba 0'); click('Wybierz do zamiany: Osoba 1');
  expect(dirty()).toBe('false'); expect(screen.getByRole('button', {name: 'Zapisz'})).toBeDisabled();
  click('Przenieś zawodnika'); click('Wybierz do przeniesienia: Osoba 0'); click('Przenieś do drużyny B');
  click('Wybierz do przeniesienia: Osoba 0'); click('Przenieś do drużyny A');
  expect(screen.getByRole('button', {name: 'Zapisz'})).toBeDisabled(); expect(f.read().last_change).toEqual(before); expect(f.saves()).toHaveLength(0);
});
it('locks duplicate clicks and editing until a confirmed save AND readback; never invents success early', async () => {
  const {f} = await mount(); let resolve!: (value: unknown) => void;
  f.intercept(async (a, b) => a === 'lineups_save' ? new Promise(r => {resolve = r;}) : f.handle(a, b, f.userId));
  const button = screen.getByRole('button', {name: 'Zapisz'}); fireEvent.click(button); fireEvent.click(button);
  expect(f.saves()).toHaveLength(1); expect(button).toBeDisabled(); expect(screen.getByRole('button', {name: 'Zamień zawodników'})).toBeDisabled();
  expect(screen.queryByText('Skład zapisany i odświeżony.')).toBeNull(); expect(screen.getByText('Brak zapisanych zmian')).toBeTruthy();
  await act(async () => resolve(await f.handle('lineups_save', {...f.saves()[0]}, f.userId)));
  await screen.findByText('Skład zapisany i odświeżony.');
});
it('keeps the conflicting draft, asks before replacing it and never automatically saves on a newer version', async () => {
  const f = lineupFixture(11, true), {context} = await mount(f); swap();
  const second = await f.context(uid(903)); const base = f.read();
  await second.manager.call('lineups_save', {event_id: f.eventId, expected_version: base.version, expected_roster_version: base.roster_version, team_a: base.team_b, team_b: base.team_a, request_id: crypto.randomUUID()});
  click('Zapisz'); await screen.findByText(/Ktoś zapisał nowszy skład/);
  expect(dirty()).toBe('true'); expect(screen.getByRole('button', {name: 'Zapisz'})).toBeDisabled();
  click('Odśwież skład'); expect(screen.getByRole('alertdialog')).toHaveTextContent('zastąpi lokalny szkic');
  click('Zachowaj szkic'); expect(dirty()).toBe('true'); const writes = f.saves().length;
  click('Odśwież skład'); click('Pobierz aktualny skład'); await screen.findByText('Brak niezapisanych zmian.');
  expect(f.saves()).toHaveLength(writes); expect(f.saves()[1].expected_version).toBe(1); expect(context.manager.getSnapshot().phase).toBe('ready');
});
it('blocks stale roster save, refreshes the roster and never renders/restores withdrawn entries', async () => {
  const {f} = await mount(lineupFixture(11, true)); swap(); f.people[0].status = 'withdrawn'; f.rosterChanged();
  click('Zapisz'); await screen.findByText(/Lista uczestników lub mecz uległy zmianie/);
  click('Odśwież skład'); click('Pobierz aktualny skład'); await screen.findByText('Brak niezapisanych zmian.');
  expect(document.querySelector('.slm-football-pitch [data-entry="' + uid(1) + '"]')).toBeNull();
  click('Przenieś zawodnika'); click('Wybierz do przeniesienia: Osoba 2'); click('Przenieś do drużyny B'); click('Przywróć skład');
  expect(screen.queryByText('Osoba 0')).toBeNull();
});
it('reacts to a parent roster update by pruning withdrawn entries and blocking saves until explicit refresh', async () => {
  const {f, props, rerender} = await mount(lineupFixture(11, true)); swap();
  f.people[0].status = 'withdrawn'; f.rosterChanged(); rerender(<PremiumTeams {...props} participants={[...f.people]}/>);
  await screen.findByText(/Lista uczestników lub mecz uległy zmianie/); expect(screen.getByRole('button', {name: 'Zapisz'})).toBeDisabled();
  expect(document.querySelector('.slm-football-pitch [data-entry="' + uid(1) + '"]')).toBeNull();
});
it('retains the uncertain UUID/draft through real SessionManager network failure and shell remount, then safely replays', async () => {
  const {f, context, unmount} = await mount(lineupFixture(11, true)); swap();
  f.intercept(async (a, b) => {
    const result = await f.handle(a, b, f.userId);
    if (a === 'lineups_save') throw new AccountError('lost response', 'network_error');
    return result;
  });
  click('Zapisz'); await waitFor(() => expect(context.manager.getSnapshot().phase).toBe('unavailable'));
  expect(document.querySelector('.slm-football-pitch')).toBeNull(); const body = f.saves()[0]; unmount();
  f.intercept(); await act(() => context.manager.refresh()); await mount(f, context);
  expect(dirty()).toBe('true'); click('Ponów zapis'); await screen.findByText('Skład zapisany i odświeżony.');
  expect(f.saves()[1]).toEqual(body); expect(f.read().version).toBe(2);
});
it('retries GET only when the write was confirmed but readback failed', async () => {
  const {f} = await mount(); let committed = false, fail = true;
  f.intercept(async (a, b) => {
    if (a === 'lineups_get' && committed && fail) throw Error('read transport unavailable');
    const result = await f.handle(a, b, f.userId); if (a === 'lineups_save') committed = true; return result;
  });
  click('Zapisz'); await screen.findByRole('button', {name: 'Ponów odczyt po zapisie'});
  expect(dirty()).toBe('true'); expect(screen.queryByText('Skład zapisany i odświeżony.')).toBeNull(); fail = false;
  click('Ponów odczyt po zapisie'); await screen.findByText('Skład zapisany i odświeżony.'); expect(f.saves()).toHaveLength(1);
});
it.each(['not_found', 'session_invalid', 'group_archived'])('hides lineup after %s and never exposes private API diagnostics', async code => {
  const {f} = await mount(lineupFixture(11, true)); swap();
  f.intercept(async () => {throw new AccountError('SECRET SQL/PRIVATE EVENT NAME', code);});
  click('Zapisz'); await screen.findByRole('alert');
  expect(document.querySelector('.slm-football-pitch')).toBeNull(); expect(screen.queryByText('Autor API')).toBeNull();
  expect(document.body).not.toHaveTextContent('SECRET SQL');
});
it.each(['cancelled', 'ended'])('reads history but cannot edit/save a %s match', async status => {
  const f = lineupFixture(11, true);
  if (status === 'cancelled') f.event.status = 'cancelled'; else f.event.starts_at = '2000-01-01T18:00:00Z';
  await mount(f); expect(screen.getByRole('button', {name: 'Zamień zawodników'})).toBeDisabled(); expect(screen.getByRole('button', {name: 'Zapisz'})).toBeDisabled(); expect(f.saves()).toHaveLength(0);
});
it('keeps draft and original existing Ultimate profile/back, excludes guest profiles and uses only the safe projection', async () => {
  const {f} = await mount(lineupFixture(11, true)); swap(); click('Zakończ zamiany'); click('Otwórz profil: Osoba 0');
  await screen.findByRole('heading', {name: 'Nazwa udostępniona'}); expect(screen.getByLabelText('Numer koszulki 27')).toBeTruthy();
  click('Wróć do składów'); expect(dirty()).toBe('true'); expect(screen.queryByRole('button', {name: 'Otwórz profil: Osoba 10'})).toBeNull(); expect(f.saves()).toHaveLength(0);
});
it('never falls back to roster personal data after denied/wrong-identity profiles, and discards late profile responses after back', async () => {
  const {f} = await mount(lineupFixture(11, true)); let resolve!: (value: unknown) => void, attempt = 0;
  f.intercept(async (a, b) => {
    if (a !== 'groups_profile') return f.handle(a, b, f.userId);
    attempt++; if (attempt === 1) return f.projected(uid(999));
    if (attempt === 2) throw new AccountError('private', 'not_found');
    return new Promise(r => {resolve = r;});
  });
  click('Otwórz profil: Osoba 0'); await screen.findByRole('alert'); expect(document.querySelector('.slm-ultimate-card')).toBeNull();
  click('Spróbuj ponownie'); await waitFor(() => expect(attempt).toBe(2)); expect(document.querySelector('.slm-ultimate-card')).toBeNull();
  click('Spróbuj ponownie'); await waitFor(() => expect(attempt).toBe(3)); click('Wróć do składów');
  await act(async () => resolve(f.projected())); expect(document.querySelector('.slm-ultimate-card')).toBeNull(); expect(dirty()).toBe('false');
});
it('outsider never fetches/edits a lineup or navigates to profiles', async () => {
  const f = lineupFixture(), context = await f.context();
  render(<PremiumTeams eventId={f.eventId} participants={f.people} cancelled={false} canEdit={false} profileContext={context}/>);
  expect(screen.queryByRole('button', {name: 'Zapisz'})).toBeNull(); expect(screen.queryByRole('button', {name: /Otwórz profil/})).toBeNull(); expect(f.request.mock.calls.filter(c => c[0] === 'lineups_get')).toHaveLength(0);
});
it('clears cached drafts on logout even while the editor is unmounted', async () => {
  const {f, context, unmount} = await mount(lineupFixture(11, true)); swap(); unmount(); await act(() => context.manager.logout());
  await act(() => context.manager.signIn(f.userId, 'fixture-only')); await mount(f, context); expect(dirty()).toBe('false');
});
it('a late response from a previous actor/manager cannot populate the new editor', async () => {
  const old = lineupFixture(11, true), next = lineupFixture(2, true);
  const oldContext = await old.context(), nextContext = await next.context(uid(904));
  let resolve!: (value: unknown) => void;
  old.intercept(async (a, b) => a === 'lineups_get' ? new Promise(r => {resolve = r;}) : old.handle(a, b, old.userId));
  const view = render(<PremiumTeams eventId={old.eventId} participants={old.people} cancelled={false} canEdit profileContext={oldContext}/>);
  await waitFor(() => expect(resolve).toBeTypeOf('function'));
  view.rerender(<PremiumTeams eventId={next.eventId} participants={next.people} cancelled={false} canEdit profileContext={nextContext}/>);
  await screen.findByText('Zapisany skład · lokalna edycja');
  await act(async () => resolve({...old.read(), last_change: {...old.read().last_change, display_name: 'Previous private author'}}));
  expect(document.querySelectorAll('.slm-pitch-token')).toHaveLength(2); expect(screen.queryByText('Previous private author')).toBeNull();
});
it('a failed explicitly confirmed refresh keeps the draft instead of discarding it', async () => {
  const {f} = await mount(lineupFixture(11, true)); swap();
  f.intercept(async () => {throw Error('offline read');});
  click('Odśwież skład'); click('Pobierz aktualny skład'); await screen.findByRole('alert');
  expect(dirty()).toBe('true'); expect(document.querySelector('.slm-team-b [data-entry="' + uid(1) + '"]')).toBeTruthy();
  expect(f.saves()).toHaveLength(0);
});
it('rejects mismatched identity, unsafe author, overlapping IDs and inconsistent roster versions without showing a pitch', () => {
  const f = lineupFixture(11, true), s = f.read();
  expect(() => lineupSnapshot({...s, event_id: uid(999)}, f.eventId)).toThrow();
  expect(() => lineupSnapshot({...s, last_change: {...s.last_change, display_name: ''}}, f.eventId)).toThrow();
  expect(() => lineupSnapshot({...s, team_b: [s.team_a[0]]}, f.eventId)).toThrow();
  expect(() => lineupPair(f.detail(), {...s, event_version: 999}, f.eventId, f.groupId)).toThrow();
  expect(() => lineupPair(f.detail(), s, f.eventId, uid(999))).toThrow();
});

it('members see only the saved assignment and cannot edit, retry or synthesize an admin draft',async()=>{
 const f=lineupFixture(11,true),context=await f.context();
 f.intercept(async(action,body)=>action==='lineups_get'?{...f.read(),can_write:false}:f.handle(action,body,f.userId));
 render(<PremiumTeams eventId={f.eventId} participants={f.people} cancelled={false} canEdit profileContext={context}/>);
 await screen.findByText('Zapisany skład · tylko odczyt');
 expect(screen.getByRole('region',{name:'Drużyna A, 6 osób'})).toBeTruthy();
 click('Zapisz');click('Zamień zawodników');expect(f.saves()).toHaveLength(0);
 expect(screen.getByRole('button',{name:'Przenieś zawodnika'})).toBeDisabled();
});
it('an old backend without the explicit permission contract is read-only',async()=>{
 const f=lineupFixture(11,false),context=await f.context();
 f.intercept(async(action,body)=>action==='lineups_get'?{...f.read(),can_write:undefined}:f.handle(action,body,f.userId));
 render(<PremiumTeams eventId={f.eventId} participants={f.people} cancelled={false} canEdit profileContext={context}/>);
 await screen.findByText('Brak zapisanego składu');
 expect(screen.getByRole('region',{name:'Drużyna A, 0 osób'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Zapisz'})).toBeDisabled();expect(f.saves()).toHaveLength(0);
});

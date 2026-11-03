import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {AccountError} from '../auth/api';
import type {SessionManager, SessionState} from '../auth/sessionManager';
import type {LineupProfileContext} from './LineupPlayerProfile';
import {editLineup, emptyLineup, lineupChanged} from './lineupEditor';
import type {LineupAction, LineupEditor} from './lineupEditor';
import {lineupMessage, lineupPair, lineupSnapshot} from './lineupContracts';
import type {LineupSnapshot, LineupWrite} from './lineupContracts';
import type {MatchDetail} from './premiumContracts';

interface State {
  editor: LineupEditor; snapshot: LineupSnapshot | null; detail: MatchDetail | null;
  lastChange: LineupSnapshot['last_change']; receivedAt: number; verifiedFor: symbol | null;
  pending: 'load' | 'save' | null; blocked: boolean; error: string; notice: string;
  intent: {body: LineupWrite; accepted: boolean} | null;
}
const empty = (id: string): State => ({editor: emptyLineup(id), snapshot: null, detail: null, lastChange: null,
  receivedAt: 0, verifiedFor: null, pending: null, blocked: false, error: '', notice: '', intent: null});
// UI RAM only. Survives the existing Auth shell's offline unmount; never storage.
// A listener remains on the manager so logout clears drafts even while unmounted.
const memories = new WeakMap<SessionManager, Map<string, State>>();
function memoryFor(manager: SessionManager) {
  let memory = memories.get(manager);
  if (!memory) {
    memory = new Map(); memories.set(manager, memory);
    const rows = memory;
    manager.subscribe(() => {
      const auth = manager.getSnapshot();
      if (auth.phase === 'signed_out' || auth.phase === 'storage_error') rows.clear();
      if (auth.phase === 'ready') for (const key of rows.keys()) if (JSON.parse(key)[0] !== auth.session?.user_id) rows.delete(key);
    });
  }
  return memory;
}
const noSession: SessionState = {phase: 'signed_out', session: null, message: ''};
const noSubscribe = () => () => {};
const noSnapshot = () => noSession;
const codeOf = (e: unknown) => e instanceof AccountError ? e.code : 'service_unavailable';
const denied = (code: string) => ['session_invalid', 'not_found', 'forbidden', 'group_archived'].includes(code);
function isClosed(s: State) {
  const e = s.detail?.event;
  return !!e && (e.status === 'cancelled' || Date.parse(s.detail!.server_now) + Date.now() - s.receivedAt >= Date.parse(e.starts_at) + e.duration_minutes! * 60000);
}

export function usePremiumLineup(eventId: string, context: LineupProfileContext | undefined, allowed: boolean, active: boolean, incomingRoster: string) {
  const manager = context?.manager, userId = context?.userId ?? '', groupId = context?.groupId ?? '';
  const auth = useSyncExternalStore(manager?.subscribe ?? noSubscribe, manager?.getSnapshot ?? noSnapshot);
  const sessionStamp = useMemo(() => ({session: auth.session, stamp: Symbol('confirmed lineup session')}), [auth.session]).stamp;
  const key = JSON.stringify([userId, groupId, eventId]);
  const [state, render] = useState<State>(() => empty(eventId));
  const stateRef = useRef(state), current = useRef({manager, key, allowed, auth});
  current.current = {manager, key, allowed, auth};
  const epoch = useRef(0), flight = useRef<number | null>(null), mounted = useRef(false);
  const binding = useRef<{manager: typeof manager; key: string} | null>(null);
  const [clock, tick] = useState(0);
  const authorized = useCallback(() => {
    const c = current.current;
    return mounted.current && c.manager === manager && c.key === key && c.allowed && c.auth.phase === 'ready' && c.auth.session?.user_id === userId;
  }, [manager, key, userId]);
  const put = useCallback((next: State) => {
    stateRef.current = next;
    // Never resurrect a draft after logout/user change from a late response.
    const a = manager?.getSnapshot();
    if (manager && a?.phase !== 'signed_out' && a?.phase !== 'storage_error' && (!a?.session || a.session.user_id === userId)) memoryFor(manager).set(key, {...next, pending: null, verifiedFor: null});
    render(next);
  }, [manager, key, userId]);
  const pair = useCallback(async () => {
    if (!manager) throw new AccountError('Brak sesji.', 'session_invalid');
    for (let attempt = 0; ; attempt++) {
      const [detail, snapshot] = await Promise.all([manager.call('matches_detail', {event_id: eventId}), manager.call('lineups_get', {event_id: eventId})]);
      try { return lineupPair(detail, snapshot, eventId, groupId); }
      catch (e) { if (codeOf(e) !== 'lineup_roster_conflict' || attempt === 1) throw e; }
    }
  }, [manager, eventId, groupId]);
  const acceptPair = useCallback((value: Awaited<ReturnType<typeof pair>>, preserve: boolean) => {
    const old = stateRef.current, {detail, snapshot, baseline} = value;
    const ids = detail.participants.filter(p => p.status === 'registered').map(p => p.id);
    if (snapshot.can_write && preserve && old.snapshot?.can_write && (lineupChanged(old.editor.baseline, old.editor.draft) || old.intent)) {
      const rosterChanged = old.snapshot.roster_version !== snapshot.roster_version;
      const versionChanged = old.snapshot.version !== snapshot.version;
      put({...old, detail, lastChange: snapshot.last_change, receivedAt: Date.now(), verifiedFor: sessionStamp, pending: null,
        editor: editLineup(old.editor, {type: 'roster', eventId, ids}),
        blocked: old.blocked || rosterChanged || versionChanged,
        error: rosterChanged ? 'lineup_roster_conflict' : versionChanged && !old.intent ? 'lineup_version_conflict' : old.error});
      return;
    }
    const proposal = snapshot.can_write && snapshot.version === 0 ? editLineup(emptyLineup(eventId), {type: 'preview', ids}).draft : undefined;
    put({...empty(eventId), detail, snapshot, lastChange: snapshot.last_change, receivedAt: Date.now(), verifiedFor: sessionStamp,
      editor: editLineup(emptyLineup(eventId), {type: 'load', eventId, baseline, proposal})});
  }, [eventId, put, sessionStamp]);
  const load = useCallback(async (preserve = false) => {
    if (!authorized() || flight.current !== null) return;
    const ticket = ++epoch.current; flight.current = ticket;
    put({...stateRef.current, pending: 'load', error: ''});
    try { const value = await pair(); if (authorized() && epoch.current === ticket) acceptPair(value, preserve); }
    catch (e) {
      const code = codeOf(e);
      if (epoch.current === ticket && mounted.current) {
        if (denied(code)) { if (manager) memoryFor(manager).delete(key); render({...empty(eventId), error: code}); stateRef.current = {...empty(eventId), error: code}; }
        else put({...stateRef.current, pending: null, blocked: true, error: code});
      }
    } finally { if (flight.current === ticket) flight.current = null; }
  }, [authorized, pair, acceptPair, put, eventId, manager, key]);
  // Changing actor/group/event invalidates ALL responses. Auth unavailability
  // hides data immediately but retains the scoped RAM draft for revalidation.
  useEffect(() => {
    mounted.current = true; const sequence = epoch; sequence.current++; flight.current = null;
    binding.current = {manager, key};
    const saved = manager ? memoryFor(manager).get(key) : undefined;
    stateRef.current = saved ?? empty(eventId); render(stateRef.current);
    return () => {mounted.current = false; sequence.current++; flight.current = null; binding.current = null;};
  }, [manager, key, eventId]);
  const ready = !!manager && allowed && auth.phase === 'ready' && auth.session?.user_id === userId;
  useEffect(() => {
    if (ready && active) void load(true);
    // load changes only with actor/session, not with draft edits.
  }, [ready, active, load]);
  const priorRoster = useRef(incomingRoster);
  useEffect(() => {
    if (priorRoster.current === incomingRoster) return;
    priorRoster.current = incomingRoster;
    if (stateRef.current.snapshot && authorized()) put({...stateRef.current,
      editor: editLineup(stateRef.current.editor, {type: 'roster', eventId, ids: incomingRoster ? incomingRoster.split('|') : []}),
      blocked: true, error: 'lineup_roster_conflict'});
  }, [incomingRoster, authorized, put, eventId]);
  useEffect(() => {
    if (!state.detail) return;
    const left = Date.parse(state.detail.event.starts_at) + state.detail.event.duration_minutes! * 60000 - Date.parse(state.detail.server_now) - (Date.now() - state.receivedAt);
    if (left <= 0) return;
    const timer = setTimeout(() => tick(n => n + 1), Math.min(left + 20, 2147483647));
    return () => clearTimeout(timer);
  }, [state.detail, state.receivedAt, clock]);
  const verified = ready && binding.current?.key === key && binding.current.manager === manager && state.verifiedFor === sessionStamp;
  const writable = verified && state.snapshot?.can_write === true && !state.pending && !state.blocked && !state.intent && !isClosed(state);
  function edit(action: LineupAction) {
    if (!authorized() || flight.current !== null || !writable) return;
    put({...stateRef.current, editor: editLineup(stateRef.current.editor, action), notice: ''});
  }
  async function save() {
    const s = stateRef.current;
    if (!authorized() || flight.current !== null || !s.snapshot?.can_write || s.verifiedFor !== sessionStamp || (!s.intent && (isClosed(s) || s.blocked || !lineupChanged(s.editor.baseline, s.editor.draft)))) return;
    const body: LineupWrite = s.intent?.body ?? {event_id: eventId, expected_version: s.snapshot.version, expected_roster_version: s.snapshot.roster_version,
      team_a: Object.keys(s.editor.draft).filter(id => s.editor.draft[id] === 'a').sort(), team_b: Object.keys(s.editor.draft).filter(id => s.editor.draft[id] === 'b').sort(), request_id: crypto.randomUUID()};
    const ticket = ++epoch.current; flight.current = ticket;
    put({...s, pending: 'save', error: '', notice: '', intent: s.intent ?? {body, accepted: false}});
    try {
      if (!stateRef.current.intent?.accepted) {
        const receipt = await manager!.call('lineups_save', {...body});
        const r = lineupSnapshot(receipt, eventId);
        if (!r || !receipt || typeof (receipt as Record<string, unknown>).changed !== 'boolean' || typeof (receipt as Record<string, unknown>).replayed !== 'boolean') throw Error('Invalid save receipt');
        if (!authorized() || epoch.current !== ticket) return;
        put({...stateRef.current, intent: {body, accepted: true}});
      }
      // Replay is a receipt of an earlier write, never the latest shared state.
      const value = await pair();
      if (authorized() && epoch.current === ticket) { acceptPair(value, false); put({...stateRef.current, notice: 'Skład zapisany i odświeżony.'}); }
    } catch (e) {
      const code = codeOf(e);
      if (mounted.current && epoch.current === ticket) {
        if (denied(code)) { if (manager) memoryFor(manager).delete(key); const next = {...empty(eventId), error: code}; stateRef.current = next; render(next); }
        else {
          const uncertain = ['network_error', 'service_unavailable', 'server_error'].includes(code) || stateRef.current.intent?.accepted;
          put({...stateRef.current, pending: null, error: code, blocked: !uncertain, intent: uncertain ? stateRef.current.intent : null});
        }
      }
    } finally { if (flight.current === ticket) flight.current = null; }
  }
  return {state, verified, writable, edit, save, reload: () => load(false), dirty: lineupChanged(state.editor.baseline, state.editor.draft),
    closed: isClosed(state), error: state.error ? lineupMessage(state.error) : '', ready};
}

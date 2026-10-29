// Controlled transport for UI tests only; NOT evidence of SQL/RLS correctness.
import {vi} from 'vitest';
import {SessionManager} from '../auth/sessionManager';
import {AccountError} from '../auth/api';
import type {Session} from '../auth/api';
import type {MatchEntry} from './premiumContracts';
import type {LineupSnapshot, LineupWrite} from './lineupContracts';

export const uid = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
export function lineupFixture(count = 11, saved = false) {
  const eventId = uid(900), groupId = uid(901), userId = uid(902);
  let rosterRevision = 1;
  const people: MatchEntry[] = Array.from({length: count}, (_, i) => ({id: uid(i + 1), member_id: i < 9 ? uid(i + 101) : null,
    responsible_user_id: userId, display_name: 'Osoba ' + i, responsible_name: 'Zapraszający', status: 'registered', absent: false,
    contact_phone: null, joined_at: '2026-10-01T00:00:00Z', guest_name: i < 9 ? null : 'Gość ' + i, guest_phone: null}));
  const event = {id: eventId, group_id: groupId, group_name: 'Grupa testowa', created_by: userId, name: 'Mecz testowy', visibility: 'private',
    starts_at: '2099-01-01T18:00:00Z', location: 'Boisko', status: 'scheduled', access: 'full', own_participation: true,
    duration_minutes: 90, capacity: 20, cost_cents: 0, minimum_players: 10, registered_count: count, reserve_count: 0,
    registration_open: true, decision_required: false, can_manage: false, can_edit: true, current_group_member: true, version: 1};
  const token = () => String(rosterRevision).padStart(64, '0');
  let snapshot: LineupSnapshot = {event_id: eventId, event_version: 1, version: saved ? 1 : 0, roster_version: token(), saved_roster_version: saved ? token() : null,
    team_a: saved ? people.filter((_, i) => i % 2 === 0).map(p => p.id) : [], team_b: saved ? people.filter((_, i) => i % 2 === 1).map(p => p.id) : [],
    unassigned: [], stale_entry_ids: [], last_change: saved ? {user_id: userId, display_name: 'Autor API', changed_at: '2026-10-29T10:00:00Z'} : null};
  const receipts = new Map<string, unknown>();
  let membership = true;
  const read = () => {
    const eligible = people.filter(p => p.status === 'registered').map(p => p.id), all = [...snapshot.team_a, ...snapshot.team_b];
    return structuredClone({...snapshot, event_version: event.version, roster_version: token(), unassigned: eligible.filter(id => !all.includes(id)), stale_entry_ids: all.filter(id => !eligible.includes(id))});
  };
  const detail = () => structuredClone({event: {...event, registered_count: people.filter(p => p.status === 'registered').length, reserve_count: people.filter(p => p.status === 'reserve').length}, participants: people, server_now: new Date().toISOString(), can_register_paid: true});
  const projected = (id = people[0]?.member_id) => ({user_id: id, nickname: 'Pseudonim z API', display_name: 'Nazwa udostępniona', full_name: null, contact_phone: null, jersey_number: 27, organizer: false, joined_at: '2026-10-01', share_full_name: false});
  let intercept: ((action: string, body: Record<string, unknown>) => Promise<unknown>) | undefined;
  async function handle(action: string, body: Record<string, unknown>, actor: string): Promise<unknown> {
    if (!membership && action !== 'logout') throw new AccountError('hidden', 'not_found');
    if (action === 'matches_detail') return detail();
    if (action === 'lineups_get') return read();
    if (action === 'groups_profile') return projected(body.user_id as string);
    if (action === 'logout') return {ok: true};
    if (action === 'lineups_save') {
      const b = body as unknown as LineupWrite;
      if (receipts.has(b.request_id)) return {...receipts.get(b.request_id) as object, replayed: true};
      if (b.expected_version !== snapshot.version) throw new AccountError('conflict', 'lineup_version_conflict');
      if (b.expected_roster_version !== token()) throw new AccountError('roster', 'lineup_roster_conflict');
      snapshot = {...read(), version: snapshot.version + 1, team_a: [...b.team_a].sort(), team_b: [...b.team_b].sort(), saved_roster_version: token(), last_change: {user_id: actor, display_name: 'Autor API', changed_at: new Date().toISOString()}};
      const result = {...read(), changed: true, replayed: false}; receipts.set(b.request_id, result); return result;
    }
    throw Error('Unexpected fixture action: ' + action);
  }
  const request = vi.fn(async (action: string, body: Record<string, unknown> = {}, session?: Session | null) => {
    if (action === 'login' || action === 'refresh') return sessionFor((body.identifier as string) || (body.refresh_token as string) || userId);
    return intercept ? intercept(action, body) : handle(action, body, session?.user_id ?? userId);
  });
  function sessionFor(id: string): Session { return {user_id: id, access_token: 'fixture-access', refresh_token: id, expires_in: 3600, role: 'member', must_change_password: false}; }
  async function context(id = userId) {
    const manager = new SessionManager({read: async () => id, write: async () => {}, clear: async () => {}}, async <T,>(a: string, b: Record<string, unknown> = {}, s?: Session | null) => await request(a, b, s) as T);
    await manager.signIn(id, 'fixture-only');
    return {manager, userId: id, groupId};
  }
  return {eventId, groupId, userId, people, event, read, detail, projected, request, context, handle,
    intercept: (fn?: typeof intercept) => {intercept = fn;},
    saves: () => request.mock.calls.filter(c => c[0] === 'lineups_save').map(c => c[1] as unknown as LineupWrite),
    rosterChanged: () => {rosterRevision++; event.version++;}, revoke: () => {membership = false;}};
}

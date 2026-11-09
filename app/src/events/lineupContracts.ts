import {AccountError} from '../auth/api';
import {matchDetail} from './premiumContracts';
import type {MatchDetail} from './premiumContracts';
import type {Assignment} from './lineupEditor';

export interface LineupSnapshot {
  can_write?: boolean;
  event_id: string; version: number; event_version: number; roster_version: string;
  saved_roster_version: string | null; team_a: string[]; team_b: string[];
  unassigned: string[]; stale_entry_ids: string[];
  last_change: {user_id: string | null; display_name: string; changed_at: string} | null;
}
export interface LineupWrite {
  event_id: string; expected_version: number; expected_roster_version: string;
  team_a: string[]; team_b: string[]; request_id: string;
}
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const token = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Invalid lineup contract');
  return v as Record<string, unknown>;
};
const ids = (v: unknown): string[] => {
  if (!Array.isArray(v) || !v.every(uuid) || new Set(v).size !== v.length) throw Error('Invalid lineup entries');
  return v;
};
export function lineupSnapshot(value: unknown, eventId: string): LineupSnapshot {
  const r = object(value);
  if(r.can_write!==undefined&&typeof r.can_write!=='boolean')throw Error('Invalid lineup permission');
  if (!uuid(r.event_id) || r.event_id !== eventId || !integer(r.version) || !integer(r.event_version) || !token(r.roster_version) || !(r.saved_roster_version === null || token(r.saved_roster_version))) throw Error('Invalid lineup version');
  const a = ids(r.team_a), b = ids(r.team_b), unassigned = ids(r.unassigned), stale = ids(r.stale_entry_ids);
  if (new Set([...a, ...b]).size !== a.length + b.length) throw Error('Overlapping lineup');
  let last: LineupSnapshot['last_change'] = null;
  if (r.last_change !== null) {
    const c = object(r.last_change);
    const automatic = c.actor_type === 'automatic' && c.user_id === null && c.display_name === 'Tito';
    if (!(uuid(c.user_id) && c.actor_type !== 'automatic' || automatic) || typeof c.display_name !== 'string' || !c.display_name.trim() || typeof c.changed_at !== 'string' || !Number.isFinite(Date.parse(c.changed_at))) throw Error('Invalid lineup author');
    last = {user_id: automatic ? null : c.user_id as string, display_name: c.display_name, changed_at: c.changed_at};
  }
  if (r.version === 0 ? last !== null || a.length + b.length > 0 || r.saved_roster_version !== null : !last || r.saved_roster_version === null) throw Error('Invalid saved lineup');
  return {can_write:r.can_write===true,event_id: r.event_id, version: r.version, event_version: r.event_version, roster_version: r.roster_version,
    saved_roster_version: r.saved_roster_version, team_a: a, team_b: b, unassigned, stale_entry_ids: stale, last_change: last};
}
export function lineupPair(rawDetail: unknown, rawLineup: unknown, eventId: string, groupId: string): {detail: MatchDetail; snapshot: LineupSnapshot; baseline: Assignment} {
  const detail = matchDetail(rawDetail, eventId), snapshot = lineupSnapshot(rawLineup, eventId);
  if (detail.event.group_id !== groupId || detail.event.access !== 'full') throw new AccountError('Brak dostępu do składu.', 'not_found');
  const registered = new Set(detail.participants.filter(p => p.status === 'registered').map(p => p.id));
  const all = [...snapshot.team_a, ...snapshot.team_b];
  const stale = all.filter(id => !registered.has(id));
  const represented = [...all.filter(id => registered.has(id)), ...snapshot.unassigned];
  if (detail.event.version !== snapshot.event_version || represented.length !== registered.size || new Set(represented).size !== registered.size || represented.some(id => !registered.has(id)) || stale.length !== snapshot.stale_entry_ids.length || stale.some(id => !snapshot.stale_entry_ids.includes(id))) throw new AccountError('Lista uczestników zmieniła się podczas odczytu.', 'lineup_roster_conflict');
  const baseline: Assignment = Object.fromEntries([...snapshot.team_a.map(id => [id, 'a']), ...snapshot.team_b.map(id => [id, 'b'])].filter(([id]) => registered.has(id)));
  return {detail, snapshot, baseline};
}
export function lineupMessage(code: string): string {
  return ({lineup_version_conflict: 'Ktoś zapisał nowszy skład. Twój szkic pozostał bez zmian. Odśwież, aby zobaczyć aktualny podział.',
    lineup_roster_conflict: 'Lista uczestników lub mecz uległy zmianie. Pobierz aktualny skład i roster przed kolejnym zapisem.',
    idempotency_conflict: 'Identyfikator zapisu dotyczy innej operacji. Odśwież skład przed nową próbą.',
    not_found: 'Mecz nie istnieje lub nie masz dostępu do jego składu.', forbidden: 'Nie masz dostępu do tego składu.',
    session_invalid: 'Sesja wygasła. Zaloguj się ponownie.', group_archived: 'Grupa jest zarchiwizowana. Skład jest niedostępny.',
    event_cancelled: 'Nie można zapisywać składu odwołanego meczu.', lineup_closed: 'Nie można zapisywać składu zakończonego meczu.',
    lineup_invalid_assignment: 'Skład zawiera nieaktualne przypisania. Odśwież listę uczestników.',
  } as Record<string, string>)[code] ?? 'Nie potwierdzono operacji. Szkic pozostał w pamięci; ponów żądanie lub odśwież skład.';
}

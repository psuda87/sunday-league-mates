/** Odpowiedź akcji badges_player (funkcja Edge accounts → public.slm_badges_dispatch). */
import { BADGES } from './catalog';
import type { BadgeState } from './BadgeList';

export interface EarnedBadge { code: string; group_id: string | null; group_name: string | null; season: number | null; earned_at: string; new: boolean; celebrate: boolean }
export interface PlayerBadges { user_id: string; own: boolean; earned: EarnedBadge[]; progress: { code: string; progress: number; threshold: number }[] }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const known = new Set(BADGES.map(b => b.code));

export function playerBadges(value: unknown): PlayerBadges {
  if (!isObject(value) || typeof value.user_id !== 'string' || !Array.isArray(value.earned) || !Array.isArray(value.progress)) throw Error('Invalid badges');
  const earned = value.earned.filter(isObject).filter(b => typeof b.code === 'string' && typeof b.earned_at === 'string').map(b => ({
    code: b.code as string, group_id: typeof b.group_id === 'string' ? b.group_id : null, group_name: typeof b.group_name === 'string' ? b.group_name : null,
    season: typeof b.season === 'number' ? b.season : null, earned_at: b.earned_at as string, new: b.new === true, celebrate: b.celebrate === true,
  }));
  const progress = value.progress.filter(isObject).filter(p => typeof p.code === 'string' && typeof p.progress === 'number' && Number.isFinite(p.progress))
    .map(p => ({ code: p.code as string, progress: p.progress as number, threshold: typeof p.threshold === 'number' ? p.threshold : 0 }));
  return { user_id: value.user_id, own: value.own === true, earned, progress };
}

/** Stan do BadgeList: zdobyta (najwcześniejsza data) albo postęp. Nieznane kody pomijane. */
export function badgeStates(data: PlayerBadges): BadgeState[] {
  const states = new Map<string, BadgeState>();
  for (const p of data.progress) if (known.has(p.code)) states.set(p.code, { code: p.code, current: Math.max(0, Math.floor(p.progress)) });
  for (const b of data.earned) {
    if (!known.has(b.code)) continue;
    const previous = states.get(b.code);
    if (!previous?.earnedAt || b.earned_at < previous.earnedAt) states.set(b.code, { code: b.code, earnedAt: b.earned_at, groupName: b.group_name ?? undefined, season: b.season ?? undefined });
  }
  return [...states.values()];
}

/** Odznaki do jednorazowego okienka „Nowa odznaka!”, w kolejności zdobycia. */
export const celebrateBadges = (data: PlayerBadges): EarnedBadge[] => data.own ? data.earned.filter(b => b.celebrate && known.has(b.code)) : [];

/** Wpisy „Nowa odznaka” w dzwonku: zostają do odklikania (decyzja właściciela 2026-11-17), najnowsze pierwsze. */
export const bellBadges = (data: PlayerBadges): EarnedBadge[] => data.own
  ? data.earned.filter(b => b.new && known.has(b.code)).sort((a, b) => b.earned_at.localeCompare(a.earned_at)) : [];

// Dzwonek → Mój profil, sekcja odznak (profil może zamontować się po żądaniu).
export const ownBadgesRequestEvent = 'slm-open-own-badges';
export const OWN_BADGES_SECTION_ID = 'slm-own-badges';
let requested = false;
export function requestOwnBadges() { requested = true; window.dispatchEvent(new Event(ownBadgesRequestEvent)); }
export function takeOwnBadgesRequest() { const value = requested; requested = false; return value; }

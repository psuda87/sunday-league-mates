import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import { badgeStates, playerBadges, recentBadges, unseenBadges } from './badgeContracts';
import type { EarnedBadge, PlayerBadges } from './badgeContracts';
import type { BadgeState } from './BadgeList';
import NewBadgeCelebration from './NewBadgeCelebration';

interface BadgesValue {
  get: (userId: string) => PlayerBadges | undefined;
  want: (userId: string) => void;
  recent: readonly EarnedBadge[];
  unseen: readonly EarnedBadge[];
}
const BadgesContext = createContext<BadgesValue>({ get: () => undefined, want: () => {}, recent: [], unseen: [] });

/**
 * Odznaki z serwera (akcja badges_player), tylko w pamięci, czyszczone przy zmianie konta.
 * Błąd lub brak backendu ukrywa sekcję odznak zamiast pokazywać fikcyjne dane.
 * Nowe własne odznaki: jednorazowe okienko „Nowa odznaka!”, po zamknięciu badges_seen.
 */
export function BadgesProvider({ manager, userId, children }: { manager?: SessionManager; userId?: string; children: ReactNode }) {
  const auth = useSyncExternalStore(manager?.subscribe ?? (() => () => {}), manager?.getSnapshot ?? (() => null));
  const ready = !!manager && !!userId && auth?.phase === 'ready' && auth.session?.user_id === userId;
  const [data, setData] = useState<ReadonlyMap<string, PlayerBadges>>(new Map());
  const [celebrate, setCelebrate] = useState<readonly EarnedBadge[]>([]);
  const asked = useRef(new Set<string>()), epoch = useRef(0);

  const load = useCallback((id: string, celebrateNew: boolean) => {
    if (!ready || !manager) return;
    const mine = epoch.current;
    manager.call<unknown>('badges_player', { user_id: id }).then(raw => {
      if (mine !== epoch.current) return;
      const value = playerBadges(raw);
      setData(previous => new Map(previous).set(value.user_id, value));
      if (celebrateNew && value.own) setCelebrate(unseenBadges(value));
    }).catch(() => {});
  }, [manager, ready]);

  useEffect(() => {
    epoch.current += 1; asked.current = new Set(); setData(new Map()); setCelebrate([]);
    if (ready && userId) { asked.current.add(userId); load(userId, true); }
  }, [userId, ready, load]);

  const want = useCallback((id: string) => {
    if (!ready || !id || asked.current.has(id)) return;
    asked.current.add(id); load(id, false);
  }, [ready, load]);

  const finish = useCallback(() => {
    setCelebrate([]);
    if (!ready || !manager || !userId) return;
    const mine = epoch.current;
    manager.call<unknown>('badges_seen').then(() => {
      if (mine !== epoch.current) return;
      setData(previous => {
        const own = previous.get(userId);
        if (!own) return previous;
        return new Map(previous).set(userId, { ...own, earned: own.earned.map(b => ({ ...b, new: false })) });
      });
    }).catch(() => {});
  }, [manager, ready, userId]);

  const own = userId ? data.get(userId) : undefined;
  const value = useMemo<BadgesValue>(() => ({
    get: id => data.get(id), want,
    recent: own ? recentBadges(own) : [], unseen: own ? unseenBadges(own) : [],
  }), [data, want, own]);
  return <BadgesContext.Provider value={value}>{children}
    {celebrate.length > 0 && <NewBadgeCelebration badges={celebrate} onDone={finish}/>}
  </BadgesContext.Provider>;
}

/** Stany odznak zawodnika do BadgeList; undefined, dopóki serwer nie odpowie (albo gdy odznaki są niedostępne). */
export function usePlayerBadges(userId?: string | null): BadgeState[] | undefined {
  const { get, want } = useContext(BadgesContext);
  useEffect(() => { if (userId) want(userId); }, [userId, want]);
  const value = userId ? get(userId) : undefined;
  return useMemo(() => value ? badgeStates(value) : undefined, [value]);
}
/** Własne odznaki do dzwonka: zdobyte w ostatnich 7 dniach i liczba nieoglądanych. */
export function useOwnBadgeNotices(): { recent: readonly EarnedBadge[]; unseen: number } {
  const { recent, unseen } = useContext(BadgesContext);
  return { recent, unseen: unseen.length };
}

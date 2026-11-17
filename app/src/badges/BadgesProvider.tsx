import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import { badgeStates, bellBadges, celebrateBadges, playerBadges } from './badgeContracts';
import type { EarnedBadge, PlayerBadges } from './badgeContracts';
import type { BadgeState } from './BadgeList';
import NewBadgeCelebration from './NewBadgeCelebration';

interface BadgesValue {
  get: (userId: string) => PlayerBadges | undefined;
  want: (userId: string) => void;
  bell: readonly EarnedBadge[];
  dismissBell: () => void;
}
const BadgesContext = createContext<BadgesValue>({ get: () => undefined, want: () => {}, bell: [], dismissBell: () => {} });

/**
 * Odznaki z serwera (akcja badges_player), tylko w pamięci, czyszczone przy zmianie konta.
 * Błąd lub brak backendu ukrywa sekcję odznak zamiast pokazywać fikcyjne dane.
 * Nowe własne odznaki: jednorazowe okienko „Nowa odznaka!” (po zamknięciu badges_seen scope=dialog)
 * oraz wpis w dzwonku, który zostaje do odklikania (badges_seen scope=bell).
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
      if (celebrateNew && value.own) setCelebrate(celebrateBadges(value));
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

  const markSeen = useCallback((scope: 'dialog' | 'bell') => {
    if (!ready || !manager || !userId) return;
    const mine = epoch.current;
    manager.call<unknown>('badges_seen', { scope }).then(() => {
      if (mine !== epoch.current) return;
      setData(previous => {
        const own = previous.get(userId);
        if (!own) return previous;
        return new Map(previous).set(userId, { ...own, earned: own.earned.map(b => scope === 'bell' ? { ...b, new: false, celebrate: false } : { ...b, celebrate: false }) });
      });
    }).catch(() => {});
  }, [manager, ready, userId]);
  const finish = useCallback(() => { setCelebrate([]); markSeen('dialog'); }, [markSeen]);
  const dismissBell = useCallback(() => markSeen('bell'), [markSeen]);

  const own = userId ? data.get(userId) : undefined;
  const value = useMemo<BadgesValue>(() => ({
    get: id => data.get(id), want,
    bell: own ? bellBadges(own) : [], dismissBell,
  }), [data, want, own, dismissBell]);
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
/** Własne odznaki do dzwonka: nieodklikane wpisy i ich odklikanie (otwarcie sekcji odznak). */
export function useOwnBadgeNotices(): { bell: readonly EarnedBadge[]; dismiss: () => void } {
  const { bell, dismissBell } = useContext(BadgesContext);
  return { bell, dismiss: dismissBell };
}

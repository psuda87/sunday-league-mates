import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import { MvpGoldProvider } from './mvpGold';
import { playerRating, ratingOverview } from './ratingContracts';
import type { PlayerRating } from './ratingContracts';

interface RatingsValue { available: boolean; get: (userId: string) => PlayerRating | undefined; want: (userId: string) => void; refresh: () => void }
const RatingsContext = createContext<RatingsValue>({ available: false, get: () => undefined, want: () => {}, refresh: () => {} });

/**
 * Jedno źródło ocen i aktualnych MVP Gold dla całej aplikacji Premium. Dane tylko w pamięci, czyszczone przy zmianie konta.
 * Błąd pobrania nie blokuje aplikacji: karta pokazuje wtedy startowe 7,0, a złota nie ma.
 */
export function RatingProvider({ manager, userId, children }: { manager?: SessionManager; userId?: string; children: ReactNode }) {
  const auth = useSyncExternalStore(manager?.subscribe ?? (() => () => {}), manager?.getSnapshot ?? (() => null));
  const ready = !!manager && !!userId && auth?.phase === 'ready' && auth.session?.user_id === userId;
  const [ratings, setRatings] = useState<ReadonlyMap<string, PlayerRating>>(new Map());
  const [gold, setGold] = useState<readonly string[]>([]);
  // True only after the server answered: a client deployed ahead of the backend shows no rating screens.
  const [available, setAvailable] = useState(false);
  const asked = useRef(new Set<string>()), epoch = useRef(0);
  // Bumped on every account/session reset so cards mounted earlier ask again for the new session.
  const [generation, setGeneration] = useState(0);

  const refresh = useCallback(() => {
    if (!ready || !manager) return;
    const mine = epoch.current;
    manager.call<unknown>('ratings_overview').then(raw => {
      if (mine !== epoch.current) return;
      const overview = ratingOverview(raw);
      setGold(overview.gold); setAvailable(true);
      setRatings(previous => new Map(previous).set(overview.me.user_id, overview.me));
    }).catch(() => {});
  }, [manager, ready]);

  useEffect(() => {
    epoch.current += 1; asked.current = new Set(); setRatings(new Map()); setGold([]); setAvailable(false);
    setGeneration(g => g + 1);
    refresh();
  }, [userId, ready, refresh]);

  const want = useCallback((id: string) => {
    if (!generation || !ready || !manager || !id || id === userId || asked.current.has(id)) return;
    asked.current.add(id);
    const mine = epoch.current;
    manager.call<unknown>('ratings_player', { user_id: id }).then(raw => {
      if (mine !== epoch.current) return;
      const rating = playerRating(raw);
      setRatings(previous => new Map(previous).set(rating.user_id, rating));
    }).catch(() => {});
  }, [generation, manager, ready, userId]);

  const value = useMemo<RatingsValue>(() => ({ available, get: id => ratings.get(id), want, refresh }), [available, ratings, want, refresh]);
  return <RatingsContext.Provider value={value}><MvpGoldProvider holders={gold} previewUserId={userId}>{children}</MvpGoldProvider></RatingsContext.Provider>;
}

/** Ocena zawodnika do karty; pobiera ją przy pierwszym użyciu. Bez danych: undefined (karta pokaże 7,0). */
export function usePlayerRating(userId?: string | null): PlayerRating | undefined {
  const { get, want } = useContext(RatingsContext);
  useEffect(() => { if (userId) want(userId); }, [userId, want]);
  return userId ? get(userId) : undefined;
}
export const useRatingsRefresh = (): (() => void) => useContext(RatingsContext).refresh;
export const useRatingsAvailable = (): boolean => useContext(RatingsContext).available;

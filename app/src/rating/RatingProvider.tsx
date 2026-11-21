import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import { MvpGoldProvider } from './mvpGold';
import { playerRating, ratingOverview } from './ratingContracts';
import type { PlayerRating } from './ratingContracts';

interface RatingsValue { available: boolean; get: (userId: string) => PlayerRating | undefined; want: (userId: string, fresh?: boolean) => void; refresh: () => void }
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
  // Odczyty w toku: ten sam zawodnik nie jest pobierany równolegle (karta i profil pytają razem).
  const loading = useRef(new Set<string>());
  // Własny przegląd: prośba w trakcie odczytu (np. zaraz po zapisie goli) powtarza odczyt, by nie zostać ze starą kopią.
  const overviewBusy = useRef(false), overviewAgain = useRef(false);
  // Bumped on every account/session reset so cards mounted earlier ask again for the new session.
  const [generation, setGeneration] = useState(0);

  const refresh = useCallback(() => {
    if (!ready || !manager) return;
    if (overviewBusy.current) { overviewAgain.current = true; return; }
    overviewBusy.current = true;
    const mine = epoch.current;
    manager.call<unknown>('ratings_overview').then(raw => {
      if (mine !== epoch.current) return;
      const overview = ratingOverview(raw);
      setGold(overview.gold); setAvailable(true);
      setRatings(previous => new Map(previous).set(overview.me.user_id, overview.me));
    }).catch(() => {}).finally(() => {
      if (mine !== epoch.current) return;
      overviewBusy.current = false;
      if (overviewAgain.current) { overviewAgain.current = false; refresh(); }
    });
  }, [manager, ready]);

  useEffect(() => {
    epoch.current += 1; asked.current = new Set(); loading.current = new Set();
    overviewBusy.current = false; overviewAgain.current = false;
    setRatings(new Map()); setGold([]); setAvailable(false);
    setGeneration(g => g + 1);
    refresh();
  }, [userId, ready, refresh]);

  /**
   * Zawodnik jest pobierany raz na sesję (karty na listach). Z `fresh` (ekran profilu) odczyt jest ponawiany przy każdym
   * otwarciu, bo gole, asysty i liczba meczów zmieniają się zaraz po zapisie, a nie dopiero po 48 h.
   */
  const want = useCallback((id: string, fresh = false) => {
    if (!generation || !ready || !manager || !id) return;
    if (id === userId) { if (fresh) refresh(); return; }
    if (loading.current.has(id) || (asked.current.has(id) && !fresh)) return;
    asked.current.add(id); loading.current.add(id);
    const mine = epoch.current;
    manager.call<unknown>('ratings_player', { user_id: id }).then(raw => {
      if (mine !== epoch.current) return;
      const rating = playerRating(raw);
      setRatings(previous => new Map(previous).set(rating.user_id, rating));
    }).catch(() => {}).finally(() => { if (mine === epoch.current) loading.current.delete(id); });
  }, [generation, manager, ready, userId, refresh]);

  const value = useMemo<RatingsValue>(() => ({ available, get: id => ratings.get(id), want, refresh }), [available, ratings, want, refresh]);
  return <RatingsContext.Provider value={value}><MvpGoldProvider holders={gold} previewUserId={userId}>{children}</MvpGoldProvider></RatingsContext.Provider>;
}

/** Ocena zawodnika do karty; pobiera ją przy pierwszym użyciu. Bez danych: undefined (karta pokaże 7,0). */
export function usePlayerRating(userId?: string | null, fresh = false): PlayerRating | undefined {
  const { get, want } = useContext(RatingsContext);
  useEffect(() => { if (userId) want(userId, fresh); }, [userId, want, fresh]);
  return userId ? get(userId) : undefined;
}
export const useRatingsRefresh = (): (() => void) => useContext(RatingsContext).refresh;
export const useRatingsAvailable = (): boolean => useContext(RatingsContext).available;

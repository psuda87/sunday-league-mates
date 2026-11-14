import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountError } from '../auth/api';
import type { SessionManager } from '../auth/sessionManager';
import { matchRatingState } from './ratingContracts';
import type { MatchRatingState, Team } from './ratingContracts';

export interface Ballot { ratings: Record<string, number>; mvp_user: string | null; action_team: Team | null }

/** Stan oceniania jednego meczu. Każdy zapis zwraca świeży stan z serwera; nic nie jest trzymane poza pamięcią. */
export function useMatchRating(manager: SessionManager | undefined, eventId: string, active: boolean) {
  const [state, setState] = useState<MatchRatingState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true), token = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const run = useCallback(async (action: string, body: Record<string, unknown>, done = '') => {
    if (!manager) return false;
    const mine = ++token.current;
    setPending(true); setError(''); setNotice('');
    try {
      const next = matchRatingState(await manager.call<unknown>(action, { event_id: eventId, ...body }));
      if (alive.current && mine === token.current) { setState(next); setNotice(done); }
      return true;
    } catch (e) {
      if (alive.current && mine === token.current) setError(e instanceof AccountError ? e.message : 'Nie udało się połączyć z serwerem ocen.');
      return false;
    } finally {
      if (alive.current && mine === token.current) setPending(false);
    }
  }, [manager, eventId]);

  useEffect(() => { setState(null); setError(''); setNotice(''); }, [eventId]);
  useEffect(() => { if (active) void run('ratings_get', {}); }, [active, run]);

  return {
    state, pending, error, notice,
    reload: () => run('ratings_get', {}),
    rate: (ballot: Ballot) => run('ratings_rate', { ...ballot }, 'Oceny zapisane. Możesz je zmieniać do końca okna oceniania.'),
    saveStats: (goals: number, assists: number) => run('ratings_stats', { goals, assists }, 'Gole i asysty zapisane.'),
    saveScore: (a: number, b: number) => run('ratings_score', { score_a: a, score_b: b }, 'Wynik zapisany.'),
  };
}

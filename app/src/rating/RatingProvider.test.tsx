import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/sessionManager';
import { RatingProvider, usePlayerRating, useRatingsAvailable } from './RatingProvider';
import { useMvpGold } from './mvpGold';

function Probe({ id }: { id: string }) {
  const r = usePlayerRating(id), gold = useMvpGold(id), available = useRatingsAvailable();
  return <span data-testid={id}>{r ? `${r.rating}:${r.final}` : 'none'}|{gold ? 'gold' : 'plain'}|{available ? 'on' : 'off'}</span>;
}
const snapshot = { phase: 'ready', session: { user_id: 'me' }, message: '' };
const manager = (call: (action: string, body?: Record<string, unknown>) => Promise<unknown>) => ({
  call, subscribe: () => () => {}, getSnapshot: () => snapshot,
}) as unknown as SessionManager;

describe('RatingProvider', () => {
  it('loads own rating and Gold holders once, and other players lazily', async () => {
    const call = vi.fn(async (action: string, body?: Record<string, unknown>) => action === 'ratings_overview'
      ? { me: { user_id: 'me', rating: 7.43, final: true, rated_matches: 6 }, gold: ['u2'] }
      : { user_id: body!.user_id, rating: 8.1, final: true, rated_matches: 9, gold: true });
    render(<RatingProvider manager={manager(call)} userId="me"><Probe id="me" /><Probe id="u2" /></RatingProvider>);
    await waitFor(() => expect(screen.getByTestId('me')).toHaveTextContent('7.43:true|plain|on'));
    await waitFor(() => expect(screen.getByTestId('u2')).toHaveTextContent('8.1:true|gold|on'));
    expect(call.mock.calls.filter(c => c[0] === 'ratings_player')).toEqual([['ratings_player', { user_id: 'u2' }]]);
  });
  it('stays off and silent when the backend is not deployed yet', async () => {
    const call = vi.fn(async () => { throw new Error('invalid_action'); });
    render(<RatingProvider manager={manager(call)} userId="me"><Probe id="me" /></RatingProvider>);
    await waitFor(() => expect(call).toHaveBeenCalled());
    expect(screen.getByTestId('me')).toHaveTextContent('none|plain|off');
  });
});

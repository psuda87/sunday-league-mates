import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/sessionManager';
import MatchRatingPanel from './MatchRatingPanel';
import type { MatchRatingState } from './ratingContracts';

const base: MatchRatingState = {
  event_id: 'e1', phase: 'open', closes_at: '2026-11-16T20:00:00Z', can_rate: true,
  participants: [{ user_id: 'me', team: 'a', display_name: 'Ja' }, { user_id: 'u2', team: 'a', display_name: 'Adam' }, { user_id: 'u3', team: 'b', display_name: 'Bregul' }],
  gold_user: null,
  my: { submitted: false, ratings: {}, mvp_user: null, action_team: null, goals: 0, assists: 0 },
  score: null, reported: { goals_a: 0, goals_b: 0, assists_a: 0, assists_b: 0 }, result: null,
};
function setup(state: MatchRatingState, reply: (action: string, body: Record<string, unknown>) => MatchRatingState = () => state) {
  const call = vi.fn(async (action: string, body: Record<string, unknown> = {}) => (action === 'ratings_get' ? state : reply(action, body)));
  render(<MatchRatingPanel manager={{ call } as unknown as SessionManager} userId="me" eventId="e1" />);
  return call;
}

describe('MatchRatingPanel', () => {
  it('lets a participant rate others (never themselves), vote MVP and the action of the match, then sends one ballot', async () => {
    const call = setup(base);
    await screen.findByText(/Ocenianie otwarte do/);
    expect(screen.queryByRole('radiogroup', { name: 'Ocena: Ja' })).toBeNull();
    fireEvent.click(screen.getAllByRole('radio', { name: '9' })[0]);
    fireEvent.click(screen.getAllByRole('radio', { name: 'MVP' })[1]);
    fireEvent.click(screen.getByRole('radio', { name: 'Drużyna B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz oceny' }));
    expect(call).not.toHaveBeenCalledWith('ratings_rate', expect.anything());
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Po zapisaniu nie zmienisz już ocen');
    fireEvent.click(screen.getByRole('button', { name: 'Tak, zapisz' }));
    await waitFor(() => expect(call).toHaveBeenCalledWith('ratings_rate', { event_id: 'e1', ratings: { u2: 9 }, mvp_user: 'u3', action_team: 'b' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Oceny zapisane');
  });
  it('saves own goals and assists and the final score, and shows a discrepancy as information only', async () => {
    const after: MatchRatingState = { ...base, score: { a: 1, b: 0, changed_at: '2026-11-14T20:00:00Z', changed_by: 'Adam' }, reported: { goals_a: 3, goals_b: 0, assists_a: 0, assists_b: 0 } };
    const call = setup(base, () => after);
    await screen.findByText(/Ocenianie otwarte do/);
    fireEvent.change(screen.getByLabelText('Gole'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(call).toHaveBeenCalledWith('ratings_stats', { event_id: 'e1', goals: 3, assists: 0 }));
    fireEvent.change(screen.getByLabelText('Gole drużyny A'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Gole drużyny B'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz wynik' }));
    await waitFor(() => expect(call).toHaveBeenCalledWith('ratings_score', { event_id: 'e1', score_a: 1, score_b: 0 }));
    expect(await screen.findByRole('note')).toHaveTextContent('wpisali 3 goli, a wynik to 1');
    expect(screen.getByText(/Ostatnia zmiana: Adam/)).toBeInTheDocument();
  });
  it('shows no form to a group member who did not play', async () => {
    setup({ ...base, can_rate: false });
    expect(await screen.findByText('Oceniać mogą tylko zawodnicy, którzy zagrali w tym meczu.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zapisz oceny' })).toBeNull();
  });
  it('explains the window before the match and shows the result afterwards', async () => {
    setup({ ...base, phase: 'closed', can_rate: false, result: { mvp_outcome: 'gold', mvp_user: 'u2', action_team: 'a' } });
    expect(await screen.findByText('Adam')).toBeInTheDocument();
    expect(screen.getByText('Drużyna A')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zapisz oceny' })).toBeNull();
  });
  it('shows the server message when saving fails', async () => {
    const call = vi.fn(async (action: string) => { if (action === 'ratings_get') return base; throw new Error('x'); });
    render(<MatchRatingPanel manager={{ call } as unknown as SessionManager} userId="me" eventId="e1" />);
    await screen.findByText(/Ocenianie otwarte do/);
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz oceny' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tak, zapisz' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się połączyć z serwerem ocen.');
  });
  it('locks a sent ballot but still allows goals, assists and the score; shows an early MVP', async () => {
    setup({ ...base, gold_user: 'u2', my: { ...base.my, submitted: true, ratings: { u2: 9 }, mvp_user: 'u2' } });
    expect(await screen.findByText('Twoje oceny i głosy są zapisane. Nie można ich już zmienić.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zapisz oceny' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Ocena: Adam' })).toBeNull();
    expect(screen.getByLabelText('Gole')).toBeEnabled();
    expect(screen.getByText(/wynik głosowania jest już przesądzony/)).toHaveTextContent('Adam');
  });
});

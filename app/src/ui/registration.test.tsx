import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import Events from '../pages/Events';
import type { SessionManager } from '../auth/sessionManager';
import type { Session } from '../auth/api';
import type { Match } from '../events/model';
afterEach(cleanup);
const session: Session = { user_id: 'demo-user', access_token: '', refresh_token: '', role: 'member', must_change_password: false, expires_in: 3600 };
const match: Match = { id: 'fixture', starts_at: '2026-10-22T18:00:00Z', location: 'Test', capacity: 15, registered_count: 12, reserve_count: 3, registration_open: true, status: 'scheduled', duration_minutes: 90, hourly_rate: 180, total_cost: 270, cutoff_at: '2026-10-22T15:00:00Z', decision_required: false, estimated_per_person: null, settlements_active: false };
function mount(event: Match, blocked = false, registered = false) {
  const own = { id: 'participant', member_id: session.user_id, responsible_user_id: session.user_id, display_name: 'Uczestnik demo', status: 'registered', absent: false, contact_phone: '', responsible_name: 'Demo' };
  const call = vi.fn(async (action: string) => {
    if (action === 'events_list') return { events: [event], server_now: '2026-10-22T16:00:00Z' }; // after Warsaw 17:00, still open
    if (action === 'events_detail') return { event, participants: registered ? [own] : [], server_now: '2026-10-22T16:00:00Z' };
    if (action === 'settlements_account') return { blocked, unpaid_matches: blocked ? 2 : 0 };
    return { ok: true };
  });
  render(<Events manager={{ call } as unknown as SessionManager} session={session} />);
  return call;
}
describe('Hero uses existing registration RPC, controlled API only', () => {
  it('joins after 17:00 when backend allows it; guests are already included in server count', async () => {
    const call = mount(match); const button = await screen.findByText('ZAPISZ SIĘ NA MECZ'); fireEvent.click(button);
    await waitFor(() => expect(call).toHaveBeenCalledWith('events_join', { event_id: 'fixture' }));
    expect(screen.getAllByRole('progressbar')[0].getAttribute('aria-valuenow')).toBe('12');
  });
  it('full match offers reserve instead of a fabricated successful join', async () => {
    const call = mount({ ...match, registered_count: 15 }); fireEvent.click(await screen.findByText('Dołącz do rezerwy'));
    await waitFor(() => expect(call).toHaveBeenCalledWith('events_reserve', { event_id: 'fixture' }));
  });
  it('allows withdrawal despite financial block', async () => {
    const call = mount(match, true, true); fireEvent.click(await screen.findByText('Zrezygnuj z meczu'));
    await waitFor(() => expect(call).toHaveBeenCalledWith('events_withdraw', { event_id: 'fixture', participant_id: 'participant' }));
  });
  it('disables registration when server reports debt block', async () => {
    mount(match, true); const button = await screen.findByText('Blokada z powodu zaległości'); expect(button.getAttribute('disabled')).not.toBeNull();
  });
  it('respects server registration closure', async () => {
    mount({ ...match, registration_open: false }); expect((await screen.findByText('Zapisy zamknięte')).getAttribute('disabled')).not.toBeNull();
  });
});

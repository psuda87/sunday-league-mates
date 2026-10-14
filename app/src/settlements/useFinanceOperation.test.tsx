import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountError } from '../auth/api';
import type { Session } from '../auth/api';
import { SessionManager } from '../auth/sessionManager';
import type { RequestAccount } from '../auth/sessionManager';
import { useFinanceOperation } from './useFinanceOperation';

afterEach(() => window.localStorage.clear());
async function fixture(send: (action: string, body: Record<string, unknown>) => Promise<unknown>, existingSession?: Session) {
  const session: Session = existingSession ?? { user_id: crypto.randomUUID(), access_token: crypto.randomUUID(), refresh_token: crypto.randomUUID(),
    role: 'admin', must_change_password: false, expires_in: 3600 };
  let saved: string | null = null;
  const request: RequestAccount = async <T,>(action: string, values: Record<string, unknown> = {}) => {
    if (action === 'login' || action === 'refresh') return session as T;
    return await send(action, values) as T;
  };
  const manager = new SessionManager({ read: async () => saved, write: async value => { saved = value; },
    clear: async () => { saved = null; } }, request);
  await manager.signIn('Fikcyjny', crypto.randomUUID());
  return { manager, session };
}

describe('ponawianie operacji finansowych (bez połączeń z backendem)', () => {
  it('po pełnym restarcie zachowuje tylko UUID i rozstrzyga wynik bez ponownego zgłoszenia wpłaty', async () => {
    let firstRequest: Record<string, unknown> = {};
    const firstFixture = await fixture(async (_action, body) => {
      firstRequest = body; throw new AccountError('Wynik nieznany', 'network_error');
    });
    const first = renderHook(() => useFinanceOperation(firstFixture.manager));
    await act(async () => { await first.result.current.mutate('record_payment', { amount_cents: 2700, reason: 'Próba' }, async () => undefined); });
    expect(window.localStorage.getItem('slm.finance.pending.v1.' + firstFixture.session.user_id)).toBe(firstRequest.request_id);
    first.unmount();
    let recovered = false;
    const restarted = await fixture(async (action, body) => {
      expect(action).toBe('settlements_resolve_request'); expect(body).toEqual({ request_id: firstRequest.request_id });
      recovered = true; return { state: 'committed' };
    }, firstFixture.session);
    const second = renderHook(() => useFinanceOperation(restarted.manager));
    await act(async () => { await second.result.current.retry(async () => undefined); });
    expect(recovered).toBe(true); expect(second.result.current.pending).toBeNull();
    expect(window.localStorage.getItem('slm.finance.pending.v1.' + firstFixture.session.user_id)).toBeNull();
    second.unmount();
  });
  it('po nieznanym wyniku zachowuje body i UUID także po ponownym otwarciu ekranu', async () => {
    const calls: Record<string, unknown>[] = [];
    const { manager } = await fixture(async (_action, body) => {
      calls.push(body);
      if (calls.length === 1) throw new AccountError('Wynik nieznany', 'network_error');
      return { payment_id: body.request_id };
    });
    const first = renderHook(() => useFinanceOperation(manager));
    await act(async () => { await first.result.current.mutate('record_payment', { amount_cents: 2700, reason: 'Próba' }, async () => undefined); });
    expect(first.result.current.pending).not.toBeNull();
    first.unmount();
    await manager.refresh();
    const second = renderHook(() => useFinanceOperation(manager));
    await act(async () => { await second.result.current.retry(async () => undefined); });
    expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
    expect(second.result.current.pending).toBeNull();
    second.unmount();
  });
  it('dwa szybkie kliknięcia nie tworzą dwóch identyfikatorów wpłaty', async () => {
    let resolve!: (value: unknown) => void;
    let count = 0;
    const { manager } = await fixture(async () => { count++; return new Promise(r => { resolve = r; }); });
    const hook = renderHook(() => useFinanceOperation(manager));
    await act(async () => {
      const first = hook.result.current.mutate('record_payment', { amount_cents: 1, reason: 'Próba' }, async () => undefined);
      expect(await hook.result.current.mutate('record_payment', { amount_cents: 1, reason: 'Próba' }, async () => undefined)).toBe(false);
      resolve({}); await first;
    });
    expect(count).toBe(1); hook.unmount();
  });
  it('błąd odświeżenia po potwierdzonym zapisie nie ponawia księgowania', async () => {
    let count = 0;
    const { manager } = await fixture(async () => { count++; return {}; });
    const hook = renderHook(() => useFinanceOperation(manager));
    await act(async () => {
      expect(await hook.result.current.mutate('record_payment', { amount_cents: 1, reason: 'Próba' }, async () => {
        throw new AccountError('Nie udało się odświeżyć', 'network_error');
      })).toBe(true);
    });
    expect(hook.result.current.pending).toBeNull();
    await act(async () => { await hook.result.current.retry(async () => undefined); });
    expect(count).toBe(1); hook.unmount();
  });
  it('odmowa nieaktualnej wersji kończy próbę bez automatycznego przeliczania i ponowienia', async () => {
    const { manager } = await fixture(async () => { throw new AccountError('Odśwież rozliczenie', 'stale_version'); });
    const hook = renderHook(() => useFinanceOperation(manager));
    await act(async () => { await hook.result.current.mutate('approve', { expected_version: 1 }, async () => undefined); });
    expect(hook.result.current.pending).toBeNull(); expect(hook.result.current.error).toBe('Odśwież rozliczenie');
    hook.unmount();
  });
});

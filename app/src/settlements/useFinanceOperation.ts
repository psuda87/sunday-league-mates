import { useRef, useState } from 'react';
import { AccountError } from '../auth/api';
import type { SessionManager } from '../auth/sessionManager';

interface Operation { action: string; body: Record<string, unknown> | null; request_id: string; actorId: string }
// Niejednoznaczna awaria zachowuje dokładne body i UUID również po odmontowaniu ekranu.
// Dane formularza żyją tylko w pamięci. W storage zostaje sam UUID powiązany z kontem.
// Po restarcie serwer rozstrzyga lub atomowo zamyka ten UUID bez tworzenia nowej wpłaty.
const inFlight = new WeakMap<SessionManager, Map<string, Operation>>();
export function useFinanceOperation(manager: SessionManager) {
  const actorId = manager.getSnapshot().session?.user_id ?? '';
  const storageKey = 'slm.finance.pending.v1.' + actorId;
  const [operations] = useState(() => {
    let value = inFlight.get(manager);
    if (!value) { value = new Map<string, Operation>(); inFlight.set(manager, value); }
    return value;
  });
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Operation | null>(() => {
    const memory = operations.get(actorId);
    if (memory) return memory;
    try {
      const request_id = window.localStorage.getItem(storageKey);
      if (request_id) {
        const restored = { action: 'resolve_request', body: null, request_id, actorId };
        operations.set(actorId, restored); return restored;
      }
    } catch { /* Przed każdym zapisem ponownie sprawdzamy dostęp do storage. */ }
    return null;
  });
  function finishRequest(op: Operation) {
    if (operations.get(actorId)?.request_id === op.request_id) operations.delete(actorId);
    try {
      if (window.localStorage.getItem(storageKey) === op.request_id) window.localStorage.removeItem(storageKey);
    } catch { /* Pozostawiony UUID zostanie bezpiecznie rozstrzygnięty po restarcie. */ }
    setPending(null);
  }
  async function execute(op: Operation, refresh: () => Promise<void>) {
    if (lock.current) return false;
    if (!op.actorId || manager.getSnapshot().session?.user_id !== op.actorId) {
      setError('Najpierw zaloguj się na konto, które rozpoczęło operację.'); return false;
    }
    lock.current = true; setBusy(true); setError(''); setNotice('');
    let committed = false;
    try {
      const result = await manager.call<{ state?: 'committed' | 'abandoned' }>('settlements_' + op.action,
        { ...(op.body ?? {}), request_id: op.request_id });
      committed = true;
      finishRequest(op);
      setNotice(result.state === 'abandoned' ? 'Poprzednia operacja nie została zaksięgowana. Możesz rozpocząć nową.' : 'Operacja zapisana.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wykonać operacji.');
      // Po potwierdzeniu zapisu błąd odświeżenia nie odtwarza nowej wpłaty.
      if (!committed && operations.get(actorId)?.request_id === op.request_id && e instanceof AccountError &&
        !['network_error', 'service_unavailable', 'server_error', 'session_invalid', 'password_required', 'access_unavailable', 'rate_limited', 'forbidden'].includes(e.code)) {
        finishRequest(op);
      }
    } finally { lock.current = false; setBusy(false); }
    return committed;
  }
  async function mutate(action: string, body: Record<string, unknown>, refresh: () => Promise<void>) {
    if (operations.has(actorId) || lock.current) {
      setPending(operations.get(actorId) ?? null);
      setError('Najpierw rozstrzygnij poprzednią operację przyciskiem „Ponów operację”.'); return false;
    }
    const op = { action, body, request_id: crypto.randomUUID(), actorId };
    try {
      // Nie wysyłamy wpłaty, jeśli nie można zachować identyfikatora na wypadek restartu.
      const previous = window.localStorage.getItem(storageKey);
      if (previous) {
        const restored = { action: 'resolve_request', body: null, request_id: previous, actorId };
        operations.set(actorId, restored); setPending(restored);
        setError('Najpierw rozstrzygnij poprzednią operację.'); return false;
      }
      window.localStorage.setItem(storageKey, op.request_id);
    } catch {
      setError('Nie można zachować identyfikatora operacji. Wpłata nie została wysłana. Sprawdź pamięć aplikacji.'); return false;
    }
    operations.set(actorId, op); setPending(op);
    return execute(op, refresh);
  }
  async function retry(refresh: () => Promise<void>) {
    const op = operations.get(actorId);
    return op ? execute(op, refresh) : false;
  }
  async function resolve(refresh: () => Promise<void>) {
    const op = operations.get(actorId);
    if (!op) return false;
    return execute({ ...op, action: 'resolve_request', body: null }, refresh);
  }
  return { busy, error, notice, pending, mutate, retry, resolve, setError };
}

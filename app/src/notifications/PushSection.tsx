import { useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import { usePushState } from './usePushState';

export default function PushSection({ manager }: { manager: SessionManager }) {
  const { push, supported, enabled, denied, status, refresh } = usePushState(manager);
  const [busy, setBusy] = useState(false);
  if (!supported || !push) return null;
  // enable() musi zostać wywołane bezpośrednio po kliknięciu — inaczej przeglądarka nie pokaże prośby o zgodę.
  async function run(action: () => Promise<void>) { setBusy(true); try { await action(); } finally { setBusy(false); refresh(); } }
  return <div className="slm-push-section">
    <h2>Powiadomienia na telefonie</h2>
    {enabled ? <>
      <p>Włączone na tym urządzeniu. Na ekranie blokady nie pokazujemy szczegółów.</p>
      <button type="button" disabled={busy} onClick={() => void run(() => push.disable())}>Wyłącz</button>
    </> : denied ? <p role="note">Powiadomienia są zablokowane w ustawieniach przeglądarki dla tej aplikacji. Odblokuj je w ustawieniach witryny, a potem wróć tutaj.</p> : <>
      <p>Dostaniesz sygnał o nowych meczach, wolnych miejscach i przypomnieniach. Na ekranie blokady nie pokażemy szczegółów.</p>
      <button type="button" className="slm-payment-reminder-cta" disabled={busy} onClick={() => void run(() => push.enable())}>Włącz powiadomienia</button>
    </>}
    {status && <p role="status">{status}</p>}
  </div>;
}

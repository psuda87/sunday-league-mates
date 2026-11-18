import { useEffect, useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import { usePushState } from '../notifications/usePushState';
import { iosNeedsInstall } from '../notifications/webPush';

/** Zdarzenie beforeinstallprompt (Chrome/Edge/Android) bywa wysyłane, zanim React się zamontuje, więc nasłuchujemy od załadowania modułu. */
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferred = event as InstallEvent; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}
const standalone = () => (navigator as unknown as { standalone?: boolean }).standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
const DAY = 24 * 60 * 60 * 1000;
function dismissed(key: string, days: number) {
  try { const at = Number(localStorage.getItem(key)); return at > 0 && Date.now() - at < days * DAY; } catch { return false; }
}
function dismiss(key: string) { try { localStorage.setItem(key, String(Date.now())); } catch { /* Brak pamięci: baner wróci przy następnym otwarciu. */ } }

/**
 * Jeden baner naraz: najpierw instalacja aplikacji (przed zalogowaniem i po), potem zgoda na powiadomienia (po zalogowaniu).
 * Zgoda na powiadomienia wymaga kliknięcia użytkownika, więc przycisk wywołuje push.enable() bezpośrednio.
 */
export default function AppBanners({ manager, signedIn }: { manager: SessionManager; signedIn: boolean }) {
  const { push, supported, enabled, denied, refresh } = usePushState(manager);
  const [, tick] = useState(0), [busy, setBusy] = useState(false), [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => { const fn = () => tick(v => v + 1); listeners.add(fn); return () => { listeners.delete(fn); }; }, []);
  const ios = iosNeedsInstall(), installed = standalone();
  const showInstall = !installed && hidden !== 'install' && !dismissed('slm-banner-install', 7) && (!!deferred || ios);
  const showPush = signedIn && !showInstall && hidden !== 'push' && supported && !!push && !enabled && !denied && !ios && !dismissed('slm-banner-push', 14);
  if (!showInstall && !showPush) return null;
  function later(key: string, name: string) { dismiss(key); setHidden(name); }
  if (showInstall) return <aside className="slm-app-banner" role="region" aria-label="Instalacja aplikacji">
    <div><strong>Zainstaluj aplikację</strong>
      <p>{ios ? 'Stuknij „Udostępnij”, a potem „Dodaj do ekranu początkowego”. Dopiero wtedy iPhone pozwoli na powiadomienia.' : 'Będzie na ekranie głównym i będzie mogła wysyłać powiadomienia o meczach.'}</p></div>
    <div className="slm-app-banner-actions">
      {!ios && <button type="button" className="slm-payment-reminder-cta" disabled={busy} onClick={async () => {
        const event = deferred; if (!event) return; setBusy(true);
        try { await event.prompt(); await event.userChoice; } catch { /* Użytkownik zamknął okno instalacji. */ } finally { deferred = null; setBusy(false); notify(); }
      }}>Zainstaluj</button>}
      <button type="button" onClick={() => later('slm-banner-install', 'install')}>{ios ? 'Rozumiem' : 'Później'}</button>
    </div>
  </aside>;
  return <aside className="slm-app-banner" role="region" aria-label="Powiadomienia">
    <div><strong>Włącz powiadomienia</strong><p>Dostaniesz sygnał o nowych meczach, wolnych miejscach i przypomnieniach o meczu i płatności.</p></div>
    <div className="slm-app-banner-actions">
      <button type="button" className="slm-payment-reminder-cta" disabled={busy} onClick={async () => {
        setBusy(true); try { await push!.enable(); } finally { setBusy(false); refresh(); }
      }}>Włącz</button>
      <button type="button" onClick={() => later('slm-banner-push', 'push')}>Później</button>
    </div>
  </aside>;
}

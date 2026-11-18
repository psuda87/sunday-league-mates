import { accountRequest } from '../auth/api';
import type { SessionManager } from '../auth/sessionManager';
import type { PushController } from './pushController';

// Klucz publiczny VAPID nie jest sekretem. Odpowiadający mu klucz prywatny jest wyłącznie w sekretach Edge (push-worker).
export const VAPID_PUBLIC_KEY = 'BGjvMm_vNdNACQrcBd8dQKC4wt_QhtW4exdPjl1MTzcpqw26QIwenJ5lfZ4IAfzy69S0RQwSpvdSvwmC9e2BiDM';
const STORAGE_KEY = 'slm.push.web.v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
interface WebInstallation { id: string; secret: string; enabledFor: string | null; bindingId: string | null; bindingVersion: number; pendingDetach: boolean; endpoint: string | null }

function load(): WebInstallation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return null;
    const v = JSON.parse(raw) as WebInstallation;
    if (!/^[0-9a-f-]{36}$/.test(v.id) || !/^[0-9a-f-]{72}$/.test(v.secret) || !Number.isSafeInteger(v.bindingVersion) || v.bindingVersion < 0) return null;
    return v;
  } catch { return null; }
}
function store(value: WebInstallation) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Brak pamięci: powiązanie nie zostanie zapamiętane. */ } }
const keyBytes = (value: string) => {
  const text = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(text + '='.repeat((4 - text.length % 4) % 4)), c => c.charCodeAt(0));
};
export const webPushSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined'
  && 'PushManager' in window && 'Notification' in window;
/** iPhone/iPad: powiadomienia web działają tylko w aplikacji dodanej do ekranu głównego (iOS 16.4+). */
export function iosNeedsInstall() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  return ios && !standalone;
}

export class WebPush implements PushController {
  private installation: WebInstallation | null = null;
  private activeUser: string | null = null;
  private epoch = 0;
  private started = false;
  private bindings: Promise<void> = Promise.resolve();
  constructor(private manager: SessionManager, private tap: (id: string) => void,
    private received: () => void, private report: (value: string) => void) {}
  private onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; id?: unknown } | null;
    if (data?.type === 'slm-open-notification' && typeof data.id === 'string' && UUID.test(data.id)) this.tap(data.id);
    else if (data?.type === 'slm-push-received') this.received();
  };
  private online = () => { void this.flushDetach().catch(() => undefined); };
  async start() {
    if (this.started) return; this.started = true;
    if (!webPushSupported()) { this.report('Ta przeglądarka nie obsługuje powiadomień systemowych. Centrum powiadomień działa.'); return; }
    navigator.serviceWorker.addEventListener('message', this.onMessage);
    window.addEventListener('online', this.online);
    // Kliknięcie powiadomienia przy zamkniętej aplikacji otwiera /?slm_n=<id>; cel ustala dopiero serwer po zalogowaniu.
    try {
      const url = new URL(location.href), id = url.searchParams.get('slm_n');
      if (id !== null) {
        url.searchParams.delete('slm_n'); history.replaceState(null, '', url.pathname + url.search + url.hash);
        if (UUID.test(id)) this.tap(id);
      }
    } catch { /* Adres nieczytelny: pomijamy. */ }
    try { await navigator.serviceWorker.register('/sw.js', { scope: '/' }); }
    catch { this.report('Nie udało się uruchomić obsługi powiadomień w przeglądarce. Centrum powiadomień działa.'); }
  }
  async stop() {
    this.started = false; this.pause();
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', this.onMessage);
    if (typeof window !== 'undefined') window.removeEventListener('online', this.online);
  }
  pause() { this.activeUser = null; this.epoch++; }
  isEnabled() { return !!this.installation?.enabledFor && this.installation.enabledFor === this.activeUser; }
  async resume() {
    const snapshot = this.manager.getSnapshot();
    if (snapshot.phase !== 'ready' || snapshot.session?.must_change_password) { this.pause(); return; }
    this.activeUser = snapshot.session!.user_id; const epoch = ++this.epoch;
    if (!webPushSupported()) return;
    this.installation = load();
    try {
      await this.flushDetach();
      if (epoch !== this.epoch || this.installation?.enabledFor !== this.activeUser) {
        this.report('Powiadomienia systemowe są wyłączone na tym urządzeniu. Włącz je poniżej.'); return;
      }
      if (Notification.permission !== 'granted') { await this.disable(); this.report('Brak zgody w przeglądarce. Historia w aplikacji nadal działa.'); return; }
      // Subskrypcja mogła wygasnąć lub się zmienić: odtwarzamy ją i aktualizujemy powiązanie, jeśli adres jest inny.
      const sub = await this.subscription();
      if (epoch === this.epoch && sub.endpoint !== this.installation?.endpoint) this.queueBind(sub);
      else if (epoch === this.epoch) this.report('Powiadomienia systemowe są włączone na tym urządzeniu.');
    } catch { this.report('Nie można połączyć urządzenia z powiadomieniami. Pozostałe funkcje działają.'); }
  }
  private async subscription(): Promise<PushSubscription> {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready);
    return await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource });
  }
  async enable() {
    const user = this.manager.getSnapshot().session?.user_id;
    if (!user) return;
    if (!webPushSupported()) { this.report('Ta przeglądarka nie obsługuje powiadomień systemowych. Historia w aplikacji działa.'); return; }
    if (iosNeedsInstall()) {
      this.report('Na iPhonie dodaj aplikację do ekranu głównego (Udostępnij → Dodaj do ekranu początkowego), otwórz ją stamtąd i włącz powiadomienia ponownie.'); return;
    }
    try {
      // Zgoda musi być zażądana bezpośrednio po kliknięciu (wymóg przeglądarek, w tym iOS).
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { await this.disable(); this.report(permission === 'denied'
        ? 'Powiadomienia są zablokowane w ustawieniach przeglądarki. Historia w aplikacji nadal działa.' : 'Nie udzielono zgody. Historia pozostaje dostępna.'); return; }
      if (this.manager.getSnapshot().session?.user_id !== user) return;
      this.installation = load() ?? { id: crypto.randomUUID(), secret: crypto.randomUUID() + crypto.randomUUID(), enabledFor: null,
        bindingId: null, bindingVersion: 0, pendingDetach: false, endpoint: null };
      await this.flushDetach();
      this.installation = { ...this.installation, enabledFor: user }; store(this.installation);
      this.activeUser = user; this.epoch++;
      this.queueBind(await this.subscription());
    } catch { this.report('Nie udało się włączyć powiadomień systemowych. Sprawdź uprawnienia przeglądarki.'); }
  }
  private queueBind(sub: PushSubscription) {
    const epoch = this.epoch, json = sub.toJSON(), p256dh = json.keys?.p256dh, auth = json.keys?.auth;
    this.bindings = this.bindings.catch(() => undefined).then(async () => {
      const user = this.activeUser, install = this.installation;
      if (!sub.endpoint || !p256dh || !auth || epoch !== this.epoch || !user || !install || install.enabledFor !== user
        || this.manager.getSnapshot().session?.user_id !== user) return;
      await this.manager.call('notifications_prepare_device', { device_id: install.id, device_secret: install.secret });
      if (epoch !== this.epoch || this.activeUser !== user) return;
      const bindingId = crypto.randomUUID(), bindingVersion = install.bindingVersion + 1;
      this.installation = { ...install, bindingId, bindingVersion }; store(this.installation);
      await this.manager.call('notifications_register', { device_id: install.id, device_secret: install.secret, binding_id: bindingId,
        binding_version: bindingVersion, token: sub.endpoint, platform: 'web', p256dh, auth });
      this.installation = { ...this.installation, endpoint: sub.endpoint }; store(this.installation);
      this.report('Powiadomienia systemowe są włączone na tym urządzeniu.');
    }).catch(() => this.report('Nie udało się połączyć urządzenia z powiadomieniami. Spróbuj włączyć je ponownie; historia w aplikacji działa.'));
  }
  private async flushDetach() {
    const install = this.installation ?? (this.installation = load());
    if (!install?.pendingDetach || !install.bindingId) return;
    await accountRequest('notifications_detach', { device_id: install.id, device_secret: install.secret, binding_id: install.bindingId, binding_version: install.bindingVersion });
    const current = this.installation;
    if (current?.bindingId === install.bindingId && current.pendingDetach) { this.installation = { ...current, pendingDetach: false }; store(this.installation); }
  }
  async disable() {
    this.pause();
    if (!webPushSupported()) return;
    this.installation = load() ?? this.installation;
    if (this.installation) { this.installation = { ...this.installation, enabledFor: null, endpoint: null, pendingDetach: !!this.installation.bindingId }; store(this.installation); }
    try { const registration = await navigator.serviceWorker.getRegistration('/'); await (await registration?.pushManager.getSubscription())?.unsubscribe(); } catch { /* Subskrypcja i tak jest nieaktywna po stronie serwera. */ }
    void this.flushDetach().catch(() => this.report('Powiadomienia wyłączono lokalnie. Usunięcie powiązania oczekuje na internet.'));
    this.report('Powiadomienia systemowe wyłączone na tym urządzeniu.');
  }
  async beforeLogout() {
    try { await this.disable(); } catch { this.pause(); this.report('Nie udało się usunąć powiązania urządzenia; ponów po połączeniu z internetem.'); }
  }
}

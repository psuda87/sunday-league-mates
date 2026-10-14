import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { accountRequest } from '../auth/api';
import type { SessionManager } from '../auth/sessionManager';
import { notificationId } from './model';
import { readInstallation, saveInstallation } from './deviceStore';
import type { Installation } from './deviceStore';

const Configuration = registerPlugin<{ status(): Promise<{ configured: boolean; notificationsAllowed: boolean }> }>('SlmPushConfiguration');
const FcmBridge = registerPlugin<{
  status(): Promise<{ configured: boolean }>;
  getToken(): Promise<{ token: string }>;
  disable(): Promise<void>;
  addListener(name: 'token', callback: (value: { token: string }) => void): Promise<PluginListenerHandle>;
}>('SlmFcmBridge');

export class NativePush {
  private handles: PluginListenerHandle[] = [];
  private installation: Installation | null = null;
  private activeUser: string | null = null;
  private epoch = 0;
  private configured = false;
  private stopped = false;
  private lifecycle = 0;
  private writes: Promise<void> = Promise.resolve();
  private bindings: Promise<void> = Promise.resolve();
  constructor(private manager: SessionManager, private tap: (id: string) => void,
    private received: () => void, private report: (value: string) => void) {}
  private platform = () => Capacitor.getPlatform();
  private async loadInstallation() {
    if (!this.installation) {
      const value = await readInstallation();
      if (!this.installation) this.installation = value;
    }
    return this.installation;
  }
  private async save(value: Installation) {
    this.installation = value;
    const write = this.writes.catch(() => undefined).then(() => saveInstallation(value));
    this.writes = write; await write;
  }
  private online = () => { void this.flushDetach().catch(() => this.report('Usunięcie powiązania urządzenia oczekuje na połączenie.')); };
  async start() {
    this.stopped = false;
    const lifecycle = ++this.lifecycle;
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('PushNotifications')) {
      this.report('Centrum powiadomień działa. Systemowy push jest dostępny po konfiguracji aplikacji natywnej.'); return;
    }
    try {
      const add = async (promise: Promise<PluginListenerHandle>) => {
        const handle = await promise;
        if (this.stopped || lifecycle !== this.lifecycle) await handle.remove(); else this.handles.push(handle);
      };
      await add(PushNotifications.addListener('pushNotificationActionPerformed', action => {
        const id = notificationId(action.notification.data); if (id) this.tap(id);
      }));
      await add(PushNotifications.addListener('pushNotificationReceived', () => this.received()));
      await add(PushNotifications.addListener('registration', token => {
        if (this.platform() === 'android') this.queueBind(token.value);
        // Na iOS token Capacitor jest APNs. Nigdy nie zapisujemy go jako FCM.
        else if (this.platform() === 'ios' && Capacitor.isPluginAvailable('SlmFcmBridge')) {
          void FcmBridge.getToken().then(value => this.queueBind(value.token)).catch(() => this.report('Oczekiwanie na token FCM dla iOS.'));
        }
      }));
      await add(PushNotifications.addListener('registrationError', () => this.report('Nie udało się zarejestrować push. Centrum powiadomień nadal działa.')));
      if (this.platform() === 'ios' && Capacitor.isPluginAvailable('SlmFcmBridge')) {
        await add(FcmBridge.addListener('token', value => this.queueBind(value.token)));
      }
      if (this.stopped || lifecycle !== this.lifecycle) return;
      window.addEventListener('online',this.online);
      await this.flushDetach();
    } catch { this.report('Powiadomienia systemowe nie są skonfigurowane. Centrum powiadomień pozostaje dostępne.'); }
  }
  async stop() {
    this.stopped = true; this.lifecycle++; this.pause(); window.removeEventListener('online',this.online);
    const handles = this.handles.splice(0); await Promise.all(handles.map(h => h.remove().catch(() => undefined)));
  }
  pause() { this.activeUser = null; this.epoch++; }
  async resume() {
    const snapshot = this.manager.getSnapshot();
    if (snapshot.phase !== 'ready' || snapshot.session?.must_change_password) { this.pause(); return; }
    this.activeUser = snapshot.session!.user_id;
    const epoch = ++this.epoch;
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('PushNotifications')) {
      this.report('Systemowy push wyłączony lub nieskonfigurowany. Historia w aplikacji działa niezależnie.'); return;
    }
    if (import.meta.env.VITE_SLM_PUSH_ENABLED !== 'true') {
      try { await this.disable(); } catch { /* Nie blokujemy aplikacji bez Firebase. */ }
      this.report('Systemowy push wyłączony lub nieskonfigurowany. Historia w aplikacji działa niezależnie.'); return;
    }
    try {
      await this.loadInstallation();
      if (epoch !== this.epoch || this.installation?.enabledFor !== this.activeUser) {
        this.report('Powiadomienia systemowe są wyłączone na tym urządzeniu.'); return;
      }
      await this.flushDetach();
      if (!await this.checkConfiguration()) return;
      const permission = await PushNotifications.checkPermissions();
      if (epoch !== this.epoch) return;
      const os = this.platform() === 'android' ? await Configuration.status() : { notificationsAllowed: true };
      if (permission.receive !== 'granted' || !os.notificationsAllowed) {
        await this.disable(); this.report('Brak zgody systemowej. Historia w aplikacji nadal działa.'); return;
      }
      if (epoch === this.epoch) await this.register();
    } catch { this.report('Nie można połączyć urządzenia z push. Możesz korzystać z pozostałych funkcji.'); }
  }
  private async checkConfiguration() {
    if (this.platform() === 'android') this.configured = (await Configuration.status()).configured;
    else this.configured = Capacitor.isPluginAvailable('SlmFcmBridge') && (await FcmBridge.status()).configured;
    if (!this.configured) this.report('Brakuje konfiguracji Firebase na urządzeniu. Centrum powiadomień nadal działa.');
    return this.configured;
  }
  private async register() {
    const user = this.activeUser, epoch = this.epoch;
    if (!user || this.manager.getSnapshot().session?.user_id !== user || this.installation?.enabledFor !== user) return;
    if (this.platform() === 'android') await PushNotifications.createChannel({ id: 'slm_updates', name: 'Sunday League Mates',
      description: 'Mecze i aktualizacje Twojej grupy', importance: 3, visibility: 0 });
    if (epoch === this.epoch && this.activeUser === user) await PushNotifications.register();
  }
  async enable() {
    const user = this.manager.getSnapshot().session?.user_id;
    if (!user || !Capacitor.isNativePlatform() || import.meta.env.VITE_SLM_PUSH_ENABLED !== 'true') {
      this.report('Włączenie push wymaga skonfigurowanej aplikacji natywnej. Historia działa bez Firebase.'); return;
    }
    try {
      if (!await this.checkConfiguration()) return;
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') { await this.disable(); this.report('Odmówiono zgody. Historia pozostaje dostępna.'); return; }
      if (this.platform() === 'android' && !(await Configuration.status()).notificationsAllowed) {
        await this.disable(); this.report('Powiadomienia są zablokowane w ustawieniach Androida. Historia nadal działa.'); return;
      }
      if (this.manager.getSnapshot().session?.user_id !== user) return;
      this.installation = await this.loadInstallation() ?? { id: crypto.randomUUID(),
        secret: crypto.randomUUID()+crypto.randomUUID(),enabledFor: null,bindingId: null,bindingVersion: 0,pendingDetach: false };
      await this.flushDetach();
      await this.save({ ...this.installation!,enabledFor: user });
      if (this.manager.getSnapshot().session?.user_id !== user) {
        if (this.installation?.enabledFor === user) await this.save({ ...this.installation,enabledFor: null });
        return;
      }
      this.activeUser = user;
      await this.register();
    } catch { this.report('Nie udało się włączyć powiadomień systemowych. Sprawdź konfigurację i uprawnienia.'); }
  }
  private queueBind(token: string) {
    const epoch = this.epoch;
    this.bindings = this.bindings.catch(() => undefined).then(async () => {
      const user = this.activeUser, install = this.installation;
      if (!token || epoch !== this.epoch || !user || !install || install.enabledFor !== user || this.manager.getSnapshot().session?.user_id !== user) return;
      await this.manager.call('notifications_prepare_device',{ device_id: install.id,device_secret: install.secret });
      if (epoch !== this.epoch || this.activeUser !== user) return;
      const bindingId = crypto.randomUUID();
      const bindingVersion = install.bindingVersion+1;
      await this.save({ ...install,bindingId,bindingVersion });
      if (epoch !== this.epoch || this.activeUser !== user) return;
      await this.manager.call('notifications_register', { device_id: install.id,device_secret: install.secret,binding_id: bindingId,binding_version: bindingVersion,
        token,platform: this.platform() });
      this.report('Urządzenie połączone z powiadomieniami systemowymi.');
    }).catch(() => this.report('Nie udało się powiązać tokenu. Spróbuj ponownie włączyć push; centrum powiadomień nadal działa.'));
  }
  async flushDetach() {
    if (!Capacitor.isNativePlatform()) return;
    await this.loadInstallation();
    const install = this.installation;
    if (!install?.pendingDetach || !install.bindingId) return;
    await accountRequest('notifications_detach', { device_id: install.id,device_secret: install.secret,binding_id: install.bindingId,binding_version: install.bindingVersion });
    if (this.installation?.bindingId === install.bindingId && this.installation.pendingDetach) await this.save({ ...this.installation,pendingDetach: false });
  }
  async disable() {
    this.pause();
    if (!Capacitor.isNativePlatform()) return;
    try {
      await this.loadInstallation();
      if (this.installation) await this.save({ ...this.installation,enabledFor: null,pendingDetach: !!this.installation.bindingId });
    } finally {
      if (this.configured) {
        await PushNotifications.unregister().catch(() => undefined);
        if (this.platform() === 'ios' && Capacitor.isPluginAvailable('SlmFcmBridge')) await FcmBridge.disable().catch(() => undefined);
      }
      if (Capacitor.isPluginAvailable('PushNotifications')) await PushNotifications.removeAllDeliveredNotifications().catch(() => undefined);
    }
    void this.flushDetach().catch(() => this.report('Push wyłączono lokalnie. Usunięcie powiązania oczekuje na internet.'));
    this.report('Powiadomienia systemowe wyłączone na tym urządzeniu.');
  }
  async beforeLogout() {
    try { await this.disable(); }
    catch { this.pause(); this.report('Nie udało się usunąć powiązania urządzenia; ponów po połączeniu z internetem.'); }
  }
}

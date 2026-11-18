import { Capacitor } from '@capacitor/core';
import type { SessionManager } from '../auth/sessionManager';
import type { PushController } from './pushController';
import { WebPush } from './webPush';

export const PUSH_STATUS_EVENT = 'slm-push-status';
export const OPEN_BELL_EVENT = 'slm-open-bell';
let lastStatus = '';
export const pushStatusText = () => lastStatus;
// Jeden kontroler na SessionManager; interfejs Premium i cykl życia sesji współdzielą ten sam obiekt.
const controllers = new WeakMap<SessionManager, PushController | null>();

/** Kontroler Web Push dla PWA. W aplikacji natywnej (APK) zwraca null — tam push obsłuży FCM w osobnym etapie. */
export function pushFor(manager: SessionManager): PushController | null {
  if (controllers.has(manager)) return controllers.get(manager) ?? null;
  const controller = Capacitor.isNativePlatform() ? null : new WebPush(manager,
    // Kliknięcie powiadomienia: oznacz jako przeczytane (best effort) i otwórz dzwonek.
    id => { void manager.call('notifications_open', { notification_id: id }).catch(() => undefined); window.dispatchEvent(new Event(OPEN_BELL_EVENT)); },
    () => undefined,
    value => { lastStatus = value; window.dispatchEvent(new Event(PUSH_STATUS_EVENT)); });
  controllers.set(manager, controller);
  return controller;
}

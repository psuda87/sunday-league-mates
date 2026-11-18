import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WebPush } from './webPush';
import type { SessionManager } from '../auth/sessionManager';
const user = '11111111-1111-4111-8111-111111111111';
const keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };
function setup(permission: 'granted' | 'denied') {
  const subscribe = vi.fn(async () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', toJSON: () => ({ keys }) }));
  const registration = { pushManager: { getSubscription: vi.fn(async () => null), subscribe } };
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', Object.assign(class {}, { permission: 'default', requestPermission: vi.fn(async () => permission) }));
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn(async () => registration), ready: Promise.resolve(registration),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), getRegistration: vi.fn(async () => registration) } });
  const call = vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({}));
  const manager = { call, getSnapshot: () => ({ phase: 'ready', session: { user_id: user, must_change_password: false } }) } as unknown as SessionManager;
  const report = vi.fn();
  return { push: new WebPush(manager, vi.fn(), vi.fn(), report), call, report, subscribe };
}
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());
it('włączenie zapisuje subskrypcję jako urządzenie web z kluczami i adresem endpointu', async () => {
  const { push, call, subscribe } = setup('granted');
  await push.enable(); await vi.waitFor(() => expect(call).toHaveBeenCalledTimes(2));
  expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
  expect(call.mock.calls[0][0]).toBe('notifications_prepare_device');
  expect(call.mock.calls[1]).toEqual(['notifications_register', expect.objectContaining({ platform: 'web', token: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: keys.p256dh, auth: keys.auth, binding_version: 1 })]);
  expect(push.isEnabled()).toBe(true);
});
it('odmowa zgody nie rejestruje urządzenia', async () => {
  const { push, call, report } = setup('denied');
  await push.enable();
  expect(call).not.toHaveBeenCalled(); expect(report).toHaveBeenCalledWith(expect.stringContaining('zablokowane'));
});

import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { AccountError } from './api';

export interface TokenStore {
  read(): Promise<string | null>;
  write(refreshToken: string): Promise<void>;
  clear(): Promise<void>;
}
export const WEB_TOKEN_KEY = 'slm.auth.hjtcyybkxebvdropchac.refresh.v1';
let setup: Promise<void> | undefined;
async function nativeSetup() {
  if (!Capacitor.isPluginAvailable('SecureStorage')) throw new Error();
  if (!setup) setup = (async () => {
    await SecureStorage.setKeyPrefix('slm.auth.hjtcyybkxebvdropchac.');
    await SecureStorage.setSynchronize(false);
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
  })().catch(() => { setup = undefined; throw new Error(); });
  await setup;
}
const storageFailure = () => new AccountError('Nie można odczytać lub zapisać sesji na tym urządzeniu. Spróbuj ponownie.', 'storage_error');
export const tokenStore: TokenStore = {
  async read() {
    try {
      if (!Capacitor.isNativePlatform()) return window.localStorage.getItem(WEB_TOKEN_KEY);
      await nativeSetup();
      const value = await SecureStorage.get('refresh.v1', false, false);
      if (value === null || value === '') return null;
      if (typeof value !== 'string') throw new Error();
      return value;
    } catch { throw storageFailure(); }
  },
  async write(value) {
    try {
      if (!Capacitor.isNativePlatform()) { window.localStorage.setItem(WEB_TOKEN_KEY, value); return; }
      await nativeSetup();
      await SecureStorage.set('refresh.v1', value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
    } catch { throw storageFailure(); }
  },
  async clear() {
    try {
      if (!Capacitor.isNativePlatform()) { window.localStorage.removeItem(WEB_TOKEN_KEY); return; }
      await nativeSetup();
      await SecureStorage.remove('refresh.v1', false);
    } catch { throw storageFailure(); }
  },
};

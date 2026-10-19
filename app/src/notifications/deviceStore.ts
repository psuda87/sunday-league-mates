import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
export interface Installation { id: string; secret: string; enabledFor: string | null; bindingId: string | null; bindingVersion: number; pendingDetach: boolean }
const key = 'push.installation.v1';
async function setup() {
  // Ten sam prefix co tokenStore: plugin używa wspólnego globalnego prefixu.
  await SecureStorage.setKeyPrefix('slm.auth.hjtcyybkxebvdropchac.');
  await SecureStorage.setSynchronize(false);
  await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
}
export async function readInstallation(): Promise<Installation | null> {
  await setup();
  const value = await SecureStorage.get(key,false,false);
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Nie można odczytać konfiguracji urządzenia.');
  const parsed = JSON.parse(value) as Installation;
  if (!/^[0-9a-f-]{36}$/.test(parsed.id) || !/^[0-9a-f-]{72}$/.test(parsed.secret)) throw new Error('Nieprawidłowa konfiguracja urządzenia.');
  if (!Number.isSafeInteger(parsed.bindingVersion) || parsed.bindingVersion<0) throw new Error('Nieprawidłowa wersja urządzenia.');
  return parsed;
}
export async function saveInstallation(value: Installation) {
  await setup();
  await SecureStorage.set(key,JSON.stringify(value),false,false,KeychainAccess.whenUnlockedThisDeviceOnly);
}

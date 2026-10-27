import { beforeEach, expect, test, vi } from 'vitest';
const mocks=vi.hoisted(()=>({native:vi.fn(),available:vi.fn(),storage:{get:vi.fn(),set:vi.fn(),remove:vi.fn(),setKeyPrefix:vi.fn(),setSynchronize:vi.fn(),setDefaultKeychainAccess:vi.fn()}}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:mocks.native,isPluginAvailable:mocks.available}}));
vi.mock('@aparajita/capacitor-secure-storage',()=>({SecureStorage:mocks.storage,KeychainAccess:{whenUnlockedThisDeviceOnly:1}}));
beforeEach(()=>{vi.resetModules();vi.resetAllMocks();window.localStorage.clear();});
test('na urządzeniu korzysta wyłącznie z vault; iOS bez synchronizacji i migracji klucza',async()=>{
  mocks.native.mockReturnValue(true);mocks.available.mockReturnValue(true);
  const value=crypto.randomUUID();mocks.storage.get.mockResolvedValue(value);
  const {tokenStore}=await import('./tokenStore');await tokenStore.write(value);
  expect(mocks.storage.setSynchronize).toHaveBeenCalledWith(false);
  expect(mocks.storage.setDefaultKeychainAccess).toHaveBeenCalledWith(1);
  expect(window.localStorage.length).toBe(0);expect((await tokenStore.read())===value).toBe(true);
  await tokenStore.clear();expect(mocks.storage.remove).toHaveBeenCalledWith('refresh.v1',false);
});
test('brak pluginu na urządzeniu nie zapisuje tokenu w localStorage',async()=>{
  mocks.native.mockReturnValue(true);mocks.available.mockReturnValue(false);
  const {tokenStore}=await import('./tokenStore');
  await expect(tokenStore.write(crypto.randomUUID())).rejects.toMatchObject({code:'storage_error'});
  expect(window.localStorage.length).toBe(0);
});
test('web zapisuje tylko refresh pod kluczem tego projektu i usuwa go przy logout',async()=>{
  mocks.native.mockReturnValue(false);const {tokenStore,WEB_TOKEN_KEY}=await import('./tokenStore');
  const value=crypto.randomUUID();await tokenStore.write(value);expect(window.localStorage.getItem(WEB_TOKEN_KEY)===value).toBe(true);
  await tokenStore.clear();expect(window.localStorage.getItem(WEB_TOKEN_KEY)).toBeNull();
});

test('nowy projekt ma oddzielny klucz vault i nie zmienia klucza starej sesji',async()=>{
 mocks.native.mockReturnValue(true);mocks.available.mockReturnValue(true);const {tokenStore,createProjectTokenStore}=await import('./tokenStore');const other=createProjectTokenStore('abcdefghijklmnopqrst');await other.write('fixture-new-refresh');await tokenStore.write('fixture-old-refresh');await other.clear();expect(mocks.storage.set).toHaveBeenCalledWith('project.abcdefghijklmnopqrst.refresh.v1','fixture-new-refresh',false,false,1);expect(mocks.storage.set).toHaveBeenCalledWith('refresh.v1','fixture-old-refresh',false,false,1);expect(mocks.storage.remove).toHaveBeenCalledWith('project.abcdefghijklmnopqrst.refresh.v1',false);expect(mocks.storage.setKeyPrefix).toHaveBeenCalledTimes(1);expect(localStorage.length).toBe(0);
});
test('nowy projekt na urządzeniu również odmawia fallbacku bez pluginu',async()=>{mocks.native.mockReturnValue(true);mocks.available.mockReturnValue(false);const {createProjectTokenStore}=await import('./tokenStore');await expect(createProjectTokenStore('abcdefghijklmnopqrst').write('fixture-refresh')).rejects.toMatchObject({code:'storage_error'});expect(localStorage.length).toBe(0);});

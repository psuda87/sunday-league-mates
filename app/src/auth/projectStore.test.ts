import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>false}}));
import {createProjectTokenStore,tokenStore,WEB_TOKEN_KEY} from './tokenStore';
afterEach(()=>{localStorage.clear();vi.restoreAllMocks();});
it('new project uses a separate refresh key and never clears the old session',async()=>{localStorage.setItem(WEB_TOKEN_KEY,'old-fixture-refresh');const store=createProjectTokenStore('abcdefghijklmnopqrst');expect(await store.read()).toBeNull();await store.write('new-fixture-refresh');expect(await store.read()).toBe('new-fixture-refresh');expect(await tokenStore.read()).toBe('old-fixture-refresh');await store.clear();expect(await tokenStore.read()).toBe('old-fixture-refresh');});
it('invalid project config cannot silently reuse the legacy key',()=>{expect(()=>createProjectTokenStore('')).toThrow();expect(()=>createProjectTokenStore('../old')).toThrow();});

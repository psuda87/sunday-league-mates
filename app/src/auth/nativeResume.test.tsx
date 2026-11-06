import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useB1Lifecycle} from './useB1Lifecycle';
import {SessionManager} from './sessionManager';
import {AccountError} from './api';
import type {Session} from './api';
import type {RequestAccount} from './sessionManager';
const native=vi.hoisted(()=>({state:(_s:{isActive:boolean})=>{void _s;},remove:vi.fn(async()=>{})}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true}}));
vi.mock('@capacitor/app',()=>({App:{addListener:vi.fn(async(_event:string,handler:typeof native.state)=>{native.state=handler;return {remove:native.remove};})}}));
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
const session:Session={user_id:'fixture',access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,role:'member',must_change_password:false};
async function fixture(){
 vi.useFakeTimers();let finish!:(s:Session)=>void,fail!:(e:Error)=>void;
 const request=vi.fn(async(action:string)=>action==='refresh'?new Promise<Session>((resolve,reject)=>{finish=resolve;fail=reject;}):session);
 const manager=new SessionManager({read:async()=>null,write:async()=>{},clear:async()=>{}},request as RequestAccount);
 await manager.signIn('fixture','fixture');renderHook(()=>useB1Lifecycle(manager,manager.getSnapshot()));
 await act(async()=>{finish(session);await Promise.resolve();});request.mockClear();
 return {manager,request,finish:()=>finish(session),fail:(code:string)=>fail(new AccountError('fixture',code))};
}
it('native inactive/active, visibility and focus bursts keep ready without extra refresh',async()=>{
 const f=await fixture();
 for(let i=0;i<4;i++)await act(async()=>{
  native.state({isActive:false});vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');document.dispatchEvent(new Event('visibilitychange'));
  expect(f.manager.getSnapshot().phase).toBe('ready');
  native.state({isActive:true});vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));
 });
 expect(f.request).not.toHaveBeenCalled();expect(f.manager.getSnapshot().phase).toBe('ready');
});
it('native return after the verification interval uses one background request',async()=>{
 const f=await fixture();vi.advanceTimersByTime(61000);
 act(()=>{native.state({isActive:false});native.state({isActive:true});window.dispatchEvent(new Event('focus'));});
 expect(f.request).toHaveBeenCalledTimes(1);expect(f.manager.getSnapshot().phase).toBe('ready');
 await act(async()=>{f.finish();await Promise.resolve();});expect(f.manager.getSnapshot().phase).toBe('ready');
});
it.each(['session_invalid','network_error'])('native return with %s hides data and blocks operations',async code=>{
 const f=await fixture();vi.advanceTimersByTime(61000);act(()=>{native.state({isActive:true});});
 await act(async()=>{f.fail(code);await Promise.resolve();});
 expect(f.manager.getSnapshot().phase).toBe(code==='session_invalid'?'signed_out':'unavailable');expect(f.manager.getSnapshot().session).toBeNull();
 await expect(f.manager.call('profile')).rejects.toThrow();
});
it('native return after expiry blocks until the server confirms the session',async()=>{
 const f=await fixture();vi.advanceTimersByTime(3600001);act(()=>{native.state({isActive:true});});
 expect(f.manager.getSnapshot().phase).toBe('checking');expect(f.manager.getSnapshot().session).toBeNull();
 await act(async()=>{f.finish();await Promise.resolve();});expect(f.manager.getSnapshot().phase).toBe('ready');
});

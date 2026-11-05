import {act,renderHook,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {SessionManager} from './sessionManager';
import type {RequestAccount} from './sessionManager';
import type {Session} from './api';
import {AccountError} from './api';
import {useB1Lifecycle} from './useB1Lifecycle';
const session:Session={user_id:'fixture',access_token:'access',refresh_token:'refresh',expires_in:3600,role:'member',must_change_password:false};
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
async function fixture(){
 vi.useFakeTimers();let finish!:(s:Session)=>void,fail!:(e:Error)=>void;
 const request=vi.fn(async(action:string)=>action==='login'?session:action==='refresh'?new Promise<Session>((resolve,reject)=>{finish=resolve;fail=reject;}):{ok:true});
 const store={read:vi.fn(async()=>null),write:vi.fn(async()=>{}),clear:vi.fn(async()=>{})};
 const manager=new SessionManager(store,request as RequestAccount);await manager.signIn('fixture','fixture');
 return {manager,request,store,finish:(s=session)=>finish(s),fail:(code:string)=>fail(new AccountError('fixture',code))};
}
it('rapid visibility/focus events preserve ready without extra requests',async()=>{
 const f=await fixture();renderHook(()=>useB1Lifecycle(f.manager,f.manager.getSnapshot()));
 await act(async()=>{f.finish();await Promise.resolve();});f.request.mockClear();
 for(let i=0;i<8;i++)await act(async()=>{vi.spyOn(document,'visibilityState','get').mockReturnValue(i%2?'visible':'hidden');document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
 expect(f.request).not.toHaveBeenCalled();expect(f.manager.getSnapshot().phase).toBe('ready');
});
it('valid background verification coalesces events and gates protected calls',async()=>{
 const f=await fixture();vi.advanceTimersByTime(61000);
 const first=f.manager.resume(),second=f.manager.resume();expect(first).toBe(second);expect(f.manager.getSnapshot().phase).toBe('ready');
 const call=f.manager.call('profile');expect(f.request.mock.calls.map(c=>c[0])).toEqual(['login','refresh']);
 f.finish();await first;await call;expect(f.manager.getSnapshot().phase).toBe('ready');
});
it('expired sessions block data until verified',async()=>{
 const f=await fixture();vi.advanceTimersByTime(3600001);const work=f.manager.resume();expect(f.manager.getSnapshot().session).toBeNull();f.finish();await work;expect(f.manager.getSnapshot().phase).toBe('ready');
});
it.each(['session_invalid','network_error'])('background %s hides data and blocks calls',async code=>{
 const f=await fixture();vi.advanceTimersByTime(61000);const work=f.manager.resume();f.fail(code);await work;
 expect(f.manager.getSnapshot().phase).toBe(code==='session_invalid'?'signed_out':'unavailable');expect(f.manager.getSnapshot().session).toBeNull();await expect(f.manager.call('profile')).rejects.toThrow();
 expect(f.store.clear).toHaveBeenCalledTimes(code==='session_invalid'?1:0);
});
it('pending background check cannot retain data beyond expiry',async()=>{
 const f=await fixture();vi.advanceTimersByTime(3599000);const work=f.manager.resume();expect(f.manager.getSnapshot().phase).toBe('ready');vi.advanceTimersByTime(1001);expect(f.manager.getSnapshot().session).toBeNull();f.finish();await work;
});

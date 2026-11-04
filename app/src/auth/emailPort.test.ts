import {describe,expect,it,vi} from 'vitest';
import {SessionManager} from './sessionManager';
import type {Session} from './api';
import {AccountError} from './api';
import {b1Port} from './b1Port';
import type {EmailCallback} from './emailCallback';
const legal={terms:'https://legal.example.invalid/terms',privacy:'https://legal.example.invalid/privacy'};
const draft={nickname:'Fikcyjny',fullName:'',phone:'',jerseyNumber:0};
function fixture(response:Record<string,unknown>={verification_required:true},callback?:EmailCallback){
 let saved:string|null=null;
 const request=vi.fn<(action:string,body?:Record<string,unknown>)=>Promise<Record<string,unknown>>>().mockResolvedValue(response);
 const store={read:async()=>saved,write:async(v:string)=>{saved=v;},clear:async()=>{saved=null;}};
 const manager=new SessionManager(store,async<T>(action:string,body?:Record<string,unknown>)=>await request(action,body) as T);
 return {request,manager,port:b1Port(manager,{legal,callback}),peek:()=>saved};
}
describe('Premium wykorzystuje istniejący SessionManager i accounts',()=>{
 it('rejestruje z pseudonimem, potwierdzeniem polityk i znormalizowanym e-mailem, bez sesji',async()=>{
  const f=fixture();await f.manager.refresh();await f.port.signUp(draft,' Fixture@Example.invalid ',crypto.randomUUID());
  expect(f.request).toHaveBeenCalledWith('signup',expect.objectContaining({email:'fixture@example.invalid',profile:draft,accept_policies:true}));
  expect(f.manager.getSnapshot().phase).toBe('signed_out');expect(f.peek()).toBeNull();
  await f.port.resendVerification();expect(f.request).toHaveBeenLastCalledWith('resend_verification',{email:'fixture@example.invalid'});
  await f.port.requestPasswordReset(' Fixture@Example.invalid ');expect(f.request).toHaveBeenLastCalledWith('recover_email',{email:'fixture@example.invalid'});
 });
 it('potwierdza signup tylko raz; dowód nie jest sesją i znika z wejściowego obiektu',async()=>{
  const callback:EmailCallback={kind:'proof',intent:'verify',tokenHash:'a'.repeat(64)};
  const f=fixture({email_verified:true},callback);await f.manager.refresh();
  await f.port.completeRedirect('verify');expect(f.request).toHaveBeenCalledWith('verify_email',{token_hash:'a'.repeat(64)});
  expect(callback.tokenHash).toBe('');
  await expect(f.port.completeRedirect('verify')).rejects.toThrow('link');expect(f.request).toHaveBeenCalledTimes(1);expect(f.peek()).toBeNull();
 });
 it('resetuje hasło z dowodem recovery, nie przekazuje fikcyjnego current_password i nie loguje',async()=>{
  const f=fixture({password_changed:true},{kind:'proof',intent:'recovery',tokenHash:'b'.repeat(64)});await f.manager.refresh();
  const next=crypto.randomUUID();await f.port.updatePassword(next);
  expect(f.request).toHaveBeenCalledWith('recover_password',{token_hash:'b'.repeat(64),new_password:next});
  expect(f.peek()).toBeNull();expect(f.manager.getSnapshot().phase).toBe('signed_out');
  await expect(f.port.updatePassword(next)).rejects.toThrow('link');
 });
 it('odrzuca token dla innego celu i dowód odrzucony przez serwer',async()=>{
  const f=fixture({}, {kind:'proof',intent:'verify',tokenHash:'a'.repeat(64)});await f.manager.refresh();
  await expect(f.port.updatePassword(crypto.randomUUID())).rejects.toThrow('link');expect(f.request).not.toHaveBeenCalled();
  f.request.mockRejectedValueOnce(new AccountError('denied','invalid_email_link'));
  await expect(f.port.completeRedirect('verify')).rejects.toThrow('link');
 });
 it('blokuje ponowne wysyłanie oraz późną odpowiedź po logout',async()=>{
  const f=fixture();await f.manager.refresh();let done!:(v:Record<string,unknown>)=>void;
  f.request.mockImplementationOnce(()=>new Promise(resolve=>{done=resolve;}));
  const first=f.port.requestPasswordReset('fixture@example.invalid');
  await expect(f.port.requestPasswordReset('fixture@example.invalid')).rejects.toThrow('Operacja jest już');
  await f.manager.logout();done({verification_required:true});await expect(first).rejects.toMatchObject({code:'session_invalid'});
 });
 it('nie akceptuje sesji w odpowiedzi e-mail, błędu sieci ani niezakończonej operacji jako sukcesu',async()=>{
  const f=fixture({verification_required:true,access_token:'must-not-be-adopted'});await f.manager.refresh();
  await expect(f.port.requestPasswordReset('fixture@example.invalid')).rejects.toThrow('network');expect(f.peek()).toBeNull();
  f.request.mockRejectedValueOnce(new AccountError('offline','network_error'));
  await expect(f.port.requestPasswordReset('fixture@example.invalid')).rejects.toThrow('network');
 });
 it('nie działa anonimowo w aktywnej sesji i zachowuje istniejące odświeżanie',async()=>{
  const session:Session={user_id:crypto.randomUUID(),access_token:'access-fixture',refresh_token:'refresh-fixture',role:'member',expires_in:3600,must_change_password:false};
  const f=fixture(session as unknown as Record<string,unknown>);await f.port.signIn('fixture',crypto.randomUUID());
  await expect(f.port.requestPasswordReset('fixture@example.invalid')).rejects.toMatchObject({code:'access_unavailable'});
  await f.manager.refresh();expect(f.request).toHaveBeenLastCalledWith('refresh',{refresh_token:session.refresh_token});expect(f.peek()).toBe(session.refresh_token);
 });
});

import {describe,expect,it,vi} from 'vitest';
import {emailAction,emailRedirect,signupProfile} from './emailFlows';
import type {EmailDependencies} from './emailFlows';
const id='d00d0000-0000-4000-8000-000000000001',sid='d00d0000-0000-4000-8000-000000000002';
const env={emailSignupEnabled:true,emailRedirectUrl:'https://slm.example.invalid/auth/callback',origins:['https://slm.example.invalid']};
const proof={access_token:'proof-fixture',refresh_token:'never-to-browser',expires_in:3600};
function deps(){
 const call=vi.fn<EmailDependencies['call']>(async path=>path==='/auth/v1/verify'?{ok:true,status:200,data:proof}:{ok:true,status:200,data:{}});
 const db=vi.fn<EmailDependencies['db']>(async path=>path.includes('slm_email_identity')?{user_id:id,email_account:true}:path.includes('slm_account_begin')?{operation_id:'fixture-operation',security_version:8}:true);
 const d:EmailDependencies={call,db,state:vi.fn(async()=>({active:true,operation_id:null,security_version:7,must_change_password:false})),verify:vi.fn(async()=>({id,sid})),accept:vi.fn(async()=>({})),rejectSession:vi.fn(async()=>{}),rate:vi.fn(async()=>{})};
 return {d,call,db};
}
const recovery={token_hash:'a'.repeat(64),new_password:'Fixture-only-password-2026'};
describe('email accounts (kontrolowany transport GoTrue/RPC, nie Cloud)',()=>{
 it('pozostawia inne kontrakty bez zmian i nie wysyła poczty bez flagi lub allowlisty',async()=>{
  const {d,call}=deps();expect(await emailAction('profile',{},env,d)).toBeNull();
  await expect(emailAction('signup',{}, {...env,emailSignupEnabled:false},d)).rejects.toMatchObject({code:'mail_unconfigured'});
  for(const bad of ['https://evil.invalid/auth/callback','http://slm.example.invalid/auth/callback','https://slm.example.invalid/auth/callback?next=bad'])expect(()=>emailRedirect({...env,emailRedirectUrl:bad})).toThrow();
  expect(call).not.toHaveBeenCalled();
 });
 it.each(['https://localhost','https://app.localhost','https://127.0.0.1','https://127.1','https://[::1]'])('nie używa lokalnego callbacku %s nawet z allowlisty natywnego CORS',origin=>{
  const normalized=new URL(origin).origin;
  expect(()=>emailRedirect({...env,origins:[normalized],emailRedirectUrl:origin+'/auth/callback'})).toThrow('Proces e-mail');
 });
 it('rejestruje przez GoTrue z walidowanym profilem, bez roli, grup, dowolnych redirectów lub autoconfirm',async()=>{
  const {d,call}=deps();const p={nickname:' Fikcyjny ',fullName:'',phone:'123456789',jerseyNumber:0,role:'admin'};
  const r=await emailAction('signup',{email:' Fixture@Example.invalid ',password:recovery.new_password,profile:p,accept_policies:true,redirect_to:'https://evil.invalid'},env,d);
  expect(call).toHaveBeenCalledWith('/auth/v1/signup?redirect_to='+encodeURIComponent(env.emailRedirectUrl),'POST',{
   email:'fixture@example.invalid',password:recovery.new_password,data:{slm_signup_profile:{nickname:'Fikcyjny',full_name:'',contact_phone:'+48123456789',jersey_number:0}},
  });expect(r).toEqual({verification_required:true});expect(d.accept).not.toHaveBeenCalled();
 });
 it.each(['user_already_exists','email_exists','user_not_found'])('nie ujawnia istnienia adresu: %s',async code=>{
  const {d,call}=deps();call.mockResolvedValueOnce({ok:false,status:400,data:{code}});
  expect(await emailAction('recover_email',{email:'fixture@example.invalid'},env,d)).toEqual({verification_required:true});
 });
 it('nie przyjmuje autoconfirm ani nie przekazuje sesji z signup',async()=>{
  const {d,call}=deps();call.mockResolvedValueOnce({ok:true,status:200,data:proof});
  await expect(emailAction('signup',{email:'fixture@example.invalid',password:recovery.new_password,profile:{nickname:'Fikcyjny',fullName:'',phone:''},accept_policies:true},env,d)).rejects.toMatchObject({code:'verification_required'});
  expect(d.rejectSession).toHaveBeenCalledWith(proof);expect(d.accept).not.toHaveBeenCalled();
 });
 it('potwierdza e-mail, ale nigdy nie nadaje sesji aplikacji ani grupy',async()=>{
  const {d,call}=deps();expect(await emailAction('verify_email',recovery,env,d)).toEqual({email_verified:true});
  expect(call).toHaveBeenCalledWith('/auth/v1/verify','POST',{type:'signup',token_hash:recovery.token_hash});
  expect(d.accept).not.toHaveBeenCalled();expect(d.rejectSession).toHaveBeenCalledWith(proof);
 });
 it.each([400,401,403,422])('odrzuca wygasły/nieprawidłowy/zużyty dowód (%s)',async status=>{
  const {d,call}=deps();call.mockResolvedValueOnce({ok:false,status,data:{code:'otp_expired'}});
  await expect(emailAction('recover_password',recovery,env,d)).rejects.toMatchObject({code:'invalid_email_link'});expect(d.accept).not.toHaveBeenCalled();expect(d.db).not.toHaveBeenCalled();
 });
 it('waliduje hasło i hash przed zużyciem dowodu',async()=>{
  const {d,call}=deps();await expect(emailAction('recover_password',{...recovery,new_password:'short'},env,d)).rejects.toMatchObject({code:'invalid_password'});
  await expect(emailAction('recover_password',{...recovery,token_hash:'jwt.not.accepted'},env,d)).rejects.toMatchObject({code:'invalid_email_link'});expect(call).not.toHaveBeenCalled();
 });
 it('resetuje jako właściciel potwierdzonego dowodu, używa wersji/begin/finish i odwołuje sesję pomocniczą',async()=>{
  const {d,call,db}=deps();expect(await emailAction('recover_password',{...recovery,user_id:'foreign',role:'admin',security_version:999},env,d)).toEqual({password_changed:true});
  expect(d.accept).toHaveBeenCalledWith(proof,7);
  expect(db).toHaveBeenCalledWith('rpc/slm_account_begin','POST',{p_actor:id,p_session:sid,p_target:id,p_kind:'password'});
  expect(call).toHaveBeenCalledWith('/auth/v1/user','PUT',{password:recovery.new_password},proof.access_token);
  expect(db).toHaveBeenCalledWith('rpc/slm_account_finish','POST',{p_user:id,p_operation:'fixture-operation',p_session:sid,p_actor:id});
  expect(db).toHaveBeenCalledWith('rpc/slm_account_revoke_session','POST',{p_user:id,p_session:sid});expect(d.rejectSession).toHaveBeenCalledWith(proof);
 });
 it.each([{active:false,operation_id:null},{active:true,operation_id:'administrator-operation'}])('nie odblokowuje nieaktywnego/zablokowanego konta: %j',async state=>{
  const {d,call}=deps();vi.mocked(d.state).mockResolvedValueOnce(state);
  await expect(emailAction('recover_password',recovery,env,d)).rejects.toMatchObject({code:'invalid_email_link'});
  expect(d.accept).not.toHaveBeenCalled();expect(call.mock.calls.every(([path])=>path!=='/auth/v1/user')).toBe(true);expect(d.rejectSession).toHaveBeenCalled();
 });
 it('odrzuca legacy i obcą tożsamość, nie zmieniając ich haseł',async()=>{
  for(const identity of [{user_id:id,email_account:false},{user_id:'foreign',email_account:true},null]){
   const {d,db}=deps();db.mockResolvedValueOnce(identity as never);
   await expect(emailAction('recover_password',recovery,env,d)).rejects.toMatchObject({code:'invalid_email_link'});expect(d.accept).not.toHaveBeenCalled();expect(d.rejectSession).toHaveBeenCalled();
  }
 });
 it('konflikt wersji/reset administratora zatrzymuje zmianę przed GoTrue PUT',async()=>{
  const {d,call,db}=deps();vi.mocked(d.accept).mockRejectedValueOnce(new Error('version conflict'));
  await expect(emailAction('recover_password',recovery,env,d)).rejects.toThrow('version conflict');expect(call).toHaveBeenCalledTimes(1);expect(db.mock.calls.some(([path])=>path.includes('slm_account_begin'))).toBe(false);expect(d.rejectSession).toHaveBeenCalled();
 });
 it('jednoznaczna odmowa hasła wycofuje tylko konkretną operację, bez przywracania starych sesji',async()=>{
  const {d,call,db}=deps();call.mockResolvedValueOnce({ok:true,status:200,data:proof}).mockResolvedValueOnce({ok:false,status:422,data:{code:'same_password'}});
  await expect(emailAction('recover_password',recovery,env,d)).rejects.toMatchObject({code:'invalid_password'});
  expect(db).toHaveBeenCalledWith('rpc/slm_account_email_recovery_abort','POST',{p_user:id,p_session:sid,p_operation:'fixture-operation',p_version:8,p_was_temporary:false});
  expect(db.mock.calls.some(([path])=>path.includes('slm_account_finish'))).toBe(false);
 });
 it.each(['network','server','finish'])('nie odblokowuje konta przy niejednoznacznym wyniku %s',async failure=>{
  const {d,call,db}=deps();
  if(failure==='network')call.mockResolvedValueOnce({ok:true,status:200,data:proof}).mockRejectedValueOnce(new Error('timeout'));
  if(failure==='server')call.mockResolvedValueOnce({ok:true,status:200,data:proof}).mockResolvedValueOnce({ok:false,status:503,data:{}});
  if(failure==='finish')db.mockImplementation(async path=>path.includes('slm_email_identity')?{user_id:id,email_account:true}:path.includes('slm_account_begin')?{operation_id:'fixture-operation',security_version:8}:false);
  await expect(emailAction('recover_password',recovery,env,d)).rejects.toMatchObject({code:'operation_pending'});
  expect(db.mock.calls.some(([path])=>path.includes('recovery_abort'))).toBe(false);expect(d.rejectSession).toHaveBeenCalled();
 });
 it('odrzuca nieprawidłowe dane profilu zamiast przenosić je do metadata',()=>{
  for(const p of [{nickname:'<admin>'},{nickname:'',jerseyNumber:7},{nickname:'Valid',jerseyNumber:100},{nickname:'Valid',phone:'foreign'}])expect(()=>signupProfile({profile:{fullName:'',phone:'',...p}})).toThrow();
 });
});

it('rejects an occupied nickname before signup and after a concurrent signup wins',async()=>{
 const profile={nickname:'CaseNick',fullName:'',phone:''},body={email:'fixture@example.invalid',password:'Fixture-password',profile,accept_policies:true};
 const env={emailSignupEnabled:true,emailRedirectUrl:'https://fixture.invalid/auth/callback',origins:['https://fixture.invalid']};
 const call=vi.fn(async()=>({ok:false,status:500,data:{}}));
 const d={call,db:vi.fn().mockResolvedValue(false),rate:vi.fn(async()=>{})} as unknown as EmailDependencies;
 await expect(emailAction('signup',body,env,d)).rejects.toMatchObject({code:'nickname_taken',status:409});expect(call).not.toHaveBeenCalled();
 vi.mocked(d.db).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
 await expect(emailAction('signup',body,env,d)).rejects.toMatchObject({code:'nickname_taken',status:409});expect(call).toHaveBeenCalledOnce();
});

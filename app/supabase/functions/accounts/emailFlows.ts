// Email proofs stay in GoTrue. No caller-supplied identity, session or redirect is trusted.
import { normalizePhoneUpdate } from '../_shared/phone.ts';

type Row = Record<string, unknown>;
type Reply = {ok:boolean;status:number;data:Row};
export class EmailFlowError extends Error {
  constructor(readonly status:number,readonly code:string,message:string){super(message);}
}
export interface EmailEnvironment {
  emailSignupEnabled?:boolean;
  emailRedirectUrl?:string;
  origins:string[];
}
export interface EmailDependencies {
  call:(path:string,method?:string,body?:unknown,token?:string,admin?:boolean)=>Promise<Reply>;
  db:(path:string,method?:string,body?:unknown)=>Promise<unknown>;
  state:(id:string)=>Promise<Row>;
  verify:(token:string)=>Promise<{id:string;sid:string}>;
  accept:(session:Row,version:number)=>Promise<unknown>;
  rejectSession:(session:Row)=>Promise<void>;
  rate:(key:string,limit:number,seconds?:number)=>Promise<void>;
}
const invalidLink=()=>new EmailFlowError(400,'invalid_email_link','Link jest nieprawidłowy lub wygasł. Poproś o nowy.');
const pending=()=>new EmailFlowError(409,'operation_pending','Nie potwierdzono zakończenia zmiany hasła. Nie ponawiaj tego linku; skontaktuj się z administratorem.');
const input=()=>new EmailFlowError(400,'invalid_input','Sprawdź dane formularza.');
const actions=new Set(['signup','resend_verification','recover_email','verify_email','recover_password']);
function text(body:Row,key:string,max:number){const v=body[key];if(typeof v!=='string'||v.length>max)throw input();return v;}
function newPassword(body:Row,key:string){const v=text(body,key,128);if(Array.from(v).length<8||new TextEncoder().encode(v).length>72)throw new EmailFlowError(400,'invalid_password','Hasło: minimum 8 znaków, maksimum 72 bajty UTF-8.');return v;}
function safeName(value:unknown,max:number,required=false){
  if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim())||/[\p{Cc}<>]/u.test(value))throw input();return value.trim();
}
export function signupProfile(body:Row){
  const raw=body.profile;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw input();
  const p=raw as Row;
  const nickname=safeName(p.nickname,48,true),full_name=safeName(p.fullName,100);
  const phone=text(p,'phone',32).trim();
  let contact_phone='';
  try{contact_phone=phone?normalizePhoneUpdate(phone):'';}catch{throw input();}
  if(p.jerseyNumber!==undefined&&(!Number.isInteger(p.jerseyNumber)||Number(p.jerseyNumber)<0||Number(p.jerseyNumber)>99))throw input();
  return {nickname,full_name,contact_phone,jersey_number:p.jerseyNumber??null};
}
export function emailRedirect(env:EmailEnvironment){
  try{
    const u=new URL(env.emailRedirectUrl??'');
    const local=u.hostname==='localhost'||u.hostname.endsWith('.localhost')||u.hostname==='[::1]'||u.hostname==='[::]'||u.hostname==='0.0.0.0'||/^127\./.test(u.hostname);
    if(u.protocol==='https:'&&!local&&env.origins.includes(u.origin)&&u.pathname==='/auth/callback'&&!u.username&&!u.password&&!u.search&&!u.hash)return u.href;
  }catch{/* fail closed */}
  throw new EmailFlowError(503,'mail_unconfigured','Proces e-mail oczekuje na konfigurację adresu aplikacji i poczty.');
}
export async function emailAction(action:string,body:Row,env:EmailEnvironment,d:EmailDependencies):Promise<Row|null>{
  if(!actions.has(action))return null;
  await d.rate('email-flow',12);
  if(!env.emailSignupEnabled)throw new EmailFlowError(503,'mail_unconfigured','Proces e-mail oczekuje na konfigurację poczty.');
  const redirect=emailRedirect(env);
  if(['signup','resend_verification','recover_email'].includes(action)){
    const email=text(body,'email',254).trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw input();
    await d.rate('email:'+email,5,300);
    const profile=action==='signup'?signupProfile(body):undefined;
    if(action==='signup'&&body.accept_policies!==true)throw input();
    const values=action==='signup'?{email,password:newPassword(body,'password'),data:{slm_signup_profile:profile}}:action==='resend_verification'?{email,type:'signup'}:{email};
    const path=action==='signup'?'/auth/v1/signup':action==='resend_verification'?'/auth/v1/resend':'/auth/v1/recover';
    const r=await d.call(path+'?redirect_to='+encodeURIComponent(redirect),'POST',values);
    // Never expose provider messages or disclose whether this email already exists.
    if(!r.ok){
      if(r.status===429)throw new EmailFlowError(429,'rate_limited','Zbyt wiele prób. Spróbuj ponownie później.');
      if(r.status>=500)throw new EmailFlowError(503,'mail_unavailable','Nie udało się uruchomić procesu e-mail. Spróbuj później.');
      if(!['user_already_exists','email_exists','user_not_found'].includes(String(r.data?.code)))throw new EmailFlowError(503,'mail_unavailable','Nie udało się uruchomić procesu e-mail. Spróbuj później.');
    }
    if(r.data?.access_token){await d.rejectSession(r.data);throw new EmailFlowError(503,'verification_required','Rejestracja wymaga weryfikacji adresu e-mail.');}
    return {verification_required:true};
  }
  const hash=text(body,'token_hash',128);
  if(!/^[A-Za-z0-9_-]{40,128}$/.test(hash))throw invalidLink();
  // Validate the password BEFORE consuming the one-time proof.
  const next=action==='recover_password'?newPassword(body,'new_password'):undefined;
  const r=await d.call('/auth/v1/verify','POST',{type:action==='verify_email'?'signup':'recovery',token_hash:hash});
  if(!r.ok||typeof r.data?.access_token!=='string'){
    if(r.status>=500)throw new EmailFlowError(503,'service_unavailable','Serwer jest chwilowo niedostępny. Spróbuj później.');
    if(r.status===429)throw new EmailFlowError(429,'rate_limited','Zbyt wiele prób. Spróbuj później.');
    throw invalidLink();
  }
  const proof=r.data;
  let verifiedUser:{id:string;sid:string}|null=null;
  try{
    // The user endpoint validates the signature; the client never supplies user_id.
    const user=await d.verify(proof.access_token as string);
    verifiedUser=user;
    const identity=await d.db('rpc/slm_email_identity','POST',{p_user:user.id}) as Row|null;
    if(!identity||identity.user_id!==user.id||identity.email_account!==true)throw invalidLink();
    if(action==='verify_email')return {email_verified:true};
    const before=await d.state(user.id);
    if(!before.active||before.operation_id)throw invalidLink();
    await d.accept(proof,Number(before.security_version));
    const operation=await d.db('rpc/slm_account_begin','POST',{p_actor:user.id,p_session:user.sid,p_target:user.id,p_kind:'password'}) as Row;
    // GoTrue exempts a verified recovery session from current_password, not ordinary JWTs.
    // A network/5xx ambiguity stays fail-closed in the existing pending-operation gate.
    let changed:Reply;
    try{changed=await d.call('/auth/v1/user','PUT',{password:next},proof.access_token as string);}catch{throw pending();}
    if(!changed.ok){
      if(changed.status>=500||changed.status===429)throw pending();
      const cancelled=await d.db('rpc/slm_account_email_recovery_abort','POST',{
        p_user:user.id,p_session:user.sid,p_operation:operation.operation_id,p_version:operation.security_version,p_was_temporary:before.must_change_password,
      });
      if(cancelled!==true)throw pending();
      throw new EmailFlowError(400,'invalid_password','Auth odrzucił nowe hasło. Wybierz inne i poproś o nowy link.');
    }
    const finished=await d.db('rpc/slm_account_finish','POST',{p_user:user.id,p_operation:operation.operation_id,p_session:user.sid,p_actor:user.id});
    if(finished!==true)throw pending();
    // No email/recovery session reaches the browser or survives in application sessions.
    return {password_changed:true};
  }finally{
    if(verifiedUser){
      const u=verifiedUser;
      if(u)await d.db('rpc/slm_account_revoke_session','POST',{p_user:u.id,p_session:u.sid}).catch(()=>undefined);
    }
    await d.rejectSession(proof);
  }
}

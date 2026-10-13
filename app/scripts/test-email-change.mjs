// Jedna próba, bez retry, zmiany konfiguracji i kont innych osób.
import {randomBytes,randomUUID} from 'node:crypto';
import {assertBranch,assertSafeConfig,management,server} from './accounts-admin.mjs';
let api,created;
try {
  assertBranch();
  const before=await management('/config/auth');assertSafeConfig(before);
  if(before.hook_send_email_uri!=='pg-functions://postgres/public/slm_account_block_email') throw new Error();
  console.log(JSON.stringify({time_utc:new Date().toISOString(),email_limit:before.rate_limit_email_sent}));
  api=await server();
  const password=randomBytes(24).toString('base64url')+'Aa7!';
  const email=randomUUID()+'@slm.invalid', target=randomUUID()+'@slm.invalid';
  const user=await api.request('/auth/v1/admin/users','POST',{email,password,email_confirm:true});
  if(!user.ok || !user.data?.id) throw new Error();
  created=user.data.id;
  const login=await api.request('/auth/v1/token?grant_type=password','POST',{email,password},null,false);
  if(!login.ok || !login.data?.access_token) throw new Error();
  const attempt=await api.request('/auth/v1/user','PUT',{email:target},login.data.access_token,false);
  const state=await api.request('/auth/v1/admin/users/'+created);
  const unchanged=state.ok && state.data.email===email && state.data.new_email!==target;
  const hook=!attempt.ok && JSON.stringify(attempt.data).includes('SLM_EMAIL_DISABLED');
  const code=attempt.data?.error_code;
  console.log(JSON.stringify({status:attempt.status,code:typeof code==='string' && /^[a-z_]+$/.test(code)?code:null,hook_blocked:hook,email_unchanged:unchanged}));
  const after=await management('/config/auth');
  for(const key of Object.keys(before)) if(/^(rate_limit_|hook_send_|mailer_notifications_|security_captcha)/.test(key) && JSON.stringify(before[key])!==JSON.stringify(after[key])) throw new Error();
  if(attempt.status===429) console.log('NIEZWERYFIKOWANY: limit 429. Nie ponawiano próby.');
  else if(hook && unchanged) console.log('PASS: hook odmówił wysyłki, adres niezmieniony. Hook nie ma kodu wysyłającego wiadomość.');
  else throw new Error();
} catch {
  console.log('NIEZWERYFIKOWANY: nie potwierdzono całego scenariusza. Bez ponowienia.');process.exitCode=1;
} finally {
  if(created) {
    const deleted=await api.request('/auth/v1/admin/users/'+created,'DELETE').catch(()=>null);
    if(!deleted?.ok) {console.log('FAIL: cleanup fikcyjnego konta wymaga kontroli właściciela.');process.exitCode=1;}
    else console.log('Cleanup: usunięto wyłącznie konto tej próby; nie tworzono profilu ani roli.');
  }
}

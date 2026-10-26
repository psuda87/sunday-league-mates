// Diagnostic only: real local Auth/Edge/PostgREST, no application or schema changes.
// Creates isolated fictional users; never resets a database or uses Cloud.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

assert.equal(execFileSync('git', ['branch','--show-current'], {encoding:'utf8'}).trim(), 'feat/premium-account-identifiers');
const stack = resolve(process.env.SLM_IDENTIFIER_STACK ?? '');
assert(process.env.SLM_IDENTIFIER_STACK && !/[&|<>^"]/u.test(stack), 'Explicit safe local stack path required');
assert(readFileSync(resolve(stack, 'supabase/config.toml'), 'utf8').includes('project_id = "slm-pr16-review"'));
const digest = file => createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
assert.equal(digest(resolve(stack, 'supabase/functions/accounts/handler.ts')), digest(resolve('app/supabase/functions/accounts/handler.ts')), 'Running local Edge source must match audited handler');
const versions = execFileSync('docker', ['exec','supabase_db_slm-pr16-review','psql','-U','postgres','-d','postgres','-Atc','select count(*) from supabase_migrations.schema_migrations'], {encoding:'utf8'}).trim();
assert.equal(versions, '35', 'Expected fully migrated isolated backend');
const host = process.env.DOCKER_HOST ?? execFileSync('docker', ['context','inspect','--format','{{.Endpoints.docker.Host}}'], {encoding:'utf8'}).trim();
assert(/^(npipe|unix):/u.test(host), 'Local Docker only');
const config = JSON.parse(execFileSync('docker', ['inspect','supabase_auth_slm-pr16-review'], {encoding:'utf8'}))[0];
assert.equal(config.Config.Labels['com.supabase.cli.project'], 'slm-pr16-review');
const authEnv = Object.fromEntries(config.Config.Env.map(x => {const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
for(const name of ['GOTRUE_DISABLE_SIGNUP','GOTRUE_HOOK_SEND_EMAIL_ENABLED','GOTRUE_HOOK_SEND_SMS_ENABLED'])assert.equal(authEnv[name], 'true');
const raw = execFileSync('cmd', ['/c','npx','--yes','--package=supabase@2.121.0','supabase','status','--workdir',stack,'-o','json'], {encoding:'utf8',stdio:['ignore','pipe','pipe']});
const keys = JSON.parse(raw.slice(raw.indexOf('{')));
const url = 'http://127.0.0.1:56321';
assert.equal(keys.API_URL, url);assert(keys.ANON_KEY && keys.SERVICE_ROLE_KEY);
let passed = 0, gaps = 0;
const check = (ok, label) => { assert(ok, label); console.log('PASS '+label);passed++; };
const gap = (ok, label) => { assert(ok, 'Diagnostic did not reproduce: '+label);console.log('GAP REPRODUCED '+label);gaps++; };
async function request(path, body, token=keys.SERVICE_ROLE_KEY, key=keys.SERVICE_ROLE_KEY, method='POST') {
 const r=await fetch(url+path, {method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 return {ok:r.ok,status:r.status,data:await r.json().catch(()=>null)};
}
const rpc=(name, body)=>request('/rest/v1/rpc/'+name,body);
const account=(u,action,body={})=>request('/functions/v1/accounts',{...body,action},u?.session?.access_token??keys.ANON_KEY,keys.ANON_KEY);
async function login(identifier,password) {return account(null,'login',{identifier,password});}
async function own(u) {const r=await account(u,'profile');assert(r.ok,'Read own profile');return r.data;}
async function create(legacy) {
 const email=randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url')+'Aa9!';
 const r=await request('/auth/v1/admin/users',{email,password,email_confirm:true});assert(r.ok,'Create diagnostic fictional Auth user');
 const u={id:r.data.id,email,password,login:'Diag_'+randomUUID().slice(0,8),phone:'+48000'+String(Math.floor(Math.random()*999999)+1).padStart(6,'0')};
 if(legacy)assert((await rpc('slm_account_provision',{p_user:u.id,p_login:u.login,p_phone:u.phone,p_email:email,p_admin:false})).ok,'Provision own diagnostic legacy account');
 let s=await login(legacy?u.login:u.email,u.password);assert(s.ok,'Diagnostic login');u.session=s.data;
 if(legacy){const next=randomBytes(24).toString('base64url')+'Ab9!';s=await account(u,'password',{current_password:u.password,new_password:next});assert(s.ok,'Change own temporary password');u.password=next;u.session=s.data;}
 return u;
}
const a=await create(true), b=await create(true), e=await create(false);
for(const [u,name] of [[a,'Public Legacy'],[e,'Public Email']]) {
 const r=await account(u,'save_premium_profile',{nickname:name,first_name:'Given',full_name:'Fictional Player',display_as:'nickname',jersey_number:27,group_scope:[],accept_disclosure:false,request_id:randomUUID()});assert(r.ok,'Prepare fictional PR16 profile');
}
const before=await own(a), other=await own(b), oldSession=a.session;
const oldLogin=a.login; a.login='Changed_'+randomUUID().slice(0,8);
let r=await account(a,'identifiers',{login:a.login,phone:a.phone,current_password:a.password,user_id:b.id,p_user:b.id});
check(r.ok&&r.data.user_id===a.id,'legacy login change; target derived from authenticated session');a.session=r.data;
check((await own(a)).nickname===before.nickname&&(await own(b)).login===other.login,'nickname and other user unchanged');
check((await account({session:oldSession},'profile')).status===401,'previous app session revoked');
check((await login(oldLogin,a.password)).status===401,'old login rejected');
r=await login(a.login,a.password);check(r.ok,'new login accepted');a.session=r.data;
let invalid=await account(a,'identifiers',{login:'12',phone:a.phone,current_password:a.password});check(invalid.status===400&&invalid.data.code==='invalid_login','invalid login format rejected');
invalid=await account(a,'identifiers',{login:a.login,phone:'123',current_password:a.password});check(invalid.status===400&&invalid.data.code==='invalid_phone','invalid phone format rejected');
invalid=await account(a,'identifiers',{login:b.login,phone:a.phone,current_password:a.password});check(invalid.status===409&&invalid.data.code==='identifier_taken','occupied login rejected before mutation');
invalid=await account(a,'identifiers',{login:a.login,phone:a.phone,current_password:'WrongDiagnosticPassword9!'});check(invalid.status===401,'wrong current password rejected');
const oldPhone=a.phone;a.phone='+48000'+String(Math.floor(Math.random()*999999)+1).padStart(6,'0');
r=await account(a,'identifiers',{login:a.login,phone:a.phone,current_password:a.password});check(r.ok,'legacy phone change');a.session=r.data;
check((await login(oldPhone,a.password)).status===401&&(await login(a.phone,a.password)).ok,'old phone rejected; new phone accepted');
check((await own(a)).nickname===before.nickname&&(await own(a)).jersey_number===27,'legacy PR16 nickname and jersey preserved');
r=await account(a,'refresh',{refresh_token:a.session.refresh_token});check(r.ok,'new session refresh after identifiers change');a.session=r.data;
const direct=await request('/rest/v1/slm_aliases?user_id=eq.'+b.id,undefined,a.session.access_token,keys.ANON_KEY,'GET');check(!direct.ok||direct.data.length===0,'RLS denies reading another account aliases');
const forbidden=await request('/rest/v1/rpc/slm_account_finish',{p_user:b.id,p_operation:randomUUID()},a.session.access_token,keys.ANON_KEY);check(!forbidden.ok,'authenticated user cannot call privileged finish RPC');
const ep=await own(e);
r=await account(e,'identifiers',{login:'EmailAlias_'+randomUUID().slice(0,8),phone:'+48000000111',current_password:e.password});
gap(r.status===400&&r.data.code==='legacy_only','e-mail accounts have no editable login alias');
const contact='+48000'+String(Math.floor(Math.random()*999999)+1).padStart(6,'0');
r=await account(e,'save_email_profile',{nickname:ep.nickname,phone:contact,current_password:e.password});check(r.ok,'existing email contact endpoint accepts current password');
const after=await own(e);check(after.jersey_number===ep.jersey_number,'B2.2 migration preserves jersey on email contact save');
check(after.nickname===ep.nickname&&(await login(e.email,e.password)).ok,'email Auth identifier and explicit nickname retained');
check(!(await login(contact,e.password)).ok,'email contact is not a phone login alias');
// Deterministic interleaving of real RPC transactions used by Edge after preflight:
// both requests see the free login, both commit begin, only one can commit finish.
const contested='Race_'+randomUUID().slice(0,8);
const sid=u=>JSON.parse(Buffer.from(u.session.access_token.split('.')[1],'base64url')).session_id;
const operations=await Promise.all([a,b].map(u=>rpc('slm_account_begin',{p_actor:u.id,p_session:sid(u),p_target:u.id,p_kind:'identifiers'})));
assert(operations.every(x=>x.ok),'Diagnostic begin transactions');
for(const [i,u] of [a,b].entries()) {
 const auth=await request('/auth/v1/token?grant_type=password',{email:u.email,password:u.password},keys.ANON_KEY,keys.ANON_KEY);assert(auth.ok,'Fresh real Auth session');u.session=auth.data;
 const finish=await rpc('slm_account_finish',{p_user:u.id,p_operation:operations[i].data.operation_id,p_session:sid(u),p_login:contested,p_phone:u.phone,p_actor:u.id});
 if(i===0)check(finish.ok&&finish.data===true,'first concurrent claimant commits');
 else {gap(!finish.ok&&finish.data.code==='23505','second claimant fails unique constraint after committed begin');
  const sec=await request('/rest/v1/slm_account_security?user_id=eq.'+u.id,undefined,undefined,undefined,'GET');
  gap(sec.ok&&sec.data[0].operation_id===operations[i].data.operation_id,'failed collision leaves account operation_pending');
  gap(!(await login(u.login,u.password)).ok,'losing account cannot log in after collision');}
}
console.log('RESULT '+JSON.stringify({passed,gaps,featureReady:false,scope:'isolated fictional users retained; no schema/reset/Cloud changes'}));

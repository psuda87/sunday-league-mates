// Real Supabase test. New isolated project ONLY; retains all synthetic accounts.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'feat/account-model-foundation');
const host=process.env.DOCKER_HOST??execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();assert(/^(npipe|unix):/.test(host));
const emailRegression=process.env.SLM_ACCOUNT_EMAIL_REGRESSION==='1',stack=emailRegression?'.cache/account-email-regression':'.cache/account-model-stack',project=emailRegression?'slm-email-regression':'slm-account-candidate';
let raw;try{raw=execFileSync('cmd',['/c','npx','--yes','--package=supabase@2.121.0','supabase','status','--workdir',stack,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch{throw Error('Local stack status unavailable; captured keys are never logged');}
const keys=JSON.parse(raw.slice(raw.indexOf('{'))),url=emailRegression?'http://127.0.0.1:61321':'http://127.0.0.1:58321';assert.equal(keys.API_URL,url);assert(keys.SERVICE_ROLE_KEY&&keys.ANON_KEY);
const config=JSON.parse(execFileSync('docker',['inspect','supabase_auth_'+project],{encoding:'utf8'}))[0];assert.equal(config.Config.Labels['com.supabase.cli.project'],project);
const env=Object.fromEntries(config.Config.Env.map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];}));for(const k of ['GOTRUE_DISABLE_SIGNUP','GOTRUE_HOOK_SEND_EMAIL_ENABLED','GOTRUE_HOOK_SEND_SMS_ENABLED','GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD'])assert.equal(env[k],'true');
let count=0;const check=(value,label)=>{assert(value,label);console.log('PASS '+label);count++;};
async function request(path,body,token=keys.SERVICE_ROLE_KEY,key=keys.SERVICE_ROLE_KEY,method='POST'){
 const r=await fetch(url+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 return{ok:r.ok,status:r.status,data:await r.json().catch(()=>null)};
}
const account=(u,action,body={})=>request('/functions/v1/accounts',{...body,action},u?.session?.access_token??keys.ANON_KEY,keys.ANON_KEY);
async function yes(u,action,body={}){const r=await account(u,action,body);assert(r.ok,'API '+action+' '+r.status+' '+String(r.data?.code??''));return r.data;}
const rpc=(name,body={})=>request('/rest/v1/rpc/'+name,body);
const own=u=>yes(u,'profile');


async function fixture(admin){
 const idSuffix=randomUUID().slice(0,8),email=randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url')+'Aa9!',nickname='Recovery_'+idSuffix;
 const r=await request('/auth/v1/admin/users',{email,password,email_confirm:true});assert(r.ok,'Own isolated recovery fixture');const id=r.data.id;
 for(const [table,value] of [['slm_profiles',{user_id:id}],['slm_roles',{user_id:id,role:admin?'admin':'member'}],['slm_account_security',{user_id:id,must_change_password:false}],['slm_player_profiles',{user_id:id,nickname,email_account:false}],['slm_identity_registry',{user_id:id,nickname_key:nickname.toLowerCase(),auth_email:email}]])assert((await request('/rest/v1/'+table,value)).ok,'Own fixture '+table);
 const session=await yes(null,'login',{identifier:nickname,password});return{id,nickname,password,session};
}
const admin=await fixture(true),target=await fixture(false);
const sid=JSON.parse(Buffer.from(target.session.access_token.split('.')[1],'base64url')).session_id;
const begun=await rpc('slm_account_begin',{p_actor:target.id,p_session:sid,p_target:target.id,p_kind:'password'});assert(begun.ok,'Only own synthetic target operation');
const pending=await account(admin,'reset_password',{user_id:target.id,confirm_identity:true,reason:'Independent local fixture identity check',current_password:admin.password});
check(pending.status===409,'public admin reset cannot bypass an in-progress security operation');
const early=await rpc('slm_account_prepare_recovery',{p_user:target.id,p_expected_operation:begun.data.operation_id});check(!early.ok,'owner recovery respects ten minute safety interval');
const privateAttempt=await request('/rest/v1/rpc/slm_account_prepare_recovery',{p_user:target.id,p_expected_operation:begun.data.operation_id},admin.session.access_token,keys.ANON_KEY);check(!privateAttempt.ok,'application admin cannot invoke service-only owner recovery');
check((await account(target,'profile')).status===401,'pending account remains fail-closed');
assert(/^[0-9a-f-]{36}$/.test(target.id));assert(/^[0-9a-f-]{36}$/.test(begun.data.operation_id));
// Time ageing is simulated ONLY on our new isolated target, never on existing accounts.
execFileSync('docker',['exec','supabase_db_'+project,'psql','-X','-At','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',`update public.slm_account_security set operation_started_at=now()-interval '11 minutes' where user_id='${target.id}'::uuid and operation_id='${begun.data.operation_id}'::uuid`],{stdio:['ignore','pipe','pipe']});
const recovery=await rpc('slm_account_prepare_recovery',{p_user:target.id,p_expected_operation:begun.data.operation_id});check(recovery.ok,'existing owner repair can prepare aged synthetic operation');
const temporary=randomBytes(9).toString('base64url');
assert((await request('/auth/v1/admin/users/'+target.id,{password:temporary},undefined,undefined,'PUT')).ok);
assert((await rpc('slm_account_finish',{p_user:target.id,p_operation:recovery.data,p_actor:admin.id})).ok);
target.session=await yes(null,'login',{identifier:target.nickname,password:temporary});check(target.session.must_change_password&&(await account(target,'profile')).status===403,'owner repair gives temporary password gate, not protected data');
const fresh=randomBytes(24).toString('base64url')+'Ab9!';target.session=await yes(target,'password',{current_password:temporary,new_password:fresh});check((await own(target)).user_id===target.id,'mandatory password change restores same UUID after interrupted operation');
console.log('ACCOUNT MODEL RECOVERY '+count+' PASS; only new fictional accounts; aged interval simulated; retained all users.');

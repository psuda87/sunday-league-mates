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
assert((await request('/rest/v1/slm_profiles?user_id=eq.'+target.id,{full_name:'KeepThisSurnamePrivate',first_name:'KeepThisFirstPrivate'},undefined,undefined,'PATCH')).ok);
const rows=await yes(admin,'list_accounts');const entry=rows.find(x=>x.user_id===target.id);check(!!entry,'authorized account administrator can identify target UUID');
check(entry.full_name===''&&entry.phone===''&&!('group_scope' in entry)&&!JSON.stringify(rows).includes('KeepThisSurnamePrivate'),'administrative DTO exposes no raw surname, contact or group scope');
const denied=await account(target,'list_accounts');check(denied.status===403,'ordinary user cannot enumerate accounts');
console.log('ACCOUNT MODEL ADMIN PRIVACY '+count+' PASS; fictional fixtures retained.');

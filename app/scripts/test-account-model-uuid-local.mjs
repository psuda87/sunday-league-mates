// Real Supabase test. New isolated project ONLY; retains all synthetic accounts.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'feat/account-model-foundation');
const host=process.env.DOCKER_HOST??execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();assert(/^(npipe|unix):/.test(host));
let raw;try{raw=execFileSync('cmd',['/c','npx','--yes','--package=supabase@2.121.0','supabase','status','--workdir','.cache/account-model-stack','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch{throw Error('Local stack status unavailable; captured keys are never logged');}
const keys=JSON.parse(raw.slice(raw.indexOf('{'))),url='http://127.0.0.1:58321';assert.equal(keys.API_URL,url);assert(keys.SERVICE_ROLE_KEY&&keys.ANON_KEY);
const config=JSON.parse(execFileSync('docker',['inspect','supabase_auth_slm-account-candidate'],{encoding:'utf8'}))[0];assert.equal(config.Config.Labels['com.supabase.cli.project'],'slm-account-candidate');
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


const nickname='Reuse_'+randomUUID().slice(0,8),password=randomBytes(24).toString('base64url')+'Aa9!';
const first={nickname,password,email:'',phone:'',full_name:'',request_id:randomUUID(),request_secret:randomBytes(32).toString('hex')};
let r=await account(null,'model_signup',first);assert(r.ok,'Own registration fixture');const originalId=r.data.user_id;
const u={session:await yes(null,'login',{identifier:nickname,password})};const p=await own(u),newName='Moved_'+randomUUID().slice(0,8);
await yes(u,'model_profile',{nickname:newName,expected_nickname:p.nickname,first_name:p.first_name,full_name:p.full_name,display_as:p.display_as,jersey_number:p.jersey_number,group_scope:[],accept_disclosure:false,contact_phone:'',request_id:randomUUID(),current_password:password});
r=await account(null,'model_signup',{...first,request_id:randomUUID(),request_secret:randomBytes(32).toString('hex')});check(r.ok&&r.data.user_id!==originalId,'completed job does not silently reserve a retired nickname forever');
const second=await yes(null,'login',{identifier:nickname,password});check(second.user_id!==originalId,'reused nickname really identifies a different local fixture');
r=await account(null,'model_signup',first);check(r.ok&&r.data.user_id===originalId&&r.data.nickname===newName,'registration retry returns original UUID and current canonical nickname');
const resumed=await yes(null,'login',{identifier:r.data.nickname,password});check(resumed.user_id===originalId,'resumed registration cannot silently sign in to nickname reuser');
console.log('ACCOUNT MODEL UUID RETRY '+count+' PASS; retained all fictional users.');

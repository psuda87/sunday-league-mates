// Real Supabase test. New isolated project ONLY; retains all synthetic accounts.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
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


const nickname='Resume_'+randomUUID().slice(0,8),requestId=randomUUID(),secret=randomBytes(32).toString('hex');
const hash=createHash('sha256').update(secret).digest('hex'),password=randomBytes(24).toString('base64url')+'Aa9!';
const job=await rpc('slm_model_signup_begin',{p_request:requestId,p_secret_hash:hash,p_nickname:nickname,p_phone:'',p_full_name:''});assert(job.ok,'Reserve only our interrupted fixture');
const created=await request('/auth/v1/admin/users',{email:job.data.auth_email,password,email_confirm:true,app_metadata:{slm_signup_request:requestId}});assert(created.ok,'Create only our internal Auth fixture');
// Simulates process death between Auth creation and application SQL commit.
let rows=await request('/rest/v1/slm_account_security?user_id=eq.'+created.data.id,undefined,undefined,undefined,'GET');check(rows.ok&&rows.data.length===0,'interrupted signup has no active application security row');
const denied=await account(null,'login',{identifier:nickname,password:'WrongTemporaryTest9!'});check(denied.status===401,'wrong password cannot complete someone else signup; HTTP '+denied.status+' code '+String(denied.data?.code??''));
rows=await request('/rest/v1/slm_account_security?user_id=eq.'+created.data.id,undefined,undefined,undefined,'GET');check(rows.data.length===0,'failed proof creates no account state');
const response=await account(null,'login',{identifier:nickname,password});check(response.ok&&response.data.user_id===created.data.id,'nickname/password resumes interrupted signup with identical UUID');
const user={session:response.data};check((await own(user)).group_scope.length===0,'resume grants no foreign group access');
const repeat=await account(null,'login',{identifier:nickname,password});check(repeat.ok&&repeat.data.user_id===created.data.id,'subsequent login remains bound to same completed account');
const jobs=await request('/rest/v1/slm_signup_jobs?request_id=eq.'+requestId,undefined,undefined,undefined,'GET');check(jobs.data.length===1&&jobs.data[0].completed_user===created.data.id,'single registration job completed exactly once');
console.log('ACCOUNT MODEL RESUME '+count+' PASS; intermediate crash simulated on own fixture; retained all users.');

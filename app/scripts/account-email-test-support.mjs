// Real Supabase test. New isolated project ONLY; retains all synthetic accounts.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'feat/account-model-foundation');
const host=process.env.DOCKER_HOST??execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();assert(/^(npipe|unix):/.test(host));
let raw;try{raw=execFileSync('cmd',['/c','npx','--yes','--package=supabase@2.121.0','supabase','status','--workdir','.cache/account-email-stack','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch{throw Error('Local stack status unavailable; captured keys are never logged');}
const keys=JSON.parse(raw.slice(raw.indexOf('{'))),url='http://127.0.0.1:60321';assert.equal(keys.API_URL,url);assert(keys.SERVICE_ROLE_KEY&&keys.ANON_KEY);
const config=JSON.parse(execFileSync('docker',['inspect','supabase_auth_slm-account-mail'],{encoding:'utf8'}))[0];assert.equal(config.Config.Labels['com.supabase.cli.project'],'slm-account-mail');
const env=Object.fromEntries(config.Config.Env.map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];}));for(const k of ['GOTRUE_DISABLE_SIGNUP','GOTRUE_HOOK_SEND_EMAIL_ENABLED','GOTRUE_HOOK_SEND_SMS_ENABLED','GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD'])assert.equal(env[k],'true');
export let count=0;const check=(value,label)=>{assert(value,label);console.log('PASS '+label);count++;};
async function request(path,body,token=keys.SERVICE_ROLE_KEY,key=keys.SERVICE_ROLE_KEY,method='POST'){
 const r=await fetch(url+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 return{ok:r.ok,status:r.status,data:await r.json().catch(()=>null)};
}
const account=(u,action,body={})=>request('/functions/v1/accounts',{...body,action},u?.session?.access_token??keys.ANON_KEY,keys.ANON_KEY);
async function yes(u,action,body={}){const r=await account(u,action,body);assert(r.ok,'API '+action+' '+r.status+' '+String(r.data?.code??''));return r.data;}
const rpc=(name,body={})=>request('/rest/v1/rpc/'+name,body);
const own=u=>yes(u,'profile');



const tag=randomUUID().slice(0,8),password=()=>randomBytes(24).toString('base64url')+'Aa9!',addr=s=>s+'-'+tag+'@slm-mail.test';
async function mail(to,seen=new Set()){
 for(let n=0;n<80;n++){
  const response=await fetch('http://127.0.0.1:60324/api/v1/messages'),data=await response.json();
  const message=data.messages?.find(x=>!seen.has(x.ID)&&x.To?.some(y=>y.Address===to));
  if(message){const msg=await(await fetch('http://127.0.0.1:60324/api/v1/message/'+message.ID)).json();const link=msg.Text?.match(/http:\/\/127\.0\.0\.1:5182\/email-callback\.html#[^\s]+/)?.[0];assert(link,'Scoped callback URL required');return{id:message.ID,link,msg};}
  await new Promise(r=>setTimeout(r,250));
 }
 throw Error('Local SMTP message not received; no content/token logged');
}
const proof=link=>{const q=new URLSearchParams(new URL(link).hash.slice(1));return{id:q.get('id'),token:q.get('token')};};
async function browser(link,kind,pw){const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const r=spawnSync(process.execPath,['app/scripts/email-browser-local.mjs'],{cwd:process.cwd(),input:JSON.stringify({link,kind,password:pw}),env,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});const line=r.stdout?.split(/\r?\n/).findLast(x=>x.startsWith('EMAIL_BROWSER_RESULT '));assert(line,'Sanitized browser result missing');const result=JSON.parse(line.slice(21));assert(result.failed===0&&result.passed===1,'Email browser callback failed: '+JSON.stringify(result.errors));}
async function signup(n,email=''){
 const body={nickname:n,password:password(),email,phone:'',full_name:'',request_id:randomUUID(),request_secret:randomBytes(32).toString('hex')};
 const r=await account(null,'model_signup',body);assert(r.ok,'Email signup HTTP '+r.status+' '+String(r.data?.code??''));const u={id:r.data.user_id,nickname:n,password:body.password};u.session=await yes(null,'login',{identifier:n,password:u.password});return u;
}

export {own,check,signup,mail,proof,yes,account,rpc,request,keys,addr,password,tag,browser};

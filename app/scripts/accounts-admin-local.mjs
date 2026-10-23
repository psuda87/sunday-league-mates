// LOCAL ONLY. No PAT, production env or remote Management API.
import { execFileSync } from 'node:child_process';
export const url='http://127.0.0.1:54321';
const localDocker=process.env.DOCKER_HOST??execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
if(!localDocker.startsWith('npipe://')&&!localDocker.startsWith('unix://'))throw Error('Local Docker socket required');
let output; try { output=execFileSync(process.platform==='win32'?'cmd':'npx',process.platform==='win32'?['/c','npx','--yes','--package=supabase@2.121.0','supabase','status','-o','json']:['--yes','--package=supabase@2.121.0','supabase','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}); } catch { throw new Error('BLOCKED: local Supabase status unavailable; no keys logged'); }
const keys=JSON.parse(output.slice(output.indexOf('{')));
if(keys.API_URL!==url)throw Error('Only exact local API URL is allowed');
export function assertBranch(){if(!['feat/integration','feat/premium318-live'].includes(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim()))throw Error('Requires feat/integration');}
export async function management(path){
 if(path!=='/config/auth')throw Error('No Management API allowed');
 const c=JSON.parse(execFileSync('docker',['inspect','supabase_auth_sunday-league-mates'],{encoding:'utf8'}))[0];
 const e=Object.fromEntries(c.Config.Env.map(v=>{const p=v.indexOf('=');return [v.slice(0,p),v.slice(p+1)]}));
 return {disable_signup:e.GOTRUE_DISABLE_SIGNUP==='true',email_hook:e.GOTRUE_HOOK_SEND_EMAIL_URI,sms_hook:e.GOTRUE_HOOK_SEND_SMS_URI,email_hook_enabled:e.GOTRUE_HOOK_SEND_EMAIL_ENABLED==='true',sms_hook_enabled:e.GOTRUE_HOOK_SEND_SMS_ENABLED==='true',current_password:e.GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD==='true',nonce:e.GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION==='true',autoconfirm:e.GOTRUE_MAILER_AUTOCONFIRM==='true'};
}
export function assertSafeConfig(c){if(!c.disable_signup||!c.email_hook_enabled||!c.sms_hook_enabled||!c.current_password||c.nonce||c.autoconfirm||c.email_hook!=='pg-functions://postgres/public/slm_account_block_email'||c.sms_hook!=='pg-functions://postgres/public/slm_account_block_sms')throw Error('Unsafe local Auth configuration');}
export async function server(){return {request:async(path,method='GET',body,token=null,privileged=true)=>{
 const key=privileged?keys.SERVICE_ROLE_KEY:keys.ANON_KEY;
 const r=await fetch(url+path,{method,headers:{apikey:key,Authorization:'Bearer '+(token??key),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 return {ok:r.ok,status:r.status,data:await r.json().catch(()=>null)};
}};}

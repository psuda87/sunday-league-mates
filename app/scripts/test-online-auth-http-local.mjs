// Real local Edge/Auth/PostgREST/Storage with a FIXTURE Turnstile provider only.
// This proves API enforcement; it does NOT prove live Cloudflare bot detection.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID,randomBytes} from 'node:crypto';
import {proxySignature,canonicalIp} from '../supabase/functions/_shared/proxyProof.ts';
import {request,keys,project,check,count,password,tag} from './account-email-test-support.mjs';
assert.equal(project,'slm-online-readiness');
const secret=readFileSync('.cache/readiness-proxy-secret','utf8').trim(),base='http://127.0.0.1:62321';
const net='2001:db8:'+tag.slice(0,4)+':',ips={first:net+'1::1',race:net+'2::1',other:net+'3::1',independent:net+'4::1',mail:net+'5::1',mailOther:net+'6::1'};
async function invoke(action,values={},session,ip=ips.first,extra={}){
 ip=canonicalIp(ip);assert(ip);
 const body={...values,action},time=String(Date.now()),authorization=session?'Bearer '+session.access_token:'';
 const headers={'Content-Type':'application/json','x-slm-client-ip':ip,'x-slm-proxy-time':time,'x-slm-proxy-signature':await proxySignature(secret,ip,time,body,authorization),...(authorization?{Authorization:authorization}:{}),...extra};
 const r=await fetch(base+'/functions/v1/accounts'+(action==='profile_photo_upload'?'?photo=upload':''),{method:'POST',headers,body:JSON.stringify(body)});return {ok:r.ok,status:r.status,data:await r.json()};
}
const yes=async(action,values={},session,ip)=>{const r=await invoke(action,values,session,ip);assert(r.ok,'Protected API '+action+' '+r.status+' '+String(r.data?.code??''));return r.data;};
const draft=(n)=>{const id=randomUUID();return {nickname:'Protected_'+tag+'_'+n,password:password(),email:'',phone:'',full_name:'',request_id:id,request_secret:randomBytes(32).toString('hex'),challenge_token:'fixture:'+id};};
// Wait for hot-reload readiness only; never retry a mutating request or accept unprotected200.
let ready=false;for(let n=0;n<80;n++){const probe=await fetch(base+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'account_capabilities'})});if(probe.status===403){ready=true;break;}assert([502,503].includes(probe.status),'Unexpected unprotected ingress during startup');await new Promise(r=>setTimeout(r,250));}assert(ready,'Protected Edge startup');
const before=(await request('/auth/v1/admin/users?per_page=1000',undefined,undefined,undefined,'GET')).data.users.length;
const unsigned=await request('/functions/v1/accounts',{action:'model_signup',...draft('unsigned')},keys.ANON_KEY,keys.ANON_KEY);
check(unsigned.status===403,'direct unsigned Edge call cannot bypass gateway');
check((await invoke('model_signup',draft('bad-signature'),undefined,ips.first,{'x-slm-proxy-signature':'a'.repeat(64)})).status===403,'forged signed-IP proof is rejected');
const absent=draft('no-challenge');delete absent.challenge_token;check((await invoke('model_signup',absent)).status===403,'direct API requires challenge token, not just UI');
check((await invoke('model_signup',{...draft('bad-challenge'),challenge_token:'forged'})).status===403,'provider rejects forged challenge before account creation');
const wrongBinding=draft('wrong-binding');wrongBinding.challenge_token='fixture:'+randomUUID();check((await invoke('model_signup',wrongBinding)).status===403,'challenge proof is bound to request UUID');
check((await request('/auth/v1/admin/users?per_page=1000',undefined,undefined,undefined,'GET')).data.users.length===before,'all denied attempts preserve Auth user count');
const first=draft('first'),created=await yes('model_signup',first);check(created.registered,'valid signed fixture proof reaches real Auth provisioning');
const retry=await yes('model_signup',first);check(retry.user_id===created.user_id,'same request and capability retry never duplicates user');
check((await invoke('model_signup',{...first,request_secret:randomBytes(32).toString('hex')})).status===409,'another capability cannot reuse accepted request UUID');
const session=await yes('login',{identifier:first.nickname,password:first.password});check(session.user_id===created.user_id,'protected registration logs in with original UUID');
const attempts=[];for(let i=0;i<6;i++)attempts.push(draft('race'+i));const race=await Promise.all(attempts.map(d=>invoke('model_signup',d,undefined,ips.race)));
check(race.filter(x=>x.ok).length===5&&race.filter(x=>x.status===429).length===1,'parallel admission enforces5 slots atomically for one subject');
check((await invoke('model_signup',draft('independent'),undefined,ips.independent)).ok,'one exhausted subject does not exhaust all registration');
const forgedRole=draft('role');check((await invoke('model_signup',{...forgedRole,role:'admin'})).status===400,'caller cannot add administrator fields during signup');
check((await invoke('reset_password',{user_id:created.user_id,confirm_identity:true,reason:'fixture',current_password:first.password},session)).status===403,'ordinary member cannot impersonate account administrator');
const otherDraft=draft('other'),otherCreated=await yes('model_signup',otherDraft,undefined,ips.other),other=await yes('login',{identifier:otherDraft.nickname,password:otherDraft.password},undefined,ips.other);
const group=await yes('groups_create',{name:'API privacy A '+tag,description:'Synthetic only',request_id:randomUUID()},session);
check(!(await invoke('groups_detail',{group_id:group.group_id},other,ips.other)).ok,'outsider cannot read another group membership details');
check((await invoke('groups_permission',{group_id:group.group_id,user_id:otherCreated.user_id,organizer:true,request_id:randomUUID()},other,ips.other)).status===403,'outsider cannot grant own organizer permissions');
const event=await yes('matches_create',{group_id:group.group_id,name:'Synthetic secured API match',visibility:'private',date:'2099-10-27',time:'19:00',location:'Synthetic pitch',duration_minutes:90,capacity:10,cost_cents:27000,request_id:randomUUID()},session);
check(!(await invoke('matches_join',{event_id:event.event_id,request_id:randomUUID(),member_id:created.user_id},other,ips.other)).ok,'outsider cannot forge another player registration');
check(!(await invoke('group_finance_record_payment',{group_id:group.group_id,user_id:otherCreated.user_id,amount_cents:27000,reason:'Forged fixture payment',request_id:randomUUID()},other,ips.other)).ok,'outsider cannot forge a financial result');
check(!(await invoke('groups_decide',{id:randomUUID(),accept:true,request_id:randomUUID()},other,ips.other)).ok,'invented invitation cannot grant membership');
check(!(await invoke('ratings_submit',{user_id:created.user_id,rating:10},other,ips.other)).ok,'unimplemented rating write cannot be forged as supported API');
const image='data:image/webp;base64,'+JSON.parse(readFileSync('app/supabase/functions/fixtures/webp.json','utf8')).base64;
const photo=await yes('profile_photo_upload',{image_data_url:image,expected_revision:null},session);check(photo.image_data_url===image&&!!photo.revision,'real private Storage upload works behind signed gateway proof');
const read=await yes('profile_photo_get',{},session);check(read.revision===photo.revision,'owner reads the real stored photo');
check((await invoke('profile_photo_get',{user_id:created.user_id},other,ips.other)).status===400,'photo API rejects injected foreign owner');
const meta=await request('/rest/v1/slm_profile_photos?select=*',undefined,other.access_token,keys.ANON_KEY,'GET');check(!meta.ok||meta.data.length===0,'RLS keeps private photo metadata inaccessible');
const raw=await request('/rest/v1/slm_profiles?user_id=eq.'+created.user_id,undefined,other.access_token,keys.ANON_KEY,'GET');check(!raw.ok||raw.data.length===0,'cross-group profile read via direct REST denied');
const rpc=await request('/rest/v1/rpc/slm_signup_admit',{p_request:randomUUID(),p_capability:'a'.repeat(64),p_subject:'b'.repeat(64)},other.access_token,keys.ANON_KEY);check(!rpc.ok,'client cannot invoke private admission RPC directly');
const nativeSignup=await request('/auth/v1/signup',{email:randomUUID()+'@slm.test',password:password()},keys.ANON_KEY,keys.ANON_KEY);check(!nativeSignup.ok,'native GoTrue signup cannot bypass protected application signup');
const requests=await Promise.all(Array.from({length:21},(_,i)=>invoke('model_recovery_request',{email:'unknown-'+tag+'-'+i+'@slm-mail.test'},undefined,ips.mail)));check(requests.filter(r=>r.ok).length===20&&requests.filter(r=>r.status===429).length===1,'one signed network cannot exhaust all daily SMTP capacity');check((await invoke('model_recovery_request',{email:'unknown-independent-'+tag+'@slm-mail.test'},undefined,ips.mailOther)).ok,'exhausted mail network does not block a different network');
console.log('ONLINE API '+count+' PASS; real Auth/Edge/Storage; Turnstile provider FIXTURE; synthetic records retained.');

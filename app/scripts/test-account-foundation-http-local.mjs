// Real Supabase test. New isolated project ONLY; retains all synthetic accounts.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'feat/account-model-foundation');
const host=process.env.DOCKER_HOST??execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();assert(/^(npipe|unix):/.test(host));
let raw;try{raw=execFileSync('cmd',['/c','npx','--yes','--package=supabase@2.121.0','supabase','status','--workdir','.cache/account-foundation-stack','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch{throw Error('Local stack status unavailable; captured keys are never logged');}
const keys=JSON.parse(raw.slice(raw.indexOf('{'))),url='http://127.0.0.1:57321';assert.equal(keys.API_URL,url);assert(keys.SERVICE_ROLE_KEY&&keys.ANON_KEY);
const config=JSON.parse(execFileSync('docker',['inspect','supabase_auth_slm-account-foundation'],{encoding:'utf8'}))[0];assert.equal(config.Config.Labels['com.supabase.cli.project'],'slm-account-foundation');
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
async function create(legacy){
 const u={email:randomUUID()+'@fixture.invalid',password:randomBytes(24).toString('base64url')+'Aa9!',login:'Old_'+randomUUID().slice(0,8),phone:'+48000'+String(Math.floor(Math.random()*999999)+1).padStart(6,'0')};
 const r=await request('/auth/v1/admin/users',{email:u.email,password:u.password,email_confirm:true});assert(r.ok,'Create isolated diagnostic user');u.id=r.data.id;
 if(legacy)assert((await rpc('slm_account_provision',{p_user:u.id,p_login:u.login,p_phone:u.phone,p_email:u.email,p_admin:false})).ok,'Provision legacy fixture');
 u.session=await yes(null,'login',{identifier:legacy?u.login:u.email,password:u.password});
 if(legacy){const next=randomBytes(24).toString('base64url')+'Ab9!';u.session=await yes(u,'password',{current_password:u.password,new_password:next});u.password=next;}
 return u;
}
const a=await create(true),b=await create(true),e=await create(false),tag=randomUUID().slice(0,8);
async function save(u,nickname){const p=await own(u);return yes(u,'save_premium_profile',{nickname,first_name:'Given',full_name:'Given Surname',display_as:'nickname',jersey_number:27,group_scope:p.group_scope.map(g=>g.group_id).sort(),accept_disclosure:false,request_id:randomUUID()});}
await save(a,'Dupe_'+tag);await save(b,'dupe_'+tag);await save(e,'Email_'+tag);
const initial=await request('/rest/v1/slm_identity_registry?select=user_id',undefined,undefined,undefined,'GET');
const collision=await rpc('slm_identity_prepare');check(!collision.ok&&collision.data.code==='23505','prepare rejects duplicate normalized names');
const unchanged=await request('/rest/v1/slm_identity_registry?select=user_id',undefined,undefined,undefined,'GET');check(unchanged.data.length===initial.data.length,'failed preparation adds no registry rows or renames');
await save(b,'Base_'+tag);
const unprepared=await account(b,'foundation_rename',{nickname:'Before_'+tag,expected_nickname:'Base_'+tag,current_password:b.password,request_id:randomUUID()});check(unprepared.status===409&&unprepared.data.code==='identity_not_prepared','rename fails closed before preparation');
const prep=await rpc('slm_identity_prepare');check(prep.ok,'explicit preparation preserves existing UUIDs');
const registry=await request('/rest/v1/slm_identity_registry?user_id=in.('+[a.id,b.id,e.id].join(',')+')',undefined,undefined,undefined,'GET');
check(registry.data.length===3&&registry.data.find(x=>x.user_id===a.id).email_login===null&&registry.data.find(x=>x.user_id===e.id).email_login===e.email,'legacy internal address separated from confirmed email alias');
const group=await yes(b,'groups_create',{name:'Foundation '+tag,request_id:randomUUID()});
for(const u of [a,e]){await yes(b,'groups_invite',{...group,user_id:u.id,request_id:randomUUID()});const inbox=await yes(u,'groups_inbox');const invite=inbox.requests.find(r=>r.group_id===group.group_id&&r.state==='pending');assert(invite);await yes(u,'groups_decide',{id:invite.id,accept:true,request_id:randomUUID()});}
await yes(a,'groups_consent',{...group,share_full_name:true,request_id:randomUUID()});
const beforeA=await own(a),beforeE=await own(e),rename=(u,nickname,expected_nickname,request_id=randomUUID(),current_password=u.password)=>account(u,'foundation_rename',{nickname,expected_nickname,request_id,current_password});
const id=randomUUID(),newName='Nowy_'+tag;
let r=await rename(a,newName,beforeA.nickname,id);check(r.ok,'rename with current password and active legacy session');
r=await rename(a,newName,beforeA.nickname,id);check(r.ok,'lost-response retry is idempotent');
r=await rename(a,'Other_'+tag,beforeA.nickname,id);check(r.status===409&&r.data.code==='idempotency_conflict','request id cannot select different nickname');
r=await rename(a,'Other_'+tag,beforeA.nickname);check(r.status===409&&r.data.code==='stale_identity','concurrent stale owner write rejected');
const badBefore=await own(b);r=await rename(b,'Wrong_'+tag,badBefore.nickname,randomUUID(),'WrongPasswordOnlyTest9!');check(r.status===401&&(await own(b)).nickname===badBefore.nickname,'wrong password preserves nickname and active session');
r=await rename(e,'MailNew_'+tag,beforeE.nickname);check(r.ok,'email account can rename with its current password and session');
const currentE=await own(e);
const ownerRace=await Promise.all([rename(b,'OwnerA_'+tag,badBefore.nickname),rename(b,'OwnerB_'+tag,badBefore.nickname)]);
check(ownerRace.filter(x=>x.ok).length===1&&ownerRace.filter(x=>x.status===409&&x.data.code==='stale_identity').length===1,'concurrent writes for one owner have one winner and no lost update');
const expectedB=(await own(b)).nickname;
const race='Race_'+tag;const afterA=await own(a);
const results=await Promise.all([rename(a,race,afterA.nickname),rename(e,race.toLowerCase(),currentE.nickname)]);
check(results.filter(x=>x.ok).length===1&&results.filter(x=>x.status===409&&x.data.code==='nickname_taken').length===1,'real concurrent HTTP normalized-name race has exactly one winner');
for(const [u,before] of [[a,beforeA],[e,beforeE]]){
 const p=await own(u);check(p.user_id===before.user_id&&p.jersey_number===before.jersey_number&&p.full_name===before.full_name&&p.first_name===before.first_name&&p.display_as===before.display_as&&JSON.stringify(p.group_scope)===JSON.stringify(before.group_scope),'rename/race preserves profile, number, groups and per-group consents');
 const fresh=await account(null,'refresh',{refresh_token:u.session.refresh_token});check(fresh.ok&&fresh.data.user_id===u.id,'both winner and loser retain valid refresh session');u.session=fresh.data;
}
const states=await request('/rest/v1/slm_account_security?user_id=in.('+[a.id,b.id,e.id].join(',')+')',undefined,undefined,undefined,'GET');check(states.ok&&states.data.every(x=>x.operation_id===null),'no account is operation_pending after success or conflicts');
const number=await account(a,'save_jersey_number',{jersey_number:28});check(number.ok&&number.data.nickname===(await own(a)).nickname,'legacy jersey upsert preserves renamed canonical nickname');await yes(a,'save_jersey_number',{jersey_number:27});
const p=await own(a),bypass=await account(a,'save_premium_profile',{nickname:'Bypass_'+tag,first_name:'Changed',full_name:'Changed Surname',display_as:'full_name',jersey_number:99,group_scope:p.group_scope.map(g=>g.group_id).sort(),accept_disclosure:true,request_id:randomUUID()});
check(!bypass.ok&&JSON.stringify(await own(a))===JSON.stringify(p),'old profile writer cannot bypass canonical rename or partly disclose data');
const spoof=await account(a,'foundation_rename',{nickname:'Spoof_'+tag,expected_nickname:p.nickname,current_password:a.password,request_id:randomUUID(),user_id:b.id});check(spoof.status===400&&(await own(b)).nickname===expectedB,'client-selected other user rejected');
const direct=await request('/rest/v1/rpc/slm_identity_rename',{p_user:b.id,p_session:b.id,p_request:randomUUID(),p_expected:badBefore.nickname,p_nickname:'Spoof'},a.session.access_token,keys.ANON_KEY);check(!direct.ok,'authenticated cannot call privileged rename RPC');
const denied=await request('/rest/v1/slm_identity_registry?select=*',undefined,a.session.access_token,keys.ANON_KEY,'GET');check(!denied.ok||denied.data.length===0,'private registry not exposed to authenticated client');
const ledger=await request('/rest/v1/slm_v2_requests?actor_id=eq.'+a.id+'&action=eq.identity_foundation',undefined,undefined,undefined,'GET');check(ledger.ok&&ledger.data.length>0&&ledger.data.every(x=>!JSON.stringify(x).includes(a.password)&&!JSON.stringify(x.body).includes('password')&&Object.keys(x.body).sort().join(',')==='expected,nickname'),'actual SQL ledger excludes passwords and accepts only identity payload');
check((await account(null,'login',{identifier:a.login,password:a.password})).ok&&(await account(null,'login',{identifier:e.email,password:e.password})).ok,'legacy and email login compatibility remains unchanged; no login cutover');
console.log('FOUNDATION REAL HTTP '+count+' PASS; synthetic accounts retained; no existing stacks/Cloud changed.');

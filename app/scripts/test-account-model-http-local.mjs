// Real Supabase test. New isolated project ONLY; retains all synthetic accounts.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'feat/account-model-foundation');
const host=process.env.DOCKER_HOST??execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();assert(/^(npipe|unix):/.test(host));
const emailRegression=process.env.SLM_ACCOUNT_EMAIL_REGRESSION==='1',final=emailRegression||process.env.SLM_ACCOUNT_MODEL_FINAL==='1',stack=emailRegression?'.cache/account-email-regression':final?'.cache/account-model-final':'.cache/account-model-stack',project=emailRegression?'slm-email-regression':final?'slm-account-final':'slm-account-candidate';
let raw;try{raw=execFileSync('cmd',['/c','npx','--yes','--package=supabase@2.121.0','supabase','status','--workdir',stack,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}catch{throw Error('Local stack status unavailable; captured keys are never logged');}
const keys=JSON.parse(raw.slice(raw.indexOf('{'))),url=emailRegression?'http://127.0.0.1:61321':final?'http://127.0.0.1:59321':'http://127.0.0.1:58321';assert.equal(keys.API_URL,url);assert(keys.SERVICE_ROLE_KEY&&keys.ANON_KEY);
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

const testPhone='+48000'+String(Math.floor(Math.random()*999999)+1).padStart(6,'0');
const tag=randomUUID().slice(0,8),password=()=>randomBytes(24).toString('base64url')+'Aa9!';
const input=nickname=>({nickname,password:password(),email:'',phone:'',full_name:'',request_id:randomUUID(),request_secret:randomBytes(32).toString('hex')});
const signup=draft=>account(null,'model_signup',draft);
const login=(identifier,password)=>account(null,'login',{identifier,password});
const countUsers=()=>Number(execFileSync('docker',['exec','supabase_db_'+project,'psql','-X','-At','-U','postgres','-d','postgres','-c','select count(*) from auth.users'],{encoding:'utf8'}).trim());
const existing=countUsers();if(final)assert.equal(existing,0,'Final run requires a NEW empty database; never reset an existing one');
check((await request('/rest/v1/slm_signup_jobs?select=request_id',undefined,undefined,undefined,'GET')).ok,'candidate private storage exists');
if(existing===0){
 const blocked=await signup(input('Blocked_'+tag));check(blocked.status===503&&blocked.data.code==='model_inactive','fresh candidate is inactive until explicit isolated test preparation');
 check((await rpc('slm_model_prepare')).ok,'empty database candidate prepared without creating accounts');
}
const da=input('First_'+tag),dbody=input('Second_'+tag);
let r=await signup(da);check(r.ok&&r.data.registered,'public signup without email creates real account');
r=await signup(da);check(r.ok&&countUsers()===existing+1,'retry after lost response creates only one Auth user');
const stolen=await signup({...da,request_secret:randomBytes(32).toString('hex')});check(stolen.status===409,'wrong signup capability cannot claim another request');
const changedPass=await signup({...da,password:password()});check(changedPass.status===401,'retry cannot change original account password');
const a={password:da.password,nickname:da.nickname};r=await login(a.nickname,a.password);check(r.ok,'nickname login after public signup');a.session=r.data;a.id=r.data.user_id;
const g=await yes(a,'groups_create',{name:'Model '+tag,request_id:randomUUID()});
check(!!g.group_id,'first new user can create a group without global admin role');
const draft=async(u,change={})=>{const p=await own(u);return{nickname:p.nickname,expected_nickname:p.nickname,first_name:p.first_name,full_name:p.full_name,display_as:p.display_as,jersey_number:p.jersey_number,group_scope:p.group_scope.map(x=>x.group_id).sort(),accept_disclosure:false,contact_phone:p.phone,request_id:randomUUID(),...change};};
const newName='Renamed_'+tag,save=await draft(a,{nickname:newName,first_name:'Given',full_name:'Given Surname',jersey_number:27,contact_phone:testPhone,current_password:a.password});
r=await account(a,'model_profile',save);check(r.ok&&r.data.nickname===newName&&r.data.login===newName&&r.data.phone===testPhone,'atomic Premium profile changes canonical login and contact');
const saved=await own(a);a.nickname=newName;
check((await login(da.nickname,a.password)).status===401&&(await login(testPhone,a.password)).status===401,'old nickname and contact phone denied; no legacy fallback');
await yes(a,'logout');r=await login(a.nickname,a.password);check(r.ok&&r.data.user_id===a.id,'logout then new nickname restores same UUID');a.session=r.data;
check((await signup(dbody)).ok,'second public signup');const b={password:dbody.password,nickname:dbody.nickname};b.session=await yes(null,'login',{identifier:b.nickname,password:b.password});b.id=b.session.user_id;
const isolated=await account(b,'groups_detail',g);check([403,404].includes(isolated.status)||(isolated.ok&&!JSON.stringify(isolated.data).includes('Given Surname')&&(!isolated.data.members||isolated.data.members.length===0)),'outsider gets no private group roster or personal data');
check((await account(a,'reset_password',{user_id:b.id})).status===403,'group administrator cannot reset accounts');
const denied=await request('/rest/v1/slm_identity_registry?select=*',undefined,b.session.access_token,keys.ANON_KEY,'GET');check(!denied.ok||denied.data.length===0,'private registry and email not exposed');
await yes(a,'groups_invite',{...g,user_id:b.id,request_id:randomUUID()});const inv=(await yes(b,'groups_inbox')).requests.find(x=>x.group_id===g.group_id&&x.state==='pending');await yes(b,'groups_decide',{id:inv.id,accept:true,request_id:randomUUID()});
const groupScope=(await own(a)).group_scope;const pending=await draft(a,{nickname:'Disclosure_'+tag,display_as:'full_name',current_password:a.password});
r=await account(a,'model_profile',pending);check(r.status===409&&(await own(a)).nickname===a.nickname&&(await own(a)).display_as===saved.display_as,'unconfirmed disclosure rolls back canonical rename and profile');
r=await account(a,'model_profile',{...pending,accept_disclosure:true});check(r.ok&&r.data.group_scope.every(x=>x.share_full_name),'confirmed disclosure and rename commit in one transaction');a.nickname=pending.nickname;
const baseline=await own(a),wrong=await draft(a,{nickname:'Wrong_'+tag,current_password:password()});r=await account(a,'model_profile',wrong);check(r.status===401&&JSON.stringify(await own(a))===JSON.stringify(baseline),'wrong password preserves full profile, group consent and session');
const target='Race_'+tag,pa=await draft(a,{nickname:target,current_password:a.password}),pb=await draft(b,{nickname:target.toLowerCase(),current_password:b.password});
const race=await Promise.all([account(a,'model_profile',pa),account(b,'model_profile',pb)]);check(race.filter(x=>x.ok).length===1&&race.filter(x=>x.status===409).length===1,'simultaneous canonical nickname claim has one winner');
for(const u of [a,b]){u.nickname=(await own(u)).nickname;const rr=await account(null,'refresh',{refresh_token:u.session.refresh_token});check(rr.ok,'loser and winner keep refresh access');u.session=rr.data;}
const after=await own(a);check(after.jersey_number===27&&after.full_name===baseline.full_name&&JSON.stringify(after.group_scope)===JSON.stringify(baseline.group_scope)&&groupScope.length===after.group_scope.length,'race preserves jersey, name and PR16 group consents');
const contact=await draft(a,{contact_phone:''});r=await account(a,'model_profile',contact);check(r.ok&&r.data.phone==='','contact-only update does not require password or change login');
const legacyWrite=await account(a,'save_premium_profile',{...contact,nickname:'Bypass_'+tag});check(legacyWrite.status===426,'old incompatible APK writer is refused before mutation');
const spoof=await account(a,'model_profile',{...await draft(a),user_id:b.id});check(spoof.status===400,'profile endpoint refuses client-selected UUID');
const rs=input('RegRace_'+tag),rt=input(rs.nickname.toLowerCase());const signupRace=await Promise.all([signup(rs),signup(rt)]);check(signupRace.filter(x=>x.ok).length===1&&signupRace.filter(x=>x.status===409).length===1,'simultaneous public registration reserves one normalized nickname');
const emailDraft=input('WithMail_'+tag);const beforeMail=countUsers();r=await signup({...emailDraft,email:'not-deliverable@fixture.invalid'});check(r.status===503&&r.data.code==='mail_unconfigured'&&countUsers()===beforeMail,'real email never administratively confirmed; no partial signup');
// Seed existing confirmed e-mail and legacy accounts solely as local compatibility fixtures.
const seed=async(kind)=>{
 const email=randomUUID()+'@fixture.invalid',pwd=password(),rr=await request('/auth/v1/admin/users',{email,password:pwd,email_confirm:kind!=='unconfirmed'});assert(rr.ok,'Seed own compatibility Auth fixture');const id=rr.data.id,nick='Compat_'+randomUUID().slice(0,8);
 if(kind==='legacy'){
  assert((await rpc('slm_account_provision',{p_user:id,p_login:nick,p_phone:'+48000'+String(Math.floor(Math.random()*999999)+1).padStart(6,'0'),p_email:email,p_admin:false})).ok);
  assert((await request('/rest/v1/slm_player_profiles',{user_id:id,nickname:nick,email_account:false})).ok);
 }else if(kind==='email'){
  assert((await rpc('slm_email_identity',{p_user:id})).ok);
  assert((await request('/rest/v1/slm_player_profiles?user_id=eq.'+id,{nickname:nick},undefined,undefined,'PATCH')).ok);
 }else{
  for(const [table,value] of [['slm_profiles',{user_id:id}],['slm_roles',{user_id:id}],['slm_account_security',{user_id:id,must_change_password:false}],['slm_player_profiles',{user_id:id,nickname:nick,email_account:true}]])assert((await request('/rest/v1/'+table,value)).ok);
 }
 assert((await request('/rest/v1/slm_identity_registry',{user_id:id,nickname_key:nick.toLowerCase(),auth_email:email,email_login:kind==='legacy'?null:email})).ok);
 return{id,email,password:pwd,nickname:nick};
};
const e=await seed('email');e.session=await yes(null,'login',{identifier:e.email,password:e.password});check((await yes(null,'login',{identifier:e.nickname,password:e.password})).user_id===e.id,'confirmed existing email and nickname resolve same UUID');
const un=await seed('unconfirmed');check((await login(un.email,un.password)).status===401&&(await login(un.nickname,un.password)).status===401,'unconfirmed Auth email cannot authenticate even with malicious registry row');
const legacy=await seed('legacy');legacy.session=await yes(null,'login',{identifier:legacy.nickname,password:legacy.password});const next=password();legacy.session=await yes(legacy,'password',{current_password:legacy.password,new_password:next});legacy.password=next;check((await own(legacy)).login===legacy.nickname,'legacy password gate and canonical profile remain compatible');
const internal=(await request('/rest/v1/slm_identity_registry?user_id=eq.'+a.id,undefined,undefined,undefined,'GET')).data[0].auth_email;
const internalAttempt=await login(internal,a.password),phoneAttempt=await login('000000999',a.password),unknownAttempt=await login('Missing_'+tag,a.password);
check(internalAttempt.status===401&&internalAttempt.data.error===phoneAttempt.data.error&&phoneAttempt.data.error===unknownAttempt.data.error,'internal technical email, phone and unknown names have identical credential error');
// Only OUR new test user becomes the fixture global administrator; no real role changes.
assert((await request('/rest/v1/slm_roles?user_id=eq.'+b.id,{role:'admin'},undefined,undefined,'PATCH')).ok);
const list=await yes(b,'list_accounts');check(list.some(x=>x.user_id===a.id)&&list.some(x=>x.user_id===e.id),'authorized account admin lists canonical no-email and email accounts');
for(const u of [a,e,legacy]){
 const old=u.session,before=await own(u);const reset=await yes(b,'reset_password',{user_id:u.id,confirm_identity:true,reason:'Identity independently checked in local fixture',current_password:b.password});
 check(reset.temporary_password.length===12&&(await account({session:old},'profile')).status===401,'administrator reset revokes previous protected session');
 check((await login(u.nickname,u.password)).status===401,'old password rejected after reset');
 u.session=await yes(null,'login',{identifier:u.nickname,password:reset.temporary_password});check(u.session.must_change_password&&(await account(u,'profile')).status===403,'temporary password cannot read protected profile');
 const fresh=password();u.session=await yes(u,'password',{current_password:reset.temporary_password,new_password:fresh});u.password=fresh;check((await own(u)).user_id===before.user_id&&(await own(u)).nickname===before.nickname,'required password change restores same identity after admin reset');
}
check((await account(b,'reset_password',{user_id:a.id,current_password:b.password})).status===400,'reset requires explicit independent identity confirmation');
check((await account(null,'recover_email',{email:e.email})).status===503,'email recovery remains fail-closed without verified delivery/callback');
const ledger=await request('/rest/v1/slm_v2_requests?actor_id=eq.'+a.id,undefined,undefined,undefined,'GET');check(ledger.ok&&!JSON.stringify(ledger.data).includes(da.password)&&ledger.data.every(x=>!Object.keys(x.body).includes('current_password')),'actual combined-profile ledger never contains passwords');
const jobs=await request('/rest/v1/slm_signup_jobs?select=*',undefined,a.session.access_token,keys.ANON_KEY,'GET');check(!jobs.ok||jobs.data.length===0,'registration capabilities and private jobs are not readable by clients');
console.log('ACCOUNT CANDIDATE REAL HTTP '+count+' PASS; mail workflows BLOCKED; target activation false; all synthetic accounts retained.');

// Reuse PR16 real privacy/Auth scenarios on the dedicated consolidation project.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import {assertIsolated,localKeys,base as url} from './stabilization-local.mjs';
assertIsolated();const keys=localKeys();
let passed=0;function check(ok,label){assert(ok,label);console.log('PASS '+label);passed++;}
async function request(path,method='GET',body,token=keys.SERVICE_ROLE_KEY,key=keys.SERVICE_ROLE_KEY){const r=await fetch(url+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});return {ok:r.ok,status:r.status,data:await r.json().catch(()=>null)};}
const vite=await createServer({configFile:'app/vite.b1.config.ts',root:process.cwd()+'/app',server:{middlewareMode:true}});
try{
 const {SessionManager}=await vite.ssrLoadModule('/src/auth/sessionManager.ts');const {AccountError}=await vite.ssrLoadModule('/src/auth/api.ts');
 const account=async(action,values={},session)=>{const r=await request('/functions/v1/accounts','POST',{...values,action},session?.access_token??keys.ANON_KEY,keys.ANON_KEY);if(!r.ok)throw new AccountError(r.data?.error??'Local API failed',r.data?.code??'error');return r.data;};
 const users=[];
 for(let i=0;i<5;i++){
  const email=randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url')+'Aa7!';
  const r=await request('/auth/v1/admin/users','POST',{email,password,email_confirm:true});assert(r.ok,'Create isolated fictional user HTTP '+r.status+' '+String(r.data?.error_code??r.data?.code??''));
  const u={id:r.data.id,email,password,login:'Pr16_'+randomUUID().slice(0,8),phone:'+48000'+String(Math.floor(Math.random()*999999)+1).padStart(6,'0'),disk:{value:null,read:async function(){return this.value;},write:async function(v){this.value=v;},clear:async function(){this.value=null;}}};
  if(i===0){const provision=await request('/rest/v1/rpc/slm_account_provision','POST',{p_user:u.id,p_login:u.login,p_phone:u.phone,p_email:email,p_actor:null,p_actor_session:null,p_admin:false});assert(provision.ok,'Legacy provisioning');}
  const direct=await request('/auth/v1/token?grant_type=password','POST',{email,password},keys.ANON_KEY,keys.ANON_KEY);assert(direct.ok,'Direct Auth password HTTP '+direct.status+' '+String(direct.data?.error_code??''));
  u.manager=new SessionManager(u.disk,account);await u.manager.signIn(i===0?u.login:email,password);
  if(i===0){assert(u.manager.getSnapshot().session.must_change_password);const next=randomBytes(24).toString('base64url')+'Ab9!';await u.manager.changeSession('password',{current_password:password,new_password:next});u.password=next;}
  users.push(u);
 }
 const [a,b,c,outsider,viewer]=users;
 const call=(u,action,body={})=>u.manager.call(action,body);
 const write=(u,action,body={})=>call(u,'groups_'+action,{...body,request_id:randomUUID()});
 const profile=u=>call(u,'profile');
 const scope=async u=>(await profile(u)).group_scope.map(g=>g.group_id).sort();
 const draft=async(mode,accept=false)=>({nickname:'PR16 Public',first_name:'Given',full_name:'Given SecretSurname',jersey_number:27,display_as:mode,group_scope:await scope(a),accept_disclosure:accept,request_id:randomUUID()});
 const save=(u,body)=>call(u,'save_premium_profile',body);
 const member=(u,g)=>call(u,'groups_profile',{group_id:g.group_id,user_id:a.id});
 async function join(admin,u,g){await write(admin,'invite',{...g,user_id:u.id});const r=(await call(u,'groups_inbox')).requests.find(x=>x.group_id===g.group_id&&x.state==='pending');assert(r);await write(u,'decide',{id:r.id,accept:true});}
 const ga=await write(b,'create',{name:'PR16 Alpha',description:'Fictional isolated group'}),gb=await write(c,'create',{name:'PR16 Beta'});
 for(const [admin,g] of [[b,ga],[c,gb]]){await join(admin,a,g);await join(admin,viewer,g);}
 check((await profile(a)).email_account===false&&(await profile(b)).email_account===true,'real legacy and e-mail logins; required temporary password changed');
 const original=await profile(a),sessionBefore=a.manager.getSnapshot().session.access_token;
 await save(a,await draft('nickname'));
 check((await profile(a)).login===original.login&&a.manager.getSnapshot().session.access_token===sessionBefore,'independent nickname does not change technical login or session');
 await write(a,'consent',{...ga,share_full_name:true});
 check((await member(viewer,ga)).display_name==='PR16 Public'&&(await member(viewer,ga)).full_name==='Given SecretSurname','A/D: consent alone does not change nickname format');
 await write(a,'consent',{...ga,share_full_name:false});
 let body=await draft('first_name');await assert.rejects(()=>save(a,body));
 check((await profile(a)).display_as==='nickname','B: unconfirmed disclosure rejected without partial save');
 body={...body,accept_disclosure:true};await Promise.all([save(a,body),save(a,body)]);
 check((await profile(a)).display_as==='first_name'&&(await profile(a)).group_scope.every(x=>x.share_first_name&&!x.share_full_name),'B: confirmed first name atomically shared in both current groups; concurrent retry');
 for(const g of [ga,gb]){const m=await member(viewer,g);check(m.display_name==='Given'&&m.full_name===null,'first-only group DTO never contains surname');}
 const list=await call(viewer,'groups_detail',ga);check(!JSON.stringify(list).includes('SecretSurname'),'roster DTO does not leak surname');
 const match=await call(b,'matches_create',{...ga,name:'PR16 privacy match',visibility:'public',date:'2099-10-19',time:'19:00',location:'Fictional isolated pitch',duration_minutes:90,capacity:10,cost_cents:0,request_id:randomUUID()});
 await call(a,'matches_join',{event_id:match.event_id,request_id:randomUUID()});
 const eventDto=await call(viewer,'matches_detail',{event_id:match.event_id});check(!JSON.stringify(eventDto).includes('SecretSurname')&&JSON.stringify(eventDto).includes('Given'),'match participant DTO respects first-only disclosure');
 const publicEvent=await call(outsider,'matches_detail',{event_id:match.event_id});check(!JSON.stringify(publicEvent).includes('SecretSurname')&&!JSON.stringify(publicEvent).includes('Given'),'public outsider event DTO uses pseudonym only');
 const finances=await call(a,'group_finance_account',ga);check(!JSON.stringify(finances).includes('SecretSurname'),'ordinary finance account DTO contains no raw surname');

 await assert.rejects(()=>member(outsider,ga));check(true,'outsider denied group profile');
 const rawProfile=async(u)=>request('/rest/v1/slm_profiles?user_id=eq.'+a.id,'GET',undefined,u.manager.getSnapshot().session.access_token,keys.ANON_KEY);
 check((await rawProfile(viewer)).data.length===0,'PostgREST RLS denies raw surname for first-only member');
 check((await rawProfile(outsider)).data.length===0,'PostgREST RLS denies outsider');
 check((await rawProfile(a)).data.length===1&&(await rawProfile(b)).data.length===1,'PostgREST RLS keeps owner and B3 admin access');
 const forbidden=await request('/rest/v1/rpc/slm_premium_profile_save','POST',{p_user:a.id,p_session:a.id,p_body:{}},viewer.manager.getSnapshot().session.access_token,keys.ANON_KEY);check(!forbidden.ok,'authenticated client cannot invoke privileged save RPC directly');
 await assert.rejects(()=>save(a,{...body,nickname:'MustNotPersist',display_as:'full_name',accept_disclosure:false,request_id:randomUUID()}));
 check((await profile(a)).nickname==='PR16 Public'&&(await profile(a)).display_as==='first_name','F: surname escalation denied atomically');
 await save(a,await draft('full_name',true));check((await member(viewer,ga)).display_name==='Given SecretSurname','C/F: confirmed full name projection');
 await save(a,await draft('nickname'));check((await profile(a)).group_scope.every(x=>x.share_full_name),'G: nickname keeps existing consents');
 await save(a,await draft('full_name'));const revoke={...ga,share_full_name:false,request_id:randomUUID()};
 await assert.rejects(()=>call(a,'groups_consent',revoke));check((await profile(a)).display_as==='full_name','E: unconfirmed revocation rejected');
 await call(a,'groups_consent',{...revoke,confirm_nickname:true});
 let p=await profile(a);check(p.display_as==='nickname'&&!p.group_scope.find(x=>x.group_id===ga.group_id).share_full_name&&p.group_scope.find(x=>x.group_id===gb.group_id).share_full_name,'E: revocation falls back globally, clears only selected group');
 await save(a,await draft('first_name',true));await call(a,'groups_consent',{...revoke,confirm_nickname:true});check((await profile(a)).display_as==='first_name','retry of old revocation does not mutate newer preference');
 check((await member(viewer,ga)).full_name===null&&(await member(viewer,gb)).full_name==='Given SecretSurname','two groups retain different surname permissions');
 const oldScope=await scope(a),gc=await write(viewer,'create',{name:'PR16 New group'});await join(viewer,a,gc);
 await assert.rejects(async()=>save(a,{...await draft('full_name',true),group_scope:oldScope,nickname:'StaleWrite'}));
 check((await profile(a)).nickname==='PR16 Public','membership change invalidates stale scope without partial save');
 check(!(await profile(a)).group_scope.find(x=>x.group_id===gc.group_id).share_first_name,'new memberships do not inherit disclosure');
 const outsiderBefore=await profile(outsider);await save(a,{...await draft('nickname'),user_id:outsider.id,p_user:outsider.id});check((await profile(outsider)).nickname===outsiderBefore.nickname,'body cannot select another profile owner');
 const bp=await profile(b);await save(b,{nickname:'Email Public',first_name:'Email Given',full_name:'Email Secret',display_as:'first_name',jersey_number:0,group_scope:await scope(b),accept_disclosure:true,request_id:randomUUID()});check((await profile(b)).nickname==='Email Public','e-mail profile saves through the same real atomic API');await b.manager.signIn(b.email,b.password);check((await profile(b)).user_id===bp.user_id,'e-mail Auth identifier unchanged by public nickname');
 for(const u of [a,b]){const oldId=u.id;await u.manager.refresh();check((await profile(u)).user_id===oldId,'real refresh and profile read-back');const restored=new SessionManager(u.disk,account);await restored.refresh();check(restored.getSnapshot().phase==='ready'&&(await restored.call('profile')).user_id===oldId,'new application controller restores real session from refresh token');u.manager=restored;}
 await a.manager.signIn(a.phone,a.password);check((await profile(a)).nickname==='PR16 Public','legacy phone login still works after public nickname change');
 // Real Storage API, with synthetic image only; no gallery/user files.
 const photo='data:image/webp;base64,'+JSON.parse(readFileSync('app/supabase/functions/fixtures/webp.json','utf8')).base64;
 const initial=await call(a,'profile_photo_get');
 const uploaded=await call(a,'profile_photo_upload',{expected_revision:initial.revision,image_data_url:photo});
 check(uploaded.image_data_url===photo&&!!uploaded.revision,'real Storage upload and authorized read');
 const replacement=await call(a,'profile_photo_upload',{expected_revision:uploaded.revision,image_data_url:photo});
 check(replacement.revision!==uploaded.revision,'real Storage replacement changes revision');
 await assert.rejects(()=>call(a,'profile_photo_upload',{expected_revision:uploaded.revision,image_data_url:photo}));check(true,'stale photo write rejected');
 await assert.rejects(()=>call(outsider,'profile_photo_delete',{expected_revision:replacement.revision,user_id:a.id}));check(true,'other account cannot delete owner revision');
 const cleared=await call(a,'profile_photo_delete',{expected_revision:replacement.revision});check(cleared.image_data_url===null,'real Storage delete and profile readback');
 await a.manager.logout();check(a.disk.value===null&&a.manager.getSnapshot().phase==='signed_out','real logout clears refresh token');
 console.log('CONSOLIDATION PROFILE HTTP '+passed+' PASS; only isolated fictional users/groups retained.');
} finally {await vite.close();}

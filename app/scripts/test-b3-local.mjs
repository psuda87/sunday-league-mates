// LOCAL ONLY: four fresh fictional accounts, non-dialable phones, no existing-user edits.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import {assertBranch,assertSafeConfig,management,server,url} from './accounts-admin-local.mjs';
assertBranch();assertSafeConfig(await management('/config/auth'));
const api=await server(),vite=await createServer({configFile:'vite.b1.config.ts',root:process.cwd(),server:{middlewareMode:true}});
let passed=0;const check=(value,label)=>{assert(value,label);console.log('PASS '+label);passed++;};
const write=(user,action,body={})=>user.manager.call('groups_'+action,{...body,request_id:randomUUID()});
try{
 const {SessionManager}=await vite.ssrLoadModule('/src/auth/sessionManager.ts'),{accountRequest}=await vite.ssrLoadModule('/src/auth/api.ts');
 const users=[];
 for(let i=0;i<4;i++){
  const email=randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url')+'Aa7!';
  const created=await api.request('/auth/v1/admin/users','POST',{email,password,email_confirm:true});assert(created.ok,'Create own local fixture');
  const disk={read:async()=>null,write:async()=>{},clear:async()=>{}},manager=new SessionManager(disk,accountRequest);
  await manager.signIn(email,password);
  const phone='+48000'+String(Math.floor(Math.random()*999999)+1).padStart(6,'0');
  await manager.call('save_email_profile',{nickname:'B3 Player '+i,phone,current_password:password});
  await manager.call('save_profile',{full_name:'Fictional PrivateSurname'+i,display_as:'full_name'});
  users.push({manager,id:created.data.id,email,password,phone});
 }
 const [a,b,c,d]=users;
 const ga=await write(a,'create',{name:'B3 HTTP Alpha',description:'Fictional local group'}),gb=await write(d,'create',{name:'B3 HTTP Beta'});
 let detail=await a.manager.call('groups_detail',ga);
 check(detail.group.admin_id===a.id&&detail.members.length===1,'atomic creator and group administrator');
 check((await c.manager.call('groups_search',{query:'B3 HTTP'})).groups.every(g=>Object.keys(g).sort().join(',')==='description,id,member_count,name'),'search strips private metadata');
 await assert.rejects(()=>c.manager.call('groups_detail',ga));check(true,'outsider cannot read private members');
 await write(a,'invite',{...ga,user_id:b.id});
 const invite=(await b.manager.call('groups_inbox')).requests.find(r=>r.group_id===ga.group_id);
 await assert.rejects(()=>b.manager.call('groups_detail',ga));check(true,'invitation is not membership');
 await write(b,'decide',{id:invite.id,accept:true});
 await write(c,'join',ga);
 detail=await a.manager.call('groups_detail',ga);const pending=detail.requests.find(r=>r.target_id===c.id&&r.kind==='join');
 check(!!pending.contact_phone,'admin can see applicant phone');
 check(!(await b.manager.call('groups_detail',ga)).requests.some(r=>r.contact_phone),'member cannot see applicant phone');
 await write(a,'decide',{id:pending.id,accept:true});
 let member=await b.manager.call('groups_profile',{...ga,user_id:c.id});
 check(member.full_name===null&&!!member.contact_phone&&member.nickname==='B3 Player 2','accepted membership shares phone, not private surname');
 const jwtB=b.manager.getSnapshot().session.access_token;
 let raw=await api.request('/rest/v1/slm_profiles?user_id=eq.'+c.id,'GET',undefined,jwtB,false);
 check(raw.ok&&raw.data.length===0,'direct REST RLS blocks hidden full profile');
 await write(c,'consent',{...ga,share_full_name:true});
 member=await b.manager.call('groups_profile',{...ga,user_id:c.id});check(member.full_name==='Fictional PrivateSurname2','explicit consent shares surname');
 raw=await api.request('/rest/v1/slm_profiles?user_id=eq.'+c.id,'GET',undefined,jwtB,false);check(raw.ok&&raw.data.length===1,'RLS agrees with consent');
 await write(c,'consent',{...ga,share_full_name:false});
 check((await b.manager.call('groups_profile',{...ga,user_id:c.id})).full_name===null,'withdrawal of consent hides surname');
 await assert.rejects(()=>write(b,'permission',{...ga,user_id:b.id,organizer:true}));check(true,'member cannot escalate group permissions');
 await assert.rejects(()=>d.manager.call('groups_profile',{...ga,user_id:c.id}));check(true,'other group administrator has no private access');
 const rpc=await api.request('/rest/v1/rpc/slm_groups_dispatch','POST',{p_user:a.id,p_session:randomUUID(),p_action:'list',p_body:{}},jwtB,false);
 check(!rpc.ok,'direct authenticated RPC denied');
 const direct=await api.request('/rest/v1/slm_group_members?group_id=eq.'+ga.group_id,'PATCH',{organizer:true},jwtB,false);check(!direct.ok,'direct membership privilege injection denied');
 await write(a,'remove',{...ga,user_id:c.id});await assert.rejects(()=>c.manager.call('groups_profile',{...ga,user_id:b.id}));check(true,'removal revokes access');
 await write(c,'join',ga);let outgoing=(await c.manager.call('groups_inbox')).outgoing.find(r=>r.group_id===ga.group_id&&r.state==='pending');
 await write(c,'cancel_request',{id:outgoing.id});check((await c.manager.call('groups_inbox')).outgoing.some(r=>r.id===outgoing.id&&r.state==='cancelled'),'own cancellation status is returned');
 await write(c,'join',ga);detail=await a.manager.call('groups_detail',ga);outgoing=detail.requests.find(r=>r.target_id===c.id&&r.state==='pending');
 await write(a,'decide',{id:outgoing.id,accept:false});check(!(await a.manager.call('groups_detail',ga)).members.some(m=>m.user_id===c.id),'rejection does not join group');
 const same={...ga,user_id:c.id,request_id:randomUUID()};await a.manager.call('groups_invite',same);await a.manager.call('groups_invite',same);
 check((await c.manager.call('groups_inbox')).requests.filter(r=>r.group_id===ga.group_id).length===1,'retry is idempotent');
 const newInvite=(await c.manager.call('groups_inbox')).requests.find(r=>r.group_id===ga.group_id);
 const decisions=await Promise.allSettled([write(c,'decide',{id:newInvite.id,accept:true}),write(c,'decide',{id:newInvite.id,accept:true})]);
 check(decisions.filter(x=>x.status==='fulfilled').length===1&&(await a.manager.call('groups_detail',ga)).members.filter(m=>m.user_id===c.id).length===1,'real HTTP concurrency produces one membership');
 const image=JSON.parse(readFileSync('supabase/functions/fixtures/webp.json','utf8'));
 const photo=await b.manager.call('profile_photo_upload',{expected_revision:null,image_data_url:'data:image/webp;base64,'+image.base64});
 check((await b.manager.call('profile_photo_get')).revision===photo.revision,'B2 own photo upload and read-back remain functional');
 await b.manager.call('profile_photo_delete',{expected_revision:photo.revision});check((await b.manager.call('profile_photo_get')).image_data_url===null,'B2 photo deletion remains functional');
 await b.manager.call('save_jersey_number',{jersey_number:27});await b.manager.call('save_profile',{full_name:'Updated B2 Name',display_as:'full_name'});
 check((await b.manager.call('profile')).jersey_number===27,'B2 name edit retains jersey');
 let unknown;
 do {
  unknown='+48000'+String(Math.floor(Math.random()*999999)+1).padStart(6,'0');
  const [legacy,email]=await Promise.all([api.request('/rest/v1/slm_aliases?phone=eq.'+encodeURIComponent(unknown)+'&select=user_id'),api.request('/rest/v1/slm_player_profiles?contact_phone=eq.'+encodeURIComponent(unknown)+'&select=user_id')]);
  assert(legacy.ok&&email.ok);if(!legacy.data.length&&!email.data.length)break;
 }while(true);
 for(const sender of [b,c]){
  const before=(await sender.manager.call('groups_detail',ga)).requests.filter(r=>r.kind==='proposal'&&r.actor_id===sender.id).length;
  for(const phone of [d.phone,unknown])for(let retry=0;retry<2;retry++)await write(sender,'phone',{...ga,phone});
  const after=(await sender.manager.call('groups_detail',ga)).requests.filter(r=>r.kind==='proposal'&&r.actor_id===sender.id).length;
  check(after-before===2,'phone receipt counts stay opaque for known/unknown accounts and independent senders');
 }
 check(!JSON.stringify(await a.manager.call('groups_detail',ga)).includes('phone_lookup_key'),'private phone fingerprint never leaves RPC projection');
 await write(a,'leave',ga);check((await b.manager.call('groups_detail',ga)).group.admin_id===b.id,'leaving owner transfers administration safely');
 check((await d.manager.call('groups_detail',gb)).members.length===1,'unrelated group remains unchanged');
 if(process.env.SLM_B3_BROWSER==='1'){
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const browser=spawnSync(process.execPath,['scripts/b3-ui-runner-local.mjs'],{env,input:JSON.stringify({slm_email:b.email,slm_password:b.password}),encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});
  const line=browser.stdout?.split(/\r?\n/).findLast(x=>x.startsWith('SLM_B3_RESULT '));assert(line,'Browser returned sanitized result');
  const result=JSON.parse(line.slice(14));console.log('B3 REAL BROWSER '+JSON.stringify(result));assert(result.failed===0&&result.passed>0,'B3 browser checks');
 }
 for(const u of users)await u.manager.logout();
 console.log('B3 HTTP '+passed+' PASS; four new fictional local accounts retained, existing users unchanged.');
}finally{await vite.close();}

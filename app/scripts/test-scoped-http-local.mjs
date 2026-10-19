// Real localhost HTTP only. Fictional credentials remain in memory, never logged.
import { randomUUID,randomBytes } from 'node:crypto';
import { cleanupScopedFixture } from './scoped-cleanup-local.mjs';
import { assertBranch,assertSafeConfig,management,server,url } from './accounts-admin-local.mjs';
const ids=[],groups=[];let api,passed=0;
function check(value,label){if(!value)throw new Error(label);console.log('PASS '+label);passed++;}
async function invoke(action,body={},session){const r=await fetch(url+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({...body,action}),signal:AbortSignal.timeout(20000)});return {ok:r.ok,status:r.status,data:await r.json()};}
async function yes(action,body={},session){const r=await invoke(action,body,session);if(!r.ok)throw new Error(action+' HTTP '+r.status+' '+(r.data.code??'unknown'));return r.data;}
async function write(action,body,session){return yes(action,{...body,request_id:randomUUID()},session);}
try{
 assertBranch();assertSafeConfig(await management('/config/auth'));api=await server();
 const sessions=[],passwords=[];
 for(let i=0;i<2;i++){
  const email=randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url')+'Aa1!';
  const user=await api.request('/auth/v1/admin/users','POST',{email,password,email_confirm:true,user_metadata:{role:'admin'}});
  if(!user.ok)throw new Error('Cannot create fictional local Auth fixture');ids.push(user.data.id);
  const session=await yes('login',{identifier:email,password});sessions.push(session);passwords.push(password);
  check(session.user_id===user.data.id&&session.role==='member'&&!session.must_change_password,'confirmed email login: member, no temporary-password gate');
  const p=await yes('profile',{},session);check(p.email_account===true&&p.phone==='','email profile has no fictional phone');
 }
 const [owner,player]=sessions;
 const contact=await yes('save_email_profile',{nickname:'Fictional captain',phone:'+48000000301',current_password:passwords[0]},owner);
 check(contact.login==='Fictional captain'&&contact.phone==='+48000000301','HTTP nickname/contact saved after current password');
 check((await invoke('save_email_profile',{nickname:'Other',phone:'+48000000302',current_password:randomUUID()},owner)).status===401,'HTTP wrong current password rejects contact change');

 const g=await write('groups_create',{name:'Fictional HTTP group',description:'Local fixture only'},owner);groups.push(g.group_id);
 check((await yes('groups_list',{},owner)).groups.some(x=>x.id===g.group_id),'HTTP create/list own group');
 check((await invoke('groups_detail',{group_id:g.group_id},player)).status===404,'HTTP outsider cannot read members');
 await write('groups_invite',{group_id:g.group_id,user_id:player.user_id},owner);
 const invitation=(await yes('groups_inbox',{},player)).requests.find(x=>x.group_id===g.group_id);
 await write('groups_decide',{id:invitation.id,accept:true},player);
 check((await yes('groups_detail',{group_id:g.group_id},player)).members.length===2,'HTTP invitation acceptance joins group');
 const match=await write('matches_create',{group_id:g.group_id,name:'Fictional HTTP match',visibility:'private',date:'2099-10-19',time:'19:00',location:'Fictional local pitch',duration_minutes:90,capacity:10,cost_cents:27000},owner);
 await write('matches_join',{event_id:match.event_id},player);
 await write('matches_guest',{event_id:match.event_id,guest_name:'Fictional guest',guest_phone:'',list:'reserve'},player);
 const detail=await yes('matches_detail',{event_id:match.event_id},player);
 check(detail.participants.length===2&&detail.event.registered_count===1&&detail.event.reserve_count===1,'HTTP real event, player and separate guest reserve');
 check(detail.event.starts_at==='2099-10-19T17:00:00+00:00','HTTP Warsaw date interpreted on server');
 check((await invoke('group_finance_detail',{event_id:match.event_id},player)).status===403,'HTTP member cannot manage event finances');
 check((await yes('group_finance_account',{group_id:g.group_id},player)).surplus===null,'HTTP surplus hidden from member');
 check((await invoke('signup',{email:randomUUID()+'@fixture.invalid',password:randomBytes(12).toString('base64url')})).data.code==='mail_unconfigured','HTTP signup blocked before any mail request');
 const newPassword=randomBytes(24).toString('base64url')+'Aa1!';
 const changed=await yes('password',{current_password:passwords[1],new_password:newPassword},player);
 check((await invoke('profile',{},player)).status===401,'HTTP email password change rejects previous JWT');
 check(!(await invoke('refresh',{refresh_token:player.refresh_token})).ok,'HTTP email password change rejects previous refresh');
 sessions[1]=changed;
 // Explicit setup of OUR fictional application administrator, never a real account.
 const role=await api.request('/rest/v1/slm_roles?user_id=eq.'+owner.user_id,'PATCH',{role:'admin'});
 if(!role.ok)throw new Error('Cannot prepare fictional reset actor');
 const reset=await yes('reset_password',{user_id:player.user_id},owner);
 check(reset.temporary_password.length===12,'HTTP reset of email account creates twelve-character temporary password');
 check(!(await invoke('profile',{},changed)).ok&&!(await invoke('refresh',{refresh_token:changed.refresh_token})).ok,'HTTP email account reset revokes JWT and refresh');
 const temporary=await yes('login',{identifier:(await api.request('/auth/v1/admin/users/'+player.user_id)).data.email,password:reset.temporary_password});
 check(temporary.must_change_password&&(await invoke('profile',{},temporary)).status===403,'HTTP email reset requires password change before protected data');
 sessions[1]=await yes('password',{current_password:reset.temporary_password,new_password:randomBytes(24).toString('base64url')+'Aa1!'},temporary);
 check(!(await invoke('profile',{},changed)).ok,'HTTP old email session remains rejected after required password change');
 for(const session of sessions)await yes('logout',{},session);

 console.log('RESULT '+passed+' real scoped HTTP checks PASS');
}catch(e){console.log('FAIL '+e.message);process.exitCode=1;}
finally{await cleanupScopedFixture(api,ids,groups);}

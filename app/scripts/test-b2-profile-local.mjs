// LOCAL ONLY. Fictional accounts/groups retained; no deletion, migration or existing-user edits.
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import { createServer } from 'vite';
import { assertBranch,assertSafeConfig,management,server } from './b1-admin-local.mjs';
assertBranch();assertSafeConfig(await management('/config/auth'));
const admin=await server();
const vite=await createServer({configFile:'vite.b1.config.ts',root:process.cwd(),server:{middlewareMode:true}});
let count=0;function check(value,label){assert(value,label);console.log('PASS '+label);count++;}
try {
 const {SessionManager}=await vite.ssrLoadModule('/src/auth/sessionManager.ts');
 const {accountRequest}=await vite.ssrLoadModule('/src/auth/api.ts');
 const {profileAdapter}=await vite.ssrLoadModule('/src/auth/profileAdapter.ts');
 const users=[];
 for(let i=0;i<2;i++){
  const email=randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url')+'Aa7!';
  const user=await admin.request('/auth/v1/admin/users','POST',{email,password,email_confirm:true,user_metadata:{role:'admin'}});check(user.ok,'create own fictional fixture '+i);
  let token=null;const disk={read:async()=>token,write:async value=>{token=value;},clear:async()=>{token=null;}};
  const manager=new SessionManager(disk,accountRequest);await manager.signIn(email,password);
  check(manager.getSnapshot().session.role==='member','user metadata cannot grant administrator');
  users.push({id:user.data.id,manager,disk,email,password});
 }
 const [a,b]=users,pa=profileAdapter(a.manager,a.id),pb=profileAdapter(b.manager,b.id);
 const beforeA=await pa.read(),beforeB=await pb.read();check(beforeA.user_id===a.id&&beforeB.user_id===b.id,'read each own profile via existing API');
 const saved=await pa.save('Fikcyjny Profil B2','full_name');check(saved.full_name==='Fikcyjny Profil B2'&&saved.display_name==='Fikcyjny Profil B2','save full name and verified read-back');
 check(saved.login===beforeA.login&&saved.phone===beforeA.phone,'login and phone preserved by profile edit');
 const resumed=new SessionManager(a.disk,accountRequest);await resumed.refresh();check((await profileAdapter(resumed,a.id).read()).full_name==='Fikcyjny Profil B2','server profile survives new manager and refresh');await resumed.logout();
 await a.manager.signIn(a.email,a.password);const sessionA=a.manager.getSnapshot().session,sessionB=b.manager.getSnapshot().session;
 const groupA=await a.manager.call('groups_create',{name:'B2 fictional isolation A',description:'Local security fixture',request_id:randomUUID()});
 const groupB=await b.manager.call('groups_create',{name:'B2 fictional isolation B',description:'Local security fixture',request_id:randomUUID()});
 check(!!groupA.group_id&&!!groupB.group_id,'separate-group fixtures created through existing API');
 const own=await admin.request('/rest/v1/slm_profiles?user_id=eq.'+a.id,'GET',undefined,sessionA.access_token,false);
 const outsider=await admin.request('/rest/v1/slm_profiles?user_id=eq.'+a.id,'GET',undefined,sessionB.access_token,false);
 check(own.ok&&own.data.length===1&&outsider.ok&&outsider.data.length===0,'RLS own read allowed, separate-group private profile hidden');
 await assert.rejects(b.manager.call('groups_detail',{group_id:groupA.group_id}));console.log('PASS API rejects separate-group member list');count++;
 const otherProjection=await b.manager.call('profile',{user_id:a.id});check(otherProjection.user_id===b.id,'profile target cannot override authenticated owner');
 const attempt=await b.manager.call('save_profile',{user_id:a.id,full_name:'Own Fixture Update',display_as:'full_name',role:'admin',login:'Hijack',phone:'+48000000998'});
 check(attempt.user_id===b.id&&(await pa.read()).full_name==='Fikcyjny Profil B2','API cannot edit another account by injected user_id');
 const bAfter=await pb.read();check(bAfter.login===beforeB.login&&bAfter.phone===beforeB.phone,'protected login/phone injection ignored');
 for(const [path,body] of [
  ['/rest/v1/slm_profiles?user_id=eq.'+a.id,{full_name:'Unauthorized'}],
  ['/rest/v1/slm_profiles?user_id=eq.'+b.id,{display_as:'nickname'}],
  ['/rest/v1/slm_roles?user_id=eq.'+b.id,{role:'admin'}],
  ['/rest/v1/slm_aliases?user_id=eq.'+b.id,{login:'Hijack'}],
  ['/rest/v1/slm_player_profiles?user_id=eq.'+b.id,{nickname:'Hijack'}],
 ]){
  const denied=await admin.request(path,'PATCH',body,sessionB.access_token,false);check(!denied.ok,'authenticated direct write denied: '+path.split('?')[0].split('/').pop());
 }
 await b.manager.refresh();check(b.manager.getSnapshot().session.role==='member','role remains member after malicious requests');
 await assert.rejects(b.manager.call('save_profile',{full_name:'x'.repeat(101),display_as:'full_name'}));console.log('PASS server rejects invalid full name');count++;
 await a.manager.logout();await b.manager.logout();
 console.log('PASS final logout of both fixtures');count++;
 console.log('B2.1 checks '+count+'; two new fictional accounts and two groups retained; no secrets logged');
} finally {await vite.close();}

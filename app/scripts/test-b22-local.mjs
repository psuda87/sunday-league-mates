// LOCAL ONLY. Synthetic images/new fictional accounts; no existing account edits or reset.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import {assertBranch,assertSafeConfig,management,server,url} from './accounts-admin-local.mjs';
assertBranch();assertSafeConfig(await management('/config/auth'));
const admin=await server(),vite=await createServer({configFile:'vite.b1.config.ts',root:process.cwd(),server:{middlewareMode:true}});
let count=0;const check=(value,label)=>{assert(value,label);console.log('PASS '+label);count++;};
const rejects=async(fn,label)=>{await assert.rejects(fn);console.log('PASS '+label);count++;};
try {
 const {SessionManager}=await vite.ssrLoadModule('/src/auth/sessionManager.ts');
 const {accountRequest}=await vite.ssrLoadModule('/src/auth/api.ts');
 const {profileAdapter}=await vite.ssrLoadModule('/src/auth/profileAdapter.ts');
 const {webpSize}=await vite.ssrLoadModule('/supabase/functions/_shared/webp.ts');
 const fixture=JSON.parse(readFileSync('../.cache/b22-webp-fixture.json','utf8'));
 const bytes=Buffer.from(fixture.base64,'base64'),image='data:image/webp;base64,'+fixture.base64;
 check(webpSize(bytes)?.width===fixture.width,'backend validates actual browser WebP dimensions');
 check(webpSize(bytes.subarray(0,bytes.length-2))===null,'backend rejects truncated RIFF');
 const users=[];
 for(let i=0;i<2;i++){
  const email=randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url')+'Aa7!';
  const user=await admin.request('/auth/v1/admin/users','POST',{email,password,email_confirm:true});check(user.ok,'create isolated local fixture '+i);
  let token=null;const disk={read:async()=>token,write:async value=>{token=value;},clear:async()=>{token=null;}};
  const manager=new SessionManager(disk,accountRequest);await manager.signIn(email,password);
  users.push({id:user.data.id,manager,disk,email,password});
 }
 const [a,b]=users,pa=profileAdapter(a.manager,a.id),pb=profileAdapter(b.manager,b.id);
 check((await pa.read()).jersey_number===null,'new account has no fake jersey');
 check((await pa.saveNumber(0)).jersey_number===0,'save and server read-back jersey zero');
 check((await pa.saveNumber(99)).jersey_number===99,'save jersey upper bound');
 check((await pb.saveNumber(99)).jersey_number===99,'duplicate jerseys allowed');
 for(const value of [-1,100,1.5,'7',null])await rejects(()=>b.manager.call('save_jersey_number',{jersey_number:value}),'server rejects invalid jersey '+String(value));
 await rejects(()=>b.manager.call('save_jersey_number',{jersey_number:7,user_id:a.id}),'injected owner rejected');
 await b.manager.call('save_email_profile',{nickname:'B22 Fixture',phone:''});
 check((await pb.read()).jersey_number===99,'contact edit preserves jersey');
 await pa.save('B22 Synthetic Player','full_name');check((await pa.read()).jersey_number===99,'full-name edit preserves jersey');
 const initial=await a.manager.call('profile_photo_get');check(initial.image_data_url===null,'empty photo is explicit');
 const uploaded=await a.manager.call('profile_photo_upload',{expected_revision:null,image_data_url:image});
 check(uploaded.image_data_url===image&&!!uploaded.revision,'upload valid bounded WebP');
 check((await a.manager.call('profile_photo_get')).image_data_url===image,'photo confirmed from private storage');
 check((await b.manager.call('profile_photo_get')).image_data_url===null,'other account cannot see owner photo');
 const rows=await admin.request('/rest/v1/slm_profile_photos?user_id=eq.'+a.id);const firstPath=rows.data[0].object_path;
 check(firstPath.startsWith(a.id+'/')&&firstPath.endsWith('.webp'),'object path uses authenticated UUID');
 const jwtB=b.manager.getSnapshot().session.access_token;
 for(const path of ['/rest/v1/slm_profile_photos?user_id=eq.'+a.id,'/storage/v1/object/authenticated/slm-profile-photos/'+firstPath]){
  const direct=await admin.request(path,'GET',undefined,jwtB,false);check(!direct.ok||Array.isArray(direct.data)&&direct.data.length===0,'direct private access denied '+path.split('?')[0].split('/')[2]);
 }
 const directRpc=await admin.request('/rest/v1/rpc/slm_profile_number_save','POST',{p_user:a.id,p_session:randomUUID(),p_number:1},jwtB,false);check(!directRpc.ok,'authenticated cannot call service-only number RPC');
 const directPhoto=await admin.request('/rest/v1/rpc/slm_profile_photo_commit','POST',{p_user:a.id,p_session:randomUUID(),p_expected:uploaded.revision,p_path:null},jwtB,false);check(!directPhoto.ok,'authenticated cannot call photo commit RPC');
 const replace=await a.manager.call('profile_photo_upload',{expected_revision:uploaded.revision,image_data_url:image});
 check(replace.revision!==uploaded.revision&&!replace.cleanup_pending,'replace uses revision CAS and cleans previous object');
 const old=await admin.request('/storage/v1/object/authenticated/slm-profile-photos/'+firstPath);check(!old.ok,'replaced old object removed');
 await rejects(()=>a.manager.call('profile_photo_upload',{expected_revision:uploaded.revision,image_data_url:image}),'stale revision rejected');
 check((await a.manager.call('profile_photo_get')).revision===replace.revision,'stale write preserves current photo');
 await rejects(()=>b.manager.call('profile_photo_delete',{expected_revision:null,user_id:a.id}),'cross-account delete rejected');
 const badImages=[image.replace('image/webp','image/jpeg'),'data:image/webp;base64,'+bytes.subarray(0,bytes.length-2).toString('base64'),'data:image/webp;base64,'+Buffer.alloc(150001).toString('base64')];
 for(const bad of badImages)await rejects(()=>b.manager.call('profile_photo_upload',{expected_revision:null,image_data_url:bad}),'server rejects spoofed/truncated/oversized image');
 const missing=await fetch(url+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'profile_photo_get'})});check(missing.status===401,'missing session denied');
 const restart=new SessionManager(a.disk,accountRequest);await restart.refresh();
 check((await profileAdapter(restart,a.id).read()).jersey_number===99&&(await restart.call('profile_photo_get')).revision===replace.revision,'refresh/restart retains server jersey and photo');
 const removed=await restart.call('profile_photo_delete',{expected_revision:replace.revision});check(removed.image_data_url===null&&!removed.cleanup_pending,'delete clears projection and object');
 const list=await admin.request('/storage/v1/object/list/slm-profile-photos','POST',{prefix:a.id+'/',limit:100});check(list.ok&&list.data.length===0,'no orphan after success/stale/delete operations');
 const oldJwt=restart.getSnapshot().session.access_token;await restart.logout();
 const expired=await fetch(url+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+oldJwt},body:JSON.stringify({action:'profile_photo_get'})});check(expired.status===401,'revoked server session cannot read photo');
 await b.manager.logout();console.log('B2.2 local checks '+count+' PASS; two fictional fixtures retained; no credentials logged.');
}finally{await vite.close();}

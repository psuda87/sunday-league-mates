// Real local Storage/Auth test; only resources generated here are removed.
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { assertBranch, assertSafeConfig, management, server, url } from './accounts-admin-local.mjs';
import { cleanupScopedFixture } from './scoped-cleanup-local.mjs';
const ids=[],sessions=[];let api,passed=0;
function check(ok,label){if(!ok)throw new Error(label);passed++;console.log('PASS '+label);}
async function call(index,action,body={}){
 const r=await fetch(url+'/functions/v1/accounts'+(action==='profile_photo_upload'?'?photo=upload':''),{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessions[index].access_token},body:JSON.stringify({...body,action}),signal:AbortSignal.timeout(20000)});
 return {status:r.status,data:await r.json()};
}
try{
 assertBranch();assertSafeConfig(await management('/config/auth'));api=await server();
 const credentials=[];
 for(let i=0;i<2;i++){
  const email=randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url')+'Aa1!';
  const user=await api.request('/auth/v1/admin/users','POST',{email,password,email_confirm:true});
  if(!user.ok)throw Error('Cannot create own photo fixture');ids.push(user.data.id);credentials.push({email,password});
  const r=await fetch(url+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',identifier:email,password})});
  if(!r.ok)throw Error('Cannot log in own photo fixture');sessions.push(await r.json());
 }
 check((await call(0,'profile_photo_get')).data.image_data_url===null,'new profile has no invented photo');
 const image='data:image/jpeg;base64,'+(await readFile(new URL('../public/assets/branding/stadium-bg-card.jpg',import.meta.url))).toString('base64');
 const saved=await call(0,'profile_photo_upload',{image_data_url:image,expected_revision:null});
 check(saved.status===200&&saved.data.revision,'JPEG saved to actual private Storage and metadata');
 check((await call(0,'profile_photo_get')).data.image_data_url===image,'owner downloads exact persisted image');
 check((await call(1,'profile_photo_get')).data.image_data_url===null,'another member sees only their own empty photo');
 check((await call(1,'profile_photo_get',{user_id:ids[0]})).status===400,'client cannot select another owner');
 const metadata=await api.request('/rest/v1/slm_profile_photos?user_id=eq.'+ids[0]);
 const path=metadata.data[0].object_path;
 const publicRead=await api.request('/storage/v1/object/public/slm-profile-photos/'+path,'GET',undefined,null,false);
 check(!publicRead.ok,'private bucket cannot be read by public URL');
 const directRead=await api.request('/storage/v1/object/authenticated/slm-profile-photos/'+path,'GET',undefined,sessions[1].access_token,false);
 check(!directRead.ok,'other JWT cannot bypass API through Storage');
 const directMetadata=await api.request('/rest/v1/slm_profile_photos?user_id=eq.'+ids[0],'GET',undefined,sessions[1].access_token,false);
 check(!directMetadata.ok,'metadata cannot be read directly by authenticated client');
 const stale=await call(0,'profile_photo_upload',{image_data_url:image,expected_revision:randomUUID()});
 check(stale.status===409&&(await call(0,'profile_photo_get')).data.revision===saved.data.revision,'stale write rejected without losing current photo');
 const bad=await call(0,'profile_photo_upload',{image_data_url:'data:image/svg+xml;base64,PHN2Zy8+',expected_revision:saved.data.revision});
 check(bad.status===400,'SVG rejected on server');
 const c=credentials[0];
 const login=await fetch(url+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',identifier:c.email,password:c.password})});
 sessions[0]=await login.json();
 check((await call(0,'profile_photo_get')).data.image_data_url===image,'new login restores photo from server, not UI memory');
 const deleted=await call(0,'profile_photo_delete',{expected_revision:saved.data.revision});
 check(deleted.status===200&&(await call(0,'profile_photo_get')).data.image_data_url===null,'delete clears profile and reload remains empty');
 const objects=await api.request('/storage/v1/object/list/slm-profile-photos','POST',{prefix:ids[0]+'/',limit:100,offset:0});
 check(objects.ok&&objects.data.length===0,'old and stale-upload blobs removed from own Storage folder');
 console.log('RESULT '+passed+' real photo checks PASS');
}catch(error){console.log('FAIL '+error.message);process.exitCode=1;}
finally{
 if(api)for(const id of ids){
  const meta=await api.request('/rest/v1/slm_profile_photos?user_id=eq.'+id);
  for(const row of meta.data??[])for(const path of [row.object_path,row.cleanup_path].filter(Boolean))
   if(path.startsWith(id+'/'))await api.request('/storage/v1/object/slm-profile-photos','DELETE',{prefixes:[path]});
 }
 await cleanupScopedFixture(api,ids,[]);
}

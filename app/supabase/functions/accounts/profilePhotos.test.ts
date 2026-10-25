// Failure injection complements the real local Docker integration tests.
import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {profilePhoto,readAccountBody} from './profilePhotos.ts';
import {webpSize} from '../_shared/webp.ts';
const ctx={id:'11111111-1111-4111-8111-111111111111',sid:'22222222-2222-4222-8222-222222222222'};
const revision='33333333-3333-4333-8333-333333333333';
const env={url:'http://127.0.0.1:54321',service:'server-test-only'};
const fixture=JSON.parse(readFileSync('supabase/functions/fixtures/webp.json','utf8'));
const image='data:image/webp;base64,'+fixture.base64;
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
afterEach(()=>vi.unstubAllGlobals());
function scenario(mode:'upload-fail'|'commit-fail'|'cleanup-fail'|'timeout-committed'|'timeout-unknown'|'gateway-committed'){
 let committed=false,candidate='',deleted:string[]=[];
 vi.stubGlobal('crypto',{randomUUID:()=>revision});
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit={})=>{
  const body=init.body?JSON.parse(typeof init.body==='string'?init.body:'{}'):{};
  if(url.includes('/rest/v1/slm_profile_photos')){
   if(mode==='timeout-unknown'&&candidate)throw Error('network');
   if(init.method==='PATCH')return json([]);
   return json(committed?[{object_path:candidate,revision,cleanup_path:mode==='cleanup-fail'?ctx.id+'/old.jpg':null}]:[]);
  }
  if(url.includes('/object/list/'))return json([]);
  if(url.includes('/rpc/')){
   if(mode==='commit-fail')return json({message:'stale_photo'},409);
   if(mode==='timeout-unknown')throw Error('network');
   committed=true;
   if(mode==='gateway-committed')return json({},503);
   if(mode==='timeout-committed')throw Error('lost response');
   return json({object_path:candidate,revision,cleanup_path:mode==='cleanup-fail'?ctx.id+'/old.jpg':null});
  }
  if(init.method==='DELETE'){
   if(mode==='cleanup-fail')return json({},503);
   deleted=deleted.concat(body.prefixes);return json([]);
  }
  if(init.method==='POST'){
   candidate=ctx.id+'/'+revision+'.webp';
   return json({},mode==='upload-fail'?503:200);
  }
  throw Error('unexpected request');
 }));
 return {deleted:()=>deleted,candidate:()=>candidate};
}
it('does not commit after a Storage upload failure',async()=>{
 scenario('upload-fail');await expect(profilePhoto(env,ctx,'profile_photo_upload',{image_data_url:image,expected_revision:null})).rejects.toMatchObject({code:'photo_unavailable'});
 expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('/rpc/'))).toBe(false);
});
it('removes the new candidate after a definitive stale commit',async()=>{
 const s=scenario('commit-fail');await expect(profilePhoto(env,ctx,'profile_photo_upload',{image_data_url:image})).rejects.toMatchObject({code:'stale_photo'});
 expect(s.deleted()).toEqual([s.candidate()]);
});
it('keeps the committed new photo when old-object cleanup fails',async()=>{
 const s=scenario('cleanup-fail');const saved=await profilePhoto(env,ctx,'profile_photo_upload',{image_data_url:image});
 expect(saved.cleanup_pending).toBe(true);expect(saved.image_data_url).toBe(image);expect(s.deleted()).not.toContain(s.candidate());
});
it('recovers a lost commit response by checking metadata before deleting anything',async()=>{
 const s=scenario('timeout-committed');const saved=await profilePhoto(env,ctx,'profile_photo_upload',{image_data_url:image});
 expect(saved.revision).toBe(revision);expect(s.deleted()).toEqual([]);
});
it('never deletes a potentially committed candidate when read-back is also unavailable',async()=>{
 const s=scenario('timeout-unknown');await expect(profilePhoto(env,ctx,'profile_photo_upload',{image_data_url:image})).rejects.toMatchObject({code:'photo_unavailable'});
 expect(s.deleted()).toEqual([]);
});
it('rejects owner/path injection before making requests',async()=>{
 vi.stubGlobal('fetch',vi.fn());
 await expect(profilePhoto(env,ctx,'profile_photo_delete',{user_id:revision})).rejects.toMatchObject({code:'invalid_input'});
 expect(fetch).not.toHaveBeenCalled();
});
it('enforces body limit even without content-length',async()=>{
 const req=new Request('https://localhost',{method:'POST',body:'x'.repeat(50)});
 await expect(readAccountBody(req,49)).rejects.toMatchObject({status:413});
});
it('rejects incorrect RIFF size, animation, dimensions and incomplete image chunks',()=>{
 const original=Uint8Array.from(atob(fixture.base64),c=>c.charCodeAt(0));
 for(const mutate of [(b:Uint8Array)=>{b[4]^=1;},(b:Uint8Array)=>{b[20]|=2;},(b:Uint8Array)=>{b[24]=255;b[25]=255;},(b:Uint8Array)=>{b[12]=0;}]){
  const b=original.slice();mutate(b);expect(webpSize(b)).toBeNull();
 }
});

it('recovers an ambiguous gateway 503 without deleting an already committed photo',async()=>{
 const s=scenario('gateway-committed');const saved=await profilePhoto(env,ctx,'profile_photo_upload',{image_data_url:image});
 expect(saved.revision).toBe(revision);expect(s.deleted()).toEqual([]);
});
it('age-based GC protects active/referenced and fresh files and never follows foreign paths',async()=>{
 const active=ctx.id+'/'+revision+'.webp',pending=ctx.id+'/44444444-4444-4444-8444-444444444444.webp';
 const orphan='55555555-5555-4555-8555-555555555555.webp',fresh='66666666-6666-4666-8666-666666666666.webp';
 const deleted:string[]=[];const old=new Date(Date.now()-172800000).toISOString();
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit={})=>{
  if(url.includes('/rest/v1/slm_profile_photos'))return json([{object_path:active,revision,cleanup_path:null}]);
  if(url.includes('/object/list/'))return json([{name:revision+'.webp',created_at:old},{name:orphan,created_at:old},{name:fresh,created_at:new Date().toISOString()},{name:'../foreign.webp',created_at:old}]);
  if(init.method==='DELETE'){deleted.push(...JSON.parse(String(init.body)).prefixes);return json([]);}
  if(url.includes('/rpc/'))return json({message:'stale_photo'},409);
  throw Error('unexpected request');
 }));
 await expect(profilePhoto(env,ctx,'profile_photo_delete',{expected_revision:revision})).rejects.toMatchObject({code:'stale_photo'});
 expect(deleted).toEqual([ctx.id+'/'+orphan]);expect(deleted).not.toContain(active);expect(deleted).not.toContain(pending);
});

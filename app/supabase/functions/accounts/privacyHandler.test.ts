import {afterEach,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
const transport=vi.hoisted(()=>({send:vi.fn(async()=>undefined)}));
vi.mock('./smtp.ts',()=>({sendSmtp:transport.send}));
import {createHandler} from './handler';
afterEach(()=>{vi.unstubAllGlobals();transport.send.mockClear();});
const id='00000000-0000-4000-8000-000000000001',sid='10000000-0000-4000-8000-000000000001',operation='20000000-0000-4000-8000-000000000001';
const token='fixture.'+btoa(JSON.stringify({sub:id,session_id:sid}))+'.unsigned';
function fixture(options:{invalidPassword?:boolean;authFailure?:boolean;noticeFailure?:boolean;completed?:boolean;photos?:boolean;storageFailure?:boolean}={}){
 let phase=options.completed?'complete':'prepared',hasPhotos=options.photos===true;const calls:{path:string;body:Record<string,unknown>}[]=[];
 vi.stubGlobal('crypto',webcrypto);
 if(options.noticeFailure)transport.send.mockRejectedValueOnce(Error('smtp unavailable'));
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
  const path=new URL(url).pathname,body=JSON.parse(String(init.body??'{}'));calls.push({path,body});
  const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status});
  if(path.endsWith('slm_account_rate'))return reply(true);
  if(path.endsWith('slm_account_context'))return reply({role:'member',must_change_password:false});
  if(path==='/auth/v1/user')return reply({id});
  if(path==='/rest/v1/slm_aliases')return reply([{user_id:id,technical_email:'fixture@fixture.invalid',login:'fixture',phone:null}]);
  if(path==='/auth/v1/token')return options.invalidPassword?reply({},400):reply({access_token:token,user:{id}});
  if(path==='/auth/v1/logout')return reply({});
  if(path.endsWith('slm_deletion_begin'))return reply(null);
  if(path.endsWith('slm_deletion_work'))return reply([{operation_id:operation}]);
  if(path.endsWith('slm_deletion_step')){
   if(body.p_step==='purge')phase='purged';if(body.p_step==='complete')phase='complete';
   return reply({operation_id:operation,subject_id:phase==='complete'?null:id,phase,completed_at:phase==='complete'?'2026-11-04T20:00:00Z':null,notice_sent:false});
  }
  if(path==='/storage/v1/object/list/slm-profile-photos')return reply(hasPhotos?[{name:'fixture.webp'},{name:'orphan.webp'}]:[]);
  if(path==='/storage/v1/object/slm-profile-photos'){if(options.storageFailure)return reply({},503);hasPhotos=false;return reply([]);}
  if(path==='/auth/v1/admin/users/'+id){if(init.method==='DELETE')return reply({},options.authFailure?503:200);return reply({},404);}
  throw Error('unexpected fixture request '+path);
 }));
 const handler=createHandler({url:'https://fixture.invalid',anon:'fixture',service:'fixture-service',origins:['https://slm.fixture.invalid'],connectSmtp:vi.fn()});
 async function request(body:Record<string,unknown>,authorization='Bearer '+token,origin?:string){
  return handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization,'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)}));
 }
 return {request,calls};
}
const deletion={action:'account_delete',operation_id:operation,proof:'a'.repeat(64),confirmation:'USUŃ KONTO',current_password:'fixture-password',user_id:'spoofed'};
it('reauthenticates the current user before creating a job, without accepting supplied identity',async()=>{
 const f=fixture();const r=await f.request(deletion);expect(r.status).toBe(200);expect(await r.json()).toEqual({deleted:true,operation_id:operation});
 expect(f.calls.find(c=>c.path.endsWith('slm_deletion_begin'))?.body.p_user).toBe(id);
 expect(f.calls.findIndex(c=>c.path==='/auth/v1/token')).toBeLessThan(f.calls.findIndex(c=>c.path.endsWith('slm_deletion_begin')));
});
it('wrong password never revokes, deletes, or sends a notification',async()=>{
 const f=fixture({invalidPassword:true});expect((await f.request(deletion)).status).toBe(401);
 expect(f.calls.some(c=>c.path.endsWith('slm_deletion_begin')||c.path.includes('/admin/users/'))).toBe(false);expect(transport.send).not.toHaveBeenCalled();
});
it('missing explicit confirmation never authenticates or deletes',async()=>{
 const f=fixture();expect((await f.request({...deletion,confirmation:'yes'})).status).toBe(400);
 expect(f.calls.some(c=>c.path==='/auth/v1/token'||c.path.endsWith('slm_deletion_begin'))).toBe(false);
});
it('Auth outage never returns a deletion success or sends a notice',async()=>{
 const f=fixture({authFailure:true});const r=await f.request(deletion);expect(r.status).toBe(503);expect(await r.json()).toMatchObject({code:'deletion_pending'});expect(transport.send).not.toHaveBeenCalled();
});
it('removes current and orphan photos through Storage API before Auth deletion, then verifies the folder is empty',async()=>{
 const f=fixture({photos:true});expect((await f.request(deletion)).status).toBe(200);
 const removed=f.calls.find(c=>c.path==='/storage/v1/object/slm-profile-photos');expect(removed?.body.prefixes).toEqual([id+'/fixture.webp',id+'/orphan.webp']);
 expect(f.calls.filter(c=>c.path.includes('/object/list/'))).toHaveLength(2);
 expect(f.calls.indexOf(removed!)).toBeLessThan(f.calls.findIndex(c=>c.path.includes('/auth/v1/admin/users/')));
});
it('Storage failure never deletes Auth or acknowledges success',async()=>{
 const f=fixture({photos:true,storageFailure:true});expect((await f.request(deletion)).status).toBe(503);
 expect(f.calls.some(c=>c.path.includes('/auth/v1/admin/users/'))).toBe(false);expect(transport.send).not.toHaveBeenCalled();
});
it('sends only operation metadata after completion; email outage does not roll back successful removal',async()=>{
 const f=fixture({noticeFailure:true});const r=await f.request(deletion);expect(await r.json()).toMatchObject({deleted:true});
 const mail=transport.send.mock.calls[0] as unknown[];const serialized=JSON.stringify(mail);
 expect(serialized).toContain('activehub.dev@gmail.com');expect(serialized).toContain('SLM — usunięto konto użytkownika');
 expect(serialized).not.toContain('fixture-password');expect(serialized).not.toContain('fixture@fixture.invalid');expect(serialized).not.toContain(id);
 expect(f.calls.some(c=>c.body.p_step==='notice_sent')).toBe(false);
});
it('worker resumes completed notices without a subject, but is never callable by a browser or ordinary session',async()=>{
 const f=fixture({completed:true});expect((await f.request({action:'account_privacy_worker'})).status).toBe(401);
 expect((await f.request({action:'account_privacy_worker'},'Bearer fixture-service','https://slm.fixture.invalid')).status).toBe(401);
 const r=await f.request({action:'account_privacy_worker'},'Bearer fixture-service');expect(await r.json()).toEqual({processed:1});
 expect(f.calls.some(c=>c.path.includes('/admin/users/')||c.path.includes('/storage/'))).toBe(false);expect(transport.send).toHaveBeenCalledOnce();
});

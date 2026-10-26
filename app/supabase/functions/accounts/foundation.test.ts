import {afterEach,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {createHandler} from './handler';
afterEach(()=>vi.unstubAllGlobals());
async function attempt(enabled?:boolean,wrong=false,extra:Record<string,unknown>={}){
 vi.stubGlobal('crypto',webcrypto);
 const id=webcrypto.randomUUID(),sid=webcrypto.randomUUID();
 const token='test.'+btoa(JSON.stringify({sub:id,session_id:sid}))+'.unsigned';
 let rpc:Record<string,unknown>|undefined,proofs=0;
 vi.stubGlobal('fetch',vi.fn(async(url:string,options:RequestInit)=>{
  const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
  if(url.includes('slm_account_rate'))return reply(true);
  if(url.endsWith('/auth/v1/user'))return reply({id});
  if(url.includes('slm_account_context'))return reply({role:'member',must_change_password:false});
  if(url.includes('slm_aliases?'))return reply([{user_id:id,technical_email:'internal@fixture.invalid'}]);
  if(url.includes('/auth/v1/token?')){proofs++;return wrong?reply({},400):reply({access_token:token});}
  if(url.includes('/auth/v1/logout'))return reply({});
  if(url.includes('slm_identity_rename')){rpc=JSON.parse(options.body as string);return reply({nickname:'NowyLogin'});}
  throw Error('Unexpected local stub path');
 }));
 const handler=createHandler({url:'https://fixture.invalid',anon:'test-anon',service:'test-service',origins:[],accountFoundationEnabled:enabled});
 const response=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({action:'foundation_rename',nickname:'NowyLogin',expected_nickname:'Poprzedni',request_id:webcrypto.randomUUID(),current_password:'EphemeralTestPassword9!',...extra})}));
 return {response,rpc,proofs,id,sid};
}
it('foundation is disabled by default, before password proof or mutation',async()=>{
 const r=await attempt();expect(r.response.status).toBe(503);expect(r.proofs).toBe(0);expect(r.rpc).toBeUndefined();
});
it('password proof is mandatory and a failure never calls SQL',async()=>{
 const r=await attempt(true,true);expect(r.response.status).toBe(401);expect(r.rpc).toBeUndefined();
});
it('strips password and binds SQL owner/session to verified context',async()=>{
 const r=await attempt(true);expect(r.response.status).toBe(200);expect(r.proofs).toBe(1);
 expect(r.rpc).toEqual({p_user:r.id,p_session:r.sid,p_request:expect.any(String),p_expected:'Poprzedni',p_nickname:'NowyLogin'});
 expect(JSON.stringify(r.rpc)).not.toMatch(/password|Ephemeral/);
});
it('rejects a client-selected owner, instead of forwarding it',async()=>{
 const r=await attempt(true,false,{user_id:webcrypto.randomUUID()});expect(r.response.status).toBe(400);expect(r.rpc).toBeUndefined();expect(r.proofs).toBe(0);
});
it('rejects attempts to change privacy with the rename endpoint',async()=>{
 const r=await attempt(true,false,{display_as:'full_name',accept_disclosure:true});expect(r.response.status).toBe(400);expect(r.rpc).toBeUndefined();
});

import {afterEach, expect, it, vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {createHandler} from './handler';

afterEach(() => vi.unstubAllGlobals());
async function request(extra: Record<string, unknown> = {}, code?: string, temporary = false, authenticated = true) {
 vi.stubGlobal('crypto', webcrypto);
 const user = webcrypto.randomUUID(), session = webcrypto.randomUUID(), event = webcrypto.randomUUID();
 const token = ['fixture', btoa(JSON.stringify({sub: user, session_id: session})), 'unsigned'].join('.');
 const rpc = vi.fn(async (body: Record<string, unknown>) => {
  expect(body.p_user).toBe(user); expect(body.p_session).toBe(session);
  return new Response(JSON.stringify(code ? {code:'P0001',message:code} : {event_id:event,version:0,last_change:null}), {status:code?400:200});
 });
 vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
  const response = (body: unknown) => new Response(JSON.stringify(body));
  if (url.includes('slm_account_rate')) return response(true);
  if (url.endsWith('/auth/v1/user')) return authenticated ? response({id:user}) : new Response('{}',{status:401});
  if (url.includes('slm_account_context')) return response({user_id:user,role:'member',must_change_password:temporary});
  if (url.endsWith('/rest/v1/rpc/slm_lineups_dispatch')) return rpc(JSON.parse(options.body as string));
  throw Error('Unexpected transport request');
 }));
 const handler = createHandler({url:'https://fixture.invalid',anon:'',service:'',origins:[]});
 const result = await handler(new Request('https://fixture.invalid', {method:'POST',headers:authenticated?{authorization:'Bearer '+token}:{},body:JSON.stringify({action:'lineups_get',event_id:event,...extra})}));
 return {result,rpc,event};
}
it('reads through existing authenticated handler with verified actor and session, no server cache', async () => {
 const {result,rpc,event}=await request();expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toBe('no-store');
 expect(rpc.mock.calls[0][0]).toMatchObject({p_action:'get',p_body:{event_id:event}});
});
it('forwards the full save contract and original request UUID without inventing an author', async () => {
 const payload={action:'lineups_save',expected_version:0,expected_roster_version:'a'.repeat(64),team_a:[webcrypto.randomUUID()],team_b:[],request_id:webcrypto.randomUUID()};
 const {result,rpc,event}=await request(payload);expect(result.status).toBe(200);
 const {action,...fields}=payload;expect(action).toBe('lineups_save');
 expect(rpc.mock.calls[0][0]).toMatchObject({p_action:'save',p_body:{...fields,event_id:event}}); // action belongs to routing only
});
it.each(['user_id','group_id','p_user','p_session','author_id','updated_by','updated_at','role'])('rejects forged/unknown field %s before RPC', async key => {
 const {result,rpc}=await request({[key]:'spoofed'});expect(result.status).toBe(400);expect((await result.json()).code).toBe('invalid_input');expect(rpc).not.toHaveBeenCalled();
});
it.each(['lineup_version_conflict','lineup_roster_conflict','idempotency_conflict','event_cancelled','lineup_closed','group_archived'])('maps %s to explicit HTTP409 without SQL details', async code => {
 const {result}=await request({},code);expect(result.status).toBe(409);const data=await result.json();expect(data.code).toBe(code);expect(JSON.stringify(data)).not.toContain('P0001');
});
it.each([['lineup_invalid_assignment',400],['invalid_input',400],['request_required',400],['not_found',404],['session_invalid',401],['forbidden',403]])('maps %s safely', async (code,status) => {
 const {result}=await request({},String(code));expect(result.status).toBe(status);expect((await result.json()).code).toBe(code);
});
it('requires a verified non-temporary session before dispatch', async () => {
 const temporary=await request({},undefined,true);expect(temporary.result.status).toBe(403);expect(temporary.rpc).not.toHaveBeenCalled();
 const anonymous=await request({},undefined,false,false);expect(anonymous.result.status).toBe(401);expect(anonymous.rpc).not.toHaveBeenCalled();
});
it('does not expose unrecognized PostgreSQL failure text', async () => {
 const {result}=await request({},'private_sql_detail');expect(result.status).toBe(503);expect(JSON.stringify(await result.json())).not.toContain('private_sql_detail');
});

import {afterEach, expect, it, vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {createHandler} from './handler';

afterEach(() => vi.unstubAllGlobals());
async function request(body: Record<string, unknown>, code?: string, temporary = false, authenticated = true) {
 vi.stubGlobal('crypto', webcrypto);
 const user = webcrypto.randomUUID(), session = webcrypto.randomUUID();
 const token = ['fixture', btoa(JSON.stringify({sub: user, session_id: session})), 'unsigned'].join('.');
 const rpc = vi.fn(async (payload: Record<string, unknown>) => {
  expect(payload.p_user).toBe(user); expect(payload.p_session).toBe(session);
  return new Response(JSON.stringify(code ? {code:'P0001',message:code} : {user_id:user,own:true,earned:[],progress:[]}), {status:code?400:200});
 });
 vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
  const response = (data: unknown) => new Response(JSON.stringify(data));
  if (url.includes('slm_account_rate')) return response(true);
  if (url.endsWith('/auth/v1/user')) return authenticated ? response({id:user}) : new Response('{}',{status:401});
  if (url.includes('slm_account_context')) return response({user_id:user,role:'member',must_change_password:temporary});
  if (url.endsWith('/rest/v1/rpc/slm_badges_dispatch')) return rpc(JSON.parse(options.body as string));
  throw Error('Unexpected transport request');
 }));
 const handler = createHandler({url:'https://fixture.invalid',anon:'',service:'',origins:[]});
 const result = await handler(new Request('https://fixture.invalid', {method:'POST',headers:authenticated?{authorization:'Bearer '+token}:{},body:JSON.stringify(body)}));
 return {result,rpc,user};
}
it('badges_player przekazuje wyłącznie user_id z zweryfikowanym aktorem i sesją', async () => {
 const target = webcrypto.randomUUID();
 const {result,rpc} = await request({action:'badges_player',user_id:target});
 expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toBe('no-store');
 expect(rpc.mock.calls[0][0]).toMatchObject({p_action:'player',p_body:{user_id:target}});
});
it('badges_seen nie przyjmuje żadnych pól i oznacza wyłącznie własne odznaki', async () => {
 const ok = await request({action:'badges_seen'});
 expect(ok.result.status).toBe(200); expect(ok.rpc.mock.calls[0][0]).toMatchObject({p_action:'seen',p_body:{}});
 const forged = await request({action:'badges_seen',user_id:webcrypto.randomUUID()});
 expect(forged.result.status).toBe(400); expect(forged.rpc).not.toHaveBeenCalled();
});
it.each(['p_user','p_session','group_id','code','seen_at','role'])('odrzuca podrobione pole %s przed RPC', async key => {
 const {result,rpc} = await request({action:'badges_player',user_id:webcrypto.randomUUID(),[key]:'spoofed'});
 expect(result.status).toBe(400); expect((await result.json()).code).toBe('invalid_input'); expect(rpc).not.toHaveBeenCalled();
});
it.each([['not_found',404],['session_invalid',401],['invalid_input',400],['invalid_action',400]])('mapuje %s bez szczegółów SQL', async (code,status) => {
 const {result} = await request({action:'badges_player',user_id:webcrypto.randomUUID()},String(code));
 expect(result.status).toBe(status); const data = await result.json(); expect(data.code).toBe(code); expect(JSON.stringify(data)).not.toContain('P0001');
});
it('nie ujawnia nieznanego błędu bazy', async () => {
 const {result} = await request({action:'badges_player',user_id:webcrypto.randomUUID()},'private_sql_detail');
 expect(result.status).toBe(503); expect(JSON.stringify(await result.json())).not.toContain('private_sql_detail');
});
it('wymaga zweryfikowanej sesji bez hasła tymczasowego', async () => {
 const temporary = await request({action:'badges_player',user_id:webcrypto.randomUUID()},undefined,true);
 expect(temporary.result.status).toBe(403); expect(temporary.rpc).not.toHaveBeenCalled();
 const anonymous = await request({action:'badges_player',user_id:webcrypto.randomUUID()},undefined,false,false);
 expect(anonymous.result.status).toBe(401); expect(anonymous.rpc).not.toHaveBeenCalled();
});

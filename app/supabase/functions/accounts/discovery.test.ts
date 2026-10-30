import { afterEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createHandler } from './handler';

afterEach(() => vi.unstubAllGlobals());
async function request(extra: Record<string, unknown> = {}, error?: string, authenticated = true, temporary = false, discoveryVersion: unknown = 1, fault?: 'network' | 'rate') {
  vi.stubGlobal('crypto', webcrypto);
  const user = webcrypto.randomUUID(), sid = webcrypto.randomUUID();
  const token = 'x.' + btoa(JSON.stringify({ sub: user, session_id: sid, exp: Math.floor(Date.now() / 1000) + 3600 })) + '.x';
  const reply = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  const rpc = vi.fn(async (body: Record<string, unknown>) => {
    expect(body.p_user).toBe(user); expect(body.p_session).toBe(sid);
    if (fault === 'network') throw new TypeError('Synthetic disconnected transport');
    return error ? new Response(JSON.stringify({ message: error }), { status: 400 }) : reply({ events: [], ...(discoveryVersion ? { public_discovery_version: discoveryVersion } : {}) });
  });
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, options: RequestInit = {}) => {
    const url = String(input);
    if (url.includes('slm_account_rate')) return reply(fault !== 'rate');
    if (url.endsWith('/auth/v1/user')) return authenticated ? reply({ id: user }) : new Response('{}', { status: 401 });
    if (url.includes('slm_account_context')) return reply({ user_id: user, role: 'member', must_change_password: temporary });
    if (url.endsWith('/rest/v1/rpc/slm_matches_dispatch')) return rpc(JSON.parse(options.body as string));
    throw Error('Unexpected transport request');
  }));
  const handler = createHandler({ url: 'https://fixture.invalid', anon: '', service: '', origins: [] });
  const response = await handler(new Request('https://fixture.invalid', {
    method: 'POST', headers: authenticated ? { authorization: 'Bearer ' + token } : {},
    body: JSON.stringify({ action: 'matches_list', scope: 'public', period: 'upcoming', ...extra }),
  }));
  return { response, rpc, user, sid };
}

it('forwards public search and pagination through the existing scoped dispatcher', async () => {
  const { response, rpc, user, sid } = await request({ query: 'Żółty orlik', offset: 100, p_user: 'forged', p_session: 'forged' });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(rpc).toHaveBeenCalledWith({ p_user: user, p_session: sid, p_action: 'list', p_body: { scope: 'public', period: 'upcoming', query: 'Żółty orlik', offset: 100 } });
});
it.each(['all', 'groups', 'public'])('transports %s without inventing group membership', async scope => {
  const { response, rpc } = await request({ scope });
  expect(response.status).toBe(200);
  expect(rpc.mock.calls[0][0]).toMatchObject({ p_action: 'list', p_body: { scope, period: 'upcoming' } });
});
it('keeps query restricted to reads instead of changing write payloads', async () => {
  const { rpc } = await request({ action: 'matches_create', query: 'must not reach a write', name: 'Fixture' });
  expect(rpc.mock.calls[0][0]).toMatchObject({ p_action: 'create', p_body: { name: 'Fixture' } });
  expect((rpc.mock.calls[0][0] as { p_body: object }).p_body).not.toHaveProperty('query');
});
it.each([['invalid_input', 400], ['session_invalid', 401], ['forbidden', 403]])('maps server %s without presenting successful search', async (code, status) => {
  const { response } = await request({ query: 'fixture' }, String(code));
  expect(response.status).toBe(status);
  expect((await response.json()).code).toBe(code);
});
it('denies anonymous and temporary-password accounts before search RPC', async () => {
  const anonymous = await request({}, undefined, false);
  expect(anonymous.response.status).toBe(401); expect(anonymous.rpc).not.toHaveBeenCalled();
  const temporary = await request({}, undefined, true, true);
  expect(temporary.response.status).toBe(403); expect(temporary.rpc).not.toHaveBeenCalled();
});
it('fails closed instead of presenting an old unfiltered backend reply as successful discovery', async () => {
  for (const body of [{ query: 'Orlik' }, { scope: 'groups' }]) {
    const { response } = await request(body, undefined, true, false, 0);
    expect(response.status).toBe(503); expect((await response.json()).code).toBe('discovery_unavailable');
  }
  const legacy = await request({}, undefined, true, false, 0);
  expect(legacy.response.status).toBe(200);
});

it.each([2, '1', true, null])('rejects incompatible capability marker %s', async version => {
  const { response } = await request({ query: 'fixture' }, undefined, true, false, version);
  expect(response.status).toBe(503);
  expect((await response.json()).code).toBe('discovery_unavailable');
});
it('does not return a success or fixture data after transport loss', async () => {
  const { response } = await request({ query: 'fixture' }, undefined, true, false, 1, 'network');
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.code).toBe('service_unavailable'); expect(body).not.toHaveProperty('events');
});
it('applies rate limiting before search even when forged authority is supplied', async () => {
  const { response, rpc } = await request({ query: 'fixture', role: 'admin', p_user: 'forged' }, undefined, true, false, 1, 'rate');
  expect(response.status).toBe(429); expect(rpc).not.toHaveBeenCalled();
});
it('forwards invalid search parameters for server validation without silently truncating or paginating locally', async () => {
  const { response, rpc } = await request({ query: 'x'.repeat(101), offset: -1 }, 'invalid_input');
  expect(response.status).toBe(400);
  expect(rpc.mock.calls[0][0]).toMatchObject({ p_body: { query: 'x'.repeat(101), offset: -1 } });
});

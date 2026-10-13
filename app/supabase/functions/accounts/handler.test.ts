import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createHandler, displayName, normalizeLogin, normalizePhone, randomPassword } from './handler';

afterEach(() => vi.unstubAllGlobals());
describe('brama wydarzeń', () => {
  async function attempt(temporary: boolean) {
    vi.stubGlobal('crypto', webcrypto);
    const id = webcrypto.randomUUID(), sid = webcrypto.randomUUID();
    const token = ['synthetic', btoa(JSON.stringify({ sub: id, session_id: sid })), 'unsigned'].join('.');
    let eventsCalled = false;
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
      const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
      if (url.includes('slm_account_rate')) return reply(true);
      if (url.endsWith('/auth/v1/user')) return reply({ id });
      if (url.includes('slm_account_context')) return reply({ user_id: id, role: 'member', must_change_password: temporary });
      if (url.includes('slm_events_dispatch')) {
        eventsCalled = true;
        const body = JSON.parse(options.body as string);
        expect(body.p_user).toBe(id); expect(body.p_session).toBe(sid); expect(body.p_action).toBe('join');
        return reply({ code: 'P0001', message: 'event_full' }, 400);
      }
      throw new Error('Nieoczekiwane żądanie testowe');
    }));
    const handler = createHandler({ url: 'https://example.invalid', anon: '', service: '', origins: [] });
    const response = await handler(new Request('https://example.invalid', { method: 'POST', headers: { authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'events_join', p_user: webcrypto.randomUUID(), role: 'admin' }) }));
    return { response, eventsCalled };
  }
  it('wymaga zmiany hasła przed wywołaniem RPC wydarzeń', async () => {
    const r = await attempt(true); expect(r.response.status).toBe(403); expect(r.eventsCalled).toBe(false);
  });
  it('przekazuje zweryfikowaną tożsamość i bezpiecznie tłumaczy odmowę limitu', async () => {
    const r = await attempt(false); expect(r.eventsCalled).toBe(true); expect(r.response.status).toBe(409);
    expect((await r.response.json()).code).toBe('event_full');
  });
});
it('generuje hasła tymczasowe o długości dokładnie 12 znaków', () => {
  vi.stubGlobal('crypto', webcrypto);
  const samples = new Set(Array.from({ length: 100 }, () => randomPassword()));
  expect(samples.size).toBe(100);
  expect([...samples].every(value => /^[A-Za-z0-9_-]{12}$/.test(value))).toBe(true);
});
describe('granice modułu kont', () => {
  it('chwilowy błąd Auth refresh nie oznacza cofnięcia sesji', async () => {
    vi.stubGlobal('crypto',webcrypto);
    const fetchMock=vi.fn(async (url:string)=> new Response(url.includes('slm_account_rate')?'true':'{}',{status:url.includes('slm_account_rate')?200:503}));
    vi.stubGlobal('fetch',fetchMock);
    const handler=createHandler({url:'https://example.invalid',anon:'',service:'',origins:[]});
    const r=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({action:'refresh',refresh_token:webcrypto.randomUUID()})}));
    expect(r.status).toBe(503);expect((await r.json()).code).toBe('service_unavailable');
    expect(fetchMock.mock.calls.some(call=>call[0].includes('logout'))).toBe(false);
  });
  it('normalizuje aliasy bez zgadywania kraju i odrzuca login telefoniczny', () => {
    expect(normalizePhone('+48 (555) 010-123')).toBe('+48555010123');
    expect(() => normalizePhone('555010123')).toThrow();
    expect(normalizeLogin(' Żółw_27 ')).toBe('Żółw_27');
    expect(() => normalizeLogin('+48555010123')).toThrow();
    expect(() => normalizeLogin('login,phone.eq.other')).toThrow();
  });
  it('wybiera pseudonim przy braku pełnej nazwy', () => {
    expect(displayName('nick', ' ', 'full_name')).toBe('nick');
    expect(displayName('nick', 'Jan Testowy', 'full_name')).toBe('Jan Testowy');
    expect(displayName('nick', 'Jan Testowy', 'nickname')).toBe('nick');
  });
  it('odrzuca obcy origin i błędny JSON przed połączeniem z Auth', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const handler = createHandler({url:'https://example.invalid', anon:'', service:'', origins:['http://localhost:5173']});
    const foreign = await handler(new Request('https://example.invalid', { method:'POST', headers:{origin:'https://foreign.invalid'}, body:'{}'}));
    expect(foreign.status).toBe(403);
    const invalid = await handler(new Request('https://example.invalid', { method:'POST', body:'not json'}));
    expect(invalid.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('po wyczerpaniu limitu odmawia przed rozwiązywaniem aliasu i sprawdzaniem hasła', async () => {
    vi.stubGlobal('crypto',webcrypto);
    const fetchMock=vi.fn().mockResolvedValue(new Response('false',{status:200}));
    vi.stubGlobal('fetch',fetchMock);
    const handler=createHandler({url:'https://example.invalid',anon:'',service:'',origins:[]});
    const result=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({action:'login'})}));
    expect(result.status).toBe(429);
    expect((await result.json()).code).toBe('rate_limited');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/rpc/slm_account_rate');
  });
  it('nie zatwierdza logowania rozpoczętego przed równoległym resetem', async () => {
    vi.stubGlobal('crypto',webcrypto);
    const user=webcrypto.randomUUID(), sid=webcrypto.randomUUID();
    const payload=btoa(JSON.stringify({sub:user,session_id:sid}));
    const token=['synthetic',payload,'unsigned'].join('.');
    let authStarted=false;
    const fetchMock=vi.fn(async (url: string, options: RequestInit) => {
      const reply=(data:unknown) => new Response(JSON.stringify(data),{status:200});
      if(url.includes('slm_account_rate')) return reply(true);
      if(url.includes('slm_aliases?')) return reply([{user_id:user,technical_email:'test@slm.invalid'}]);
      if(url.includes('slm_account_security?')) {
        expect(authStarted).toBe(false);
        return reply([{security_version:1,active:true,operation_id:null}]);
      }
      if(url.includes('grant_type=password')) {
        authStarted=true;
        return reply({access_token:token,user:{id:user}});
      }
      if(url.endsWith('/auth/v1/user')) return reply({id:user});
      if(url.includes('slm_account_accept_session')) {
        const input=JSON.parse(options.body as string);
        expect(input.p_version).toBe(1); // baza jest już w wersji 2
        return reply(false);
      }
      if(url.includes('/logout')) return reply({});
      throw new Error('Nieoczekiwane wywołanie');
    });
    vi.stubGlobal('fetch',fetchMock);
    const handler=createHandler({url:'https://example.invalid',anon:'',service:'',origins:[]});
    const result=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({action:'login',identifier:'Fikcyjny',password:webcrypto.randomUUID()})}));
    expect(authStarted).toBe(true);
    expect(result.status).toBe(401);
  });
});

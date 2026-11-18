import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createWorker } from './handler';
import { classifyWebPush, decode64, encode64, encryptPayload, endpointAllowed, sendWebPush, vapidAuthorization } from './webpush';
import type { VapidConfig } from './webpush';
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());
async function receiver() {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  return { pair, p256dh: encode64(new Uint8Array(await webcrypto.subtle.exportKey('raw', pair.publicKey))), auth: encode64(webcrypto.getRandomValues(new Uint8Array(16))) };
}
async function vapidKeys(): Promise<VapidConfig> {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: encode64(new Uint8Array(await webcrypto.subtle.exportKey('raw', pair.publicKey))), privateKey: jwk.d!, subject: 'mailto:test@example.invalid' };
}
const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let k = 0; for (const x of p) { o.set(x, k); k += x.length; } return o; };
async function hkdf(secret: Uint8Array, salt: Uint8Array, info: Uint8Array, n: number) {
  const key = await webcrypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await webcrypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, n * 8));
}
// Odbiorca zgodny z RFC 8291 §3.4 (strona przeglądarki).
async function decrypt(body: Uint8Array, r: Awaited<ReturnType<typeof receiver>>) {
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset).getUint32(16), idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
  expect(rs).toBe(4096); expect(idlen).toBe(65);
  const uaPublic = decode64(r.p256dh);
  const asKey = await webcrypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await webcrypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, r.pair.privateKey, 256));
  const ikm = await hkdf(shared, decode64(r.auth), cat(new TextEncoder().encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(ikm, salt, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);
  const aes = await webcrypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, cipher));
  expect(plain[plain.length - 1]).toBe(2); return new TextDecoder().decode(plain.slice(0, -1));
}
describe('Web Push', () => {
  it('akceptuje wyłącznie znane usługi push (SSRF)', () => {
    for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QAbc', 'https://wns2-par02p.notify.windows.com/w/?token=abc']) expect(endpointAllowed(ok), ok).toBe(true);
    for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.example/x', 'https://fcm.googleapis.com.evil.example/x',
      'https://user:pw@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'https://127.0.0.1/x', 'not a url',
      'https://169.254.169.254/latest/meta-data']) expect(endpointAllowed(bad), bad).toBe(false);
  });
  it('szyfruje aes128gcm tak, że odbiorca odczytuje treść', async () => {
    const r = await receiver(), text = JSON.stringify({ notification_id: crypto.randomUUID(), kind: 'new_match' });
    const body = await encryptPayload(new TextEncoder().encode(text), r.p256dh, r.auth);
    expect(await decrypt(body, r)).toBe(text);
    const second = await encryptPayload(new TextEncoder().encode(text), r.p256dh, r.auth);
    expect(encode64(second)).not.toBe(encode64(body)); // nowa sól i klucz efemeryczny przy każdej wysyłce
  });
  it('odrzuca nieprawidłowe klucze subskrypcji', async () => {
    const r = await receiver();
    await expect(encryptPayload(new Uint8Array(3), 'AAAA', r.auth)).rejects.toThrow('web_push_keys_invalid');
    await expect(encryptPayload(new Uint8Array(3), r.p256dh, 'AAAA')).rejects.toThrow('web_push_keys_invalid');
  });
  it('podpisuje VAPID ES256 z audience = origin endpointu i krótką ważnością', async () => {
    const v = await vapidKeys(), now = 1_800_000_000;
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', v, now);
    const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header)!; expect(m[4]).toBe(v.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(decode64(m[2])));
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: now + 43200, sub: v.subject });
    const key = await webcrypto.subtle.importKey('raw', decode64(v.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, decode64(m[3]), new TextEncoder().encode(m[1] + '.' + m[2]))).toBe(true);
  });
  it('klasyfikuje odpowiedzi usług push', () => {
    expect(classifyWebPush(201).result).toBe('sent');
    expect(classifyWebPush(410).result).toBe('invalid_token'); expect(classifyWebPush(404).result).toBe('invalid_token');
    expect(classifyWebPush(429).result).toBe('retry'); expect(classifyWebPush(503).result).toBe('retry');
    expect(classifyWebPush(400).result).toBe('dead'); expect(classifyWebPush(413).result).toBe('dead');
  });
  it('wysyła zaszyfrowane żądanie z nagłówkami TTL, Topic i VAPID, bez danych grupy', async () => {
    const r = await receiver(), v = await vapidKeys(), id = crypto.randomUUID();
    const fetcher = vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () => new Response(null, { status: 201 }));
    await sendWebPush({ notification_id: id, kind: 'finance_secret', token: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: r.p256dh, auth: r.auth,
      expires_at: new Date(Date.now() + 120000).toISOString() }, v, fetcher);
    const [url, init] = fetcher.mock.calls[0]; const h = init!.headers as Record<string, string>;
    expect(url).toBe('https://fcm.googleapis.com/fcm/send/abc'); expect(init!.redirect).toBe('manual');
    expect(h['Content-Encoding']).toBe('aes128gcm'); expect(h.Topic).toBe(id.replace(/-/g, '')); expect(h.Topic.length).toBeLessThanOrEqual(32);
    expect(Number(h.TTL)).toBeLessThanOrEqual(120); expect(h.Authorization).toMatch(/^vapid t=.+, k=.+$/);
    expect(JSON.parse(await decrypt(init!.body as Uint8Array, r))).toEqual({ notification_id: id, kind: 'finance_secret' });
  });
  it('nie łączy się z niedozwolonym adresem', async () => {
    const r = await receiver(), v = await vapidKeys(), fetcher = vi.fn();
    await expect(sendWebPush({ notification_id: crypto.randomUUID(), kind: 'x', token: 'https://169.254.169.254/x', p256dh: r.p256dh, auth: r.auth,
      expires_at: new Date(Date.now() + 1000).toISOString() }, v, fetcher)).rejects.toThrow('web_push_endpoint_invalid');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
describe('worker z Web Push', () => {
  const secret = 'synthetic-worker-secret';
  async function run(token: string, push: (url: string) => Response) {
    const r = await receiver(), v = await vapidKeys(), calls: { name: string; body: unknown }[] = [];
    const job = { queue_id: crypto.randomUUID(), lease_id: crypto.randomUUID(), notification_id: crypto.randomUUID(), event_id: null, kind: 'new_match',
      platform: 'web', token, p256dh: r.p256dh, auth: r.auth, expires_at: new Date(Date.now() + 600000).toISOString() };
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/rest/v1/rpc/')) {
        const name = u.split('/rpc/')[1]; calls.push({ name, body: JSON.parse(String(init!.body)) });
        return Response.json(name === 'slm_push_claim' ? [job] : name === 'slm_push_check' ? true : null);
      }
      return push(u);
    });
    const handler = createWorker({ url: 'https://db.example.invalid', service: 'synthetic-service', workerSecret: secret, vapid: v }, fetcher);
    const res = await handler(new Request('https://x.invalid', { method: 'POST', headers: { Authorization: 'Bearer ' + secret } }));
    return { res, calls, fetcher };
  }
  it('rezerwuje tylko platformę web bez Firebase i zamyka zadanie jako wysłane', async () => {
    const { res, calls } = await run('https://fcm.googleapis.com/fcm/send/abc', () => new Response(null, { status: 201 }));
    expect(await res.json()).toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(calls.find(c => c.name === 'slm_push_claim')!.body).toEqual({ p_limit: 12, p_platforms: ['web'] });
    expect(calls.find(c => c.name === 'slm_push_finish')!.body).toMatchObject({ p_result: 'sent', p_code: 'ok' });
  });
  it('wyłącza urządzenie po 410 i nie wysyła na obcy adres', async () => {
    const gone = await run('https://fcm.googleapis.com/fcm/send/abc', () => new Response(null, { status: 410 }));
    expect(gone.calls.find(c => c.name === 'slm_push_finish')!.body).toMatchObject({ p_result: 'invalid_token', p_code: 'HTTP_410' });
    const evil = await run('https://169.254.169.254/x', () => new Response(null, { status: 201 }));
    expect(evil.calls.find(c => c.name === 'slm_push_finish')!.body).toMatchObject({ p_result: 'dead', p_code: 'endpoint_not_allowed' });
    expect(evil.fetcher.mock.calls.some(c => String(c[0]).includes('169.254'))).toBe(false);
  });
});

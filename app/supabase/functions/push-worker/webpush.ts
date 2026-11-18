// Web Push (RFC 8030) z szyfrowaniem aes128gcm (RFC 8291/8188) i uwierzytelnieniem VAPID (RFC 8292).
// Tylko WebCrypto; bez zależności zewnętrznych. Klucz prywatny VAPID żyje wyłącznie w sekretach Edge.
export interface VapidConfig { publicKey: string; privateKey: string; subject: string }
export interface WebDelivery { notification_id: string; kind: string; title?: string | null; body?: string | null; token: string; p256dh?: string | null; auth?: string | null; expires_at: string }
export type WebResult = 'sent' | 'retry' | 'dead' | 'invalid_token';
const encoder = new TextEncoder();
export const encode64 = (data: Uint8Array) => btoa(String.fromCharCode(...data)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
export function decode64(value: string): Uint8Array {
  const text = value.replace(/-/g, '+').replace(/_/g, '/'), padded = text + '='.repeat((4 - text.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}
// Serwer nigdy nie łączy się z adresem podanym przez klienta, jeśli nie należy do znanych usług push (ochrona przed SSRF).
const HOSTS = [/^fcm\.googleapis\.com$/, /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/];
export function endpointAllowed(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.username && !url.password && (url.port === '' || url.port === '443')
      && HOSTS.some(h => h.test(url.hostname));
  } catch { return false; }
}
async function hkdf(secret: Uint8Array, salt: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}
export interface Ephemeral { privateKey: CryptoKey; publicKey: Uint8Array }
export async function newEphemeral(): Promise<Ephemeral> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  return { privateKey: pair.privateKey, publicKey: new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)) };
}
/** RFC 8291 §3.4: jeden rekord aes128gcm; nagłówek zawiera sól, rozmiar rekordu i klucz publiczny nadawcy. */
export async function encryptPayload(plain: Uint8Array, p256dh: string, auth: string,
  ephemeral?: Ephemeral, salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16))): Promise<Uint8Array> {
  const uaPublic = decode64(p256dh), authSecret = decode64(auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4 || authSecret.length !== 16 || plain.length > 3000) throw new Error('web_push_keys_invalid');
  const sender = ephemeral ?? await newEphemeral();
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, sender.privateKey, 256));
  const ikm = await hkdf(shared, authSecret, concat(encoder.encode('WebPush: info\0'), uaPublic, sender.publicKey), 32);
  const cek = await hkdf(ikm, salt, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, encoder.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(plain, Uint8Array.of(2))));
  const header = new Uint8Array(21); header.set(salt, 0); new DataView(header.buffer).setUint32(16, 4096); header[20] = sender.publicKey.length;
  return concat(header, sender.publicKey, cipher);
}
export async function vapidAuthorization(endpoint: string, vapid: VapidConfig, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const pub = decode64(vapid.publicKey);
  if (pub.length !== 65 || pub[0] !== 4 || !/^mailto:|^https:\/\//.test(vapid.subject)) throw new Error('vapid_configuration_invalid');
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: vapid.privateKey, x: encode64(pub.slice(1, 33)), y: encode64(pub.slice(33)), ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = (value: unknown) => encode64(encoder.encode(JSON.stringify(value)));
  const unsigned = part({ typ: 'JWT', alg: 'ES256' }) + '.' + part({ aud: new URL(endpoint).origin, exp: now + 12 * 3600, sub: vapid.subject });
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)));
  return `vapid t=${unsigned}.${encode64(signature)}, k=${vapid.publicKey}`;
}
export function classifyWebPush(status: number): { result: WebResult; code: string } {
  if (status >= 200 && status < 300) return { result: 'sent', code: 'ok' };
  // 404/410: subskrypcja wygasła lub użytkownik cofnął zgodę; wyłączamy dokładnie to urządzenie.
  if (status === 404 || status === 410) return { result: 'invalid_token', code: 'HTTP_' + status };
  if ([401, 403, 408, 429].includes(status) || status >= 500) return { result: 'retry', code: 'HTTP_' + status };
  return { result: 'dead', code: 'HTTP_' + status };
}
/** Ekran blokady: tylko identyfikator powiadomienia; treść jest stała po stronie service workera (bez nazw, miejsc i kwot). */
export function payload(job: WebDelivery): Uint8Array {
  const clip = (value: unknown, max: number) => typeof value === 'string' ? Array.from(value).slice(0, max).join('') : undefined;
  return encoder.encode(JSON.stringify({ notification_id: job.notification_id, kind: job.kind, title: clip(job.title, 80), body: clip(job.body, 160) }));
}
export async function sendWebPush(job: WebDelivery, vapid: VapidConfig, fetcher = fetch): Promise<Response> {
  if (!endpointAllowed(job.token) || !job.p256dh || !job.auth) throw new Error('web_push_endpoint_invalid');
  const ttl = Math.max(0, Math.min(3600, Math.floor((Date.parse(job.expires_at) - Date.now()) / 1000)));
  const body = await encryptPayload(payload(job), job.p256dh, job.auth);
  return await fetcher(job.token, { method: 'POST', body, redirect: 'manual', signal: AbortSignal.timeout(10000), headers: {
    Authorization: await vapidAuthorization(job.token, vapid), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
    TTL: String(ttl), Urgency: 'normal', Topic: job.notification_id.replace(/-/g, '') } });
}

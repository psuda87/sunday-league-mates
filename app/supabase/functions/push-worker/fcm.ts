export interface FirebaseAccount { project_id: string; client_email: string; private_key: string }
export interface Delivery {
  queue_id: string; lease_id: string; notification_id: string; event_id: string | null;
  kind: string; platform: 'android' | 'ios'; token: string; expires_at: string;
}
const encoder = new TextEncoder();
const base64url = (data: Uint8Array) => btoa(String.fromCharCode(...data)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const encoded = (value: unknown) => base64url(encoder.encode(JSON.stringify(value)));
export async function tokenHash(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}
// OAuth2 service-account JWT; zakres ograniczony do Firebase Messaging.
export async function accessToken(account: FirebaseAccount, fetcher = fetch): Promise<string> {
  if (!/^[a-z][a-z0-9-]{5,29}$/.test(account.project_id) || !account.client_email.endsWith('.gserviceaccount.com'))
    throw new Error('firebase_configuration_invalid');
  const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const bytes = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = encoded({ alg: 'RS256', typ: 'JWT' }) + '.' + encoded({ iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + base64url(new Uint8Array(signature)) }) });
  const data = await response.json();
  if (!response.ok || typeof data.access_token !== 'string') throw new Error('firebase_oauth_failed');
  return data.access_token;
}
export function message(job: Delivery) {
  const ttl = Math.max(0,Math.min(3600,Math.floor((Date.parse(job.expires_at)-Date.now())/1000)));
  return { message: { token: job.token,
    // Ekran blokady nie ujawnia nazw, lokalizacji, kwot ani zaległości.
    notification: { title: 'Sunday League Mates', body: 'Masz nowe powiadomienie. Otwórz aplikację, aby zobaczyć szczegóły.' },
    data: { notification_id: job.notification_id, kind: job.kind },
    android: { priority: 'normal', ttl: `${ttl}s`, collapse_key: job.notification_id,
      notification: { channel_id: 'slm_updates', tag: job.notification_id, icon: 'ic_stat_slm' } },
    apns: { headers: { 'apns-push-type': 'alert', 'apns-priority': '10', 'apns-collapse-id': job.notification_id,
      'apns-expiration': String(Math.floor(Date.now() / 1000) + ttl) }, payload: { aps: { sound: 'default' } } },
  } };
}
export type Result = 'sent' | 'retry' | 'dead' | 'invalid_token';
export function classify(status: number, body: { error?: { status?: string; details?: { '@type'?: string; errorCode?: string }[] } }): { result: Result; code: string } {
  if (status >= 200 && status < 300) return { result: 'sent', code: 'ok' };
  const fcm = body.error?.details?.find(d => d['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError')?.errorCode;
  if (fcm === 'UNREGISTERED') return { result: 'invalid_token', code: 'UNREGISTERED' };
  // INVALID_ARGUMENT może dotyczyć payloadu; nie usuwamy wtedy sprawnego tokenu.
  if ([401,403,429].includes(status) || status >= 500) return { result: 'retry', code: 'HTTP_' + status };
  return { result: 'dead', code: fcm === 'SENDER_ID_MISMATCH' ? 'SENDER_ID_MISMATCH' : 'HTTP_' + status };
}

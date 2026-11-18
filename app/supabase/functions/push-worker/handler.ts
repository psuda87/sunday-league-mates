import { accessToken, classify, message, tokenHash } from './fcm.ts';
import type { Delivery, FirebaseAccount } from './fcm.ts';
import { classifyWebPush, endpointAllowed, sendWebPush } from './webpush.ts';
import type { VapidConfig } from './webpush.ts';
export interface WorkerEnvironment { url: string; service: string; workerSecret: string; firebaseAccount?: string; vapid?: VapidConfig;
  /** Gdy true, brakujące sekrety (klucze VAPID, sekret schedulera) są czytane z Supabase Vault przez slm_push_config (tylko service_role). */
  vaultConfig?: boolean }
interface VaultConfig { worker_secret?: string | null; vapid_public?: string | null; vapid_private?: string | null; vapid_subject?: string | null }
export function createWorker(env: WorkerEnvironment, fetcher = fetch) {
  let cached: { at: number; value: VaultConfig } | null = null;
  async function rpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    const response = await fetcher(env.url + '/rest/v1/rpc/' + name, { method: 'POST',
      headers: { apikey: env.service, Authorization: 'Bearer ' + env.service, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('database_unavailable');
    return await response.json() as T;
  }
  return async (request: Request): Promise<Response> => {
    const reply = (data: unknown, status = 200) => Response.json(data, { status });
    if (request.method !== 'POST') return reply({ code: 'method_not_allowed' }, 405);
    if (!env.service || !env.url) return reply({ code: 'worker_unconfigured' }, 503);
    let workerSecret = env.workerSecret, vapid = env.vapid;
    if (env.vaultConfig && (!workerSecret || !vapid)) {
      // Konfiguracja z Vault jest buforowana, aby nieuwierzytelnione żądania nie obciążały bazy.
      if (!cached || Date.now() - cached.at > 60000) {
        try { cached = { at: Date.now(), value: await rpc<VaultConfig>('slm_push_config') }; } catch { return reply({ code: 'worker_unconfigured' }, 503); }
      }
      const c = cached.value;
      workerSecret = workerSecret || c.worker_secret || '';
      if (!vapid && c.vapid_public && c.vapid_private) vapid = { publicKey: c.vapid_public, privateKey: c.vapid_private, subject: c.vapid_subject || 'https://slm-soccer.vercel.app' };
    }
    if (!workerSecret) return reply({ code: 'worker_unconfigured' }, 503);
    // Porównanie skrótów, nie sekretów; żadnych sekretów/tokenów w logach.
    const provided = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
    const a = await tokenHash(provided), b = await tokenHash(workerSecret);
    let difference = 0; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
    if (difference !== 0) return reply({ code: 'forbidden' }, 403);
    try {
      await rpc('slm_notifications_prepare');
      // Każdy kanał jest niezależny: brak Firebase nie blokuje Web Push i odwrotnie. Nie rezerwujemy zadań bez konfiguracji.
      const platforms: string[] = [];
      let bearer = '', account: FirebaseAccount | null = null;
      if (env.firebaseAccount) {
        try { account = JSON.parse(env.firebaseAccount) as FirebaseAccount; bearer = await accessToken(account, fetcher); platforms.push('android', 'ios'); }
        catch { account = null; /* Błędny klucz/OAuth nie zużywa prób wiadomości. */ }
      }
      if (vapid) platforms.push('web');
      if (!platforms.length) return reply({ status: 'push_unconfigured', claimed: 0 });
      const jobs = await rpc<Delivery[]>('slm_push_claim', { p_limit: 12, p_platforms: platforms });
      let sent = 0, failed = 0;
      async function send(job: Delivery) {
        const hash = await tokenHash(job.token);
        let result: 'sent' | 'retry' | 'dead' | 'invalid_token' | 'cancelled' = 'retry', code = 'transport_error', retryAfter = 0;
        try {
          const valid = await rpc<boolean>('slm_push_check', { p_queue: job.queue_id, p_lease: job.lease_id, p_token_hash: hash });
          if (!valid) { result = 'cancelled'; code = 'not_eligible'; }
          else {
            let response: Response, outcome: { result: typeof result; code: string };
            if (job.platform === 'web') {
              // Adres subskrypcji pochodzi od klienta: łączymy się tylko ze znanymi usługami push.
              if (!vapid || !endpointAllowed(job.token)) { result = 'dead'; code = 'endpoint_not_allowed'; throw new Error(code); }
              response = await sendWebPush(job, vapid, fetcher);
              outcome = classifyWebPush(response.status);
            } else {
              if (!account) throw new Error('fcm_unavailable');
              response = await fetcher(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
                method: 'POST', headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
                body: JSON.stringify(message(job)), signal: AbortSignal.timeout(10000) });
              outcome = classify(response.status, await response.json().catch(() => ({})));
            }
            result = outcome.result; code = outcome.code;
            const retry = response.headers.get('retry-after');
            if (retry) retryAfter = /^\d+$/.test(retry) ? Number(retry) : Math.max(0,Math.ceil((Date.parse(retry)-Date.now())/1000));
          }
        } catch { /* Timeout może oznaczać przyjętą wysyłkę; ponowienie jest at-least-once. */ }
        await rpc('slm_push_finish', { p_queue: job.queue_id, p_lease: job.lease_id, p_result: result,
          p_code: code, p_token_hash: hash, p_retry_after: Number.isFinite(retryAfter) ? Math.min(3600,retryAfter) : 0 });
        if (result === 'sent') sent++; else failed++;
      }
      // Cztery równoległe dostawy, do 12 prób; mieści się w 2-minutowej rezerwacji.
      for (let i = 0; i < jobs.length; i += 4) {
        const results = await Promise.allSettled(jobs.slice(i,i+4).map(send));
        if (results.some(r => r.status === 'rejected')) throw new Error('finish_failed');
      }
      return reply({ claimed: jobs.length, sent, failed });
    } catch { return reply({ code: 'worker_failed' }, 503); }
  };
}

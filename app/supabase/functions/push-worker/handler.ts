import { accessToken, classify, message, tokenHash } from './fcm.ts';
import type { Delivery, FirebaseAccount } from './fcm.ts';
export interface WorkerEnvironment { url: string; service: string; workerSecret: string; firebaseAccount?: string }
export function createWorker(env: WorkerEnvironment, fetcher = fetch) {
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
    if (!env.workerSecret || !env.service || !env.url) return reply({ code: 'worker_unconfigured' }, 503);
    // Porównanie skrótów, nie sekretów; żadnych sekretów/tokenów w logach.
    const provided = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
    const a = await tokenHash(provided), b = await tokenHash(env.workerSecret);
    let difference = 0; for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
    if (difference !== 0) return reply({ code: 'forbidden' }, 403);
    try {
      await rpc('slm_notifications_prepare');
      if (!env.firebaseAccount) return reply({ status: 'fcm_unconfigured', claimed: 0 });
      // Nie rezerwujemy zadań przy braku klucza / niedostępnym OAuth.
      const account = JSON.parse(env.firebaseAccount) as FirebaseAccount;
      const bearer = await accessToken(account, fetcher);
      const jobs = await rpc<Delivery[]>('slm_push_claim', { p_limit: 12 });
      let sent = 0, failed = 0;
      async function send(job: Delivery) {
        const hash = await tokenHash(job.token);
        let result: 'sent' | 'retry' | 'dead' | 'invalid_token' | 'cancelled' = 'retry', code = 'transport_error', retryAfter = 0;
        try {
          const valid = await rpc<boolean>('slm_push_check', { p_queue: job.queue_id, p_lease: job.lease_id, p_token_hash: hash });
          if (!valid) { result = 'cancelled'; code = 'not_eligible'; }
          else {
            const response = await fetcher(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
              method: 'POST', headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
              body: JSON.stringify(message(job)), signal: AbortSignal.timeout(10000) });
            const outcome = classify(response.status, await response.json().catch(() => ({})));
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

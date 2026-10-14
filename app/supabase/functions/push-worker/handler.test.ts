import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createWorker } from './handler';
beforeEach(() => vi.stubGlobal('crypto',webcrypto));
afterEach(() => vi.unstubAllGlobals());
it('bez konfiguracji Firebase przygotowuje przypomnienia, ale nie rezerwuje wysyłek', async () => {
  const fetcher = vi.fn<(url: string | URL | Request, options?: RequestInit) => Promise<Response>>(async () => new Response('0',{ status: 200 }));
  const secret = crypto.randomUUID();
  const handler = createWorker({ url: 'https://example.invalid',service: 'synthetic-service',workerSecret: secret },fetcher);
  const response = await handler(new Request('https://example.invalid',{ method: 'POST',headers: { Authorization: 'Bearer '+secret } }));
  expect(response.status).toBe(200); expect((await response.json()).status).toBe('fcm_unconfigured');
  expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0]).toContain('slm_notifications_prepare');
});
it('odmawia bez sekretu schedulera przed bazą i FCM', async () => {
  const fetcher = vi.fn();
  const handler = createWorker({ url: 'https://example.invalid',service: 'synthetic-service',workerSecret: crypto.randomUUID() },fetcher);
  const response = await handler(new Request('https://example.invalid',{ method: 'POST' }));
  expect(response.status).toBe(403); expect(fetcher).not.toHaveBeenCalled();
});

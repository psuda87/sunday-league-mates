import { createWorker } from './handler.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
Deno.serve(createWorker({ url: Deno.env.get('SUPABASE_URL') ?? '', service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  workerSecret: Deno.env.get('PUSH_WORKER_SECRET') ?? '', firebaseAccount: Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') }));

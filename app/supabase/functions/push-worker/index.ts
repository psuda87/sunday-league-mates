import { createWorker } from './handler.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
const publicKey = Deno.env.get('VAPID_PUBLIC_KEY'), privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
Deno.serve(createWorker({ url: Deno.env.get('SUPABASE_URL') ?? '', service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  workerSecret: Deno.env.get('PUSH_WORKER_SECRET') ?? '', firebaseAccount: Deno.env.get('FCM_SERVICE_ACCOUNT_JSON'),
  vapid: publicKey && privateKey ? { publicKey, privateKey, subject: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@slm-soccer.vercel.app' } : undefined }));

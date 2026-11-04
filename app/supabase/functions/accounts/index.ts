import { createHandler } from './handler.ts';
import type {SmtpConnection} from './smtp.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void; connectTls(options:{hostname:string;port:number}):Promise<SmtpConnection> };
const url = Deno.env.get('SUPABASE_URL') ?? '';
if (url !== 'https://hjtcyybkxebvdropchac.supabase.co') throw new Error('Niewłaściwy projekt');
Deno.serve(createHandler({ url, anon: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  emailSignupEnabled: Deno.env.get('SLM_EMAIL_SIGNUP_ENABLED') === 'true',
  emailRedirectUrl: Deno.env.get('ACCOUNTS_EMAIL_REDIRECT_URL'),
  emailHookSecret: Deno.env.get('ACCOUNTS_EMAIL_HOOK_SECRET'),
  smtp:{host:Deno.env.get('ACCOUNTS_SMTP_HOST'),user:Deno.env.get('ACCOUNTS_SMTP_USER'),password:Deno.env.get('ACCOUNTS_SMTP_PASSWORD'),from:Deno.env.get('ACCOUNTS_SMTP_FROM')},
  connectSmtp:options=>Deno.connectTls(options),
  origins: (Deno.env.get('ACCOUNTS_ALLOWED_ORIGINS') ??
    'http://localhost:5173,http://127.0.0.1:5173,https://localhost,capacitor://localhost').split(',').map(value=>value.trim()).filter(Boolean) }));

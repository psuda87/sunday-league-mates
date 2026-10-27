import {onlineConfiguration} from './onlineProtection.ts';
import {smtpEmail} from './emailSmtp.ts';
import { createHandler } from './handler.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
declare const EdgeRuntime:{waitUntil(task:Promise<unknown>):void};
const url = Deno.env.get('SUPABASE_URL') ?? '';
const expected=Deno.env.get('SLM_EXPECTED_PROJECT_REF')??'hjtcyybkxebvdropchac';
if(!/^[a-z]{20}$/.test(expected))throw new Error('Invalid expected project');
if (url !== 'https://'+expected+'.supabase.co') throw new Error('Niewłaściwy projekt');
Deno.serve(createHandler({onlineRequired:Deno.env.get('SLM_ONLINE_MODE')==='true',online:onlineConfiguration(name=>Deno.env.get(name)),email:smtpEmail(name=>Deno.env.get(name),url,task=>EdgeRuntime.waitUntil(task)), url, anon: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  emailSignupEnabled: Deno.env.get('SLM_EMAIL_SIGNUP_ENABLED') === 'true',
  accountFoundationEnabled: Deno.env.get('SLM_ACCOUNT_FOUNDATION_ENABLED') === 'true',
  accountModelEnabled: Deno.env.get('SLM_ACCOUNT_MODEL_ENABLED') === 'true',
  origins: (Deno.env.get('ACCOUNTS_ALLOWED_ORIGINS') ??
    'http://localhost:5173,http://127.0.0.1:5173,https://localhost,capacitor://localhost').split(',') }));

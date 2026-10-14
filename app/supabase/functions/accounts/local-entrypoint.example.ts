// Przygotowany entrypoint do późniejszych lokalnych testów Deno, nie produkcyjny.
// Nie zmienia ochrony projektu w index.ts. Nie deployować tego pliku.
import { createHandler } from './handler.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
const url = Deno.env.get('SUPABASE_URL') ?? '';
if (!['http://127.0.0.1:54321','http://localhost:54321','http://kong:8000'].includes(url))
  throw new Error('Entry point dopuszcza wyłącznie lokalny Supabase');
Deno.serve(createHandler({ url,anon: Deno.env.get('SUPABASE_ANON_KEY') ?? '',service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  origins: ['http://localhost:5173','http://127.0.0.1:5173','https://localhost','capacitor://localhost'] }));

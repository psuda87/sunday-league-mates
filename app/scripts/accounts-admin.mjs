// Wspólny kod lokalnych narzędzi właściciela. Żadne odpowiedzi z kluczami nie są logowane.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
export const ref = 'hjtcyybkxebvdropchac';
export const url = `https://${ref}.supabase.co`;
export function readLocalEnv(name) {
  try {
    return Object.fromEntries(readFileSync(new URL('../' + name, import.meta.url), 'utf8').split(/\r?\n/)
      .filter(l => /^[A-Z_]+=/.test(l)).map(l => {
        const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
      }));
  } catch { return {}; }
}
export function assertBranch(expected = 'feat/auth') {
  if (execFileSync('git', ['branch', '--show-current'], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' }).trim() !== expected)
    throw new Error('Wymagany branch ' + expected);
}
export async function management(path, method = 'GET', body) {
  const token = process.env.SUPABASE_ACCESS_TOKEN || readLocalEnv('.env.auth-proof').SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('Brak lokalnego SUPABASE_ACCESS_TOKEN');
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, { method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Management HTTP ${r.status}`);
  return r.json();
}
export async function server() {
  const keys = await management('/api-keys');
  const service = keys.find(k => k.name === 'service_role')?.api_key;
  const anon = keys.find(k => k.name === 'anon')?.api_key;
  if (!service || !anon) throw new Error('Brak kluczy serwera');
  async function request(path, method = 'GET', body, token = null, privileged = true) {
    const r = await fetch(url + path, { method, headers: { apikey: privileged ? service : anon,
      Authorization: `Bearer ${token ?? (privileged ? service : anon)}`,
      'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
  }
  return { request };
}
export function assertSafeConfig(c) {
  if (!c.disable_signup || !c.external_email_enabled || c.external_phone_enabled || c.mailer_autoconfirm ||
      !c.security_update_password_require_current_password || c.password_min_length < 8 ||
      !c.hook_send_email_enabled || !c.hook_send_sms_enabled ||
      c.external_anonymous_users_enabled || c.security_manual_linking_enabled ||
      c.security_update_password_require_reauthentication || !c.mailer_secure_email_change_enabled ||
      !['slm_account_block_sms', 'slm_auth_proof_block_sms'].some(n => c.hook_send_sms_uri === `pg-functions://postgres/public/${n}`) ||
      !['slm_account_block_email', 'slm_auth_proof_block_email'].some(n => c.hook_send_email_uri === `pg-functions://postgres/public/${n}`))
    throw new Error('Niebezpieczna konfiguracja Auth; przerwano przed tworzeniem kont');
  for (const k of Object.keys(c)) if (/^mailer_notifications_.*_enabled$/.test(k) && c[k])
    throw new Error('Powiadomienia mailowe są włączone');
}

// Node 24. Serwerowy harness, bez UI i bez zewnętrznych zależności.
// Nigdy nie drukować odpowiedzi Auth, nagłówków ani treści błędów HTTP.
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ref = 'hjtcyybkxebvdropchac';
const url = `https://${ref}.supabase.co`;
const root = new URL('../../', import.meta.url);
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
if (branch !== 'feat/auth') throw new Error('Wymagany branch feat/auth');
if (existsSync(new URL('../supabase/functions/accounts/index.ts', import.meta.url))) {
  console.log('ARCHIWUM: harness proof wyłączony po wdrożeniu modułu kont. Użyj app/scripts/test-accounts.mjs. Test e-maila pozostaje otwarty.');
  process.exit(2);
}
let pat = process.env.SUPABASE_ACCESS_TOKEN;
if (!pat) {
  try {
    const env = readFileSync(new URL('../.env.auth-proof', import.meta.url), 'utf8');
    pat = env.match(/^SUPABASE_ACCESS_TOKEN\s*=\s*(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
  } catch { /* Brak konfiguracji nie ujawnia danych. */ }
}
if (!pat) {
  console.log('BLOKADA: dodaj SUPABASE_ACCESS_TOKEN do app/.env.auth-proof. Nie podawaj go w rozmowie.');
  process.exit(2);
}

let stage = 'odczyt konfiguracji';
const users = new Set();
const results = [];
let service, anon;
class ProofError extends Error {}
function check(ok, message) { if (!ok) throw new ProofError(message); }
async function http(path, { method = 'GET', body, token, management = false, admin = false } = {}) {
  const base = management ? 'https://api.supabase.com' : url;
  const headers = management ? { Authorization: `Bearer ${pat}` } : {
    apikey: admin ? service : anon, Authorization: `Bearer ${token ?? (admin ? service : anon)}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (path.startsWith('/rest/v1/')) headers.Prefer = 'return=representation';
  const response = await fetch(base + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* Nie zapisujemy surowej odpowiedzi. */ }
  return { ok: response.ok, status: response.status, data,
    retryAfter: response.headers.get('retry-after'), responseDate: response.headers.get('date') };
}
async function success(path, options) {
  const r = await http(path, options);
  check(r.ok, `HTTP_${r.status}`);
  return r.data;
}
const manage = (path, options = {}) => success(`/v1/projects/${ref}${path}`, { ...options, management: true });
const table = (name, query = '') => `/rest/v1/slm_auth_proof_${name}${query}`;
const rpc = (name) => `/rest/v1/rpc/slm_auth_proof_${name}`;
const freshPassword = () => randomBytes(32).toString('base64url') + 'Aa7!';
const sid = (session) => JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString()).session_id;
// JWT payload odczytujemy dopiero po weryfikacji /user, nie traktujemy dekodowania jako weryfikacji.
async function verified(session) {
  const u = await success('/auth/v1/user', { token: session.access_token });
  check(u.id === session.user.id && typeof sid(session) === 'string', 'JWT_ID');
  return u;
}
async function account(id) {
  const rows = await success(table('accounts', `?user_id=eq.${id}`), { admin: true });
  check(rows.length === 1, 'ACCOUNT_COUNT');
  return rows[0];
}
async function approve(session, state) {
  await verified(session);
  check(session.user.id === state.user_id && !state.must_change_password, 'SESSION_GATE');
  await success(table('sessions'), { method: 'POST', admin: true, body: {
    user_id: state.user_id, session_id: sid(session), security_version: state.security_version,
  } });
}
async function authLogin(email, password) {
  return http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
}
async function login(alias, password) {
  const column = alias.startsWith('+') ? 'phone' : 'login';
  const rows = await success(table('accounts', `?${column}=eq.${encodeURIComponent(alias)}`), { admin: true });
  check(rows.length === 1, 'ALIAS');
  const r = await authLogin(rows[0].technical_email, password);
  check(r.ok && r.data.user.id === rows[0].user_id, 'LOGIN');
  const session = r.data;
  await verified(session);
  if (!rows[0].must_change_password) await approve(session, rows[0]);
  return session;
}
async function change(session, current, next) {
  const user = await verified(session);
  const state = await account(user.id);
  const proof = await authLogin(state.technical_email, current);
  if (!proof.ok || proof.data.user.id !== user.id || current === next) return false;
  // Pomocnicza sesja jest wylogowywana wyłącznie lokalnie, bez unieważniania innych sesji.
  await success('/auth/v1/logout?scope=local', { method: 'POST', token: proof.data.access_token });
  await success('/auth/v1/user', { method: 'PUT', token: session.access_token,
    body: { password: next, current_password: current } });
  const done = await success(table('accounts', `?user_id=eq.${user.id}&security_version=eq.${state.security_version}`), {
    method: 'PATCH', admin: true, body: { must_change_password: false },
  });
  check(done.length === 1, 'CHANGE_VERSION_CONFLICT');
  // Zatwierdzamy nową sesję dopiero po udanej zmianie, nie sesję z hasłem tymczasowym.
  return true;
}
async function isAdmin(session) {
  await verified(session);
  return success(rpc('is_admin'), { method: 'POST', token: session.access_token, body: {} });
}
async function reset(actor, targetId, password) {
  if (!(await isAdmin(actor))) return false;
  const target = await account(targetId);
  await success(table('accounts', `?user_id=eq.${targetId}`), { method: 'PATCH', admin: true,
    body: { must_change_password: true, security_version: target.security_version + 1 } });
  await success(table('sessions', `?user_id=eq.${targetId}`), { method: 'DELETE', admin: true });
  await success(`/auth/v1/admin/users/${targetId}`, { method: 'PUT', admin: true, body: { password } });
  return true;
}
async function protectedRows(session) {
  return success(table('protected'), { token: session?.access_token });
}
async function create(kind, password) {
  const email = `${randomUUID()}@slm-auth-proof.invalid`;
  const u = await success('/auth/v1/admin/users', { method: 'POST', admin: true,
    body: { email, password, email_confirm: true, user_metadata: { slm_auth_proof: true } } });
  check(u.id, 'ADMIN_CREATE');
  users.add(u.id); // Zapis przed kolejnym wywołaniem zapewnia cleanup także po częściowym błędzie.
  const state = { user_id: u.id, login: `proof_${kind}_${randomUUID().slice(0, 8)}`,
    // Fikcyjne numery z puli 555-01xx: wyłącznie alias, nigdy auth.phone.
    phone: kind === 'admin' ? '+12025550101' : '+12025550102', technical_email: email,
    is_admin: kind === 'admin', must_change_password: true, security_version: 1 };
  await success(table('accounts'), { method: 'POST', admin: true, body: state });
  await success(table('protected'), { method: 'POST', admin: true,
    body: { user_id: u.id, message: 'Fikcyjny wiersz testowy' } });
  return state;
}
function passed(number, name) {
  results.push({ scenario: number, status: 'PASS', name });
  console.log(`PASS ${number}: ${name}`);
}
try {
  const before = await manage('/config/auth');
  const safeFields = ['disable_signup', 'external_email_enabled', 'external_phone_enabled',
    'mailer_autoconfirm', 'mailer_secure_email_change_enabled', 'hook_send_email_enabled',
    'hook_send_sms_enabled', 'security_captcha_enabled'];
  console.log(JSON.stringify({ initial_auth_settings: Object.fromEntries(safeFields.map(k => [k, before[k]])) }));
  if (process.argv.includes('--inspect')) process.exit(0);
  if (process.argv.includes('--email-change-only')) {
    stage = 'kontrola blokady wiadomości';
    check(before.hook_send_email_enabled && before.hook_send_email_uri ===
      'pg-functions://postgres/public/slm_auth_proof_block_email', 'EMAIL_HOOK_REQUIRED');
    check(before.hook_send_sms_enabled && !before.external_phone_enabled && !before.mailer_autoconfirm,
      'SAFE_SETTINGS_REQUIRED');
    for (const k of Object.keys(before)) {
      if (/^mailer_notifications_.*_enabled$/.test(k)) check(!before[k], 'NOTIFICATIONS_ENABLED');
    }
    const keys = await manage('/api-keys');
    service = keys.find(k => k.name === 'service_role')?.api_key;
    anon = keys.find(k => k.name === 'anon')?.api_key;
    check(service && anon, 'API_KEYS_UNAVAILABLE');
    console.log(JSON.stringify({ email_limit_per_hour: before.rate_limit_email_sent,
      attempt_time_utc: new Date().toISOString() }));
    stage = 'jedna próba zmiany e-maila';
    const password = freshPassword();
    const player = await create('emailprobe', password);
    const loginResult = await authLogin(player.technical_email, password);
    check(loginResult.ok, 'LOGIN');
    const session = loginResult.data;
    await verified(session);
    const target = `${randomUUID()}@slm-auth-proof.invalid`;
    const attempt = await http('/auth/v1/user', { method: 'PUT', token: session.access_token,
      body: { email: target } });
    const state = await success(`/auth/v1/admin/users/${player.user_id}`, { admin: true });
    const unchanged = state.email === player.technical_email;
    const blockedByHook = !attempt.ok && JSON.stringify(attempt.data).includes('SLM_AUTH_PROOF_EMAIL_DISABLED');
    console.log(JSON.stringify({ email_change_status: attempt.status,
      code: /^[a-z_]+$/.test(attempt.data?.error_code ?? '') ? attempt.data.error_code : null,
      retry_after: attempt.retryAfter, response_date: attempt.responseDate,
      blocked_by_hook: blockedByHook, email_unchanged: unchanged,
      pending_target: state.new_email === target }));
    check(unchanged, 'EMAIL_CHANGED');
    const after = await manage('/config/auth');
    for (const k of Object.keys(before)) {
      if (/^(rate_limit_|hook_send_|mailer_notifications_)/.test(k))
        check(JSON.stringify(after[k]) === JSON.stringify(before[k]), 'CONFIG_CHANGED');
    }
    if (attempt.status === 429) {
      results.push({ scenario: 3, status: 'PARTIAL' });
      console.log('NIEZWERYFIKOWANY: limit nadal blokuje próbę; bez ponowienia.');
      process.exitCode = 1;
    } else {
      check(blockedByHook && state.new_email !== target, 'EMAIL_HOOK_NOT_PROVEN');
      passed(3, 'Zmiana e-maila zatrzymana przez hook; adres niezmieniony; hook nie wysyła wiadomości');
    }
  } else {
  // Nie nadpisujemy cudzych hooków i nie wyłączamy istniejącej CAPTCHA.
  for (const type of ['email', 'sms']) {
    check(!before[`hook_send_${type}_enabled`] ||
      before[`hook_send_${type}_uri`] === `pg-functions://postgres/public/slm_auth_proof_block_${type}`,
    'EXISTING_HOOK');
  }
  check(!before.security_captcha_enabled, 'CAPTCHA_REQUIRES_INTERACTIVE_TEST');
  const patch = {
    disable_signup: true, external_email_enabled: true, external_phone_enabled: false,
    external_anonymous_users_enabled: false, security_manual_linking_enabled: false,
    mailer_autoconfirm: false, mailer_secure_email_change_enabled: true,
    hook_send_email_enabled: true, hook_send_email_uri: 'pg-functions://postgres/public/slm_auth_proof_block_email',
    hook_send_sms_enabled: true, hook_send_sms_uri: 'pg-functions://postgres/public/slm_auth_proof_block_sms',
  };
  for (const k of Object.keys(before)) {
    if (/^mailer_notifications_.*_enabled$/.test(k)) patch[k] = false;
  }
  stage = 'ustawienia Auth';
  await manage('/config/auth', { method: 'PATCH', body: patch });
  const after = await manage('/config/auth');
  for (const [key, value] of Object.entries(patch)) check(after[key] === value, 'CONFIG_NOT_APPLIED');
  console.log(JSON.stringify({ applied_auth_settings: patch }));
  const keys = await manage('/api-keys');
  service = keys.find(k => k.name === 'service_role')?.api_key;
  anon = keys.find(k => k.name === 'anon')?.api_key;
  check(service && anon, 'API_KEYS_UNAVAILABLE');
  stage = 'blokada wiadomości';
  // Przed utworzeniem kont potwierdzamy, że faktyczny Auth wywołuje blokujący hook.
  // Domena .invalid nie należy do żadnej osoby i nie może odbierać poczty.
  const probe = await http('/auth/v1/recover', { method: 'POST', body: { email: `${randomUUID()}@slm-auth-proof.invalid` } });
  // Nieistniejące konto może zwrócić sukces bez wywołania hooka. Pełny test po create.
  check(probe.status < 500, 'AUTH_SETTINGS_NOT_READY');

  stage = 'scenariusz 1';
  const temp = freshPassword(), first = freshPassword(), resetTemp = freshPassword(), final = freshPassword();
  const adminTemp = freshPassword(), adminFinal = freshPassword();
  const signupEmail = `${randomUUID()}@slm-auth-proof.invalid`;
  const signup = await http('/auth/v1/signup', { method: 'POST', body: {
    email: signupEmail, password: freshPassword(),
  } });
  if (signup.data?.id && signup.data.email === signupEmail) users.add(signup.data.id);
  console.log(JSON.stringify({ signup_status: signup.status, signup_code:
    /^[a-z_]+$/.test(signup.data?.error_code ?? '') ? signup.data.error_code : null }));
  check(!signup.ok && (signup.data?.error_code === 'signup_disabled' || signup.data?.msg === 'Signups not allowed for this instance'), 'PUBLIC_SIGNUP_NOT_DISABLED');
  const player = await create('player', temp);
  const admin = await create('admin', adminTemp);
  passed(1, 'Admin API tworzy konto; publiczna rejestracja odrzucona');

  stage = 'scenariusz 2';
  const old = await login(player.login, temp);
  const byPhone = await login(player.phone, temp);
  check(old.user.id === byPhone.user.id, 'ALIAS_UUID');
  check(!(await authLogin(player.technical_email, freshPassword())).ok, 'WRONG_PASSWORD');
  passed(2, 'Login i telefon prowadzą do jednego UUID z jednym hasłem');

  stage = 'scenariusz 3';
  let emailProof = true;
  for (const [path, body] of [
    ['/auth/v1/recover', { email: player.technical_email }],
    ['/auth/v1/otp', { email: player.technical_email, create_user: false }],
  ]) {
    const r = await http(path, { method: 'POST', body });
    const blockedByHook = !r.ok && JSON.stringify(r.data).includes('SLM_AUTH_PROOF_EMAIL_DISABLED');
    console.log(JSON.stringify({ email_operation: path, status: r.status, blocked_by_hook: blockedByHook,
      code: /^[a-z_]+$/.test(r.data?.error_code ?? '') ? r.data.error_code : null }));
    emailProof &&= blockedByHook;
  }
  const emailChange = await http('/auth/v1/user', { method: 'PUT', token: old.access_token,
    body: { email: `${randomUUID()}@slm-auth-proof.invalid` } });
  console.log(JSON.stringify({ email_change_status: emailChange.status, email_change_code:
    /^[a-z_]+$/.test(emailChange.data?.error_code ?? '') ? emailChange.data.error_code : null }));
  emailProof &&= !emailChange.ok && JSON.stringify(emailChange.data).includes('SLM_AUTH_PROOF_EMAIL_DISABLED');
  const sms = await http('/auth/v1/otp', { method: 'POST', body: { phone: player.phone, create_user: false } });
  check(!sms.ok, 'SMS_DISABLED');
  check((await verified(old)).phone === '', 'NO_AUTH_PHONE');
  if (emailProof) passed(3, 'Recovery, OTP i zmiana e-maila zatrzymane przez hook; Phone wyłączony');
  else {
    results.push({ scenario: 3, status: 'PARTIAL' });
    console.log('PARTIAL 3: nie wszystkie operacje dotarły do blokującego hooka');
    process.exitCode = 1;
  }

  stage = 'scenariusz 4';
  check((await protectedRows(old)).length === 0, 'TEMP_READ');
  const write = await http(table('protected', `?user_id=eq.${player.user_id}`), {
    method: 'PATCH', token: old.access_token, body: { message: 'Próba obejścia' } });
  check(!write.ok || write.data.length === 0, 'TEMP_WRITE');
  const anonymous = await http(table('protected'));
  check(!anonymous.ok || anonymous.data.length === 0, 'ANON_ACCESS');
  passed(4, 'RLS blokuje odczyt i zapis przed zmianą hasła');

  stage = 'scenariusz 5';
  check(!(await change(old, freshPassword(), first)), 'BAD_CURRENT_PASSWORD');
  check((await protectedRows(old)).length === 0, 'BAD_CHANGE_OPENED');
  check(await change(old, temp, first), 'CHANGE');
  const active = await login(player.login, first);
  check((await protectedRows(active)).length === 1, 'AFTER_CHANGE_READ');
  check((await protectedRows(old)).length === 0, 'TEMP_SESSION_APPROVED');
  const other = await login(admin.login, adminTemp);
  check(await change(other, adminTemp, adminFinal), 'ADMIN_FIRST_CHANGE');
  const adminSession = await login(admin.login, adminFinal);
  passed(5, 'Poprawna zmiana odblokowuje nową sesję; błędne hasło odrzucone');

  stage = 'scenariusz 6';
  check(await reset(adminSession, player.user_id, resetTemp), 'ADMIN_RESET');
  check((await protectedRows(active)).length === 0, 'RESET_OLD_JWT');
  check(!(await authLogin(player.technical_email, first)).ok, 'OLD_PASSWORD');
  const resetSession = await login(player.phone, resetTemp);
  check((await protectedRows(resetSession)).length === 0, 'RESET_TEMP_GATE');
  check(await change(resetSession, resetTemp, final), 'RESET_CHANGE');
  const current = await login(player.phone, final);
  check((await protectedRows(current)).length === 1, 'RESET_CURRENT_READ');
  check((await protectedRows(active)).length === 0, 'RESET_OLD_JWT_REOPENED');
  const refresh = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST',
    body: { refresh_token: active.refresh_token } });
  if (refresh.ok) check((await protectedRows(refresh.data)).length === 0, 'OLD_REFRESH_REOPENED');
  passed(6, 'Reset odrzuca poprzedni JWT i odświeżoną sesję także po odblokowaniu');

  stage = 'scenariusz 7';
  await success('/auth/v1/user', { method: 'PUT', token: current.access_token,
    body: { data: { role: 'admin', is_admin: true, must_change_password: false } } });
  check(!(await isAdmin(current)), 'METADATA_ADMIN');
  const promotion = await http(table('accounts', `?user_id=eq.${player.user_id}`), {
    method: 'PATCH', token: current.access_token, body: { is_admin: true, must_change_password: false } });
  check(!promotion.ok || promotion.data.length === 0, 'DIRECT_ROLE_WRITE');
  check(!(await isAdmin(current)), 'ROLE_PROMOTION');
  check(!(await reset(current, admin.user_id, freshPassword())), 'PLAYER_RESET_ALLOWED');
  check(await isAdmin(adminSession), 'ADMIN_ROLE_LOST');
  passed(7, 'Metadane, bezpośredni UPDATE i reset cudzego hasła nie nadają administratora');
  }
} catch (error) {
  // Celowo bez komunikatu błędu/stacka: mogą zawierać odpowiedzi dostawcy lub sekrety.
  console.log(`FAIL: ${stage}${error instanceof ProofError ? ` (${error.message})` : ''}`);
  process.exitCode = 1;
} finally {
  for (const id of users) {
    try {
      const r = await http(`/auth/v1/admin/users/${id}`, { method: 'DELETE', admin: true });
      check(r.ok, 'DELETE_FAILED');
    } catch {
      console.log('FAIL: usunięcie konta testowego; sprawdź rekordy oznaczone slm_auth_proof');
      process.exitCode = 1;
    }
  }
  console.log(JSON.stringify({ scenarios_passed: results.filter(r => r.status === 'PASS').length,
    scenarios_partial: results.filter(r => r.status === 'PARTIAL').length, cleanup_attempted: users.size }));
}

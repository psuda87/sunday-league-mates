// Rzeczywisty test wdrożonej funkcji; bez testowania wysyłki i zmiany technicznego adresu.
import { randomUUID, randomBytes } from 'node:crypto';
import { assertBranch, assertSafeConfig, management, server, url } from './accounts-admin.mjs';
const ids = new Set();
let api, stage = 'konfiguracja';
const pwd = () => randomBytes(24).toString('base64url') + 'Aa7!';
function check(value, label = 'kontrola') { if (!value) throw new Error(label); }
async function invoke(action, body = {}, session) {
  const r = await fetch(url + '/functions/v1/accounts', { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }, body: JSON.stringify({ ...body, action }), signal: AbortSignal.timeout(20000) });
  return { ok: r.ok, status: r.status, data: await r.json() };
}
async function yes(action, body = {}, session) {
  const r = await invoke(action, body, session); check(r.ok, `${action}: HTTP ${r.status}, ${r.data.code ?? 'brak kodu'}`); return r.data;
}
function pass(name) { console.log('PASS: ' + name); }
try {
  assertBranch(); assertSafeConfig(await management('/config/auth')); api = await server();
  const password = pwd(), email = `${randomUUID()}@slm.invalid`, login = 'owner_' + randomUUID().slice(0, 8);
  const user = await api.request('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true });
  check(user.ok); ids.add(user.data.id);
  const provision = await api.request('/rest/v1/rpc/slm_account_provision', 'POST', {
    p_user: user.data.id, p_login: login, p_phone: '+12025550111', p_email: email, p_admin: false,
  }); check(provision.ok);
  // Tylko własny NOWO utworzony fixture. Nie używamy ani nie zmieniamy prawdziwego administratora.
  const fixtureRole=await api.request('/rest/v1/slm_roles?user_id=eq.'+user.data.id,'PATCH',{role:'admin'});
  check(fixtureRole.ok);
  stage = 'logowanie błędne i blokada';
  const bad = await invoke('login', { identifier: login, password: pwd() });
  const absent = await invoke('login', { identifier: 'absent_' + randomUUID().slice(0, 8), password: pwd() });
  check(bad.status === 401 && absent.status === 401 && bad.data.error === absent.data.error);
  const temp = await yes('login', { identifier: login, password });
  check(temp.must_change_password, 'stan hasła tymczasowego');
  check((await invoke('profile', {}, temp)).status === 403, 'blokada profilu');
  const direct = await api.request('/rest/v1/slm_profiles', 'GET', undefined, temp.access_token, false);
  check(direct.ok && direct.data.length === 0, `RLS HTTP ${direct.status}`);
  pass('Błędne logowanie i wymuszona zmiana hasła w API oraz RLS');
  stage = 'administrator zmiana hasła';
  const adminPassword = randomBytes(6).toString('base64url'); // Dokładnie 8 znaków, wyłącznie pamięć.
  check((await invoke('password', { current_password: password, new_password: randomBytes(5).toString('base64url') }, temp)).status === 400, 'odrzucenie 7 znaków');
  const bypass = await api.request('/auth/v1/user', 'PUT', { password: adminPassword }, temp.access_token, false);
  const bypassCode = bypass.data.error_code ?? bypass.data.code;
  check(!bypass.ok && ['current_password_required', 'reauthentication_needed'].includes(bypassCode), `Auth wymaga obecnego hasła: HTTP ${bypass.status}, ${bypassCode ?? 'brak kodu'}`);
  check(!(await invoke('password', { current_password: pwd(), new_password: adminPassword }, temp)).ok);
  let admin = await yes('password', { current_password: password, new_password: adminPassword }, temp);
  check(!admin.must_change_password && admin.role === 'admin');
  check(!(await invoke('profile', {}, temp)).ok);
  pass('Zmiana hasła odrzuca wcześniejszą sesję');
  stage = 'tworzenie zawodnika i konflikt';
  const playerLogin = 'player_' + randomUUID().slice(0, 8);
  const created = await yes('create_account', { login: playerLogin, phone: '+12025550112', role: 'admin' }, admin);
  ids.add(created.user_id);
  check(typeof created.temporary_password === 'string' && created.temporary_password.length === 12, 'długość hasła tworzonego konta');
  const conflict = await invoke('create_account', { login: playerLogin, phone: '+12025550113' }, admin);
  check(conflict.status === 409);
  let player = await yes('login', { identifier: '+12025550112', password: created.temporary_password });
  check(player.role === 'member' && player.must_change_password);
  let playerPassword = pwd();
  player = await yes('password', { current_password: created.temporary_password, new_password: playerPassword }, player);
  check(!(await invoke('list_accounts', {}, player)).ok);
  check(!(await invoke('create_account', { login: 'illegal_account', phone: '+12025550114' }, player)).ok);
  check(!(await invoke('reset_password', { user_id: user.data.id }, player)).ok);
  const directRole = await api.request('/rest/v1/slm_roles?user_id=eq.' + created.user_id,
    'PATCH', { role: 'admin' }, player.access_token, false);
  check(!directRole.ok);
  const bootstrapRpc = await api.request('/rest/v1/rpc/slm_account_provision','POST',{
    p_user:created.user_id,p_login:playerLogin,p_phone:'+12025550112',p_email:'test@slm.invalid',p_admin:true,
  },player.access_token,false);
  check(!bootstrapRpc.ok, 'brak publicznego bootstrap');
  const profileWrite = await api.request('/rest/v1/slm_profiles?user_id=eq.' + user.data.id,'PATCH',{
    full_name:'Niedozwolona zmiana',
  },player.access_token,false);
  check(!profileWrite.ok, 'bezpośredni zapis cudzego profilu');
  const metadata = await api.request('/auth/v1/user', 'PUT', { data: { role: 'admin', is_admin: true } }, player.access_token, false);
  check(metadata.ok && !(await invoke('list_accounts', {}, player)).ok);
  pass('Tylko administrator tworzy/resetuje konta; metadane nie nadają roli');
  stage = 'profil i aliasy';
  let p = await yes('save_profile', { full_name: '', display_as: 'full_name' }, player);
  check(p.display_name === playerLogin);
  p = await yes('save_profile', { full_name: 'Fikcyjny Zawodnik', display_as: 'full_name' }, player);
  check(p.display_name === 'Fikcyjny Zawodnik');
  const changedLogin = 'changed_' + randomUUID().slice(0, 8);
  check(!(await invoke('identifiers', { login: changedLogin, phone: '+12025550115', current_password: pwd() }, player)).ok);
  check((await invoke('identifiers', { login, phone: '+12025550111', current_password: playerPassword }, player)).status === 409);
  const oldPlayer = player;
  player = await yes('identifiers', { login: changedLogin, phone: '+12025550115', current_password: playerPassword }, player);
  check(!(await invoke('profile', {}, oldPlayer)).ok);
  check(!(await invoke('login', { identifier: playerLogin, password: playerPassword })).ok);
  const byLogin = await yes('login', { identifier: changedLogin, password: playerPassword });
  check(byLogin.user_id === player.user_id);
  let byPhone = await yes('login', { identifier: '+12025550115', password: playerPassword });
  check(byPhone.user_id === player.user_id);
  pass('Profil, nazwa zastępcza, sprawdzanie hasła i unikalne aliasy');
  stage = 'awaria i kontrolowana naprawa';
  const sid = JSON.parse(Buffer.from(player.access_token.split('.')[1],'base64url').toString()).session_id;
  const operation = await api.request('/rest/v1/rpc/slm_account_begin','POST',{
    p_actor:created.user_id,p_session:sid,p_target:created.user_id,p_kind:'password',
  }); check(operation.ok, 'symulowana przerwana operacja');
  check(!(await invoke('profile',{},player)).ok, 'blokada przerwanej operacji');
  let recovery = await api.request('/rest/v1/rpc/slm_account_prepare_recovery','POST',{
    p_user:created.user_id,p_expected_operation:operation.data.operation_id,
  }); check(!recovery.ok, 'odmowa przed upływem 10 minut');
  // Wyłącznie dane fikcyjnego konta: symulujemy upływ czasu bez zmiany limitów Auth.
  const age = await api.request('/rest/v1/slm_account_security?user_id=eq.'+created.user_id,'PATCH',{
    operation_started_at:new Date(Date.now()-11*60*1000).toISOString(),
  }); check(age.ok);
  recovery = await api.request('/rest/v1/rpc/slm_account_prepare_recovery','POST',{
    p_user:created.user_id,p_expected_operation:operation.data.operation_id,
  }); check(recovery.ok);
  const recoveryPassword=pwd();
  check((await api.request('/auth/v1/admin/users/'+created.user_id,'PUT',{password:recoveryPassword})).ok);
  const finish=await api.request('/rest/v1/rpc/slm_account_finish','POST',{
    p_user:created.user_id,p_operation:recovery.data,
  }); check(finish.ok && finish.data);
  const staleFinish=await api.request('/rest/v1/rpc/slm_account_finish','POST',{
    p_user:created.user_id,p_operation:operation.data.operation_id,p_session:sid,
  }); check(staleFinish.ok && !staleFinish.data);
  pass('Przerwana operacja pozostaje zablokowana; naprawa właściciela nie wskrzesza starej sesji');
  const recoverySession = await yes('login',{identifier:changedLogin,password:recoveryPassword});
  check(recoverySession.must_change_password);
  playerPassword=pwd();
  await yes('password',{current_password:recoveryPassword,new_password:playerPassword},recoverySession);
  byPhone=await yes('login',{identifier:'+12025550115',password:playerPassword});
  check((await invoke('profile',{},byPhone)).ok,'aktywna sesja przed resetem administratora');
  stage = 'reset i stare sesje';
  const reset = await yes('reset_password', { user_id: created.user_id }, admin);
  check(typeof reset.temporary_password === 'string' && reset.temporary_password.length === 12, 'długość hasła po resecie');
  check(!(await invoke('profile', {}, byPhone)).ok);
  check(!(await invoke('refresh', { refresh_token: byPhone.refresh_token })).ok);
  check(!(await invoke('login', { identifier: changedLogin, password: playerPassword })).ok);
  const resetSession = await yes('login', { identifier: changedLogin, password: reset.temporary_password });
  check(resetSession.must_change_password && !(await invoke('profile', {}, resetSession)).ok);
  const lastPassword = pwd();
  const final = await yes('password', { current_password: reset.temporary_password, new_password: lastPassword }, resetSession);
  check((await yes('profile', {}, final)).user_id === created.user_id);
  check(!(await invoke('profile', {}, byPhone)).ok);
  const staleRead = await api.request('/rest/v1/slm_profiles', 'GET', undefined, byPhone.access_token, false);
  check(!staleRead.ok || staleRead.data.length === 0);
  pass('Reset i obowiązkowa zmiana odrzucają stare JWT oraz refresh');
  stage = 'wylogowanie';
  await yes('logout', {}, final);
  check(!(await invoke('profile', {}, final)).ok);
  check(!(await invoke('refresh', { refresh_token: final.refresh_token })).ok);
  admin = await yes('refresh', { refresh_token: admin.refresh_token });
  check((await yes('list_accounts', {}, admin)).some(a => a.user_id === created.user_id));
  await yes('logout', {}, admin);
  pass('Wylogowanie i odświeżenie aktywnej sesji');
} catch (error) {
  console.log('FAIL: ' + stage + ' — ' + error.message); process.exitCode = 1;
} finally {
  for (const id of ids) {
    const audit = await api.request('/rest/v1/slm_account_audit?or=(actor_id.eq.' + id + ',target_id.eq.' + id + ')', 'DELETE').catch(() => null);
    if (!audit?.ok) { console.log('FAIL: cleanup historii fikcyjnego konta'); process.exitCode = 1; }
  }
  for (const id of ids) {
    const deleted = await api.request('/auth/v1/admin/users/' + id, 'DELETE').catch(() => null);
    if (!deleted?.ok) { console.log('FAIL: cleanup konta testowego'); process.exitCode = 1; }
  }
  console.log('Cleanup zakończony; skontroluj niezależnie liczniki w MCP.');
}

// Fikcyjne fixture'y; sekrety i odpowiedzi Auth wyłącznie w pamięci.
import { randomBytes, randomUUID } from 'node:crypto';
import { assertBranch, assertSafeConfig, management, server, url } from './accounts-admin.mjs';
const ids = new Set(), events = new Set(); let api, stage = 'konfiguracja';
const pwd = () => randomBytes(18).toString('base64url');
function check(value, label) { if (!value) throw new Error(label); }
async function request(action, body, session) {
  const r = await fetch(url + '/functions/v1/accounts', { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }, body: JSON.stringify({ ...body, action }), signal: AbortSignal.timeout(20000) });
  return { status: r.status, ok: r.ok, data: await r.json() };
}
async function yes(action, body, session) {
  const r = await request(action, body, session);
  check(r.ok, 'operacja ' + action + ': HTTP ' + r.status + ', ' + (r.data.code ?? 'brak kodu'));
  return r.data;
}
async function fixture(n, admin = false) {
  const password = pwd(), email = randomUUID() + '@slm.invalid', login = 'evt_' + randomUUID().slice(0, 8);
  const u = await api.request('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true });
  check(u.ok, 'utworzenie fixture Auth'); const id = u.data.id; ids.add(id);
  check((await api.request('/rest/v1/rpc/slm_account_provision', 'POST', {
    p_user: id, p_login: login, p_phone: '+12025550' + String(150 + n), p_email: email, p_admin: false,
  })).ok, 'fixture profile');
  if (admin) check((await api.request('/rest/v1/slm_roles?user_id=eq.' + id, 'PATCH', { role: 'admin' })).ok, 'rola tylko własnego fixture');
  const temporary = await yes('login', { identifier: login, password });
  check((await request('events_list', {}, temporary)).status === 403, 'blokada wydarzeń do zmiany hasła');
  const session = await yes('password', { current_password: password, new_password: pwd() }, temporary);
  return { id, login, temporary, session };
}
const pass = name => console.log('PASS: ' + name);
try {
  assertBranch('feat/events'); assertSafeConfig(await management('/config/auth')); api = await server();
  const [admin, a, b] = await Promise.all([fixture(0, true), fixture(1), fixture(2)]);
  const draft = { date: '2099-10-15', time: '19:30', location: 'Fikcyjne boisko testowe',
    duration_minutes: 90, hourly_rate: 180, total_cost: 270, capacity: 10 };
  stage = 'uprawnienia';
  check((await request('events_list', {})).status === 401, 'anon');
  check((await request('events_list', {}, a.temporary)).status === 401, 'stara sesja po zmianie hasła');
  check((await request('events_create', draft, a.session)).status === 403, 'tworzenie tylko admin');
  check((await request('events_create', { ...draft, capacity: null }, admin.session)).status === 400, 'brak limitu');
  check((await request('events_create', { ...draft, time: '' }, admin.session)).status === 400, 'brak godziny');
  check((await request('events_create', { ...draft, date: '2027-03-28', time: '02:30' }, admin.session)).status === 400, 'nieistniejąca godzina zmiany czasu');
  check((await request('events_create', { ...draft, time: '24:00' }, admin.session)).status === 400, 'godzina24');
  check((await request('events_create', { ...draft, hourly_rate: 'NaN' }, admin.session)).status === 400, 'stawka NaN');
  const created = await yes('events_create', draft, admin.session); events.add(created.event_id);
  const eid = created.event_id;
  check((await request('events_edit', { ...draft, event_id: eid }, a.session)).status === 403, 'edycja tylko admin');
  await yes('events_edit', { ...draft, event_id: eid, location: 'Fikcyjne boisko po edycji' }, admin.session);
  check((await request('events_cancel', { event_id: eid }, a.session)).status === 403, 'cancel tylko admin');
  const raw = await api.request('/rest/v1/slm_events?id=eq.' + eid, 'PATCH', { capacity: 99 }, a.session.access_token, false);
  check(!raw.ok, 'bezpośrednie write RLS');
  const staleRls = await api.request('/rest/v1/slm_events?id=eq.' + eid, 'GET', undefined, a.temporary.access_token, false);
  check(staleRls.ok && staleRls.data.length === 0, 'stara sesja RLS read');
  const sid = JSON.parse(Buffer.from(a.session.access_token.split('.')[1], 'base64url')).session_id;
  check(!(await api.request('/rest/v1/rpc/slm_events_dispatch', 'POST', { p_user: a.id, p_session: sid, p_action: 'list' }, a.session.access_token, false)).ok, 'RPC bez service_role');
  pass('Uprawnienia, stara sesja, wymagane godzina/limit, RLS i zamknięty RPC');
  stage = 'goście i limit';
  const guestIds = [];
  for (let i = 0; i < 9; i++) {
    const r = await yes('events_guest', { event_id: eid, request_id: randomUUID(), guest_name: 'Fikcyjny gość ' + i }, admin.session);
    guestIds.push(r.participant_id);
  }
  const reused = await request('events_guest', { event_id: eid, request_id: guestIds[0], guest_name: 'Powtórzona próba' }, admin.session);
  check(reused.status === 409, 'ponowienie identycznego request_id');
  stage = 'równoczesne ostatnie miejsce';
  const race = await Promise.all([request('events_join', { event_id: eid }, a.session), request('events_join', { event_id: eid }, b.session)]);
  check(race.filter(r => r.ok).length === 1 && race.filter(r => r.data.code === 'event_full').length === 1, 'dokładnie jeden zwycięzca');
  const winner = race[0].ok ? a : b, loser = race[0].ok ? b : a;
  let detail = await yes('events_detail', { event_id: eid }, a.session);
  check(detail.event.registered_count === 10 && detail.event.settlements_active === false, 'limit z gośćmi');
  check(detail.participants.find(p => p.id === guestIds[0]).contact_phone === '+12025550150', 'kontakt zapraszającego');
  check((await request('events_guest', { event_id: eid, request_id: randomUUID(), guest_name: 'Ponad limit' }, loser.session)).status === 409, 'gość ponad limit');
  check((await request('events_edit', { ...draft, event_id: eid, capacity: 9 }, admin.session)).status === 400, 'minimum10');
  pass('Równoczesny zapis na ostatnie miejsce: 1 sukces, 1 odmowa; goście liczą się do limitu');
  stage = 'rezerwa i duplikaty';
  await yes('events_reserve', { event_id: eid }, loser.session);
  check((await request('events_reserve', { event_id: eid }, loser.session)).data.code === 'duplicate_signup', 'duplikat rezerwy');
  check((await request('events_withdraw', { event_id: eid, participant_id: guestIds[0] }, loser.session)).status === 403, 'obcy gość');
  await yes('events_withdraw', { event_id: eid, participant_id: guestIds[0] }, admin.session);
  detail = await yes('events_detail', { event_id: eid }, loser.session);
  check(detail.event.registered_count === 9 && detail.event.reserve_count === 1, 'brak autoawansu');
  await yes('events_join', { event_id: eid }, loser.session);
  check((await request('events_join', { event_id: eid }, winner.session)).status === 409, 'duplikat zapisu');
  const own = (await yes('events_detail', { event_id: eid }, loser.session)).participants.find(p => p.member_id === loser.id);
  check((await request('events_attendance', { event_id: eid, participant_id: own.id, absent: true }, loser.session)).status === 403, 'obecność tylko admin');
  await yes('events_attendance', { event_id: eid, participant_id: own.id, absent: true }, admin.session);
  check((await yes('events_detail', { event_id: eid }, loser.session)).participants.find(p => p.id === own.id).absent, 'nieobecność');
  pass('Rezerwa nie zajmuje miejsc i nie awansuje; duplikaty i cudze operacje odrzucone; obecność admin');
  stage = 'zarządzanie gościem';
  await yes('events_withdraw', { event_id: eid, participant_id: guestIds[1] }, admin.session);
  const guest = await yes('events_guest', { event_id: eid, request_id: randomUUID(), guest_name: 'Gość zawodnika' }, a.session);
  await yes('events_edit_guest', { event_id: eid, participant_id: guest.participant_id, guest_name: 'Poprawiony gość', guest_phone: '+12025550160' }, a.session);
  await yes('events_move_guest', { event_id: eid, participant_id: guest.participant_id, list: 'reserve' }, a.session);
  detail = await yes('events_detail', { event_id: eid }, a.session);
  const gp = detail.participants.find(p => p.id === guest.participant_id);
  check(gp.status === 'reserve' && gp.contact_phone === '+12025550160' && gp.responsible_user_id === a.id, 'gość właściciel telefon');
  await yes('events_move_guest', { event_id: eid, participant_id: guest.participant_id, list: 'registered' }, a.session);
  pass('Zapraszający edytuje i przenosi własnego gościa; odpowiedzialność oddzielona od obecności');
  stage = '17:00 i historia';
  // Manipulujemy wyłącznie terminem własnego fixture, nie czasem serwera.
  const clock = new Date((await yes('events_list', {}, a.session)).server_now);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(clock);
  const timeParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', hourCycle: 'h23' }).format(clock);
  check(Number(timeParts) >= 17, 'test po17 wymaga wieczornego okna Warszawy');
  check((await api.request('/rest/v1/slm_events?id=eq.' + eid, 'PATCH', { starts_at: day + 'T23:59:00+02:00' })).ok, 'termin fixture');
  await yes('events_withdraw', { event_id: eid, participant_id: guest.participant_id }, a.session);
  detail = await yes('events_detail', { event_id: eid }, a.session);
  check(detail.event.decision_required && detail.event.status === 'scheduled', 'brakminimum nie odwołuje');
  await yes('events_edit', { ...draft, event_id: eid, date: '2099-10-15', time: '20:00' }, admin.session);
  check((await api.request('/rest/v1/slm_events?id=eq.' + eid, 'PATCH', { starts_at: day + 'T23:59:00+02:00' })).ok, 'przywrócenie własnego fixture');
  await yes('events_guest', { event_id: eid, request_id: randomUUID(), guest_name: 'Zapis po17' }, b.session);
  const history = await api.request('/rest/v1/slm_event_history?event_id=eq.' + eid + '&action=eq.withdrawn&order=sequence.desc&limit=1');
  check(history.ok && history.data[0].after_cutoff === true && history.data[0].responsible_user_id === a.id && history.data[0].snapshot.previous_status === 'registered', 'history po17');
  const participant = await api.request('/rest/v1/slm_event_participants?id=eq.' + guest.participant_id);
  check(participant.data[0].status === 'withdrawn' && participant.data[0].responsible_user_id === a.id, 'rezygnacja nie usuwa');
  pass('Zapis po17 dozwolony, brak minimum wymaga decyzji, historia i odpowiedzialność zachowane');
  stage = 'reset odrzuca dostęp wydarzeń';
  const oldB = b.session;
  const reset = await yes('reset_password', { user_id: b.id }, admin.session);
  check((await request('events_detail', { event_id: eid }, oldB)).status === 401, 'reset cofa API');
  const resetLogin = await yes('login', { identifier: b.login, password: reset.temporary_password });
  check((await request('events_list', {}, resetLogin)).status === 403, 'ponowna wymuszona zmiana');
  b.session = await yes('password', { current_password: reset.temporary_password, new_password: pwd() }, resetLogin);
  check((await request('events_detail', { event_id: eid }, oldB)).status === 401, 'stara sesja nie wraca');
  check((await request('events_detail', { event_id: eid }, b.session)).ok, 'nowa sesja');
  pass('Reset fixture blokuje stare sesje wydarzeń również po zmianie nowego hasła');
  stage = 'zamknięcie i cancel';
  check((await api.request('/rest/v1/slm_events?id=eq.' + eid, 'PATCH', { starts_at: new Date(clock.getTime() - 1000).toISOString() })).ok, 'fixture początek');
  check((await request('events_join', { event_id: eid }, a.session)).data.code === 'registration_closed', 'zamknięcie na początku');
  check((await request('events_reserve', { event_id: eid }, a.session)).data.code === 'registration_closed', 'rezerwa zamknięta');
  await yes('events_cancel', { event_id: eid }, admin.session);
  detail = await yes('events_detail', { event_id: eid }, b.session);
  check(detail.event.status === 'cancelled' && !detail.event.registration_open, 'cancel');
  check((await request('events_guest', { event_id: eid, request_id: randomUUID(), guest_name: 'Po odwołaniu' }, b.session)).data.code === 'event_cancelled', 'odwołany');
  pass('Początek zamyka zapisy; odwołanie zamyka wszystkie operacje zapisu');
} catch (e) {
  // Wyłącznie etykiety/stałe komunikaty; nie drukujemy odpowiedzi Auth.
  console.log('FAIL: ' + stage + ' — ' + e.message); process.exitCode = 1;
} finally {
  let clean = true;
  for (const eid of events) {
    if (!(await api.request('/rest/v1/slm_event_history?event_id=eq.' + eid, 'DELETE').catch(() => null))?.ok) clean = false;
    if (!(await api.request('/rest/v1/slm_events?id=eq.' + eid, 'DELETE').catch(() => null))?.ok) clean = false;
  }
  for (const id of ids) if (!(await api.request('/rest/v1/slm_account_audit?or=(actor_id.eq.' + id + ',target_id.eq.' + id + ')', 'DELETE').catch(() => null))?.ok) clean = false;
  for (const id of ids) if (!(await api.request('/auth/v1/admin/users/' + id, 'DELETE').catch(() => null))?.ok) clean = false;
  console.log(clean ? 'Cleanup własnych fikcyjnych meczów i kont zakończony.' : 'FAIL: cleanup wymaga kontroli właściciela.');
  if (!clean) process.exitCode = 1;
}

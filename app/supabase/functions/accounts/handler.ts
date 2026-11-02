import { isPhoneIdentifier, normalizeLoginPhone, normalizePhoneUpdate } from '../_shared/phone.ts';
import { PhotoError, profilePhoto, readAccountBody } from './profilePhotos.ts';
export interface Environment { url: string; anon: string; service: string; origins: string[]; emailSignupEnabled?: boolean }
type Row = Record<string, unknown>;
class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const unauthorized = () => new ApiError(401, 'session_invalid', 'Sesja wygasła. Zaloguj się ponownie.');
const credentials = () => new ApiError(401, 'invalid_credentials', 'Nieprawidłowy login, numer telefonu lub hasło.');
export function normalizeLogin(value: string): string {
  const result = value.trim().normalize('NFC');
  if (!/^[\p{L}][\p{L}\p{N}_.-]{2,31}$/u.test(result))
    throw new ApiError(400, 'invalid_login', 'Login: 3–32 znaki, pierwsza litera, dalej litery, cyfry, _, . lub -.');
  return result;
}
export function normalizePhone(value: string, existing?: string): string {
  try { return normalizePhoneUpdate(value, existing); }
  catch (e) { throw new ApiError(400, 'invalid_phone', (e as Error).message); }
}

function field(body: Row, key: string, max = 200): string {
  const value = body[key];
  if (typeof value !== 'string' || value.length > max) throw new ApiError(400, 'invalid_input', 'Sprawdź dane formularza.');
  return value;
}
function password(body: Row, key: string, newPassword = false): string {
  const value = field(body, key, 128);
  if (!value || (newPassword && (value.length < 8 || new TextEncoder().encode(value).length > 72)))
    throw new ApiError(400, 'invalid_password', 'Nowe hasło musi mieć co najmniej 8 znaków i nie więcej niż 72 bajty.');
  return value;
}
// 9 losowych bajtów = 72 bity entropii i dokładnie 12 znaków base64url.
export const randomPassword = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(9))))
  .replace(/\+/g, '-').replace(/\//g, '_');
export function displayName(login: string, fullName: string, mode: string) {
  return mode === 'full_name' && fullName.trim() ? fullName.trim() : login;
}

export function createHandler(env: Environment) {
  async function call(path: string, method = 'GET', body?: unknown, token?: string, admin = false) {
    const headers: Record<string, string> = { apikey: admin ? env.service : env.anon,
      Authorization: `Bearer ${token ?? (admin ? env.service : env.anon)}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (path.startsWith('/rest/')) headers.Prefer = 'return=representation';
    let r: Response;
    try {
      r = await fetch(env.url + path, { method, headers,
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    } catch { throw new ApiError(503, 'service_unavailable', 'Serwer jest chwilowo niedostępny. Spróbuj ponownie.'); }
    const data = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data };
  }
  async function db(path: string, method = 'GET', body?: unknown) {
    const r = await call('/rest/v1/' + path, method, body, undefined, true);
    if (!r.ok) {
      if (r.status >= 500) throw new ApiError(503, 'service_unavailable', 'Serwer jest chwilowo niedostępny. Spróbuj ponownie.');
      if (r.status === 429) throw new ApiError(429, 'rate_limited', 'Zbyt wiele prób. Spróbuj ponownie za minutę.');
      if (r.data?.code === '23505') throw new ApiError(409, 'identifier_taken', 'Login lub numer telefonu jest już zajęty.');
      throw new ApiError(409, 'operation_failed', 'Operacja nie została zakończona. Skontaktuj się z administratorem.');
    }
    return r.data;
  }
  const rpc = (name: string, body: Row) => db('rpc/slm_account_' + name, 'POST', body);
  async function rate(key: string, limit: number, seconds = 60) {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))))
      .map(x => x.toString(16).padStart(2, '0')).join('');
    if (!(await rpc('rate', { p_key: hash, p_limit: limit, p_seconds: seconds })))
      throw new ApiError(429, 'rate_limited', 'Zbyt wiele prób. Spróbuj ponownie za minutę.');
  }
  async function state(id: string) {
    const rows = await db(`slm_account_security?user_id=eq.${id}`);
    if (rows.length !== 1) throw unauthorized();
    return rows[0];
  }
  async function alias(id: string) {
    const rows = await db(`slm_aliases?user_id=eq.${id}`);
    if (rows.length === 1) return rows[0];
    const identity = await db('rpc/slm_email_identity', 'POST', { p_user: id });
    if (!identity) throw unauthorized();
    return identity;
  }
  async function verify(token: string) {
    const r = await call('/auth/v1/user', 'GET', undefined, token);
    if (r.status >= 500) throw new ApiError(503, 'service_unavailable', 'Serwer jest chwilowo niedostępny. Spróbuj ponownie.');
    if (r.status === 429) throw new ApiError(429, 'rate_limited', 'Zbyt wiele prób. Spróbuj ponownie za minutę.');
    if (!r.ok || !r.data?.id) throw unauthorized();
    // Auth zweryfikował podpis. Dekodowanie służy tylko odczytowi session_id.
    const encoded = token.split('.')[1];
    const payload = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.session_id !== 'string' || payload.sub !== r.data.id) throw unauthorized();
    return { id: r.data.id as string, sid: payload.session_id as string };
  }
  async function context(token: string) {
    const user = await verify(token);
    const info = await rpc('context', { p_user: user.id, p_session: user.sid });
    if (!info) throw unauthorized();
    return { ...user, ...info };
  }
  async function authLogin(email: string, pwd: string) {
    const r = await call('/auth/v1/token?grant_type=password', 'POST', { email, password: pwd });
    if (!r.ok || !r.data?.access_token) throw credentials();
    return r.data;
  }
  async function rejectSession(session: Row) {
    // Te sesje nigdy nie uzyskują dostępu aplikacji. Cleanup Auth jest best effort.
    await call('/auth/v1/logout?scope=local', 'POST', undefined, session.access_token as string).catch(() => undefined);
  }
  async function sessionPayload(session: Row) {
    const ctx = await context(session.access_token as string);
    return { access_token: session.access_token, refresh_token: session.refresh_token,
      expires_in: session.expires_in, user_id: ctx.id, must_change_password: ctx.must_change_password, role: ctx.role };
  }
  async function accept(session: Row, version: number) {
    const user = await verify(session.access_token as string);
    if (!(await rpc('accept_session', { p_user: user.id, p_session: user.sid, p_version: version }))) {
      await rejectSession(session); throw unauthorized();
    }
    return sessionPayload(session);
  }
  async function profile(id: string) {
    const [a, profiles, players] = await Promise.all([alias(id), db(`slm_profiles?user_id=eq.${id}`), db(`slm_player_profiles?user_id=eq.${id}&select=jersey_number,nickname`)]);
    const p = profiles[0];
    if (!p) throw unauthorized();
    return { user_id: id, jersey_number: players[0]?.jersey_number ?? null, login: a.login, phone: a.phone, email_account: a.email_account === true, full_name: p.full_name,
      nickname: players[0]?.nickname || (a.login.includes('@')?'Zawodnik':a.login), first_name: p.first_name??'',
      group_scope: await db(`slm_group_members?user_id=eq.${id}&select=group_id,share_full_name,share_first_name,slm_groups!inner(archived)&slm_groups.archived=eq.false`),
      display_as: p.display_as, display_name: p.display_as==='first_name'?(p.first_name?.trim()||players[0]?.nickname||'Zawodnik'):displayName(players[0]?.nickname||a.login, p.full_name, p.display_as) };
  }
  async function verifyPassword(ctx: Row, pwd: string) {
    const a = await alias(ctx.id as string);
    const proof = await authLogin(a.technical_email, pwd);
    const verified = await verify(proof.access_token);
    await rejectSession(proof);
    if (verified.id !== ctx.id) throw credentials();
    return a;
  }
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (origin && env.origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !env.origins.includes(origin)) return respond({ error: 'Niedozwolony adres aplikacji.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond({ error: 'Niedozwolona metoda.' }, 405);
    try {
      const uploadRequest=new URL(request.url).searchParams.get('photo')==='upload';
      let uploadContext:Awaited<ReturnType<typeof context>>|undefined;
      if(uploadRequest) {
        const authorization=request.headers.get('authorization')??'';
        if(!authorization.startsWith('Bearer '))throw unauthorized();
        uploadContext=await context(authorization.slice(7));
        if(uploadContext.must_change_password)throw new ApiError(403,'password_required','Najpierw zmień hasło tymczasowe.');
        await rate('photo:'+uploadContext.id,10);
      }
      const text = await readAccountBody(request,uploadRequest?210000:12000);
      let parsed: unknown;
      try { parsed = JSON.parse(text); }
      catch { throw new ApiError(400, 'invalid_input', 'Nieprawidłowe żądanie.'); }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new ApiError(400, 'invalid_input', 'Nieprawidłowe żądanie.');
      const body = parsed as Row;
      const action = field(body, 'action', 40);
      if(uploadRequest&&action!=='profile_photo_upload')throw new ApiError(400,'invalid_input','Nieprawidłowe żądanie.');
      await rate('global', 300);
      if (action === 'signup' || action === 'resend_verification' || action === 'recover_email') {
        await rate('email-flow', 12);
        if (!env.emailSignupEnabled) throw new ApiError(503, 'mail_unconfigured', 'Rejestracja i odzyskiwanie e-mail czekają na konfigurację poczty.');
        // Enabling the environment flag alone must never bypass the existing blocking hook.
        const email = field(body, 'email', 254).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'invalid_input', 'Podaj poprawny e-mail.');
        const path = action === 'signup' ? '/auth/v1/signup' : action === 'resend_verification' ? '/auth/v1/resend' : '/auth/v1/recover';
        const values = action === 'signup' ? { email, password: password(body, 'password', true) } : action === 'resend_verification' ? { email, type: 'signup' } : { email };
        const result = await call(path, 'POST', values);
        if (!result.ok) throw new ApiError(503, 'mail_unavailable', 'Nie udało się uruchomić procesu e-mail. Spróbuj później.');
        if (result.data?.access_token) {
          await rejectSession(result.data);
          throw new ApiError(503, 'verification_required', 'Rejestracja wymaga weryfikacji adresu e-mail.');
        }
        return respond({ verification_required: true });
      }
      if (action === 'login') {
        const start = Date.now();
        const raw = field(body, 'identifier').trim();
        const pwd = password(body, 'password');
        let rows: Row[] = [];
        try {
          if (raw.includes('@')) {
            const email = raw.toLowerCase();
            await rate('identifier:' + email, 16);
            const identity = await db('rpc/slm_email_identity', 'POST', { p_email: email });
            if (identity) rows = [identity];
          } else {
          const normalized = isPhoneIdentifier(raw) ? normalizeLoginPhone(raw) : normalizeLogin(raw).toLowerCase();
          await rate('identifier:' + normalized, 16);
          rows = await db(`slm_aliases?${isPhoneIdentifier(raw) ? 'phone' : 'login_normalized'}=eq.${encodeURIComponent(normalized)}`);
          }
        } catch (e) { if (e instanceof ApiError && e.status === 429) throw e; }
        if (rows[0]) await rate('account:' + rows[0].user_id, 16);
        // Wersję odczytujemy PRZED sprawdzeniem hasła. Reset między tymi krokami
        // nie może zatwierdzić sesji uzyskanej poprzednim hasłem w nowej wersji.
        const s = rows[0] ? await state(rows[0].user_id as string) : null;
        if (s && (!s.active || s.operation_id)) {
          await new Promise(r => setTimeout(r, Math.max(0, 350 - (Date.now() - start))));
          throw credentials();
        }
        // Nieistniejący alias również trafia do Auth password; żadnych OTP i wysyłek.
        const session = await authLogin((rows[0]?.technical_email as string) ?? `${crypto.randomUUID()}@slm.invalid`, pwd)
          .catch(async () => { await new Promise(r => setTimeout(r, Math.max(0, 350 - (Date.now() - start)))); throw credentials(); });
        if (!rows[0] || session.user.id !== rows[0].user_id) { await rejectSession(session); throw credentials(); }
        return respond(await accept(session, s!.security_version));
      }
      if (action === 'refresh') {
        await rate('refresh-global', 120);
        const r = await call('/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token: field(body, 'refresh_token', 4096) });
        if (r.status >= 500) throw new ApiError(503, 'service_unavailable', 'Serwer jest chwilowo niedostępny. Spróbuj ponownie.');
        if (r.status === 429) throw new ApiError(429, 'rate_limited', 'Zbyt wiele prób. Spróbuj ponownie za minutę.');
        if (!r.ok) throw unauthorized();
        try { return respond(await sessionPayload(r.data)); }
        catch (error) {
          // Niedostępność Auth/bazy nie jest dowodem cofnięcia sesji. Nie kasujemy
          // obróconej sesji przy chwilowej awarii; klient zachowa token i blokadę UI.
          if (error instanceof ApiError && error.code === 'session_invalid') await rejectSession(r.data);
          throw error;
        }
      }
      const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
      if (action === 'notifications_detach') {
        // Capability urządzenia pozwala dokończyć logout offline bez refresh tokenu.
        const device = field(body, 'device_id', 36), secret = field(body, 'device_secret', 72), binding = field(body, 'binding_id', 36);
        if (!/^[0-9a-f-]{36}$/.test(device) || !/^[0-9a-f-]{36}$/.test(binding) || !/^[0-9a-f-]{72}$/.test(secret))
          throw new ApiError(400, 'invalid_device', 'Nieprawidłowy identyfikator urządzenia.');
        await rate('device-detach:' + device, 20);
        if (!Number.isSafeInteger(body.binding_version) || (body.binding_version as number)<=0)
          throw new ApiError(400, 'invalid_device', 'Nieprawidłowa wersja powiązania.');
        await db('rpc/slm_push_detach', 'POST', { p_device: device, p_secret: secret, p_binding: binding, p_version: body.binding_version });
        return respond({ ok: true });
      }
      if (action === 'logout') {
        const u = await verify(token);
        await rpc('revoke_session', { p_user: u.id, p_session: u.sid });
        // Odwołanie dostępu w SQL jest obowiązkowe; awaria Auth logout nie przywraca
        // go nawet przy odświeżeniu tokenu. Nie zgłaszamy fikcyjnego sukcesu SQL.
        await call('/auth/v1/logout?scope=local', 'POST', undefined, token).catch(() => undefined);
        return respond({ ok: true });
      }
      const ctx = uploadContext ?? await context(token);
      if (action === 'status') return respond({ must_change_password: ctx.must_change_password, role: ctx.role, user_id: ctx.id });
      if (ctx.must_change_password && action !== 'password')
        throw new ApiError(403, 'password_required', 'Najpierw zmień hasło tymczasowe.');
      if (['profile_photo_get','profile_photo_upload','profile_photo_delete'].includes(action)) {
        if(!uploadRequest)await rate('photo:'+ctx.id,action==='profile_photo_get'?60:10);
        return respond(await profilePhoto(env,ctx,action,body));
      }
      if (action === 'finance_groups') {
        await rate('scoped:' + ctx.id, 90);
        const result = await call('/rest/v1/rpc/slm_finance_groups', 'POST', { p_user: ctx.id, p_session: ctx.sid }, undefined, true);
        if (!result.ok) throw new ApiError(503, 'service_unavailable', 'Nie udało się pobrać własnych grup finansowych.');
        return respond(result.data);
      }
      if (action === 'lineups_get' || action === 'lineups_save') {
        await rate('lineups:' + ctx.id, 60);
        const fields = action === 'lineups_get' ? ['event_id'] : ['event_id','expected_version','expected_roster_version','team_a','team_b','request_id'];
        if (Object.keys(body).some(key => key !== 'action' && !fields.includes(key)))
          throw new ApiError(400, 'invalid_input', 'Żądanie składu zawiera niedozwolone pola.');
        const payload = Object.fromEntries(fields.filter(key => Object.hasOwn(body,key)).map(key => [key,body[key]]));
        const r = await call('/rest/v1/rpc/slm_lineups_dispatch', 'POST', {p_user:ctx.id,p_session:ctx.sid,p_action:action.slice(8),p_body:payload}, undefined, true);
        if (!r.ok) {
          const code = typeof r.data?.message === 'string' ? r.data.message : '';
          const errors: Record<string,[number,string]> = {
            session_invalid:[401,'Sesja wygasła. Zaloguj się ponownie.'],
            not_found:[404,'Mecz nie istnieje lub nie masz dostępu do jego składu.'],
            group_archived:[409,'Grupa jest zarchiwizowana.'],
            event_cancelled:[409,'Nie można zmieniać składu odwołanego meczu.'],
            lineup_closed:[409,'Nie można zmieniać składu zakończonego meczu.'],
            lineup_version_conflict:[409,'Ktoś zmienił skład. Pobierz aktualną wersję bez nadpisywania szkicu.'],
            lineup_roster_conflict:[409,'Lista uczestników lub mecz uległy zmianie. Pobierz aktualne dane.'],
            idempotency_conflict:[409,'Identyfikator żądania dotyczy innej operacji.'],
            lineup_invalid_assignment:[400,'Skład zawiera powtórzone lub nieuprawnione wpisy uczestników.'],
            invalid_input:[400,'Sprawdź format danych składu.'],
            request_required:[400,'Brak identyfikatora operacji.'],
          };
          if (errors[code]) throw new ApiError(errors[code][0],code,errors[code][1]);
          if (['22P02','22003'].includes(r.data?.code)) throw new ApiError(400,'invalid_input','Sprawdź identyfikatory i wersje składu.');
          throw new ApiError(503,'service_unavailable','Nie potwierdzono operacji składu. Ponów z tym samym identyfikatorem.');
        }
        return respond(r.data);
      }
      const scoped = [
        ['group_finance_', 'slm_group_finance_dispatch'],
        ['groups_', 'slm_groups_dispatch'],
        ['matches_', 'slm_matches_dispatch'],
      ].find(([prefix]) => action.startsWith(prefix));
      if (scoped) {
        await rate('scoped:' + ctx.id, 90);
        const [prefix, rpc] = scoped;
        if (['matches_create','matches_edit'].includes(action) && Object.hasOwn(body,'minimum_players') &&
            (!Number.isSafeInteger(body.minimum_players) || Number(body.minimum_players)<1 || Number(body.minimum_players)>1000))
          throw new ApiError(400,'invalid_minimum','Minimum zawodników musi być dodatnią liczbą całkowitą, nie większą niż limit miejsc.');
        if ((action === 'groups_phone' || action === 'matches_guest' || action === 'matches_edit_guest')) {
          const key = action === 'groups_phone' ? 'phone' : 'guest_phone';
          if (body[key] !== undefined && typeof body[key] !== 'string')
            throw new ApiError(400, 'invalid_phone', 'Podaj polski numer telefonu.');
          if (typeof body[key] === 'string' && body[key].trim()) body[key] = normalizePhone(body[key]);
        }
        const allowed = prefix === 'groups_'
          ? ['name','description','query','group_id','user_id','phone','id','request_id','accept','organizer','share_full_name','confirm_nickname']
          : prefix === 'matches_'
          ? ['event_id','guest_name','guest_phone','list','participant_id','user_id','name','group_id','date','time','starts_at','location','address','duration_minutes','capacity','cost_cents','visibility','expected_version','absent','reason','request_id','offset','scope','period',...(action === 'matches_list' ? ['query'] : [])]
          : ['group_id','event_id','user_id','participant_id','payment_id','request_id','amount_cents','expected_amount_cents','expected_version','reason','payable','absent'];
        if (['matches_create','matches_edit'].includes(action)) allowed.push('minimum_players');
        const payload = Object.fromEntries(allowed.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
        const r = await call('/rest/v1/rpc/' + rpc, 'POST', {
          p_user: ctx.id, p_session: ctx.sid, p_action: action.slice(prefix.length), p_body: payload,
        }, undefined, true);
        if (!r.ok) {
          const code = typeof r.data?.message === 'string' ? r.data.message : '';
          const errors: Record<string, [number, string]> = {
            session_invalid: [401, 'Sesja wygas?a. Zaloguj si? ponownie.'],
            forbidden: [403, 'Brak uprawnie? do tej operacji.'],
            not_found: [404, 'Nie znaleziono wskazanych danych.'],
            registration_blocked: [403, 'Zaleg?o?ci blokuj? nowe zapisy na p?atne mecze.'],
            event_full: [409, 'Brak wolnych miejsc. Mo?esz wybra? rezerw?.'],
            duplicate_signup: [409, 'Ten zapis ju? istnieje.'],
            registration_closed: [409, 'Zapisy s? zamkni?te.'],
            event_cancelled: [409, 'Mecz zosta? odwo?any.'],
            stale_version: [409, 'Dane zmieni?y si?. Od?wie? je przed ponown? decyzj?.'],
            idempotency_conflict: [409, 'Identyfikator dotyczy innej operacji.'],
            consent_required: [409, 'Potwierdź przejście na pseudonim, aby ukryć dane.'],
            payment_processed: [409, 'Wp?ata zosta?a ju? rozpatrzona.'],
            request_processed: [409, 'Pro?ba zosta?a ju? rozpatrzona.'],
            already_member: [409, 'Zawodnik ju? nale?y do grupy.'],
            group_archived: [409, 'Grupa jest zarchiwizowana.'],
            match_not_finished: [409, 'Mecz jeszcze si? nie zako?czy?.'],
            already_approved: [409, 'Rozliczenie jest ju? zatwierdzone.'],
            reason_required: [400, 'Podaj pow?d decyzji (do 500 znak?w).'],
          };
          if(prefix==='groups_'){
            const messages:Record<string,string>={session_invalid:'Sesja wygasła. Zaloguj się ponownie.',forbidden:'Brak uprawnień do tej operacji.',not_found:'Grupa lub profil nie istnieje albo nie masz dostępu.',request_processed:'Zgłoszenie zostało już rozpatrzone. Odśwież grupę.',already_member:'Ta osoba już należy do grupy.',idempotency_conflict:'Identyfikator dotyczy innej operacji. Odśwież dane.',group_archived:'Grupa jest zarchiwizowana.'};
            if(messages[code]&&errors[code])throw new ApiError(errors[code][0],code,messages[code]);
          }
          if (code === 'invalid_minimum') throw new ApiError(400,code,'Minimum zawodników musi być dodatnią liczbą całkowitą, nie większą niż limit miejsc.');
          if (code === 'invalid_group' || code === 'invalid_input' || code === 'request_required') throw new ApiError(400, code, 'Sprawdź nazwę, opis i wymagane pola.');
          if (errors[code]) throw new ApiError(errors[code][0], code, errors[code][1]);
          if (r.data?.code === '22P02' || r.data?.code === '23514' || r.data?.code === '23502')
            throw new ApiError(400, 'invalid_input', 'Sprawd? wymagane pola i poprawno?? danych.');
          throw new ApiError(503, 'service_unavailable', 'Nie uda?o si? potwierdzi? operacji. Pon?w z tym samym identyfikatorem.');
        }
        if (action === 'matches_list' && (Object.hasOwn(payload, 'query') || payload.scope === 'groups') && r.data?.public_discovery_version !== 1)
          throw new ApiError(503, 'discovery_unavailable', 'Wyszukiwanie wymaga aktualnego backendu. Spróbuj ponownie po aktualizacji.');
        return respond(r.data);
      }
      if (action.startsWith('settlements_')) {
        await rate('settlements:' + ctx.id, 60);
        const r = await call('/rest/v1/rpc/slm_settlements_dispatch', 'POST', {
          p_user: ctx.id, p_session: ctx.sid, p_action: action.slice(12), p_body: body,
        }, undefined, true);
        if (!r.ok) {
          const messages: Record<string, [number, string]> = {
            session_invalid: [401, 'Sesja wygasła. Zaloguj się ponownie.'],
            forbidden: [403, 'Brak uprawnień do tej operacji.'],
            not_found: [404, 'Nie znaleziono rozliczenia, uczestnika lub wpłaty.'],
            invalid_action: [400, 'Nieznana operacja rozliczeń.'],
            invalid_amount: [400, 'Podaj kwotę w pełnych groszach; wpłata musi być dodatnia.'],
            invalid_participant: [400, 'Nieprawidłowy zawodnik lub decyzja o opłacie.'],
            invalid_replacement: [409, 'Ten udział nie może przejąć wskazanego zobowiązania. Odśwież rozliczenie.'],
            reason_required: [400, 'Podaj powód decyzji (1–500 znaków).'],
            request_required: [400, 'Brak identyfikatora operacji.'],
            request_closed: [409, 'Żądanie zostało zamknięte bez księgowania. Sprawdź historię i rozpocznij nową operację.'],
            idempotency_conflict: [409, 'Ten identyfikator jest przypisany do innej operacji.'],
            stale_version: [409, 'Rozliczenie lub wpłata zostały zmienione. Odśwież dane przed ponowną decyzją.'],
            already_approved: [409, 'Mecz został już zatwierdzony. Dalsze zmiany są korektami.'],
            match_not_finished: [409, 'Zatwierdzenie jest możliwe dopiero po planowanym końcu meczu.'],
            event_cancelled: [409, 'Mecz został odwołany.'],
            no_payers: [409, 'Nie można podzielić dodatniego kosztu bez osób zobowiązanych do zapłaty.'],
            payment_processed: [409, 'Zgłoszenie wpłaty zostało już rozpatrzone.'],
            payment_not_accepted: [409, 'Można korygować tylko zaksięgowaną wpłatę.'],
            no_change: [409, 'Nowa kwota nie zmienia zaksięgowanej wpłaty.'],
          };
          const code = typeof r.data?.message === 'string' ? r.data.message : '';
          if (messages[code]) throw new ApiError(messages[code][0], code, messages[code][1]);
          if (['22P02', '22003', '23514', '23502'].includes(r.data?.code))
            throw new ApiError(400, 'invalid_input', 'Sprawdź kwotę i wymagane pola.');
          if (r.data?.code === '23505')
            throw new ApiError(409, 'operation_conflict', 'Operacja już istnieje. Odśwież dane.');
          // Wynik może być nieznany po timeout. Ponowienie MUSI użyć tego samego request_id.
          throw new ApiError(503, 'service_unavailable', 'Nie udało się potwierdzić operacji. Ponów ją z tym samym identyfikatorem.');
        }
        return respond(r.data);
      }
      if (action.startsWith('notifications_')) {
        await rate('notifications:' + ctx.id, 90);
        const r = await call('/rest/v1/rpc/slm_notifications_dispatch', 'POST', {
          p_user: ctx.id, p_session: ctx.sid, p_action: action.slice(14), p_body: body,
        }, undefined, true);
        if (!r.ok) {
          const messages: Record<string, [number, string]> = {
            session_invalid: [401, 'Sesja wygasła. Zaloguj się ponownie.'],
            not_found: [404, 'Powiadomienie nie istnieje lub należy do innego konta.'],
            invalid_device: [400, 'Nieprawidłowe dane urządzenia.'],
            device_mismatch: [409, 'Nie można powiązać tego urządzenia. Wyłącz i ponownie włącz powiadomienia.'],
            device_unprepared: [409, 'Najpierw przygotuj urządzenie do powiadomień. Włącz push ponownie.'],
            device_revoked: [409, 'Powiązanie zostało wycofane przy wylogowaniu. Włącz push ponownie na właściwym koncie.'],
            stale_device_binding: [409, 'Nowsze powiązanie urządzenia już istnieje. Odśwież konfigurację push.'],
            invalid_input: [400, 'Sprawdź ustawienia powiadomień.'],
            invalid_action: [400, 'Nieznana operacja powiadomień.'],
          };
          const code = typeof r.data?.message === 'string' ? r.data.message : '';
          if (messages[code]) throw new ApiError(messages[code][0], code, messages[code][1]);
          if (['22P02','23514','23502'].includes(r.data?.code)) throw new ApiError(400, 'invalid_input', 'Sprawdź dane powiadomienia.');
          if (r.data?.code === '23505') throw new ApiError(409, 'device_conflict', 'Token jest już powiązany z urządzeniem. Wyłącz i ponownie włącz push.');
          // Awaria opcjonalnego modułu nie zmienia stanu sesji Auth.
          throw new ApiError(503, 'notifications_unavailable', 'Centrum powiadomień jest chwilowo niedostępne lub nie zostało skonfigurowane.');
        }
        return respond(r.data);
      }
      if (action.startsWith('events_')) {
        if (action === 'events_guest' || action === 'events_edit_guest') {
          if (body.guest_phone !== undefined && typeof body.guest_phone !== 'string')
            throw new ApiError(400, 'invalid_phone', 'Telefon musi być tekstem zawierającym 9 cyfr.');
          const rawPhone = typeof body.guest_phone === 'string' ? body.guest_phone : '';
          let existing: string | undefined;
          if (action === 'events_edit_guest' && rawPhone.trim().startsWith('+') && !rawPhone.trim().startsWith('+48')) {
            const id = field(body, 'participant_id', 36);
            if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(400, 'invalid_input', 'Nieprawidłowy identyfikator gościa.');
            const rows = await db(`slm_event_participants?id=eq.${id}&select=guest_phone`);
            existing = rows[0]?.guest_phone;
          }
          body.guest_phone = rawPhone.trim() ? normalizePhone(rawPhone, existing) : '';
        }
        await rate('events:' + ctx.id, 90);
        const r = await call('/rest/v1/rpc/slm_events_dispatch', 'POST', {
          p_user: ctx.id, p_session: ctx.sid, p_action: action.slice(7), p_body: body,
        }, undefined, true);
        if (!r.ok) {
          const messages: Record<string, [number, string]> = {
            session_invalid: [401, 'Sesja wygasła. Zaloguj się ponownie.'],
            forbidden: [403, 'Brak uprawnień do tej operacji.'],
            not_found: [404, 'Nie znaleziono meczu lub uczestnika.'],
            legacy_read_only: [409, 'Nowe mecze twórz w module grupowym. Ten widok zachowuje dane historyczne.'],
            registration_closed: [409, 'Zapisy i rezygnacje są zamknięte od początku meczu.'],
            event_cancelled: [409, 'Mecz został odwołany.'],
            event_full: [409, 'Brak wolnych miejsc. Możesz dołączyć do rezerwy.'],
            duplicate_signup: [409, 'Ten zapis już istnieje. Odśwież listę.'],
            capacity_too_small: [409, 'Limit nie może być mniejszy od liczby zapisanych.'],
            date_locked: [409, 'Po 17:00 nie można zmienić dnia meczu.'],
            invalid_event: [400, 'Sprawdź termin, miejsce, koszt i limit (minimum 10).'],
            invalid_guest: [400, 'Podaj nazwę gościa i opcjonalny polski numer telefonu (9 cyfr).'],
            invalid_participant: [400, 'Nieprawidłowy uczestnik.'],
            invalid_action: [400, 'Nieznana operacja wydarzenia.'],
            registration_not_allowed: [409, 'Konto nie ma teraz uprawnień do zapisu. Sprawdź aktualny dostęp i zaległości.'],
            settlement_blocked: [409, 'Dwa nieuregulowane mecze blokują nowy zapis i dodawanie gości. Sprawdź Rozliczenia.'],
            use_settlements: [409, 'Obecność po zatwierdzeniu zmień w panelu rozliczenia z powodem korekty.'],
            reason_required: [400, 'Podaj powód odwołania zatwierdzonego meczu.'],
          };
          const code = typeof r.data?.message === 'string' ? r.data.message : '';
          if (messages[code]) throw new ApiError(messages[code][0], code, messages[code][1]);
          if (['22P02', '22003', '22007', '22008', '23514'].includes(r.data?.code))
            throw new ApiError(400, 'invalid_event', 'Sprawdź dane formularza wydarzenia.');
          if (r.data?.code === '23505') throw new ApiError(409, 'duplicate_signup', 'Ten zapis już istnieje.');
          throw new ApiError(503, 'service_unavailable', 'Nie udało się potwierdzić operacji. Odśwież listę przed ponowieniem.');
        }
        return respond(r.data);
      }
      if (action === 'save_email_profile') {
        await rate('sensitive:' + ctx.id, 8);
        const identity = await alias(ctx.id);
        if (!identity.email_account) throw new ApiError(403, 'forbidden', 'To konto korzysta z profilu legacy.');
        const nickname = field(body, 'nickname', 48).trim();
        if (!nickname) throw new ApiError(400, 'invalid_input', 'Podaj pseudonim.');
        const rawPhone = field(body, 'phone', 32).trim();
        const phone = rawPhone ? normalizePhone(rawPhone, identity.phone as string) : '';
        if (phone !== identity.phone) await verifyPassword(ctx, password(body, 'current_password'));
        await db('rpc/slm_email_profile_save', 'POST', { p_user: ctx.id, p_session: ctx.sid,
          p_nickname: nickname, p_phone: phone, p_number: null });
        return respond(await profile(ctx.id));
      }
      if (action === 'save_jersey_number') {
        if(Object.keys(body).some(key=>!['action','jersey_number'].includes(key))||!Number.isInteger(body.jersey_number)||Number(body.jersey_number)<0||Number(body.jersey_number)>99)throw new ApiError(400,'invalid_number','Wpisz pełny numer od 0 do 99.');
        await rate('number:'+ctx.id,20);
        await db('rpc/slm_profile_number_save','POST',{p_user:ctx.id,p_session:ctx.sid,p_number:body.jersey_number});
        return respond(await profile(ctx.id));
      }
      if (action === 'profile') return respond(await profile(ctx.id));
      if (action === 'save_premium_profile') {
        await rate('scoped:' + ctx.id,90);
        const r = await call('/rest/v1/rpc/slm_premium_profile_save','POST',{p_user:ctx.id,p_session:ctx.sid,p_body:body},undefined,true);
        if(!r.ok)throw new ApiError(409,'profile_not_saved','Nie potwierdzono zapisu. Odśwież profil i sprawdź dane oraz zakres zgody.');
        return respond(await profile(ctx.id));
      }
      if (action === 'save_profile') {
        const name = field(body, 'full_name', 100).trim();
        const mode = field(body, 'display_as');
        if (!['nickname', 'first_name', 'full_name'].includes(mode)) throw new ApiError(400, 'invalid_input', 'Wybierz nazwę wyświetlaną.');
        await db(`slm_profiles?user_id=eq.${ctx.id}`, 'PATCH', { full_name: name, display_as: mode });
        return respond(await profile(ctx.id));
      }
      if (action === 'password' || action === 'identifiers') {
        await rate('sensitive:' + ctx.id, 8);
        const current = password(body, 'current_password');
        const next = action === 'password' ? password(body, 'new_password', true) : current;
        if (action === 'password' && next === current) throw new ApiError(400, 'same_password', 'Nowe hasło musi być inne.');
        const login = action === 'identifiers' ? normalizeLogin(field(body, 'login')) : null;
        const a = await verifyPassword(ctx, current);
        if (action === 'identifiers' && a.email_account === true) throw new ApiError(400, 'legacy_only', 'Konto e-mail nie używa aliasów logowania legacy.');
        const phone = action === 'identifiers' ? normalizePhone(field(body, 'phone'), a.phone as string) : null;
        if (action === 'identifiers') {
          const conflicts = await db(`slm_aliases?or=(login_normalized.eq.${encodeURIComponent(login!.toLowerCase())},phone.eq.${encodeURIComponent(phone!)})`);
          const contacts = await db(`slm_player_profiles?contact_phone=eq.${encodeURIComponent(phone!)}&select=user_id`);
          if ([...conflicts,...contacts].some((row: Row) => row.user_id !== ctx.id))
            throw new ApiError(409, 'identifier_taken', 'Login lub numer telefonu jest już zajęty.');
        }
        const op = await rpc('begin', { p_actor: ctx.id, p_session: ctx.sid, p_target: ctx.id,
          p_kind: action === 'password' ? 'password' : 'identifiers' });
        if (action === 'password') {
          const r = await call('/auth/v1/user', 'PUT', { password: next, current_password: current }, token);
          if (!r.ok) throw new ApiError(409, 'operation_pending', 'Zmiana nie została zakończona. Skontaktuj się z administratorem.');
        }
        const fresh = await authLogin(a.technical_email, next);
        const u = await verify(fresh.access_token);
        if (u.id !== ctx.id) { await rejectSession(fresh); throw unauthorized(); }
        const done = await rpc('finish', { p_user: ctx.id, p_operation: op.operation_id,
          p_session: u.sid, p_login: login, p_phone: phone, p_actor: ctx.id });
        if (!done) { await rejectSession(fresh); throw unauthorized(); }
        return respond(await sessionPayload(fresh));
      }
      if (ctx.role !== 'admin') throw new ApiError(403, 'forbidden', 'Brak uprawnień administratora.');
      await rate('admin:' + ctx.id, 20);
      if (action === 'list_accounts') {
        const offset = typeof body.offset === 'number' && Number.isInteger(body.offset) && body.offset >= 0 ? body.offset : 0;
        const aliases = await db(`slm_aliases?order=login_normalized&limit=50&offset=${offset}`);
        const rows = await Promise.all(aliases.map(async (a: Row) => {
          const [p, s, roles] = await Promise.all([profile(a.user_id as string), state(a.user_id as string), db(`slm_roles?user_id=eq.${a.user_id}`)]);
          return { ...p, role: roles[0].role, must_change_password: s.must_change_password, operation_pending: !!s.operation_id };
        }));
        return respond(rows);
      }
      if (action === 'create_account') {
        const login = normalizeLogin(field(body, 'login'));
        const phone = normalizePhone(field(body, 'phone'));
        const temporary = randomPassword();
        const email = `${crypto.randomUUID()}@slm.invalid`;
        const r = await call('/auth/v1/admin/users', 'POST', { email, password: temporary, email_confirm: true }, undefined, true);
        if (!r.ok) throw new ApiError(409, 'create_failed', 'Nie udało się utworzyć konta.');
        try {
          await rpc('provision', { p_user: r.data.id, p_login: login, p_phone: phone, p_email: email,
            p_actor: ctx.id, p_actor_session: ctx.sid, p_admin: false });
        } catch (error) {
          // Konto bez profilu pozostaje zablokowane także, jeśli cleanup Auth się nie powiedzie.
          await call('/auth/v1/admin/users/' + r.data.id, 'DELETE', undefined, undefined, true);
          throw error;
        }
        return respond({ user_id: r.data.id, temporary_password: temporary });
      }
      if (action === 'reset_password') {
        const target = field(body, 'user_id', 36);
        if (!/^[0-9a-f-]{36}$/i.test(target)) throw new ApiError(400, 'invalid_input', 'Nieprawidłowe konto.');
        if (target === ctx.id) throw new ApiError(400, 'self_reset', 'Własne hasło zmień w profilu.');
        const op = await rpc('begin', { p_actor: ctx.id, p_session: ctx.sid, p_target: target, p_kind: 'reset' });
        const temporary = randomPassword();
        const r = await call('/auth/v1/admin/users/' + target, 'PUT', { password: temporary }, undefined, true);
        if (!r.ok || !(await rpc('finish', { p_user: target, p_operation: op.operation_id, p_actor: ctx.id })))
          throw new ApiError(409, 'operation_pending', 'Reset nie został zakończony. Skontaktuj się z właścicielem projektu.');
        return respond({ temporary_password: temporary });
      }
      throw new ApiError(400, 'invalid_action', 'Nieznana operacja.');
    } catch (error) {
      if (error instanceof ApiError || error instanceof PhotoError) return respond({ error: error.message, code: error.code }, error.status);
      return respond({ error: 'Nie udało się wykonać operacji. Spróbuj ponownie.', code: 'server_error' }, 500);
    }
  };
}

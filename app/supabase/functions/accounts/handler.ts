export interface Environment { url: string; anon: string; service: string; origins: string[] }
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
export function normalizePhone(value: string): string {
  const result = value.replace(/[\s()-]/g, '');
  if (!/^\+[1-9][0-9]{7,14}$/.test(result))
    throw new ApiError(400, 'invalid_phone', 'Podaj numer z prefiksem kraju, np. +48, oraz 8–15 cyfr.');
  return result;
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
    if (rows.length !== 1) throw unauthorized();
    return rows[0];
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
    const [a, profiles] = await Promise.all([alias(id), db(`slm_profiles?user_id=eq.${id}`)]);
    const p = profiles[0];
    if (!p) throw unauthorized();
    return { user_id: id, login: a.login, phone: a.phone, full_name: p.full_name,
      display_as: p.display_as, display_name: displayName(a.login, p.full_name, p.display_as) };
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
      const text = await request.text();
      if (new TextEncoder().encode(text).length > 12000) throw new ApiError(413, 'too_large', 'Za duże żądanie.');
      let parsed: unknown;
      try { parsed = JSON.parse(text); }
      catch { throw new ApiError(400, 'invalid_input', 'Nieprawidłowe żądanie.'); }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new ApiError(400, 'invalid_input', 'Nieprawidłowe żądanie.');
      const body = parsed as Row;
      const action = field(body, 'action', 40);
      await rate('global', 300);
      if (action === 'login') {
        const start = Date.now();
        const raw = field(body, 'identifier').trim();
        const pwd = password(body, 'password');
        let rows: Row[] = [];
        try {
          const normalized = raw.startsWith('+') ? normalizePhone(raw) : normalizeLogin(raw).toLowerCase();
          await rate('identifier:' + normalized, 16);
          rows = await db(`slm_aliases?${raw.startsWith('+') ? 'phone' : 'login_normalized'}=eq.${encodeURIComponent(normalized)}`);
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
      if (action === 'logout') {
        const u = await verify(token);
        await rpc('revoke_session', { p_user: u.id, p_session: u.sid });
        // Odwołanie dostępu w SQL jest obowiązkowe; awaria Auth logout nie przywraca
        // go nawet przy odświeżeniu tokenu. Nie zgłaszamy fikcyjnego sukcesu SQL.
        await call('/auth/v1/logout?scope=local', 'POST', undefined, token).catch(() => undefined);
        return respond({ ok: true });
      }
      const ctx = await context(token);
      if (action === 'status') return respond({ must_change_password: ctx.must_change_password, role: ctx.role, user_id: ctx.id });
      if (ctx.must_change_password && action !== 'password')
        throw new ApiError(403, 'password_required', 'Najpierw zmień hasło tymczasowe.');
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
      if (action.startsWith('events_')) {
        await rate('events:' + ctx.id, 90);
        const r = await call('/rest/v1/rpc/slm_events_dispatch', 'POST', {
          p_user: ctx.id, p_session: ctx.sid, p_action: action.slice(7), p_body: body,
        }, undefined, true);
        if (!r.ok) {
          const messages: Record<string, [number, string]> = {
            session_invalid: [401, 'Sesja wygasła. Zaloguj się ponownie.'],
            forbidden: [403, 'Brak uprawnień do tej operacji.'],
            not_found: [404, 'Nie znaleziono meczu lub uczestnika.'],
            registration_closed: [409, 'Zapisy i rezygnacje są zamknięte od początku meczu.'],
            event_cancelled: [409, 'Mecz został odwołany.'],
            event_full: [409, 'Brak wolnych miejsc. Możesz dołączyć do rezerwy.'],
            duplicate_signup: [409, 'Ten zapis już istnieje. Odśwież listę.'],
            capacity_too_small: [409, 'Limit nie może być mniejszy od liczby zapisanych.'],
            date_locked: [409, 'Po 17:00 nie można zmienić dnia meczu.'],
            invalid_event: [400, 'Sprawdź termin, miejsce, koszt i limit (minimum 10).'],
            invalid_guest: [400, 'Podaj nazwę gościa i poprawny opcjonalny numer z prefiksem kraju.'],
            invalid_participant: [400, 'Nieprawidłowy uczestnik.'],
            invalid_action: [400, 'Nieznana operacja wydarzenia.'],
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
      if (action === 'profile') return respond(await profile(ctx.id));
      if (action === 'save_profile') {
        const name = field(body, 'full_name', 100).trim();
        const mode = field(body, 'display_as');
        if (!['nickname', 'full_name'].includes(mode)) throw new ApiError(400, 'invalid_input', 'Wybierz nazwę wyświetlaną.');
        await db(`slm_profiles?user_id=eq.${ctx.id}`, 'PATCH', { full_name: name, display_as: mode });
        return respond(await profile(ctx.id));
      }
      if (action === 'password' || action === 'identifiers') {
        await rate('sensitive:' + ctx.id, 8);
        const current = password(body, 'current_password');
        const next = action === 'password' ? password(body, 'new_password', true) : current;
        if (action === 'password' && next === current) throw new ApiError(400, 'same_password', 'Nowe hasło musi być inne.');
        const login = action === 'identifiers' ? normalizeLogin(field(body, 'login')) : null;
        const phone = action === 'identifiers' ? normalizePhone(field(body, 'phone')) : null;
        const a = await verifyPassword(ctx, current);
        if (action === 'identifiers') {
          const conflicts = await db(`slm_aliases?or=(login_normalized.eq.${encodeURIComponent(login!.toLowerCase())},phone.eq.${encodeURIComponent(phone!)})`);
          if (conflicts.some((row: Row) => row.user_id !== ctx.id))
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
      if (error instanceof ApiError) return respond({ error: error.message, code: error.code }, error.status);
      return respond({ error: 'Nie udało się wykonać operacji. Spróbuj ponownie.', code: 'server_error' }, 500);
    }
  };
}

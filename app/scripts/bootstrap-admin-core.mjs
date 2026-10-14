import { normalizePolishPhone } from '../supabase/functions/_shared/phone.ts';
import { randomUUID } from 'node:crypto';

export function validateBootstrap(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.confirm !== 'CREATE_FIRST_ADMIN') throw new Error('Potwierdzenie utworzenia konta jest wymagane.');
  const login = typeof input.login === 'string' ? input.login.trim().normalize('NFC') : '';
  const phone = normalizePolishPhone(typeof input.phone === 'string' ? input.phone : '');
  if (!/^[\p{L}][\p{L}\p{N}_.-]{2,31}$/u.test(login)) throw new Error('Login: 3–32 znaki, pierwsza litera; dalej litery, cyfry, _, . lub -.');
  if (typeof input.password !== 'string' || input.password.length < 8 || Buffer.byteLength(input.password) > 72)
    throw new Error('Hasło tymczasowe: minimum 8 znaków, maksimum 72 bajty UTF-8.');
  return { login, phone, password: input.password };
}

export async function checkFirstAdmin(api) {
  const roles = await api.request('/rest/v1/slm_roles?role=eq.admin&select=user_id&limit=1');
  if (!roles.ok || !Array.isArray(roles.data)) throw new Error('Nie udało się sprawdzić roli administratora.');
  if (roles.data.length) throw new Error('Administrator już istnieje. Bootstrap nie utworzy kolejnego.');
}

export async function createFirstAdmin(api, input) {
  const values = validateBootstrap(input);
  await checkFirstAdmin(api);
  let created;
  try {
    const email = `${randomUUID()}@slm.invalid`;
    const user = await api.request('/auth/v1/admin/users', 'POST', { email, password: values.password, email_confirm: true });
    if (!user.ok || !user.data?.id) throw new Error('Nie udało się utworzyć konta Auth.');
    created = user.data.id;
    const provision = await api.request('/rest/v1/rpc/slm_account_provision', 'POST', {
      p_user: created, p_login: values.login, p_phone: values.phone, p_email: email, p_admin: true,
    });
    if (!provision.ok) throw new Error('Nie udało się przypisać profilu i roli.');
    const state = await api.request('/rest/v1/slm_account_security?user_id=eq.' + created + '&select=must_change_password,active,operation_id');
    const role = await api.request('/rest/v1/slm_roles?user_id=eq.' + created + '&select=role');
    if (!state.ok || state.data?.length !== 1 || state.data[0].must_change_password !== true ||
        state.data[0].active !== true || state.data[0].operation_id !== null || !role.ok || role.data?.[0]?.role !== 'admin')
      throw new Error('Nie potwierdzono roli i obowiązkowej zmiany hasła.');
  } catch {
    if (created) {
      const deleted = await api.request('/auth/v1/admin/users/' + created, 'DELETE').catch(() => null);
      if (!deleted?.ok) throw new Error('Nie ukończono bootstrap; własne nowe konto wymaga kontroli w panelu projektu.');
    }
    throw new Error('Nie ukończono bootstrap. Sprawdź stan projektu przed ponowieniem; nie zmieniaj istniejących kont.');
  } finally { values.password = null; }
}

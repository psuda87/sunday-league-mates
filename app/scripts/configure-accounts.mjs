import { assertBranch, assertSafeConfig, management } from './accounts-admin.mjs';
try {
  assertBranch();
  const before = await management('/config/auth');
  // Nie zastępujemy hooków innej aplikacji ani istniejącej CAPTCHA.
  for (const type of ['email', 'sms']) {
    if (before[`hook_send_${type}_enabled`] &&
        !['slm_account_block_' + type, 'slm_auth_proof_block_' + type].some(n =>
          before[`hook_send_${type}_uri`] === `pg-functions://postgres/public/${n}`))
      throw new Error('Nieznany aktywny hook');
  }
  if (before.security_captcha_enabled) throw new Error('Istniejąca CAPTCHA wymaga integracji klienta');
  const changes = {
    disable_signup: true,
    external_email_enabled: true,
    external_phone_enabled: false,
    external_anonymous_users_enabled: false,
    security_manual_linking_enabled: false,
    mailer_autoconfirm: false,
    mailer_secure_email_change_enabled: true,
    hook_send_email_enabled: true,
    hook_send_sms_enabled: true,
    hook_send_email_uri: 'pg-functions://postgres/public/slm_account_block_email',
    hook_send_sms_uri: 'pg-functions://postgres/public/slm_account_block_sms',
    security_update_password_require_current_password: true,
    password_min_length: 8,
    security_update_password_require_reauthentication: false,
  };
  for (const k of Object.keys(before)) if (/^mailer_notifications_.*_enabled$/.test(k)) changes[k] = false;
  await management('/config/auth', 'PATCH', changes);
  const after = await management('/config/auth');
  assertSafeConfig(after);
  for (const k of Object.keys(before)) {
    if (/^rate_limit_/.test(k) && before[k] !== after[k]) throw new Error('Zmiana limitu');
  }
  for (const [k, v] of Object.entries(changes)) if (after[k] !== v) throw new Error('Hook nie został zastosowany');
  console.log('OK: docelowe hooki i wymaganie obecnego hasła aktywne. Minimum 8 znaków. Limity bez zmian. Nie wykonano testu e-maila.');
} catch { console.log('BLOKADA konfiguracji kont. Sprawdź token i wymagane ustawienia.'); process.exitCode = 1; }

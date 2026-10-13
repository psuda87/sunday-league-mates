// Zmienia wyłącznie minimalną długość hasła w zatwierdzonym projekcie.
import { assertBranch, assertSafeConfig, management } from './accounts-admin.mjs';
try {
  assertBranch();
  const before = await management('/config/auth');
  assertSafeConfig(before);
  await management('/config/auth', 'PATCH', { password_min_length: 8 });
  const after = await management('/config/auth');
  assertSafeConfig(after);
  if (after.password_min_length !== 8) throw new Error('minimum');
  for (const key of Object.keys(before)) {
    if (/rate_limit|hook_send_|mailer_|security_captcha/.test(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      throw new Error('ustawienia ochrony');
  }
  console.log('OK: minimum hasła 8; limity, hooki, poczta i CAPTCHA bez zmian.');
} catch {
  console.error('Nie potwierdzono konfiguracji długości hasła; sprawdź projekt. Bez ujawniania odpowiedzi API.');
  process.exitCode = 1;
}

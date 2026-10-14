// Lokalny bootstrap; hasło wyłącznie na stdin z wrappera PowerShell.
import { assertBranch, assertSafeConfig, management, server, ref } from './accounts-admin.mjs';
import { checkFirstAdmin, createFirstAdmin } from './bootstrap-admin-core.mjs';
let input;
try {
  assertBranch();
  const mode = process.argv.slice(2);
  if (mode.length !== 1 || !['--check', '--stdin'].includes(mode[0]))
    throw new Error('Użyj app/scripts/bootstrap-admin.ps1; dane konta nie są argumentami polecenia.');
  const config = await management('/config/auth');
  assertSafeConfig(config);
  if (config.hook_send_email_uri !== 'pg-functions://postgres/public/slm_account_block_email' ||
      config.hook_send_sms_uri !== 'pg-functions://postgres/public/slm_account_block_sms')
    throw new Error('Wymagane są docelowe hooki modułu kont.');
  const api = await server();
  await checkFirstAdmin(api);
  if (mode[0] === '--check') {
    console.log('OK: ' + ref + ', konfiguracja Auth bezpieczna, brak administratora. Tylko odczyt.');
  } else {
    process.stdin.setEncoding('utf8');
    let raw = '';
    for await (const chunk of process.stdin) {
      raw += chunk.toString('utf8');
      if (Buffer.byteLength(raw) > 12000) throw new Error('Nieprawidłowe wejście bootstrap.');
    }
    try { input = JSON.parse(raw.replace(/^\uFEFF/, '')); }
    catch { throw new Error('Nieprawidłowe wejście bootstrap.'); }
    finally { raw = null; }
    await createFirstAdmin(api, input);
    console.log('OK: pierwszy administrator utworzony. Wymuszona zmiana hasła potwierdzona. Zaloguj się i ustaw własne hasło.');
  }
} catch (error) {
  // Wyłącznie znane komunikaty aplikacji; nigdy surowe odpowiedzi/stack/payload.
  const safe = [
    'Wymagany branch feat/auth', 'Brak lokalnego SUPABASE_ACCESS_TOKEN',
    'Administrator już istnieje. Bootstrap nie utworzy kolejnego.',
    'Użyj app/scripts/bootstrap-admin.ps1; dane konta nie są argumentami polecenia.',
    'Wymagane są docelowe hooki modułu kont.',
    'Potwierdzenie utworzenia konta jest wymagane.',
    'Login: 3–32 znaki, pierwsza litera; dalej litery, cyfry, _, . lub -.',
    'Podaj polski numer: dokładnie 9 cyfr, opcjonalnie z +48 lub 0048.',
    'Hasło tymczasowe: minimum 8 znaków, maksimum 72 bajty UTF-8.',
    'Nie ukończono bootstrap; własne nowe konto wymaga kontroli w panelu projektu.',
    'Nie ukończono bootstrap. Sprawdź stan projektu przed ponowieniem; nie zmieniaj istniejących kont.',
  ];
  console.log('BLOKADA: ' + (safe.includes(error.message) ? error.message :
    'Nie udało się zakończyć operacji. Sprawdź PAT, konfigurację Auth i stan kont w panelu; nie podnoś limitów.'));
  process.exitCode = 1;
} finally { if (input && typeof input === 'object') input.password = null; input = null; }

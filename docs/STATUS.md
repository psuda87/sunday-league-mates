# Aktualny stan Sunday League Mates

Aktualizacja: 14.10.2026. Branch: `feat/integration`, worktree `I:/slm/sunday-league-mates-integration`.
Baza: `origin/feat/events` (`6638e18`); lokalnie zintegrowano `origin/feat/settlements`
(`81d71c7`) i `origin/feat/push-notifications` (`103d08c`). Bez pusha i zmian innych gałęzi.
Oryginalny katalog na feat/events i nieśledzony pics/ zachowano.

## Wykonane

- Auth i sesje, wydarzenia, goście i rezerwa zachowane.
- Połączono UI/API rozliczeń i centrum powiadomień, wspólny RPC zapisów z kontrolą
  dwóch zaległych meczów oraz nawigację finansowego powiadomienia do Rozliczeń.
- Adapter tworzy inbox/outbox dla rzeczywistych decyzji wpłat i zmian blokady
  w tej samej transakcji, po końcowym przeliczeniu, z kluczem trwałego audytu.
- Sześć nowych migracji jest przygotowanych i połączonych, ale **nie zastosowanych**.
  Edge accounts/push-worker zmienione lokalnie, **nie wdrożone**. Firebase nie konfigurowano.

## Kontrole zintegrowanej wersji

| Kontrola | Wynik |
|---|---|
| npm ci z istniejącego lockfile | OK; binarium Cypress pominięte |
| TypeScript klienta | OK |
| Strict TypeScript accounts i push-worker | OK |
| ESLint | OK, bez błędów i ostrzeżeń po poprawkach |
| Build webowy | OK; ostrzeżenie chunków >500 kB |
| git diff --check | OK |
| Migracje / testy SQL / RLS / równoczesność | NIE WYKONANO |
| Vitest / Cypress / Android / iOS / FCM | NIE WYKONANO w tej integracji |

Starsze wyniki Auth/events nie są dowodem działania integracji.

## Otwarte i następny krok

Kod przygotowany do kolejnego etapu lokalnej weryfikacji, ale poprawność SQL i adaptera
nie jest potwierdzona wykonaniem. Docker, Supabase CLI i Deno nie są dostępne w PATH.
Potrzebne jest jednorazowe lokalne środowisko Supabase, sześć migracji w kolejności,
testy finansów/powiadomień oraz wyścigi i RLS. Nie używać zdalnego projektu ani
starych skryptów test-events z DELETE nieusuwalnej historii finansów.
Worktree ma ignorowany `.env.local` z wyłącznie lokalnym URL accounts, bez sekretów;
nie skopiowano żadnej konfiguracji kont z oryginalnego katalogu. Push domyślnie wyłączony.
CAPTCHA i ręczne testy offline/starych sesji odłożone, iOS niezweryfikowany.
Zatrzymano pracę po pierwszej weryfikacji; dalsze testy/wdrożenia wymagają polecenia.

Szczegóły: [INTEGRATION_REPORT.md](INTEGRATION_REPORT.md),
[SETTLEMENTS_MODULE.md](SETTLEMENTS_MODULE.md), [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md).

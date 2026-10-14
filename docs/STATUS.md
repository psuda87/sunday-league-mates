# Aktualny stan Sunday League Mates

14.10.2026 — feat/integration, I:/slm/sunday-league-mates-integration.
Settlements i push-notifications zintegrowane na bazie feat/events.
Sprawdzone poprawki i dokumentacja zapisane lokalnym commitem tego zadania; bez pusha. Oryginalny katalog i pics/ zachowano.

## Wykonane

Auth/sesje, wydarzenia, goście i rezerwa; połączone rozliczenia i centrum powiadomień.
Transakcyjny adapter finansowego inbox/outbox przygotowany, SQL nadal niezweryfikowany.
Polskie numery: 9 cyfr, +48/0048/separatory; wspólna normalizacja UI/Edge/bootstrap,
stały prefiks, brak zmiany danych istniejących kont. Historyczne numery zachowane.
Naprawiona atrapa otwierania powiadomienia w Cypress.

## Wdrożenia

Sześć nowych migracji finansów/powiadomień NIE ZASTOSOWANO.
Accounts i push-worker NIE WDROŻONO w tym etapie. Zdalny Supabase bez zmian.
Firebase nie konfigurowano. Lokalna izolowana konfiguracja przygotowana, start zablokowany.

## Faktyczne kontrole

- TypeScript klienta, Deno check trzech wejść Edge, lint, build web, git diff --check: OK.
- Vitest 66/66 (11 plików), bootstrap mock 6/6, Cypress API mock 10/10 (4 pliki).
- Audit: 6 moderate, produkcyjny 3 moderate, 0 high/critical; bez zmiany zależności.
- Build: ostrzeżenie dużych chunków. Cypress: Electron deprecated/Browserslist.
- Rzeczywiste migracje/SQL/RLS/wyścigi: NIEWYKONANE, brak Docker/Podman i WSL.
- Android/iOS/FCM integracji: NIEWYKONANE. Starsze ręczne testy Auth nie dowodzą integracji.

## Następny etap / ograniczenia

Uruchomić Docker Desktop, izolowane migracje i przygotowane SQL, uzupełnić prawdziwe
równoległe RPC oraz test adaptera finansowego/rollback; potem lokalny Auth i Android.
CLI 2.121.0 i Deno 2.9.6 działają przez cache npm, nie wymagają globalnej instalacji.
CAPTCHA odłożona; iOS, FCM i dodatkowe ręczne scenariusze sesji niezweryfikowane.
Nie uruchamiać starych zdalnych harnessów testowych ani resetować bazy.

Szczegóły, lista migracji i instrukcje: [LOCAL_VERIFICATION.md](LOCAL_VERIFICATION.md).

## Ponowne sprawdzenie środowiska

Git diff --check: OK; przegląd zmienionych plików nie wykazał sekretów ani artefaktów.
Supabase CLI 2.121.0 działa także przez npx supabase. Docker Desktop nie znaleziono
w standardowych lokalizacjach ani rejestrze aplikacji; brak docker.exe w PATH,
usługi com.docker.service i procesów silnika. Etap bazodanowy zatrzymany.
Nie wykonywano startu, migracji, SQL, RPC/RLS ani testów atomowości w tym zadaniu.
Nie resetowano baz, nie instalowano Dockera, nie zmieniano Windows ani zdalnego Supabase.
Wyniki testów kodu powyżej pochodzą z poprzedniego etapu; nie powtarzano ich przy
samym przeglądzie i aktualizacji dokumentacji.

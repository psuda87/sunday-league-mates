# Weryfikacja lokalna integracji — 14.10.2026

Worktree: `I:/slm/sunday-league-mates-integration`, branch `feat/integration`, HEAD `5d3048b`.
Zmiany tego zadania są niezacommitowane. Nie wykonano pusha, zdalnych migracji,
wdrożeń Edge ani konfiguracji Firebase. Oryginalny katalog i pics/ zachowano.

## Numery i poprawki

Wspólny `functions/_shared/phone.ts` obsługuje 9 cyfr, +48, 0048 i separatory;
nowy zapis jest zawsze +48XXXXXXXXX. Nie przycina błędnych numerów do poprawnej długości.
Accounts/profil/panel administratora, goście i bootstrap używają tych samych zasad.
Komponent PhoneInput pokazuje stały prefiks +48. Historyczne zagraniczne numery
pozostają dostępne przy logowaniu oraz bez zmiany przy edycji innych danych.
Serwer weryfikuje zachowywany numer z bazy, nie ufa wartości starego numeru od klienta.
Nie migrowano danych kont, nie zmieniano architektury Auth, nie dodano rejestracji,
zaproszeń, maili ani SMS. SQL zachowuje szerszą historyczną walidację E.164;
nowe wejście jest normalizowane na bramie Edge, RPC zapisu pozostają service-only.

Naprawiono atrapę Cypress `notifications_open`: obiekt z polem body trzeba podać
jako `req.reply({ body: item() })`, inaczej Cypress interpretuje go jako StaticResponse.
W pomocnikach formularzy wyłączono logowanie wpisywanych wartości testowych.

## Faktycznie wykonane kontrole

| Kontrola | Końcowy wynik |
|---|---|
| TypeScript klienta | OK (`tsc` także w buildzie) |
| Deno 2.9.6 check accounts/index, local-entrypoint, push-worker | OK |
| ESLint | OK |
| Vitest | 66/66, 11 plików |
| Node bootstrap (Admin API mock) | 6/6 |
| Cypress 16.1.1, Electron, lokalny Vite :5174 | 10/10, 4 specyfikacje |
| Build web | OK; ostrzeżenie chunków >500 kB |
| npm audit | 6 moderate, 0 high, 0 critical; exit 1 |
| npm audit --omit=dev | 3 moderate, 0 high, 0 critical; exit 1 |
| git diff --check | OK |
| Migracje / SQL / rzeczywiste RLS i równoczesne RPC | NIE WYKONANO — brak silnika kontenerów |
| Android / iOS / FCM | NIE WYKONANO |

Pierwszy pełny Cypress: 9/10; po poprawce atrapy końcowy pełny przebieg 10/10.
Pierwsze ponowienie bez usunięcia ELECTRON_RUN_AS_NODE zakończyło się exit 1;
przebieg końcowy wykonano po usunięciu tej odziedziczonej zmiennej.
Testy UI używają kontrolowanego API; nie potwierdzają działania prawdziwych RPC.
Vitest sprawdza m.in. normalizację, bramy uprawnień, sesje i obsługę workera.
Bootstrap sprawdza wyłącznie fikcyjny Admin API, nie tworzył użytkowników.

Audyt pozostawił dev: @capacitor/cli → xcode → uuid i prod:
@ionic/react-router → react-router/react-router-dom. Liczby to wpisy npm, nie liczba
niezależnych luk. Wynik nie pogorszył się względem poprzedniego audytu integracji.
Proponowane automatycznie rozwiązania zmieniają główną wersję/router lub obniżają
CLI; nie zastosowano ich bez osobnej migracji zgodności Ionic/Capacitor.
Raporty JSON obok tego dokumentu zawierają aktualne zakresy i advisories.
Nie użyto audit fix --force i nie zmieniono zależności ani lockfile w tym zadaniu.

## Lokalne Supabase i kolejność SQL

Znaleziono/uruchomiono oficjalne narzędzia przez cache npm: Supabase CLI 2.121.0,
Deno 2.9.6, bez instalacji globalnej. Docker/Podman nie znaleziono w PATH ani
sprawdzonych typowych lokalizacjach; brak usługi Docker i zainstalowanego WSL.
CLI init utworzył izolowaną, ignorowaną konfigurację `.cache/supabase-integration`.
Nie skopiowano produkcyjnych env ani PAT. Start (exit 1) zwrócił dokładnie:

```
DockerLifecycleInspectError: failed to inspect container health:
docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure it is on PATH
```

Windows Docker Desktop wymaga środowiska/systemowych składników, których nie
instalowano samodzielnie. Nie zastępowano testów lokalnych zdalnymi.
[Oficjalne wymagania lokalnego Supabase](https://supabase.com/docs/guides/local-development),
[instalacja Deno](https://docs.deno.com/runtime/getting_started/installation/).

Po 7 bazowych migracjach, sześć nowych, nadal NIEZASTOSOWANYCH:

1. 20261014100000_settlements_ledger.sql
2. 20261014101000_settlements_rpc.sql
3. 20261014102000_settlements_events_integration.sql
4. 20261014120000_notifications_core.sql
5. 20261014121000_notifications_rpc_and_worker.sql
6. 20261014122000_notifications_events_eligibility.sql

Ostatnia migracja łączy finansowe dispatch z filtrem powiadomień i transakcyjnym
adapterem: wrapper zachowuje kontrolę sesji, rdzeń jest service-only; końcowy
snapshot tworzy finansowy inbox/outbox po całej operacji, klucz oparty na audycie.
RLS/granty i brak kolizji nazw oceniono statycznie; kompilacja PostgreSQL niepotwierdzona.
Firebase pozostaje opcjonalny: inbox niezależny, worker bez konfiguracji nie odbiera
zadań do wysłania. Nie jest to obietnica wysłania push ani exactly-once FCM.

Przygotowane testy: `supabase/tests/settlements.sql`, `notifications.sql` oraz
nowy `integration-contracts.sql` (wrappery, granty, snapshot). Wszystkie ROLLBACK.
Nowy `scripts/test-integration-local.ps1` działa wyłącznie na feat/integration,
izolowanym projekcie slm-integration-isolated, nie czyta env ani zdalnego DSN,
wyłącza signup i nie wypisuje outputu CLI zawierającego klucze.
Nie jest wykonanym testem; obecnie zatrzymuje się na braku Docker.
Nie używać starych harnessów test-events/test-accounts: DELETE nieusuwalnej historii,
zdalne założenia i historyczne zabezpieczenia brancha nie nadają się do integracji.
Nie pozostawiono nowego endpointu testowego/bootstrap; local-entrypoint.example
jest wyłącznie istniejącym wejściem do lokalnego runtime, nie do deploy.

## Scenariusze biznesowe — stan dowodów

| Scenariusz | Dostępny dowód i brak |
|---|---|
| Zapis/rezygnacja, duplikaty, limit i ostatnie miejsce | Brama/UI mock; prawdziwe transakcje i równoczesność niewykonane |
| Goście, osobne miejsce i odpowiedzialność | UI mock; przygotowany SQL finansów, niewykonany |
| Rezerwa bez automatycznego awansu | UI mock i statyczny RPC; prawdziwy SQL niewykonany |
| Przed/po 17:00, minimum 10, Europe/Warsaw | Przygotowany fixture finansów i przegląd SQL; niewykonane na DB |
| FIFO zwolnionych miejsc / zastąpienie finansowe | Przygotowany fixture finansów; niewykonany |
| Obecność i podział groszy | Przygotowany fixture finansów; niewykonany |
| Zatwierdzenie, korekty i rewizje meczu | UI mock, brama konfliktów; rzeczywisty ledger niewykonany |
| Wpłaty: accept/reject/correct, częściowe/nadpłata | Przygotowany SQL/brama/UI; rzeczywiste RPC niewykonane |
| FIFO długu i dwie różne zaległe gry | UI mock i przygotowany SQL; prawdziwa blokada zapisu niewykonana |
| RLS i obce dane / rola admin | Brama jednostkowa i SQL grantów; rzeczywiste JWT/RLS niewykonane |
| Finansowe powiadomienia / adapter / rollback | Przegląd kodu, kontrakty przygotowane; pełny test transakcji niewykonany |
| Zwolnione miejsce i filtrowanie zadłużonych | Przygotowany SQL powiadomień; niewykonany |
| Idempotencja ponowień | Brama/worker unit; trwałe klucze DB niewykonane |
| Równoległe workery i wyścigi decyzji/zapisów | Przygotowany SQL leases; prawdziwe równoległe połączenia niewykonane |
| Bez Firebase, odwołanie i koniec zapisów | UI/worker mock i statyczny SQL; pełne DB/urządzenie niewykonane |

## Następne kroki i instrukcje

1. Zainstalować i uruchomić Docker Desktop (silnik Linux/WSL2); nowy terminal musi
   rozpoznawać `docker version`. Instalacja wymaga decyzji i uprawnień użytkownika.
2. W tym worktree: `powershell -NoProfile -File app/scripts/test-integration-local.ps1 -RunSql`.
   Używa osobnego projektu lokalnego; nie wykonuje reset ani zdalnych operacji.
   Na świeżej bazie CLI start stosuje wszystkie skopiowane migracje.
3. Uzupełnić realne testy wielopołączeniowe ostatniego miejsca, accept/accept,
   accept/reject, zapisu kontra wpłaty, adaptera finansowego i rollback. Same fixtures
   SQL i mocki nie są wystarczającym odbiorem integracji. Następnie lokalny Auth/Edge
   przez local-entrypoint.example, bez kopii produkcyjnych env, bez maili/SMS.
4. Android dopiero po tym odbiorze: w app `npm run build`, `npx cap sync android`,
   `npx cap open android`. Ustawić endpoint wyłącznie lokalnego testowego backendu
   dostępnego z urządzenia (nie zdalnego produkcyjnego projektu), przygotować fikcyjne
   konta i ręcznie sprawdzić zapis/gościa/rezygnację oraz rozliczenia. Nie wykonywano tego.
5. FCM osobno: Firebase Spark, wyłącznie Cloud Messaging, bez Blaze/Cloud Functions;
   lokalny google-services.json jest ignorowany. Serwerowe dane HTTP v1 przechowywać
   tylko lokalnie/sekrety runtime, nigdy w kliencie lub Git. Nie konfiguruj Firebase
   produkcyjnego na potrzeby tych testów. Bez konfiguracji sprawdzaj tylko inbox.

Projekt przechodzi kontrole kodu i UI. Nie jest zatwierdzony do wdrożenia:
SQL/RLS/adapter/równoczesność wymagają rzeczywistego wykonania po uruchomieniu Dockera.
CAPTCHA odłożona, iOS, realny FCM i dodatkowe ręczne scenariusze sesji niezweryfikowane.

## Kolejny przegląd i lokalny zapis — 14.10.2026

Pracowano nadal na feat/integration. Sprawdzono git status, diff, nowe pliki
i git diff --check (OK). Kontrola ścieżek: 0 zabronionych artefaktów; kontrola
wzorców PAT, kluczy prywatnych i JWT: 0 trafień. Nie kopiowano ani nie odczytywano
produkcyjnych env. Ignorowanie lokalnego env, konfiguracji .cache i dist potwierdzone.
Poprawki i dokumentację objęto autoryzowanym lokalnym commitem, bez pusha.

Ponownie potwierdzono CLI 2.121.0 przez npx supabase --version oraz przypięty pakiet.
Docker Desktop nie znaleziono w standardowych folderach ani wpisach deinstalacyjnych
HKLM/HKCU; brak docker.exe w PATH i sprawdzonych shimach, usługi com.docker.service
oraz procesów Docker Desktop/com.docker.backend/dockerd. Nie ma dostępnego silnika
Docker, więc zgodnie z poleceniem zakończono etap bazodanowy bez uruchamiania
Supabase, migracji lub testów SQL/RPC/RLS/FIFO/atomowości.

Potrzebny jest zainstalowany Docker Desktop i uruchomiony silnik Linux z działającym
docker version (Client i Server). Instalacja/systemowe ustawienia wymagają decyzji
użytkownika; nie wykonano ich. Nie resetowano żadnej istniejącej bazy.
Wyniki 66/66, 10/10, 6/6 i kontroli kodu pozostają wynikami poprzedniego etapu,
bez ponownego wykonania w tym przeglądzie.

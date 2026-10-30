# Etap 3B — izolowane testy integracyjne GitHub Actions

2026-10-30. Gałąź `chore/slm-v1-integration-ci-stage3b`, utworzona z dokładnego
`45d9a4dfba838ebf9ed70f73a1b2044352df8ecd`; początkowy stan czysty.
Cel Draft PR: main. Bez merge/deployu/Cloud/konfiguracji telefonu.

**Przygotowanie PASS; pełne uruchomienie integracji na GitHub: NOT RUN.**
To konfiguracja do review i pierwszego kontrolowanego przebiegu, nie nowy dowód
zaliczenia SQL/RLS lub rzeczywistego backendu.

## Zakres i źródła

Zachowano całe `app/src`, `app/supabase` (w tym handler i41 migracji), grafiki,
natywny Android, zależności/lockfile, konfiguracje i dotychczasowe strażniki
Premium. Nie zmieniono Auth, finansów, UI, logiki składów, starego workflow
frontendowego ani CODEOWNERS. Nie przenoszono PR20–23/Auth18.

Zmieniono tylko sterowanie uruchomieniem dwóch istniejących runnerów:
`test-lineups-local.py`, `test-lineups-edge-local.py`. Ich oryginalne warunki
lokalnych gałęzi pozostają w osobnej gałęzi `else`. W trybie CI wykonanie wymaga
nowego rygorystycznego preflight. Scenariusze SQL/HTTP/UI i asercje nie zmieniły
się. W `test-lineups-ui-browser.mjs` zmieniono tylko katalog zrzutów w CI na
RUNNER_TEMP, poza śledzonymi obrazami; lokalny katalog pozostaje dotychczasowy.
`test-lineups-ui-local.py` jest niezmieniony.

Nowe pliki: `.github/workflows/lineup-integration.yml`, `app/scripts/lineups_ci.py`,
`test_lineups_ci_context.py`, `lineups-ci-approval.json` i ten raport.
STATUS i dziennik dopisano bez usuwania historii.

## Zabezpieczenie przed utworzeniem bazy

`lineups_ci.context()` jest wykonywane przed każdym startem fixture i przed
pobieraniem obrazów. Nie podmienia nazwy gałęzi, GITHUB_REF ani GITHUB_SHA.

1. GitHub Actions, `github-hosted`, Linux/X64, właściwe repo, poprawne run_id
   i run_attempt oraz dwa opt-in. Odrzucane są m.in. self-hosted, fork,
   `pull_request_target`, obce repo i konfiguracja zewnętrznej bazy/sekretów.
2. HEAD checkoutu musi być pełnym GITHUB_SHA. Dla PR: ref `refs/pull/N/merge`,
   baza main, zgodne repo/ref head, dokładna para rodziców commita zgodna z SHA
   base/head zdarzenia. Head PR musi zawierać zatwierdzoną bazę3A.
3. Manual dispatch: tylko main lub gałąź3B, zgodne ref w zdarzeniu, obydwa jawne
   potwierdzenia. Workspace musi odpowiadać checkoutowi, a RUNNER_TEMP leżeć poza
   źródłami aplikacji. Optymalizacja wyłączająca asercje jest niedozwolona.
4. Bazowy commit jest stałą45d9a4d. Porównywane są wszystkie zatwierdzone pliki
   `app/` z niezmiennymi obiektami Git, dokładny zestaw plików, cała zawartość41
   migracji i handlera, UI/Auth/finanse oraz istniejące guardy. Nie wystarcza sama
   liczba migracji lub edytowalny hash. Symlinki, dodatkowe źródła (także ukryte
   przez .gitignore), nieśledzone wejścia i drift workflow są odrzucane.
5. Tylko trzy wymienione runnery oraz dwa nowe pliki Python mogą różnić się od
   bazy3A; ich całe źródła oraz nowy workflow są porównywane z commitem implementacji
   **`8646868d2b7d7cfa10f4003f8bd79372d60ea933`**. Wskazówka approval JSON została
   dodana osobno, nie oblicza wzorca z aktualnego HEAD. Ten commit musi być
   przodkiem testowanego checkoutu. Poprzednie workflow/AGENTS/CODEOWNERS/Vercel
   pozostają zgodne z bazą.
6. Docker wyłącznie lokalny unix socket i default context. Przed fixture daemon
   musi nie zawierać **żadnego** kontenera, także zatrzymanego. Nie próbujemy
   czyścić zastanego Dockera, aby spełnić warunek.
7. Minimum2CPU,6GiB RAM i8GiB wolnego dysku, sprawdzane ponownie po pobraniu
   obrazów. Brak zasobów kończy próbę; bez zmiany na płatny/większy runner.

Wskaźnik approval i kod samego CI nadal wymagają review właściciela. Mechanizm
jest ochroną przed pomyłką i driftem; nie jest kryptograficznym poświadczeniem
tożsamości hosta ani zabezpieczeniem produkcyjnym przed osobą mogącą zmienić cały
workflow/helper. Testy jednostkowe przekazują przykładowe metadane do czystych
walidatorów, nie ustawiają zmiennych GitHub do uruchomienia bazy.

## Kontenery, dane i zakończenie

- Nowe unikalne nazwy fixture i sieć `none`; sidecary współdzielą wyłącznie jej
  namespace. Nie ma opublikowanych portów, podłączenia istniejących wolumenów
  ani używanej bazy. Jedyny bind w Edge to nowy katalog sprawdzonych źródeł,
  zamontowany read-only. Most browsera działa wyłącznie na loopback runnera.
- Cztery obrazy są przypięte digestami z istniejącego runnera Edge; SQL w CI
  również używa przypiętego PostgreSQL. Lokalne ustawienia obrazu SQL pozostają
  zachowane. Pobranie następuje dopiero po preflight; tworzenie ma `--pull=never`.
- Limity CI:2CPU/kontener, PID512; PostgreSQL1GiB, Edge1536MiB, GoTrue512MiB,
  PostgREST256MiB. Nie są to nowe ustawienia produkcyjnego backendu.
- Dane/konta/hasła/JWT wyłącznie syntetyczne i generowane na próbę. Brak
  produkcyjnych sekretów lub zdalnego Supabase. Nie publikujemy surowych logów,
  Docker inspect/env, tokenów, danych fixture ani zrzutów jako artefaktów CI.
- Każdy kontener dostaje etykietę właściciela run_id/attempt/suite. Dotychczasowe
  finally zatrzymuje fixture; osobny krok `always` po udanym preflight sprawdza
  komplet etykiet i zatrzymuje tylko własne ID. Nie wykonuje prune/rm/reset/drop.
  Zatrzymane kontenery i ich dane znikają przy utylizacji efemerycznego runnera.
  Cleanup po twardym przerwaniu jest best-effort; nie korzystamy z self-hosted.

## Trzy niezależne wyniki

1. Istniejący **SLM frontend checks (no database)**: bez zmian, TypeScript/lint/
   Vitest/buildy/Premium. Nie dowodzi integracji SQL lub Edge.
2. Nowy **SLM isolated SQL-RLS**: dotychczasowy runner50 kontroli SQL/RLS,
   konkurencji, PostgREST i restartu. Auth schema i podpisane tokeny są fixture,
   nie rzeczywisty GoTrue. Liczba50 to zakres historyczny, nie wynik tej sesji.
3. Nowy **SLM isolated GoTrue-Edge-UI**: istniejący runner browsera z faktycznym
   GoTrue/Edge/PostgREST/PostgreSQL. Historyczny zakres14UI i14 kontroli backendu;
   nie oznaczamy ich tu jako wykonanych. Kong jest zastąpiony lokalnym routingiem,
   Storage tylko minimalnym schematem; fizyczny Android nie jest testowany.

Matrix ma dwa osobne efemeryczne Ubuntu, fail-fast=false, timeout20min/job,
concurrency usuwa stare przebiegi tego samego PR. Node24, pełna historia Git,
actions przypięte SHA, contents:read, checkout bez credentials. Python3 i Chrome
muszą istnieć na runnerze; Chrome jest wyszukiwany, brak binarki kończy próbę.
Npm ci tylko w wariancie UI, z niezmienionym lockfile i bez lifecycle scripts.
Nie ma `continue-on-error`, wdrożeń, `pull_request_target` ani produkcyjnych
sekretów. Podsumowanie rozdziela success/failure/skipped obu ścieżek.

## Opt-in, koszty i uruchomienie po review

Workflow PR→main uruchomi się dopiero po świadomym ustawieniu obu niesekretnych
zmiennych repo na `true`: **SLM_FREE_CI_ENABLED** i **SLM_INTEGRATION_CI_ENABLED**.
Druga oznacza zgodę na odtworzenie migracji wyłącznie w nowych efemerycznych
fixture. Manual wymaga dodatkowo obu checkboxów: confirm_free_allowance oraz
confirm_fixture_migrations. Brak opt-in daje SKIPPED/NOT RUN, nigdy dowód PASS.

Nie zmieniono tych zmiennych ani ochrony repo. Właściciel musi potwierdzić
bezpłatny limit i blokadę płatnych nadwyżek. Używany jest standardowy ubuntu-latest,
nie większy płatny runner. Czas/dysk/obrazy/limity na rzeczywistym Actions nadal
wymagają pomiaru; nie obiecujemy, że20min wystarczy. Brak zasobów oznacza STOP,
nie automatyczne finansowanie. Manual dispatch zwykle wymaga obecności workflow
na domyślnej gałęzi; nie scalać kodu wyłącznie po to, by obejść brak przycisku.

## Faktycznie wykonano w Cloud

| Kontrola | Wynik i granica |
|---|---|
| Python unittest kontraktu startu | **22 PASS**, wiele negatywnych subprzypadków; metadane i tymczasowe repo Git, bez SQL |
| Trzy rzeczywiste lokalne starty runnerów na gałęzi3B | **Oczekiwana odmowa PASS**; stare branch guardy zablokowały start, lista kontenerów niezmieniona |
| Porównanie rzeczywistego checkoutu do bazy i zatwierdzonej implementacji | PASS, bez Docker start i bez fałszowania metadanych CI |
| TypeScript aplikacji i strict Edge / ESLint | PASS |
| Pełny Vitest | **335 PASS /53 pliki**, kontrolowane transporty nie są backendowym E2E |
| Konsolidacja/Premium/polityka | PASS:41 migracji/55 plików UI/10 granic importów; **37 policy PASS**, bez skipów |
| LIVE / Premium-finance-local / Android Stage3 web / demo | Wszystkie4 PASS; izolacja demo16 plików PASS |
| YAML, Bash, Python AST, JS syntax | PASS; statyczna walidacja, nie uruchomienie na GitHub |
| actionlint | NOT RUN: brak narzędzia; próba `go install` zwróciła `Go: Unknown option: install` |
| SQL/RLS, realne GoTrue/Edge/UI i hosted Actions | **NOT RUN w3B**; nie podstawiano środowiska GitHub do lokalnego uruchomienia |
| Kong/Storage/full CLI, Cypress i fizyczny Android/POCO | NOT RUN |

Pierwsza wersja nowego testu Python zawierała NameError po dodaniu przypadku
workflow; poprawiono wyłącznie umiejscowienie testu i ponowiono cały kontrakt
(22PASS). Statyczny skan YAML początkowo potraktował słowo „secrets.” w opisie
jako odwołanie do sekretu; poprawiono skan do rzeczywistej składni wyrażenia.
Nie zmieniano ani nie wyłączano asercji backendu/Premium. Istniejące ostrzeżenia
dużych chunków pozostały. Nie deklarujemy pełnej regresji natywnego Androida.

Następny bezpieczny krok: review helpera/workflow/wskaźnika, potwierdzenie
bezpłatnego limitu, utworzenie PR do main i jeden rzeczywisty przebieg obu suite.
Uzyskać osobno wyniki SQL-RLS i GoTrue-Edge-UI. Dopiero potem rozpatrywać wymagane
checki i odbiór POCO na osobno uzgodnionym backendzie. Brak merge lub zgody Cloud.
Wynik publikacji i prób API zapisano w `docs/ODPOWIEDZI_CODEX.txt`.

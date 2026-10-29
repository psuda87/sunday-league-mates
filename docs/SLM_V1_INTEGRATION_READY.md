# Etap 3A — przygotowanie integracji i GitHub CI

2026-10-29. Gałąź: `chore/slm-v1-integration-ready`, utworzona dokładnie z
`58a9babf257876e47cf6db269a0bf05d2e1db1f4` (`feat/premium-lineups-stage2b`).
Stan początkowy czysty. Cel PR: **main**, bez merge i bez wdrożenia.

## Zakres i zachowane źródła

Dodano tylko `.github/workflows/main-pr-checks.yml` oraz dokumentację.
Całe `app/`, w tym wszystkie źródła, testy, istniejące strażniki, manifest 55
plików Premium, zależności, konfiguracje, backend składów i **41 migracji**,
pozostaje identyczne z bazowym `58a9bab`. Nie przenoszono ponownie PR20–23,
eksperymentalnego Auth18, narzędzi Android Studio ani lokalnych fixture.

Kandydat zawiera już ciąg: main134c52b → konsolidacja39ef2e3 → Stage1b30908e
→ poprawka kontraktu7ad5c75 → Stage2A3b00ec2 → Stage2B58a9bab.
Nie należy scalać tego samego zakresu drugi raz. Stare PR i gałęzie pozostają
nietknięte; nie zmieniono bazy ani statusu PR27.

## Minimalny workflow

Przejrzano PR26 (`chore/android-main-acceptance`, `0bf8d8c`). Wykorzystano
wyłącznie konstrukcję frontendowego CI. Nie kopiowano skryptów przygotowania
starszego backendu40, jego instrukcji migracyjnych ani zmiany branch guardów.
Istniejący ręczny `stabilization-review.yml` pozostaje bez zmian.

Nowy workflow:

- `pull_request` do `main` (opened/synchronize/reopened/ready_for_review), również
  dla Draft PR, jeśli właściciel świadomie włączy opt-in; dodatkowo manual dispatch.
- Job tylko dla `psuda87/sunday-league-mates`, gdy niesekretna zmienna repo
  `SLM_FREE_CI_ENABLED` ma dokładnie wartość `true`. Manual dispatch wymaga także
  zaznaczenia `confirm_free_allowance`. Brak opt-in oznacza **SKIPPED / NOT RUN**,
  nie PASS. GitHub może traktować pominięty job jako sukces administracyjny:
  **nie jest to dowód zaliczenia kontroli ani gotowości do merge**.
- Przed opt-in właściciel potwierdza bezpłatny przydział i blokadę płatnych
  nadwyżek. W tej sesji nie zmieniono zmiennych, limitów, reguł ochrony ani planu.
- Ubuntu, Node24, limit20min, concurrency anuluje przestarzały przebieg tego
  samego PR. `contents:read`, oficjalne actions z pełnymi SHA, pełna historia Git
  do istniejących porównań historycznych, checkout bez zachowania credentials.
- `npm ci --ignore-scripts --no-audit --no-fund`, bez zmiany lockfile,
  bez lifecycle scripts, Cypress download, sekretów produkcyjnych, cache/uploadu
  artefaktów, `pull_request_target`, deployu lub operacji bazodanowych.
- TypeScript aplikacji i strict Edge; pełny ESLint; cały Vitest z maksymalnie
  dwoma workerami (bez filtrowania testów); dotychczasowe verify:consolidation
  i test:premium-policy bez nowych wyjątków.
- Pięć buildów: LIVE, Premium/B1, Premium finance local, Android Stage3 web,
  izolowane demo. Build Android web nie oznacza Gradle/APK/instalacji telefonu.
- Log identyfikuje rzeczywiście testowany commit. Dla PR domyślny checkout
  Actions testuje syntetyczny merge z main, a nie tylko nazwę gałęzi.
- Końcowe podsumowanie, także po błędzie testów/builda, jawnie oznacza brak
  testów SQL/RLS, realnego Edge/browser i telefonu. Wynik nie maskuje błędów
  wcześniejszych kroków. Nie ma `continue-on-error`.

Manual dispatch wymaga workflow obecnego na domyślnej gałęzi. Przygotowanie
PR nie gwarantuje dostępności tego przycisku przed integracją. Przebieg PR może
natomiast użyć workflow z PR po spełnieniu opt-in i zgód wymaganych przez GitHub.
Nie należy scalać kodu tylko po to, aby uzyskać pozorny zielony status.

## SQL/RLS i rzeczywiste UI/Edge — osobny etap, NOT RUN

W zadaniu obowiązuje zakaz migracji. Nie uruchomiono Docker fixture, Supabase,
SQL/RLS, GoTrue/Edge ani rzeczywistego UI/Edge E2E. Vitest z kontrolowanym
transportem nie zastępuje tych dowodów. Historyczne wyniki Stage2A/2B nie są
bieżącym statusem GitHub CI.

Sprawdzono istniejące wymagania w kodzie:

| Runner | Warunek / blokada dla przyszłego CI |
|---|---|
| `test-lineups-local.py` | Wymaga lokalnej gałęzi `feat/premium-lineups-stage2a` jeszcze przed Dockerem; checkout PR do main jest niedozwolony. Tworzy nowy network-none PostgreSQL/PostgREST i odtwarza41 migracji; Auth/JWT fixture, nie realny GoTrue. |
| `test-lineups-edge-local.py` | Dopuszcza Stage2A albo callback UI na dokładnej nazwie Stage2B po porównaniu migracji i handlera z3b00ec2. Wymaga lokalnego socketu Docker i już pobranych czterech obrazów z przypiętymi digestami (`--pull=never`). |
| `test-lineups-ui-local.py` / `test-lineups-ui-browser.mjs` | Korzystają z powyższego guardowanego backendu, Node i istniejącego Chrome/Chromium. Linux domyślnie `/usr/bin/chromium`; na Actions trzeba sprawdzić faktyczną ścieżkę i ustawić `SLM_CHROME_PATH`. Most HTTP tylko loopback, prywatne tokeny wyłącznie fixture/RAM. |
| `prepare-stabilization-local.mjs` / `stabilization-local.mjs` | Stare ograniczenie do chore/main-stabilization; nie wolno uruchamiać tego na kandydacie przez udawanie innej nazwy gałęzi lub zmiennych GitHub. |

Ubuntu GitHub-hosted z Dockerem/Pythonem/Node/Chrome jest technicznie sensownym
celem tych izolowanych testów. **Nie zmierzono** jednak na nim czasu, RAM,
wolnego dysku, pobierania obrazów, zgodności runtime ani kosztu przebiegu.
Nie stwierdzamy, że zasobów brakuje lub że testy na pewno przejdą. Ograniczenie
Cloud z wcześniejszego pełnego Supabase/vfs nie dowodzi ograniczenia runnera
GitHub. Pełne Kong/Storage i fizyczny WebView pozostają odrębnymi granicami.

### Bezpieczna propozycja przyszłego dopuszczenia CI — niezaimplementowana

1. Osobno przejrzeć i zatwierdzić rozszerzenie kontekstu runnerów. Dotychczasowe
   lokalne branch guardy zachować. Nie usuwać assertów, nie zmieniać nazwy
   checkoutu dla obejścia blokady i nie fałszować `GITHUB_ACTIONS/GITHUB_REF`.
2. Dodatkowa ścieżka CI powinna wymagać właściwego repo, PR do main,
   oczekiwanego pełnego SHA z metadanych zdarzenia oraz równości HEAD checkoutu
   z tym SHA. Zweryfikować przodka58a9bab, a potem dokładny zestaw i treść
   wszystkich41 migracji, całego backendu, runnerów i źródeł UI używanych przez
   test, względem niezmiennych zatwierdzonych obiektów Git. Sama nazwa gałęzi,
   liczba migracji lub edytowalny plik hashy nie wystarcza.
3. Zachować kontrole lokalnego socketu, nowego unikalnego projektu, network-none,
   braku portów i Cloud/sekretów. Odmowa musi nastąpić **przed** utworzeniem DB
   lub wykonaniem SQL. Nie używać istniejącej bazy POCO ani `.cache` jako źródła.
4. Dodać negatywne testy kontekstu: obce repo/base, złe SHA, drift źródeł,
   brak/obca migracja, zmieniony handler, zdalny Docker, niezatwierdzona ścieżka.
   Kontrola kontekstu jest ochroną przed pomyłką, nie produkcyjną autoryzacją.
5. Po osobnej zgodzie na odtworzenie migracji w NOWEJ fixture uruchomić jeden
   pomiar na efemerycznym runnerze. Zapewnić obrazy po digestach, Chrome,
   timeout/cleanup wyłącznie własnych zasobów i logi bez tokenów. Oddzielić wynik
   SQL/RLS od realnego GoTrue/Edge/UI i od frontendowego checka.

Żadnego z tych rozszerzeń w3A nie wdrożono. Zmiany wymagają osobnego review;
istniejące runnery i chronione strażniki pozostają bajtowo niezmienione.

## Faktycznie wykonane kontrole w Cloud

Node24.19.0/npm11.9.0, zależności z niezmienionego lockfile przez npm ci
bez lifecycle scripts. Wszystkie ukończone poniżej komendy miały exit0.

| Kontrola | Wynik |
|---|---|
| TypeScript aplikacji i strict Edge | PASS |
| `npm run lint -- .` | PASS |
| `npm run test.unit -- --run --maxWorkers=2` | **335 PASS /53 pliki**; kontrolowane transporty nie są prawdziwym SQL/Edge E2E |
| `npm run verify:consolidation` | PASS:41 migracji,55 plików wizualnych,10 granic importów i stare przypięcia |
| `npm run test:premium-policy` | **37 PASS**, bez skipów |
| LIVE / Premium-local / Premium-finance-local / Android Stage3 web / demo | Wszystkie5 PASS; izolacja demo16 plików PASS |
| YAML workflow + `bash -n` | PASS: parser z odrzucaniem zduplikowanych kluczy; sprawdzone triggery, opt-in, permissions, komplet komend, brak sekretów/DB;8 bloków Bash. To nie walidacja przez GitHub/actionlint. |
| Diff całego `app/` względem58a9bab | Pusty; źródła i kontrakty zachowane |
| SQL/RLS / realne Edge/UI / Cypress / natywny Android / POCO | **NOT RUN w3A** |
| GitHub-hosted Actions | **NOT RUN / niepotwierdzone**; API odmawia dostępu |

Pozostały istniejące ostrzeżenia dużych chunków i ostrzeżenia deprecacji zależności
przy instalacji. Nie zmieniano wersji ani wykonywano npm audit fix. Nie testowano
bezpieczeństwa całej historii; przed commitem sprawdzono zakres i nowe pliki.

## GitHub, zależności i następny krok

Odczyt `actions/variables/SLM_FREE_CI_ENABLED` zwrócił **Forbidden**. Nie da się
potwierdzić opt-in, limitu, rulesets ani zielonego przebiegu. Nie ustawiono tej
zmiennej ani nie zlecono workflow_dispatch. Pominięty job nie spełnia odbioru.
Commit przygotowania workflow: `8387f89adcecc64b0b2a777bb2cf97d044c1fc29`, wypchnięty zwykłym pushem
na `origin/chore/slm-v1-integration-ready`. Próba POST Draft PR do main
zwróciła **Forbidden**; PR nie został utworzony. [Porównanie i ręczne utworzenie
Draft PR](https://github.com/psuda87/sunday-league-mates/compare/main...chore/slm-v1-integration-ready?expand=1).
Odczyt Actions runs także zwrócił **Forbidden**. Nie zlecono żadnego
workflow_dispatch; nowy workflow nie ma triggera push. Końcowe potwierdzenie
publikacji jest osobnym commitem dokumentacyjnym. Dziennik:
`docs/ODPOWIEDZI_CODEX.txt`.

Po review workflow i istniejących przypięć właściciel może potwierdzić limit,
włączyć opt-in i uzyskać realny frontendowy check dla PR do main. Dopiero po
zielonym przebiegu rozważać wymaganie jego faktycznej nazwy w branch protection,
z uwzględnieniem możliwości posiadanego planu. Nie zmieniono ochrony repo.

Następnie osobno zatwierdzić testy backendu/kontekst CI oraz zgodny lokalny
backend i odbiór POCO według audytu `audit/premium-lineups-stage2b/4443006`.
Instalacja APK opisana tam później nie oznacza odbioru funkcjonalnego. P3:
początkowy GET ukrytej zakładki; brak Realtime/globalna blokada pozostają
niezmienionymi ograniczeniami. Nie ma zgody na merge/deploy/Cloud ani Stage3B.

Etap3A kończy się przygotowaniem i publikacją gałęzi/DraftPR. Nie jest odbiorem
produkcyjnym całej aplikacji ani nowym backendowym PASS.

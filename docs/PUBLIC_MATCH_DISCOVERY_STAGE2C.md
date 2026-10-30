# Public Match Discovery — Etap 2C

30.10.2026, Europe/Warsaw. **PASS kontraktu i kontroli lokalnych, WARN pojedynczych granic; GitHub-hosted CI: NOT RUN.** Gałąź `chore/public-discovery-stage2c` od dokładnego `fd4fccdc1c22caa5f217625809689f336139a122`. PR28 pozostaje Draft, bez merge. Nie zmieniono żadnej funkcji aplikacji, wyglądu, backendu, Auth, finansów, składów, źródeł Android ani istniejących baz.

## Review rzeczywistych źródeł

Sprawdzono pełne pliki, nie tylko raport. Migracja42 i handler są zgodne z `24a59e104bfe80b4d2f41cbd0ad02b58fc546040`; wszystkie41 historycznych migracji niezmienione. `PremiumEvents.tsx`, `usePremiumEvents.ts`, `premiumContracts.ts` odpowiadają `ae2fd9550b3688f80bfc69d811eb2423743b8329`. Odtworzony Git diff ddd3a3e→fd4fccd tych trzech plików jest identyczny z zapisanym `public-discovery-stage2b-runtime.patch`. Manifest i55 plików wyglądu niezmienione. [Dowód z SHA256](review/stage2c-evidence.json).

Review kodu potwierdza: query tylko scope public; marker dokładnie1 dla nowych zakresów; debounce300ms; reset strony i generacje odpowiedzi; sprawdzenie tożsamości/sesji przed publikacją danych; reset przy logout/zmianie konta; DTO offset/limit100/has_more/next_offset; brak lokalnego filtrowania nowych stron. Istniejące mutacje/role nie zostały rozszerzone. Nie stwierdzono potrzeby poprawiania kodu aplikacji w ramach2C.

## Zmiany kontraktu CI

1. `lineups_ci.py` stosuje dokładny overlay18 plików z `43f69a62c85dd354695f6fcb4531c85fb03651cf` względem starego Stage3B/`6d96391298bbe18c582dc5c6ffda74c7045cfba3`. Bez wildcardów. Najpierw zachowuje walidację Stage3B względem bazy `45d9a4dfba838ebf9ed70f73a1b2044352df8ecd`, następnie ancestry obu przypiętych implementacji i dokładny zbiór/treść discovery.
2. Wyłącznie dwa istniejące runnery dostają dokładną transformację oczekiwania migracji na42 w CI. Lokalny model legacy41 zachowany. Test6 rzeczywistych wyrażeń AST potwierdza też, że CI42 nie odczytuje niezdefiniowanej lokalnej zmiennej branch.
3. Oddzielnie reviewowane pliki kontraktu `lineups_ci.py` i `test_lineups_ci_context.py` są porównywane bajtowo z przypiętym commitem implementacji. Ten wyjątek nie obejmuje Auth/finansów/składów/UI ani innych runnerów.
4. W pierwszym commicie zapisano implementację/testy **`d7b36eee379acf5036f8ea8aaeeea5f7791c8a04`**. Osobny commit **`cb63962e0ff4ccfbc4fb7157e4627beeee5ae8d5`** zmienia tylko pole implementation w `lineups-ci-approval.json` na d7b36ee. Pole base zachowane. Brak self-pin.
5. Syntetyczne SourceTests tworzą rzeczywiste repozytoria Git: baza41→Stage3B→kandydat42→implementacjaCI→osobne przypięcie. Pokrywają pełny pozytywny source gate, drift handlera/UI/testów/guardów/runnerów, migrację43, ignorowane wejścia, symlink, workflow, zły pointer i orphan commit o identycznym drzewie. Arbitralny repin runnera nie jest już akceptowany; nowy dopuszczalny repin dotyczy wyłącznie reviewowanej implementacji kontraktu.

Warunki `validate_event`, `validate_docker`, repo/main/event/SHA, ancestry, hosted Linux/X64, opt-in darmowego limitu i fixture, zasobów, ścieżek, label cleanup i pełnej zgodności workflow pozostały. Workflow, jego triggery, zmienne repo i sekrety nietknięte. Samo wykonanie `verify_sources()` jest kontrolą plików i Git, bez uruchamiania kontekstu CI, Dockera lub migracji.

Pierwotna propozycja `.patch` z fd4fccd miała uszkodzone puste linie kontekstu po checkout CRLF; odtworzono poprawne prefiksy unified diff z poprzedniego eeb6940 i sprawdzono aplikowanie. Po aktywacji jest to materiał historyczny, nie patch do ponownego stosowania. Standardowe puste linie kontekstu unified diff zawierają pojedynczą spację; nie należy usuwać jej jako „trailing whitespace”.

## Faktycznie wykonane kontrole

| Kontrola | Wynik w tej sesji |
|---|---|
| TypeScript aplikacji / strict Edge / ESLint | **PASS** |
| Vitest | **PASS361 /55 plików** |
| Istniejące Premium policy | **PASS45**, bez zmian testów lub pinów |
| Consolidation / visual / routing | **PASS42 /55 /10** |
| Mutacje rzeczywistych guardów w kopii tymczasowej | **PASS60**: każdy ze41 historycznych SQL, dodatkowy43, handler/discovery42, Auth gate/vault, finanse, składy, runtime i UI |
| Linux, pełny zestaw launch-contract/SourceTests | **PASS26**, w tym realny symlink i orphan ancestry |
| Linux, rzeczywisty checkout `verify_sources()` | **PASS**, dokładny checkout cb63962 i implementation d7b36ee |
| Linux, mutacje rzeczywistego source guard | **PASS10**: PR16/handler/Auth/finanse/składy/runtime/UI/CIgate/SourceTests/dodatkowy43 |
| Dwa wyrażenia liczby migracji, CI i oba tryby lokalne | **PASS6**, bez uruchamiania runnerów lub zmiany env |
| Windows, pełny zestaw26 kontraktu | **25 PASS /1 FAIL-ENV**, realny symlink WinError1314; żadnego skip lub złagodzenia asercji |
| GitHub-hosted Actions / rzeczywisty hosted preflight | **NOT RUN**; nie dispatchowano ani nie włączano Actions |
| SQL/GoTrue/Edge HTTP/replay42 w2C | **NOT RUN**; nie zmieniono SQL/handlera ani logiki testów DB, wyłącznie sprawdzoną liczbę migracji po source preflight. Wyników2B nie przedstawiamy jako ponowionych |
| Build/Chromium/Android/APK w2C | **NOT RUN**; brak zmian aplikacji i buildów, zakres wyłącznieCI/testy/docs |

### Rozstrzygnięcie trzech błędów Windows z2B

Dwa błędy pozytywnych SourceTests z CRLF usunięto przez `git -c core.autocrlf=false` **wyłącznie w repozytoriach tymczasowych fixture**. Nie normalizowano ani nie osłabiono bajtowych porównań source guard, nie zmieniano globalnego Git lub Windows. Trzeci przypadek nadal uczciwie FAIL-ENV na Windows bez uprawnienia symlink; dokładnie ta asercja wykonała się i przeszła na Linux. Nie zastąpiono jej mockiem ani skipem.

### Istotna granica pojedynczego strażnika — WARN

`premium-route-policy.mjs` uwzględnia nazwę `20261028204500_restore_pr16_match_name_projection.sql` w zbiorze migracji (linia44), ale jego pętla porównania treści historycznych plików (linia45) nie obejmuje tego pliku. Samodzielny runtime policy nie odrzuci zmiany jego treści. **Rzeczywisty `verify-consolidation.mjs` oraz pełny source guard CI ją odrzucają**, co sprawdzono osobnymi mutacjami. Pełny wymagany zestaw42/55/10 + source gate chroni wszystkie41 SQL; sam PASS policy45 nie zastępuje konsolidacji. Nie zmieniano tego strażnika Premium poza dopuszczonym zakresem2C. Ewentualne ujednolicenie jego samodzielnej ochrony wymaga oddzielnego review.

## Linux: izolacja i odtworzenie

Nowy kontener narzędziowy; **nie** Supabase, GoTrue ani istniejąca baza. Python3.12.16 / Git2.47.3. Obraz Python przypięty digestem w [Dockerfile](review/stage2c-linux.Dockerfile), wynikowy obraz `sha256:522be6ca97cc065e5448f5890da98a9f2f102fe28b17ec7d2acbbe9ed17d8aea`. Jednorazowy build obrazu pobrał darmowe pakiety Git. Właściwy test: network-none, rootfs read-only, cap-drop ALL, no-new-privileges,2CPU/768MB, tmpfs, brak socketu Dockera/portów/sekretów. Tylko ignorowany Git bundle zamontowany readonly, zwykły klon w /tmp. Żadne GITHUB_* nie były ustawiane. Testy event validatora używają zwykłych danych wejściowych funkcji, nie udawanego środowiska do uruchamiania integracji.

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\public-discovery-stage2c'
git bundle create .cache/stage2c.bundle --all
docker build -t slm-stage2c-contract-tests:local -f docs/review/stage2c-linux.Dockerfile docs/review
$bundle = (Resolve-Path .cache/stage2c.bundle).Path
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges `
  --cpus 2 --memory 768m --pids-limit 128 --tmpfs /tmp:rw,exec,size=512m `
  --mount "type=bind,src=$bundle,dst=/input/repo.bundle,readonly" `
  slm-stage2c-contract-tests:local sh -c 'git clone --quiet --branch chore/public-discovery-stage2c /input/repo.bundle /tmp/slm-checkout && cd /tmp/slm-checkout && python -B docs/review/stage2c-linux-check.py'
```

Pozostałe powtarzalne dowody: [60 mutacji guardów](review/test_stage2c_guards.mjs), [Linux checker](review/stage2c-linux-check.py), [JSON pinów/ancestry/wyników](review/stage2c-evidence.json). Nie publikować samego bundle; zawiera pełną historię lokalnych gałęzi i jest ignorowany. Kontenery narzędziowe zostały usunięte po testach, bez wolumenów lub baz. Sześć zastanych usług SLM pozostaje uruchomionych.

## Integracja / status

[Pełna mapa zależności i konsekwencje squash/rebase](PUBLIC_MATCH_DISCOVERY_INTEGRATION_MAP.md). Aktualizowany kontrakt CI jest lokalnie zweryfikowany, a jego nowe przypięcie jest zapisane; **nie oznacza to GitHub-hosted PASS ani zatwierdzenia właściciela**. Potrzebny review d7b36ee/cb63962, wybór integracji zachowującej ancestry i ewentualny osobno autoryzowany hosted run po potwierdzeniu darmowego limitu.

Do review zmieniono tylko: `app/scripts/lineups_ci.py`, `lineups-ci-approval.json`, `test_lineups_ci_context.py`, po jednej oczekiwanej liczbie w `test-lineups-local.py` i `test-lineups-edge-local.py`; dokumentację, historyczny patch i narzędzia testowe w docs/review. Nie aktualizowano manifestu55, runtime/backend pinów Premium, workflow, Auth lub innych źródeł aplikacji. Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

## Publikacja

Zwykły push `chore/public-discovery-stage2c` potwierdzony. KodCI/testy d7b36ee, osobny pointer cb63962, raport/dowody `3041da0fc5bb5bbb40a6fda531367b366ebaa0cd`. Utworzono [Draft PR #29](https://github.com/psuda87/sunday-league-mates/pull/29) do `feat/public-match-discovery-stage2b`/fd4fccd. Odczyt API: open/draft, merged=false, mergeable=true/clean. PR28 także open/draft, niezmieniony HEADfd4fccd i baza audytu. Dla3041da0 GitHub Actions API zwróciło **0 workflow runs**; nie jest to hosted PASS. Końcowy commit dokumentacyjny jedynie zapisuje potwierdzenie publikacji.

[Porównanie do Stage2B](https://github.com/psuda87/sunday-league-mates/compare/feat/public-match-discovery-stage2b...chore/public-discovery-stage2c). Następny krok: review kontraktu/pointera, wybór zachowującej ancestry integracji według mapy oraz osobno autoryzowany hosted run we właściwym kontekście. Zatrzymano po etapie, bez merge/deploy/Cloud/APK.

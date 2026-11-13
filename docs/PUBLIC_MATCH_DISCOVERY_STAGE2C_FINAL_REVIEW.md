# Stage2C — końcowy przegląd istniejącej implementacji

2026-11-02, Europe/Warsaw. **PASS źródeł, zakresu i rzeczywistego source gate; WARN kompletności bieżącego uruchomienia testów.** Brak znalezionego błędu aplikacji lub merytorycznej blokady kontraktu2C. Nie jest to PASS odbioru backendu42 ani zgoda na merge/deploy.

## Punkt odniesienia i niezależna kontrola

Lokalny i aktualny zdalny HEAD `chore/public-discovery-stage2c` to **e246c514af0fbca79dee892d9aa0e31b937a83c3**, checkout przed przeglądem czysty. Przeczytano aktualne AGENTS, raport Stage2C, mapę integracji oraz integration review z gałęzi `review/public-match-discovery-integration`/324fbdf. Porównano rzeczywiste obiekty Git i aktywne funkcje guardów, nie tylko raporty.

Potwierdzono każdą kolejną krawędź ancestry:

`main134c52b → stabilizacja39ef2e3 → b30908e → 7ad5c75 → składy3b00ec2 → 58a9bab → CI3A45d9a4d → CI3Be04d9a4 → backend24a59e1 → audytddd3a3e → Stage2Bfd4fccd → implementacjaCId7b36ee → wskaźnikcb63962 → HEAD e246c51`.

Względem Stage2B zmienia się dokładnie **pięć plików app**, wszystkie dotyczą CI/testów/pointera. `app/src`, `app/supabase`, Android, workflowy, AGENTS i manifest55 są identyczne z2B. Żadnej nowej migracji, uprawnień, RLS/grantów, ścieżki API lub zmiany UI. Usunięte wcześniej nazwy dwóch gałęzi Stage1 nie wymagają odtworzenia: ich commity nadal są przodkami2C.

## Dokładne przypięcia i zakres

| Element | Weryfikacja |
|---|---|
| Backend | handler i migracja42 identyczne z24a59e104bfe80b4d2f41cbd0ad02b58fc546040 |
| Discovery UI | dokładnie PremiumEvents.tsx/usePremiumEvents.ts/premiumContracts.ts z ae2fd9550b3688f80bfc69d811eb2423743b8329 |
| Historia SQL/Premium | dokładnie41 poprzednich SQL +42; niezmienione55 plików/manifest, pozostałe piny bez rozszerzenia |
| CI base |45d9a4dfba838ebf9ed70f73a1b2044352df8ecd |
| Stage3B/source |6d96391298bbe18c582dc5c6ffda74c7045cfba3 oraz dokładny overlay18 z43f69a62c85dd354695f6fcb4531c85fb03651cf |
| Implementacja CI |d7b36eee379acf5036f8ea8aaeeea5f7791c8a04; helper i SourceTests odpowiadają temu commitowi |
| Osobny pointer |cb63962e0ff4ccfbc4fb7157e4627beeee5ae8d5 zmienia wyłącznie implementation na d7b36ee; base pozostaje |

Prześledzono `verify_sources` i `verify_discovery_overlay`: najpierw zachowana baza historyczna Stage3B, potem dokładny zbiór/treść18 źródeł discovery. Tylko dwa istniejące runnery dostają zdefiniowaną transformację oczekiwania41→42. Zmienione/nieoczekiwane pliki, migracja43, dodatkowe ignorowane wejścia, symlinki i błędna historia pozostają odrzucane. Brak wildcardów i globalnego wyjątku dla Auth, finansów, składów lub UI.

Helper CI i jego syntetyczne SourceTests mogą być aktualizowane przez nową **osobno reviewowaną implementację**, jak przewiduje dotychczasowy protokół. Nie upoważnia to nowego pointera do zatwierdzenia dowolnych zmian runnerów/runtime/backendu. Guard pozostaje kontrolą pomyłek, nie kryptograficzną zgodą właściciela; zmiana helpera/approval/workflow zawsze wymaga review.

Porównanie AST potwierdziło brak zmian pozostałych istniejących funkcji CI. W `context` zmieniono tylko informacyjny tekst41→42. Repo/event/SHA/parents, ancestry, hosted Linux/X64, opt-in bezpłatnego limitu, local/empty Docker, zasoby, ścieżki, etykiety i cleanup zachowane. Workflowy, ustawienia Actions i repo variables nietknięte. Nie symulowano kontekstu GitHub do uruchamiania runnerów.

## Faktycznie wykonane kontrole tej sesji

Rzeczywiste narzędzia: **lokalny Windows**, nie Cloud/hosted Linux. Docker niedostępny; nie uruchamiano go ani żadnej usługi backendu.

| Kontrola | Wynik |
|---|---|
| HEAD/ancestry i dokładna zawartość pinów | **PASS** |
| Premium policy | **PASS45/45**, wszystkie aktualne przypadki |
| verify:consolidation | **PASS42 migracje /55 frozen /10 import boundaries** |
| Negatywne Premium/consolidation w prywatnej kopii | **PASS60**, w tym każda historyczna41,42/handler,extra43,Auth/vault,finance,lineups,UI |
| Rzeczywisty source gate | **PASS** w nowym kanonicznym klonie e246c51 z lokalnym core.autocrlf=false |
| Mutacje rzeczywistego source gate | **PASS10 odmów**: restorePR16,handler,Auth,finance,lineup,runtime,UI,helper,testyCI,extra43; końcowy baselinePASS i klon czysty |
| Syntetyczne launch-contract/SourceTests | **25 PASS /1 ERROR-ENV z26**: test symlink/workflow zatrzymał się przy tworzeniu symlinka zWinError1314; żadnego skip/zmiany asercji |
| Dwa rzeczywiste wyrażenia liczby migracji | **PASS6** wariantów: CI42 bez zmiennej branch, lokalnydiscovery42 i legacy41 |
| Pełny bieżący Linux26/symlink | **NOT RUN**; wcześniejszy PASS26 z raportu30.10 jest wynikiem historycznym, nie powtórzonym |
| Build/lint/TS/Vitest/Chromium/Android ponownie | **NOT RUN**, brak zmiany aplikacji/konfiguracji; odpowiednie361/45/6buildów wykonano w poprzednim review2B i nie zaliczano ponownie |
| SQL/RLS/real GoTrue/Edge/HTTP/backend42 | **NOT RUN**, brak zmiany SQL i brak nowej fixture |
| GitHub-hosted/Actions/Cloud/migracje/deploy | **NOT RUN**, brak aktywacji lub operacji |

Znana granica warstw: sam runtime policy nie porównuje treści migracji restorePR16 z20261028204500. Rzeczywisty consolidation oraz source gate odrzucają jej zmianę, co ponownie potwierdzono. Nie przedstawiamy pojedynczego policy jako pełnej ochrony wszystkich41. Source gate poprawnie odrzucił też lokalny ignorowany artefakt bytecode; po usunięciu wyłącznie własnego artefaktu testowego i uruchomieniu z `python -B` baseline przeszedł. Guardów nie normalizowano ani nie osłabiano pod Windows.

## Jednoznaczna rekomendacja integracji

**Wybrać istniejący Etap2C jako docelowy kontrakt CI discovery. Nie implementować go ponownie i nie nakładać równoległego, nieaktywnego patcha2B z integration review.** BLOCK starego source gate opisany w review2B nie jest blokadą tej gałęzi: istniejący pointer2C do d7b36ee przechodzi rzeczywistą kontrolę źródeł.

Po decyzji właściciela integrować **oryginalną historię** zwykłym merge zachowującym commity. Dla stosu zależnych PR zachować obecne bazy PR29→Stage2B i PR28→audyt; techniczne składanie dzieci do rodziców dopiero po zatwierdzeniu. Można też wybrać przegląd całego istniejącego stosu do main. Nie wykonywać obu alternatyw automatycznie. Po zmianie bazy ponownie sprawdzić ancestry i source gate.

**Nie squashować/rebase’ować d7b36ee/cb63962 ani źródłowych commitów required ancestry.** Identyczne pliki po przepisaniu historii nie zastępują `merge-base --is-ancestor`. Zachować także dostępność źródeł używanych przez `git show`, zwłaszcza a82397b z istniejącej fix/premium-real-ui-regression, która nie jest przodkiem RC. Nie usuwać ostatniej referencji tego obiektu ani nie scalać eksperymentalnego Auth18 w celu sztucznego zapewnienia jego ancestry.

Nie znaleziono powodu do poprawiania aplikacji, pinów lub kontraktów. **WARN pozostaje do pełnego bieżącego testu Linux symlink i odbioru rzeczywistego backendu42.** Historyczny Linux26PASS przy identycznej implementacji jest dowodem wcześniejszym, nie bieżącym zielonym uruchomieniem. Przed końcowym merge właściciel powinien zaakceptować tę granicę lub zlecić ponowienie na istniejącym bezpiecznym Linux; nie wymaga to aktywacji GitHub Actions. Zgoda na integrację nie jest zgodą na deploy lub Cloud.

## Krótka checklista odbioru backendu42 — do wykonania osobno

- [ ] Nowa, jednoznacznie odizolowana fixture z kanonicznych42 migracji i przypiętego Edge; osobne porty/dane, lokalne endpointy. Bez migracji/resetu istniejącej bazy lub Cloud. Potwierdzić komplet/treść42, prywatne ACL/RLS i marker `public_discovery_version===1` w autoryzowanym matches_list.
- [ ] Członek grupyA, osoba z obcej grupyB i osoba bez grup: scopes all/groups/public/mine/group. Obce prywatne UUID/nazwy nie mogą pojawić się w listowaniu/wyszukiwaniu; publiczny wynik ani zapis nie daje członkostwa, katalogu grupy lub cudzych finansów/składów.
- [ ] Unicode/polskie znaki, dosłowne `%`/`_`/nawiasy, pusty query,100/101 znaków, błędne scope/query/offset. Ponad100 publicznych wyników i prywatne rekordy przed nimi: poprawne100+5,has_more,next_offset oraz prywatność przed paginacją.
- [ ] Rzeczywisty GoTrue→Edge→PostgreSQL: logout/zmiana konta, leave/revoke podczas ważnego tokena, powrót z tła, opóźnione odpowiedzi i zmiana scope/query. Odpowiedzi starej generacji nie przywracają danych; nieobsługiwany marker nie daje fałszywego sukcesu.
- [ ] Regresja istniejących uprawnień: zapisy/goście/rezerwa, prywatność kontaktów, aktualny admin finansów, składy/CAS/stary roster/idempotencja. Bez rozszerzania RLS lub grantów w celu uzyskania PASS.
- [ ] Zapisać osobno PASS/FAIL/NOT RUN, logi bez sekretów i granice: offset nie jest snapshotem; globalny advisory lock i koszt literalnego skanowania nie mają nowego testu obciążenia. Dopiero potem decyzja właściciela o integracji.

W tym zadaniu niczego z checklisty nie wykonywano. Nie zmieniono kodu aplikacji, guardów, historii Git ani istniejących danych. Raport i chronologię zapisano lokalnie w istniejącym worktree2C, bez nowej gałęzi, commita lub push. `docs/ODPOWIEDZI_CODEX.txt` zawiera końcowy zapis zadania.

# Stage 2A — trwały backend składów

2026-10-29, Europe/Warsaw. Gałąź `feat/premium-lineups-stage2a` od dokładnego `7ad5c75414cf669d4471f3122e93073dab9aa8d7`. Przed pracą lokalny/zdalny HEAD bazy był zgodny i worktree czysty. Backend implementacji zapisany w **`b46b7b91796b96acfc809799e09a5a6898b99342`**; końcowy commit zawiera także addytywną ochronę źródeł i dokumentację. Baza zależnego Draft PR: `fix/premium-lineup-stage1-contract`.

**Stage 2A ukończony w zakresie kodu i opisanych testów. Stage 2B nie rozpoczęty.** Edytor, wygląd i stale wyłączony przycisk „Zapisz” są niezmienione. Nie przenoszono Auth18 i nie dotykano Supabase Cloud ani istniejących baz.

## Ponowna weryfikacja i domknięcie — 2026-10-29, Europe/Warsaw

Kontynuowano istniejące `origin/feat/premium-lineups-stage2a` / `c1cb2fd0f7686cd6a7217c763ac88bbc176d8c9f`, po fetch i potwierdzeniu bazy `7ad5c75414cf669d4471f3122e93073dab9aa8d7`. Nie implementowano ponownie backendu. Bieżąca sesja ma rzeczywisty dostęp do Windows i lokalnego Dockera; poniższe wyniki **nie pochodzą z osobnego środowiska Cloud Codex**. Utworzono osobny worktree `.worktrees/premium-lineups-stage2a`; niezapisane zmiany `feat/ui-beta` pozostawiono nietknięte.

Nowy commit testów **`338db5af9ad06f12ba26e6f5df6e455aa12c2930`** dodaje wyłącznie `app/scripts/test-lineups-edge-local.py`. Istniejące migracje, handler, Auth, finanse, UI i strażniki są bajtowo niezmienione względem poprzedniego Stage 2A. Domknięto wcześniejszy brak GoTrue → Edge HTTP; historyczne wpisy NOT TESTED poniżej opisują poprzednią sesję.

| Faktycznie wykonane teraz na Windows | Wynik |
|---|---|
| Istniejący runner SQL/RLS/PostgREST, replay 41 migracji, wyścigi, prywatność, no-op, roster, regresje, restart PostgreSQL | **50 PASS**, exit 0 |
| Nowy runner z rzeczywistym GoTrue i accounts w Supabase Edge Runtime | **13 PASS**, exit 0 |
| Vitest, w tym 23 jednostkowe Edge | **320 PASS / 52 pliki** |
| TypeScript aplikacji / strict Edge / ESLint | PASS |
| Konsolidacja, zamrożone UI, granice runtime, negatywne testy polityki | **41 migracji / 55 plików / 8 granic / 29 prób — PASS** |
| Build LIVE / Premium lokalny / demo i izolacja demo | PASS, izolacja **16 plików**; istniejące ostrzeżenia rozmiaru chunków |
| Cypress, istniejące `cypress/e2e`, Chrome headless | **13 PASS / 5 plików**, API kontrolowane przez intercepty |

Nowy test uruchamia cztery NOWE kontenery: PostgreSQL 17, GoTrue 2.197.0, PostgREST 12.2.12 i Edge Runtime 1.77.4, wszystkie z przypiętych digestów. PostgreSQL ma `--network none`; pozostałe współdzielą jego odizolowaną przestrzeń sieciową. Brak publikowanych portów i dostępu do Cloud/istniejących baz. GoTrue sam tworzy rzeczywisty schemat Auth; na nim odtwarzane są wszystkie 41 kanoniczne migracje. Nie używa się testowych tabel Auth ani ręcznie podpisanych tokenów użytkowników. Syntetyczne klucze anon/service służą wyłącznie tej fixture; cztery access tokeny użytkowników wydaje GoTrue przez rzeczywiste logowanie accounts. Runner dodatkowo wymaga w tokenie roli `authenticated`.

Sprawdzono zapis członka i odczyt drugiego klienta, trzech gości bez kont, no-op autora/czasu/wersji, retry, prywatnego outsidera, fałszowanie autora, równoległy zapis z jednym HTTP 409, stary roster, obcy wpis, bezpośredni REST/RPC oraz odebranie dostępu po wyjściu z grupy i logout. Po restarcie całego stosu ten sam token GoTrue odczytuje identyczny snapshot, bez ponownego logowania. Kontenery pomocnicze zatrzymywane są przed restartem bazy i ponownie dołączają do jej nowej przestrzeni sieciowej. HTTP routing harness zastępuje lokalnie Kong; **Kong i Storage nie zostały tym testem zweryfikowane**. Storage ma tylko minimalny schemat wymagany przez historyczne migracje, a endpointy Storage nie są wywoływane.

Końcowe udane fixtures: `slm-lineups-stage2a-53bd33b37e1e` (+ `-rest`) oraz `slm-lineups-edge-54d5c6c50f4c` (+ `-auth`, `-rest`, `-edge`). Po zakończeniu niezależnie potwierdzono ich zatrzymanie, brak portów i izolację sieci. Wcześniejsze nieudane próby nowego runnera również zatrzymano i zachowano; dotyczyły transportu nc, konfiguracji testowego GoTrue i ponownego dołączenia przestrzeni sieciowej przy restarcie. Nie wymagały poprawiania ani osłabiania backendu lub testów istniejących.

Cypress początkowo nie startował, ponieważ proces sesji dziedziczył `ELECTRON_RUN_AS_NODE=1`. Usunięto tę zmienną wyłącznie w procesie uruchamiającym test, bez zmiany konfiguracji Windows. Końcowy przebieg miał exit 0. Serwer Vite działał na `127.0.0.1:5197` z adresem API skierowanym na lokalny nieużywany port; intercepty obsłużyły żądania, bez kontaktu z Cloud. Serwer po testach zatrzymano. Test nie dowodzi podłączenia składów do UI; przycisk Zapisz pozostaje wyłączony.

### Powtórzenie na komputerze — PowerShell

Polecenia zostały już wykonane w tej sesji. Nie trzeba ponawiać ich do zamknięcia Stage 2A; każdy runner tworzy nowe, zatrzymywane i zachowywane kontenery. Wymagają istniejącego Pythona i działającego lokalnego Dockera z obrazami o digestach zapisanych w runnerach, bez instalacji dodatkowych narzędzi.

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\premium-lineups-stage2a'
git branch --show-current # musi być feat/premium-lineups-stage2a
python -X utf8 app/scripts/test-lineups-local.py
if ($LASTEXITCODE -ne 0) { throw 'SQL/RLS runner nie przeszedł' }
python -X utf8 app/scripts/test-lineups-edge-local.py
if ($LASTEXITCODE -ne 0) { throw 'GoTrue/Edge runner nie przeszedł' }
```

**Cloud Codex:** brak osobnego przebiegu. **Wymagające lokalnego komputera:** dla backendu Stage 2A brak pozostałych obowiązkowych poleceń; powyższe są instrukcją odtworzenia. **Niewykonane:** fizyczny POCO/Android, instalacja APK, test zapisu z Premium UI (Stage 2B), Kong/Storage tego nowego stosu, hostowane CI, Cloud i merge. Nie stosowano migracji ani nie wdrażano Edge do istniejących lokalnych projektów lub Supabase Cloud. Ręczny odbiór produktu pozostaje osobnym krokiem; Stage 2B nie rozpoczęto.

## Migracja i dane

Nowa, jedyna migracja: `app/supabase/migrations/20261029140000_match_lineups.sql`. Zależności: komplet40 migracji konsolidacji PR24, w tym PR16 projekcja nazw i końcowa reguła admin-only finansów. Żadna historyczna migracja nie została zmieniona; brak zależności od9 migracji eksperymentalnego Auth18. Łącznie41.

Tabela `public.slm_match_lineups`: jeden wiersz na mecz, `version`, `team_a/team_b` jako tablice UUID **wpisów uczestnictwa**, `roster_version`, `updated_by`, `updated_at`. Goście mają odrębne ID uczestnictwa, nie konta. Nie ma wymogu równych drużyn:6:5 i transfer5:6 są poprawne. Można zostawić osoby nieprzypisane; API pokazuje `unassigned`. Tablice są sortowane kanonicznie; kolejność wewnątrz drużyny nie jest pozycją na boisku.

Nie ma automatycznego dobierania drużyn, tworzenia wpisu przy GET ani usuwania historii po zmianie rosteru. `stale_entry_ids` jawnie oznacza zapisane ID, które już nie mają statusu `registered`. Zapis nie może ich ponownie przyjąć. Nowi uczestnicy są nieprzypisani. W Stage2B nie wolno renderować starych wpisów na boisku jako aktualnie grających.

## API — istniejąca Edge Function accounts

Klient wywołuje istniejącą ścieżkę `/functions/v1/accounts`, POST, ze swoim zwykłym Bearer tokenem. **Nie wywołuje usługowego SQL RPC bezpośrednio i nie otrzymuje service_role.** Nie ma nowych zmiennych środowiskowych ani zmian sposobu Auth.

### `lineups_get`

Body: `action:"lineups_get"`, `event_id:UUID`.

Odpowiedź zawiera:

| Pole | Znaczenie |
|---|---|
| `event_id` | UUID meczu |
| `version` | Wersja składu;0 bez zapisanego rekordu |
| `team_a`, `team_b` | Kanoniczne tablice UUID uczestnictwa, nie user_id |
| `event_version` | Bieżąca wersja meczu, do porównania z matches_detail |
| `roster_version` | Token SHA256 wersji meczu + posortowanych aktualnych registered IDs |
| `saved_roster_version` | Token, przy którym ostatnio rzeczywiście zmieniono zapis; null bez rekordu |
| `unassigned` | Aktualnie zapisane osoby bez przypisania |
| `stale_entry_ids` | Zapisane wcześniej ID, których nie ma już w aktualnym rosterze |
| `last_change` | null lub `{user_id,display_name,changed_at}` autora ostatniej rzeczywistej zmiany |

`roster_version` jest nieprzezroczystym tokenem64 znaków hex, nie liczbą. To doprecyzowanie projektu: oprócz wersji wydarzenia obejmuje aktualny zestaw ID, więc wykrywa również zmianę zbioru wpisów, gdy administracyjny zapis poza kanonicznym RPC nie zwiększył wersji meczu. Wersja wydarzenia powoduje celowo konserwatywny konflikt również przy innych jego zmianach.

### `lineups_save`

Body: `action:"lineups_save"`, `event_id`, `expected_version` (liczba całkowita >=0), `expected_roster_version` (token z GET), `team_a`, `team_b`, `request_id` (UUID zachowany przy retry). Nie są akceptowane pola autora, roli, sesji, user_id lub group_id. Grupę serwer ustala z meczu, autora z potwierdzonego kontekstu Auth.

Odpowiedź ma powyższy snapshot oraz `changed` i `replayed`. Nowy rzeczywiście zmieniony zapis zwiększa wersję o1 i ustala autora/czas z serwera. Brak zmiany nie wykonuje INSERT/UPDATE w tabeli składu; pusty zapis początkowy nadal ma wersję0 i autora null. Rejestruje jedynie wynik żądania idempotencji. Samo przemieszanie kolejności ID albo lokalna zamiana i jej cofnięcie przed jednym zapisem są no-op. Dwie faktycznie zapisane, przeciwstawne zmiany są natomiast dwoma różnymi zapisami.

## Uprawnienia i status

- Odczyt i zapis: potwierdzona aktywna sesja aktualnego członka właściwej, niearchiwalnej grupy, bez wymuszonej zmiany hasła/operacji bezpieczeństwa. Nie wymaga admina ani organizatora, nie wymaga udziału autora w samym meczu.
- Publiczność meczu nie daje outsiderowi dostępu do grupowego składu. Obcy/były członek dostaje `not_found`, tak jak dla nieistniejącego meczu. Nieaktywny lub odwołana sesja: `session_invalid`.
- Nowy zapis odwołanego meczu jest zabroniony. Zakończony oznacza `starts_at + duration_minutes <= czas serwera`; odczyt historii jest dozwolony, nowy zapis nie. Podczas trwania meczu zapis pozostaje dozwolony.
- Każdy przesłany wpis musi należeć do tego meczu i mieć status registered. Odrzucane są null, niepoprawny UUID/typ, powtórzenie w jednej lub obu drużynach, rezerwa/wycofani, ID z innego meczu i przekroczenie pojemności. Nadal obowiązuje istniejący limit12KB body accounts; nie zwiększano go dla innych modułów.
- Obca grupa, rola globalna, created_by ani organizer nie nadają uprawnień finansowych. Funkcje grup/finansów/anulowania są niezmienione.

## Transakcja, konflikt i retry

Użyto istniejącej blokady `pg_advisory_xact_lock(20261014,1)` oraz kolejności actor/security → event → membership/group → lineup. Ta sama globalna bramka w PR24 serializuje zmiany członkostwa/rosteru z zapisem. Sesja jest ponownie sprawdzana w SQL, wiersze blokowane przed walidacją i mutacją. Brak rekordu składu serializuje blokada meczu; dwa pierwsze zapisy nie tworzą dwóch rekordów.

Po kontroli bieżącego dostępu i formatu sprawdzany jest istniejący `slm_v2_requests`, klucz actor/request UUID i akcja `lineup:save`. Porównywany jest kanoniczny payload (mecz, obie oczekiwane wersje, obie drużyny). Inny payload z tym samym UUID daje konflikt. Następnie nowy zapis sprawdza status meczu, wersję składu i token rosteru oraz aktualność wpisów. Zmiana tabeli i wpis rejestru są w jednej transakcji.

| Kod klienta Edge | HTTP | Działanie Stage2B |
|---|---|---|
| `lineup_version_conflict` |409| Zachować szkic, pobrać GET; nie nadpisywać automatycznie |
| `lineup_roster_conflict` |409| Odświeżyć mecz/roster/GET i świadomie pogodzić szkic |
| `idempotency_conflict` |409| Nie używać UUID do innego zamiaru |
| `lineup_invalid_assignment` / `invalid_input` / `request_required` |400| Poprawić dane; brak częściowego zapisu |
| `not_found` / `session_invalid` |404 /401| Ukryć dane lub ponownie potwierdzić sesję |
| `event_cancelled` / `lineup_closed` / `group_archived` |409| Nie ponawiać nowego zapisu bez zmiany dozwolonego stanu |
| `service_unavailable` |503| Nie zakładać sukcesu; powtórzyć ten sam payload i UUID |

Replay zwraca **wynik pierwotnego żądania**, z `replayed:true`, bez nadpisania nowszego składu. To receipt, nie gwarancja najnowszego snapshotu: po sukcesie/replay Stage2B musi ponownie wykonać GET. Replay wcześniejszego sukcesu może działać po zakończeniu/odwołaniu meczu jako odczyt receipt, ale zawsze wymaga nadal aktualnej sesji i członkostwa w niearchiwalnej grupie. Nowych zmian w zamkniętym meczu nie zapisuje.

W rejestrze nie utrwala się nazwiska ani wyświetlanej nazwy autora. Zapisane są UUID/metadane/podział. `profile_display_name` PR16 i publiczny pseudonim są wyliczane przy każdym odczycie/replay według **obecnych** zgód i uprawnień. Cofnięta zgoda lub odejście autora nie może odtworzyć starego nazwiska z cache. Autor UUID i czas rzeczywistego zapisu pozostają historycznie stabilne.

## RLS i kontrola funkcji

Tabela ma RLS bez polityk klienckich; anon/authenticated nie mają SELECT/INSERT/UPDATE/DELETE. Service_role ma tylko potrzebne SELECT/INSERT/UPDATE. Nowe funkcje: publiczny, usługowy `slm_lineups_dispatch` oraz prywatne `lineup_state` i `lineup_present`; wszystkie SECURITY INVOKER, pusty search_path, EXECUTE tylko service_role. Nie ma nowej publicznej SECURITY DEFINER ani rozszerzenia istniejących grantów.

Handler bierze p_user/p_session ze starego zweryfikowanego kontekstu PR24, odrzuca nieznane pola, ogranicza częstotliwość i tłumaczy błędy bez diagnostyki SQL. Nie edytowano mechanizmów Auth. Ledger finansowy nie jest celem żadnego nowego zapisu.

## Testy wykonane

| Kontrola | Wynik / granica |
|---|---|
| Nowy PostgreSQL17,41 migracji od zera | PASS; brak schematu Auth18 |
| SQL/RLS/wyścigi i rzeczywisty PostgREST HTTP | **50 PASS** końcowego pełnego przebiegu, łącznie z restartem i retry po zmniejszeniu limitu |
| Dwie równoczesne sesje SQL | Jeden sukces i jeden konflikt; osobno identyczny retry daje jedną wersję/rekord żądania |
| Dwa równoczesne rzeczywiste HTTP | Jeden sukces i jeden błąd wersji; retry zwycięzcy bez nowej wersji |
| Prywatność/role | Członek, outsider, inny admin, były/nieaktywny, fałszywy autor/sesja, bieżące/cofnięte zgody, historyczny autor po wyjściu, brak eskalacji finansowej PASS |
| Bezpośrednie SQL/REST/RPC | SELECT/INSERT i podrobione RPC niedozwolone; nawet tymczasowy testowy grant SELECT nadal daje0 wierszy przez RLS |
| Niepoprawne wpisy/no-op/roster | Duplikaty, null/typ/UUID, inny mecz, rezerwa, wycofani, limit,6:5, transfer, kolejność, no-op autora/czasu i konflikty PASS |
| Istniejące SQL regresji | premium_match_visibility, premium_admin_finance, premium_profile_name, settlements i integration-contracts PASS z poprawnymi własnymi fixtures |
| Jednostkowe Edge | **23 PASS**: tożsamość kontekstu, whitelist, błąd/sesja, kody400/401/404/409/503; transport kontrolowany, nie GoTrue |
| Pełny Vitest | **320 PASS /52 pliki**, razem z powyższymi23 |
| TypeScript aplikacji i strict Edge / ESLint | PASS |
| Build LIVE / Premium lokalny / demo | PASS; izolacja demo16 PASS, zastane ostrzeżenia chunków |
| Frozen wygląd i runtime / konsolidacja | PASS po addytywnym przypięciu jednej migracji;55 plików UI i Stage1 niezmienione |
| Negatywne testy strażnika | **29 PASS**, poprzednie23 zachowane +6 dodatkowych odmów dla backendu |
| GoTrue → Edge HTTP | Wcześniej NOT TESTED; domknięcie powyżej: **13 PASS** w nowym odizolowanym stosie |
| Fizyczny Android | **NOT TESTED**, bez instalacji APK |
| Chromium UI | Bieżący Cypress: **13 PASS**, kontrolowane API; bez testu podłączenia Stage 2B |

### Wiarygodność i izolacja

Runner `app/scripts/test-lineups-local.py` wymaga tej gałęzi i lokalnego socketu Docker. Tworzy nowy PostgreSQL z `--network none`, nie publikuje portów, nie resetuje i nie usuwa baz. Replay41 źródeł używa testowego bootstrapu Auth/Storage. Uruchamia przypięty PostgREST12.2.12 (`sha256:5f4ce744539bbba786b4e24dbbd95bdb2a956dcf568c5374995a0ff4a68f5bd2`) w tym samym izolowanym namespace i wysyła prawdziwe HTTP po wewnętrznym loopback. Tokeny są syntetyczne, lokalnie podpisane kluczem wygenerowanym tylko w pamięci runnera; nie są wydane przez GoTrue. Dlatego test PostgREST/JWT i jednostkowy handler są odrębnymi dowodami, nie pełnym Supabase E2E.

`verify_restart` w końcowym pełnym przebiegu wykonał faktyczny stop/start PostgreSQL i potwierdził identyczne drużyny, wersję, UUID autora i czas. Cały runner zakończył się50 PASS, bez pominięć. Dodatkowo sprawdza replay pierwotnego większego składu po późniejszym zmniejszeniu pojemności: dynamiczna kontrola limitu dotyczy nowego zapisu, nie odczytu zatwierdzonego receipt z rejestru.

Końcowa fixture: `slm-lineups-stage2a-dbfaba8a9003` oraz jej `-rest`. Oba kontenery zatrzymane i zachowane, bez drop/reset/remove. Wcześniejsze fixtures prób runnera również zatrzymano i zachowano. Nie łączono się z używaną bazą POCO, Cloud ani żadnymi prawdziwymi kontami. Uzupełnienie własnych danych starego testu finansów oraz obsługi odpowiedzi błędów klienta HTTP poprawiło wyłącznie runner, nie istniejące testy bezpieczeństwa/backend Auth.

Z repo: `python3 app/scripts/test-lineups-local.py`. Z `app/`: `npm run test.unit -- --run`, `npm run typecheck:edge`, `npx tsc --noEmit`, `npm run lint -- .`, buildy powyżej, `npm run verify:consolidation`, `npm run test:premium-policy`. Każdy pełny przebieg SQL tworzy nową fixture; nie powtarzać bez potrzeby.

## Ochrona kontraktów i pliki

Dodanie migracji celowo ujawniło stare dokładne oczekiwanie40. Nie usunięto go ani nie zmieniono na dowolną liczbę: lista jest teraz dokładnie41, z **jedną** nową ścieżką i porównaniem jej pełnej zawartości do niezmiennego implementacyjnego `b46b7b9`. Dodatkowo przypięto cały handler z tym samym źródłem. Wszystkie poprzednie SHA, historyczne SQL, manifest55, kontrola UI, routing i wykluczenie Auth18 zostały zachowane. Sześć nowych prób odrzuca wyłączenie RLS, grant client RPC, zapis przy no-op, usunięcie CAS/scope i autora z body. To rozszerzenie ochrony nowego backendu, nie osłabienie strażników.

Zmiany: jedna nowa migracja, addytywna gałąź `lineups_*` w `accounts/handler.ts`, `lineups.test.ts`, `supabase/tests/match_lineups.sql`, `scripts/test-lineups-local.py`; trzy istniejące skrypty guardów z powyższym rozszerzeniem; ten raport, aktualizacja planu, STATUS i ODPOWIEDZI_CODEX. **app/src (w tym Stage1), UI/assets, Auth/sesja, finanse, stare migracje, zależności i konfiguracja wdrożeń pozostają bez zmian.**

## Gotowość do Stage 2B

Kontrakt i lokalny backend są gotowe do rozpoczęcia Stage2B **po akceptacji właściciela**. Stage2B ma użyć GET jako baseline, utrzymać draft i oba tokeny, zachować UUID niepewnego żądania, filtrować stale_entry_ids względem rosteru, obsłużyć409 bez nadpisania oraz odświeżyć GET po zapisie/replay. Nazwę autora pokazywać tylko z last_change serwera. Nie podłączono żadnego przycisku ani klientowego zapisu teraz.

Ograniczenia: globalna blokada odziedziczona po PR24 serializuje operacje (wystarczająca dla aktualnej skali, nie deklaracja dużej przepustowości); token rosteru jest konserwatywny; brak push/Realtime aktualizacji składu; stare przypisania po zmianie rosteru wymagają świadomej korekty; istniejący limit12KB payloadu. Lokalny GoTrue/Edge/HTTP, dwa klienty i restart zaliczono w domknięciu powyżej. Fizyczny Android dopiero przy osobno zatwierdzonym etapie. Żadnego wdrożenia Cloud ani merge nie wykonano.

## Git / Draft PR — 2026-10-29 14:38 Europe/Warsaw

Kod, dokładna aprobata źródeł i raport w commicie **`f7c13bb3bc85a903c9840c9e47e08fcec0c4a887`** zostały wypchnięte na `origin/feat/premium-lineups-stage2a`. Przed ostatnią aktualizacją Git-doc worktree był czysty. Końcowe potwierdzenie Git jest oddzielnym commitem dokumentacyjnym po tym SHA; źródło zatwierdzonego backendu pozostaje b46b7b91796b96acfc809799e09a5a6898b99342.

**Draft PR nie utworzono.** POST GitHub API z `draft:true`, base `fix/premium-lineup-stage1-contract` i head tej gałęzi zwróciło `Forbidden`. Nie ma numeru PR do potwierdzenia; nie obchodzono ograniczenia ani nie pozyskiwano dodatkowych tokenów. [Właściwe porównanie do utworzenia Draft PR](https://github.com/psuda87/sunday-league-mates/compare/fix/premium-lineup-stage1-contract...feat/premium-lineups-stage2a?expand=1). Wybrać **Create draft pull request**; tytuł: „Stage 2A: trwały zapis składów z CAS, RLS i idempotencją”. Opis i review muszą zachować rozróżnienie50SQL/PostgRESTHTTP i320Vitest od niewykonanego pełnegoGoTrue/EdgeHTTP oraz brak podłączenia przycisku Zapisz. Bez merge, wdrożeń i Stage2B.

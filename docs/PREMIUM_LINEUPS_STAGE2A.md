# Stage 2A — trwały backend składów

2026-10-29, Europe/Warsaw. Gałąź `feat/premium-lineups-stage2a` od dokładnego `7ad5c75414cf669d4471f3122e93073dab9aa8d7`. Przed pracą lokalny/zdalny HEAD bazy był zgodny i worktree czysty. Backend implementacji zapisany w **`6f511f45737135e6ebe969b9ec14595708821c32`**; końcowy commit zawiera także addytywną ochronę źródeł i dokumentację. Baza zależnego Draft PR: `fix/premium-lineup-stage1-contract`.

**Stage 2A ukończony w zakresie kodu i opisanych testów. Stage 2B nie rozpoczęty.** Edytor, wygląd i stale wyłączony przycisk „Zapisz” są niezmienione. Nie przenoszono Auth18 i nie dotykano Supabase Cloud ani istniejących baz.

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
| SQL/RLS/wyścigi i rzeczywisty PostgREST HTTP | **48 PASS** końcowego przebiegu + **1 PASS** trwałości po restarcie, wykonany osobno na tej samej fixture |
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
| Pełny GoTrue → Edge HTTP, fizyczny Android | **NOT TESTED** w tej instancji; nie przypisujemy im PASS |
| Chromium UI | NOT RUN, brak zmiany/podłączenia UI |

### Wiarygodność i izolacja

Runner `app/scripts/test-lineups-local.py` wymaga tej gałęzi i lokalnego socketu Docker. Tworzy nowy PostgreSQL z `--network none`, nie publikuje portów, nie resetuje i nie usuwa baz. Replay41 źródeł używa testowego bootstrapu Auth/Storage. Uruchamia przypięty PostgREST12.2.12 (`sha256:5f4ce744539bbba786b4e24dbbd95bdb2a956dcf568c5374995a0ff4a68f5bd2`) w tym samym izolowanym namespace i wysyła prawdziwe HTTP po wewnętrznym loopback. Tokeny są syntetyczne, lokalnie podpisane kluczem wygenerowanym tylko w pamięci runnera; nie są wydane przez GoTrue. Dlatego test PostgREST/JWT i jednostkowy handler są odrębnymi dowodami, nie pełnym Supabase E2E.

Dodany `verify_restart` uruchomiono osobno na zachowanej fixture bez ponownego replay całej bazy: faktyczny stop/start PostgreSQL zachował identyczne drużyny, wersję, UUID autora i czas. Runner zawiera tę kontrolę również na końcu przyszłego pełnego przebiegu (49 kontroli łącznie).

Końcowa fixture: `slm-lineups-stage2a-e76f7f3b916b` oraz jej `-rest`. Oba kontenery zatrzymane i zachowane, bez drop/reset/remove. Wcześniejsze fixtures prób runnera również zatrzymano i zachowano. Nie łączono się z używaną bazą POCO, Cloud ani żadnymi prawdziwymi kontami. Uzupełnienie własnych danych starego testu finansów oraz obsługi odpowiedzi błędów klienta HTTP poprawiło wyłącznie runner, nie istniejące testy bezpieczeństwa/backend Auth.

Z repo: `python3 app/scripts/test-lineups-local.py`. Z `app/`: `npm run test.unit -- --run`, `npm run typecheck:edge`, `npx tsc --noEmit`, `npm run lint -- .`, buildy powyżej, `npm run verify:consolidation`, `npm run test:premium-policy`. Każdy pełny przebieg SQL tworzy nową fixture; nie powtarzać bez potrzeby.

## Ochrona kontraktów i pliki

Dodanie migracji celowo ujawniło stare dokładne oczekiwanie40. Nie usunięto go ani nie zmieniono na dowolną liczbę: lista jest teraz dokładnie41, z **jedną** nową ścieżką i porównaniem jej pełnej zawartości do niezmiennego implementacyjnego `6f511f4`. Dodatkowo przypięto cały handler z tym samym źródłem. Wszystkie poprzednie SHA, historyczne SQL, manifest55, kontrola UI, routing i wykluczenie Auth18 zostały zachowane. Sześć nowych prób odrzuca wyłączenie RLS, grant client RPC, zapis przy no-op, usunięcie CAS/scope i autora z body. To rozszerzenie ochrony nowego backendu, nie osłabienie strażników.

Zmiany: jedna nowa migracja, addytywna gałąź `lineups_*` w `accounts/handler.ts`, `lineups.test.ts`, `supabase/tests/match_lineups.sql`, `scripts/test-lineups-local.py`; trzy istniejące skrypty guardów z powyższym rozszerzeniem; ten raport, aktualizacja planu, STATUS i ODPOWIEDZI_CODEX. **app/src (w tym Stage1), UI/assets, Auth/sesja, finanse, stare migracje, zależności i konfiguracja wdrożeń pozostają bez zmian.**

## Gotowość do Stage 2B

Kontrakt i lokalny backend są gotowe do rozpoczęcia Stage2B **po akceptacji właściciela**. Stage2B ma użyć GET jako baseline, utrzymać draft i oba tokeny, zachować UUID niepewnego żądania, filtrować stale_entry_ids względem rosteru, obsłużyć409 bez nadpisania oraz odświeżyć GET po zapisie/replay. Nazwę autora pokazywać tylko z last_change serwera. Nie podłączono żadnego przycisku ani klientowego zapisu teraz.

Ograniczenia: globalna blokada odziedziczona po PR24 serializuje operacje (wystarczająca dla aktualnej skali, nie deklaracja dużej przepustowości); token rosteru jest konserwatywny; brak push/Realtime aktualizacji składu; stare przypisania po zmianie rosteru wymagają świadomej korekty; istniejący limit12KB payloadu. Przed odbiorem integracji wykonać pełny lokalny GoTrue/Edge/HTTP i test dwóch klientów po restarcie, a fizyczny Android dopiero przy osobno zatwierdzonym etapie. Żadnego wdrożenia Cloud ani merge nie wykonano.

Końcowy SHA gałęzi i rzeczywisty wynik utworzenia Draft PR zostaną dopisane po zapisaniu dokumentacji.

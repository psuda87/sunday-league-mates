# Public Match Discovery — Etap 2A, niezależny przegląd backendu

2026-10-30. Gałąź `audit/public-match-discovery-backend`, utworzona z dokładnego
`24a59e104bfe80b4d2f41cbd0ad02b58fc546040`. Checkout początkowo czysty.
Zdalne refy potwierdzone przez Git: discovery=24a59e1, Stage3B=e04d9a4.
Porównanie wykonano z **e04d9a47560de36657da76f12ae63e20ef2299cb**, nie z main.

**Wynik: PASS badanego backendu; WARN ograniczeń; BLOCK integracji i aktywacji
przypięć do osobnej akceptacji właściciela.** Nie jest to zgoda na merge/deploy.
Nie znaleziono nowej luki wymagającej zmiany migracji lub handlera. Oba pliki
pozostają bajtowo zgodne z 24a59e1. Nie implementowano UI.

## Co faktycznie zmieniał Etap 1

Osiem plików względem Stage3B: nowa migracja nr42, cztery linie handlera
(3 dodane/1 usunięta), runner SQL, test Edge, test SQL i trzy dokumenty.
Pozostałe 41 migracji niezmienione. UI/assets/native/workflows, Auth i finanse,
backend oraz edytor składów bez zmian. Niniejszy audyt rozszerza testy i dokumenty;
nie zmienia działającego backendu ani aktywnych strażników.

## Audyt SQL, uprawnień i projekcji

- `20261030090000_public_match_discovery.sql` tworzy jedną funkcję
  `slm_private.match_discovery_list(uuid,uuid,jsonb)`. SECURITY INVOKER,
  pusty search_path, EXECUTE wyłącznie service_role. Public/anon/authenticated
  nie mogą jej wywoływać. Nie dodaje tabel, polityk ani grantów do danych.
- RLS zachowany **nie oznacza**, że to RLS sam filtruje ten feed: service_role ma
  BYPASSRLS. Granicą API są zweryfikowany aktor/sesja z Edge, SQL session_valid
  i istniejący match_feed_visible. Bezpośredni klient nie ma tych grantów.
- Sprawdzono całość katalogu polityk przed/po42 — identyczna. Definicje funkcji
  Auth/grup/finansów/składów również identyczne. Odwrócenie wyłącznie delegacji
  list przywraca dokładnie dawny matches_dispatch_core (w tym projekcję PR16).
- Podmiana historycznej gałęzi list wymaga dokładnego starego tekstu.
  Negatywny test niezgodności kończy transakcję bez nowego helpera i bez zmiany
  dispatchera. Nie zastosowano migracji do istniejącej bazy.
- Zwykły klient nie może podać skutecznie cudzego p_user/p_session. Edge bierze
  je z kontekstu, SQL sprawdza żywą sesję. Sprawdzono niezgodną parę, konto
  nieaktywne, hasło tymczasowe i usuniętą sesję. Nie dodano nowego modelu Auth.
- `all` = dotychczasowa widoczność własnych grup/publicznych przyszłych oraz
  dozwolonej historii udziału; `groups` = wszystkie aktualne członkostwa.
  `mine` nadal oznacza własny udział, `group` konkretną grupę. Zmiana nazwy
  zakresu nie nadaje członkostwa ani uprawnień administratora.
- Wszystkie zakresy filtrują przez match_feed_visible. Prywatny obcy mecz nie
  pojawia się w żadnym zakresie ani wyszukiwaniu; znany UUID nie daje dostępu
  do detail/join. Cofnięcie członkostwa i zamknięcie publicznego meczu natychmiast
  usuwa dostęp niezwiązanego outsidera.
- Query: opcjonalny string do100 znaków, trim, lower, literalne position po
  nazwie publicznego meczu lub grupy. Nie ma dynamicznego SQL z wejścia klienta,
  wildcardów ani regexu od użytkownika. Niepuste query wymaga scope=public.
  Białe znaki wewnątrz pozostają istotne; nie jest to fuzzy/full-text search.
- Filtry widoczności, zakresu, okresu i tekstu są **przed** LIMIT/OFFSET.
  Test105 pasujących publicznych i120 wcześniejszych prywatnych wykazał
  prawidłowe strony100+5; cały publiczny zbiór107 ma strony100+7 bez przecieku.
- DTO jest dokładnie istniejącym match_summary. Zamknięta lista kluczy testowana;
  zawiera dane organizacyjne, liczniki i cenę meczu, nie salda/wpłaty/ledger.
  Zwraca również istniejące techniczne id/group_id/created_by i flagi, nie pełny
  profil autora ani listę członków. Te UUID nie stanowią uprawnienia do API.
  Nie dodano address ani nowego profilu/telefonu do DTO.
- Publiczny status nie udostępnia prywatnego katalogu grup/profili, finansów ani
  składów. Testy odmowy objęły także administratora **innej** grupy i rezerwistę
  publicznego meczu. Publiczne detail może nadal pokazywać dozwoloną listę
  uczestników samego meczu wg starego kontraktu PR16, nie prywatny katalog grupy.
- Licznik obejmuje zapisanych i gości; rezerwa nie zajmuje miejsc. Dostępność
  miejsc nie obiecuje zapisu: stare API nadal odmawia dla pełnego/zakończonego/
  anulowanego meczu. Odczyty nie zmieniają członkostwa ani ledgera.

## Handler i kompatybilność API

Istniejące `accounts` → `matches_list` → `slm_matches_dispatch`, bez nowej trasy.
`query` dodano do whitelist tylko dla list. Dotychczasowy actor/session, limit
90 scoped żądań/min i no-store zachowane. Parametry są walidowane w SQL,
nie tylko w UI. Testy pokazują400/401/403/429/503 oraz utratę sieci bez danych
zastępczych. Marker `public_discovery_version:1` wymagany dla query lub groups;
stary/niezgodny backend daje503 zamiast pozornie udanego wyszukiwania.
Legacy list bez nowych opcji pozostaje zgodny. Nie zmieniono gałęzi Auth,
lineups ani group_finance handlera.

## Sortowanie, limity i znane ograniczenia — WARN

- Max100 DTO, lookahead101 ID, has_more/next_offset. Offset to JSON integer
  0..2147483547. Klient nie może podnieść limitu. Query max100, istnieje też
  limit treści żądania Edge. Brak łącznej liczby prywatnych wyników.
- Upcoming sortuje globalnie rosnąco starts_at, UUID rozstrzyga remisy. Inne
  okresy malejąco starts_at, potem UUID. Stara implementacja wybierała100
  najpóźniejszych, a dopiero agregat sortowała rosnąco. To celowa zmiana
  read-contract; wymaga odbioru klienta, nie jest identyczną kolejnością legacy.
- Offset jest deterministyczny przy niezmiennym zbiorze, ale **nie jest snapshotem**:
  równoległe dodanie/edycja widocznych wydarzeń może przesunąć strony. Zegar
  również zmienia klasyfikację przyszłe/historia. Nie deklarujemy cursor pagination.
- Dziedziczona globalna blokada advisory, skan lower/position i sort/window na
  pasujących rekordach mogą kosztować dużo przy dużym zbiorze/odległym offsecie.
  Limit wyników i rate-limit nie dowodzą odporności na przeciążenie. Brak testu
  obciążeniowego/EXPLAIN na docelowej skali. Nie zmieniano wspólnej blokady.
- Dziedziczona polityka archiwalnych grup nie została zmieniona. Publiczny mecz
  ujawnia nazwę organizującej grupy i dane organizacyjne zgodnie z dotychczasowym
  kontraktem; nie oznacza upublicznienia jej danych osobowych.

## Wszystkie zidentyfikowane blokady kontraktów

| Kontrola | Rzeczywisty wynik | Powód / wymagane rozstrzygnięcie |
|---|---|---|
| verify-consolidation.mjs | FAIL | dokładnie41, obecnie42 |
| verify-frozen-ui.mjs: visual | PASS55 | zatwierdzony wygląd bez zmian |
| premium-route-policy.mjs: runtime | FAIL | ścisła lista migracji nie zawiera42; po jej akceptacji handler jest nadal przypięty do Stage2A/b46b7b9 |
| verify-premium-policy-cases.mjs | FAIL0/37 | każda próba zaczyna od niespełnionego runtime; nie oznacza37 stwierdzonych regresji UI |
| lineups_ci.py verify_sources | FAIL | handler nie jest źródłem zatwierdzonego6d96391; dalej zablokują też nowe wejścia/testy i zestaw42 |
| lineups_ci.py approval/41 | BLOCK | sama zmiana implementation w JSON nie wystarczy: sprawdzanie implementacji względem45d9a4 nie dopuszcza backendu ani nowych plików |
| stare SQL/Edge runnery | BLOCK/NOT RUN | lokalne guardy innych gałęzi; Edge i SQL nadal oczekują41; nie obchodzono ich |
| nowe UI discovery | NOT IMPLEMENTED | PremiumEvents pozostaje przypięty do Stage1, wymaga osobnej zgody |

Pełne źródła CI, approval JSON,37 istniejących testów policy, manifest55 i wszystkie
aktywne strażniki pozostawiono bez zmian. Żaden PASS nie pochodzi z ich wyłączenia.

## Propozycja do osobnej akceptacji właściciela — NIEAKTYWNA

1. [public-discovery-contracts-proposed.patch](review/public-discovery-contracts-proposed.patch)
   zmienia tylko dwa strażniki backendu i dodaje pięć negatywnych przypadków policy.
   Pin do **24a59e104bfe80b4d2f41cbd0ad02b58fc546040** dotyczy dokładnie42 i
   całego handler.ts. Migracja lineups nadal Stage2A. Wszystkie55 plików wyglądu,
   routing, Auth, finanse, native i inne wyjątki pozostają przy starych wzorcach.
   Zamiast tylko podnieść41→42, consolidation porównuje dokładny zestaw i wszystkie
   stare41 plików z e04d9a4. Dodatkowa43 ani modyfikacja historycznych SQL niedozwolona.
2. [public-discovery-backend-candidate.json](review/public-discovery-backend-candidate.json)
   zawiera dokładne SHA256 **dwóch źródeł backendu** oraz osobno czterech wejść
   testowych do późniejszego review CI. Żaden runner go nie konsumuje. Nie jest
   podpisem ani zgodą właściciela; nie zmienia lineups-ci-approval.json.
3. [test_discovery_contract_proposal.py](review/test_discovery_contract_proposal.py)
   odtwarza proponowane pliki **wyłącznie w /tmp** i sprawdza je na rzeczywistym
   checkoutcie. Wynik42 PASS = stare37 + nowe5, plus osobna odmowa zmiany każdego
   z dwóch przypiętych plików. Nie oznacza PASS aktywnego runtime.
4. CI pozostaje zablokowane. Osobna aktualizacja musi zachować pin6d96391 do
   runnerów/workflow, repo/main/event/SHA/ancestry i sprawdzać ścisły backend-overlay
   tych dwóch plików oraz osobno zatwierdzone testy. Nie wolno po prostu przepiąć
   całego app do discovery, dodać wildcardów ani dopuścić dowolnego42 SQL.
   Konieczny jest też osobny review aktualizacji istniejących oczekiwań41 w
   runnerach SQL/GoTrue. **Nie przygotowano wykonywalnej aktualizacji CI**:
   obecne guarded testy nie obsługują42 i zatwierdzenie dwóch backendów tego nie
   naprawi. Nie rozluźniono środowiska ani nie uruchomiono jobów mimo blokady.

## Rzeczywiście wykonane kontrole

| Zakres | Wynik |
|---|---|
| Nowy PostgreSQL /42 migracje/SQL/ACL/RLS | **PASS52**, w tym wszystkie wcześniejsze34 scenariusze |
| Vitest (pełny) | **PASS352/54 pliki**, discovery17 (wcześniejsze10 + nowe7) |
| Nowe negatywne testy lokalnego preflight | **PASS8**, bez Docker/DB/udawania CI |
| Dotychczasowe testy CI launch-contract | **PASS23**, niezmienione |
| TypeScript app / strict Edge / pełny ESLint | **PASS** |
| build LIVE / Premium-finance-local / Android-stage3 web / demo | **PASS4**, demo isolation16 |
| Niezmienność UI/native/assets/CI/Auth/finansów/41migracji | **PASS** porównanie Git i SQL |
| Aktywne consolidation/runtime/policy/CI source gate | **FAIL/BLOCK**, opisane powyżej |
| NIEAKTYWNA propozycja guardów | **PASS42**, nie zatwierdzono/nie aktywowano |
| Real GoTrue→HTTP Edge/PostgREST E2E, hosted Actions | **NOT RUN** |
| Chromium nowych ekranów/Android/POCO | **NOT RUN**, brak zmian UI |

SQL runner otrzymał jawne dopuszczenie **tylko** audit/public-match-discovery-backend
z ancestry24a59e1 i ścisłym sprawdzeniem obu backendów oraz41 historycznych plików.
Stary lokalny discovery branch zachowany. CI nadal bezwarunkowo odrzucane.
Nie zmieniono żadnego z wcześniejszych runnerów CI/lineups.

Nowe fixture: `slm-public-discovery-59f2798efd97` (pierwsza próba) oraz
`slm-public-discovery-097895663f8b` (końcowe52 PASS), network-none, bez portów/mountów,
obraz PostgreSQL po istniejącym digest. Zatrzymane/zachowane; zastanych baz nie
uruchamiano ani nie modyfikowano. Auth/Storage to minimalny bootstrap, **nie** GoTrue.
Pierwsza nowa próba prawidłowo odrzuciła sesję cofniętą w teście, lecz fixture nie
przywrócił wpisu aplikacyjnego po CASCADE. Poprawiono fixture przez ponowną akceptację
syntetycznej sesji; pełne52 ponowiono. Pierwszy mock preflight kolidował z wewnętrznym
subprocess.run; poprawiono wyłącznie mock, osiem testów ponowiono PASS.

## Gotowość i następny krok

Backend rekomendowany do review, **nie gotowy do automatycznego merge**. Najpierw
osobna decyzja właściciela o dokładnym patchu przypięć/backendzie42 i zakresie
aktualizacji CI. Następnie zgodny izolowany realny GoTrue/Edge oraz przyszłe UI
tylko po jego zatwierdzeniu. Nie aktualizowano wzorca Premium3.18.

Supabase Cloud, istniejące bazy, Auth serwerowy, finanse, telefon i środowiska
produkcyjne pozostały nietknięte. Brak merge/deploy/reset/db push. Commit/push
niniejszego audytu nie jest akceptacją kontraktów. SHA publikacji dopisany poniżej.

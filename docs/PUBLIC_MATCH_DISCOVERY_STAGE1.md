# Public match discovery — Etap 1

2026-10-30. `feat/public-match-discovery` od dokładnego
`e04d9a47560de36657da76f12ae63e20ef2299cb` (Stage3B). Stan początkowy czysty.

**Backend zaimplementowany i sprawdzony lokalnie. UI: BLOCKED do zatwierdzenia
minimalnego projektu poniżej. Kontrakty integracji: FAIL, bez zmiany guardów.**
Nie jest to ukończona funkcja dostępna w aplikacji ani kandydat gotowy do merge.

## Stan zastany i decyzja o zakresie

`PremiumEvents.tsx` / `usePremiumEvents.ts` już korzystają z `matches_list`.
Domyślne `scope=all,period=upcoming` pokazuje własne grupy i przyszłe publiczne
mecze, a `match_feed_visible` ukrywa obce prywatne oraz obcą publiczną historię.
Serwer już filtruje przed paginacją. Istnieją `all/public/group/mine`, lecz
`mine` oznacza własny udział, nie zbiorczo wszystkie moje grupy. Brakowało
wyszukiwania; model posiada zarówno `slm_matches.name`, jak i `slm_groups.name`.

Nowy UI wymaga zmiany `PremiumEvents.tsx`, przypiętego dokładnie do Stage1 przez
`premium-route-policy.mjs`. Zgodnie z poleceniem zatrzymano tę część: całe
`app/src`, CSS, grafiki, karty, BottomNav i profile pozostały niezmienione.
Nie dodano martwej kopii UI ani filtrowania wyników wyłącznie w przeglądarce.

## Gotowa część backendu w repozytorium

Nowa migracja **`20261030090000_public_match_discovery.sql`** (krok42 po zachowanych
41). Dodaje prywatną funkcję `slm_private.match_discovery_list` i zastępuje tylko
gałąź `list` istniejącego `matches_dispatch_core`. Migracja sprawdza dokładną
treść zastępowanego bloku; obcy kontrakt kończy operację błędem. Nie kopiuje
mutatorów i nie nadpisuje historycznych migracji. Nie zmienia tabel, RLS, zasad
Auth, zapisów, członkostwa, finansów, profili ani składów.

Istniejąca Edge Function `accounts`, akcja **`matches_list`**, zyskuje jedynie
przekazanie `query` do istniejącego dispatcher RPC. Pole jest dopuszczone tylko
dla listy, nie dla zapisów/edycji. Zmiana to whitelist query i fail-closed dla nowych opcji bez markera wersji.
Uwierzytelnienie, aktor/session_id, rate90/min, dotychczasowe błędy i no-store zachowano.
Nie ma nowego endpointu lub równoległego systemu wyszukiwania. Nowy handler
zwraca503 discovery_unavailable, jeżeli stary SQL zignorował query albo nie
potwierdził scope=groups markerem public_discovery_version=1. Zwykłe stare
wywołanie bez nowych opcji nadal działa; nie pokazujemy nieprzeszukanej listy
jako poprawnego wyszukiwania.

### Kontrakt listy

| Parametr | Znaczenie |
|---|---|
| `scope=all` | Dotychczasowa widoczność: aktualne własne grupy + przyszłe publiczne; historia zgodnie z istniejącymi uprawnieniami |
| `scope=groups` | Nowy zbiorczy filtr wszystkich aktualnych grup użytkownika |
| `scope=public` | Dostępne publiczne mecze własnych i obcych grup |
| `scope=mine/group` | Zachowane własne uczestnictwo / jedna wskazana grupa; nadal pod wspólnym predykatem prywatności |
| `period=upcoming/history/all` | Zachowane okresy; nowy ekran używa upcoming |
| `query` | Opcjonalny tekst do100znaków, tylko przy scope=public gdy niepusty; literalny podciąg nazwy meczu lub grupy, bez regex/SQL/LIKE wildcardów |
| `offset` | Nieujemna liczba całkowita; stały limit100. Nieprawidłowy typ/zakres daje invalid_input |

Przykład przyszłego wywołania, wymagającego świadomie zatwierdzonego wdrożenia:

```json
{"action":"matches_list","scope":"public","period":"upcoming","query":"orlik","offset":0}
```

Trim brzegów i wyszukiwanie bez rozróżniania wielkości liter, także polskich,
są serwerowe. Nie usuwamy znaków diakrytycznych: `zolty` nie jest aliasem `żółty`.
Znaki `%`/`_` i tekst przypominający SQL pozostają zwykłym tekstem. Pusty tekst
wraca do pełnego publicznego feedu; wyszukiwanie nie obejmuje prywatnych meczów.

Wszystkie predykaty prywatności, zakresu, okresu i query działają przed limit/offset.
Pobierane jest100+1 ID; do DTO trafia najwyżej100 podsumowań. Odpowiedź zachowuje
`events/server_now/member_creation_enabled` oraz dodaje `public_discovery_version=1`,
`offset/limit/has_more/next_offset`. Bez globalnego total count.
Kolejność globalna: upcoming rosnąco po terminie, pozostałe okresy malejąco;
UUID rozstrzyga remisy, agregacja zachowuje kolejność strony. Poprzednio
upcoming wybierał stronę malejąco, dopiero potem sortował jej zawartość rosnąco.
Teraz najbliższy termin nie zostaje pominięty wskutek okna paginacji. Offset jest
stabilny dla niezmiennych danych; równoległe dodanie/zmiana wydarzenia może przesunąć
strony — nie deklarujemy paginacji snapshot/cursor.

### Dane i prywatność

Reużywany jest istniejący `match_summary`: termin, miejsce, nazwa meczu/grupy,
widoczność, dozwolone liczniki i dotychczasowe pola/capabilities zgodne z DTO.
Nie dodano opisu prywatnej grupy, list członków, profili, telefonów, e-maili,
wpłat lub ledgera. Istniejące ID twórcy i koszt wydarzenia pozostają częścią
dotychczasowego kontraktu, nie zapewniają prawa do prywatnego profilu/finansów.
Nazwę grupy można znaleźć tylko poprzez widoczny publiczny mecz tej grupy.

Zajętość liczy zarejestrowane wpisy, w tym gości, bez rezerwy. Liczba wolnych
miejsc może być obliczona z capacity−registered_count. Nie jest gwarancją zapisu:
backend nadal sprawdza czas/status, miejsce, odpowiedzialność za gości i
registration_allowed (w tym zaległości). Nie zmieniono reguł finansowych.
Publiczne roster/details zachowują istniejący kontrakt; prywatne profile grupowe,
szczegóły grupy, składy i zarządzanie finansami nadal mają osobne uprawnienia.
Ani odczyt, ani jawny zapis na publiczną rezerwę nie dodaje członkostwa.

Nowa funkcja to SECURITY INVOKER, pusty search_path, EXECUTE tylko service_role;
sesja i aktywne konto weryfikowane przy każdym odczycie. Klient nie wybiera
p_user/p_session: handler bierze je z istniejącego kontekstu Auth. Brak zmian
grantów tabel lub poszerzenia polityk RLS. Dziedziczymy istniejący globalny
advisory lock i definicję widoczności/archiwizacji, bez nowej polityki grup.
Literalne wyszukiwanie może skanować wiele wierszy; limit ogranicza odpowiedź,
nie gwarantuje stałego kosztu zapytania. Nie wykonywano testu obciążenia.

## Minimalny projekt UI — DO ZATWIERDZENIA, bez implementacji

Na istniejącym ekranie Mecze, bez zmian kart, nagłówka, menu i wspólnych komponentów:

```text
Istniejący selektor zakresu:
  Wszystkie        → scope=all
  Moje grupy       → scope=groups
  Publiczne        → scope=public
  [zachowane obecne wybory konkretnej grupy / własnego udziału]

Tylko w Publiczne:
  Szukaj publicznego meczu lub grupy [________________]

Dotychczasowe filtry Nadchodzące / Moje / Historia
Dotychczasowe karty meczów i paginacja
```

To zmiana pierwszych opcji istniejącego selecta i dodanie jednego oznaczonego
input type=search, nie nowy rząd wysokich przycisków ani nowy ekran. Dodatkowe
obecne opcje pozostają, aby nie usuwać funkcjonalności. Użytkownik zatwierdza,
czy taki minimalny select spełnia oczekiwany filtr trzech zakresów.

Projekt techniczny po zatwierdzeniu: reuse obecnych klas/tokens Light/Dark/Auto;
query debounce300ms, zerowanie offsetu po query/scope, odrzucenie spóźnionych
odpowiedzi oraz czyszczenie query przy opuszczeniu Publiczne. Wymagane stany
loading/brak wyników/błąd/retry korzystają z istniejącej obsługi; bez przykładowego
salda lub zastępczych wydarzeń. Publiczne wybory grup nie otwierają katalogu
członków. Dane starej sesji nadal są usuwane przez istniejący SessionManager.

Nowsze UI musi sprawdzić `public_discovery_version===1` dla query/groups i w razie
starego serwera pokazać brak obsługi. Stary handler pomija nieznane query; nie
wolno uznać takiej odpowiedzi za przeszukaną ani filtrować pierwszych100 lokalnie.
Do zmiany po zgodzie: PremiumEvents/usePremiumEvents i kontrakt odpowiedzi;
MatchHero/Ultimate/BottomNav/MatchFilters/CSS bez przebudowy. Zmiany przypięć
runtime i backendu wymagają osobnego świadomego przeglądu właściciela.

## Faktycznie wykonane testy

| Kontrola | Wynik i granica |
|---|---|
| Nowy izolowany PostgreSQL / SQL / ACL/RLS | **34 PASS**;41 historycznych migracji + nowa42. Auth/Storage to minimalne schematy testowe, nie GoTrue |
| Edge transport | **10 PASS**: realny handler na kontrolowanym fetch/RPC, aktor/sesja, query/paginacja, brak query na mutacjach, błędy/anon/temp password/stary SQL bez wersji; nie HTTP E2E |
| Pełny Vitest | **345 PASS /54 pliki**, w tym powyższe10; końcowy pełny przebieg po dodaniu fail-closed starego SQL |
| TypeScript aplikacji / strict Edge | PASS |
| ESLint | PASS po użyciu argumentu w nowym mocku i ponowieniu lintu |
| LIVE / Premium finance local / Android Stage3 web / demo |4 PASS, izolacja demo16 plików PASS |
| 55 plików prezentacji Premium | PASS źródłowego porównania, bez nowego renderu/screenshotów |
| verify:consolidation | **FAIL:42≠41**, istniejący kontrakt nie dopuszcza nowej migracji |
| verify-frozen-ui (pełny runtime) | **FAIL: Unexpected migration/model activation** po zaliczonym source55 |
| test:premium-policy | **FAIL:0/37 PASS**; nowa migracja zatrzymuje bazowy graf i preemptuje mutanty. Nie jest to dowód37 nowych regresji UI, ale nie deklarujemy zaliczenia tej kontroli |
| Stage3B verify_sources (readonly) | **FAIL: Unapproved checkout source: handler.ts**; poprzedni snapshot pozostaje zamrożony |
| Hosted CI / prawdziwy GoTrue→Edge→SQL HTTP / Chromium wyszukiwarki / POCO | NOT RUN; UI niezaimplementowane, kontrakty i integracja wymagają zatwierdzenia |

SQL obejmuje domyślne/public/groups i obcy group_id, dwie własne grupy, nowego
użytkownika bez grup, nazwy meczu i grupy, polskie litery, literalne wildcardy,
walidację, brak wyników, >100 pasujących publicznych przy120 obcych prywatnych,
stabilne strony i offsety, guest/reserve counts, deny innego scope/sesji/ACL,
brak ujawnienia grup/profili/finansów/składów i automatycznego członkostwa.
Istniejące zapisy odrzucają pełny/zakończony/anulowany mecz; własna historia po
odejściu z grupy pozostaje. SQL porównuje definicje Auth/grup/finansów/składów
przed/po migracji, a odwrócenie wyłącznie nowego bloku list odtwarza dokładnie
stary core. Ledger nie zmienia się wskutek odczytów.

Runner `test-public-discovery-local.py` ma własny jawny zakres tej funkcji:
dokładna baza/gałąź, lokalny socket, nie-CI, historyczne41 bez zmian i tylko
oczekiwany nowy krok. Nie uruchamia pod fałszywą gałęzią starych runnerów Stage3B.
Tworzy nowy unikalny network-none kontener bez portów/mountów, używa przypiętego
obrazu i zatrzymuje/zachowuje własną fixture. Nowszych testów nie włączono do CI
przez ominięcie kontroli źródeł. Dwa nowe kontenery testów zatrzymane i zachowane:
`slm-public-discovery-fe087aafe8f7` (pierwsze29 kontroli) i
`slm-public-discovery-e9141f0e2d20` (końcowe34). Nie migrowano żadnej istniejącej
bazy i nie łączono się z Cloud. Początkowy mock Edge nie zawierał sub w JWT;
poprawiono wyłącznie test, bez zmiany Auth.

## Ograniczenia i następny krok

UI i strażniki/CI/approval JSON pozostały bajtowo niezmienione. Nowa migracja
oraz handler celowo nie są automatycznie dopisane do kontraktu — użytkownik
zakazał takiego aktualizowania przypięć. **Nie scalać tej gałęzi z czerwonymi
guardami i nie traktować PASS testów backendu jako akceptacji całego modułu.**

Potrzebne: zatwierdzenie powyższego projektu UI i osobny review rozszerzenia
backendowego kontraktu źródeł41→42/handlera oraz przyszłego snapshotu CI.
Dopiero potem podłączenie UI i rzeczywisty lokalny HTTP/UI odbiór na zgodnym,
osobno uzgodnionym backendzie. Deploy/migracje istniejących baz/Cloud/telefon
nie zostały wykonane. Wynik publikacji i prób DraftPR zapisuje dziennik
`docs/ODPOWIEDZI_CODEX.txt`; bazą zależnego PR jest gałąź Stage3B.

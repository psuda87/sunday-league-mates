# Premium — rzeczywiste rozliczenia, etap 2

2026-10-28, Europe/Warsaw. Gałąź `feat/premium-real-finance-stage2` od aktualnego HEAD PR20 **448a2967489040162bfc6653c197af9afe9dcb55**. Docelowa baza zależnego Draft PR: `feat/premium-real-events-stage1`, nie `main`. Zweryfikowane refs PR18: `845d35e1bc644be5935d3658ed1e3a57cd74b518`, PR19: `54c2241e6df40c977c89b665aeade0ee5a4b9abc`; ich gałęzie pozostały niezmienione.

## Stan i granice odbioru

**Aktualizacja lokalna28.10.2026: P0 przeszedł rzeczywisty Supabase Auth/Edge/PostgREST i Chrome dwóch kont.** 28 kontroli HTTP,102 SQL/RLS i3 scenariusze rzeczywistej przeglądarki PASS;327 Vitest/54 pliki. To gotowość do osobno zatwierdzonego odbioru POCO, nie gotowość Cloud/produkcji. P1 nie rozpoczęto. Historyczny wynik Cloud oraz dokładny nowy dowód opisano osobno poniżej.

Supabase Cloud, istniejące bazy i konta, Auth, 44 kanoniczne migracje, Edge Functions, RLS, algorytm finansowy, Firebase, konfiguracja Androida i wdrożeń **bez zmian**. Nowego modelu Auth nie aktywowano. Brak deploy, merge, synchronizacji Capacitor, budowy i instalacji APK.

## Podłączone funkcje i źródła danych

| Funkcja | Istniejąca operacja przez `SessionManager.call` |
|---|---|
| Wybór grupy finansowej, także historycznego kontekstu należności | `finance_groups` |
| Własne saldo grupowe, należności, statusy, historia, blokada | `group_finance_account` bez `user_id` |
| Administracyjny odczyt konta wybranego płatnika | `group_finance_account` z ID wybranym z listy płatników meczu; backend sprawdza administratora grupy |
| Wstępne i zatwierdzone należności poszczególnych udziałów | `group_finance_detail` dla uprawnionego zarządzającego meczem |
| Oczekujące zgłoszenia wpłat administratora grupy | `group_finance_pending` |
| Oczekujące zgłoszenia w zakresie organizatora meczu | `payments` z `group_finance_detail` |
| Nazwy płatników według istniejącej projekcji prywatności | `groups_detail`; brak katalogu użytkowników lub administracyjnego endpointu kont |
| Zgłoszenie własnej wpłaty | `group_finance_submit_payment` |
| Ręczne potwierdzenie otrzymanej kwoty | `group_finance_record_payment` |
| Akceptacja / odrzucenie konkretnego zgłoszenia | `group_finance_accept_payment` / `group_finance_reject_payment`, `payment_id` i `expected_amount_cents` |
| Zatwierdzenie zakończonego meczu | `group_finance_approve`, `expected_version`, powód; czas zakończenia sprawdza serwer |
| Odświeżenie blokady w otwartych szczegółach po zapisie finansowym | `matches_detail`, bez resetu aktywnej zakładki |

Wejście: **Mecze → Moje rozliczenia grupowe** oraz **szczegóły meczu → Rozliczenie**. Zwykły zawodnik widzi własny zakres. Panel zarządzania korzysta z uprawnień istniejącego event DTO i serwerowej projekcji `surplus`; nie ma przełącznika roli demo. Organizator nie otrzymuje dostępu do całej historii finansowej innych członków tylko dlatego, że prowadzi jeden mecz. Serwer pozostaje ostateczną warstwą autoryzacji każdej operacji.

Brak lokalnego wyliczania naliczeń. UI sumuje wyłącznie kwoty zwrócone przez serwer, formatuje grosze i przyjmuje dodatnią kwotę wpłaty. Zgłoszenie wpłaty nie zmienia salda przed akceptacją. Udany zapis wymaga poprawnego potwierdzenia `ok/group_id` i ponownego odczytu danych. Są stany loading, pusty, error, retry oraz blokada wielokrotnego kliknięcia. Brak zastępowania błędu API fixture lub przykładowym saldem.

## Zachowane zasady finansowe

- Każda grupa ma własne saldo, ledger i FIFO; globalna pozostaje tylko kwalifikacja blokady nowych płatnych zapisów po dwóch zaległych meczach.
- Własny udział i goście obciążają jednego płatnika i liczą się jako **jeden mecz** do blokady. Kwoty pochodzą z serwera, nie z demo reducera.
- Dotychczasowy kontrakt SLM 1.0 zaokrągla udziały w górę do pełnej złotówki i osobno śledzi nadwyżkę naliczoną/otrzymaną. Nie przywracano starszego podziału reszty groszy z historycznych promptów.
- Niezakończony lub niezatwierdzony mecz nie tworzy kwalifikującej się zaległości. Reguły 17:00 Europe/Warsaw, zastępstwa, braku automatycznej promocji rezerwy, odwołań, historii i korekt pozostają w istniejącym backendzie.
- Saldo dodatnie oznacza nadpłatę, ujemne zadłużenie. Pozycja po odwróceniu naliczenia z należnością zero ma opis „Brak należności”, zamiast sugerować otrzymanie wpłaty.
- Nie dodano integracji bankowych, nowych korekt finansowych, klientowego FIFO ani bezpośrednich zapisów tabel z klienta.

## Izolacja, retry i współbieżność

DTO jest walidowane przed pokazaniem kwot: zgodność użytkownika/grupy/meczu, całkowite bezpieczne grosze, statusy i zakres historii/wpłat. Zmiana grupy lub sesji od razu maskuje poprzednie dane; opóźniona odpowiedź nie może nadpisać nowego zakresu. Przy ponownym sprawdzaniu sesji dane są czyszczone, a po potwierdzeniu odczytywane od nowa.

Zapis używa istniejącego `request_id` UUID, `payment_id`, `expected_amount_cents` i `expected_version`. Ten sam niepewny zamiar zachowuje UUID po utracie odpowiedzi, błędzie odczytu po zapisie i wyjściu/powrocie do widoku w tej samej sesji RAM. UI nie wyświetla sukcesu na podstawie samego lokalnego stanu. Test modelu potwierdza single-flight; test SQL sprawdza równoległe decyzje i pojedynczy wpis ledgera. Serwer nadal sprawdza rolę i scope, także przy ręcznie podmienionych identyfikatorach.

**Ograniczenie:** rejestr niepewnych zamiarów znajduje się w RAM i nie przetrwa pełnego restartu aplikacji/przeglądarki. Nie wprowadzono trwałego magazynu operacji ani zmian przechowywania sesji. Po restarcie z niepewnym wynikiem należy najpierw sprawdzić historię, zanim zarejestruje się nową ręczną wpłatę. Taka sama kwota nie jest kluczem deduplikacji; dwie celowo odrębne wpłaty mogą mieć tę samą wartość. Wylogowanie czyści rejestr.

## Ograniczenia / historyczne blokery Cloud

1. **ROZWIĄZANE LOKALNIE28.10 — historyczny brak Supabase/HTTP/Chrome dwóch kont:** Docker w Cloud używa `vfs` na systemie plików ok. 32 GB. Rozpakowanie obrazów lokalnego Supabase PG17 oraz alternatywy PG15 kończyło się `no space left on device`, zanim wystartował kompletny stos. Nie zmieniano sterownika Dockera ani istniejących baz. Usunięto wyłącznie nieużywane obrazy pobrane w tych próbach, nie wolumeny lub bazy. Nie użyto Cloud jako obejścia. Potrzebny działający izolowany pełny lokalny Supabase na komputerze lub pojemniejszym środowisku.
2. **Rozbicie zastosowanych wpłat na własny udział i każdego gościa:** istniejące własne DTO zwraca należność łączną płatnika za mecz. Własny widok uczciwie prezentuje tę sumę i odpowiedzialność za gości. Administrator widzi osobne udziały z podziału serwera. Nie stworzono fikcyjnego rozdziału wpłat pomiędzy gości.
3. **Własny wstępny podział przed zatwierdzeniem:** istniejący szczegół finansowy jest zastrzeżony dla zarządzającego; zwykłe konto pokazuje zatwierdzone należności i komunikat o niedostępnym wstępnym podziale. Nie rozszerzono RLS/API.
4. **Zgłoszenie osoby spoza aktualnej listy członków:** gdy `groups_detail` nie daje bezpiecznej nazwy płatnika historycznego zgłoszenia, UI pokazuje wymaganie weryfikacji i blokuje decyzję, zamiast wymyślać tożsamość. Potrzebna późniejsza uzgodniona bezpieczna projekcja identyfikacyjna; istniejący LIVE nie został usunięty.
5. **P1 — administracja meczem:** cały zakres odłożony po P0. Istniejące operacje edycji, obecności i gości w starszym LIVE pozostają. Premium nie otrzymał pozornie zapisujących pól. Pełny odczyt adresu pozostaje znanym ograniczeniem DTO z etapu1. Nie dodano migracji dla jego obejścia.
6. **ROZWIĄZANE LOKALNIE28.10 — historyczny brak późnej rezygnacji/FIFO po 17:00:** konkretny scenariusz istniejącego runnera został pominięty z powodu rzeczywistej godziny serwera. Nie fałszowano zegara RPC i nie przypisano mu PASS.

## Historyczne wyniki kontroli Cloud — nie zastępują aktualizacji lokalnej poniżej

| Kontrola | Faktyczny wynik / granica |
|---|---|
| TypeScript `npx tsc --noEmit` | PASS |
| Pełny ESLint `npm run lint -- .` | PASS, bez ostrzeżeń po usunięciu tymczasowego harnessu |
| Pełny Vitest | **326 PASS / 54 pliki**; po końcowych walidacjach ACK/statusu zero ponowiono zmieniony zakres: **17 PASS / 2 pliki** |
| `npm run build` | PASS; istniejące ostrzeżenie o wielkości chunków |
| `npm run build:premium-local` | PASS |
| `npm run build:demo` i izolacja | PASS; 16 plików statycznych, bez modułów produkcyjnego Auth/Supabase/Edge |
| `node scripts/verify-frozen-ui.mjs` | PASS, 55 chronionych plików; istniejący globalny CSS/Ultimate/nawigacja bez zmian |
| Nowa izolowana fixture PostgreSQL, replay 44 niezmienionych migracji | **101 PASS** istniejących scenariuszy v2/RLS/finansów; schema Auth/JWT/Storage to fixture, nie GoTrue/HTTP/Edge |
| SQL: saldo, goście, dwie grupy, niedozwolone działania, częściowe/nadpłaty/FIFO, równoległe potwierdzenia, odwołanie/historia | PASS w powyższym zakresie SQL; **jeden późny scenariusz cutoff FIFO NOT TESTED** |
| Chromium, prawdziwy render React/Ionic z kontrolowanym adapterem UI | PASS: 320/390/768, Dark/Light, brak poziomego overflow, kontrolki >=44 px; członek → administrator akceptuje → członek widzi odczytany status/blokadę |
| Dwa rzeczywiste konta przez pełny Auth/Edge/HTTP i Chrome | **BLOCKED**, brak pełnego stosu; test UI z adapterem nie zastępuje tego odbioru |
| Fizyczny Android / klawiatura / tło i wznowienie | **NOT TESTED**, brak APK/sync/instalacji |

Vitest sprawdza dodatkowo DTO obcej grupy, zwykłego członka bez administracyjnych odczytów, retry z tym samym UUID także po błędzie odczytu i remount, aktualizację własnego udziału z dwoma gośćmi, decyzję administratora oraz odrzucanie spóźnionej odpowiedzi poprzedniej grupy. Testy backendu nie zostały zastąpione samymi atrapami interfejsu.

### Powtórzenie kontroli

Z `app/`:

```sh
npm_config_cache=/tmp/slm-npm-cache npm ci --ignore-scripts --no-audit --no-fund
npx tsc --noEmit
npm run lint -- .
npm run test.unit -- --run
npm run build
npm run build:premium-local
npm run build:demo
node scripts/verify-frozen-ui.mjs
python3 scripts/test-premium-finance-sql-local.py
node scripts/test-premium-finance-browser.mjs
```

SQL runner wymaga gałęzi etapu2 i lokalnego socketu Docker. Tworzy **nowy** PostgreSQL `postgres:17-alpine`, `--network none`, bez publikowania portów; nie resetuje, nie usuwa i nie podłącza istniejącej bazy. Wykonana fixture: `slm-finance-sql-ccfaa38cd93f`, pozostawiona do inspekcji. Kandydat Auth w niej nadal `active=false`. Każde uruchomienie tworzy osobną fixture, więc nie należy powtarzać go bez potrzeby. Runner przeglądarki sam uruchamia i zamyka własny Vite/Chromium, korzysta z ignorowanego katalogu `app/.cache/finance-ui`, bez dostępu do Supabase. Zachowano dotychczasowe package.json i lock; `npm ci` naprawiło niespójne zależności środowiska, bez aktualizacji wersji projektu.

### Zrzuty — wyłącznie test interfejsu z fikcyjnym adapterem

- [Własne należności i blokada](ui/premium-finance-stage2/user-fixture-dark.png).
- [Odczyt po decyzji administratora](ui/premium-finance-stage2/user-fixture-paid.png).

To rzeczywiste rendery React/Ionic z jawnie oznaczonymi danymi testowymi. Nie przedstawiają realnego połączenia z Supabase i nie potwierdzają E2E produkcyjnego backendu.

## Zmienione pliki

- Integracja: `app/src/events/PremiumWorld.tsx`, `PremiumEvents.tsx`, `usePremiumEvents.ts`.
- Nowy moduł: `app/src/finance/contracts.ts`, `usePremiumFinance.ts`, `PremiumFinance.tsx`, `PremiumGroupFinance.tsx`, `premiumFinance.css`, `finance.test.tsx`.
- Odtwarzalne kontrole: `app/scripts/test-premium-finance-sql-local.py`, `test-premium-finance-browser.mjs`.
- Dokumenty: ten raport, `docs/STATUS.md`, `docs/ODPOWIEDZI_CODEX.txt`, `docs/PREMIUM_REAL_DATA_AUDIT.md`.
- Dwa powyższe zrzuty `docs/ui/premium-finance-stage2/`.

## Co pozostaje demonstracyjne / poza wersją 1.0 tego pionu

Samodzielny build demo zachowuje swój fikcyjny stan i nie jest źródłem danych nowych widoków finansowych Premium. Składy, oceny i rozbudowane statystyki nie zostały podłączone do rzeczywistego backendu; nie pokazujemy ich jako prawdziwych wyników. Push, nowy Auth i konfiguracja online mają wcześniejsze osobne blokery. Nie dodano żadnego nowego modułu.

## Historyczna instrukcja przekazania z Cloud

Uruchomić **pełny izolowany lokalny Supabase** z tą samą gałęzią, bez aktywacji nowego Auth i bez resetu istniejących baz. Dwa fikcyjne konta: zawodnik zapisuje siebie i gości, zakończony mecz zostaje zatwierdzony, administrator odczytuje należność i potwierdza wpłatę, zawodnik widzi nowy status i blokadę. Powtórzyć po utracie odpowiedzi, równoległej decyzji oraz z administratorem obcej grupy. Sprawdzić późną rezygnację po 17:00, zastępstwo, odwołanie i niezmienność historii. To najkrótszy brakujący odbiór P0; nie należy rozpoczynać przebudowy backendu, aby ominąć środowisko Cloud.

Na fizycznym Androidzie po osobnej zgodzie na APK: pola kwoty i powodu przy IME, przewijanie ponad BottomNav, systemowy wstecz, Dark/Light, przejście tło/wznowienie i sprawdzenie sesji, brak poprzednich danych po zmianie konta, powrót do aktywnej zakładki po wpłacie. Nie wykonywano instalacji na POCO.

## Historyczna próba Git i Draft PR w Cloud — 2026-10-28 16:56 Europe/Warsaw

Commit implementacji **`b46689a02d17d5eb6fccc5e3f4d9ed007480640d`** został zwykłym pushem zapisany na `origin/feat/premium-real-finance-stage2`; `git ls-remote` potwierdził dokładny SHA. Bazowa gałąź PR20 nadal ma `448a2967489040162bfc6653c197af9afe9dcb55`. Worktree po zapisie implementacji był czysty.

**Draft PR nie został utworzony.** Odczyt PR20 oraz żądanie `POST /repos/psuda87/sunday-league-mates/pulls` z `draft=true`, właściwym head i bazą etapu1 zostały odrzucone przez API: `Forbidden`. Zwykły Git fetch/push działa; uprawnienie do push nie zapewniło tutaj dostępu do REST API. Nie obchodzono ograniczenia ani nie pobierano tokenów z konfiguracji. Nie ma numeru PR, który można uczciwie podać.

[Przygotowane porównanie gałęzi do utworzenia Draft PR](https://github.com/psuda87/sunday-league-mates/compare/feat/premium-real-events-stage1...feat/premium-real-finance-stage2?expand=1). Baza: `feat/premium-real-events-stage1`; head: `feat/premium-real-finance-stage2`; wybrać **Create draft pull request**. Tytuł: „Premium: rzeczywiste rozliczenia grup i decyzje o wpłatach (etap 2)”. Opis: zakres P0 i tabela kontroli z tego raportu, z jawnym BLOCKED pełnego E2E i brakiem zmian backendu. Nie tworzyć PR bezpośrednio do main.

Końcowa aktualizacja dokumentacji ma oddzielny commit po powyższym SHA implementacji. Bez merge i ręcznego wdrożenia. Fixture PostgreSQL została zatrzymana (`docker stop` własnego kontenera), lecz jej baza/kontener/wolumen pozostały do inspekcji. Cypress z pełnym backendem nie został wykonany — pełny stos jest zablokowany; wskazany test Chromium używa kontrolowanego adaptera UI.

## Lokalny odbiór Windows — 2026-10-28, aktualny status

Zdalną gałąź pobrano bez nadpisywania zmian: HEAD początkowy427adce, kod modułu b46689a. Nowy worktree `.worktrees/premium-real-finance`; wszystkie6 lokalnych zmian ui-beta i pozostałe worktree zachowane. PR18/845d35e → main134c52b; PR19/54c2241 i PR20/448a296 nadal Draft. Stage2 jest potomkiem PR20 i ma otrzymać osobny Draft PR z bazą `feat/premium-real-events-stage1`. Nie zmieniano wcześniejszych PR.

### Środowisko i rzeczywisty przepływ

Docker29.8.2 i Node24.14.0 działają; użyto przypiętego CLI2.121.0 i niezmienionego lockfile. Wolne miejsce na starcie: C≈1414GB, I≈98GB; obrazy Dockera≈8.5GB. Nie usuwano starych obrazów, kontenerów lub danych. Istniejący restartujący się Vector pozostawiono bez zmian.

Nowy izolowany projekt **slm-premium-real-finance**: API64321,DB64322,Mailpit64324,UI5186. Wszystkie44 kanoniczne migracje zastosowane od zera, bez seedów. Lokalny entrypoint jest generowany w ignorowanym cache z handlera tej gałęzi, nie jest źródłem produkcyjnym/deploy. Dotychczasowy Auth obsługuje nowe fikcyjne konta przez rzeczywisty GoTrue; kandydat Auth pozostaje active=false i capabilities=false przed/po testach. Dostosowano tylko baseline nowego kontenera Auth, poprzedni kontener zachowano. Dawne instancje54321–63321, dane i POCO nietknięte.

Test HTTP naprawdę wykonał: zawodnik i2 gości → naliczenie3 ×34zł przy koszcie100zł → zgłoszenie/odrzucenie → częściowe40zł → akceptacja → równoczesne przyjęcie pozostałych62zł → saldo0 → ręczna nadpłata15zł. Sprawdzono niezależne zadłużenia grup A/B, dwie kwalifikujące zaległości, odblokowanie po wpłacie, wolny mecz i dozwoloną rezygnację mimo blokady, próby obcego admina/owner spoof/bezpośrednie REST/RPC oraz odwołanie z korektą należności i zachowaniem historii/wpłat.

**Jawna temporalna konfiguracja fixture:** mecz tworzony i obsadzany jest przez API jako przyszły; aby nie czekać kilku godzin, tylko jego nowy testowy rekord z kontrolowanym UUID/created_by otrzymuje datę3h wstecz. Następnie zatwierdzenie i wszystkie pieniądze przechodzą przez prawdziwe API. Nie zmieniano zegara, funkcji ani reguł serwera. To nie fałszywy dowód upływu czasu. Osobny mecz bieżącego dnia23:59 sprawdził po rzeczywistej17:00 zachowanie odpowiedzialności i dwa kolejne zastępstwa FIFO, bez przesuwania jego daty lub zegara.

### Rzeczywiste problemy i poprawki

- **RAM po logout:** odtworzono testem, że zamknięcie ekranu przed wylogowaniem usuwało jego listener, więc registry niepewnego UUID mogło przetrwać logout/logowanie tej samej osoby. Poprawiono wyłącznie kontroler Finance: jeden obserwator danych przypisany do życia SessionManager czyści mapę także przy niezamontowanym ekranie, błędzie storage i zmianie właściciela. Nie modyfikuje Auth. Nie czyści zamiaru przy chwilowym network/unavailable, co zachowuje poprawny retry po potwierdzeniu sesji. Nowy test najpierw FAIL, po poprawce PASS; wcześniejszy test remount/retry zachowany.
- **Windows UTF-8:** SQL runner z Cloud czytał źródła kodowaniem systemowym cp1252. Jawne encoding=utf8 naprawiło uruchamianie; kanoniczny SQL niezmieniony.
- **Oczekiwanie testu sieci:** prawdziwy SessionManager ukrywa cały prywatny świat po awarii, zamiast pozostawić lokalny alert w Finance. Test dostosowano do istniejącego bezpiecznego zachowania: ekran Brak połączenia → serwerowy refresh → ponowne otwarcie → to samo UUID i dokładnie jeden zapis. Nie osłabiano ochrony, limitów lub walidacji.

Nie znaleziono potrzeby zmiany SQL/RLS/Edge lub naliczania. Nie implementowano nowego modułu ani P1. Globalny CSS, Ultimate, BottomNav, zasoby, konfiguracja Androida i Auth pozostają bez zmian.

### Końcowe wyniki lokalne

| Kontrola | Wynik faktycznie wykonany |
|---|---|
| TypeScript / ESLint / strict Edge | PASS, lint bez ostrzeżeń |
| Pełny Vitest po poprawce | **327 PASS /54 pliki** |
| Celowany zakres Finance/Events | **18 PASS /2 pliki** po poprawce RAM |
| Build main / Premium / demo / local finance | PASS; demo16 izolowanych artefaktów |
| Frozen UI / chronione źródła | 55 plików Premium i32 starsze migracje PASS;44 źródłowe migracje bez zmiany |
| PostgreSQL/RLS/finanse, osobna retained fixture | **102 PASS**,44 migracje, w tym późny cutoff; Auth/JWT/Storage w tym konkretnym zestawie są fixture |
| Rzeczywisty Supabase Auth/Edge/PostgREST/REST/RPC | **28 PASS**,4 niezależne konta,2 grupy, częściowe/nadpłaty/CAS/retry/blokada/FIFO/role/historia |
| Chrome → Premium → prawdziwy backend po poprawce | **3 PASS**: admin zatwierdza, zawodnik zgłasza z awarią i retry, admin akceptuje, zawodnik widzi saldo0; zmiana konta/grupy i błąd odczytu |
| Odczyt serwera po Chrome | **2 PASS**: należność pokryta, saldo0, dokładnie2 przyjęte wpłaty; utracona odpowiedź nie tworzy trzeciej |
| Light/Dark / rozmiary | 320/360/390px, fokus kwoty,420px wysokości, przewijanie i BottomNav PASS w Chrome |
| Sekrety/składnia/diff | Skan511 ścieżek bez rozpoznawalnych sekretów, Node syntax i diff check PASS; nie pełny audyt historii/PII |
| POCO / fizyczna klawiatura / natywne tło | NOT TESTED, bez sync/APK/instalacji |
| Cloud/SMTP/DNS/push | Nietknięte, nieobjęte tym odbiorem |

Przy awarii zapisu test Chrome przepuszcza żądanie do prawdziwego Edge i opóźnia tylko odpowiedź już zatwierdzoną przez serwer25s, dłużej niż timeout klienta20s. Porównuje UUID ponowienia i końcową liczbę wpłat. Awaria odczytu jest wyłącznie błędem transportu, bez podstawiania JSON lub salda. Nie wykorzystuje kontrolowanego adaptera finansowego.

Sprawdzone przez agenta zrzuty rzeczywistej lokalnej aplikacji zawierają wyłącznie fikcyjne konta/rekordy testowe:

- [Rzeczywista należność Dark](https://github.com/psuda87/sunday-league-mates/blob/feat/premium-real-finance-stage2/docs/ui/premium-finance-stage2/real-backend/premium-finance-real.cy.ts/user-real-debt-dark.png).
- [Rzeczywiste saldo po akceptacji Light](https://github.com/psuda87/sunday-league-mates/blob/feat/premium-real-finance-stage2/docs/ui/premium-finance-stage2/real-backend/premium-finance-real.cy.ts/user-real-paid-light.png).

### Odtworzenie i odbiór telefonu

Z root: `python app/scripts/prepare-premium-finance-local.py`, lokalny CLI start z `--workdir .cache/premium-finance-stack`, następnie helper `--auth-baseline` i functions serve accounts z tym workdir. Helper wymaga dokładnego brancha stage2, lokalnego socketu i nowej etykiety kontenera. Nie uruchamia resetu i nie łączy się z Cloud. Wszystkie wygenerowane dane/klucze pozostają ignorowane. Z app: `npx vite --config vite.premium-finance-local.config.ts`, build testowy `npm run build:premium-finance-local`. Domyślny endpoint APK nie został przełączony.

API z root: `node app/scripts/test-premium-finance-http-local.mjs`. Dodatkowo SLM_FINANCE_BROWSER=1 uruchamia pełny pion przeglądarki; SLM_FINANCE_BROWSER_ONLY=1 pozwala powtórzyć sam Chrome na nowych fikcyjnych kontach bez całego API suite. Dane logowania trafiają stdin i cy.env z log:false, nigdy do polecenia/repo/logu. Z app: istniejący `python scripts/test-premium-finance-sql-local.py` tworzy i zachowuje osobną fixture; wymaga jawnego UTF-8. Nie kasować danych testów ani starych baz dla zielonego wyniku.

Stage2 nadaje się do **przygotowania odbioru POCO po osobnej zgodzie na APK**: zawodnik/admin, własny udział+goście, zgłoszenie/akceptacja/częściowa wpłata, restart i sprawdzenie historii, Dark/Light, IME/kwoty/przewijanie, Wstecz/tło i brak starego konta po logout. Faktycznej klawiatury, vaultu i natywnego wznowienia nie potwierdza Chrome. Nie zbudowano ani nie zainstalowano APK.

Pozostałe ograniczenia2–5 z sekcji historycznej nadal obowiązują: własny podział przed zatwierdzeniem, rozbicie wpłat na poszczególnych gości, nazwy płatników historycznych poza grupą i P1. Rejestr niepewnych zamiarów nadal wyłącznie RAM; po restarcie przed nowym wpisem sprawdzić historię. Sześć moderate zależności i cztery stare SQL warnings wcześniejszego audytu nie zostały tym zadaniem usunięte. Nie deklarujemy gotowości Cloud/produkcji.

### Decyzje podjęte samodzielnie

- Wykorzystano gotowy moduł i istniejące RPC; nowy helper/test transportu zamiast przebudowy backendu.
- Nowa instancja64321 zamiast ponownego użycia bazy stage1; zachowano wszystkie stare dane i nowe fikcyjne rekordy.
- Symulacja zakończenia wyłącznie przez datę własnego fixture; późne17:00 sprawdzone dodatkowo na rzeczywistym zegarze.
- Czyszczenie niepewnych UUID obserwuje sesję także po wyjściu z widoku; nie zmienia sposobu logowania ani trwałości tokenów.
- Błąd sieci sprawdzany zgodnie z pełną bramką SessionManager, bez pozostawiania danych na ekranie dla wygody testu.

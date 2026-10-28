# Premium — rzeczywiste rozliczenia, etap 2

2026-10-28, Europe/Warsaw. Gałąź `feat/premium-real-finance-stage2` od aktualnego HEAD PR20 **448a2967489040162bfc6653c197af9afe9dcb55**. Docelowa baza zależnego Draft PR: `feat/premium-real-events-stage1`, nie `main`. Zweryfikowane refs PR18: `845d35e1bc644be5935d3658ed1e3a57cd74b518`, PR19: `54c2241e6df40c977c89b665aeade0ee5a4b9abc`; ich gałęzie pozostały niezmienione.

## Stan i granice odbioru

**P0: zaimplementowano binding istniejącego rzeczywistego API w Premium. Pełny odbiór przez lokalny Supabase Auth/Edge/HTTP: BLOCKED.** Nie deklarujemy wykonania kryterium dwóch rzeczywistych kont przez przeglądarkę ani gotowości produkcyjnej. PostgreSQL/RLS i interfejs przetestowano oddzielnie, zgodnie z tabelą poniżej. P1 nie rozpoczęto: bez połowicznego formularza administracji meczem.

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

## BLOCKED i niewykonane elementy

1. **Pełny Supabase/HTTP/Chrome dwóch kont:** Docker w Cloud używa `vfs` na systemie plików ok. 32 GB. Rozpakowanie obrazów lokalnego Supabase PG17 oraz alternatywy PG15 kończyło się `no space left on device`, zanim wystartował kompletny stos. Nie zmieniano sterownika Dockera ani istniejących baz. Usunięto wyłącznie nieużywane obrazy pobrane w tych próbach, nie wolumeny lub bazy. Nie użyto Cloud jako obejścia. Potrzebny działający izolowany pełny lokalny Supabase na komputerze lub pojemniejszym środowisku.
2. **Rozbicie zastosowanych wpłat na własny udział i każdego gościa:** istniejące własne DTO zwraca należność łączną płatnika za mecz. Własny widok uczciwie prezentuje tę sumę i odpowiedzialność za gości. Administrator widzi osobne udziały z podziału serwera. Nie stworzono fikcyjnego rozdziału wpłat pomiędzy gości.
3. **Własny wstępny podział przed zatwierdzeniem:** istniejący szczegół finansowy jest zastrzeżony dla zarządzającego; zwykłe konto pokazuje zatwierdzone należności i komunikat o niedostępnym wstępnym podziale. Nie rozszerzono RLS/API.
4. **Zgłoszenie osoby spoza aktualnej listy członków:** gdy `groups_detail` nie daje bezpiecznej nazwy płatnika historycznego zgłoszenia, UI pokazuje wymaganie weryfikacji i blokuje decyzję, zamiast wymyślać tożsamość. Potrzebna późniejsza uzgodniona bezpieczna projekcja identyfikacyjna; istniejący LIVE nie został usunięty.
5. **P1 — administracja meczem:** cały zakres odłożony po P0. Istniejące operacje edycji, obecności i gości w starszym LIVE pozostają. Premium nie otrzymał pozornie zapisujących pól. Pełny odczyt adresu pozostaje znanym ograniczeniem DTO z etapu1. Nie dodano migracji dla jego obejścia.
6. **Późna rezygnacja/FIFO po 17:00:** konkretny scenariusz istniejącego runnera został pominięty z powodu rzeczywistej godziny serwera. Nie fałszowano zegara RPC i nie przypisano mu PASS.

## Wyniki kontroli

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

## Odbiór i najmniejszy następny krok

Uruchomić **pełny izolowany lokalny Supabase** z tą samą gałęzią, bez aktywacji nowego Auth i bez resetu istniejących baz. Dwa fikcyjne konta: zawodnik zapisuje siebie i gości, zakończony mecz zostaje zatwierdzony, administrator odczytuje należność i potwierdza wpłatę, zawodnik widzi nowy status i blokadę. Powtórzyć po utracie odpowiedzi, równoległej decyzji oraz z administratorem obcej grupy. Sprawdzić późną rezygnację po 17:00, zastępstwo, odwołanie i niezmienność historii. To najkrótszy brakujący odbiór P0; nie należy rozpoczynać przebudowy backendu, aby ominąć środowisko Cloud.

Na fizycznym Androidzie po osobnej zgodzie na APK: pola kwoty i powodu przy IME, przewijanie ponad BottomNav, systemowy wstecz, Dark/Light, przejście tło/wznowienie i sprawdzenie sesji, brak poprzednich danych po zmianie konta, powrót do aktywnej zakładki po wpłacie. Nie wykonywano instalacji na POCO.

Stan Git/PR i SHA zostaną dopisane po zapisaniu implementacji; bez merge i ręcznego wdrożenia.

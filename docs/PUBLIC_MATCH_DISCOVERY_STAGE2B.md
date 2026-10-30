# Public Match Discovery — Etap 2B

30.10.2026, lokalny Windows. **PASS funkcjonalny i bezpieczeństwa; WARN ograniczeń; BLOCK aktywacji CI do osobnego review.** Bez zgody na merge/deploy. Gałąź `feat/public-match-discovery-stage2b` od zweryfikowanego aktualnego HEAD audytu `ddd3a3e2eaefdf449bc83c34c6335f42a2da4aab` (zawiera wskazany `a62e211`). Bazowy Stage3B: `e04d9a47560de36657da76f12ae63e20ef2299cb`.

## Zakres i przypięcia do akceptacji właściciela

Backend pozostaje dokładnie `24a59e104bfe80b4d2f41cbd0ad02b58fc546040`: migracja42 i handler nie zostały ponownie zaimplementowane ani poprawiane. Wszystkie wcześniejsze41 migracji identyczne. Cały manifest oraz55 chronionych plików wyglądu zachowane. Bez zmian CSS, kart, nagłówka, menu, Auth, finansów, składów i platform natywnych.

| Aktywna zmiana kontraktu | Dokładny zakres |
|---|---|
| `premium-route-policy.mjs`: `DISCOVERY_SOURCE` | `24a59e1`, wyłącznie `20261030090000_public_match_discovery.sql` i cały `accounts/handler.ts` |
| `premium-route-policy.mjs`: `DISCOVERY_UI` | `ae2fd9550b3688f80bfc69d811eb2423743b8329`, wyłącznie `PremiumEvents.tsx`, `usePremiumEvents.ts`, `premiumContracts.ts` |
| `verify-consolidation.mjs` | dokładny zbiór41 historycznych plików z e04d9a4 + dokładnie42 z24a59e1; dodatkowa43 lub zmieniona historia odrzucane |
| `verify-premium-policy-cases.mjs` | stare37 przypadków zachowane,8 nowych odmów:5 backendowych z audytu i3 klienckie |

**Te aktywne przypięcia i ich dokładne diffy wymagają końcowej akceptacji właściciela.** Aktywacja ograniczonego backendu nastąpiła na wyraźne polecenie tego zadania; nie jest to samodzielna zgoda na integrację. Runtime UI przedstawiono do review, bez aktualizacji manifestu55 lub wildcardów. Migracja składów nadal przypięta do Stage2A; inne wyjątki bez zmian.

- [Dokładny diff trzech plików runtime](review/public-discovery-stage2b-runtime.patch).
- [Dokładny diff aktywnych trzech strażników](review/public-discovery-stage2b-active-pins.patch).
- [SHA256 i lista źródeł](review/public-discovery-stage2b-sources.json). Końcowy commit kodu/testów/przypięć: `43f69a62c85dd354695f6fcb4531c85fb03651cf`. Raport i dowody publikowane osobnym commitem.

## Zachowanie klienta

Dotychczasowy selektor Mecze: Wszystkie→all, Moje grupy→groups, Publiczne→public. Zachowano Moje mecze/mine i poszczególne grupy/group. Tylko Publiczne pokazuje „Szukaj meczu lub grupy”, ze współdzielonym istniejącym stylem pola `.slm-player-search`. Pole nie tworzy nowego stylu Premium.

`matches_list` pozostaje jedynym API. Debounce300ms; zmiana zakresu, tekstu lub okresu zeruje stronę i unieważnia stare odpowiedzi. Zmiana zakresu uruchamia nowe żądanie bez oczekiwania na stare. Wyjście z Publiczne czyści query; nowy zakres usuwa mylącą etykietę zakładki Moje. Identyczne równoległe odświeżenia tej samej strony są łączone. Inne strony/zakresy mają osobną generację.

Nowe zakresy wymagają dokładnego `public_discovery_version===1`. DTO stron sprawdza offset, limit100, has_more i next_offset; niespójny kontrakt jest odrzucany. Stary backend zachowuje legacy feed, ale nowe opcje są wyłączone. W wersji1 klient renderuje stronę serwera bez lokalnego wyszukiwania, sortowania lub odsiewania niepełnej strony. Legacy zachowuje poprzedni filtr obronny. Paginacja używa has_more/next_offset, nie domysłu z długości nowej strony.

Selektor i pole pozostają zamontowane podczas ładowania/błędu; wyniki poprzedniej strony są ukryte. Błędy kontraktu mają retry. Rzeczywisty błąd sieci/503 uruchamia istniejący SessionManager: chroniony feed znika do potwierdzenia sesji, bez obejścia Auth. Logout, zmiana użytkownika i ponowna weryfikacja usuwają stan wyszukiwania i wyniki; spóźnione odpowiedzi nie przywracają danych.

## Faktycznie wykonane testy

| Kontrola | Wynik |
|---|---|
| Vitest pełny po ostatniej poprawce | **PASS361 /55 plików**, w tym9 nowych UI/controller |
| TypeScript app / strict Edge / ESLint | **PASS**; końcowy lint bez błędów |
| Premium policy | **PASS45**, stare37 +8 nowych negatywnych |
| Konsolidacja / visual / routing | **PASS42 dokładne migracje /55 chronionych plików /10 granic importu** |
| Nowa izolowana SQL fixture discovery | **PASS52**, w tym105 publicznych wyników,120 poprzedzających prywatnych, Unicode/literalne znaki, limity, sesje, ACL i stare regresje |
| Nowa izolowana SQL/RLS/PostgREST fixture składów | **PASS50**, transakcje/race/restart, istniejące testy finansów/profili/settlements/integration-contracts |
| Real GoTrue→Edge→PostgREST→PostgreSQL | **PASS11** dotychczasowych kontroli do restartu; dodatkowo8 kontroli HTTP discovery i osobna końcowa kontrola braku członkostwa |
| Chromium istniejących składów | **PASS14**, niezmienione asercje, CAS409/utrata odpowiedzi/retry/autor/profil/Light-Dark |
| Chromium nowego discovery | **PASS14**: realne query i strony100+5, brak prywatnego UUID, zmiana zakresu podczas opóźnionej realnej odpowiedzi, outsider bez grup, empty, SessionManager/retry, odmowa starego markera, Light/Dark i logout |
| Lokalne negatywne preflight | **PASS9**, bez fałszowania środowiska CI i bez uruchamiania Dockera |
| NIEAKTYWNA propozycja CI | **PASS32** kontroli pozytywnych/negatywnych i zachowania strażników; patch zastosowany wyłącznie w katalogu tymczasowym |
| Dotychczasowy zestaw launch-contract Stage3B | **20/23 PASS;3 błędy środowiskowe Windows**, opis poniżej |

**PASS wszystkich6 buildów:** `build`, `build:premium-local`, `build:live-local`, `build:premium-finance-local`, `build:android-stage3`, `build:demo` (izolacja16). **PASS Capacitor sync i natywny Gradle `assembleDebug --offline`**, 187 zadań, SDK/JBR z istniejącego Android Studio. Generowane ścieżki pluginów wskazujące inne worktree przez junction zależności przywrócono do przenośnych ścieżek z HEAD i ponownie sprawdzono Gradle. Źródła natywne nie wchodzą do zmian. Pozostają istniejące ostrzeżenia rozmiaru chunków/deprecations Gradle. Wszystkie wyniki pochodzą z tej sesji lokalnego Windows; nie są odziedziczonym raportem Cloud Codex ani hostowanego CI.

Opóźnienie odpowiedzi, usunięcie markera starego backendu i HTTP503 w Chromium są jawnymi wstrzyknięciami transportowymi nad prawdziwym API. Nie przedstawiamy ich jako awarii rzeczywistego serwera. Zrzuty mają wyłącznie syntetyczne konta i zdarzenia: [Light](ui/public-discovery-stage2b/public-light.png), [Dark](ui/public-discovery-stage2b/public-dark.png).

## Izolacja oraz granice

Wykorzystano wyłącznie NOWE fixture42 utworzone w tym zadaniu: SQL `slm-public-discovery-ca016cf3c49e`, składów `slm-lineups-stage2a-58080d6b1545`, GoTrue/Edge `slm-lineups-edge-76eb52906a7b` i `slm-lineups-edge-bcd60222dd8e` z pomocniczymi auth/rest/edge. Docker network-none lub współdzielenie tej samej przestrzeni, brak publikowanych portów. Bridge przeglądarki tylko loopback, zamknięty po testach. Kontenery zatrzymane i zachowane; żadnego resetu/drop/remove istniejących baz.

Pierwszy browser runner oczekiwał błędu wewnątrz feedu po503, podczas gdy SessionManager prawidłowo ukrywał feed. Poprawiono test. Następna próba wymagała korekty oczekiwanego kodu odmowy finansów403→faktyczne404 bez ujawniania grupy. Dalsze poprawki runnera: unikalne etykiety danych przy celowanym wznowieniu oraz kontrola członkostwa SQL po celowym logout (stary token musi już dawać401). Powtarzano celowane discovery w drugiej, utworzonej przez to zadanie fixture, bez kolejnych migracji lub nowych stosów. Wszystkie14 końcowych asercji przeszło. Testy/asserty aplikacji i strażniki nie zostały osłabione.

Lokalne źródła runnerów dopuszczają nową gałąź jawnie i sprawdzają ancestry audytu, dokładny backend24a59e1, historyczne41 i lokalność Dockera. Nie ustawiano `GITHUB_ACTIONS` lub innego fikcyjnego kontekstu w celu uruchomienia testów. Kod Auth/finansów/składów i RLS niezmieniony. Baza telefonu `slm-main-stabilization` i Supabase Cloud nie były używane ani migrowane. Nie instalowano APK.

WARN: offset nie jest snapshotem; równoczesne edycje mogą przesuwać strony. Globalna blokada SQL i koszt literalnego skanowania pozostały zgodne z audytem. Brak load-test/EXPLAIN na docelowej skali. Nie ma automatycznego członkostwa; publiczny wynik nie daje katalogu prywatnej grupy, profili, finansów lub składów. Pełny wcześniejszy audyt pozostaje w `PUBLIC_MATCH_DISCOVERY_BACKEND_AUDIT.md`.

## Osobna propozycja CI — NIEAKTYWNA

[Patch](review/public-discovery-ci-proposed.patch), [kandydat z18 dokładnymi źródłami](review/public-discovery-ci-candidate.json), [test propozycji](review/test_discovery_ci_proposal.py). Nadal aktywne `lineups_ci.py`, `lineups-ci-approval.json` i workflow są bajtowo zgodne ze Stage3B. Ich source gate obecnie odmawia discovery — **oczekiwany BLOCK, nie PASS CI**.

Propozycja zachowuje niezmieniony punkt odniesienia Stage3B/6d96391 i jego walidację względem45d9a4. Dopuszcza dokładną listę18 zmienionych/dodanych plików przypiętych do43f69a6, żadnych wildcardów; cała reszta aplikacji musi pozostać identyczna. Dwie istniejące oczekiwane liczby migracji w runnerach CI dostają dokładną, opisaną transformację41→42 po preflight. Walidacje repo, event/SHA, ancestry, runnera, zasobów, lokalnego pustego Dockera, istniejących root policies i workflow zachowane. W przyszłym aktywowaniu właściciel najpierw przegląda/commituje proponowany gate, a w osobnym commicie przypina implementation do tego konkretnego nowego commita. Bez self-pin i bez automatycznej zmiany obecnego wskaźnika.

Ta minimalna propozycja aktualizuje kontrakt źródeł istniejących suite; nie uruchamia Actions ani nie dodaje joba discovery SQL/Chromium. Pełne uruchomienie hostowane wymaga odrębnego review, potwierdzenia darmowego limitu i opt-in. Nie zmieniano zmiennych repozytorium, planu, sekretów ani konfiguracji produkcji.

**Granica propozycji:** 32 kontrole nie zastępują pełnego pozytywnego przebiegu `verify_sources` z przyszłym commitem CI. Nie przygotowano aktualizacji syntetycznych `SourceTests` starego zestawu23 dla dodatkowego overlay/42; wymaga ona wykonania wraz z review aktywacji i rzeczywistym testem Linux. Propozycja jest konkretnym patchem do przeglądu, nie gotowym zatwierdzonym wdrożeniem CI.

Dotychczasowe23 testy launch-contract uruchomiono bez zmian: dwa pozytywne przypadki repozytorium tymczasowego potknęły się o Windows/core.autocrlf i porównanie bajtów workflow z Git; trzeci nie mógł utworzyć symlinka (WinError1314). Pozostałe20 przeszło. Nie zmieniano globalnego Gita/Windows, nie pomijano tych asercji ani nie zaliczono ich na podstawie raportu poprzedniej sesji. Potrzebny rzeczywisty przebieg Linux przed aktywacją CI.

## NOT RUN / decyzja

Hostowane Actions, publiczne usługi/płatne zasoby, Cloud, migracje istniejących baz, merge i deploy: **NOT RUN**. Fizyczny POCO i instalacja APK: **NOT RUN**. Pełne Cypress w tej sesji: **NOT RUN**; rzeczywisty Chromium i pełne Vitest wykonane osobno. Dwa końcowe scenariusze pierwotnego runnera GoTrue dotyczące leave/revoke nie zostały osiągnięte po wcześniejszym niepowodzeniu callbacka; odebranie dostępu pokrywa52 SQL, a rzeczywisty logout14 Chromium. Nie sumujemy ich do pełnego13 PASS starego runnera.

Zakres rekomendowany do dalszego review na Draft PR do `audit/public-match-discovery-backend`, **po końcowej akceptacji aktywnych przypięć oraz osobnym rozstrzygnięciu CI**. Bez automatycznej integracji do main. Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

## Lista zmienionych plików względem HEAD audytu

- Runtime: `app/src/events/PremiumEvents.tsx`, `usePremiumEvents.ts`, `premiumContracts.ts`.
- Test UI: `app/src/events/discoveryUi.test.tsx`.
- Aktywne kontrakty: `app/scripts/premium-route-policy.mjs`, `verify-consolidation.mjs`, `verify-premium-policy-cases.mjs`.
- Lokalne runnery: `app/scripts/discovery_local.py`, `test-discovery-ui-local.py`, `test-discovery-ui-browser.mjs`, `test-lineups-local.py`, `test-lineups-edge-local.py`, `test-public-discovery-local.py`, `test_discovery_audit_preflight.py`.
- Raport/stan: ten dokument, `docs/STATUS.md`, `docs/ODPOWIEDZI_CODEX.txt`.
- Materiały review: sześć plików `docs/review/public-discovery-stage2b-{runtime.patch,active-pins.patch,sources.json}` i `public-discovery-ci-{proposed.patch,candidate.json}` oraz `test_discovery_ci_proposal.py` (pełne nazwy w linkach powyżej).
- Dowody wizualne: `docs/ui/public-discovery-stage2b/public-light.png`, `public-dark.png`.

Źródła SQL/handler oraz odziedziczone testy discovery backendu nie są nowymi zmianami względem audytu. Nie włączono ponownie historycznych zmian do zakresu implementacji.

## Publikacja

Kod/testy/przypięcia: `43f69a62c85dd354695f6fcb4531c85fb03651cf`; raport i dowody: `eeb69404081da2d10beb8addf63ac1fc1300650c`, zwykły push potwierdzony. Utworzono [Draft PR #28](https://github.com/psuda87/sunday-league-mates/pull/28), base `audit/public-match-discovery-backend`/ddd3a3e, open/draft, bez merge; ponowny odczyt API potwierdził mergeable=true/clean. To stan techniczny Git, nie akceptacja właściciela ani PASS hostowanego CI.

Końcowy APK debug SHA256: `910f97317be0b3c79684d8b0d5df1e7e7963dd8b9311648d65d82c2df1f7bde2`, artefakt ignorowany, nie instalowano. Wszystkie nowe kontenery testowe pozostają zatrzymane; działa tylko sześć zastanych usług backendu telefonu. Końcowe potwierdzenie publikacji stanowi osobny commit dokumentacyjny; źródła i wyniki bez dalszych zmian. [Porównanie](https://github.com/psuda87/sunday-league-mates/compare/audit/public-match-discovery-backend...feat/public-match-discovery-stage2b).

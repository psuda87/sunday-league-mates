# Aktualny odbiór grup — 2026-11-06, po zgodzie właściciela

**PASS przed publikacją.** Obie blokady strażników usunięte po przeglądzie zawartości. Vercel: przygotowana publikacja gałęzi, wynik zostanie dopisany po weryfikacji.

| Punkt | Status | Weryfikacja końcowa |
| --- | --- | --- |
| 1. Popup prywatności | GOTOWE | Mobilny Cypress: brak wysłania przed potwierdzeniem i po Anuluj, jedno wysłanie po Potwierdź. |
| 2. Zaproszenia i zgłoszenia | GOTOWE | Cypress: tylko pending, cancelled ukryte, anulowanie działa. SQL: historia accepted zachowana. |
| 3. Szczegóły, panele i nicki | GOTOWE | Opis właściciela zachowany, usunięte zbędne etykiety. Cloud: równoczesny signup 200/409; potwierdzenia Gmail; login; konflikt edycji 409; zmiana wielkości liter 200; rename i ponowny login/readback PASS. |
| 4. Przejdź do grup | GOTOWE | Cypress i zrzut mobilny: przycisk Premium z ikoną, działająca nawigacja. |
| 5. Wyszukiwanie grup | GOTOWE | Cypress i oględziny mobilne: nazwa, opis, liczba członków, przycisk, oczekiwanie i anulowanie; brak poziomego przepełnienia przy 390 px. Istniejące ILIKE zachowane. |
| 6. Dzwoneczek | GOTOWE | Vitest i Cypress: właściwe grupy administratora i nawigacja; Cloud groups_list potwierdza licznik 1 przed decyzją i 0 po decyzji. |
| 7. Zarządzanie grupą | GOTOWE | Cypress i SQL; Cloud: inny użytkownik nie może zaakceptować prośby (403), aktualny administrator może; licznik odświeżony. |

## Strażniki — przegląd i wyniki

- PASS `npm run verify:consolidation`.
- PASS osobne `node scripts/verify-frozen-ui.mjs`.
- PASS `npm run test:premium-policy`: **107/107**, w tym 16 dodatkowych prób naruszenia zatwierdzonych źródeł grup i istniejącej migracji płatności.
- Historycznego kontraktu 55 plików ani jego hashy nie zmieniano. Nadal sprawdzane są niezmienne obiekty Git, oryginalne migracje, routing LIVE, wejścia Premium, konfiguracja buildów, granice importów i brak eksperymentalnego Auth.
- Wyjątki wskazują dokładnie źródła zmian grup z `3596de1`. Dodatkowo zachowano istniejącą, zaakceptowaną bazę PR37 `c27a84f` (płatności i Android resume), której stare piny nie uwzględniały. Nie przenoszono nowych funkcji tych modułów. Lista grup porównywana jest z rzeczywistym diffem obu commitów; każda treść jest porównywana z obiektem Git. Nie ma ogólnego pomijania plików ani samodzielnej akceptacji zmienionych hashy.

## Pozostałe wyniki końcowe

- PASS TypeScript aplikacji, lint, `typecheck:edge`, build Premium.
- PASS Vitest: **524/524**, 75 plików.
- PASS Cypress: **4/4**, mobilny viewport 390×844; transport kontrolowany, osobno od testów Cloud.
- PASS SQL/RLS w tymczasowej bazie lokalnego slm-main-stabilization: 48 migracji, minimum_phone, prywatność/FK, unikalność nicków, login po rename, uprawnienia administratora, zachowanie historii, równoczesne rejestracje.
- PASS Cloud: rzeczywiste API accounts, dwie rejestracje testowe, poczta Brevo/Gmail i weryfikacja dowodów e-mail, logowanie, zmiana nicku i konflikty 409, działania grup oraz kontrola uprawnień. Hasła losowe wyłącznie w pamięci procesu, bez zapisania w repo lub logach. Dwa fikcyjne konta oraz fikcyjna grupa pozostawione jako dane odbioru; wiadomości i wyniki testów nie były usuwane.
- PASS zgodny CORS `https://slm-ui-demo.vercel.app` w odpowiedziach signup.
- PASS `git diff --check` oraz składnia skryptu testów Cloud. Znane ostrzeżenie o wielkości bundla pozostaje.

## Cloud — dokładny zakres

- Projekt `hjtcyybkxebvdropchac`.
- Zastosowana wyłącznie migracja `groups_nickname_uniqueness`, wersja Cloud **20261106223406**; źródło `app/supabase/migrations/20261106220609_groups_nickname_uniqueness.sql`.
- `accounts`: **v17 → v18**, ACTIVE, dotychczasowe `verify_jwt=false` zachowane (funkcja sama weryfikuje sesje).
- Zachowano 8/10 plików wdrożonej funkcji bajt w bajt, w tym index/CORS/SMTP, emailHook, deno.json i zależności. Zmieniono jedynie handler.ts i emailFlows.ts — dokładnie pięć dodanych linii obsługi nicków. Potwierdzono zgodność wszystkich 10 pobranych plików po deployu.
- Reprodukowalny zakres: [patch v17→v18](review/groups-ux-accounts-v18.patch), [manifest SHA256](review/groups-ux-cloud-manifest.json). Celowo nie wdrożono całego lokalnego handlera zawierającego wcześniejszy, niewdrożony moduł prywatności.
- Sekrety, Auth, CORS i SMTP/Brevo bez zmian. Migracja prywatności nie jest obecna w Cloud; nie wdrażano workerów ani innych funkcji. Bez resetów, czyszczenia istniejących kont i merge do main.

## Commity

- `3596de1` — implementacja siedmiu punktów i atomowej unikalności nicków.
- `fe18662` — raport poprzedniego etapu.
- Aktualizacja strażników, testów Cloud i tego odbioru: commit przygotowany w bieżącym etapie; jego SHA podane przy publikacji.

Poniżej zachowano raport poprzedniego etapu wraz z ówczesnymi FAIL i ograniczeniami. To historia, nie aktualna blokada.

---

# Odbiór modułu grup — 2026-11-06

Gałąź: `feat/groups-ux-acceptance`. Baza pracy: `b06592c` (zawiera wcześniejsze poprawki 1–2), main po PR37: `c27a84f`.
Commit implementacji: `3596de1` — wypchnięty na origin/feat/groups-ux-acceptance.

**Wynik ogólny: BLOKADA wdrożenia.** Funkcjonalne testy lokalne przeszły; istniejące strażniki źródeł/migracji nie przechodzą. Nie zmieniono ich ani nie zaktualizowano hashy. Zgodnie z AGENTS.md zmiana strażników wymaga osobnego przeglądu właściciela. Bez Vercel, merge do main, resetu bazy, zdalnych migracji, wdrażania accounts lub workerów.

GOTOWE w tabeli oznacza gotową implementację i wykonane testy funkcjonalne, nie zgodę na publikację ani potwierdzenie działania nowego backendu w Cloud.

| Punkt | Status | Wykonanie i dowody |
| --- | --- | --- |
| 1. Popup prywatności | GOTOWE | Zachowano istniejącą implementację, poprawiono jednoznaczne zamykanie i ponowne otwieranie Ionic Alert. Cypress: 0 żądań przed potwierdzeniem, 0 po Anuluj, 1 po Potwierdź. Brak stałego komunikatu na ekranie wyszukiwania. |
| 2. Zaproszenia i zgłoszenia | GOTOWE | Zweryfikowano wcześniejszą poprawkę: brak zbędnej pustej informacji zaproszeń, własne zgłoszenia wyłącznie pending. Cypress sprawdza ukrycie cancelled i anulowanie pending. Historia pozostaje w bazie; lokalny SQL sprawdza zachowanie accepted. |
| 3. Szczegóły, panele i nicki | BLOKADA | Szczegóły bez powtórzonej liczby członków i zastępczego opisu, opis właściciela zachowany. Panele dopasowane do Premium. Nowa migracja: unikalny indeks lower(btrim(nickname)), prywatne rezerwacje nicków także dla niezweryfikowanej rejestracji, walidacja i konflikt 409 przy signup/edycji; dotychczasowe wyszukiwanie ILIKE już ignoruje wielkość liter. Testy SQL i równoczesnych zapisów przeszły. Aktywację blokują strażniki i wymagany przegląd; migracja i accounts nie są wdrożone w Cloud. |
| 4. Przejdź do grup | GOTOWE | Przycisk Premium z panelem bieżącej palety, złotym akcentem i ikoną grup. Cypress potwierdza nawigację; zrzut mobilny. |
| 5. Wyszukiwanie grup | GOTOWE | Karty z wyraźną nazwą, opisem, liczbą członków i przyciskiem. Zachowano istniejące oczekiwanie/anulowanie prośby. Cypress: potwierdzenie i anulowanie oraz brak poziomego przepełnienia przy 390 px. |
| 6. Dzwoneczek | GOTOWE | Przy nagłówku Mecze. Istniejący groups_list dostarcza pending_count; sumowane wyłącznie grupy z admin_id bieżącego użytkownika. Lista nazw grup prowadzi do właściwej grupy. Odczyt przy wejściu, zmianie danych meczów i slm-groups-changed; ochrona przed spóźnionymi odpowiedziami. Vitest sprawdza wykluczenie obcego administratora, odświeżenie i nawigację; Cypress potwierdza pełny przepływ. Bez push i tabeli powiadomień. |
| 7. Zarządzanie grupą | GOTOWE | Licznik przed otwarciem panelu, poprawione panele/akcje, usunięte puste opisy. Cypress: akceptacja usuwa licznik. SQL: administrator obcej grupy nie może rozpatrzyć prośby, właściwy administrator może; członkostwo i historia potwierdzone. |

## Wykonane kontrole

- PASS: TypeScript aplikacji (build), `npm run lint`, `npm run typecheck:edge`.
- PASS: `npm run build` i końcowy `npm run build:premium-web`. Znane ostrzeżenie o pakiecie JS >500 kB pozostaje; bez nowych zależności.
- PASS: pełne Vitest — 75 plików, 524 testy.
- PASS: Cypress `groups-acceptance.cy.ts` — 4/4, kontrolowany transport, fikcyjne dane, viewport 390×844. Nie jest to Cloud E2E. Starszego pełnego zestawu Cypress nie uruchamiano.
- PASS: izolowany `test-groups-nicknames-local.py` — odtworzenie 48 migracji z tej gałęzi, minimum_phone, account_privacy SQL/RLS/FK, nicki (signup, rename, zmiana wielkości liter, login po zmianie nicku, ACL), uprawnienia administratora i historia zgłoszeń. Równoczesne rejestracje tego samego nicku: dokładnie jeden sukces i jeden konflikt.
- PASS: odczyt Cloud — RLS włączone na slm_groups, slm_group_members, slm_group_requests, slm_player_profiles; zero grup zdublowanych nicków. Sam odczyt nie zastępuje testów uprawnień — te wykonano lokalnie.
- PASS: `git diff --check`, składnia lokalnego runnera Python.
- FAIL: `npm run verify:consolidation` — `Unexpected migration/model activation`, istniejąca zamknięta lista migracji nie obejmuje aktualnego zestawu. Kontrola nie została wyłączona.
- FAIL: osobne `node scripts/verify-frozen-ui.mjs` — `Approved UI changed: app/src/demo/GroupScreens.tsx`. Zmiana grup jest w żądanym zakresie, ale aktualizacja manifestu wymaga osobnego przeglądu właściciela. Brak pełnego PASS.

Pierwsze uruchomienie Vitest z ograniczonym dostępem Windows zatrzymało się na EPERM plików tymczasowych; poprawnie uruchomione testy później przeszły. W trakcie prac wykryto i naprawiono kodowanie napisów oraz zamykanie popupu; końcowe wyniki podano powyżej. Początkową niedostępność Dockera rozwiązano uruchomieniem istniejącej instalacji. Testy bazowe wykonano w nowej, tymczasowej bazie kontenera slm-main-stabilization, usuniętej po teście, bez resetowania postgres/POCO/Cloud.

## Oględziny i ograniczenia

Obejrzano zrzuty mobilne dzwonka, panelu zarządzania i wyszukiwania. Zrzuty Cypress są lokalnie w `app/cypress/screenshots/groups-acceptance.cy.ts/` (ignorowane w Git). Nie wykonywano testu na fizycznym telefonie, synchronizacji Capacitor, kompilacji APK ani instalacji. Nie zmieniano historycznych migracji, CI, manifestów, źródeł innych modułów poza wymaganym nickiem i miejscem akcji nagłówka meczów. Zastany nieśledzony `app/dist-demo-six/` pozostawiono poza commitem.

Następny krok: osobny przegląd właściciela chronionych zmian i propozycji aktualizacji strażników. Dopiero po rozwiązaniu FAIL ponowić odbiór; ewentualne wdrożenie nowej migracji/obsługi accounts do testowego Cloud musi mieć oddzielną wyraźną zgodę. Nie wdrażać przy okazji migracji prywatności ani workerów. Gałąź nie ma jeszcze pełnego PASS do wdrożenia.

# Audyt zależności — 13.10.2026

Aktualizacja po zapamiętywaniu sesji: dodano `@aparajita/capacitor-secure-storage@8.0.1`
(MIT, Capacitor 8) oraz jego zależność `@capacitor/ios@8.5.3`; nie dodano platformy iOS.
Powtórzone `npm audit`: 6 moderate, 0 high, 0 critical. `--omit=dev`: 3 moderate
routera. Wynik nie wzrósł; nie uruchamiano `audit fix --force`. Build, lint, typy,
testy sesji i natywna kompilacja Androida przeszły; szczegóły w AUTH_PROOF.md.

Zakres: `app/`, raport npm audit, rzeczywiste łańcuchy z `npm explain`, konfiguracja projektu i komunikaty bezpieczeństwa. Liczby npm oznaczają wpisy dla pakietów, także rodziców zależności, a nie liczbę niezależnych luk.

Historia: początkowo 12 wpisów (1 critical, 2 high, 9 moderate); po aktualizacji Vitest 10 (0 critical, 2 high, 8 moderate); po migracji Cypress 16.1.1 **6 moderate, 0 high, 0 critical**. Końcowy raport: `npm-audit-2026-10-13.json`. Audyt z `--omit=dev` pozostaje bez zmian: **3 moderate, 0 high, 0 critical**; zapisano go w `npm-audit-production-2026-10-13.json`. Oba polecenia audit zwracają kod 1, ponieważ nadal istnieją podatności.

## Critical: Vitest

Łańcuch: projekt → `vitest@4.0.18` (bezpośrednia devDependency). GHSA-5xrq-8626-4rwp / CVE-2026-47429 dotyczy odczytu plików poza dozwolonym katalogiem i możliwości wykonania kodu przez API narzędzia testowego. Warunki: dostęp do aktywnego serwera API/UI (szczególnie wystawionego do sieci) albo UI/Browser Mode na Windows. Projekt używa testów jsdom, nie ma UI/Browser Mode ani skonfigurowanego API; zwykły `vitest --run` nie uruchamia tego scenariusza. Pakiet nie jest częścią aplikacji produkcyjnej.

Poprawka critical jest dostępna od 4.1.0. Zastosowano `vitest@4.1.11`, również usuwający moderate GHSA-82fw-gwwq-j7x9 w łańcuchu projekt → Vitest → `@vitest/mocker`. Zachowano główną wersję 4; nowa wersja jest zgodna z Node 24 i Vite 8. Nie było potrzeby zmiany testów ani konfiguracji.

Źródło: https://github.com/advisories/GHSA-5xrq-8626-4rwp

## Usunięte high: extract-zip i Cypress

Łańcuch: projekt → `cypress@13.17.0` (devDependency) → `extract-zip@2.0.1`. npm raportuje high zarówno dla extract-zip, jak i jego rodzica Cypress; nie oznacza to dwóch niezależnych pakietów wykonawczych aplikacji.

- GHSA-jmr9-qjv8-65gv / CVE-2026-56876: cele dowiązań symbolicznych z ZIP nie są sprawdzane; mogą wskazywać poza katalog rozpakowania. Późniejsze operacje mogą odczytywać lub zapisywać pliki poza tym katalogiem.
- GHSA-7pqw-9j4j-h8q3 / CVE-2026-19693: ZIP z dowiązaniem i następującym po nim zwykłym plikiem o tej samej nazwie może nadpisać plik poza katalogiem docelowym.

Warunki: atakujący musi dostarczyć złośliwe archiwum, a proces musi je rozpakować z odpowiednimi uprawnieniami systemowymi. W lokalnym kodzie CLI Cypress extract-zip służy instalacji binariów, m.in. z pobranego ZIP lub ścieżki podanej przez `CYPRESS_INSTALL_BINARY`. Zagrożenie dotyczy komputera dewelopera/CI podczas instalacji; użytkownicy APK/webowej aplikacji nie uruchamiają tego kodu. Wymagania systemu dotyczące tworzenia dowiązań mogą wpływać na wykorzystanie na Windows, ale nie stanowią poprawki.

Nie ma opublikowanej poprawionej wersji extract-zip (najnowsza 2.0.1). Nie dodano override ani lokalnego forka. Zastosowano Cypress 16.1.1; opublikowana lista zależności nie zawiera extract-zip, a `npm ls extract-zip` potwierdziło puste drzewo.

Migrację 13 → 16 wykonano na wyraźne polecenie użytkownika po przeglądzie dokumentacji zmian wersji 14, 15 i 16 oraz sprawdzeniu metadanych npm. Node 24.14.0 jest zgodny. Obecny test używa tylko `cy.visit` i `cy.contains`, nie używa wielu originów, Cypress.env, cy.exec, cy.end, stubów ani usuniętych opcji eksperymentalnych. Nie ma testów komponentowych ani konfiguracji CI. Nie było potrzeby zmiany testu. Ustawiono `defaultBrowser: "chrome"` zamiast domyślnego, przestarzałego Electron i usunięto pusty setupNodeEvents. `npx cypress verify` oraz E2E w Chrome 155 headless przeszły; nie zgłoszono ostrzeżeń usuniętych opcji ani przestarzałego Electron. Wersje pośrednie 14/15 przeanalizowano, ale nie instalowano ich osobno.

Źródła:

- https://github.com/advisories/GHSA-jmr9-qjv8-65gv
- https://github.com/advisories/GHSA-7pqw-9j4j-h8q3
- https://docs.cypress.io/app/references/migration-guide

## Pozostałe moderate

Pozostały wpisy: `@capacitor/cli`, `xcode`, `uuid`, `@ionic/react-router`, `react-router`, `react-router-dom`. Nie zmieniano routera ani CLI Capacitor. Sugestia npm obniżenia CLI do 8.4.3 nie została potraktowana jako rozwiązanie bez sprawdzenia całego stosu.

Migracja podniosła `@cypress/request` do 4.0.1 i `qs` do 6.16.0. Usunięto wpisy Cypress, extract-zip, @cypress/request i qs; wpis uuid pozostał ze względu na inny łańcuch: projekt → `@capacitor/cli@8.5.3` → `xcode@3.0.1` → `uuid@7.0.3`. To brak kontroli granic bufora w funkcjach v3/v5/v6 przy przekazaniu bufora docelowego (GHSA-w5hq-g745-h8pq). Wykorzystanie wymaga wywołania dotkniętej funkcji z takim buforem/danymi; sam wpis w drzewie nie dowodzi wykorzystania w CLI. Dotyczy narzędzi deweloperskich, nie APK. Źródło: https://github.com/advisories/GHSA-w5hq-g745-h8pq

Produkcyjne moderate dotyczą routera. Bieżąca aplikacja używa stałego przekierowania `/home`, nie przyjmuje zewnętrznych adresów nawigacji i nie używa SSR; warunki wskazane w ostrzeżeniach nie występują w obecnym szkielecie. Raport nie jest jednak czysty; dodawanie dynamicznych adresów lub SSR wymaga ponownej analizy i planu migracji routera zgodnego z Ionic.

Są to otwarte przekierowanie przez backslash w Link/useNavigate (GHSA-wrjc-x8rr-h8h6) i wstrzyknięcie konstruktora podczas deserializeErrors w hydratacji SSR (GHSA-337j-9hxr-rhxg). Raportowana poprawka wymaga migracji poza React Router 6, którą trzeba uzgodnić z obsługą routera Ionic. Nie zastosowano automatycznego downgrade Ionic ani migracji routera. Trzy produkcyjne wpisy opisują router i jego zależne pakiety, nie trzy osobne luki.

## Zmiany i weryfikacja

- `app/package.json`, `app/package-lock.json`: Vitest 4.1.11 i jego zależności.
- Migracja Cypress: wersja 16.1.1 i nowe zależności w package.json/lockfile; konfiguracja Chrome w `app/cypress.config.ts`.
- `app/eslint.config.js`: pomijanie katalogów natywnych Android/iOS; po pierwszym buildzie Androida ESLint próbował sprawdzać wygenerowany `native-bridge.js` i zgłaszał nieistniejącą regułę. Kontrola kodu TypeScript aplikacji pozostaje aktywna.
- Build webowy: OK; ESLint po korekcie zakresu: OK; Vitest: 1/1; Cypress: 1/1; `cap sync android`: OK; Android `:app:assembleDebug` z JDK 21: OK.
- Pozostały ostrzeżenia wielkości chunków, Browserslist, starszych API Node/Cypress i Gradle flatDir. Nie uruchamiano testów na urządzeniu.

Nie używano `npm audit fix --force`. Użytkownik autoryzował końcowy commit `chore: initialize Ionic Capacitor app and project documentation` oraz zwykły push do origin/main po przejściu kontroli. Przed commitem sprawdzono pliki i wykluczenia sekretów, .env, zależności, APK, konfiguracji SDK i artefaktów builda; zachowano źródła Androida i package-lock.json.

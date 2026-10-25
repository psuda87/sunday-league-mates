> RAPORT HISTORYCZNY z 2026-10-23. Opisuje ówczesny stan, nie aktualny odbiór B1/B2.2. Bieżący stan Androida: gałąź feat/slm-v1-live; aktualne lokalne korekty wyglądu: feat/ui-beta. Nie scalać tych gałęzi automatycznie.

﻿# Test POCO X3 NFC — 2026-10-23 19:51:58 Europe/Warsaw

Repo: psuda87/sunday-league-mates. Katalog główny: feat/ui-beta d0f9fa9; właściwy istniejący worktree testowy: I:\slm\sunday-league-mates-integration, chore/android-phone-readiness ae9fac7 (czysty). Nie przełączano ani nie nadpisano lokalnych grafik/pics. Instrukcja docs/ANDROID_PHONE_TEST.md odczytana z gałęzi testowej. Raport zapisano w dostępnym katalogu głównym; nie kopiowano zmian między gałęziami.

## PASS
- ADB: jedno autoryzowane urządzenie POCO M2007J20CG, Android 12/API31.
- WebView dostępny: com.google.android.webview 155.0.8059.43 (nie potwierdza renderowania aplikacji).
- Istniejący debug APK: 9658849 bajtów; podpis zweryfikowany, applicationId pl.psuda87.slm; SecureStorage obecny; bridge logging i WebView debugging wyłączone.
- Helper verify-apk potwierdził zgodność 43 plików APK z lokalnym dist i lokalne API http://127.0.0.1:54321; brak demo. Bez przebudowy, ponieważ istniejący artefakt przeszedł kontrolę.
- SHA256: 11f0352af21f6a1945ee29a620fce266b6ee0b3b0466f7780b731f5f590fde1c.
- adb reverse portu 54321 utworzone; po nieudanej instalacji usunięto wyłącznie to mapowanie.

## FAIL / BLOCKED
- adb install -r: INSTALL_FAILED_USER_RESTRICTED: Install canceled by user. Brak instalacji; nie obchodzono zabezpieczeń.
- Próba uruchomienia: Activity class does not exist, skutek braku pakietu (nie crash aplikacji).
- Lokalny Docker: brak pipe dockerDesktopLinuxEngine. Uruchomiono istniejący Docker Desktop w ukrytym oknie, lecz kolejne kontrole nadal nie wykryły silnika. Nie zmieniano ustawień Windows/Dockera ani baz.

## NOT TESTED
Start/renderowanie aplikacji, crashe/logcat procesu SLM, lifecycle/Home/force-stop/restart, logowanie, Keystore/sesja, backend/CORS/fixture, przepływy grup/meczów/finansów oraz odbiór UI. Nie ma procesu SLM do zbierania logów. Nie tworzono kont, nie używano danych produkcyjnych, nie uruchamiano migracji, buildów ani testów kodu (brak zmian kodu). Nie wykonano commit/push/merge/deploy. Nie uznano testów historycznych za aktualne.

## Wymagana interakcja i wznowienie
1. Odblokuj telefon. W Opcjach programistycznych sprawdź, czy Instalacja przez USB jest dozwolona. Nie wyłączaj zabezpieczeń/optimizacji MIUI ani nie podawaj danych konta Xiaomi na potrzeby obejścia blokady. Jeśli telefon wymaga dodatkowych uprawnień lub konta, opisz komunikat.
2. Daj znać, że telefon jest gotowy. Podczas ponownej próby zaakceptuj systemowy monit instalacji SLM, jeśli się pojawi. Nie zmieniaj ustawień, jeśli instalację blokuje polityka administratora.
3. Otwórz Docker Desktop i sprawdź widoczny komunikat stanu silnika; przekaż błąd, jeśli nie startuje.
4. Po udanej instalacji: sprawdź ekran logowania, klawiaturę, Wstecz, dolną nawigację i safe area; następnie Home → powrót oraz zamknięcie → ponowne otwarcie. Konta i testy sesji dopiero po uzgodnieniu lokalnego fixture.

Następny krok: ponowna instalacja za zgodą systemu telefonu; kontrola lokalnego backendu udokumentowanym helperem, potem automatyczny smoke/lifecycle i oczyszczone logi.

[2026-10-23 19:55:03 Europe/Warsaw] Na prośbę użytkownika ponowiono adb install -r zweryfikowanego APK. Telefon nadal autoryzowany, wynik ponownie INSTALL_FAILED_USER_RESTRICTED: Install canceled by user. APK nie zainstalowano. Wymagane sprawdzenie opcji Instalacja przez USB i komunikatu telefonu, bez obchodzenia zabezpieczeń. Raport: docs/ODPOWIEDZI_CODEX.txt.

## Aktualny build fixture UI — 2026-10-23 19:55:29 Europe/Warsaw
Repo I:\slm\sunday-league-mates, origin psuda87/sunday-league-mates, branch feat/ui-beta.
Nie korzystano z raportu code-finder. Istniejące wpisy raportu zachowano.
Checklistę odczytano przez git show chore/android-phone-readiness:docs/ANDROID_PHONE_TEST.md bez przełączania gałęzi; opisuje inny wariant z backendem 54321. W tym teście użyto aktualnego izolowanego fixture demo, bez serwera, kont i adb reverse.

PASS:
- ADB c7a559b5 device; POCO M2007J20CG, Android 12; WebView 155.0.8059.43 obecny (nie jest to test renderowania aplikacji).
- npm install --ignore-scripts uzupełnił brakującą zależność push; audyt 0 podatności, lockfile bez zmian.
- Usunięto konflikt Windows Groups.tsx/groups.ts przez nazwę GroupScreens.tsx, analogicznie test i importy/allowlista. Bez zmian zachowania UI.
- npm run lint, npm run build, npm run build:demo; verifier: 15 plików, izolacja demo i CSP poprawne.
- JDK Android Studio: cap sync android z tymczasowym webDir=dist-demo, konfiguracja źródłowa przywrócona bajtowo; Gradle assembleDebug testDebugUnitTest PASS (1 test przykładowy, nie dowód działania telefonu).
- aapt potwierdza pl.psuda87.slm, Sunday League Mates i MainActivity.
- APK app/android/app/build/outputs/apk/debug/app-debug.apk, SHA256 C2E1C6CB3CBD77CBB2C6961763ED29CA1F0DB16890AA1116B960F575788EEE83.
- git diff --check PASS. Vite/Vitest wymagały wykonania poza sandboxem z powodu spawn EPERM.

FAIL:
- adb install -r: INSTALL_FAILED_USER_RESTRICTED: Install canceled by user. Pakiet nie zainstalowany; am start: Activity class does not exist. Brak podstaw do oceny crashy.
- Vitest 183 PASS / 1 FAIL (33 pliki): eventAccess.test.ts:46 oczekuje 14 zapisanych, otrzymuje 12. Stały startsAt pierwszego fixture 2026-10-22T16:00:00Z jest przeszły; validateEvent odrzuca event_update, wydarzenie zostaje prywatne. Nie zmieniano zegara ani reguł biznesowych. Naprawa dat fixture/testów pozostaje otwarta.

NOT TESTED:
- Start/renderowanie/WebView aplikacji, logi jej procesu, crashe, tło/wznowienie, force-stop/restart, klawiatura, safe areas i nawigacja: blokada instalacji.
- Cypress E2E nie uruchamiano; backend/Auth/Keystore/FCM i prawdziwe finanse poza fixture i bez testu.

Działania na telefonie:
1. Odblokuj ekran i pozostaw telefon podłączony przez USB.
2. W Opcjach programistycznych sprawdź „Instalacja przez USB”. Jeżeli jest wyłączona, włącz ją świadomie; jeżeli MIUI wymaga dodatkowego konta/uprawnień, przekaż dokładny komunikat zamiast obchodzić ochronę.
3. Potwierdź gotowość do ponowienia ADB install i zaakceptuj monit „Zainstaluj” na telefonie. Nie ma obecnie działającej instalacji SLM z tej próby.
4. Po udanej instalacji: otwórz Sunday League Mates; sprawdź Mecze/Grupy/Profil, szczegóły meczu i Wstecz, przewijanie i klawiaturę. Używaj wyłącznie fikcyjnych danych. Nie wykonuj połączeń telefonicznych.
5. Home → Ostatnie aplikacje → powrót; potem usuń SLM z ostatnich i otwórz ponownie. Fixture w RAM może wrócić do stanu początkowego po zabiciu procesu; motyw ma pozostać.

Bez push/merge/deploy, zmian Supabase ani migracji. APK zawiera demo, nie produkcyjne Auth. Wygenerowane natywne assets zawierają dist-demo, natomiast capacitor.config.ts ponownie wskazuje dist: następny cap sync spakuje dist. Zmiany Gradle po sync dodają istniejącą zależność push. Lokalnych grafik/pics i wcześniejszych raportów nie nadpisano.

[2026-10-23 19:55:58 Europe/Warsaw] Użytkownik potwierdził włączenie opcji telefonu. Ponowiono standardowe adb install -r oraz install --no-streaming -r. Oba tryby zwróciły INSTALL_FAILED_USER_RESTRICTED: Install canceled by user; transfer APK w drugim trybie udany. Instalacja nadal BLOCKED, start NOT TESTED. Potrzebna treść komunikatu na ekranie telefonu lub potwierdzenie, że monit w ogóle się nie pojawia. Bez zmiany zabezpieczeń/produkcji/push. Raport: docs/ODPOWIEDZI_CODEX.txt.

[2026-10-23 19:56:36 Europe/Warsaw] Ponowna instalacja adb install -r: SUCCESS. Start MainActivity: Status ok, COLD, 2296 ms. Home/powrót oraz force-stop/ponowny start wykonane; wyniki am start ok. Backend nadal BLOCKED: brak pipe dockerDesktopLinuxEngine. Brak logowania i testów chronionej sesji. Raport: docs/ODPOWIEDZI_CODEX.txt. Bez push/merge/migracji.

Korekta ostatniego wpisu: Home przez input keyevent został odrzucony przez Android (INJECT_EVENTS); test tła/powrotu NIE został wykonany i wymaga ręcznego Home. Force-stop i zimny restart PASS (1299 ms); proces działa. Bieżący logcat ograniczony do PID SLM: 0 markerów FATAL i 0 sprawdzanych markerów błędów WebView/JS; nie stanowi pełnego odbioru renderowania. Nie zmieniano zabezpieczeń telefonu.

[2026-10-23 19:58:51 Europe/Warsaw] Docker 29.8.2 działa. Początkowo accounts Edge niedostępna; uruchomiono istniejący lokalny helper backend (sesja terminala pozostawiona aktywna). Ponowny check PASS: PostgreSQL, zgodność 29 istniejących migracji, Auth, native CORS, chronione Edge i worker. Ustawiono adb reverse tcp:54321. Nie utworzono kont, nie resetowano bazy, brak zdalnych migracji/deploy/push. Następny krok: interaktywne utworzenie fikcyjnego konta przez app/scripts/android-phone-fixture.ps1 w worktree sunday-league-mates-integration. Hasło wyłącznie w ukrytym prompt, nie w raporcie. Test logowania telefonu nadal NOT TESTED. Raport: docs/ODPOWIEDZI_CODEX.txt.

[2026-10-23 20:05:23 Europe/Warsaw] Ręczny odbiór sesji Android — potwierdzenie użytkownika
PASS (ręcznie): po minimalizacji sesja zachowana; po zamknięciu aplikacji z tła i ponownym otwarciu użytkownik pozostaje zalogowany; po wylogowaniu pozostaje wylogowany; ponowne logowanie działa. Użytkownik akceptuje zachowanie sesji po ponownym uruchomieniu. To potwierdzenie zachowania UI, nie osobny dowód testu Keystore/offline/wygaśnięcia lub RLS.
Konto utworzone android-phone-fixture.ps1 ma zwykłą rolę, bez globalnego administratora. Po utworzeniu własnej grupy zostaje administratorem tej grupy, bez uprawnień do cudzych grup/finansów. Nie sprawdzano indywidualnych członkostw konta w bazie.
Brak zmian kodu, migracji, Edge Functions, push/merge/deploy. Następny krok: ręczne testy fikcyjnej grupy i uprawnień; testy offline/wygaśnięcia nadal NOT TESTED. Bieżący branch raportów: feat/ui-beta; testowane APK z chore/android-phone-readiness.
Raport końcowy: docs/ODPOWIEDZI_CODEX.txt.

[2026-10-23 20:55:37 Europe/Warsaw] Przywrócenie połączenia Android: telefon obecny w ADB, ale reverse --list był pusty. Backend check PASS (PostgreSQL, 29 istniejących migracji, Auth, CORS, Edge, worker). Przywrócono adb reverse tcp:54321 tcp:54321; force-stop i ponowny start SLM Status ok, COLD 1470 ms. Nie usuwano danych ani zapisanej sesji. Potwierdzenie odzyskania dostępu w UI przez użytkownika oczekiwane. Bez zmian kodu/migracji/Edge/push. Następny krok: potwierdzenie ekranu; po odłączeniu USB ponownie ustawić reverse. Raport: docs/ODPOWIEDZI_CODEX.txt.

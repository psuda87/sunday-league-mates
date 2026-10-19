# Android readiness — SLM 1.0, 19.10.2026

**GOTOWE do rozpoczęcia instalacji po podłączeniu i autoryzacji telefonu.** Fizycznego telefonu nie było: `adb devices -l` zwrócił pustą listę. Nie instalowano aplikacji i nie ogłaszamy zaliczenia testów urządzenia.
Pierwotne przygotowanie: worktree `I:\slm\sunday-league-mates-integration`, branch `feat/integration`, HEAD `13cf1a82e9e993cc9b4c4a53bc3e0aff9d9a307f`. Po fetch zawartość HEAD była identyczna z main/origin/main `1fadd977d9737f371b75a59eee63ce6c50e4cb3b` po PR #2/#3. Pierwotny etap zakończono bez commita/pusha/merge. Bieżąca publikacja narzędzi na osobnej gałęzi opisana jest na końcu raportu.

## GOTOWE — faktycznie zweryfikowane

- Docker Linux i lokalny Supabase dostępne. Baza, Auth, accounts i ochrona push-worker odpowiadają. Wszystkie **29 wersji migracji** odpowiadają plikom repozytorium; nie stosowano nowych migracji i nie resetowano bazy.
- Lokalny Backend action wykonał idempotentny hardening/preparation i zachował istniejący runtime bez uruchamiania drugiego procesu. Hooki wiadomości i wyłączona publiczna rejestracja pozostały aktywne.
- API telefonu: `http://127.0.0.1:54321/functions/v1/accounts`, przez planowane `adb reverse tcp:54321 tcp:54321`. Nie otwierano portów/firewalla ani publicznego dostępu.
- Native CORS: Android `https://localhost`, iOS `capacitor://localhost`; rzeczywiste POST bez sesji dają 401, obcy origin daje 403. Kong może odpowiedzieć ogólnie na preflight. Nowy helper początkowo błędnie wymagał 200 od handlera OPTIONS zamiast prawidłowego 204; dopasowano kontrolę do obu statusów i dodano rzeczywisty POST. Zabezpieczeń aplikacji nie zmieniano.
- SDK platformy 36/36.1, build-tools 35.0.0/36.0.0/36.1.0; minSdk24, compile/target36. ADB 1.0.41, platform-tools 37.0.0. JDK21.0.10 z Android Studio jbr, Gradle wrapper8.14.3. Domyślny JDK17 na PATH nie jest używany do builda skryptem.
- Tożsamość: `pl.psuda87.slm`, `Sunday League Mates`, `MainActivity`; źródła natywne kompletne. Logo/zasoby bez zmian.
- Produkcja korzysta z Accounts/SessionManager → live Groups/Matches/Finance i realnego Edge/RPC. Demo pozostaje osobnym buildem.

| Wykonana kontrola tego zadania | Wynik |
|---|---|
| TypeScript tsc --noEmit | PASS |
| ESLint | PASS |
| Vitest | 190/190, 33 pliki |
| Build web z lokalnym API | PASS |
| Capacitor sync android | PASS |
| Android assembleDebug + testDebugUnitTest, JDK21 | BUILD SUCCESSFUL; unit task UP-TO-DATE |
| APK vs bieżący dist | 43 pliki identyczne bajtowo |
| APK appId/appName/debuggable, aapt2 | PASS |
| APK podpis instalacyjny, apksigner verify | PASS |
| SecureStorage plugin, loggingBehavior=none, WebView debugging=false | PASS kontroli statycznej APK |
| Lokalny endpoint i kontrakty grup/meczów/finansów, brak AccountDemo | PASS kontroli bundle |
| assembleRelease --dry-run z lokalną konfiguracją | Oczekiwane odrzucenie przez guard; PASS zabezpieczenia, nie build release |
| PostgreSQL/29 migracji/Auth/native CORS/ochrona Edge | PASS |
| Rzeczywiste HTTP Auth legacy | 7 zestawów PASS |
| HTTP smoke/worker bez FCM | 9 PASS |
| Nowy helper fixture | PASS: utworzenie/logowanie/member, brak danych uwierzytelniających w output, obcy adres i krótkie hasło odrzucone; własne konto usunięte |
| Składnia PowerShell/Python/Node | PASS; PowerShell preflight uruchomiony |

Po sprzątaniu automatycznych testów: **0 kont Auth, 0 grup, 0 meczów**. Nie usuwano cudzych/istniejących danych. Nie tworzono trwałych kont na jutro — przygotowano interaktywny skrypt, aby hasła ustalić lokalnie.
Pełnych SQL/FIFO/współbieżności/Cypress nie powtarzano: kod tych modułów niezmieniony; poprzedni etap miał SQL31/55/replay9 i Cypress13/13 PASS. To wyniki historyczne, nie nowe testy tego zadania.

## Gotowy APK

```text
I:\slm\sunday-league-mates-integration\app\android\app\build\outputs\apk\debug\app-debug.apk
```

Rozmiar: **9,658,849 bajtów**, około 9.21 MiB.
SHA256: `11f0352af21f6a1945ee29a620fce266b6ee0b3b0466f7780b731f5f590fde1c`.
Kontrolne metadane są w ignorowanym `.cache/android-phone-build.json`. APK/build/dist nie są dodawane do Git. Nie jest to release i nie wolno go publikować w sklepie.

## Skrypty

Z katalogu `app`:

```powershell
.\scripts\android-phone.ps1 -Action Backend
.\scripts\android-phone.ps1 -Action Check
.\scripts\android-phone-fixture.ps1
.\scripts\android-phone.ps1 -Action Build
.\scripts\android-phone.ps1 -Action Install
.\scripts\android-phone.ps1 -Action Logs
.\scripts\android-phone.ps1 -Action Disconnect
```

Build nie wymaga telefonu. Install wymaga autoryzowanego urządzenia i nie używa uninstall/clear-data. Przy wielu urządzeniach podaj -Serial. Backend/Check nie wypisują lokalnych kluczy. Hasła fixture są ukryte, przekazywane stdin, nigdy w argumentach/pliku. Node helper używa wyłącznie lokalnego Admin API i .invalid; globalnego administratora nie nadaje.
`android-phone-local.py` obsługuje lokalny backend, sprawdzenie APK, release guard i filtrowanie logów; `android-phone-fixture.mjs` przyjmuje dane w pamięci. Nie potrzebują PAT ani produkcyjnego pliku .env.

## PRZYGOTOWANE — wymaga telefonu lub zimnego startu

- USB/RSA i sterownik producenta; `adb reverse`, instalacja, start aplikacji i filtrowany logcat konkretnego PID.
- Rzeczywisty Keystore i zachowanie sesji po ubiciu/wznowieniu/reboocie. Kod zapisuje tylko refresh token, bez native fallbacku do Preferences/localStorage; dostęp jest potwierdzany przez serwer przed odsłonięciem danych.
- Alternatywa Wi-Fi przez bezpieczne parowanie ADB Android11+ oraz reverse. Nie wystawia API na LAN i nie wymaga modyfikacji APK. Nie testowano tego transportu.
- Pełna ścieżka zimnego startu po zatrzymaniu wszystkich kontenerów: przygotowana, ale celowo nie zatrzymywano istniejącego działającego środowiska tylko dla jej testu. Vector jest wykluczany wyłącznie przy starcie helperem; istniejącego restartującego się kolektora nie zmieniano. Brak ignore-health-check/TCP2375/zmian Windows.
- Interaktywne wpisywanie ukrytego hasła: wrapper ma poprawną składnię i preflight, a przekazanie stdin/create/login zweryfikowano automatycznie; ręczne wprowadzenie danych nastąpi w terminalu użytkownika.
- Przypadek telefonu z wcześniejszą wersją/podpisem SLM: skrypt nie usuwa instalacji i zgłasza ewentualny konflikt podpisu do rozstrzygnięcia.

## ZABLOKOWANE / odłożone

- SMTP/domena/legal/callbacki: prawdziwy signup, potwierdzenie adresu i recovery e-mail nie działają. Admin-confirm lokalnego fixture nie testuje wysyłki. Obecne logowanie hasłem nie wymaga callbacku, a sam custom_url_scheme nie zastępuje pełnego intent-filter.
- FCM/Firebase: brak konfiguracji i doręczenia na telefon. Worker bez FCM nie pobiera zadań; nie generowano fikcyjnego potwierdzenia push.
- Zdalny rollout 29 migracji i Edge wymaga osobnego przeglądu/zgody. Nie wykonano żadnych operacji zdalnego Supabase ani Vercel.
- iOS niezweryfikowany, CAPTCHA odłożona. Vector ma znany lokalny problem socketu; nie blokuje obecnie testowanego rdzenia.
- Istniejące ostrzeżenia: bundle/Gradle; ostatni audit6 moderate (3 produkcyjne), brak high/critical — audytu zależności nie ponawiano w tym zadaniu.
- Issues [#4](https://github.com/psuda87/sunday-league-mates/issues/4), [#5](https://github.com/psuda87/sunday-league-mates/issues/5), [#6](https://github.com/psuda87/sunday-league-mates/issues/6) przeczytane, bez modyfikacji. Live ma Mecze/Grupy/Profil, bez docelowego centralnego plusa i edycji nazwy grupy. Te różnice zapisujemy jako otwarte UX, nie zmieniamy dziś. Docelowe ustalenie: Mecze | Grupy | + | Profil | Ustawienia, czerwono-bordowy plus lekko wystający nad pasek.

## Jutro — kolejność

1. Uruchom Docker Desktop; `Backend`, następnie `Check`.
2. Utwórz dwa fikcyjne konta skryptem fixture z ukrytym hasłem (nie produkcyjny bootstrap).
3. Włącz opcje programistyczne/debug USB; podłącz kabel danych i zaakceptuj RSA.
4. Sprawdź `adb devices -l`: stan device. W razie unauthorized/sterownika napraw połączenie, bez kasowania aplikacji.
5. `Install` ustawi reverse, zweryfikuje APK i zainstaluje/uruchomi aplikację.
6. Przejdź checklistę [ANDROID_PHONE_TEST.md](ANDROID_PHONE_TEST.md); zapisuj wynik faktyczny, nie domyślny PASS.
7. W razie problemu uruchom `Logs`. Po odbiorze `Disconnect`, zakończ własny serve; opcjonalny supabase stop dopiero po uzgodnieniu, bez --no-backup/reset.

**Odpowiedź: TAK — przy działającym Dockerze, zgodnym telefonie/API24+, kablu danych i autoryzacji ADB możemy od razu rozpocząć instalację oraz lokalne testy. Nie brakuje zależności komputera ani APK. Nie jest to potwierdzenie, że sam telefon/sterownik/USB działają, ani gotowość do wydania SLM.**

Końcowy przegląd: git diff --check PASS; skan 8 zmienionych/nowych plików bez sekretów i artefaktów. Skompilowane AndroidManifest.xml i local_debug_network.xml w APK sprawdzono przez aapt2: konfiguracja sieci obecna, wyjątki HTTP tylko localhost/127.0.0.1. APK, metadane .cache, local.properties i pycache pozostają ignorowane. Zmienione pliki: AGENTS.md, docs/STATUS.md, docs/ANDROID_PHONE_TEST.md, docs/ANDROID_READINESS_REPORT.md oraz app/scripts/android-phone.ps1, android-phone-local.py, android-phone-fixture.ps1, android-phone-fixture.mjs.

## Zabezpieczenie przygotowania na GitHubie

Zmiany przeniesiono bez nadpisywania plików na chore/android-phone-readiness od origin/main 1fadd977d9737f371b75a59eee63ce6c50e4cb3b. Zachowano ignorowany checkpoint ośmiu plików sprzed przełączenia. Dozwolono nową gałąź w lokalnych skryptach i trzech helperach (accounts-admin-local.mjs, configure-auth-local.py, prepare-edge-local.py), bez zmiany ograniczeń adresu, Dockera, hooków i bezpieczeństwa Auth. Repozytoryjne guardy wyłączające auto-deploy Vercel pozostają aktywne. Poprzednie wyniki builda i APK opisują faktyczny przebieg na feat/integration; sam kod aplikacji i APK nie zmieniły się przy publikacji narzędzi. Użytkownik autoryzował commit/push/PR, ale nie merge ani wdrożenie.

Przed publikacją na nowej gałęzi ponowiono z wynikiem PASS: parsery PowerShell/Python/Node, TypeScript, ESLint, Backend action, fixture preflight bez tworzenia kont, kontrolę wszystkich 43 plików APK/podpisu/SecureStorage oraz release guard. SHA256 APK pozostaje bez zmian. Nie powtarzano builda i 190 testów Vitest z pierwotnego przygotowania, ponieważ kod aplikacji i konfiguracja natywna nie zmieniły się. Publikacja obejmuje 11 plików: cztery narzędzia android-phone, trzy lokalne helpery i cztery dokumenty/instrukcje. Bez APK, env, cache, danych kont i innych zmian użytkownika.

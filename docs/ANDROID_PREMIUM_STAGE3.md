# Android Premium Real Data — Stage 3

2026-10-28 17:50:29 Europe/Warsaw. Gałąź `test/android-premium-real-stage3`.
Baza PR21: `4b7e740261e4937e80470079a8d5d43e153de883`. Commit przygotowania kodu: `c6e224ea16c31a744a397310315d568f34117464`; kolejny commit raportu normalizuje tylko BOM/koniec pliku wejścia, ponowny build identyczny bajtowo z APK.
GitHub: PR18 `845d35e`,19 `54c2241`,20 `448a296`,21 `4b7e740` — zweryfikowane Draft/open, bez scalania. Stage3 zależy od21, nie main.

## Status

APK **GOTOWY**; backend hostowy skonfigurowany; ADB **PODŁĄCZONY** (`c7a559b5`, M2007J20CG, Android12). Instalacja **NIE WYKONANO**, test fizyczny **OCZEKUJE**. API z telefonu **NOT TESTED**: nie ustawiono tunelu ani nie uruchomiono aplikacji bez osobnej zgody.

## APK i odtwarzanie

Wariant: `android-stage3` → `dist-android-stage3` → Capacitor → assembleDebug.
Plik: `I:/slm/sunday-league-mates/.worktrees/android-premium-stage3/app/android/app/build/outputs/apk/debug/app-debug.apk`.
SHA-256: `b3f2f27b35a89beb72e3155e5bc63de2bf5f36bb20c0d0182276e5b19991ae6d`.

Pakiet `pl.psuda87.slm`, nazwa `Sunday League Mates`, versionCode1/versionName1.0, minSDK24/target36. Debug podpis potwierdzony apksigner; cert SHA256 `1324e26980d16dbdca3dac8830b752924960ab1bcd418f84083f549f00692457`, identyczny z obecnym APK telefonu. Nie jest to podpis wydania produkcyjnego.

Node24.14.0/npm11.9.0, JDK21.0.10 z Android Studio (jawnie zamiast PATH JDK17), SDK36. Zależności istniejące przez lokalny junction do account-foundation/app/node_modules; identyczny hash package-lock, bez instalowania lub zmiany zależności.

Z `app/` tego worktree:
```powershell
npx tsc --noEmit
npx vite build --config vite.android-stage3.config.ts
$env:SLM_ANDROID_STAGE3='1'
$env:SLM_LOCAL_ANDROID='1'
npx cap sync android
$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
$env:ANDROID_HOME='C:/Users/Suda/AppData/Local/Android/Sdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
Set-Location android
./gradlew.bat assembleDebug
```
Sync-generated ścieżki Gradle do współdzielonych zależności przywrócono do przenośnych wersjonowanych node_modules. APK/local.properties/assets/cache nie są commitowane. Domyślny LIVE i pozostałe warianty nieprzełączone. EnvDir:false i jawny endpoint eliminują .env/fallback Cloud z gotowego bundle. Istniejący wyjątek debug pozwala wyłącznie localhost, istniejąca kontrola Gradle blokuje release z mixed content. Release/AAB nie budowano.

## Połączenie — lokalnie, bez Cloud

Istniejący stack `slm-premium-real-finance`, API `http://127.0.0.1:64321/functions/v1/accounts`, UI przeglądarkowe5186. Origin WebView `https://localhost`. USB wymaga `adb reverse tcp:64321 tcp:64321`; aktualnie brak mapowań. Wi-Fi/LAN nie jest skonfigurowane, brak automatycznego fallbacku.

Wrapper lokalnego runtime pierwotnie zwracał403 Androidowi. Z katalogu głównego Stage3 wykonano:
```powershell
python app/scripts/prepare-android-stage3-cors.py I:/slm/sunday-league-mates/.worktrees/premium-real-finance
```
Helper sprawdza gałęzie, konkretną etykietę kontenera, identyczny handler i lokalny URL. Dopisuje tylko `https://localhost` do generowanego `.cache/premium-finance-stack/supabase/functions/accounts/premium-local.ts` w worktree Stage2. Runtime przeładował ustawienie. Kanoniczny kod Edge/SQL/RLS/Storage niezmieniony, bez deploy/migracji/restartów bazy. Powtórzenie preparera Stage2 może odtworzyć starą allowlistę — wtedy ponowić helper Stage3. Samo OPTIONS200 Kong nie dowodzi CORS; sprawdzono POST200 z Android origin i403 z obcego origin.

Nowy Auth pozostaje nieaktywny: rzeczywisty account_capabilities zwrócił cztery false. Wejście Stage3 wykorzystuje istniejące SessionManager/createProjectTokenStore i osobny namespace `slmfinanceandroiddev` (lokalna etykieta testu, nie projekt Cloud). Native wyłącznie SecureStorage; poprzedni klucz sesji nie jest czytany/czyszczony. Wymagane świeże logowanie kontem64321, nie Cloud/stare56321. Nie tworzono nowych kont; do odbioru potrzebne są istniejące lokalne konta Stage2 z rolami w grupie, hasła poza raportem.

## Wykonane kontrole

| Kontrola | Faktyczny wynik |
|---|---|
| TypeScript app + osobno nowe wejście TSX | PASS |
| ESLint | PASS, bez ostrzeżeń |
| Finance/Events/tokenStore/native Back | **25 PASS /4 pliki** |
| Zamrożone UI | **55 plików PASS**, bez zmian CSS/Ultimate/BottomNav/assets |
| Vite Premium Stage3 | PASS; ostrzeżenie wielkości chunku |
| Capacitor sync | PASS,6 pluginów |
| Gradle assembleDebug | PASS,275 zadań |
| Podpis/pakiet/debug/version | PASS, cert zgodny z obecną aplikacją |
| APK zasoby | PASS, bajtowo zgodne ze świeżym buildem również po normalizacji wejścia |
| Gotowy web bundle | Brak rozpoznanych JWT/secret-key/private-key wzorców i adresu projektu Cloud; nie pełny audyt binarny |
| HTTP origin Android/obcy origin/capabilities | PASS,200/403, wszystkie capabilities false |
| ADB odczyt OS/pakietu/podpisu poprzedniego APK | PASS |
| API przez telefon/tunel/logcat/uruchomienie/IME/resume | **NOT TESTED**, osobna zgoda jeszcze nieudzielona |

Poprzednie327Vitest/28HTTP/102SQL/3Chrome są dowodami PR21, nie nowymi wynikami Stage3. Nie powtarzano pełnej regresji lub migracji. Vector restartuje (zastany problem logowania), Auth/REST/Storage/API działają; ustawień Dockera nie zmieniano. Wszystkie stare dane i6 lokalnych zmian ui-beta zachowane.

## Bezpieczna instalacja i powrót — wyłącznie po osobnej zgodzie

Aktualizacja zastąpi kod obecnej aplikacji o tym samym pakiecie. install-r zachowuje dane, lecz nie jest backupem danych ani gwarancją zgodności dowolnego downgrade. Nie używać uninstall/pm clear/-d/resetu bazy. Zachowano odczytaną przez adb pull kopię obecnego kodu `.cache/previous-poco-base.apk`; nie eksportowano sesji ani danych prywatnych.

Poniższych poleceń **NIE WYKONANO**. Najpierw uzyskać zgodę na aktualizację i tunel:
```powershell
adb -s c7a559b5 reverse tcp:64321 tcp:64321
adb -s c7a559b5 reverse --list
adb -s c7a559b5 install -r app/android/app/build/outputs/apk/debug/app-debug.apk
```
Powrót po osobnej zgodzie: `adb install -r .cache/previous-poco-base.apk`, odtworzenie wcześniej znanego tunelu backendu, bez czyszczenia danych. Ten sam cert i versionCode potwierdzono; przy odmowie instalacji zatrzymać się. Przed powrotem ocenić zgodność danych.

## Odbiór POCO — wszystko OCZEKUJE

A. Administrator i zawodnik w64321: ta sama grupa/mecz po zmianie konta; zapis,2gości, limit/rezerwa/odmowa i ponowny odczyt. Mecz tworzy admin grupy, ręcznie podać termin/limit/miejsce.

B. Wyłącznie zakończony lokalny fixture: admin zatwierdza rozliczenie, zawodnik odczytuje należność, zgłasza część/całość, admin akceptuje, saldo/historia po restarcie. Bez gotowego zakończonego fixture oznaczyć BLOCKED, nie zmieniać zegara telefonu ani istniejących danych.

C. Oba Wstecz, minimalizacja/powrót, blokada/odblokowanie, restart, zmiana konta bez danych poprzednika, klawiatura kwoty/scroll nad BottomNav, Light/Dark, obrót jeśli obsługiwany. Po zatwierdzonej instalacji kontrola logcat, bez publikacji sekretów/PII.

Odpowiedź: `A grupy/mecz/zapis/goście/rezerwa: PASS/FAIL; B należność/wpłata/akceptacja/saldo/restart: PASS/FAIL; C Wstecz/tło/blokada/restart/konta/klawiatura/scroll/Light-Dark: PASS/FAIL`. Przy FAIL podać kroki, wynik oczekiwany/rzeczywisty i komunikat, bez haseł/tokenów/prywatnych danych.

## Decyzje podjęte samodzielnie

- Niezapisane pliki root → osobny worktree z PR21; żadnych nadpisań.
- Ryzyko starej sesji wobec nowej bazy → istniejący mechanizm namespace w jawnym wejściu; stare klucze zachowane, świeże logowanie.
- Lokalny CORS403 → tylko generowana allowlista i ścisły Android origin, bez zmian handlera/uprawnień.
- Dostępny telefon bez zgody na ingerencję → wyłącznie odczyty/kopia APK; brak instalacji/tunelu/uruchomienia. Hostowa gotowość nie jest PASS połączenia telefonu.

## BLOCKED / następny krok

Osobna zgoda na aktualizację i reverse64321, następnie fizyczny odbiór. P1 administracji meczem i ograniczenia DTO finansów pozostają z PR20/21. Cloud/SMTP/aktywacja nowego Auth poza zakresem i nadal zablokowane wcześniejszymi kryteriami. Bez merge, migracji, deploy, resetów i publikacji.

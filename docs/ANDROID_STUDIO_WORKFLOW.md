# Android Studio — codzienny workflow SLM

2026-10-29, Europe/Warsaw. Gałąź techniczna `chore/android-studio-workflow`, utworzona z **58a9babf257876e47cf6db269a0bf05d2e1db1f4** Stage 2B. PR27 pozostaje zależnym Draft PR, bez merge. Praca Codexa/React w VS Code; instalacja, Run i debug natywny przez Android Studio. Docker nie jest potrzebny do UI.

## Właściwy projekt

Otwórz **ten katalog** przez Android Studio → Open:

```text
I:\slm\sunday-league-mates\.worktrees\android-studio-workflow\app\android
```

To istniejący projekt Capacitor z tej gałęzi, z tym samym `pl.psuda87.slm` i nazwą Sunday League Mates. Nie tworzono drugiej aplikacji, applicationId ani ekranów. Nie otwieraj katalogu głównego repo jako projektu Gradle; nie korzystaj równolegle z projektu Android z innego worktree.

W tym zakresie nie przenoszono sześciu niezapisanych zmian `feat/ui-beta` do przypiętego Stage 2B. Wszystkie istniejące worktree i gałęzie zachowane. Dokumentacja audytu rozwinęła się po ea6180b o wpisy właściciela/instalację; nie zmienia to audytowanego kodu 58a9bab.

## Po zmianach w Codexie

Edytuj kod w **tym samym worktree**, które Android Studio ma otwarte. Terminal PowerShell:

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\android-studio-workflow\app'
git branch --show-current  # chore/android-studio-workflow
npm run android:ui
if ($LASTEXITCODE -ne 0) { throw 'Przygotowanie UI FAIL — nie naciskaj Run' }
npm run android:check
```

`android:ui` wykonuje istniejący verify, istniejący build:demo, jego izolację modułów/artefaktów i prawdziwe copy/update Capacitor do **tego samego** projektu Android. Nie uruchamia Dockera, Supabase, ADB, instalacji lub aplikacji. Domyślny UI zawiera obecne fikcyjne demo Premium 3.18, palety i istniejący symulator kont. To nie test prawdziwego Auth, finansów ani trwałego API składów 2B.

`android:check` sprawdza odcisk bieżących źródeł webowych, konfigurację wygenerowaną przez sync i wszystkie skopiowane pliki. Zmiana React/CSS/assetów, obce `cap sync` lub podmiana native assets powoduje FAIL. Uruchom ponownie właściwe przygotowanie, zamiast poprawiać hashe. Sprawdzenie jest lokalne i nie wykonuje builda/sieci. Sam commit dokumentacji nie unieważnia przygotowania.

Opcjonalny pełny build i otwarcie IDE, bez instalacji:

```powershell
.\scripts\android-studio.ps1 -Mode ui -Assemble -Open
# Szybka kontrola istniejącego przygotowania:
.\scripts\android-studio.ps1 -CheckOnly
```

Skrypt używa istniejącego JBR Android Studio, SDK i Gradle wrappera, a assemble działa offline. Zmienne JAVA_HOME/ANDROID_HOME są przywracane po skrypcie. Pierwsza instalacja zależności w nowym checkout: `npm ci` z istniejącym lockfile, bez aktualizacji wersji. Nie używać node_modules/junction z innego worktree. Nie trzeba ponownie instalować narzędzi.

### Co robi adapter Capacitor

Nie zmieniono `capacitor.config.ts`, istniejących Vite configs, poleceń build, routingu, manifestu/hashów Premium lub CI. CLI8.5.3 nie ma przełącznika `--config`; adapter używa jego rzeczywistych `loadConfig` i `syncCommand`, sprawdza dokładnie wersję8.5.3 i podaje **wyłącznie w pamięci tego procesu** webDir istniejącego demo. Po aktualizacji Capacitor adapter zatrzyma się do ponownego review.

UI synchronizuje `dist-demo`, LIVE synchronizuje `dist-android-stage3`. Adapter porównuje każdy skopiowany asset ze świeżym buildem, bo sam CLI może zalogować błąd copy bez propagowania wyjątku. Do wygenerowanej kopii HTML UI dodaje CSP z istniejącego demo/headers.json (`connect-src 'none'`); źródło demo i jego wygląd pozostają nietknięte. `frame-ancestors` nie działa w meta CSP; w natywnym opakowaniu brak warstwy nagłówków HTTP. Ograniczenie sieci connect-src jest obecne w APK. Dwa pliki generowane przez Capacitor zachowują dotychczasowe CRLF; nie jest to zmiana Gradle.

Potwierdzenie trybu/odciski znajdują się lokalnie w `app/.cache/android-studio/prepared.json` (ignorowane). Po zwykłym `npx cap sync android` konfiguracja źródłowa może wybrać domyślne dist, dlatego w tym workflow używaj powyższych komend. Android Studio nie przebudowuje samo React/Ionic; Run pakuje ostatnio przygotowane assets.

## Run na POCO

1. Po udanym przygotowaniu otwórz wskazany projekt. Poczekaj na Gradle Sync. W Build Variants wybierz **debug**, konfigurację uruchomienia **app**.
2. Na liście urządzeń wybierz **M2007J20CG / POCO X3 NFC**, nie emulator. ADB tej sesji potwierdził `surya`, Android12 i stan `device`.
3. **Run instaluje i uruchamia APK. W tym zadaniu go nie naciskano ani nie wykonano adb install/am start**; odbiór na urządzeniu wymaga osobnej decyzji właściciela. Przy własnym odbiorze właściciel wykonuje tę akcję świadomie.
4. UI i LIVE mają ten sam applicationId: zmiana trybu aktualizuje tę samą aplikację. Nie usuwać danych/uninstall w razie błędu podpisu. Ostatnio zainstalowany 29.10 o21:48 APK Stage2B pozostaje wcześniejszym artefaktem; nie jest nowym offline UI z tej gałęzi.

Odczyt ADB bez zmiany ustawień:

```powershell
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
& $adb devices -l
# Nie publikuj numeru seryjnego; przy pustej liście/unauthorized zatrzymaj odbiór.
```

Nie zmieniano sterowników USB, Windows, globalnego SDK/JDK, USB debugging, ustawień telefonu lub mapowania adb reverse.

## UI bez Dockera i LIVE z backendem

| Tryb | Komenda | Dane i sieć |
|---|---|---|
| UI, domyślny | `npm run android:ui` | Istniejące demo Premium3.18, fikcyjne dane/RAM. Bez accounts, SessionManager, Supabase lub endpointów w JS; CSP connect-src none; mixed content false. |
| LIVE lokalny Premium/Stage2B | `npm run android:live` | Istniejące android-stage3/main, B1/SessionManager i prawdziwe API. Endpoint **http://127.0.0.1:64321/functions/v1/accounts**; mixed content true wyłącznie jak w zatwierdzonym wariancie lokalnym. |
| Domyślne LIVE | `npm run build` | Istniejące src/main/App i domyślny Cloud fallback. Nie synchronizować do telefonu jako lokalnego testu. |
| Premium desktop | `npm run build:premium-local` | Istniejące B1, lokalny54321; nie jest automatycznie klientem backendu64321. |
| Premium-finance desktop | `npm run build:premium-finance-local` | Istniejący64321. |
| LIVE-local desktop | `npm run build:live-local` | Istniejący LIVE lokalny54321. |

LIVE przygotowuje się również przez `.\scripts\android-studio.ps1 -Mode live -Assemble`. To **nie uruchamia backendu**. Nie przechodź do funkcjonalnego odbioru bez zgodnego, osobno zatwierdzonego lokalnego stosu i świadomego USB reverse. `127.0.0.1` telefonu oznacza telefon, nie komputer. Nie kieruj lokalnego testu do Cloud.

Audyt wykazał: obecny64321 ma inny zestaw migracji i brak lineups;55321 ma40 kanonicznych, a Stage2A potrzebuje41. Stosy nie były uruchamiane, migrowane lub naprawiane w tym zadaniu. Sama synchronizacja APK nie potwierdza gotowości backendu. Plan izolowanego backendu znajduje się w raporcie na gałęzi `audit/premium-lineups-stage2b`: [audyt](https://github.com/psuda87/sunday-league-mates/blob/audit/premium-lineups-stage2b/docs/PREMIUM_LINEUPS_STAGE2B_AUDIT.md).

## Logcat i DevTools

Android Studio → **View → Tool Windows → Logcat**, wybierz POCO i filtr `package:pl.psuda87.slm`. Zacznij od `level:ERROR`/wyjątku, sprawdzaj własny proces. [Oficjalna instrukcja Logcat](https://developer.android.com/studio/debug/logcat). Nie eksportuj tokenów, haseł lub prywatnych DTO. `loggingBehavior=none` mostu Capacitor zachowano w obu trybach; nie włączać go dla diagnostyki.

**Chrome WebView DevTools pozostają niedostępne dla tych APK:** zatwierdzony [capacitor.config.ts](../app/capacitor.config.ts) ma `webContentsDebuggingEnabled=false`, co potwierdzono także w obu zbudowanych APK. `chrome://inspect/#devices` może widzieć telefon, ale nie udostępni tego WebView do Inspect. [Dokumentacja Chrome](https://developer.chrome.com/docs/devtools/remote-debugging/webviews) opisuje wymagane włączenie debugowania; tutaj nie zmieniano tego zabezpieczenia, chronionego przypięcia ani ustawień telefonu. [AGENTS.md](../AGENTS.md) wymaga osobnego review właściciela zmian strażników; ta konfiguracja jest przypięta w premium-route-policy.mjs. Pełny odbiór WebView DevTools pozostaje ograniczeniem tego zakresu, nie powodem do automatycznej zmiany hashy.

Do bieżącego debugowania React/CSS użyj **tego samego istniejącego demo** w Chrome na PC:

```powershell
npm run build:demo
npm run preview:demo
# Otwórz http://127.0.0.1:5175 i F12; po pracy Ctrl+C.
```

To nie jest druga implementacja UI ani natywny test WebView. Działa bez backendu, z obecnymi nagłówkami izolacji demo. Android Studio/Logcat służy diagnostyce opakowania natywnego, a fizyczny wygląd sprawdza się na POCO po zgodzie na Run.

## Typowe problemy

- **Zmiany React niewidoczne:** `npm run android:ui` lub android:live, potem android:check i dopiero Run. Sprawdź ścieżkę otwartego worktree; nie wykonuj npm w katalogu głównym feat/ui-beta.
- **Ekran logowania/błąd sieci zamiast demo:** przygotowano LIVE albo inny worktree. Ponownie android:ui; nowy APK musi zostać świadomie zainstalowany przez Run, sam build nie aktualizuje telefonu.
- **Nieaktywny Run/brak modułu app:** czekaj na Gradle Sync; otwórz app/android, Gradle JDK wybierz istniejący Embedded JBR. Nie aktualizuj automatycznie Gradle/AGP/SDK.
- **Offline Gradle nie znajduje zależności:** przerwij i sprawdź istniejący cache/SDK. Nie instalować nowych wersji lub zmieniać globalnych ustawień w celu maskowania błędu.
- **verify/izolacja/check FAIL:** zachowaj wynik; popraw źródła lub wykonaj właściwe przygotowanie. Nie aktualizuj hashy/manifestów ani nie omijaj sprawdzenia.
- **Telefon unauthorized/offline:** sprawdź kabel i status w urządzeniu; nie instalować sterowników ani nie zmieniać ustawień Windows automatycznie. Nie twierdzić, że test fizyczny przeszedł.
- **INSTALL_FAILED_UPDATE_INCOMPATIBLE/VERSION_DOWNGRADE:** zatrzymaj się. Bez uninstall, pm clear, -d lub zmiany applicationId.
- **Docker działa mimo testu UI:** workflow go nie uruchamia. Inne stosy mogą pracować niezależnie; nie wyłączać ich automatycznie. Inwentaryzacja: [DOCKER_INVENTORY.md](DOCKER_INVENTORY.md).

## Faktycznie sprawdzone

- Otworzono projekt w Android Studio2025.3.3 (build253.31033.145.2533.15113396). Log IDE potwierdził procesor Android Gradle, import projektu i `onImportFinished` 29.10 o22:01:55. Bez naciskania Run.
- JBR **OpenJDK21.0.10**, Gradle wrapper **8.14.3**, istniejący SDK compile/target36, min24; POCO Android12 spełnia minimum.
- UI i LIVE: istniejące web buildy, copy/update Capacitor, porównanie assets i **assembleDebug --offline PASS**. APK sprawdzono przez ZIP/config/CSP/JS, nie tylko po nazwie pliku.
- UI APK: **brak obu endpointów accounts, CSP connect-src none, dist-demo, logging none, WebView debug false, mixed content false**. LIVE APK: **tylko lokalny endpoint64321, dist-android-stage3, logging none, WebView debug false**. Oba mają pl.psuda87.slm. Potwierdzono odrzucenie podmienionego assetu i zmienionych źródeł przez android:check, potem przywrócono oryginalne bytes i PASS.
- **335 Vitest/53 pliki,37 policy,lint,TypeScript przez buildy,verify41/55/10,domyślny build PASS.** Nie osłabiano testów, przypięć ani manifestów. Ostrzeżenia odziedziczone: Vite/native loader, duże chunki i assety rozwiązywane w runtime; Gradle flatDir/deprecations i brak strip jednej biblioteki, build zakończony PASS.
- Docker pozostawał uruchomiony z cudzymi wobec tego testu zadaniami/stosami. Nie przeprowadzano testu po fizycznym zamknięciu Docker Desktop; brak zależności UI potwierdzają brak poleceń Docker/Supabase w workflow, izolowany bundle i CSP. Nie uruchomiono żadnego backendu do testu Studio.
- **Niewykonane:** instalacja/Run nowego APK, ręczny odbiór POCO, Logcat sesji nowego APK, WebView DevTools, backend LIVE E2E, Cypress i hosted CI. ADB jest wykryty; nie oznacza to fizycznego PASS aplikacji.

Stan końcowy projektu Android pozostawiono w trybie **UI** do późniejszego świadomego Run właściciela. Raport chronologiczny: `docs/ODPOWIEDZI_CODEX.txt`.

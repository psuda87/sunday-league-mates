# SLM 1.0 — frozen Premium 3.18, etap A

**Gałąź:** `feat/slm-v1-live`, nowy worktree `.worktrees/slm-v1-live`.
**Commit bazowy:** `d0f9fa9f840d2bd7f4985d00c24ee9a703f6b3e4`, bezpośredni rodzic commita implementacji.
**Nowy commit implementacji:** `1c4afb556fe3eb5fd7ea31e6c376c8d096f40a70`.
**Zakres:** oryginalne demo na Androida, bez integracji Supabase. Zatrzymanie do odbioru właściciela.

## Audyt i zależności

Zachowano root `feat/ui-beta` z jego lokalnymi zmianami i pozostałe worktree. Nie zmieniano istniejących gałęzi ani main; brak push/merge/resetu. Nowa gałąź nie pochodzi z integracji.

| Źródło sprawdzone lokalnie | HEAD przy audycie | Zastosowanie w etapie A |
|---|---|---|
| feat/ui-beta | d0f9fa9 | jedyna baza UI |
| feat/premium320-visual-parity | c6c2ff6 | zachowany WIP, nie przeniesiono UI/składów/kadrowania |
| feat/premium319-android | ac4954c | zachowane źródło wcześniejszej pracy, bez przenoszenia live |
| feat/premium318-live | 4b14e0c | odczyt sprawdzonego JDK/SDK/builda i mechanizmu Wstecz |
| chore/android-phone-readiness | ae9fac7 | odczyt konfiguracji Androida |
| feat/integration / main | 13cf1a8 / 1fadd97 | mapa istniejącego zaplecza; nie scalano i nie zmieniano |

Oryginalne wejście: `demo/main.tsx → ui/Demo → demo/AccountDemo → AccountScreens / demo/App`. App nadal używa oryginalnych Panels/Teams/Profile/Groups, MatchHero/MatchTabs, Ultimate, DemoBottomNav i reducerów RAM. Style: variables.css, palettes.css, account.css i Accounts.css. Branding i fikcyjne portrety pochodzą z public/assets; bez nowych grafik/fontów/breakpointów. Ekrany kont i powiadomienia zachowują ograniczenia symulatora.

`package-lock.json` i zależności bez zmian: Ionic 9, React 19, Capacitor 8, Vite 8, TypeScript 5.9. JDK Android Studio 21, SDK 36, minSdk 24. Backend/migracje/Edge/Storage/Auth z gałęzi integracyjnych pozostają wyłącznie mapą do późniejszego etapu B; nie wywoływano Supabase ani Dockera, nie zmieniano żadnej bazy.

## Zmienione oryginalne pliki UI — wyłącznie technicznie

| Plik | Uzasadnienie |
|---|---|
| demo/main.tsx | inicjalizacja niewizualnego mostu Android/Ionic Wstecz |
| src/demo/App.tsx | import po zmianie nazwy Groups; callback Wstecz korzysta z istniejących closeForm/pop/goHome i stanu zakładki |
| src/demo/AccountDemo.tsx | callback Wstecz używa istniejącego przejścia konta/do świata |
| src/demo/Profile.tsx | Wstecz zamyka istniejące edytory i ustawienia przed opuszczeniem karty |
| src/demo/Groups.tsx → GroupScreens.tsx | usunięcie kolizji Groups/groups.ts na Windows; callback Wstecz wywołuje istniejący home |

Nie zmieniono zwracanego wizualnego JSX, CSS, kolorów, odstępów, ikon, karty Ultimate, boiska ani dolnej nawigacji. Guard potwierdził 50 niezmienionych plików i 5 modułów z odwracalnymi zmianami technicznymi. Tekstowe końce linii Windows normalizowane przy porównaniu, grafiki rastrowe porównywane bajtowo. `git diff` dla src/ui, src/theme, src/account-ui i public/assets jest pusty.

Nowy src/native/frozenDemoAndroid.ts obsługuje kolejkę Ionic i klawiaturę bez nowych elementów UI. Capacitor ma opt-in `SLM_FROZEN_UI_ANDROID=1 → dist-demo`, nadal ten sam pakiet i wyłączone logowanie mostu. Manifest: adjustResize. Pliki Gradle wygenerowane przez cap sync dołączyły istniejący plugin status-bar; nie dodano zależności. Allowlista demo rozszerzona jedynie o niewizualny most. CSP/env/izolacja bez osłabiania.

Testy: Groups.test przemianowany z poprawą importu. eventAccess.test dostał zegar 19.10.2026, ponieważ oryginalne daty fixture są stałe, a test po ich upływie przestał sprawdzać przewidziany scenariusz. Nie zmieniono runtime/data.ts ani zasad demo.

## Wyniki

**PASS:** npm ci z lockfile, TypeScript, lint, **186/186 Vitest**, standardowy build, build:demo i izolacja **16 plików**, cap sync, assembleDebug, JUnit **1/1**, podpis/appId/nazwa oraz zgodność wszystkich 16 zasobów osadzonych w APK z dist-demo. APK nie zawiera modułów SessionManager/URL Supabase ani endpointów functions/v1.

**PASS przeglądarka:** **8/8** scenariuszy kandydata (320/360/390/430 × Light/Dark), **8/8** tego samego oryginalnego renderu oraz **1/1** testu callbacków Wstecz. Lista, szczegóły, uczestnicy, boisko, karty zawodników, grupy, profil, formularz meczu, login/rejestracja/recovery. Oryginalne interakcje reducerów, finansów, zamiany zawodników, profilu i kont objęte istniejącymi testami jednostkowymi. Backend zabroniony w testach demo.

**Wizualne:** porównano **88 par** z tymi samymi fixture, stanami, datą testową, motywami i rozmiarami. **87/88** ma identyczne piksele. Ścisły test zerowej różnicy: **FAIL dla 1/88**, details-320-light; różnice 12335 pikseli wyłącznie w obszarze obrazu hero (bbox 11,147–293,358), maksymalna różnica kanału **4/255**. Nie zmieniano UI, aby dopasować artefakt rasteryzacji. Obejrzano zrzuty listy, uczestników, boiska i Ultimate. Nie deklarujemy pełnej identyczności 1:1. PNG headless ma wysokość 625 px mimo żądanego viewportu 844; dowód dotyczy zarejestrowanych obszarów. 28 wybranych zrzutów oryginału/kandydata i wyniki w `docs/ui/slm-v1-stage-a/`.

**Ograniczenia testów:** bezpośrednia symulacja desktopowego `backbutton` nie uruchamiała kolejki Ionic w tym standalone buildzie. Końcowy test sprawdza rzeczywiste callbacki przez `ionBackButton` i priorytety; nie zastępuje natywnego testu. Ostrzeżenia chunk size/flatDir/aktualności Browserslist nie blokują buildów.

**NOT TESTED fizycznie:** ADB przy odbiorze nie wykrywa telefonu. Nie instalowano, nie uruchamiano i nie zbierano logcat nowego APK na POCO. Dotyk, natywna klawiatura/Wstecz, safe areas, dolny pasek Androida, wznowienie i rzeczywisty wygląd wymagają ręcznego odbioru. Auto/light/dark są oryginalnymi mechanizmami; nie wszystkie warianty Auto/systemowych ustawień potwierdzono fizycznie. Statyczne daty demo zachowano — scenariusze edycji wymagające przyszłego terminu trzeba wybierać zgodnie z oryginalną walidacją.

## APK i instalacja właściciela

**APK:** `I:\slm\sunday-league-mates\.worktrees\slm-v1-live\app\android\app\build\outputs\apk\debug\app-debug.apk`

**Pakiet:** pl.psuda87.slm, Sunday League Mates, versionName 1.0/code1.
**Rozmiar:** 6892821 bajtów.
**SHA256:** `b424136a9df449203bfe364032f0ee675f2e96b528a3a9c9b55d2210386a8db4`.

To demonstracja z fikcyjnymi danymi i symulatorem kont, bez logowania do lokalnego Supabase. Właściciel instaluje aktualizację, bez uninstall/clear-data:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices -l
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s c7a559b5 install -r "I:\slm\sunday-league-mates\.worktrees\slm-v1-live\app\android\app\build\outputs\apk\debug\app-debug.apk"
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s c7a559b5 shell am start -n pl.psuda87.slm/.MainActivity
```

Jeśli instalator zgłosi konflikt pakietu/podpisu, zatrzymaj się i przekaż komunikat; nie odinstalowuj istniejącej aplikacji. Ten build nie czyta ani nie usuwa poprzedniej sesji Supabase; nie potwierdzano zachowania danych po instalacji, ponieważ jej nie wykonano.

Odbiór: sprawdź Mecze → szczegóły → uczestnicy/Składy/Rozliczenie → karta zawodnika → powrót; Grupy i oryginalny plus; Profil i edytory; Light/Dark/Auto; przewijanie/safe areas/klawiaturę/Wstecz oraz Home → powrót. Konta: Narzędzia demo → Ekrany kont — wyłącznie fikcyjne dane. Nie jest to test rzeczywistego Auth.

**Blokery:** brak urządzenia ADB i akceptacji fizycznego wyglądu. Kod/APK gotowe do odbioru. Etap B nie został rozpoczęty; wcześniejsza zgoda na integrację nie zastępuje nowego punktu kontrolnego.

**ETAP A ZAKOŃCZONY — OCZEKUJĘ NA AKCEPTACJĘ UI PREMIUM 3.18 NA TELEFONIE.**

## Aktualizacja instalacji — 2026-10-24 01:46:54 Europe/Warsaw

[2026-10-24 01:46:54 Europe/Warsaw] Na polecenie „spróbuj teraz” ponowiono instalację etapu A. POCO c7a559b5 dostępny jako device. Weryfikacja APK PASS; adb install -r Success i start MainActivity PASS. SHA256 telefonu zgodne b424136a9df449203bfe364032f0ee675f2e96b528a3a9c9b55d2210386a8db4. firstInstallTime zachowane2026-10-23 21:38:01; lastUpdateTime2026-10-24 01:46:35. Proces działa,0sprawdzanych markerów FATAL/Uncaught/ERR/WebView w logach PID. Nie usuwano danych, nie zmieniano backendu, brak push/merge. Właściciel ma sprawdzić oryginalny wygląd demo, boisko, Ultimate, motywy i systemowy Wstecz; fizyczny odbiór oczekuje. Etap B nadal wstrzymany do wyraźnej akceptacji. Historia docs/ODPOWIEDZI_CODEX.txt.

## Ręczny odbiór wyglądu — 2026-10-24 02:06:16 Europe/Warsaw

[2026-10-24 02:06:16 Europe/Warsaw] Ręczny odbiór etapu A: użytkownik potwierdził „interfejs wygląda dobrze” oraz poprawne działanie ekranowej strzałki Wstecz. PASS ręczny dla wyglądu Premium3.18 i ekranowego powrotu. Systemowy przycisk/gest Androida, pełny zestaw motywów, klawiatura/safearea i lifecycle nie zostały tą wiadomością potwierdzone. Akceptacja wyglądu zapisana; etapu B nie rozpoczęto i nie wykonano zmian kodu/backendu/instalacji/push/merge. Następny krok po poleceniu użytkownika: etap B od Auth/sesji, z zachowaniem zamrożonego UI i porównaniem wizualnym. Raport docs/SLM_V1_STAGE_A.md; historia docs/ODPOWIEDZI_CODEX.txt.

## Potwierdzenie systemowego Wstecz — 2026-10-24 02:07:00 Europe/Warsaw

[2026-10-24 02:07:00 Europe/Warsaw] Użytkownik potwierdził również działanie systemowego Wstecz Androida na POCO — PASS ręczny. Wcześniejsze potwierdzenia wyglądu Premium3.18 i ekranowej strzałki pozostają PASS. Nie oznacza to pełnego testu klawiatury, wszystkich motywów, safearea ani lifecycle. Etap B nie rozpoczęty; brak zmian kodu/backendu/instalacji/push/merge. Raport docs/SLM_V1_STAGE_A.md; historia docs/ODPOWIEDZI_CODEX.txt.

## ETAP A ZAAKCEPTOWANY — 2026-10-24 02:08:09 Europe/Warsaw

[2026-10-24 02:08:09 Europe/Warsaw] Właściciel jednoznacznie zaakceptował cały ETAP A. Etap A zamknięty i zaakceptowany; wcześniejsze ręczne PASS: wygląd oryginalnego Premium3.18, ekranowa strzałka i systemowe Wstecz Androida. Akceptacja nie zmienia niewykonanych szczegółowych testów w PASS. Kolejny planowany zakres: B1 Auth/sesja jako adaptery do istniejącego UI, bez zmiany wyglądu. Nie rozpoczęto automatycznie etapu B, zgodnie z poleceniem wykonania wyłącznie A. Brak zmian kodu/backendu/instalacji/push/merge. Raport docs/SLM_V1_STAGE_A.md; historia docs/ODPOWIEDZI_CODEX.txt.

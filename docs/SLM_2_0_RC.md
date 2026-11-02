# SLM 2.0 RC — gotowy pakiet testowy

2026-11-02, Europe/Warsaw. **PASS integracji, guardów, builda APK i podstawowego Android LIVE; WARN pełnego zestawu szablonowych testów Android.** To działający lokalny kandydat ukończonych funkcji, nie produkcyjne wdrożenie ani implementacja odłożonych modułów.

## Jeden połączony kod

Gałąź **release/slm-2.0-rc** powstała z RC/PR30 `1575bef77f0b24a8c74373018895b7b872ebc06a`. Zwykłym merge dołączono PR31 `1b3aed659749f1084cab8cd4f47f99a54a50c8b9`, następnie historię acceptance do `ba6ef3069b565092a0675ac5ae907742bd78d89b` (w tym oryginalny `ae6bb4be2eafb9e5a8e70ef695242b40cc5d54cc`). Konflikt wyłącznie ODPOWIEDZI: wspólną historię zachowano raz, dopisane wpisy obu gałęzi w całości. STATUS i dokumenty Android/Cloud/odbioru zachowane.

Połączony commit kodu **a4ddd11d477d415d097ec5f18d444c003e7a2f3a** ma app/.github/AGENTS identyczne z zatwierdzonym PR31. Backend app/supabase jest identyczny z acceptanceae6bb4b. Zachowano ancestry d7b36eee379acf5036f8ea8aaeeea5f7791c8a04, cb63962e0ff4ccfbc4fb7157e4627beeee5ae8d5, runtime PR31 3f181e9/f2edf56, policy704e4a8, implementacjęCI7c45656 i pointer6e9ce9d. Aktywny pointer nadal wskazuje **7c45656ab89105ba53a53e7c1f2fd7049b762666**. Żadnych nowych pinów/wyjątków lub zmian aplikacji w tym zadaniu. Premium55 zachowane. Auth18/19 nie dołączono; nie scalano ponownie PR20–23 ani main.

## Faktyczne testy tego RC

| Kontrola | Wynik |
|---|---|
| TypeScript / ESLint / strict Edge | **PASS** |
| Vitest | **PASS372/372,56 plików** |
| Premium policy | **PASS53/53** |
| Consolidation / UI / import boundaries | **PASS42/55/11** |
| Source gate na dokładnym merge a4ddd11 | **PASS** w kanonicznym Linux checkout, aktywna implementacja7c45656 |
| Linux launch/SourceTests + negatywne source | **PASS29/29 +69 odmów**, wszystkie42 migracje/extra43,overlay,Auth/finance/lineup/UI/CI; finalny klon czysty |
| Cypress rzeczywisty formularz i CSS | **PASS6/6**, Chrome,320/360/390,Light/Dark i zmniejszony viewport |
| Chromium rzeczywiste składy + discovery | **PASS14+14** na połączonych źródłach i nowej realnej fixture42; SessionManager/GoTrue/Edge/PostgREST/PostgreSQL, race/stary wynik/retry/logout/100+5 |
| Nowa fixture do UI/telefonu | **PASS42 replay na schemacie GoTrue +11 core HTTP** przed callbackiem; callback następnie utrzymuje serwer do testowania, końcowe2 testy oryginalnego runnera nie są nowym wynikiem tej sesji |
| Relay dla Androida | **PASS9**: health,ściśle ograniczony CORS,odmowa obcego Origin/anon,real login,grupy,marker discovery,logout/revocation |
| Pełny SQL/RLS52 i HTTP44 | **NIE POWTARZANO**: backend identyczny z odebranym ae6bb4b; wyniki wcześniejszego odbioru pozostają ważnym dowodem, nie nowym uruchomieniem |
| Build web + Android Stage3 web | **PASS** |
| Capacitor sync + Gradle assembleDebug/testDebugUnitTest offline | **PASS**, podpis APK v2 zweryfikowany |
| Android insets na emulatorze | **PASS2/2**, dokładna klasa SlmWindowInsetsTest, rzeczywisty WebView oraz cutout/IME/padding |
| APK Android LIVE na emulatorze | **PASS** instalacja, cold start, poprawna odmowa starej sesji, nowe prawdziwe logowanie przez reverse64321→55421 i rzeczywiste prywatne/publiczne karty fixture |
| Cała instrumentacja Android,3 testy | **FAIL1/3**: stary ExampleInstrumentedTest oczekuje `com.getcapacitor.app`, rzeczywisty pakiet to `pl.psuda87.slm`; dwa insets PASS. Nie zmieniono ani nie ukryto testu |
| POCO / pełna ręczna checklista / Cloud / GitHub-hosted | **NOT RUN**; fizycznego telefonu nie instalowano/konfigurowano, Cloud/Actions bez operacji |

Gradle connectedDebugAndroidTest --offline nie znalazł cache dodatku UTP31.13.0. Bez instalacji nowych narzędzi wykonano rzeczywisty skompilowany test APK przez `adb -s emulator-5554 shell am instrument`; tam ujawniono powyższy błąd szablonowego package assertion. Celowane2 insets uruchomiono jawnie osobno, bez zmiany testów. Poprawienie szablonu wymagałoby rozszerzenia przypiętego kontraktu źródeł; nie jest potrzebne do uruchomienia aplikacji i nie zrobiono repin dla zielonego wyniku.

Początkowy Cypress nie wystartował przez odziedziczone ELECTRON_RUN_AS_NODE=1, a potem domyślny folder spec. Rzeczywiste uruchomienie: lokalnie usunięta ta zmienna i jawne `--config specPattern=cypress/guest-layout.cy.ts,supportFile=false`; spec oraz wszystkie jego asercje bez zmian. Pierwszy preflight nowego helpera porównał też plik testowy z24a59e1 sprzed jego dodania; poprawiono punkt odniesienia **całego** app/supabase na odebrany ae6bb4b. Odmowa nastąpiła przed utworzeniem kontenerów. Nie osłabiano guardów.

## APK i środowisko

Gotowy, podpisany debug APK:

`I:\slm\sunday-league-mates\.worktrees\slm-2.0-rc\.cache\slm2\slm-2.0-rc-debug.apk`

SHA256 **bdffa9c03976472efd3dfdb1bd05e47526c71acb77ffeb75dfffb7dd8a8b5fc7**,7869642 bajty. Pakiet `pl.psuda87.slm`. Nazwa dostarczenia to SLM2.0RC; odziedziczone Android versionName/versionCode pozostają **1.0/1**, identyfikuj ten build przez SHA/gałąź, nie sam numer Androida. Plik APK jest lokalnym ignorowanym artefaktem, nie dodano binariów do Git. [Metadane](review/slm2-apk-metadata.json).

Wariant **Premium Stage3 LIVE**, bez demo fallback. API w APK: **http://127.0.0.1:64321/functions/v1/accounts**. logging none, WebView debugging false, lokalny mixed content tylko debug; kod SlmWindowInsets i discovery obecne w artefakcie. Nie jest to build HTTPS do publicznej dystrybucji.

Nowy backend **http://127.0.0.1:55421** działa na tym komputerze. Cztery własne kontenery `slm-lineups-edge-36d8854dc0af` +auth/rest/edge, przypięte istniejące obrazy, network-none/wspólny namespace, bez opublikowanych portów. Tylko relay accounts binduje127.0.0.1:55421; nie odsłania GoTrue admin/REST/DB. Nowe fikcyjne konta/grupa/mecze/goście, bez zmian istniejących baz/kont/sekretów. Dane lokalnego logowania wyłącznie w `.cache/slm2/TEST-LOGIN.txt`; plik ignorowany, nie publikować. Stare środowisko41 i Cloud nie są celem APK przez podany reverse.

Helper [slm2-local-test-backend.py](review/slm2-local-test-backend.py) wykorzystuje **niezmieniony** runner z rzeczywistego dozwolonego Stage2B po dokładnym porównaniu backendu do odebranego źródła. Nie udaje brancha/CI. Resume sprawdza zapisane identyfikatory, obrazy, etykiety i izolację czterech własnych kontenerów; nie tworzy kolejnej bazy. Zajęty port jest odrzucany przed zmianą usług. Nie wymaga Supabase CLI lub nowych narzędzi.

Ten wariant testowy zapewnia prawdziwe accounts/Auth/SQL/RLS dla checklisty poniżej. Nie uruchamia Storage API/Kong/FCM; upload portretu i dostarczenie powiadomień nie są w nim odebrane. Nie przedstawiać SQL kontraktów Storage z fixture jako działającej usługi plików. Statystyki/gole/oceny i inne wcześniej odłożone funkcje nadal nie są implementowane przez samą integrację.

## Dokładne uruchomienie i instalacja POCO — do wykonania przez właściciela

Backend obecnie działa, nie uruchamiaj drugiej instancji. Po restarcie Windows uruchom Docker Desktop, następnie PowerShell:

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\slm-2.0-rc'
docker info --format '{{.ServerVersion}}'
# Jeśli engine jest wyłączony:
# Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe" -WindowStyle Hidden
# Poczekaj, aż powyższy docker info zadziała.
try { Invoke-RestMethod http://127.0.0.1:55421/healthz } catch { 'Relay nie działa — użyj resume poniżej.' }
# TYLKO gdy relay nie działa; zostaw terminal uruchomiony:
python -X utf8 -B docs/review/slm2-local-test-backend.py --fixture-repo 'I:\slm\sunday-league-mates\.worktrees\public-match-discovery-stage2b' --resume
# Ctrl+C w terminalu serwera zatrzyma wyłącznie jego cztery kontenery, zachowując dane.
```

Pierwsza konfiguracja w innym świeżym checkoutcie: ten sam helper bez `--resume`, po zapewnieniu prawdziwego Stage2B i istniejących digestów z runnera. Nie usuwaj obecnego pliku stanu ani bazy, aby wymusić ponowną inicjalizację. Obecnie nie jest to potrzebne.

W osobnym PowerShell, po podłączeniu POCO przez USB i zatwierdzeniu ADB na telefonie:

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\slm-2.0-rc'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
& $adb devices -l
$poco = 'WPISZ_DOKLADNY_SERIAL_POCO_Z_LISTY' # nie emulator-5554
& $adb -s $poco install -r '.cache\slm2\slm-2.0-rc-debug.apk'
if ($LASTEXITCODE -ne 0) { throw 'Instalacja nieudana; zachowaj dane aplikacji i odczytaj błąd, nie odinstalowuj automatycznie.' }
& $adb -s $poco reverse --list
& $adb -s $poco reverse --no-rebind tcp:64321 tcp:55421
if ($LASTEXITCODE -ne 0) { throw 'Mapa już zajęta lub ADB niedostępne — sprawdź wskazany serial i istniejącą mapę.' }
& $adb -s $poco shell am start -W -n pl.psuda87.slm/.MainActivity
notepad '.cache\slm2\TEST-LOGIN.txt' # lokalne fikcyjne konto admina i członka; nie wysyłaj pliku do GitHub
```

Komputer, Docker i relay muszą działać, a USB pozostać podłączone. Po odłączeniu lub restarcie urządzenia ponów wyłącznie reverse dla jego seriala. Jeśli widzisz „Sesja wygasła”, użyj „Wróć do logowania” i lokalnego konta z tego pliku; nie zmieniaj hasła istniejącego konta Cloud. Nie instalowano APK ani nie zmieniano konfiguracji POCO w tym zadaniu.

Odtworzenie APK: `npm run build:android-stage3`, ustaw w procesie `SLM_ANDROID_STAGE3=1` i `SLM_LOCAL_ANDROID=1`, `npx cap sync android`, następnie z JBR Android Studio/SDK `android\gradlew.bat -p android :app:assembleDebug --offline`. W świeżym checkoutcie użyj npm ci; bieżące zależności/lock zgodne, bez aktualizacji. Przy junction do istniejących node_modules przywróć przenośne względne ścieżki wygenerowanego capacitor.settings.gradle z bieżącego HEAD; nie commituj bezwzględnych ścieżek innego worktree. Artefakt Gradle: `app/android/app/build/outputs/apk/debug/app-debug.apk`.

## Krótka checklista ręczna

- [ ] Logowanie admina i członka, restart aplikacji, poprawny brak dostępu starej sesji/offline.
- [ ] Grupy: własna grupa „SLM 2.0 RC testy”, właściwe role i brak obcych prywatnych danych.
- [ ] Mecze: szczegóły prywatnego/publicznego, formularz tworzenia, limit i anulowanie.
- [ ] Zapisy/rezerwa: zapis i wycofanie na nowym testowym meczu, prawidłowe liczniki.
- [ ] Goście: numer z prefiksem/bez, błędny numer, klawiatura i przewijanie, szkic po błędzie, odpowiedzialność zapraszającego.
- [ ] Finanse: własne należności/zgłoszenie wpłaty, admin grupy i brak cudzych uprawnień.
- [ ] Składy: zapis A/B i ponowne otwarcie, goście, konflikt dwóch klientów, stary roster, brak nowego autora przy no-op.
- [ ] Publiczne: polskie znaki i `%_`, puste wyniki, paginacja105 publicznych fixture, zmiana zakresu i konta.
- [ ] Nawigacja, Light/Dark, status/nav bar, obrót i klawiatura bez podwójnego paddingu.
- [ ] Logout, powrót/tło i drugie konto: brak starego feedu lub szkicu.

**Rzeczywiste warunki rozpoczęcia testów POCO:** podłączyć/autoryzować USB, wykonać wskazaną instalację i reverse, użyć nowych lokalnych danych logowania. APK i backend już są przygotowane; nie blokuje ich Cloud lub stary backend41. Test szablonowy Android pozostaje znanym błędem testów, nie blokadą instalacji/logowania. [Zrzut emulatora LIVE](ui/slm2-rc/android-live.png), pozostałe bezpieczne zrzuty w ui/slm2-rc. Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

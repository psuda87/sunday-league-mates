# Odbiór Android PR24 — przygotowanie, 2026-10-28

**Nic nie zainstalowano na telefonie. Nie zmieniono tunelu ani danych istniejącej instalacji.**

Kod APK: dokładnie **`39ef2e3937b781439864029a92c12de315024263`**, PR24. Domyślny LIVE bez zmian. Gałąź przygotowania: `chore/android-main-acceptance`, z tego SHA; dodatkowe skrypty/CI nie są źródłem aplikacji w APK.

## Artefakt i wariant

- APK: `I:\slm\sunday-league-mates\.worktrees\android-main-acceptance\.cache\artifacts\slm-pr24-39ef2e3-premium-debug.apk`.
- SHA256: **`f02a654331cc46bd1af1779b0c9ec7f1aa609b8c5dee06ba5fe9090ae15281c7`**.
- Pakiet: `pl.psuda87.slm`; nazwa Sunday League Mates; debug, versionCode1/versionName1.0.
- Jawny wariant `SLM_ANDROID_STAGE3=1`: android-stage3/main → B1App → PremiumWorld → oryginalna prezentacja Premium z prawdziwymi adapterami. To nie jest domyślny LIVE ani izolowane demo.
- `SLM_LOCAL_ANDROID=1` włącza istniejący tryb debug dla lokalnego HTTP. `loggingBehavior=none`, WebView debugging wyłączone; debug network-security dopuszcza cleartext tylko localhost/127.0.0.1. Bez zmiany globalnego CSS/UI i produkcyjnej konfiguracji.
- Wbudowane API nadal **`http://127.0.0.1:64321/functions/v1/accounts`**. Telefonowy64321 należy skierować przez USB do **hostowego55321**. Nie używać hostowego64321 jako backendu tego odbioru.
- Podpis sprawdzony przez apksigner; cert SHA256: `1324e26980d16dbdca3dac8830b752924960ab1bcd418f84083f549f00692457`. Zgodny z zachowanym `android-premium-stage3/.cache/previous-poco-base.apk`. Telefon jest niewidoczny w ADB: zgodność z **aktualnie zainstalowanym** APK pozostaje do potwierdzenia.
- Nowy hash różni się od starego04e182… z audytu, ponieważ jawnie zsynchronizowano konfigurację lokalnego debug HTTP. Kod aplikacji pozostaje39ef2e3.

## Powtarzalny build z niezmiennego źródła

Wykonano build na czystym worktree PR24, z istniejącymi zależnościami lockfile, JDK21 i Android SDK36. Poniższa procedura tworzy osobny checkout bez przełączania katalogu z lokalnymi zmianami. Nie wykonuje push, instalacji ani operacji na bazie.

```powershell
$slmRepo = 'I:\slm\sunday-league-mates'
$slmSource = '39ef2e3937b781439864029a92c12de315024263'
$slmBuild = Join-Path $slmRepo '.worktrees\pr24-apk-39ef2e3'
# Jednorazowo. Jeśli katalog już istnieje: sprawdź SHA i czystość, nie nadpisuj go.
git -C $slmRepo worktree add --detach $slmBuild $slmSource
Set-Location $slmBuild
if ((git rev-parse HEAD) -ne $slmSource) { throw 'Inny commit' }
if (git status --porcelain) { throw 'Lokalne zmiany — przerwij' }
Set-Location app
npm ci --ignore-scripts
if ($LASTEXITCODE) { throw 'npm ci FAIL' }
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'C:\Users\Suda\AppData\Local\Android\Sdk'
$env:SLM_ANDROID_STAGE3 = '1'
$env:SLM_LOCAL_ANDROID = '1'
npm run build:android-stage3
if ($LASTEXITCODE) { throw 'Web build FAIL' }
npx cap sync android
if ($LASTEXITCODE) { throw 'Capacitor sync FAIL' }
Set-Location android
.\gradlew.bat assembleDebug --console=plain
if ($LASTEXITCODE) { throw 'Android build FAIL' }
Get-FileHash '.\app\build\outputs\apk\debug\app-debug.apk' -Algorithm SHA256
```

Przy powtórzeniu hash ZIP może zależeć od środowiska/narzędzi; zawsze zanotuj rzeczywisty hash i podpis nowego pliku. Przed instalacją używaj wskazanego wyżej odebranego artefaktu albo osobno zweryfikuj powtórzony build.

## Właściwy backend — bez migracji POCO

Projekt **slm-main-stabilization**, API55321, DB55322, **40 migracji** (35 main +4 PR23 +1 zgodności PR16). Auth18/online19 nieaktywne i poza źródłami. Backend używa wersjonowanego kodu PR24; nie jest usługą Cloud. Używana baza POCO na64321 pozostaje nietknięta.

Z gałęzi przygotowania, w jej worktree:

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\android-main-acceptance'
node app/scripts/prepare-android-acceptance.mjs
if ($LASTEXITCODE) { throw 'Backend niezgodny — nie instaluj' }
```

Skrypt sprawdza źródła względem39ef2e3 i kompletną historię40 kroków, odrzuca obecność kandydata Auth, nie resetuje i nie migruje istniejącej bazy. Jeżeli stack nie istnieje, przygotowuje nową instancję ze źródeł i uruchamia ją przez przypięty CLI2.121.0. Gdy instancja już działa, używa wyłącznie jej dedykowanych kontenerów i sprawdzonego montowania wewnątrz tego repozytorium. Nieznany drift zatrzymuje operację. Dopasowuje lokalny wrapper CORS i w razie potrzeby restartuje **tylko Edge runtime55321**, nigdy bazę ani usługę64321. Powtórzenie polecenia przeszło bez resetu i zmian danych.

Origin `https://localhost`/`http://localhost`/`capacitor://localhost` dociera do właściwego Auth; obcy origin jest odrzucany przez Edge403. Lokalny Kong emituje ACAO `*`, dlatego sprawdzono rzeczywiste POST i odmowę obcego originu, zamiast uznać samo OPTIONS za dowód. Bez haseł/tokens w logach i dokumentacji.

Przygotowane istniejące fikcyjne konta członka i administratora tej samej grupy są zapisane wyłącznie w lokalnym pliku:
`C:\Users\Suda\AppData\Local\Temp\SLM-PR24-ACCEPTANCE.txt`.
Nie commituj/nie wysyłaj tego pliku. To inne konta niż stare konta backendu64321. Nie zmieniano ich haseł ani uprawnień. Globalna rola może być member także dla administratora — uprawnienie administracyjne jest per grupa.

## Polecenia właściciela — dopiero po zgodzie na aktualizację

Najpierw uruchom backend jak wyżej i podłącz/odblokuj POCO. Polecenia poniżej **nie zostały wykonane**. Zachowaj stan tunelu i pobierz aktualny APK jako kopię kodu do ewentualnego powrotu. APK nie jest kopią danych aplikacji; allowBackup=false.

```powershell
$slmDevice = 'c7a559b5'
$slmApk = 'I:\slm\sunday-league-mates\.worktrees\android-main-acceptance\.cache\artifacts\slm-pr24-39ef2e3-premium-debug.apk'
$slmSigner = 'C:\Users\Suda\AppData\Local\Android\Sdk\build-tools\36.0.0\apksigner.bat'
$slmBackup = Join-Path $env:TEMP 'SLM-before-PR24.apk'
adb devices -l
adb -s $slmDevice shell getprop ro.product.model
adb -s $slmDevice shell getprop ro.build.version.release
adb -s $slmDevice reverse --list
adb -s $slmDevice shell dumpsys package pl.psuda87.slm | Select-String 'versionCode|versionName'
$slmInstalled = @(adb -s $slmDevice shell pm path pl.psuda87.slm) |
  Where-Object { $_ -match '/base\.apk\s*$' } | Select-Object -First 1
if (-not $slmInstalled) { throw 'Brak jednoznacznej ścieżki starego APK' }
adb -s $slmDevice pull ($slmInstalled.Trim() -replace '^package:','') $slmBackup
if ($LASTEXITCODE) { throw 'Nie pobrano kopii kodu APK' }
& $slmSigner verify --print-certs $slmBackup
& $slmSigner verify --print-certs $slmApk
Get-FileHash $slmApk -Algorithm SHA256
# Przerwij przy różnicy certyfikatu/pakietu/haszu lub nieobsługiwanej wersji.
# Po osobnej zgodzie właściciela:
adb -s $slmDevice reverse tcp:64321 tcp:55321
adb -s $slmDevice reverse --list
adb -s $slmDevice install -r $slmApk
if ($LASTEXITCODE) { throw 'Instalacja FAIL — bez uninstall/clear/downgrade' }
adb -s $slmDevice shell am start -n pl.psuda87.slm/.MainActivity
adb -s $slmDevice shell pidof pl.psuda87.slm
adb -s $slmDevice logcat -d -b crash -t 100
```

`install -r` zachowuje dane przy zgodności podpisu/pakietu i dopuszczalnej wersji. **Nie gwarantuje przeniesienia sesji między backendami.** Stage3 używa tego samego lokalnego namespace testowego; token starego backendu może zostać odrzucony i zastąpiony po nowym logowaniu. Preferencje/dane nie są czyszczone przez ADB, zdalne dane starego64321 zostają; potrzebna jest akceptacja świeżego logowania. Nigdy nie stosuj uninstall, pm clear ani install -d jako obejścia błędu podpisu/wersji.

Nie wysyłaj surowego logcat ani zawartości prywatnego pliku kont. Jeśli wystąpi błąd, podaj ekran, kroki i sam komunikat bez haseł/tokenów. Nie wykonuj logcat -c — nie jest potrzebny.

## Krótka checklista POCO

Zapisz każdy wynik PASS/FAIL/NOT TESTED. Wszystkie poniższe scenariusze telefonu pozostają **NOT TESTED** w tym przygotowaniu.

1. Start pokazuje Premium; logowanie kontem członka z nowego pliku, tło/powrót, zamknięcie/restart i oba Wstecz zachowują właściwe zachowanie.
2. Profil: własna karta Ultimate i dane, Light/Dark; nie oceniać fikcyjnych statystyk jako rzeczywistych. Nie musisz ponownie zmieniać zdjęcia, jeśli testujesz tylko wygląd.
3. Mecze: grupa z pliku, Wszystkie/Publiczne/Moje/Historia; obce prywatne mecze nie pojawiają się. Historyczny widok byłej grupy pokazuje wyłącznie własny udział. To można porównać ze wskazanym fixture z testów; brak takiego udziału = NOT TESTED, nie PASS.
4. Zwykły aktywny członek: plus otwiera oryginalny formularz, tworzy testowy mecz w swojej grupie z ręcznie podanymi terminem/miejscem/limitem/kosztem. Zapis/gość/rezerwa działają na prawdziwych danych.
5. Składy: utwórz **lokalny podgląd**, zamień dwie osoby dotknięciem, zakończ i cofnij. Nie oczekuj trwałego zapisu ani autora — backend składów nie istnieje.
6. Członek: własne należności i zgłoszenie niewielkiej fikcyjnej wpłaty do tej samej grupy; brak akcji admina. Zgłoszenie nie zwiększa salda do czasu akceptacji. Do należności użyj zatwierdzonego zakończonego fixture — nie zmieniaj zegara ani dat w bazie.
7. Wyloguj, zaloguj administratora grupy: znajdź i zatwierdź tę wpłatę; wróć na członka i sprawdź historię/status. Członek nie otrzymuje uprawnień finansowych przez utworzenie meczu. Bez prób edycji realnych danych64321.
8. Utrata sieci: **USB reverse nie zależy od Wi-Fi**, samo wyłączenie Wi-Fi nie potwierdza offline. Po akceptacji testu usuń tylko tunel testowy `adb -s c7a559b5 reverse --remove tcp:64321`, wróć do aplikacji; chronione dane powinny zostać ukryte i pojawić się błąd połączenia. Przywróć `adb -s c7a559b5 reverse tcp:64321 tcp:55321`, ponów odczyt. Nie resetuj bazy ani kontenerów.

Wklej: `start, login, resume/restart, profil/Light/Dark, filtry/historia, member-create, składy-swap/undo, member-payment, admin-accept, member-denial, offline/reconnect — PASS/FAIL/NOT TESTED`; przy FAIL kroki i bezpieczny komunikat. Brak przycisku admina jest tylko obserwacją UI; odmowy RPC/RLS zostały potwierdzone osobnymi testami serwera.

Po zakończeniu testów przywrócenie starego połączenia jest osobną świadomą czynnością: `adb -s c7a559b5 reverse tcp:64321 tcp:64321` i logowanie właściwym starym kontem. Nie wykonano tego automatycznie; najpierw porównaj zapisany stan tunelu. Powrót do starego kodu wymaga osobnej decyzji i zweryfikowanego backup APK.

## Wyniki przygotowania i ograniczenia

PASS: świeży build web Premium/TypeScript z39ef2e3, Capacitor sync, assembleDebug exit0, package/config/plik/podpis debug, zgodność z zachowanym poprzednim certyfikatem, 40 kroków backendu, 18 autentycznych kontroli API z originem Androida (login obu ról, profil, grupy, feed, uczestnicy, own account, admin200/member403, logout), CORS obcego originu403 i powtarzalność skryptu bez resetu. Backend zmieniono tylko w lokalnym wrapperze dev CORS/runtime55321; nie stosowano migracji.

Użyto wcześniejszych wyników audytu PR24 dla tworzenia/zgłaszania/zatwierdzania/historii; nie przedstawiamy ich jako ponownie wykonanych tutaj. Po zmianach skryptów: 9 testów kontekstu CLI/CI, 6 zestawów SQL/RLS na55321, TypeScript, lint, guard Premium i lokalny parser YAML przeszły. Status GitHub-hosted CI: **nie uruchomiono, przygotowane z bramką opt-in; bez niej job kończy się błędem przed testami**. Nie zastępuje to aktywnej ochrony. Szczegóły: `docs/MAIN_PROTECTION_PLAN.md`.

Ograniczenia: ADB nie widzi telefonu; instalacja/aktualny cert telefonu/tunel/logcat/resume są NOT TESTED. Cloud, rzeczywisty SMTP i FCM poza zakresem. Pozostają znane P2/P3 audytu; brak trwałego backendu składów. Warunki przed merge: odbiór właściciela, decyzja o ryzykach/ochronie i prawdziwe zielone kontrole po aktywacji; bez automatycznego merge.

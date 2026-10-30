# Android Studio — kandydat SLM1.0

30.10.2026. Projekt: `I:\slm\sunday-league-mates\.worktrees\slm-v1-release-candidate\app\android`. Branch `feat/slm-v1-release-candidate`, kod aplikacji dokładnie Stage2C/e246c51. Pakiet `pl.psuda87.slm`, nazwa Sunday League Mates.

**PASS:** build web/TypeScript, Capacitor sync, Gradle `assembleDebug --offline` na istniejącym JBR21/SDK36. Sprawdzono ZIP APK: właściwy wariant, lokalny endpoint, obecne discovery, brak Cloud endpointu accounts, logging none, WebView debug false. Dostępne AVD: Medium_Phone_API_36.1, Pixel_8_Pro, Small_Phone; WHPX działa. Nie instalowano ani nie uruchamiano APK w tym zadaniu; nie sprawdzono LIVE na emulatorze ani fizycznym POCO. Nie oznacza to testu Android12.

## Przygotowanie i build

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\slm-v1-release-candidate\app'
# W tym worktree zależności już są dostępne. package-lock.json niezmieniony.
# W świeżym checkoutcie użyć npm ci, zamiast kopiować lock z innej gałęzi.
npm run build:android-stage3
if ($LASTEXITCODE -ne 0) { throw 'Build web nie przeszedł' }
$savedStage3 = $env:SLM_ANDROID_STAGE3
$savedLocal = $env:SLM_LOCAL_ANDROID
try {
  $env:SLM_ANDROID_STAGE3 = '1'
  $env:SLM_LOCAL_ANDROID = '1'
  npx cap sync android
  if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync nie przeszedł' }
} finally {
  $env:SLM_ANDROID_STAGE3 = $savedStage3
  $env:SLM_LOCAL_ANDROID = $savedLocal
}
# Android Studio: File > Open, wskazać podany app\android.
# Wybrać istniejący JBR Android Studio i SDK; nie zmieniać package/applicationId.
```

W terminalu z istniejącym JBR/SDK można ponowić `android\gradlew.bat -p android :app:assembleDebug --offline`. APK: `android\app\build\outputs\apk\debug\app-debug.apk`, SHA256 w tej sesji **ca6de17a63b6de01f461b49bde95c8b2403edc6c809115b3a369cf585f70e1fc**. W tym worktree build wykonano z junction do wcześniej zainstalowanych zależności; generowane przez sync ścieżki pluginów przywrócono do przenośnych ścieżek HEAD i ponownie zaliczono Gradle. Nie przeniesiono zmian natywnych do commita.

Nie wybierać `npm run build` jako zamiennika: jest to istniejący domyślny LIVE/Home, nie pełny Premium Stage3. `build:demo` jest izolowanym demo bez backendu. `build:premium-local` używa54321; `build:premium-finance-local` i `build:android-stage3` używają64321. `.env` nie przełącza ich na Cloud, ponieważ jawny Vite ma envDir=false i przypięty URL.

## Adres API i warunek LIVE

Wbudowany adres APK to **`http://127.0.0.1:64321/functions/v1/accounts`**. Emulator musi otrzymać jawne ADB reverse do zatwierdzonego, odizolowanego backendu42 na komputerze. Cloud `hjtcyybkxebvdropchac` ma obecnie tylko7 migracji; zastany lokalny `slm-main-stabilization` na55321 miał41, więc nie należy uznać ich za gotowe discovery42 ani ich migrować w ramach tej instrukcji. Nowa referencja SQL z tego zadania jest zatrzymanym PostgreSQL, **nie serwerem GoTrue/Edge HTTP**.

Docelowy adres dla przyszłej nowej instancji testowej42: **`http://127.0.0.1:55421/functions/v1/accounts`**. Port55421 jest tu planem oddzielnego środowiska, nie deklaracją działającej usługi. Najpierw należy przygotować je z dokładnych42 migracji i całego Edge tego kandydata, z GoTrue/PostgREST i lokalnym entrypointem, bez dotykania baz istniejących. Przed użyciem sprawdzić projekt/źródła, komplet42, Auth health oraz `public_discovery_version===1` w autoryzowanym matches_list. Nie wystarczy health200 lub sama liczba migracji.

Po spełnieniu tego warunku:

```powershell
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
# Android Studio Device Manager: uruchomić istniejący AVD.
& $adb devices -l
# Wybrać WYŁĄCZNIE serial emulatora z listy. Przykład, nie gwarantowany numer:
$emulator = 'emulator-5554'
& $adb -s $emulator reverse --list
# Nie nadpisywać konfliktującej mapy; ustalić jej pochodzenie.
& $adb -s $emulator reverse --no-rebind tcp:64321 tcp:55421
# W Android Studio wybrać ten emulator i dopiero wtedy Run/Debug.
```

Komputer localhost i emulator localhost są różne. Powyższa mapa świadomie łączy APK64321→host55421; nie zmienia konfiguracji telefonu. W tym zadaniu nie ustawiono reverse ani nie wykonano Run/instalacji. Nie stosować poleceń bez `-s` przy podłączonym fizycznym urządzeniu.

## Debug i odbiór

Android Studio Logcat: wybrać proces `pl.psuda87.slm`, sprawdzać wyjątki AndroidRuntime/Capacitor, sieć i cykl życia; nie wypisywać haseł, JWT, refresh tokenów ani argumentów SecureStorage. Native Debug/Java breakpoints są dostępne dla debug APK. `webContentsDebuggingEnabled=false` i logging none są zatwierdzonym zabezpieczeniem — nie obiecujemy DOM inspection przez chrome://inspect i nie włączamy go automatycznie. Testy kontrolerów w przeglądarce: `npm run test.unit -- --run src/events/discoveryUi.test.tsx`; to nie jest test emulatora.

Odbiór na nowym lokalnym backendzie: prawdziwe logowanie/sesja po restarcie, grupy i prywatność, mecze/zapisy/goście/rezerwa, zapis składów/konflikt/no-op/stary roster, Publiczne/query/strony100+5, rozliczenie w zakresie ról, logout i zmiana konta. Używać wyłącznie nowych fikcyjnych danych lokalnych; brak demo fallback. Dopiero osobno zaakceptowany build HTTPS może trafić do odbioru Cloud. Obecnego lokalnego APK nie publikować jako release; nie wystarczy przełączyć allowMixedContent na false, a historyczny guard adresowy release wymienia54321, nie64321. Wymagany dodatkowy przegląd artefaktu i kontraktu transportu.

Gotowość: **BUILD PASS / emulator dostępny / LIVE odbiór NOT RUN i zależny od nowego backendu42**. Supabase i wdrożenie: [plan](SUPABASE_RC_DEPLOYMENT_PLAN.md). Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

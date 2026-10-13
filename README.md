# Sunday League Mates

Aplikacja mobilna dla jednej zamkniętej grupy grającej w piłkę na orliku. Docelowo ma obsługiwać zapisy na mecze, gości i rezerwę, ewidencję składek, oceny zawodników i wyrównywanie drużyn. Pierwszą platformą jest Android; wspólny kod umożliwia późniejsze przygotowanie iOS.

Obecny etap obejmuje polski ekran startowy, konfigurację i projekt Android. Konta, baza danych, rozliczenia i powiadomienia nie zostały zaimplementowane.

Wymagania: [specyfikacja](docs/SPECYFIKACJA_SOCCER_APP.md). Ustalenia są obowiązujące, propozycje wdrożeniowe i punkty otwarte wymagają zatwierdzenia. Nazwa **Sunday League Mates** i stos Ionic React + TypeScript + Capacitor zostały potwierdzone podczas przygotowania projektu; pozostałe decyzje otwarte nie zostały domknięte. Backend i usługi push pozostają propozycjami.

## Struktura

- `app/src/` — kod aplikacji i test jednostkowy.
- `app/public/` — statyczne zasoby i manifest webowy.
- `app/cypress/` — testy przeglądarkowe.
- `app/android/` — źródła projektu Android i Gradle Wrapper.
- `docs/` — dokumentacja biznesowa.
- `AGENTS.md` — instrukcje pracy nad repozytorium.

Identyfikator aplikacji: `pl.psuda87.slm`. Interfejs i komunikaty: język polski. Ikony i ekrany splash pozostają zasobami szablonu; wygląd produktu wymaga osobnego ustalenia.

## Środowisko i wersje

Zweryfikowano na Windows: Node.js `24.14.0`, npm `11.9.0`, React `19.0.0`, Ionic React i router `9.0.7`, TypeScript `5.9.3`, Vite `8.3.4`, Capacitor core/CLI/Android `8.5.3`, ESLint `9.39.5`, Vitest `4.1.11`, Cypress `16.1.1`. Dokładne wersje zależności zapisuje `app/package-lock.json`; lokalny wykaz: `npm ls --depth=0` w `app/`.

Do Androida potrzebne są Android Studio, JDK 21 i Android SDK Platform 36. Projekt używa min SDK 24, compile/target SDK 36 oraz Gradle Wrapper 8.14.3. Zweryfikowano build z JDK 21.0.10 dołączonym do Android Studio. Systemowe JDK 17 nie wystarcza do kompilacji kodu Capacitor 8.

## Instalacja i uruchomienie na Windows (PowerShell)

Z głównego folderu repozytorium:

```powershell
Set-Location app
npm ci
npm run dev
```

Otwórz adres wypisany przez Vite (domyślnie `http://localhost:5173`). Serwer zatrzymasz przez `Ctrl+C`. Instalacja pakietów i pierwsza kompilacja Androida mogą wymagać dostępu do sieci.

Ten etap nie wymaga pliku `.env`. Lokalne `.env` i `.env.*` są ignorowane, z wyjątkiem `.env.example`. Przykłady konfiguracji nie mogą zawierać sekretów; zmienne udostępniane klientowi nie są bezpiecznym miejscem na klucze serwera.

## Build webowy i Android

Polecenia w `app/`:

```powershell
npm run build
npx cap sync android
npx cap open android
```

Build webowy trafia do `app/dist/`. Synchronizacja kopiuje go do projektu Android i aktualizuje konfigurację pluginów. Po zmianach kodu webowego ponownie wykonaj build i synchronizację. Platforma Android jest już dodana; `npx cap add android` jest poleceniem jednorazowym, nie należy powtarzać go w istniejącym projekcie.

Kompilacja APK z PowerShell w `app/` (domyślna lokalizacja Android Studio):

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
.\android\gradlew.bat -p android assembleDebug
.\android\gradlew.bat -p android :app:lintDebug :app:testDebugUnitTest
```

Jeśli narzędzia zainstalowano gdzie indziej, dostosuj ścieżki. W Android Studio wybierz JDK 21 w ustawieniach Gradle JDK. SDK można wskazać zmienną środowiskową lub lokalnym, ignorowanym plikiem `android/local.properties`.

APK debug: `app/android/app/build/outputs/apk/debug/app-debug.apk`. Jest to build do testów, nie podpisana wersja do publikacji. Źródła Androida i `package-lock.json` pozostają w repozytorium, a zależności, buildy, lokalne ustawienia IDE i skopiowane zasoby webowe są ignorowane. Platforma iOS nie została dodana; jej lokalny build wymaga macOS i Xcode.

## Kontrole

W `app/`:

```powershell
npm run build
npm run lint
npm run test.unit -- --run
```

Test E2E wymaga działającego serwera. W pierwszym terminalu uruchom:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

W drugim terminalu, również w `app/`:

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run test.e2e -- --config baseUrl=http://127.0.0.1:5173
```

Usunięcie zmiennej dotyczy tylko bieżącego terminala i pozwala uruchomić aplikację Cypress poprawnie. Testy używają domyślnie zainstalowanego Chrome; lokalnie i w CI potrzebna jest wspierana wersja tej przeglądarki.

Weryfikacja przygotowania projektu (13.10.2026): build webowy, ESLint, test jednostkowy (1/1), Cypress E2E (1/1), dodanie/synchronizacja Androida i `assembleDebug` zakończyły się powodzeniem. Build webowy ostrzega o chunkach powyżej 500 kB; test jednostkowy zgłasza ostrzeżenia React Router oraz `act`, a Gradle ostrzega o `flatDir`. Cypress zgłasza przestarzałą bazę Browserslist i ostrzeżenia Node dotyczące starszych API. Instalacja npm zgłosiła 12 podatności: 9 moderate, 2 high, 1 critical. Nie wykonano automatycznych aktualizacji zależności ani `npm audit fix --force`.

Android `:app:lintDebug` i `:app:testDebugUnitTest` również zakończyły się powodzeniem (1 test szablonu). Nie uruchamiano testów instrumentacyjnych ani aplikacji na urządzeniu/emulatorze.

Późniejszy [audyt zależności](docs/AUDYT_ZALEZNOSCI.md) z tego samego dnia: zaktualizowano Vitest do 4.1.11. Po migracji Cypress do 16.1.1 aktualny wynik to 0 critical, 0 high i 6 moderate. extract-zip został usunięty. Audyt produkcyjny pozostaje na poziomie 3 moderate dotyczących routera. Po poprawce ponownie przeszły build, lint, test jednostkowy, E2E, synchronizacja Androida i kompilacja APK.

# SLM 1.0 — fizyczny Android, lokalny backend

Przygotowanie: 19.10.2026. Gałąź do przeglądu: `chore/android-phone-readiness`, utworzona od `origin/main` po PR #2/#3. Skrypty lokalne dopuszczają tę gałąź oraz historyczną `feat/integration`; nie przełączają gałęzi samodzielnie.
Ta instrukcja NIE oznacza odbioru na urządzeniu. Obecnie ADB nie wykrywa telefonu.
Wszystkie komendy PowerShell poniżej uruchamiaj z `I:\slm\sunday-league-mates-integration\app`.
Nie używaj zdalnego bootstrap-admin.ps1, PAT ani pliku .env.auth-proof.

## 1. Komputer i lokalny backend

Uruchom Docker Desktop w trybie Linux containers i poczekaj na działający silnik.
Nie trzeba uruchamiać Vite: APK zawiera zbudowaną aplikację, a nie live reload/demo.

```powershell
cd I:\slm\sunday-league-mates-integration\app
.\scripts\android-phone.ps1 -Action Backend
```

Skrypt sprawdza lokalny socket Dockera, bazę `supabase_db_sunday-league-mates`, listę wszystkich 29 migracji, Auth, hooki blokujące wiadomości, natywne CORS i ochronę Edge. Jeśli baza nie działa, uruchamia oficjalny CLI 2.121.0 lokalnie, bez `link`, `db push`, `db reset`. Przy zimnym starcie wyklucza wyłącznie opcjonalny kolektor Vector z powodu znanego błędu socketu; nie używa ignore-health-check i nie otwiera Docker TCP. Istniejącej bazy nie resetuje. Niezgodność migracji zatrzymuje preflight zamiast zgadywać naprawę.
Następnie używa istniejących lokalnych narzędzi hardeningu Auth i przygotowania Edge. Oryginalne kontenery Auth, gdy wymagają zastąpienia, pozostają jako zatrzymane kopie; dane bazy pozostają bez zmian. Jeśli Edge już działa, skrypt go zachowuje. Inaczej uruchamia go w bieżącym terminalu — zostaw ten terminal otwarty. Nie wypisuje kluczy CLI ani surowych logów runtime.

API: `http://127.0.0.1:54321`; Studio komputera: `http://127.0.0.1:54323`.
Aplikacja wywołuje wyłącznie lokalny `http://127.0.0.1:54321/functions/v1/accounts`; Edge obsługuje Auth/RPC i bazę wewnątrz Dockera. Telefon nie potrzebuje portów PostgreSQL ani Studio.

```powershell
.\scripts\android-phone.ps1 -Action Check
```

CORS: aplikacja Android używa `https://localhost`, przyszłe iOS `capacitor://localhost`. Lokalne origins są dopuszczone w lokalnym entrypoincie. Kong może odpowiadać ogólnym nagłówkiem na preflight; rzeczywisty POST z obcego origin jest odrzucany przez handler. Brak sesji daje 401, obcy origin 403. Nie zmieniano zdalnych CORS.

## 2. Fikcyjne konta, bez SMTP/SMS

W drugim terminalu utwórz kolejno dwa konta lokalne:

```powershell
.\scripts\android-phone-fixture.ps1
```

Podaj wybrany fikcyjny adres w domenie `phone-fixture.invalid` (np. `phone-owner@phone-fixture.invalid`, potem `phone-player@phone-fixture.invalid`). Hasło wpisujesz dwukrotnie w ukrytym polu terminala; minimum 8 znaków, maksymalnie 72 bajty UTF-8. Nie wpisuj hasła jako argumentu komendy, do pliku, dokumentacji, logów ani rozmowy. Skrypt przekazuje je wyłącznie przez stdin do lokalnego Admin API i nie zapisuje go poza Supabase Auth. Istniejącego konta nie nadpisuje ani nie resetuje.
Admin API potwierdza TYLKO fikcyjne konto lokalne przez `email_confirm=true`; nie wysyła wiadomości i nie zmienia globalnych ustawień rejestracji. To nie jest test doręczenia ani produkcyjnej weryfikacji e-mail. Nowe konto ma zwykłą rolę; adminem swojej grupy zostaje dopiero po utworzeniu grupy. Nie otrzymuje globalnego admina ani cudzych finansów.
Te nowe konta e-mail używają od razu własnego hasła; nie udawaj testu hasła tymczasowego legacy. Istniejący scenariusz wymuszonej zmiany/resetu jest osobno pokryty automatycznymi testami Auth. Do testowania go na telefonie potrzebny świadomie przygotowany lokalny fixture legacy, nie prawdziwe konto z chmury.
Nazwy, grupy i wydarzenia twórz jako fikcyjne. Jeżeli testujesz opcjonalny kontakt, używaj nieużywanego numeru testowego z zerami; nigdy nie wybieraj połączenia z losowym prawdziwym numerem.
Danych ręcznego odbioru nie usuwa się automatycznie przy zamknięciu skryptu. Nie resetuj bazy i nie używaj szerokich cleanupów; po odbiorze ustal osobne sprzątanie dokładnie tych fixture i ich historii.

## 3. Telefon: opcje programistyczne i ADB

Wymagany Android 7/API24 lub nowszy, aktualny Android System WebView/Chrome i kabel USB obsługujący dane.

1. Ustawienia telefonu → Informacje o telefonie → Numer kompilacji (czasem Informacje o oprogramowaniu). Dotknij 7 razy, odblokuj PIN-em urządzenia.
2. W Opcjach programistycznych włącz Debugowanie USB.
3. Podłącz kabel do komputera. W razie potrzeby wybierz tryb przesyłania plików.
4. Zaakceptuj na telefonie klucz RSA tego komputera. Nie akceptuj nieznanych komputerów.

```powershell
$slmAdb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
& $slmAdb devices -l
```

Oczekiwany stan: `device`. `unauthorized`: odblokuj telefon i zaakceptuj RSA; `offline`: sprawdź kabel/połączenie. Brak urządzenia: sprawdź kabel danych i właściwy sterownik USB producenta. Nie instaluj sterowników i nie zmieniaj ustawień Windows automatycznie. Przy wielu urządzeniach dodaj do skryptu `-Serial IDENTYFIKATOR`.

## 4. Połączenie, instalacja i uruchomienie

Gotowy APK: `app/android/app/build/outputs/apk/debug/app-debug.apk`.
Przed instalacją możesz go przebudować po zmianach:

```powershell
.\scripts\android-phone.ps1 -Action Build
```

Build ustawia zmienne wyłącznie dla tego procesu i przywraca poprzednie wartości: lokalne API, push off, SLM_LOCAL_ANDROID=1 i JDK21 z Android Studio. Wykonuje web build, cap sync, assembleDebug/testDebugUnitTest, kontrolę zgodności APK z dist, podpisu, SecureStorage i oczekiwanej blokady release. Metadane i SHA256 zapisuje w ignorowanym `.cache/android-phone-build.json` (bez sekretów).

Gdy telefon jest autoryzowany:

```powershell
.\scripts\android-phone.ps1 -Action Install
```

Skrypt sprawdza backend i APK, wymaga autoryzowanego urządzenia/API24+, ustawia `adb reverse tcp:54321 tcp:54321`, instaluje APK przez `install -r` i uruchamia `pl.psuda87.slm/.MainActivity`. Nie instaluje niczego w trybie Check/Backend/Build.
`127.0.0.1` w APK oznacza telefon; dopiero reverse przesyła ten port przez USB do komputera. Po ponownym podłączeniu/restarcie telefonu ustaw reverse ponownie.
Pakiet pozostaje `pl.psuda87.slm`, nazwa `Sunday League Mates`. Jeśli na telefonie istnieje inna wersja aplikacji, ta sama sygnatura/pakiet może spowodować aktualizację; odmienny podpis da INSTALL_FAILED_UPDATE_INCOMPATIBLE. Skrypt nie odinstalowuje aplikacji, nie czyści danych i nie obchodzi tego błędu — najpierw ustal zachowanie istniejącej instalacji. Do lokalnego odbioru używaj wyłącznie fikcyjnych kont.

Odpowiednik ręczny:

```powershell
& $slmAdb reverse tcp:54321 tcp:54321
& $slmAdb reverse --list
& $slmAdb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
& $slmAdb shell am start -n pl.psuda87.slm/.MainActivity
```

## 5. Alternatywa Wi-Fi bez otwierania API

Android 11+: telefon i komputer w tej samej zaufanej sieci lokalnej. Włącz Bezprzewodowe debugowanie i wybierz parowanie kodem. Użyj wskazanych na telefonie prywatnych IP i portów; port parowania i port połączenia są różne:

```powershell
& $slmAdb pair IP_TELEFONU:PORT_PAROWANIA
& $slmAdb connect IP_TELEFONU:PORT_DEBUGOWANIA
& $slmAdb devices -l
.\scripts\android-phone.ps1 -Action Install -Serial IP_TELEFONU:PORT_DEBUGOWANIA
```

Kod parowania wpisz tylko do interaktywnego promptu ADB, nie zapisuj go w dokumentach/logach. Po zestawieniu transportu skrypt używa tego samego `adb reverse`, więc APK i adres localhost pozostają bez zmian. Nie wystawiaj portu 54321 na LAN/publiczny internet, nie ustawiaj 0.0.0.0 w Vite, nie włączaj adb tcpip 5555 ani Docker TCP2375. Firewall/izolacja klientów Wi-Fi mogą blokować samo ADB — nie zmieniaj ich automatycznie. Dla starszego Androida lub blokady parowania napraw USB/sterownik zamiast obniżać zabezpieczenia. Ten wariant jest PRZYGOTOWANY, nie sprawdzony na urządzeniu.

## 6. Sesja, callbacki i lokalny tryb debug

Android przechowuje wyłącznie refresh token w SecureStorage/Keystore; hasło nie jest zapamiętywane. Native nie ma fallbacku do Preferences/localStorage. Przy starcie i powrocie z tła SessionManager odświeża sesję i potwierdza stan dostępu na serwerze, zanim odsłoni dane. Brak backendu/internetu ma pokazać stan niedostępności, nie stare chronione dane. Logout usuwa zapis lokalny. Test rzeczywistego Keystore i cyklu życia wymaga telefonu; Vitest nie jest jego potwierdzeniem.
Obecne logowanie hasłem działa przez API i nie używa przekierowań przeglądarki. Samorejestracja/weryfikacja/recovery i linki callback NIE są aktywne; custom_url_scheme w strings.xml nie stanowi kompletnego Android intent-filter/deep link. Nie wpisuj fikcyjnych redirect URL do zdalnego panelu i nie uznawaj tych scenariuszy za zaliczone.
HTTP jest dozwolone tylko w debug dla localhost/127.0.0.1; base-config pozostaje cleartext=false. allowMixedContent włącza się przez SLM_LOCAL_ANDROID=1, a loggingBehavior=none i WebView debugging=false pozostają zachowane. Kontrola release ma odrzucić takie ustawienia przed zadaniami Gradle. Nie używaj tego APK jako release. Przed przyszłym wydaniem potrzebny osobny build/sync z zaakceptowanym HTTPS i przeglądem wdrożenia backendu.

## 7. Logi i zakończenie

Po uruchomieniu aplikacji:

```powershell
.\scripts\android-phone.ps1 -Action Logs
```

Tylko PID procesu SLM, filtrowanie etykiet haseł/tokenów/autoryzacji i maskowanie JWT/adresów e-mail. Most Capacitor nie loguje argumentów. Domyślnie nic nie zapisuje się na dysk. Jeśli potrzebny plik, zapisuj wyłącznie oczyszczony output do ignorowanego `.cache`, sprawdź go przed udostępnieniem; nie zbieraj surowego logcat wszystkich aplikacji ani nie publikuj logów Auth/sekretów. Po ubiciu/restartowaniu aplikacji uruchom Logs ponownie (zmienia się PID).
Ctrl+C kończy podgląd. Następnie:

```powershell
.\scripts\android-phone.ps1 -Action Disconnect
```

Usuwa wyłącznie mapowanie portu SLM. Jeśli backend uruchomiono w terminalu, zakończ własny proces serve przez Ctrl+C. Istniejącego runtime używanego przez inne terminale nie zatrzymuj w ciemno.
Opcjonalnie, dopiero gdy nikt nie korzysta z lokalnego Supabase:

```powershell
npx --yes --package=supabase@2.121.0 supabase stop
```

Bez `--no-backup` i bez `db reset`; dane zachowaj. Wyłącz debugowanie bezprzewodowe po odbiorze. Nie odinstalowuj aplikacji i nie czyść jej danych bez potrzeby.

## 8. Checklista odbioru — wszystkie pola na razie NIEODHACZONE

- [ ] Instalacja i uruchomienie bieżącego APK; brak ekranu symulatora demo.
- [ ] Logowanie kontem lokalnym, poprawny i błędny login/hasło, profil.
- [ ] Zamknięcie/usunięcie aplikacji z ostatnich → ponowne otwarcie bez logowania przy działającym backendzie.
- [ ] Powrót z tła potwierdza dostęp; brak połączenia ukrywa chronione dane i pozwala ponowić.
- [ ] Wylogowanie → zamknięcie → otwarcie pokazuje logowanie; ponowne logowanie działa.
- [ ] Utworzenie fikcyjnej grupy; wyszukiwanie po minimum 2 znakach nazwy.
- [ ] Drugie konto prosi o dołączenie, administrator akceptuje; sprawdzenie uprawnień członka.
- [ ] Edycja nazwy grupy: obecnie BRAK w live UI, zadanie #4; zapisać jako niedostępne, nie implementować teraz.
- [ ] Tworzenie meczu w swojej grupie z własną godziną i świadomie wybranym limitem (np. 10 dla fixture), poprawna data Europe/Warsaw.
- [ ] Publiczny i prywatny mecz: widoczność oraz dostęp odpowiednio dla członka i osoby spoza grupy.
- [ ] Zapis, duplikat, rezygnacja, gość z/bez kontaktu, oddzielna rezerwa; brak automatycznego awansu po rezygnacji.
- [ ] Kontakt „Zadzwoń” otwiera dialer bez wykonywania połączenia; nie dzwoń na fikcyjne numery.
- [ ] Odwołanie meczu i zamknięcie zapisów na początku według czasu serwera.
- [ ] Obecność oraz finanse zakończonego meczu: ocenić gdy rzeczywiście upłynie jego termin. Nie fałszuj zegara ani dat finansowych w istniejącej bazie dla szybkiego zaliczenia.
- [ ] Własne finanse, zgłoszenie wpłaty, zatwierdzenie przez uprawnionego; brak cudzych finansów między grupami.
- [ ] Celowa wpłata vs FIFO grupowe, dwie nadwyżki i globalny status zapisów: część wymaga przygotowanej historii zakończonych meczów. Automatyczne testy już je obejmują, ręczny odbiór nie jest zaliczony.
- [ ] Dolna nawigacja, powroty z grup/meczów/finansów, klawiatura, safe-area i mały ekran.
- [ ] Przycisk „+”: obecny live BottomNav zawiera Mecze/Grupy/Profil, nie docelowy centralny plus. Sprawdzić dostępne „Utwórz mecz” i zapisać różnicę, nie odhaczać nieistniejącego plusa.
- [ ] Ponowne uruchomienie po restarcie telefonu: ponownie skonfigurować reverse; sprawdzić sesję.

## 9. Otwarte zadania i funkcje zablokowane

Przeczytano [#4](https://github.com/psuda87/sunday-league-mates/issues/4), [#5](https://github.com/psuda87/sunday-league-mates/issues/5), [#6](https://github.com/psuda87/sunday-league-mates/issues/6). Nie implementowano ich UX. Docelowo: **Mecze | Grupy | + | Profil | Ustawienia**, centralny czerwono-bordowy plus lekko wystający nad pasek; profil i ustawienia rozdzielone. Obecne live UI ma 3 zakładki; wygląd demo nie jest potwierdzeniem wdrożenia docelowego paska.
Bez SMTP/domeny/legal/callbacków: nie testujemy realnej samorejestracji, weryfikacji i resetu e-mail. Bez Firebase/FCM: nie testujemy doręczenia push ani systemowego tokena dostawy. Bez osobnego rollout zdalnego backendu: nie testujemy działania tej integracji poza lokalnym komputerem. iOS i CAPTCHA pozostają poza tym odbiorem. Nie zmieniano zakresu, rozliczeń ani grafik.

Źródła: [Android ADB](https://developer.android.com/tools/adb), [fizyczne urządzenie](https://developer.android.com/studio/run/device), [konfiguracja Capacitor](https://capacitorjs.com/docs/config).

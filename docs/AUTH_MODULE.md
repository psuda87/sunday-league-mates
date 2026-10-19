# Moduł kont Sunday League Mates

Stan: 13.10.2026, branch `feat/auth`, wyłącznie projekt `hjtcyybkxebvdropchac`.
Zaimplementowano minimalny moduł kont i wdrożono go na polecenie użytkownika.
Administrator istnieje; użytkownik potwierdził podstawowe ręczne testy Androida.
Test zmiany technicznego e-maila przeszedł po jednej próbie 13.10.2026.
Wyniki i rozróżnienie testów ręcznych/automatycznych: [AUTH_PROOF.md](AUTH_PROOF.md).
CAPTCHA jest odłożona poza bieżący etap; nie włączać i nie integrować.
Użytkownik potwierdził na Androidzie zapamiętywanie sesji, ekran logowania po logout
oraz tworzenie/reset zawodnika z panelu. Dodatkowe scenariusze unieważniania sesji,
offline i iOS nadal nie mają potwierdzenia ręcznego.

## Zapamiętywanie i przywracanie sesji

Bezpłatny plugin MIT `@aparajita/capacitor-secure-storage@8.0.1` obsługuje Capacitor 8.
Android: AES-GCM, klucz w Android Keystore, wyłącznie szyfrogram w prywatnych
SharedPreferences pluginu. Nie jest to zapis tokenu przez Capacitor Preferences.
iOS: Keychain, `whenUnlockedThisDeviceOnly`, synchronizacja iCloud wyłączona.
Nie dodano jeszcze platformy iOS i nie zweryfikowano jej kompilacji na Windows.
Plugin dodał zależność `@capacitor/ios@8.5.3`, zgodną z obecnym stosem Capacitor 8.

Zapis obejmuje **tylko refresh token** pod prefiksem tego projektu. Hasło, access token,
profil, rola i flaga zmiany hasła nie są trwale zapisywane. Access token i świeży stan
dostępu istnieją tylko w pamięci po odpowiedzi serwera. Przy braku pluginu lub błędzie
magazynu na urządzeniu nie ma fallback do zwykłych Preferences/localStorage; ekran
jest zablokowany i umożliwia ponowienie lub usunięcie sesji.

Web ma jawnie osobną politykę: refresh token jest w localStorage pod kluczem
`slm.auth.hjtcyybkxebvdropchac.refresh.v1`, co pozwala ponownie otworzyć przeglądarkę.
Nie jest zaszyfrowany ani chroniony przed XSS; taki magazyn nie zapewnia właściwości
Keystore/Keychain. Nie stosujemy pozornego szyfrowania z kluczem przechowywanym obok.
Nie ma trwałego cache chronionych profili. Nie dodano płatnej usługi ani backendu cookies.

Przy starcie lub powrocie z tła UI pokazuje „Sprawdzanie sesji…”, a serwerowy refresh
wykonuje Supabase Auth oraz aktualny gate SQL (żywa sesja, wersja, aktywność, rola,
trwająca operacja i wymóg zmiany hasła). Dopiero po sukcesie i zapisaniu obróconego
refresh tokenu można wyświetlić dane. Zapis lokalny nie jest źródłem uprawnień.
Hasło tymczasowe nadal prowadzi tylko do wymuszonej zmiany i logout.

Odświeżanie wykonujemy także około minutę przed wygaśnięciem access tokenu oraz
przed żądaniem, gdy zbliża się jego koniec. Jeden refresh jest aktywny naraz w danym
widoku; podczas zmiany hasła/aliasów czeka na nową sesję. Zapis magazynu jest
serializowany, a logout unieważnia generację operacji: spóźniona odpowiedź nie zapisze
tokenu ponownie. Nie powtarzamy automatycznie operacji zmieniających konta.

Brak internetu/przejściowa niedostępność: refresh pozostaje zapisany, ale chronione
dane są ukryte. „Spróbuj ponownie” i powrót połączenia uruchamiają ponowną weryfikację.
Wygasły/cofnięty refresh lub sesja odrzucona przez gate usuwa zapis i wymaga logowania.
Reset administratora usuwa zatwierdzenia starej sesji w bazie; nawet jeśli Auth wyda
JWT po odświeżeniu, endpoint go nie dopuszcza. Stara sesja nie odzyskuje dostępu po
zakończeniu zmiany nowego hasła tymczasowego.

Logout zawsze próbuje usunąć zapis lokalny przed zakończeniem sesji na serwerze.
Offline usuwa lokalny token i informuje o braku potwierdzenia zdalnego; nie udajemy,
że inne kopie tokenu zostały unieważnione w Auth. Jeśli sam magazyn OS odmówi usunięcia,
UI pokazuje błąd i nie potwierdza sukcesu — należy ponowić logout. Nie obiecujemy
wymazania danych przy awarii systemu plików. iOS Keychain może przetrwać reinstalację
na tym samym urządzeniu; nie jest to mechanizm transferu sesji na inny telefon.

`loggingBehavior='none'` wyłącza logi mostu, które mogłyby zawierać argumenty pluginu.
Wyłączono inspekcję WebView Androida i backup danych; Android 12+ ma osobne reguły
wykluczające także transfer między urządzeniami. Dane nadal muszą być dostępne dla
kodu aplikacji po odblokowaniu; zabezpieczenie magazynu nie chroni przed XSS,
zainfekowaną aplikacją ani całkowicie przejętym systemem. Nie zweryfikowano operacji
vault na fizycznym urządzeniu ani na iOS; kompilacja i mocki nie zastępują tego testu.

Źródła: [plugin i platformy](https://github.com/aparajita/capacitor-secure-storage),
[API Keychain](https://github.com/aparajita/capacitor-secure-storage/blob/main/src/definitions.ts),
[sesje i rotacja Supabase](https://supabase.com/docs/guides/auth/sessions),
[konfiguracja Capacitor](https://capacitorjs.com/docs/config),
[backup Androida](https://developer.android.com/identity/data/autobackup).

## Architektura i reguły dostępu

Hasło przechowuje i sprawdza tylko Supabase Auth. Każde konto ma losowy, stabilny adres
`UUID@slm.invalid`, administracyjnie potwierdzony bez wiadomości. Telefon nie trafia do
`auth.phone`; jest identyfikatorem aplikacji. Serwer mapuje telefon i login do jednego
UUID oraz technicznego adresu. Nie ma signup, invite, recovery, OTP ani zmiany adresu w kodzie modułu.

| Tabela | Przeznaczenie | Dostęp klienta |
|---|---|---|
| slm_profiles | Opcjonalne imię i nazwisko, wybór nazwy | SELECT wyłącznie aktywnych członków z zatwierdzoną sesją po zmianie hasła |
| slm_aliases | Login, jego normalizacja, telefon, techniczny e-mail | Brak bezpośrednich grantów; własne dane przez API, lista przez administratora |
| slm_roles | Jedna aktualna rola member/admin | Brak grantów |
| slm_account_security | Aktywność, wymóg zmiany, wersja, trwająca operacja | Brak grantów |
| slm_account_sessions | Zatwierdzone session_id dla danej wersji | Brak grantów |
| slm_account_audit | Wykonawca, cel, rodzaj i czas zakończonej operacji | Brak grantów; bez treści żądania, haseł i tokenów |
| slm_account_rate_limits | Haszowane klucze liczników prób, retencja 1 dnia | Brak grantów |

Wszystkie tabele mają RLS. Brak polityk dla tabel serwerowych jest zamierzoną odmową,
a nie brakującym zabezpieczeniem. Zapisy profili i aliasów obsługuje funkcja serwerowa.
Profile można odczytać także bezpośrednio przez PostgREST, ale ich polityka weryfikuje
własną sesję przez `slm_private.current_session_valid()`. Brak stanu, wygasły JWT,
brak sesji w Auth, trwająca operacja, stara wersja lub hasło tymczasowe oznaczają odmowę.

Edge Function `accounts` używa REST Auth/PostgREST bez dodatkowego SDK. Nie loguje
payloadów, haseł, nagłówków ani tokenów. Jej `verify_jwt=false` pozwala wejść do logowania
i refresh; wszystkie pozostałe operacje same weryfikują token przez Auth i aktualny
stan SQL. CORS nie stanowi autoryzacji. Role pochodzą z tabeli; metadane i parametr
`role` klienta nie nadają administratora. RPC dotyczące zatwierdzania sesji,
provision, zakończenia operacji i naprawy mają EXECUTE tylko dla service_role.

Hasło tymczasowe blokuje wszystkie operacje poza status, zmianą hasła i logout.
Zmiana hasła, aliasów i reset najpierw podnoszą wersję i usuwają zatwierdzenia starych
sesji, następnie kończą operację z konkretnym UUID. Nowa sesja jest zatwierdzana dopiero
po sukcesie; reset pozostawia wymóg zmiany. Login odczytuje wersję przed sprawdzeniem
hasła, aby reset w trakcie logowania nie zatwierdził starego uwierzytelnienia w nowej wersji.
Kontrolę tego wyścigu wykonuje test jednostkowy; nie jest to zdalny test obciążeniowy.

Wylogowanie najpierw odbiera zatwierdzenie w SQL, potem próbuje zakończyć sesję Auth.
Nawet przy awarii drugiego kroku wcześniejszy JWT i refresh nie przywracają dostępu
aplikacji. Bezpośrednie Auth może nadal uznawać sam JWT do jego wygaśnięcia; chronione
dane i API muszą zawsze sprawdzać gate sesji. Nowe tabele biznesowe wymagają tej samej
ochrony w RLS oraz reguł właściciela/roli; nie kopiować samego `TO authenticated`.

## Normalizacja i ograniczanie prób

- Login: 3–32 znaki, NFC, pierwsza litera, dalej litery Unicode, cyfry, `_`, `.`, `-`.
  W bazie unikalna postać `lower(login)`; otaczające spacje są usuwane. Nie przyjmujemy
  loginu wyglądającego jak telefon. To opis bieżącej implementacji, nie nowa propozycja biznesowa.
- Telefon: domyślnie Polska, dokładnie 9 cyfr; dopuszczalne +48, 0048 oraz spacje, nawiasy i myślniki. Zapis +48XXXXXXXXX. W formularzach stały prefiks +48. Bez weryfikacji SMS. Istniejących zagranicznych aliasów nie przepisujemy: logowanie nadal działa, a niezmieniony numer można zachować przy edycji innych danych. Nowe numery są polskie.
- Nowe hasło: co najmniej 8 znaków i najwyżej 72 bajty UTF-8 (granica bcrypt).
- Tworzenie konta i reset generują dokładnie 12 znaków base64url z 9 kryptograficznie losowych bajtów (72 bity entropii). Limit 12 znaków dotyczy generatora, nie własnego hasła użytkownika. Hasło tymczasowe nadal wymaga zmiany.
- Zmianę minimum Auth odtwarza `node app/scripts/configure-password-policy.mjs`: zmienia wyłącznie `password_min_length` na 8 i sprawdza niezmienność limitów oraz blokad wiadomości. Wdrożona funkcja `accounts`: wersja 5.
  Zmiana wymaga obecnego hasła przez Auth; samo pole UI nie jest zabezpieczeniem.
- Administrator otrzymuje nowo wygenerowane hasło tylko w odpowiedzi create/reset;
  ekran przechowuje je w pamięci do ukrycia/wylogowania. Nie istnieje odczyt obecnego hasła.
- Limity aplikacji w stałych oknach 60 s: globalnie 300 żądań, login 16 na alias
  i 16 łącznie na konto, operacje wrażliwe 8 na konto, administracyjne 20, refresh 120
  globalnie. Baza atomowo nalicza próby i usuwa liczniki starsze niż dzień.
  Nie zmieniono natywnych limitów Supabase.

CAPTCHA jest odłożona poza bieżący etap na polecenie użytkownika. Nie prowadzimy
integracji i nie włączamy jej. Zachowano wszystkie obecne ograniczenia prób.
Nie wprowadzono limitu IP zależnego od niezaufanych nagłówków.
Natywne Auth jest publiczne i zachowuje własne limity. Techniczny e-mail w JWT nie jest
sekretem; wrapper nie ukrywa API Auth. Ograniczenie globalne chroni koszt pracy,
ale napastnik może czasowo ograniczyć dostęp całej grupie. Przed publiczną dystrybucją
należy osobno dobrać bezpłatną ochronę przed nadużyciami i przetestować większą liczbę prób.
Nie uruchomiono dodatkowej usługi ani płatnej ochrony wyciekłych haseł.

## Ustawienia Auth

`app/scripts/configure-accounts.mjs` odtwarza wymagane ustawienia wyłącznie tego projektu.
Odczytuje konfigurację, odmawia zastąpienia cudzych hooków lub istniejącej CAPTCHA,
wykonuje PATCH dozwolonych pól i sprawdza, że limity `rate_limit_*` się nie zmieniły.

| Ustawienie | Wymagana wartość |
|---|---|
| disable_signup | true |
| external_email_enabled | true |
| external_phone_enabled, external_anonymous_users_enabled | false |
| security_manual_linking_enabled | false |
| mailer_autoconfirm | false (potwierdzenia włączone) |
| mailer_secure_email_change_enabled | true |
| hook_send_email_enabled / hook_send_sms_enabled | true |
| hook_send_email_uri | pg-functions://postgres/public/slm_account_block_email |
| hook_send_sms_uri | pg-functions://postgres/public/slm_account_block_sms |
| wszystkie mailer_notifications_*_enabled | false |
| security_update_password_require_current_password | true |
| security_update_password_require_reauthentication | false (nie korzystamy z nonce wysyłanego wiadomością) |
| password_min_length | 8 |

Hooki zwracają błąd i nie zawierają kodu wysyłki. Phone jest wyłączony; nie skonfigurowano
SMS ani SMTP. Potwierdzenia e-mail i blokujący hook muszą pozostać aktywne.
Historyczne 429 nie dowodziły działania hooka. Nowa pojedyncza próba z 20:31:26 UTC
13.10.2026 zwróciła 403 z `SLM_EMAIL_DISABLED`; adres i brak oczekującej zmiany
sprawdzono przez Admin API. Nie zmieniano limitów i nie wykonywano retry.
Dashboard: Authentication → konfiguracja dostawców, haseł i Auth Hooks; dokładne nazwy
pól API w tabeli są źródłem ustawień, gdy nazwy sekcji panelu się zmieniają.
Ochrona HaveIBeenPwned jest płatna, więc pozostaje wyłączona.

## Uruchomienie klienta

Z głównego katalogu w PowerShell:

```powershell
git branch --show-current
Set-Location app
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Otwórz `http://127.0.0.1:5173`. Backend jest już wdrożony, administrator istnieje.
Nie uruchamiaj ponownie bootstrap i nie resetuj jego hasła podczas testów fikcyjnych kont.
Klient nie potrzebuje klucza Supabase; publiczny adres funkcji jest domyślny i opisany
w `app/.env.example`. Refresh token jest zapamiętywany zgodnie z polityką platformy;
ponowne otwarcie wymaga weryfikacji serwerowej, a nie zawsze ponownego logowania.
UI zawiera login, wymuszoną zmianę, profil, zmianę aliasów
i hasła oraz tworzenie/reset/listę kont dla administratora.

Dozwolone originy funkcji: localhost i 127.0.0.1 na porcie 5173 oraz natywne
`https://localhost`, `capacitor://localhost`. Przed hostingiem webowym należy
jawnie ustawić `ACCOUNTS_ALLOWED_ORIGINS` w konfiguracji Edge Function
(lista rozdzielona przecinkami); nie używać wildcard. To niesekretna konfiguracja.
Zmiana adresu klienta przez `VITE_SLM_FUNCTION_URL` nie omija listy originów.

## Odtwarzanie wdrożenia

Źródła: `app/supabase/migrations/` i `app/supabase/functions/accounts/`.
Historia lokalna odpowiada rzeczywistym wersjom migracji MCP:

1. `20261013185250_slm_auth_proof_setup.sql` — historyczna baza proof; zachowana,
   aby odtworzyć wcześniejsze zależności proof przed migracją modułu.
2. `20261013191910_accounts_module.sql` — docelowy model i zamknięcie dostępu proof.
3. `20261013193036_accounts_session_hardening.sql` — wąskie helpery sesji,
   walidacja przed zapisem aliasów i blokada podwójnego bootstrap.
4. `20261013193844_accounts_recovery_and_permissions.sql` — naprawa trwale
   przerwanej operacji i odebranie klientom RPC istniejącego triggera RLS.

W tym projekcie migracje już zastosowano przez MCP. Nie uruchamiać ich ponownie ręcznie.
Dla dalszych zmian można użyć CLI 2.120.0 po ustawieniu PAT w konfiguracji procesu
(bez wpisywania jego wartości w poleceniu) i bezpiecznej konfiguracji hasła bazy.
Alternatywnie MCP `apply_migration` z treścią pliku. Przed użyciem CLI odczytać `--help`.

Z `app/`, po lokalnym skonfigurowaniu `SUPABASE_ACCESS_TOKEN` i ewentualnie
`SUPABASE_DB_PASSWORD` poza repozytorium i historią terminala:

```powershell
npx --yes supabase@2.120.0 db push --project-ref hjtcyybkxebvdropchac --skip-vault --dry-run
# Sprawdź plan migracji, następnie:
npx --yes supabase@2.120.0 db push --project-ref hjtcyybkxebvdropchac --skip-vault
npx --yes supabase@2.120.0 functions deploy accounts --project-ref hjtcyybkxebvdropchac --use-api --no-verify-jwt --import-map supabase/functions/accounts/deno.json
node scripts/configure-accounts.mjs
```

Nie używać `--prune` ani globalnego push konfiguracji. `--use-api` nie wymaga Dockera
dla tej funkcji. Wdrożenie MCP wersji 4 jest aktywne; kod ma własne sprawdzanie JWT.
Refresh rozróżnia niedostępność/limit Auth od potwierdzonego cofnięcia sesji,
aby awaria serwera nie usuwała prawidłowego zapisu po stronie klienta.
Domyślne sekrety SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY dostarcza runtime — nie kopiować
ich do źródeł lub `VITE_*`. Lokalny PAT jest czytany z ignorowanego
`app/.env.auth-proof` albo środowiska wyłącznie przez narzędzia właściciela.
Hasła bazy nie używa aplikacja, Edge Function ani test Node; może być potrzebne CLI.
Nie przetestowano odtwarzania na drugim/pustym projekcie; nieautoryzowane projekty nie są używane.
Migracja uprawnień dotyczy istniejącej w bazie tego projektu funkcji
`public.rls_auto_enable()`; jej definicja nie jest częścią modułu i nie jest odtwarzana
przez te pliki. Nie używać historii jako kompletnego eksportu dowolnej nowej bazy.

## Pierwszy administrator — interaktywnie, przygotowane do lokalnego wykonania

**Administrator już istnieje. Poniższa procedura jest zachowana na przyszłość;
nie uruchamiaj jej ponownie dla tego projektu.** Dane wpisujesz w lokalnym terminalu,
nie w rozmowie. Nie twórz pliku z hasłem. Stary tryb `.env.bootstrap` został
zastąpiony interaktywnym skryptem; jeśli taki plik wcześniej utworzono, usuń go lokalnie.

Z głównego folderu `I:\slm\sunday-league-mates`, w terminalu VS Code/PowerShell:

```powershell
git branch --show-current
git check-ignore app/.env.auth-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\app\scripts\bootstrap-admin.ps1 -Check
powershell -NoProfile -ExecutionPolicy Bypass -File .\app\scripts\bootstrap-admin.ps1
```

Pierwsze polecenie ma pokazać `feat/auth`. Nie przechodzimy na inny branch automatycznie.
`-ExecutionPolicy Bypass` dotyczy tylko nowego procesu PowerShell, nie zmienia
trwale polityki systemu. Skrypt działa też w PowerShell 7.

1. PAT z dostępem do wskazanego projektu pozostaje w ignorowanym
   `app/.env.auth-proof` jako `SUPABASE_ACCESS_TOKEN` (albo w lokalnym środowisku).
   Nie wpisuj jego wartości w komendzie ani w rozmowie.
2. `-Check` wyłącznie odczytuje konfigurację i role. Musi potwierdzić bezpieczne Auth
   oraz brak administratora. Nie włącza usług, nie zmienia hooków, limitów lub planu.
3. Uruchom skrypt bez `-Check`. Podaj login i polski numer (9 cyfr; +48 lub 0048 opcjonalnie).
   Skrypt poprosi o hasło tymczasowe oraz jego powtórzenie przez
   `Read-Host -AsSecureString`; znaki nie są pokazywane wprost.
   Minimum 8 znaków, maksimum 72 bajty UTF-8; hasło nie jest przycinane.
4. Potwierdź lokalnie dokładnym `CREATE_FIRST_ADMIN`. Puste potwierdzenie anuluje
   utworzenie. Dane nie są przyjmowane przez argumenty ani plik `.env.bootstrap`.
5. Skrypt przekaże JSON wyłącznie przez stdin procesu Node. Hasło nie trafia
   do argumentów, zmiennych środowiskowych, pliku, repozytorium ani wyjścia konsoli.
   Po potwierdzeniu Admin API tworzy konto z losowym technicznym e-mailem
   i `email_confirm=true`; SQL przypisuje profil i rolę, domyślnie z hasłem tymczasowym.
6. Odczyt kontrolny musi potwierdzić `role=admin`, `must_change_password=true`,
   aktywność i brak trwającej operacji przed komunikatem sukcesu.
7. Zaloguj się przez UI i obowiązkowo zmień hasło. Dopiero wtedy dostępne są
   profil i zarządzanie kontami. Zapamiętaj hasło tymczasowe do tego momentu.
8. Po zakończeniu prac unieważnij tymczasowy PAT i usuń go z lokalnego pliku;
   aplikacja nie potrzebuje PAT do logowania.

Narzędzie sprawdza konfigurację i brak administratora ponownie bezpośrednio przed
zapisem. Blokada transakcyjna w SQL zapobiega dwóm równoległym pierwszym
administratorom. Nie jest endpointem ani plikiem w aplikacji mobilnej; nie wymaga
ponownego deploy funkcji. Nie wysyła maili/SMS-ów i nie pobiera obecnego hasła.

Hasło musi chwilowo istnieć jawnie w pamięci PowerShell/Node, aby przesłać je
do Auth przez HTTPS. Bufory BSTR są zerowane, SecureString zwalniane, a referencje
do tekstu usuwane w finally; nie obiecujemy natychmiastowego wyzerowania
niemutowalnych stringów zarządzanych przez runtime. Nie debuguj payloadu.

Po błędzie provision narzędzie próbuje usunąć wyłącznie własne nowe konto.
Po timeout/anulowaniu sprawdź stan w panelu przed ponowieniem — odpowiedź
HTTP mogła zaginąć już po utworzeniu zasobu. Nie kasuj istniejących kont.
Komunikaty nie zawierają danych żądania, odpowiedzi Auth, hasła lub kluczy.

## Android — instalacja i testy użytkownika

Sprawdzone ustawienia: `appId=pl.psuda87.slm`, `appName=Sunday League Mates`,
`webDir=dist`, brak `server.url`/live reload w konfiguracji Capacitor,
uprawnienie INTERNET w AndroidManifest. Development i production Vite wskazują
funkcję `accounts` w projekcie `hjtcyybkxebvdropchac`; nie jest potrzebny
sekret w kliencie. Natywny origin `https://localhost` jest na liście dozwolonej
w źródłach funkcji. Backend działa przez HTTPS; telefon/emulator potrzebuje internetu,
ale nie połączenia do lokalnego Vite ani `adb reverse`.

Użytkownik potwierdził pierwsze logowanie, wymuszoną zmianę, logowanie oboma aliasami,
logout i panel administratora. Teraz zainstaluj nowy build z pluginem, aby sprawdzić
zapamiętywanie oraz tworzenie/reset fikcyjnego zawodnika. Z głównego folderu wykonaj:

```powershell
Set-Location I:\slm\sunday-league-mates\app
npm run build
npx cap sync android
npx cap open android
```

W Android Studio poczekaj na Gradle Sync, wybierz JDK 21 i urządzenie/emulator,
następnie Run → Run 'app'. Na telefonie włącz debugowanie USB i zaakceptuj
autoryzację komputera; Android musi mieć API co najmniej 24. Dostępny SDK projektu:
compile/target 36. Nie dodawaj `server.url` na potrzeby tego testu.

Alternatywnie zbuduj i zainstaluj APK z PowerShell w `app/`:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
.\android\gradlew.bat -p android assembleDebug
$slmAdb = Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe'
& $slmAdb devices
# Przy jednym autoryzowanym urządzeniu:
& $slmAdb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
& $slmAdb shell am start -n pl.psuda87.slm/.MainActivity
```

Jeśli jest więcej urządzeń, użyj `-s SERIAL` przy install i shell.
Odczyt przygotowania wykazał `emulator-5554 device`; dla niego dokładne polecenia:

```powershell
& $slmAdb -s emulator-5554 install -r .\android\app\build\outputs\apk\debug\app-debug.apk
& $slmAdb -s emulator-5554 shell am start -n pl.psuda87.slm/.MainActivity
```

Nie instalowano ani nie otwierano APK w tym kroku. Lista ADB i build nie są testem
logowania na urządzeniu; serial emulatora może zmienić się po jego restarcie.

Scenariusz ręczny:

1. Zaloguj się loginem i hasłem tymczasowym. Musi pojawić się „Zmień hasło tymczasowe”,
   bez profilu i panelu administratora. Cofnięcie/ponowne uruchomienie nie omija blokady.
2. Podaj błędne obecne hasło przy zmianie — odmowa. Następnie ustaw inne, silne hasło
   i powtórz je. Nie rób zrzutów/logów zawierających hasła.
3. Sprawdź profil i przycisk „Zarządzaj kontami”.
4. Wyloguj się. Stare hasło tymczasowe ma być odrzucone. Poprawny nowy login + hasło
   ma działać; po ponownym wylogowaniu numer + to samo nowe hasło otwiera to samo konto.
5. Sprawdź edycję nazwy i „Wyświetlaj mnie jako”, brak publicznej rejestracji,
   czytelność formularzy oraz klawiaturę na telefonie.
6. Zakończ aplikację i otwórz ponownie — serwer powinien potwierdzić zapisaną sesję
   bez podania hasła. Szczegóły nowego scenariusza poniżej.

Nie resetuj własnego jedynego administratora przez panel: moduł wymaga do własnej
zmiany obecnego hasła; odzyskanie dostępu to odrębna procedura właściciela.
Test resetu wykonuj później tylko na osobnym fikcyjnym zawodniku i usuń jego dane
po teście przez autoryzowane narzędzie właściciela, nie prawdziwe konto administratora.

## Ręczny odbiór nowych sesji i panelu — instrukcja na telefon

1. Zainstaluj zaktualizowany APK po `npm run build` i `npx cap sync android`
   (Run w Android Studio lub `adb install -r`, jak powyżej). Sam nowy build webowy
   nie dodaje pluginu do starego APK. Zaloguj się raz obecnym hasłem.
2. Zakończ aplikację z listy ostatnich aplikacji lub przez „Wymuś zatrzymanie”
   (nie czyść jej danych), następnie otwórz z internetem. Najpierw ma być
   „Sprawdzanie sesji…”, potem profil, bez wpisywania hasła. Powtórz w trybie offline:
   chronione dane mają być ukryte; po powrocie internetu wybierz „Spróbuj ponownie”.
3. Wybierz „Wyloguj się” i zamknij/otwórz aplikację. Powinno pozostać logowanie.
   Powtórz wylogowanie bez internetu: zapis lokalny ma zniknąć, komunikat może
   informować o braku potwierdzenia zdalnego. Bez klikania logout odłączenie internetu
   nie powinno samo usuwać zapisanego refresh tokenu.
4. W panelu administratora utwórz fikcyjnego zawodnika z unikalnym loginem testowym
   i np. numerem `000000199` (fikcyjny, nieużywalny numer testowy; wyłącznie alias,
   nie wykonuj połączenia). Hasło tymczasowe przekaż sobie ręcznie, bez screenshotów
   lub logów. Nie resetuj i nie zmieniaj rzeczywistego administratora.
5. Na telefonie zaloguj fikcyjnego zawodnika; administrator może pozostać zalogowany
   w oddzielnej przeglądarce na komputerze. Zawodnik musi zmienić hasło tymczasowe.
   Zamknij/otwórz telefon przed zmianą — nadal ma wymagać zmiany; dopiero poprawna
   zmiana udostępnia profil. Sprawdź nowy login/telefon z tym samym nowym hasłem.
6. Zostaw zapisaną sesję zawodnika i zamknij aplikację. Z konta administratora
   w przeglądarce zresetuj hasło **wyłącznie tego fikcyjnego zawodnika**.
   Otwórz aplikację: stara sesja musi być odrzucona, a ekran wymagać logowania.
   Nowe hasło tymczasowe ponownie wymusza zmianę. Po tej zmianie wcześniejsza sesja
   nadal nie może odzyskać dostępu. Do sprawdzenia aktywnej starej sesji użyj drugiego
   oddzielnego kontekstu testowego, nie kopiuj ani nie wypisuj tokenów.
7. Zapisz wyniki i Android/WebView w AUTH_PROOF.md bez danych osobowych, haseł i tokenów.
   Konto testowe i jego dane należy potem usunąć przez autoryzowane narzędzie
   właściciela/Admin API. Panel aplikacji nie ma jeszcze akcji usuwania kont;
   nie usuwaj administratora. Te kroki nie zostały wykonane automatycznie na telefonie.

## Wynik przygotowania interaktywnego bootstrap (historyczny)

13.10.2026, `feat/auth`: preflight zdalny tylko do odczytu PASS (brak administratora);
Node bootstrap 6/6 na kontrolowanym API; składnia PowerShell/Node PASS;
build, lint, Vitest 8/8 i Cypress 3/3 PASS; cap sync i assembleDebug PASS.
Nie wykonano realnego bootstrap ani testu wpisywania prawdziwego hasła.
Ten akapit dokumentuje wcześniejsze przygotowanie. Aktualnie podstawowe testy Androida
są potwierdzone przez użytkownika, hook e-maila jest sprawdzony, CAPTCHA odłożona.
Nowa trwała sesja, tworzenie/reset z panelu i iOS nadal wymagają odbioru.

## Awaria operacji konta i naprawa

Auth i SQL nie są jedną transakcją. Awaria po rozpoczęciu zmiany/resetu pozostawia konto
z `operation_id` i bez zatwierdzonych sesji. Nie odblokowujemy go timerem ani
przełącznikiem w UI; administrator widzi „Operacja wymaga naprawy”.

Właściciel powinien odczytać UUID konta i operacji przez bezpieczne narzędzie serwerowe,
poczekać ponad 10 minut i sprawdzić, że funkcja nie wykonuje już starego żądania.
[Limit Free](https://supabase.com/docs/guides/functions/limits) wynosi 150 s na worker;
operacje HTTP w handlerze mają dodatkowo timeout 15 s. Nie zakładać tych czasów przy
ewentualnym przeniesieniu na inną infrastrukturę.

Utwórz ignorowany `app/.env.account-recovery`: `SLM_RECOVERY_CONFIRM=RESET_STALE_OPERATION`,
`SLM_RECOVERY_USER_ID`, `SLM_RECOVERY_OPERATION_ID` oraz `SLM_RECOVERY_PASSWORD`
(nowe silne hasło tymczasowe). Uruchom `node app/scripts/recover-account.mjs`.
Narzędzie warunkowo przejmuje dokładnie starą operację, podnosi wersję, resetuje hasło
przez Auth i kończy reset w SQL. Powtórna awaria pozostawia blokadę; trzeba odczytać nowy
UUID operacji, a nie ręcznie ustawiać `must_change_password=false`. Po sukcesie konto
znów wymaga zmiany hasła. Usuń lokalny plik po ręcznym przekazaniu danych.
To narzędzie właściciela, nie publiczny bootstrap/reset bez autoryzacji.

## Infrastruktura proof i ograniczenia

Docelowy moduł wykorzystuje sprawdzone wzorce hooków, żywego session_id i wersji konta;
kod i tabele proof nie obsługują aplikacji. Testowy RPC `slm_auth_proof_is_admin`
usunięto, odebrano anon/authenticated dostęp do trzech tabel i starego prywatnego
schematu. Stare tabele, helpery i nieaktywne hooki są **oznaczone do usunięcia** po
zamknięciu historycznego testu. `app/auth-proof/run.mjs` został zatrzymany guardem;
nie przywraca dawnej konfiguracji i nie ponawia e-maila.

Istniejąca `rls_auto_enable()` i event trigger pozostają. Po przeglądzie definicji
odebrano klientom jedynie EXECUTE, usuwając oba ostrzeżenia advisor.
Aktualny advisor: INFO dla celowo zamkniętych tabel; WARN dla wyłączonej ochrony
wyciekłych haseł (funkcja Pro, nie uruchamiamy jej w Free).
Nie sprawdzono niezależnie planu rozliczeniowego organizacji; nie zmieniano go
ani nie aktywowano płatnych funkcji.

Nie testowano aplikacji na urządzeniu, masowych/równoległych żądań w zdalnym Auth,
MFA, Storage, Realtime ani pełnej odporności na DoS. Konto administratora wymaga
późniejszego świadomego bootstrap. Numery są identyfikatorami niezweryfikowanymi,
więc ich własności nie potwierdza system. Brakujący portret nie był zastępowany.
Advisor wydajności zgłosił też INFO dla nieindeksowanych kluczy obcych historii
`slm_account_audit` (actor_id, target_id) oraz starej tabeli sesji proof.
Przy wzroście historii potrzebne będą indeksy; tabela proof jest przeznaczona do usunięcia.

## Źródła sprawdzone przy implementacji

- [Admin API createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Admin API updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)
- [Wymaganie obecnego hasła i ograniczenia Free](https://supabase.com/docs/guides/auth/password-security)
- [Konfiguracja Auth Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config)
- [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Sesje Auth](https://supabase.com/docs/guides/auth/sessions)
- [Limity Auth](https://supabase.com/docs/guides/auth/rate-limits)
- [Changelog Supabase](https://supabase.com/changelog)

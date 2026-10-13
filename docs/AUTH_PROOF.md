# Próba techniczna Auth — projekt zdalny

Data: 13.10.2026. Branch: `feat/auth`. Projekt: `hjtcyybkxebvdropchac`.

## Aktualizacja zasad haseł — 13.10.2026

Na polecenie użytkownika generator tworzenia konta i resetu zwraca dokładnie
12 znaków base64url z 9 kryptograficznie losowych bajtów. Nowe własne hasło
wymaga minimum 8 znaków, maksimum 72 bajtów UTF-8; może być dłuższe niż 12 znaków.
Walidacja formularza, serwera i narzędzi właściciela jest zgodna z minimum 8.
Ręcznie podawane hasła tymczasowe narzędzi właściciela nie są generowane;
obowiązuje w nich minimum 8 znaków i maksimum 72 bajty UTF-8.

Wdrożono `accounts` w wersji 5. Skrypt `app/scripts/configure-password-policy.mjs`
ustawił `password_min_length=8` i potwierdził, że limity, hooki, ustawienia poczty
i CAPTCHA nie zmieniły się. Nie resetowano istniejącego administratora.

- Rzeczywisty test API: 7 grup scenariuszy zaliczonych; dodatkowo potwierdzono
  odrzucenie 7 znaków, przyjęcie 8 i 12 znaków w obu generowanych hasłach.
- Własne fikcyjne konta i ich dane usunięto. Niezależny odczyt po teście:
  2 konta Auth, 1 administrator, 2 zestawy aliasów, 0 osieroconych stanów
  bezpieczeństwa. Pozostałych kont niezwiązanych z tym przebiegiem nie zmieniano.
- Build (w tym TypeScript), lint: OK. Vitest: 24/24. Testy narzędzia bootstrap:
  6/6. Cypress Chrome: 5/5. `cap sync android` i `:app:assembleDebug`: OK.
- Pierwsze wywołanie Cypress odziedziczyło `ELECTRON_RUN_AS_NODE=1` z IDE
  i nie wykonało testów; właściwy przebieg po usunięciu tej zmiennej: 5/5.
- Pozostały ostrzeżenia dużych chunków i nieaktualnych danych Browserslist.
  Nie wykonywano nowego testu na urządzeniu ani ponownej próby zmiany e-maila.
  CAPTCHA nadal odłożona, iOS i szczegółowe ręczne scenariusze nowej sesji
  nadal wymagają odbioru. Ogólne zgłoszenie użytkownika, że aplikacja działa,
  nie zastępuje wyników poszczególnych scenariuszy urządzenia.

Źródło zasad Supabase: [Password security](https://supabase.com/docs/guides/auth/password-security).
Historyczne wartości minimum 12 w archiwum opisują konfigurację sprzed tej zmiany.

## Aktualny wynik — sesje i odbiór Androida (13.10.2026)

Projekt: `hjtcyybkxebvdropchac`, branch `feat/auth`. Administrator użytkownika istnieje.
Poniższy stan zastępuje historyczne statusy „brak administratora”, „sesja tylko
w pamięci” i „zmiana e-maila niezweryfikowana” w archiwum tego dokumentu.

### Ręczne testy Androida potwierdzone przez użytkownika

Źródłem wyniku jest zgłoszenie użytkownika, nie test automatyczny agenta.
Nie otrzymano modelu telefonu, wersji Android/WebView ani numeru konkretnego builda;
nie dopisujemy ich. Najnowsze potwierdzenie obejmuje również zapamiętywanie sesji,
wylogowanie z ponownym otwarciem oraz tworzenie i reset zawodnika z panelu.

| Test ręczny | Wynik |
|---|---|
| Pierwsze logowanie hasłem tymczasowym | POTWIERDZONY przez użytkownika |
| Wymuszona zmiana hasła | POTWIERDZONY przez użytkownika |
| Logowanie telefonem i loginem z nowym hasłem | POTWIERDZONY przez użytkownika |
| Wylogowanie | POTWIERDZONY przez użytkownika |
| Dostęp do panelu administratora | POTWIERDZONY przez użytkownika |
| Tworzenie zawodnika z panelu | POTWIERDZONY przez użytkownika |
| Reset hasła zawodnika z panelu | POTWIERDZONY przez użytkownika |
| Zapamiętywanie sesji po zamknięciu / ponownym otwarciu | POTWIERDZONY przez użytkownika: pozostaje zalogowany |
| Wylogowanie i ponowne otwarcie | POTWIERDZONY przez użytkownika: ekran logowania |
| Dodatkowe scenariusze unieważniania sesji po resecie, także po zmianie nowego hasła | ODŁOŻONE, NIEZALICZONE RĘCZNIE; istnieją wyniki automatyczne |
| Offline | ODŁOŻONY, NIEZALICZONY RĘCZNIE |
| Pierwsza zmiana hasła nowego zawodnika z panelu | Brak osobnego potwierdzenia ręcznego |
| iOS | NIEZWERYFIKOWANY |

Potwierdzenia zapisano 13.10.2026 wyłącznie na podstawie zgłoszenia użytkownika.
Aktualna decyzja użytkownika: ręczne testy offline i unieważniania starej sesji
po resecie są odłożone i nie blokują dalszych prac. Nie uznajemy ich za zaliczone;
wyniki automatyczne zachowują swój zakres. iOS pozostaje niezweryfikowany.
CAPTCHA pozostaje odłożona. Nie wykonywano ponownie testów zdalnych ani testów
urządzenia przez agenta. Bieżące zadanie zmienia dokumentację; wykorzystano ostatnie
wyniki kontroli (build/typy, lint, Vitest 24/24, bootstrap 6/6, Cypress 5/5,
Auth/API 7 grup i kompilacja Androida). Przed commitem wykonywana jest kontrola diff.

### CAPTCHA — odłożona poza bieżący etap

Decyzja użytkownika: przerwano/nie kontynuujemy integracji CAPTCHA. Nie włączano jej;
odczyt Auth potwierdził `security_captcha_enabled=false`. Dotychczasowe limity
aplikacji, natywne limity Auth, hooki i ustawienia powiadomień pozostają.
CAPTCHA nie jest bieżącym zadaniem ani zaliczonym testem; pozostaje do przyszłej decyzji.

### Domknięcie brakującego testu zmiany technicznego e-maila

Po aktualnej dokumentacji [limitów Auth](https://supabase.com/docs/guides/auth/rate-limits)
odczytano konfigurację: projektowy limit wysyłek `rate_limit_email_sent=2` na godzinę.
Dokumentacja nadal nie daje dokładnej godziny odnowienia bieżącego okna; wykonano
jedną próbę, bez retry, zwiększania limitu lub wyłączania hooka.

`node app/scripts/test-email-change.mjs` rozpoczął próbę o **20:31:26 UTC**
(22:31:26 Europe/Warsaw) 13.10.2026. Utworzył własne fikcyjne, administracyjnie
potwierdzone konto Auth z losowym adresem `.invalid` i hasłem wyłącznie w pamięci.
Nie tworzył profilu/aliasu/roli ani nie używał konta administratora.

**PASS:** PUT `/auth/v1/user` zwrócił **403**, `error_code=unknown`,
a treść odmowy zawierała stały znacznik **SLM_EMAIL_DISABLED**.
Hook został osiągnięty i zwrócił odmowę. Admin API potwierdziło pierwotny adres
oraz brak oczekującego nowego adresu. Definicja aktywnego hooka, odczytana niezależnie
przez MCP, wyłącznie zwraca błąd i nie zawiera wysyłki; żądanie nie dotarło do nadawcy
wiadomości. Nie wykonywano zewnętrznego pomiaru doręczenia — dowodem jest odmowa
Auth/hooka i brak kodu wysyłającego, a nie odpowiedź 429.

Porównanie konfiguracji przed/po potwierdziło niezmienione limity, hooki,
powiadomienia i CAPTCHA. Konto usunięto w finally. Nie ponawiano próby.
Historyczny częściowy scenariusz 3 został tym dowodem uzupełniony; dawne odpowiedzi
429 pozostają opisane wyłącznie jako historia.

### Nowe automatyczne testy Auth i sesji

Dodano `@aparajita/capacitor-secure-storage@8.0.1` (MIT, bezpłatny, Capacitor 8).
Persistencja zawiera tylko refresh token: Keystore/AES-GCM Androida i Keychain iOS;
web ma oddzielny jawny localStorage. Bez haseł, trwałego access tokenu lub profilu.
Opis ryzyka web/XSS, iOS i OS storage failures: [AUTH_MODULE.md](AUTH_MODULE.md).

| Kontrola | Wynik aktualnego wykonania |
|---|---|
| Build webowy / TypeScript klienta | PASS |
| ESLint | PASS |
| Strict TypeScript Edge Function | PASS |
| Vitest — Auth, vault, sesje i UI | PASS: 23/23, 5 plików |
| Cypress — przeglądarka, kontrolowane API | PASS: 5/5 |
| Rzeczywisty test Auth/API na nowych fixture'ach | PASS: 7 grup, exit 0 |
| Jedna rzeczywista próba hooka e-maila | PASS, exit 0 |
| cap sync android | PASS, plugin wykryty |
| Android assembleDebug, lintDebug, testDebugUnitTest | PASS |
| Bezpośredni lint natywnego pluginu | PASS; ostrzeżenie nowszego appcompat |
| npm audit | 6 moderate, 0 high, 0 critical — bez wzrostu po instalacji |
| npm audit --omit=dev | 3 moderate, 0 high, 0 critical — router |

Vitest weryfikuje blokadę ekranu przed odpowiedzią serwera, rotację i zapis refresh,
odmowę starej/cofniętej sesji, offline z zachowaniem tokenu bez danych, logout offline,
spóźniony refresh po logout, jeden refresh naraz, zachowanie hasła tymczasowego,
odświeżanie wygasającego access, błąd magazynu, powrót z tła oraz zmianę hasła
równoległą do refresh. Testy vault sprawdzają wybór magazynu natywnego i brak
niezabezpieczonego fallback, ustawienia iOS i usunięcie klucza. Są to mocki,
nie test rzeczywistego Keystore/Keychain.

Cypress sprawdza ponowne załadowanie, oczekiwanie na potwierdzenie serwera, offline,
usunięcie zapisu po logout i odmowę po resecie na kontrolowanym API. Nie jest testem
Androida. Rzeczywisty test Node używa wdrożonej funkcji i Auth; fixture administratora
jest nowo tworzonym własnym kontem, a nie istniejącym administratorem użytkownika.
Sprawdza rzeczywistą odmowę refresh starej sesji po resecie, także po zmianie nowego
hasła. Token w tej próbie istnieje w pamięci — nie jest zapisem na fizycznym telefonie.

Po cleanup niezależny MCP potwierdził: **1 auth.users, 1 administrator, 1 alias
i 0 kont bez roli** — pozostał wyłącznie administrator użytkownika.
Nie zmieniano jego profilu, aliasów, roli, hasła lub stanu dostępu. Cleanup usuwał
wyłącznie nowe UUID testu i powiązaną historię. Liczniki prób mają retencję jednego
dnia; pozostają techniczną infrastrukturą, bez jawnych aliasów i sekretów.
Nie tworzono nowych funkcji/tabel i nie zmieniano konfiguracji Auth w tym kroku.
Wdrożono wersję 4 istniejącej funkcji accounts: chwilowe 429/5xx Auth i bazy
nie są przedstawiane jako cofnięcie sesji i nie powodują jej celowego unieważnienia.
Test jednostkowy potwierdza 503 przy niedostępnym Auth refresh bez wywołania logout.
Wyłączono logi mostu Capacitor (mogły zawierać argumenty vault), inspekcję WebView
Androida i backup/transfer lokalnych danych. W repo pozostają wyłącznie źródła.

### Pozostałe ograniczenia

Nowy magazyn sesji, tworzenie zawodnika/reset z panelu i odbiór iOS pozostają do
sprawdzenia ręcznego. Podstawowe wcześniejsze testy Androida są potwierdzone powyżej.
Nie testowano root/jailbreak, błędów sprzętowego Keystore, reinstalacji, kopii danych
ani obciążenia. Odporność web na XSS jest osobnym problemem; localStorage nie jest
natywnym vault. Single-flight działa w jednym widoku, nie stanowi pełnej koordynacji
wielu kart przeglądarki.

Offline logout usuwa lokalny token, ale nie gwarantuje zdalnego unieważnienia innych
kopii. Przy odmowie usunięcia przez OS nie potwierdzamy sukcesu; UI wymaga ponowienia.
Hook nie wysyła wiadomości, ale nie wykonywano obserwacji rzeczywistej skrzynki.
Pozostały ostrzeżenia rozmiaru chunków, Browserslist i Gradle/Android Lint.
CAPTCHA jest odłożona; brak jej integracji nie został ukryty za wynikiem PASS.

Instrukcja ręcznego odbioru: [AUTH_MODULE.md](AUTH_MODULE.md). Modułu nie oznaczamy
jako w pełni ukończonego. Bez commita i pusha.

## Archiwum wcześniejszych etapów

Wszystkie wyniki i ograniczenia poniżej dotyczą opisanych wcześniejszych przebiegów.
Nie są bieżącym stanem projektu; dawny harness jest wyłączony guardem.

## Przygotowanie pierwszego rzeczywistego administratora — bez utworzenia konta

13.10.2026 przygotowano `app/scripts/bootstrap-admin.ps1`: login/telefon wpisywane
lokalnie, hasło i powtórzenie przez `Read-Host -AsSecureString`, jawne potwierdzenie
`CREATE_FIRST_ADMIN`. Hasło przekazywane do Node tylko przez stdin, bez pliku,
argumentów i logowania treści. Zastąpiono dawny tryb `.env.bootstrap`.

Rzeczywisty tryb `-Check` wykonał wyłącznie odczyt: właściwy projekt, bezpieczna
konfiguracja Auth i brak administratora. Niezależny MCP potwierdził 0 auth.users
i 0 administratorów. Nie tworzono kont, tabel ani endpointów i nie zmieniano
konfiguracji zdalnej, planu lub limitów. Nie ponawiano testu zmiany e-maila.

Kontrole: 6/6 testów Node bootstrap na kontrolowanym API, składnia PowerShell/Node,
build i lint OK, Vitest 8/8, Cypress 3/3, cap sync i assembleDebug OK.
Testy bootstrap potwierdzają odmowę przy istniejącym administratorze,
walidację/potwierdzenie, sprawdzenie roli i wymogu zmiany hasła oraz cleanup wyłącznie
własnego nowego konta po błędzie. Nie używają rzeczywistych kont ani zapisów zdalnych.

Vite development/production wskazują właściwą funkcję; INTERNET jest w manifeście,
Capacitor nie ma server.url. ADB wykazało `emulator-5554 device`; nie instalowano APK
ani nie wykonywano logowania na emulatorze. Test urządzenia pozostaje otwarty.
Instrukcja interaktywnego utworzenia konta oraz pierwszego logowania i zmiany hasła
na Androidzie: [AUTH_MODULE.md](AUTH_MODULE.md).

**Moduł nie jest w pełni ukończony: CAPTCHA, test hooka zmiany technicznego e-maila
i test urządzenia pozostają otwarte.** Przygotowanie nie oznacza utworzenia
administratora ani wykonania tych testów. Bez commita i pusha.

## Właściwy moduł kont — wykonane testy 13.10.2026

Na nowe polecenie użytkownika wdrożono minimalny moduł na `feat/auth`, wyłącznie w
`hjtcyybkxebvdropchac`. **Otwarta część historycznego scenariusza 3 pozostaje
NIEZWERYFIKOWANA. Nie wykonano nowej próby zmiany technicznego e-maila, recovery
ani OTP. Nie zmieniono limitów i nie wyłączono hooków.**

Ostatni pełny przebieg `node app/scripts/test-accounts.mjs` na docelowej funkcji
`accounts` wersja 3 zakończył się kodem **0** i siedmioma grupami PASS. Korzystał
z rzeczywistych Auth, Edge Function i PostgREST/RLS. Fikcyjne hasła i sesje generowano
w pamięci; nie zapisano ich w dokumentacji, logach ani repozytorium.

| Grupa | Wynik wykonania |
|---|---|
| Błędne logowanie i blokada | PASS: nieistniejący login i błędne hasło zwracają ten sam HTTP 401/komunikat; hasło tymczasowe blokuje profil w API (403) i SELECT przez RLS (0 wierszy). |
| Zmiana hasła | PASS: Auth odrzuca bezpośrednią zmianę bez obecnego hasła; wrapper odrzuca błędne obecne hasło. Poprawna zmiana odblokowuje nową sesję, poprzednia pozostaje odrzucona. Administrator też zmienia hasło tymczasowe. |
| Uprawnienia administracyjne | PASS: administrator tworzy konto, duplikat jest odrzucony; podany przez klienta role=admin nie nadaje roli. Zawodnik nie listuje/tworzy/resetuje kont, nie aktualizuje roli ani cudzego profilu i nie uruchamia RPC bootstrap. user_metadata nie zmienia uprawnień. |
| Profil i identyfikatory | PASS: wybór pełnej nazwy oraz pseudonimu przy jej braku; zmiana loginu/telefonu wymaga obecnego hasła i unikalności; stary login przestaje działać, nowy login i telefon prowadzą do jednego UUID i jednego hasła. Poprzednia sesja zostaje zablokowana. |
| Awaria i naprawa | PASS: symulowane rozpoczęcie operacji bez jej zakończenia blokuje sesje. Naprawa właściciela przed 10 minutami jest odrzucona. Dla wyłącznie fikcyjnego konta zasymulowano wiek 11 minut w danych operacji; reset naprawczy przez Admin API i SQL działa, spóźnione zakończenie starej operacji nie zmienia stanu. Nowe logowanie wymaga zmiany hasła. |
| Reset administratora | PASS: przed resetem potwierdzono działający odczyt aktywnej sesji. Reset odrzuca tę sesję, jej refresh i poprzednie hasło. Nowe tymczasowe hasło blokuje profil; po jego zmianie nowa sesja działa, a poprzedni JWT nadal nie działa w API i RLS. |
| Logout i refresh | PASS: odświeżenie aktywnej sesji administratora działa. Logout blokuje JWT i refresh użytkownika; administrator również się wylogowuje. |

W poprzednich przebiegach wykryto brak SELECT service_role do `auth.sessions`,
odmienne pole kodu błędu Auth (`error_code`) i przejściowe timeouty sieci/500 przy
logout. Dodano wąskie prywatne helpery bez otwierania tabel Auth, poprawiono odczyt
kodu błędu, a błędy transportu backendu mapowane są na bezpieczne 503. Logout wymaga
sukcesu odebrania zatwierdzenia SQL, ale cleanup Auth jest best effort: nieudany
drugi krok nie przywraca dostępu aplikacji. Nie ponawiamy automatycznie operacji
zmieniających hasło. Ostatni przebieg po poprawkach przeszedł.

### Kontrole klienta i serwera

| Kontrola | Wynik |
|---|---|
| npm run build | PASS; pozostaje ostrzeżenie chunków >500 kB |
| npm run lint | PASS, bez błędów i ostrzeżeń ESLint |
| npm run test.unit -- --run | PASS: 8/8, 3 pliki |
| Kontrola TypeScript Edge Function (strict, noEmit) | PASS |
| Cypress 16.1.1 / Chrome 155 | PASS: 3/3 (kontrolowane API, testy UI) |
| cap sync android | PASS |
| Android assembleDebug, :app:lintDebug, :app:testDebugUnitTest / JDK 21 | PASS |
| node --check narzędzi administracyjnych i harnessu | PASS |

Cypress sprawdza odmowę logowania, obowiązkową zmianę, profil, brak rejestracji,
panel administratora, czyszczenie sesji i brak localStorage. API jest tam przechwycone;
dowodem rzeczywistych operacji Auth jest oddzielny test Node opisany wyżej.
Test jednostkowy symuluje reset między odczytem wersji a logowaniem, a inny potwierdza
429 przed sprawdzaniem hasła. Nie zastępują one zdalnego testu obciążeniowego.
Pozostały ostrzeżenia Browserslist i Gradle flatDir. Brak testu na urządzeniu.
Vite/Vitest wymagały uruchomienia poza sandboxem z powodu spawn EPERM.

### Cleanup i stan po module

Niezależny odczyt MCP po ostatnim pełnym teście: **0** w auth.users, identities,
sessions, refresh_tokens, slm_profiles, slm_aliases, slm_roles, slm_account_security,
slm_account_sessions i slm_account_audit. Usunięto tylko konta i dane fikcyjne tworzone
przez harness, w tym historię ich operacji. Rzeczywisty administrator nie istnieje.
Liczniki limitów (hash, liczba, okno) pozostają techniczną infrastrukturą z retencją
jednego dnia, bez haseł, tokenów, jawnych loginów i telefonów.

Pozostawiono siedem docelowych tabel, prywatny schemat slm_private, serwerowe RPC,
dwa nowe hooki i funkcję `accounts`. Migracje i źródła są w `app/supabase/`;
opis odtwarzania i pierwszego administratora w [AUTH_MODULE.md](AUTH_MODULE.md).

Stary publiczny RPC `slm_auth_proof_is_admin` został usunięty; dostęp anon/authenticated
do tabel i prywatnego schematu proof odebrano. Trzy puste tabele proof, helpery i stare
hooki **oznaczono do usunięcia** po domknięciu historycznego testu. Nie obsługują
docelowego modułu. Dawny harness ma guard odmawiający uruchomienia po wdrożeniu kont.
Nie ma publicznego endpointu testowego ani bootstrap; skrypt właściciela nie jest
wdrożony do Edge Functions.

W stosunku do ustawień historycznego testu: oba aktywne hooki wskazują teraz
`slm_account_block_email` i `slm_account_block_sms`, włączono
`security_update_password_require_current_password=true` i ustawiono
`password_min_length=12`. Wszystkie wcześniejsze blokady rejestracji/wiadomości
pozostają; limity, CAPTCHA, JWT i plan nie były zmieniane.
Konfigurację odtwarza `configure-accounts.mjs`, który sprawdza zachowanie limitów.

Po przeglądzie odebrano klientom EXECUTE istniejącej `rls_auto_enable()`;
jej kod i event trigger zachowano. Advisor nie zgłasza już dwóch ostrzeżeń
SECURITY DEFINER. Aktualnie zgłasza INFO dla celowo zamkniętych tabel i WARN
[ochrony wyciekłych haseł](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection),
która według dokumentacji wymaga Pro, więc nie została włączona.
Znaczenie INFO: [RLS bez polityk](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Advisor wydajności: trzy INFO nieindeksowanych FK — actor_id i target_id historii
operacji oraz user_id archiwalnej tabeli sesji proof. Nie są błędami kontroli dostępu;
pozostają ograniczeniem wydajnościowym, opisanym w AUTH_MODULE.md.

### Ograniczenia

Brakujące sprawdzenie hooka przy zmianie technicznego adresu nadal blokuje uznanie
całego historycznego proof za zaliczony. Implementacja modułu odbyła się na jawne
polecenie użytkownika z zachowaniem tego ograniczenia. Nie wykonano pomiaru
doręczeń, testów masowych, pełnych zdalnych wyścigów ani odtwarzania na pustym
projekcie. Hasła i reset nie są transakcją obejmującą Auth oraz SQL; przerwane operacje
pozostają zablokowane i mają procedurę naprawy właściciela. Test nie weryfikuje okresu
wygaśnięcia całego worker'a przez rzeczywiste czekanie 10 minut — symuluje wiek
wyłącznie rekordu fikcyjnego konta.

Sesje UI są tylko w pamięci. Ochrona przed masowymi próbami obejmuje liczniki bazy
i natywne limity Auth; CAPTCHA nie została dodana. Globalny limit może zostać
wyczerpany przez napastnika. Nie sprawdzono niezależnie planu organizacji; nie
uruchomiono płatnej funkcji ani zmiany planu. Lokalny Docker nadal nie jest
dostępny, więc backend testowano wyłącznie w autoryzowanym projekcie zdalnym.
Bez commita i pusha.

---

## Wynik

**Wykonano siedem scenariuszy: sześć przeszło, scenariusz 3 ma wynik częściowy. Całego testu nie uznajemy za zaliczony.**

### Uzupełnienie: jedna próba wyłącznie zmiany e-maila

13.10.2026 o 19:14:22 UTC (21:14:22 Europe/Warsaw) uruchomiono `node app/auth-proof/run.mjs --email-change-only`. Tryb ten nie wykonuje pozostałych scenariuszy, recovery ani OTP i nie stosuje PATCH konfiguracji. Utworzył jedno fikcyjne konto i wykonał dokładnie jedno żądanie zmiany technicznego e-maila.

Aktualna [dokumentacja limitów Auth](https://supabase.com/docs/guides/auth/rate-limits), odczytana przez MCP, opisuje wspólny limit projektowy wysyłek na godzinę; obejmuje również `/auth/v1/user` przy zmianie e-maila. Odczyt konfiguracji API podał `rate_limit_email_sent = 2`. Opis token bucket dla limitów IP nie wyznacza momentu odnowienia tego projektowego limitu e-mail. Dokumentacja nie podaje dokładnego czasu resetu jego bieżącego okna, a odpowiedź próby nie zawierała nagłówka `Retry-After`; nie można wiarygodnie wskazać godziny następnej dozwolonej próby.

Odpowiedź z 19:14:25 UTC: **HTTP 429 / `over_email_send_rate_limit`**. Hook nie został osiągnięty. Odczyt konta przez Admin API potwierdził niezmieniony e-mail i brak oczekującego nowego adresu. Żądanie zostało odrzucone przed wysyłką, ale nie jest to dowód zatrzymania zmiany przez hook. **Brakująca część scenariusza 3 nadal jest NIEZWERYFIKOWANA.** Nie ponawiano żądania i nie zwiększano limitów ani nie wyłączano hooków. Odczyt kontrolny potwierdził niezmienione limity, hooki i ustawienia powiadomień.

Konto usunięto w `finally`. Niezależny odczyt MCP potwierdził ponownie 0 kont, identities, sesji, refresh tokenów i rekordów trzech tabel testowych. Nie pozostawiono nowych zasobów ani ustawień. Składnię skryptu sprawdzono przez `node --check`; nie zmieniano kodu klienta.

Testy korzystały z rzeczywistych Supabase Auth i PostgREST/RLS. Nie użyto mocków. Zasoby bazy przygotowano przez MCP `supabase-slm`; konfigurację i operacje kont wykonano przez oficjalne API z lokalnego serwerowego harnessu, ponieważ MCP nie udostępnia tych operacji. Token odczytano z ignorowanego `app/.env.auth-proof`; hasła i sesje istniały wyłącznie w pamięci procesu. Nie drukowano sekretów, surowych odpowiedzi Auth ani payloadów.

Przed zmianami MCP potwierdził adres projektu, brak tabel public, brak Edge Functions i 0 kont Auth. Początkowo publiczna rejestracja była włączona, Email włączony z potwierdzeniami, Phone wyłączony, oba hooki wysyłki wyłączone, CAPTCHA wyłączona. Istniejąca funkcja `public.rls_auto_enable()` nie została zmieniona.

## Wyniki scenariuszy

| Nr | Scenariusz | Wynik i dowód |
|---|---|---|
| 1 | Admin API przy wyłączonej rejestracji | **PASS.** Signup odrzucony: HTTP 422 / `signup_disabled`. Admin API utworzyło potwierdzone konta z losowymi adresami w `.invalid`, bez zaproszenia i bez signup. |
| 2 | Login i telefon, jedno hasło | **PASS.** Serwerowe mapowanie obu aliasów prowadziło do tego samego UUID Auth. Oba logowania działały z jednym hasłem; losowe błędne hasło zostało odrzucone. Telefon był wyłącznie aliasem, nie `auth.phone`. |
| 3 | Brak wysyłki maili i SMS | **CZĘŚCIOWY.** W pierwszym przebiegu recovery i e-mail OTP zwróciły błąd hooka `SLM_AUTH_PROOF_EMAIL_DISABLED`. Próba zmiany adresu nie dostarczyła tego dowodu. Kolejne recovery, OTP i zmiana adresu zwracały HTTP 429 / `over_email_send_rate_limit`, zanim dotarły do hooka. Phone pozostawał wyłączony, próba SMS OTP była odrzucona, a konto nie miało `auth.phone`. Nie skonfigurowano dostawcy SMS/SMTP ani żadnej wysyłki w hookach. Nie potwierdzono eksperymentalnie zachowania zmiany e-maila po wygaśnięciu limitu. |
| 4 | Blokada przed zmianą hasła | **PASS.** Poprawny JWT z hasła tymczasowego nie odczytywał chronionego wiersza. PATCH nie aktualizował go. Anon nie miał dostępu. Kontrolę wykonało RLS na serwerze, niezależnie od UI. |
| 5 | Odblokowanie po zmianie hasła | **PASS.** Złe obecne hasło nie zmieniało stanu ani dostępu. Poprawna zmiana przez Auth umożliwiała odczyt nowej zatwierdzonej sesji; wcześniejsza sesja tymczasowa nadal nie odczytywała danych. Administrator również przeszedł zmianę hasła tymczasowego. |
| 6 | Reset i poprzednia sesja | **PASS.** Reset wykonany przez uprawnionego administratora blokował stary JWT i poprzednie hasło. Nowe hasło tymczasowe wymagało zmiany. Po jej zakończeniu nowa sesja odczytywała dane, a poprzedni JWT nadal nie. Próba użycia starego refresh tokenu nie przywróciła dostępu: kod akceptuje jako poprawny wynik odmowę refresh albo wydanie nadal zablokowanej sesji. |
| 7 | Samodzielne nadanie administratora | **PASS.** Zapis `role=admin` i `is_admin=true` w user_metadata nie zmieniał wyniku RPC uprawnień. Bezpośredni UPDATE roli nie modyfikował wiersza. Zawodnik nie mógł uruchomić resetu administratora; rzeczywisty administrator zachował uprawnienia. |

W pełnym przebiegu harness zakończył się kodem 1 z powodu częściowego scenariusza 3, mimo sukcesu pozostałych. Poprawiono licznik raportu: liczy wyłącznie PASS, a PARTIAL wykazuje oddzielnie.

## Cleanup i zasoby pozostawione

Każdy przebieg tworzący konta wykonał cleanup przez Admin API. Niezależny odczyt MCP po testach potwierdził:

| Obiekt | Liczba rekordów |
|---|---:|
| auth.users | 0 |
| auth.identities | 0 |
| auth.sessions | 0 |
| auth.refresh_tokens | 0 |
| public.slm_auth_proof_accounts | 0 |
| public.slm_auth_proof_sessions | 0 |
| public.slm_auth_proof_protected | 0 |

Nie usuwano kont ani zasobów niezwiązanych z testem. Pozostawiono wyłącznie infrastrukturę testową:

- migrację `slm_auth_proof_setup`;
- trzy wymienione tabele z RLS, kluczami obcymi i grantami;
- schemat `slm_auth_proof_private` z funkcjami `allowed()` i `admin_allowed()`;
- RPC `public.slm_auth_proof_is_admin()`;
- hooki `public.slm_auth_proof_block_email(jsonb)` i `public.slm_auth_proof_block_sms(jsonb)`;
- politykę właściciela i restrykcyjną blokadę dostępu do chronionej tabeli.

Nie utworzono Edge Functions ani sekretów zdalnych. Nie zmieniono planu ani nie uruchomiono płatnych funkcji. Wykorzystane hooki i RLS są dostępne w Free; nie sprawdzono niezależnie aktualnego planu rozliczeniowego organizacji.

## Ustawienia Auth pozostawione po teście

Skrypt wykonał PATCH i odczyt kontrolny konfiguracji. Zastosowane wartości:

| Pole | Wartość |
|---|---|
| disable_signup | true |
| external_email_enabled | true |
| external_phone_enabled | false |
| external_anonymous_users_enabled | false |
| security_manual_linking_enabled | false |
| mailer_autoconfirm | false |
| mailer_secure_email_change_enabled | true |
| hook_send_email_enabled | true |
| hook_send_email_uri | pg-functions://postgres/public/slm_auth_proof_block_email |
| hook_send_sms_enabled | true |
| hook_send_sms_uri | pg-functions://postgres/public/slm_auth_proof_block_sms |

Wyłączono wszystkie siedem dostępnych powiadomień `mailer_notifications_*_enabled`: password_changed, email_changed, phone_changed, mfa_factor_enrolled, mfa_factor_unenrolled, identity_linked i identity_unlinked. CAPTCHA pozostała wyłączona, tak jak przed testem. Nie zmieniano limitów wiadomości, JWT ani limitów sesji. Hooki celowo pozostają aktywne; ich usunięcie przy pozostawieniu konfiguracji spowodowałoby błędy Auth. Publiczna rejestracja pozostaje wyłączona.

## Pliki i odtwarzanie

- `app/auth-proof/setup.sql`: dokładny DDL zastosowany przez MCP. Nie jest skryptem czyszczącym ani bezwarunkowo idempotentnym; uruchomić raz po sprawdzeniu braku kolizji nazw, wyłącznie we wskazanym projekcie.
- `app/auth-proof/run.mjs`: Node 24, bez nowych zależności. Generuje fikcyjne konta, hasła i dane; sprawdza scenariusze i usuwa swoje konta w `finally`.
- `app/scripts/auth-proof-preflight.ps1`: wcześniejsza diagnostyka lokalnego Dockera/CLI. Nie jest używana w teście zdalnym.
- `app/.env.auth-proof`: lokalna konfiguracja użytkownika, ignorowana przez Git; nie należy jej dodawać do repozytorium.

Z głównego folderu, na `feat/auth`:

```powershell
node app/auth-proof/run.mjs --inspect
node app/auth-proof/run.mjs
node app/auth-proof/run.mjs --email-change-only
```

Pierwsze polecenie tylko odczytuje niesekretne ustawienia. Drugie odtwarza konfigurację, wykonuje test i cleanup. Wszystkie adresy API są ograniczone do wskazanego projektu; klucze Admin API pobiera przez Management API tylko do pamięci. Skrypt nie nadpisuje cudzych aktywnych hooków ani nie wyłącza istniejącej CAPTCHA. Fikcyjne numery z zakresu 555-01xx służą wyłącznie jako aliasy, adresy `.invalid` nie są adresami osób.

Aby domknąć scenariusz 3, należy po wygaśnięciu limitu wiadomości wykonać najpierw próbę zmiany e-maila i potwierdzić odmowę przez hook. Nie podnoszono limitu ani nie dodawano SMTP w celu obejścia ograniczenia. Ponowne uruchomienie pełnego testu w obecnej kolejności może ponownie wyczerpać limit, zanim dotrze do zmiany e-maila.

## Ograniczenia bezpieczeństwa i zakresu

To serwerowy harness, nie gotowy backend aplikacji: nie wdraża publicznych endpointów ani UI. Nie sprawdza CAPTCHA, limitów prób, Storage, Realtime, zmiany aliasów ani pełnej odporności na równoległy reset. Auth i baza nie tworzą jednej transakcji. Wersja bezpieczeństwa i zatwierdzone session_id sprawdzane przez RLS są rzeczywistą ochroną starej sesji, ale procedury produkcyjne wymagają dalszych testów.

Nie wykonywano zewnętrznego pomiaru doręczenia wiadomości. Pierwsze próby potwierdziły realne działanie hooka blokującego recovery/OTP; limit 429 uniemożliwił pełną weryfikację zmiany e-maila. Nie należy utożsamiać 429 z dowodem wywołania hooka.

Advisor zgłosił INFO dla accounts/sessions bez polityk: to zamierzona odmowa dostępu użytkownikom przy zachowanym dostępie service_role. Zgłosił też istniejącą `public.rls_auto_enable()` jako SECURITY DEFINER dostępną anon/authenticated; nie utworzył jej test i nie zmieniono jej. Wymaga osobnego przeglądu przed wdrożeniem aplikacji.

Wcześniejsza próba lokalna była zablokowana: `docker` zwracał CommandNotFoundException, brak było Docker Desktop w standardowych lokalizacjach, usługi com.docker.service oraz CLI Supabase. Nie zastępowano tego wyniku testem zdalnym bez autoryzacji; użytkownik udzielił jej osobnym poleceniem.

Po zakończeniu prac użytkownik powinien unieważnić tymczasowy PAT i usunąć go z lokalnej konfiguracji. Nie należy przekazywać go w rozmowie.

## Kontrole

Składnia harnessu: `node --check` OK. W przygotowaniu testu build i lint przeszły, Vitest 1/1 i Cypress 1/1. Te kontrole aplikacji nie stanowią dowodu Auth. Pozostały ostrzeżenia rozmiaru chunków i Browserslist. Nie synchronizowano Androida, ponieważ kod klienta się nie zmienił. Bez commita i pusha.

Źródła: [Management API — konfiguracja Auth](https://supabase.com/docs/reference/api/v1-update-auth-service-config), [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [dostępność i błędy hooków](https://supabase.com/docs/guides/auth/auth-hooks), [limity Auth](https://supabase.com/docs/guides/auth/rate-limits).

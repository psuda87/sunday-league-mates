# SLM 1.0 — B2.1: własny profil zawodnika

2026-10-24 · `feat/slm-v1-live` · kod aplikacji `6dd71054e3f3ced39b9d78775564a5bcc05236bc`.
Baza: zaakceptowany B1 `164edac`; wzorzec UI `d0f9fa9`. Stan początkowy Git czysty.
Zakres: B2.1. B2.2 i B3 nie rozpoczęto. Odbiór funkcji profilu na POCO oczekuje.

## Audyt: istniejące tabele, API i wcześniejsza integracja

Odczytano metadane rzeczywistej lokalnej bazy Docker, RLS i historię migracji,
sprawdzono źródła frozen oraz poprzedniej integracji Premium w worktree premium318-live.
Starszego `src/live/Profile.tsx` nie przeniesiono: ma inny układ i zawiera zdjęcia,
a obecnym wzorcem pozostaje oryginalny `demo/Profile.tsx`/`Identity.tsx`.

Wykorzystano bez zmian istniejące `auth/api.ts`, `SessionManager`, `tokenStore`
i `legacyAccountUiAdapter.readProfile/saveProfile`. Brak drugiego systemu profili,
nowych tabel, endpointów, zależności i serwerowych reducerów. Interfejs typu
`ui/personalProfile.ts` jest wyłącznie portem prezentacji tego samego kontraktu.

Rzeczywisty lokalny schemat:

| Tabela | Istniejące pola istotne dla profilu | Wykorzystanie B2.1 |
|---|---|---|
| slm_profiles | user_id, full_name, display_as | Odczyt i zapis własnego full_name, zachowanie display_as |
| slm_aliases | user_id, login, login_normalized, phone, technical_email | Serwerowy odczyt loginu/telefonu; technical_email nie jest zwracany do UI |
| slm_player_profiles | user_id, nickname, contact_phone, jersey_number, email_account | Istniejący model kont e-mail, składany przez backend w tę samą projekcję; brak bezpośredniego dostępu klienta |

`profile` zwraca user_id/login/phone/full_name/display_as/display_name (lokalny backend
ma też email_account). `save_profile` przyjmuje wyłącznie używane przez adapter
full_name/display_as, aktualizuje profil wynikający z uwierzytelnionego kontekstu
serwera i zwraca tę samą projekcję. Po zapisie wykonujemy dodatkowe `profile`.
Odczyt musi potwierdzić właściciela, full_name i display_as; sam HTTP200 nie oznacza sukcesu.

Lokalna baza zawiera wcześniejsze migracje, m.in. `20261019172724` (kontakty)
i `20261019173620` (zakres wspólnych grup), oraz późniejsze zaakceptowane lokalnie zmiany.
Nie kopiowano całych gałęzi, nie synchronizowano/resetowano schematu do starszego checkoutu.
Testy dotyczą tego istniejącego lokalnego środowiska; zdalnego schematu nie audytowano.

## Pola działające i ograniczenia

- Rzeczywiste: nazwa na karcie (`display_name`), odczyt loginu, telefonu,
  imienia i nazwiska oraz istniejącej preferencji wyświetlania.
- Edytowalne: **imię i nazwisko**, w istniejącym drugim polu formularza.
  Walidacja do 100 znaków, bez znaków sterujących i nawiasów ostrych; opcjonalnie puste.
  Zapis jest przycinany i musi zostać potwierdzony ponownym odczytem serwera.
- Login/pseudonim jest tylko do odczytu w pierwszym polu. Login i telefon są też
  widoczne w istniejącej pozycji „Dane konta” w ustawieniach własnego profilu.
- Login/telefon nie są zmieniane: istniejące `identifiers` wymaga obecnego hasła,
  a oryginalny edytor nie zawiera tej ścieżki. Nowsze `save_email_profile` ma inne
  ograniczenia i zapis numeru koszulki; nie przenoszono go do B2.1. Nie dodano OTP/SMS.
- `display_as` jest zachowywane, bez nowego selektora. Przy `full_name` karta pokazuje
  zapisane imię/nazwisko (lub fallback loginu przy pustej wartości). Przy `nickname`
  karta nadal pokazuje login/pseudonim; edycja imienia nie przełącza tej preferencji.
- **Preferowana pozycja i „dobry bramkarz” nie istnieją w aktualnym schemacie.**
  Nie dodawano kontrolek, pól ani fikcyjnych wartości.
- jersey_number istnieje w starszej tabeli, ale bieżący kontrakt `profile` go nie
  udostępnia. Numer jest niedostępny, jego edycja wyłączona. Nie wyświetlamy numeru demo.
- Brak kontraktu statystyk: cztery oryginalne pola mają „—”, nie fikcyjne liczby.
- Zdjęcia poza zakresem: karta korzysta z istniejącego fallbacku inicjałów,
  bez fikcyjnego portretu własnego konta. Oryginalny przycisk zdjęcia pozostaje,
  ale jest nieaktywny; nie wykonujemy odczytów/uploadu/usuwania Storage.

Migracja nie jest potrzebna do podłączonego odczytu i zapisu imienia/nazwiska.
Nie przygotowywano ani nie stosowano migracji dla nieistniejących pozycji/flagi;
ich przyszły model wymaga osobnego uzgodnienia. Nie zmieniano SQL, RLS ani Edge Functions.

## Kontroler, izolacja i stany

`auth/profileAdapter.ts` wiąże istniejący adapter; wybiera tylko pola kontraktu,
odrzuca profil o innym user_id i nie przekazuje ról/metadanych do UI.
`auth/useOwnProfile.ts` przechowuje dane wyłącznie w RAM bieżącego konta,
bez localStorage/Preferences. Przy zmianie konta odcina poprzednią projekcję
synchronicznie; generacja odrzuca spóźnione odpowiedzi po wylogowaniu/tle/zmianie konta.
Jedna operacja zapisu naraz. Nieudane potwierdzenie zapisu usuwa niepewną projekcję
z widoku i wymaga ponownego odczytu, zamiast deklarować sukces.

Własny profil otrzymuje port przez propsy, **bez modyfikowania world.players**.
Mecze, uczestnicy, cudze profile, grupy i finanse nadal korzystają z oryginalnego demo.
Zmiana symulowanego użytkownika demo nie przełącza konta Auth. Dane prywatne nie są
przekazywane do kart uczestników, boiska, ram profili innych osób ani selektorów grup.
Oznaczenia demo w pozostałych modułach zachowano.

Ładowanie/brak danych/błąd wykorzystują istniejący akapit i przycisk profilu do
ponowienia odczytu. Nie ma danych zastępczych. Istniejący backend przy braku wiersza
profilu może zwrócić session_invalid zamiast null; wtedy zadziała dotychczasowa
bramka wygasłej sesji, bez tworzenia nowego profilu przez klienta.
Sieć/wygaśnięcie nadal obsługuje SessionManager i istniejące ekrany B1.
Znana sekwencja checking/remount oraz mignięcie B1 pozostały bez zmian.

## Bezpieczeństwo — rzeczywiste lokalne kontrole

RLS jest włączone dla slm_profiles/slm_aliases/slm_player_profiles/slm_roles.
Odczyt slm_profiles przez JWT wymaga ważnej sesji i `slm_private.shared_profile`:
właściciel lub wspólna grupa. Pozostałe prywatne tabele nie mają bezpośredniego
zapisu dla authenticated. Backend używa własnego kontekstu, nie user_id/role z body.
Sprawdzono rozdzielenie grantów i polityk zgodnie z
[dokumentacją RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
Changelog Supabase sprawdzono; nie aktualizowano wersji usług ani bramy lokalnego stosu.

**22 kontrole HTTP/RLS PASS** (`scripts/test-b2-profile-local.mjs`):

- odczyt/zapis własnego profilu, read-back i odtworzenie przez nowy SessionManager;
- zachowanie loginu/telefonu po zapisie;
- dwa odrębne fikcyjne konta w dwóch odrębnych grupach: RLS pozwala na odczyt własny,
  ukrywa profil drugiej grupy; API odmawia odczytu jej członków;
- user_id w żądaniu profile/save_profile nie zmienia właściciela operacji;
- próba zapisu cudzych danych nie zmienia drugiego konta;
- bezpośrednie PATCH własnych/cudzych slm_profiles, slm_roles, slm_aliases,
  slm_player_profiles przez zwykły JWT są odrzucane;
- role/login/phone w body nie zmieniają pól chronionych, metadane Auth nie nadają admina;
- walidacja serwera i końcowe wylogowanie obu kont.

Dwa nowe konta i dwie grupy testowe pozostawiono lokalnie; niczego nie usuwano/resetowano.
Nie edytowano istniejących kont. Hasła/klucze wyłącznie w pamięci lokalnego harnessu,
bez logowania. Uprzywilejowany pomocnik jest narzędziem terminala i nie trafia do APK.
Klient używa wyłącznie istniejącego API z Bearer sesji; brak service_role w aplikacji.
Nie testowano zmian produkcyjnego Supabase, nie wykonano migracji ani wdrożenia.

## Testy i wizualna zgodność

PASS: TypeScript, lint bez ostrzeżeń, **198/198 Vitest w 36 plikach**,
standardowy build, build demo i izolacja 16 plików, build lokalnego wariantu live.
**21/21 Cypress**: 9 oryginalnych frozen/UI/Wstecz, 2 B1 Auth, 8 wizualnych live,
2 B2 profil (zapis/restart/zmiana konta, brak profilu/retry/sieć/cofnięta sesja).
Cypress używa kontrolowanych odpowiedzi kontraktu; nie zastępuje 22 kontroli realnej bazy.
B1 zachował dotychczasowe asercje Auth; dodatkowe żądania profilu mają osobny alias,
oryginalna sekwencja Auth nadal jest sprawdzana. Nie usunięto ani nie wyłączono testów.

Guard frozen: **47 plików identycznych + 8 z technicznymi lub dozwolonymi zmianami danych**.
Dokładne zamiany B2 zapisane w `scripts/b2-data-ui.json`, po nich nadal działa
wcześniejsza allowlista B1. CSS, assety, Ultimate, nav, motywy i animacje nietknięte.

112 zrzutów widoków (88 demo + 24 live), szerokości 320/360/390/430, Light/Dark.
Porównano 88 oryginalnych ekranów demo i 8 niezmienionych home live:
**95/96 identycznych pikselowo**. Ścisły FAIL: wyłącznie znany `details-320-light`,
12 335 pikseli, max kanał 4/255; nie poprawiano tego odstępstwa A.
Nowych zrzutów własnego profilu nie porównujemy z fikcyjnym zdjęciem/liczbami jako
identycznych danych: świadomie pokazują rzeczywiste dane, inicjały i „—”.
Komponenty i style pozostają oryginalne; nie deklarujemy identyczności wszystkich
pikseli profilu przy zmienionej treści. Wybrane dowody w `docs/ui/slm-v1-b2/`,
bez prywatnych danych. Headless viewport ma wysokość 625 px; odbiór fizyczny pozostaje osobny.

PASS: cap sync Android, Gradle assembleDebug i JUnit (1 istniejący test),
kontrola wszystkich osadzonych świeżych zasobów/appId/lokalnego endpointu,
loggingBehavior=none, WebView debug=false. Ostrzeżenia dużych chunków/flatDir/Browserslist
pozostają; nie dodawano zależności ani zmian UI w celu ich wyciszenia.

## Zmienione pliki

Runtime: `auth/B1App.tsx`, nowe `auth/profileAdapter.ts`, `auth/useOwnProfile.ts`,
`ui/personalProfile.ts`; prezentacja danych w oryginalnych
`demo/App.tsx`, `demo/Profile.tsx`, `demo/Identity.tsx`.
Nie dodano nowego ekranu profilu ani formularza.

Testy/narzędzia: `auth/profileAdapter.test.tsx`, uzupełnienie `auth/B1App.test.tsx`
o izolację testowanego Auth od nowego pobierania profilu, `cypress/b1/auth.cy.ts`,
`cypress/b1/visual.cy.ts`, nowe `cypress/b2/profile.cy.ts`,
`scripts/b2-data-ui.json`, `scripts/compare-b2-visual.py`,
`scripts/test-b2-profile-local.mjs`, uzupełniony `scripts/verify-frozen-ui.mjs`.
Dokumenty: ten raport, STATUS, ODPOWIEDZI_CODEX, FRONTEND_HANDOFF (TODO B2.2),
bezpieczne obrazy i wyniki w docs/ui/slm-v1-b2.

## APK i fizyczny start

Pipeline zachowuje nazwę `scripts/build-b1-android.ps1` / `dist-b1`, teraz zawiera B2.1.
To istniejący wariant live; nie utworzono nowego projektu ani deploymentu.
APK: `app/android/app/build/outputs/apk/debug/app-debug.apk`.
Pełna ścieżka: `I:\slm\sunday-league-mates\.worktrees\slm-v1-live\app\android\app\build\outputs\apk\debug\app-debug.apk`.
Rozmiar: **8 465 980 B**. Pakiet `pl.psuda87.slm`, wersja 1.0.
SHA256: `e422912c4d74b8524ebf5dbdb40ee31680c23c34adf440e8ecce8df703ff322f`.

Fizyczny POCO c7a559b5: `install -r` Success, MainActivity Status ok,
hash zainstalowanego APK zgodny. Pierwsza instalacja 2026-10-23 21:38:01 zachowana,
aktualizacja 2026-10-24 21:24:39. `adb reverse tcp:54321 tcp:54321` zachowane.
Krótki logcat PID po starcie (500 wpisów): 0 sprawdzanych markerów native crash,
0 JS error, 0 sprawdzanych błędów sieci WebView/CSP/CORS. Surowych logów nie zapisano.
Nie wykonywano automatycznej edycji prywatnych danych właściciela na telefonie.

## Checklista POCO i zakres dalszy

1. Zaloguj się dotychczasowym lokalnym kontem. Profil pokazuje własną nazwę/inicjały,
   statystyki „—”; nie ma portretu ani numeru fikcyjnego zawodnika.
2. Profil → Edytuj profil: login jest tylko do odczytu, imię/nazwisko ma wartość serwerową.
3. Zmień imię/nazwisko → Zapisz dane → sprawdź potwierdzenie. Nie wysyłaj prywatnych danych.
4. Zamknij aplikację, uruchom i wróć do edycji: zapisana wartość ma pozostać.
5. Ustawienia → Dane konta: sprawdź login/telefon; brak operacji ich zmiany.
6. Mecze/grupy/uczestnicy nadal są jawnie demonstracyjne; nie mogą przejąć nowej nazwy konta.
7. Sprawdź logout/ponowny login, oba Wstecz i — jeśli dostępne — inne konto bez poprzednich danych.

**NOT TESTED ręcznie:** powyższy odbiór B2.1 na telefonie oczekuje odpowiedzi właściciela.
Wcześniejszy odbiór B1 pozostaje ważną historią, nie zalicza automatycznie B2.1.
Nie wykonywano świeżego odtworzenia całego lokalnego schematu z tego checkoutu ani kontroli zdalnej bazy.

B2.2: wyłącznie TODO w FRONTEND_HANDOFF — WebP 75–80%, max 800×800,
do 150 KB, kompresja przed wysłaniem, jedno bieżące zdjęcie, bez oryginałów,
bezpieczna podmiana/usuwanie. Bez implementacji Storage/uploadu teraz.
B2.1 zatrzymany do odbioru; nie rozpoczęto B2.2 ani B3. Bez push, merge i wdrożeń.

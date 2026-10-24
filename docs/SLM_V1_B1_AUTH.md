# SLM 1.0 — B1: Auth i sesja Supabase

Stan: 2026-10-24, gałąź `feat/slm-v1-live`. Kod: `7322d351e48b7dc044bf45b2345b602986cc45ea`.
Baza zaakceptowanego A: `ade6d1a`; wzorzec zamrożonego UI: `d0f9fa9`.
Zakres wyłącznie B1. Nie rozpoczęto B2–B6.

## Audyt i ponowne wykorzystanie

Sprawdzono historię bieżącej gałęzi oraz istniejący Auth z `feat/integration` (`13cf1a8`)
i zapisanej integracji Premium (`c6c2ff6`, `feat/premium320-visual-parity`).
`sessionManager.ts`, `tokenStore.ts` i ich testy były już dostępne w bazie UI i zgodne
z integracją. Nie kopiowano całych gałęzi, nie zastępowano sprawdzonych mechanizmów.
Wykorzystano bez zmian `auth/api.ts`, `SessionManager`, `tokenStore`,
`legacyAccountUiAdapter` oraz istniejące serwerowe operacje login/refresh/logout/password.
Różnice późniejszego API dotyczące zdjęć nie zostały przeniesione.

Zachowano rotację refresh, pojedynczy refresh w locie, generację blokującą późne odpowiedzi,
serwerową walidację sesji i uprawnień, obowiązkową zmianę hasła oraz bezpieczny zapis
wyłącznie refresh tokenu. Android nadal używa SecureStorage/Keystore, bez fallbacku
do Preferences/localStorage. Logowanie mostu Capacitor i debugowanie WebView wyłączone.
Hasła pozostają wyłącznie chwilowo w formularzu/żądaniu; brak ich zapisu w raportach i logach.

## Adaptery i uruchomienie

- `auth/b1Port.ts`: cienki port do istniejącego adaptera, mapowanie błędów formularza.
  Signup, e-mail recovery, potwierdzanie callbacku i zapis profilu są jawnie niedostępne;
  nie wykonują żądań i nie mogą udzielić dostępu. Bez nowych OTP/SMS/e-mail.
- `auth/useB1Lifecycle.ts`: wydzielona istniejąca obsługa startu, online/offline,
  visibility i Capacitor appStateChange; ukrycie świata przed ponowną walidacją,
  odświeżanie przed wygaśnięciem. Usuwane wyłącznie własne listenery.
- `auth/B1App.tsx`: niewizualny kontroler bramki plus kompozycja oryginalnych
  `AccountScreens` i oryginalnego świata demo. Błąd danych zostaje w tym samym formularzu.
  Hasło tymczasowe blokuje świat; powrót do logowania wylogowuje, nie omija bramki.
  Cofnięta sesja prowadzi do istniejącego ekranu wygasłej sesji, a dalej do logowania.
- Osobny entry/build `b1/`, `vite.b1.config.ts`, `npm run build:b1`, `dist-b1`.
  Tylko `http://127.0.0.1:54321/functions/v1/accounts`, bez dziedziczenia `.env`
  i bez produkcyjnego fallbacku. CSP ogranicza połączenia; HTTP w debug tylko localhost.
- `scripts/build-b1-android.ps1`: TypeScript, guard UI, świeży build B1, cap sync,
  Gradle debug/JUnit i sprawdzenie zgodności wszystkich web assets w APK.
- Lokalny pomocnik testowy skopiowany z integracji, ograniczony do bieżącej gałęzi
  i lokalnego socketu Dockera. Żadnego zdalnego Management API.

Izolowane demo `build:demo`/`dist-demo` i jego allowlista/CSP pozostają niezależne.
`AccountDemo`/jego symulator nie są podłączone do realnego Auth. W B1 nie można
wywołać prawdziwej sesji przyciskami symulatora. Dane meczów/grup/finansów/zawodników
nadal pochodzą z RAM demo i mają istniejące oznaczenie „Dane przykładowe”.
Nie są to dane zalogowanego konta; wybór użytkownika demo nie zmienia tożsamości Auth.
Dane RAM mogą wrócić do fixture po ponownej walidacji/restartach; nie dodawano ich zapisu.

## Kontrola zamrożonego UI — wszystkie zmienione pliki UI

Właściciel wyraźnie zatwierdził wyjątek: tekst „Login lub numer telefonu”, typ tekstowy,
walidację aliasu/telefonu i poprawne nazwy prawdziwych operacji bez „symulator”.

1. `src/account-ui/Fields.tsx`: opcjonalne `loginOrPhone`, ta sama kontrolka HTML i klasy.
2. `src/account-ui/AccountScreens.tsx`: opcjonalny tryb walidacji/podania identyfikatora.
3. `src/demo/App.tsx`: przekazanie opcjonalnego `liveAuth`, bez zmiany nawigacji/układu.
4. `src/demo/Profile.tsx`: tylko warunkowe napisy o haśle/wylogowaniu/sesji.
5. Nowy `src/auth/B1App.tsx`: oryginalna powłoka kont i `AccountScreens`, bez alternatywnego
   formularza i bez panelu symulatora w realnej bramce; logika steruje istniejącymi widokami.
6. Nowy `b1/main.tsx`/`index.html`: osobny entry i lokalna polityka CSP.

Domyślne propsy zachowują oryginalne demo. Żaden CSS, asset, Ultimate, boisko,
komponent nawigacji ani motyw nie został zmieniony. Guard porównuje z d0f9fa9
z dokładną allowlistą zatwierdzonych zamian w `scripts/b1-approved-ui.json`.
Wynik: 48 identycznych plików, 7 modułów z technicznymi lub zatwierdzonymi zmianami.
Nie deklarujemy całkowitej bajtowej identyczności tekstów kont po zatwierdzonym wyjątku.

## PASS — wykonane kontrole

- TypeScript `npx tsc --noEmit`, lint; Vitest **190/190, 35 plików**, w tym istniejące
  testy SessionManager/tokenStore/uiAdapter i 4 nowe scenariusze portu/bramki B1.
- `npm run build`, `npm run build:demo`, `npm run build:b1`.
  Izolacja demo: 16 plików bez produkcyjnego Auth/Supabase/Edge.
- Cypress: **19/19** (9 istniejących frozen/UI/Wstecz + 2 Auth B1 + 8 wizualnych B1).
  Testy B1 w przeglądarce korzystają z kontrolowanych odpowiedzi kontraktu;
  nie są przedstawiane jako test rzeczywistego Supabase.
- Rzeczywisty lokalny Supabase: błędne dane, login, telefon, hasło tymczasowe,
  zmiana hasła, nowa instancja SessionManager z zapisanym refresh, logout i odrzucenie
  cofniętego refresh. Użyto istniejącego klienta API/managera/portu B1.
- `npx cap sync android`, Gradle `assembleDebug` i `testDebugUnitTest` — 1 test, 0 błędów.
- Weryfikacja APK: appId, dist-b1, brak logowania mostu/debugowania WebView,
  lokalny endpoint, zgodność świeżych zasobów, brak markerów kluczy uprzywilejowanych.
- Instalacja fizyczna POCO `c7a559b5`: `adb install -r` **Success**;
  start MainActivity **Status ok / COLD**, proces działa. Zainstalowany APK ma ten sam SHA256.
  Pierwsza instalacja nadal 2026-10-23 21:38:01; aktualizacja 2026-10-24 20:27:16.
  Nie odinstalowano aplikacji i nie czyszczono danych. `adb reverse tcp:54321 tcp:54321`.
- Krótka kontrola 500 wpisów logcat PID po starcie: 0 markerów native crash,
  0 JS error i 0 sprawdzanych błędów sieci WebView/CSP/CORS. To nie jest pełny soak test.

## Wizualne wyniki i odstępstwo

88 zrzutów izolowanego demo + 24 zrzuty kompozycji B1, cztery szerokości
320/360/390/430 i oba motywy. Porównanie 88 demo oraz 16 home/profile B1:
**103/104 identyczne piksel w piksel**. Wszystkie 16 home/profile B1 identyczne.
**FAIL ścisłego porównania:** znane już w A `details-320-light`, 12 335 pikseli,
maksymalna różnica kanału 4/255 w renderowaniu hero; brak zmian CSS/assets.
Nie ukryto odstępstwa ani nie zmieniono zrzutów. Osiem zrzutów logowania B1 nie
podlega równości pikselowej z symulatorem: zatwierdzone napisy i realna bramka bez
symulatora. Obejrzano login 320 Light/390 Dark: oryginalne pola, brak kolizji etykiety.
Headless Chrome zapisuje viewport o wysokości 625 px, nie pełny ekran fizycznego telefonu.
Dowody: `docs/ui/slm-v1-b1/` — wybrane zrzuty bez prywatnych danych i `parity.json`.

## Backend i ograniczenia

Docker po starcie potrzebował czasu; początkowe HTTP500/brak portu ustąpiły.
Wznowiono istniejący zatrzymany kontener Edge; bez zmiany źródeł, wdrożenia czy migracji.
Nie zmieniano konfiguracji Auth, SQL/RPC/RLS, zasad uprawnień, finansów, Firebase ani produkcji.
Testy zostawiły **dwa nowe fikcyjne konta** (jedno po nieudanym uruchomieniu harnessu
SSR i jedno po pełnym teście). Nie usuwano kont/danych, nie resetowano bazy.
Istniejące konta pozostają bez zmian. Brak sekretów/haseł tych fixture w dokumentacji.
Ostrzeżenia istniejące: duże chunki web, Gradle flatDir i stare dane Browserslist;
nie dodawano zależności ani nie przebudowywano UI dla ich wyciszenia.

## NOT TESTED — ręczny odbiór B1

Użytkownik ma potwierdzić na aktualnym APK: poprawne i błędne logowanie, restart,
Home/powrót, wylogowanie/powrót po restarcie, oba Wstecz i ewentualną zmianę hasła.
Dotychczasowe potwierdzenia właściciela dotyczą A, nie są automatycznie zaliczeniem B1.
Fizyczna utrata internetu i naturalne wygaśnięcie sesji także niepotwierdzone;
scenariusze te były sprawdzone automatycznie w managerze/bramce.

## APK i krótka checklista

APK: `app/android/app/build/outputs/apk/debug/app-debug.apk`, 8 464 604 B.
SHA256: `c2b8185eea1134b3c0ed9797683a0034506e408ce1874009d71aa08b763eedd0`.
Źródłowy commit APK: `7322d351e48b7dc044bf45b2345b602986cc45ea`.

1. Zaloguj się dotychczasowym lokalnym loginem lub telefonem. Nie wysyłaj hasła.
2. Przy haśle tymczasowym użyj oryginalnego formularza zmiany; świat musi być zablokowany.
3. Sprawdź oznaczenie danych przykładowych. Profil i statystyki demo nie są danymi konta Auth.
4. Home → powrót, zamknięcie/ponowne uruchomienie: po walidacji serwera dostęp wraca.
5. Profil → Ustawienia → Wyloguj; po restarcie ma pozostać ekran logowania.
6. Zaloguj ponownie, sprawdź strzałkę ekranową i systemowe Wstecz.
7. Przy odłączonym backendzie dostęp do świata ma być ukryty, po przywróceniu można ponowić.

Po odłączeniu USB może być potrzebne ponowne `adb -s c7a559b5 reverse tcp:54321 tcp:54321`.
Zatrzymanie po B1; dalsze integracje wymagają kolejnej decyzji. Bez push i merge.

# Powiadomienia — Sunday League Mates / Soccer Room 2.0

Aktualizacja integracji 14.10.2026: na `feat/integration` połączono oba moduły.
TypeScript, lint i build: OK; SQL, migracje, RLS, FCM i testy urządzeń niewykonane.
Adapter finansowy podłączono w kodzie migracji, bez zastosowania do bazy.
Aktualny zakres i ograniczenia: [INTEGRATION_REPORT.md](INTEGRATION_REPORT.md).
Poniższy opis zachowuje historyczny stan gałęzi źródłowej oraz plan przyszłej weryfikacji.

14.10.2026, `feat/push-notifications`. **Implementacja nieprzetestowana i niewdrożona.**
Baza: `origin/feat/events`, `6638e18b4ed763e5bdee45ea61416a576e00bbec`.
Sprawdzono czysty checkout i zdalny zapis rozliczeń:
`origin/feat/settlements` → `81d71c7fb24dc4b410f178c3fa4101a5fa2ce410`.
Nie przenoszono rozliczeń i nie scalano gałęzi. Commit/push tego etapu autoryzował
użytkownik; rzeczywisty SHA i wynik odczytu origin są podawane w podsumowaniu.

Nie uruchomiono testów, Cypress, lintowania, sprawdzania typów, kompilacji,
buildów, emulatorów, synchronizacji Capacitor, migracji ani wdrożeń. Przygotowane
testy nie są wynikami testów. Wykonano tylko zmianę manifestu/lockfile zależności
przez `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`
i odczyt opublikowanego źródła pluginu. Nowy plugin nadal wymaga `npm ci` i
późniejszej synchronizacji natywnej na komputerze.

## Zakres

- Nowy mecz: inbox dla aktywnych członków, z wyłączeniem autora.
- Zwolnienie miejsca przez rezygnację lub przejście na rezerwę: powiadomienie
  uprawnionych płatników/osób odpowiedzialnych za rezerwowe udziały. Jedna pozycja
  historii zwolnienia to jedno źródło; konto z kilkoma gośćmi dostaje jeden inbox.
  Nie ma awansu automatycznego. Zapis nadal atomowo sprawdza czas, limit, konto
  i adapter uprawnień. Kto pierwszy skutecznie zapisze się, otrzymuje miejsce.
- Przypomnienia 24h i 2h przed początkiem: znaczniki UTC wynikają z lokalnego
  terminu Europe/Warsaw przeliczonego przez istniejący moduł wydarzeń. Odejmowane
  są rzeczywiste godziny; DST nie wymaga zegara telefonu. Nie planuje się
  przypomnień, których termin już minął przy tworzeniu/edycji wydarzenia.
- Zmiana terminu, miejsca lub czasu gry oraz anulowanie: inbox dla zapisanych
  zawodników i odpowiedzialnych za zapisanych gości. Koszt, limit i updated_at
  same w sobie nie tworzą powiadomienia o zmianie terminu.
- Odtwarzanie po opóźnieniu schedulera: 24h jest pomijane w oknie ostatnich 2h;
  po początku meczu wszystkie niewysłane przypomnienia są pomijane. Odwołanie
  i zmiana terminu anulują stare plany. Powrót do wcześniejszego terminu wznawia
  jego niewykonany plan, bez ponowienia wcześniej wyemitowanego źródła.
- Centrum: historia, licznik nieprzeczytanych, przeczytanie jednego/wszystkich,
  otwarcie meczu z własnego rekordu i ustawienia kategorii push. Brak zgody na
  systemowe powiadomienia lub brak Firebase nie wyłącza inbox. Kategorie
  wyłączają kanał systemowy, nie usuwają historii.
- Finansowe kontrakty są osobne i nie emitują niczego na tej bazie. Szczegóły:
  [PUSH_FINANCE_ADAPTER.md](PUSH_FINANCE_ADAPTER.md).

## Architektura i bezpieczeństwo

Historia wydarzeń → transakcyjny trigger → źródło i inbox → kolejka per urządzenie
→ bezpieczny worker Supabase Edge → FCM HTTP v1 → natywny Capacitor.
Źródła mają unikalny source_key, inbox unikalne (source_id,user_id), a kolejka
unikalne (notification_id,device_id). Historii nie tworzy klient ani FCM.
Nie ma Firebase Authentication, Firestore, SDK Admin w kliencie ani płatnej usługi.

RLS jest włączone na wszystkich tabelach. Członek widzi własny inbox i preferencje
oraz niesekretne kolumny własnych urządzeń. Ani token, ani hash sekretu urządzenia
nie są dostępne przez klientowy SELECT. Brak klientowych write i EXECUTE do
workerowych RPC. `accounts` weryfikuje JWT i session_id; RPC ponownie sprawdza
żywą, zaakceptowaną sesję, aktywność, brak operacji bezpieczeństwa i zmianę hasła.
Body z cudzym user_id nie zmienia wykonawcy. Deep link z FCM zawiera tylko UUID
powiadomienia: backend zwraca cel dopiero po sprawdzeniu własności inbox.

Token jest związany z kontem, sesją i instalacją; wiele urządzeń to wiele rekordów.
Zmiana tokenu aktualizuje ten sam rekord. Zmiana/wylogowanie sesji nie pozwala
obsługiwać starych wiadomości jako danych nowego konta. Usunięcie zaakceptowanej
sesji usuwa jej urządzenia przez FK; reset również wyłącza ich dostawy.

Instalacja ma losowy sekret capability i ID; są przechowywane tylko w
Keystore/Keychain przez istniejący SecureStorage. Token FCM nie jest zapisywany
przez kod JS do localStorage. Wylogowanie wyłącza rejestrację natywną, czyści
wyświetlone alerty i zapisuje oczekujące usunięcie. Capability pozwala dokończyć
detach po powrocie internetu bez przechowywania refresh tokenu wylogowanego konta.
Losowy binding_id zapobiega usunięciu nowego powiązania przez spóźniony detach.
Monotoniczna binding_version i watermark przechowywany po usunięciu urządzenia
blokują spóźnioną rotację starego tokenu. Detach wycofuje wszystkie wersje do
wskazanej włącznie, więc obejmuje również niepotwierdzoną rejestrację po timeout.
Pierwszy token jest rejestrowany dopiero po uwierzytelnionym `prepare_device`;
anonimowy detach nie zapisuje nieznanych ani niepoprawnych capabilities.
Tombstone wycofanego powiązania blokuje spóźnioną rejestrację po logout; retencja
30 dni przekracza czas życia pierwotnego access tokenu. Endpoint detach nie
ujawnia poprawności sekretu ani istnienia urządzenia i podlega ograniczeniom prób.

Worker wymaga dedykowanego `PUSH_WORKER_SECRET`; nie akceptuje zwykłego tokenu
użytkownika. Klucz konta usługi i Supabase service_role są wyłącznie w Edge Secrets.
JWT OAuth jest podpisywany RSA/SHA-256 z zakresem Firebase Messaging i wysyłany
do stałego oauth2.googleapis.com; wysyłka idzie do fcm.googleapis.com HTTP v1.
Bez konfiguracji Firebase worker przygotowuje inbox przypomnień, ale nie pobiera
zadań wysyłki. Błędny klucz/OAuth również nie zużywa prób wiadomości.

Worker pobiera do 12 zadań, wysyła do 4 równolegle. `FOR UPDATE SKIP LOCKED`,
UUID lease i 2-minutowa rezerwacja chronią równoczesne workery. Przed wysyłką
ponownie sprawdza sesję, preferencje, token, ważność źródła i stan meczu;
zwolnione miejsce wymaga nadal wolnego miejsca i rezerwy. Ponowienia mają
backoff do godziny, uwzględniają Retry-After i kończą się po 6 rezerwacjach.
UNREGISTERED wyłącza tylko dokładnie ten token, którego dotyczyła odpowiedź;
odpowiedź starego workera nie zmienia nowego lease. INVALID_ARGUMENT nie usuwa
tokenu, bo może oznaczać błąd payloadu. Last_error zawiera tylko stały kod,
nie dane urządzenia lub treść odpowiedzi FCM.

FCM akceptuje dostawę, ale nie gwarantuje pojawienia się alertu. Po timeout
nie wiadomo, czy wiadomość została przyjęta; wysyłka jest **at-least-once**,
z identyfikatorem inbox jako tag/collapse-id. Wewnętrzna idempotencja nie zapewnia
zewnętrznego exactly-once. Inbox i oznaczanie przeczytania są idempotentne.
Na ekranie blokady jest ogólny tekst, bez nazw, lokalizacji, kwot i zadłużenia.
TTL jest ograniczone do godziny i daty wygaśnięcia źródła.

## Przygotowane migracje i harmonogram

Wymagane wcześniejsze migracje Auth/events; wszystkie nowe pliki nadal niewykonane:

1. `20261014120000_notifications_core.sql`: preferencje, urządzenia/revocations,
   źródła, inbox, kolejka, harmonogram, RLS i trigger wydarzeń.
2. `20261014121000_notifications_rpc_and_worker.sql`: urządzenia, historia,
   przeczytanie, preferencje, claim/check/finish i capability detach.
3. `20261014122000_notifications_events_eligibility.sql`: adapter uprawnień
   przy zapisie. Bez modułu rozliczeń kontroluje aktywność, a nie fikcyjne długi.

`app/supabase/operations/enable_push_schedule.sql` to osobny **niewykonany skrypt**,
nie migracja. Po późniejszym włączeniu pg_cron/pg_net tworzy dwa zadania co minutę:
przygotowanie przypomnień w bazie i HTTP wywołanie workera z Vault. Nazwy zadań
są stałe, więc ponowienie konfiguracji nie mnoży harmonogramów. Bez sekretów
workera nadal działa bazowe zadanie inbox. Nie zależy to od otwarcia aplikacji.
Jeden worker/minutę to ok. 43 200 wywołań w 30 dni; sprawdzić aktualne limity
Supabase Free w projekcie przed włączeniem i monitorować całość razem z Auth/API.
Dokumentacja Free określa 150s wall clock; worker ma ograniczone porcje i timeouty.
Nie włączano billing ani płatnych planów.

## Późniejsze połączenie Firebase z Supabase

To instrukcja przyszłej konfiguracji, nie wymaganie dostarczenia plików teraz.

1. Utworzyć/wybrać Firebase na **Spark**, wyłącznie FCM. Zarejestrować aplikację
   Android z package `pl.psuda87.slm`. Nie dodawać Auth, Firestore ani Analytics.
   Pobrać lokalny `google-services.json` do `app/android/app/` (plik ignorowany).
   Gradle już warunkowo stosuje google-services, gdy plik istnieje; natywny guard
   sprawdza konfigurację przed wywołaniem Firebase. Bez pliku zwykła aplikacja działa.
2. Włączyć Firebase Cloud Messaging HTTP v1 API w projekcie. Przygotować osobne
   konto usługi z uprawnieniem wysyłki FCM (`cloudmessaging.messages.create`,
   odpowiednia rola Firebase Cloud Messaging API Admin), bez szerokiego Owner.
   Klucz przechowywać bezpiecznie poza repozytorium; nie wklejać go w rozmowę.
3. W Supabase Edge Secrets dodać `FCM_SERVICE_ACCOUNT_JSON` (project_id,
   client_email, private_key) i losowy, niezależny `PUSH_WORKER_SECRET`.
   SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY dostarcza platforma. Nigdy nie
   przekazywać kluczy serwera jako VITE_* ani pakować ich do aplikacji.
4. Po autoryzacji późniejszego wdrożenia zastosować migracje, wdrożyć `accounts`
   i `push-worker`. Konfiguracja `verify_jwt=false` workera wymaga jego własnego
   sekretu Bearer, a accounts zachowuje weryfikację Auth w handlerze.
5. Włączyć pg_cron i pg_net zgodnie z dokumentacją hostowanego Supabase, dodać
   przez Vault UI `slm_push_worker_url` i `slm_push_worker_secret` (ten sam sekret
   co w Edge), a następnie wykonać skrypt harmonogramu. Nie wpisywać wartości
   do SQL w repo. Sprawdzić uprawnienia do Vault oraz tabel pg_net z nagłówkami.
6. Gdy Android jest skonfigurowany, lokalnie ustawić `VITE_SLM_PUSH_ENABLED=true`.
   Wcześniej domyślnie false. Wykonać później `npm ci`, web build, cap sync android
   i kompilację. Użytkownik świadomie wybiera „Włącz na tym urządzeniu”; nie ma
   automatycznego pytania o zgodę podczas logowania.
7. Dostęp sieciowy Edge: projekt Supabase, oauth2.googleapis.com i
   fcm.googleapis.com. FCM/Spark nie wymaga płatnego backendu Firebase Functions.

## Android i iOS

Android: Capacitor Push Notifications 8.0.0, Java guard konfiguracji, uprawnienie
POST_NOTIFICATIONS dla 13+, własny kanał `slm_updates` i biała ikona. Android 12
i starszy wymaga też sprawdzenia blokady powiadomień w ustawieniach OS, bo plugin
zwraca tam granted. Listener akcji jest zakładany przed autoryzacją i przechowuje
tylko ID do późniejszego otwarcia po sprawdzeniu sesji. Capacitor 8 BridgeActivity
przekazuje zarówno intent startowy, jak i onNewIntent; obsługa cold startu opiera
się na zatrzymanej akcji pluginu. **To odczyt źródeł, nie test na telefonie.**
Foreground odświeża licznik bez wyświetlania prywatnych danych w dodatkowym
systemowym alercie. Urządzenie bez GMS może nie obsługiwać FCM; inbox nadal działa.

iOS: nie ma jeszcze projektu platformy. Przygotowano pliki Swift w `app/native/ios/`.
Potrzebne FirebaseCore/FirebaseMessaging, Push Notifications capability,
odpowiedni provisioning, klucz/certyfikat APNs przypisany w Firebase oraz
Bundle ID `pl.psuda87.slm`. Ustawić w Info.plist FirebaseMessagingAutoInitEnabled=NO,
FirebaseAppDelegateProxyEnabled=NO i FirebaseAnalyticsCollectionEnabled=NO;
przekazać APNs do Messaging i powiadomienia Capacitor zgodnie z przykładem.
Zarejestrować lokalny SlmFcmBridgePlugin w używanym CAPBridgeViewController.
Token z Capacitor na iOS jest **APNs**, nie FCM; adapter pobiera osobny token FCM
z Messaging, obsługuje rotację i usunięcie. Background Modes/Remote notifications
dodać tylko przy rozszerzaniu o silent push (obecna wersja wysyła zwykłe alerty).
Konfiguracja Apple/provisioning i dostęp do APNs są osobnymi wymaganiami;
nie tworzyliśmy kont, nie dodawaliśmy kluczy ani nie autoryzowaliśmy opłat.
**Nie deklarujemy gotowości iOS.**

## Wieczorna weryfikacja na Androidzie — wyłącznie plan

1. Sprawdzić gałąź i diff, przygotować izolowany lokalny Supabase z fikcyjnymi
   kontami. Zastosować migracje tylko lokalnie. Obecny accounts/index.ts ma ochronę
   konkretnego projektu; do lokalnego uruchomienia handlera użyć osobnego lokalnego
   `accounts/local-entrypoint.example.ts` z lokalnym URL, bez osłabiania ochrony
   produkcyjnego pliku. Przykład można uruchomić później lokalnym Deno z lokalnymi
   zmiennymi Supabase i skierować VITE_SLM_FUNCTION_URL na jego port; nie deployować.
2. Zainstalować zależności (`npm ci`), uruchomić lint/typy/build, Vitest, Cypress
   i przygotowany SQL `app/supabase/tests/notifications.sql` z ON_ERROR_STOP=1.
   SQL tworzy lokalne fixture'y i kończy się ROLLBACK. Nie jest testem JWT ani
   rzeczywistej równoczesności, a kontrolowane API Cypress nie sprawdza FCM.
3. Sprawdzić aplikację bez pliku Firebase i z flagą false: login, mecze, inbox,
   licznik i błąd niedostępnego modułu nie mogą być uzależnione od Firebase.
4. Na testowym Spark/Android skonfigurować plik Firebase, Edge Secrets i scheduler
   wyłącznie w uzgodnionym środowisku testowym. Zrobić web build, cap sync android,
   kompilację i instalację na fizycznym telefonie z GMS (Android 13+ oraz starszy).
5. Użytkownik A tworzy mecz: A bez alertu/inbox, pozostali aktywni z inbox;
   konto nieaktywne bez dostawy. Zgoda, odmowa, ustawienia OS, wyłączone kategorie
   i brak tokenu nie mogą usuwać historii. Zweryfikować RLS cudzych rekordów,
   brak SELECT tokenu i odmowę wywołania workerowych RPC przez anon/member.
6. Rezerwa: dwa telefony, rezygnacja jednego udziału, jeden inbox na zwolnienie,
   brak autoawansu, równoczesny zapis i tylko jeden zwycięzca. Otworzyć alert
   po zajęciu miejsca — backend musi odrzucić brak miejsca. Ponowić wycofanie
   tej samej osoby i upewnić się, że nie utworzy nowego źródła.
7. Przypomnienia: sprawdzić 24h/2h, zmianę terminu A→B→A, anulowanie, restart
   schedulera oraz zimę/lato/DST na lokalnych fixture'ach. Nie wprowadzać zegara
   testowego ani endpointu manipulacji czasem do zdalnej produkcji.
8. Odebrać i kliknąć push w foreground, tle i po zamknięciu procesu. Najpierw
   potwierdzenie sesji, potem własny inbox i właściwy mecz. Powtórzyć z wygasłą
   sesją i z innym kontem; brak ujawnienia danych poprzedniego użytkownika.
9. Dwa urządzenia jednego konta, rotacja tokenu, wylogowanie online/offline,
   odzyskanie internetu, zmiana konta. Opóźnić register/detach: stary detach
   nie usuwa nowego binding_id, a spóźniony register nie odtwarza logout.
10. Równoległe workery, wygasły lease, timeout po przyjęciu przez FCM, 429/503,
    UNREGISTERED, błąd payloadu, zły projekt/APNs. Sprawdzić 6 prób, backoff,
    martwe zadania, brak kasowania nowego tokenu po odpowiedzi starego workera
    i brak sekretów/tokenów w logach. `sent` oznacza przyjęcie przez FCM, nie odbiór.
11. Zanotować rzeczywiste wyniki w STATUS.md. Integrację finansów i iOS sprawdzić
    osobno. Nie scalaliśmy gałęzi i nie wykonywaliśmy tych kroków w tym zadaniu.

## Ryzyka i nieweryfikowane elementy

SQL/RLS, TypeScript, kod Java/Swift, synchronizacja pluginu, realny FCM, APNs,
GMS, cold start, zgody i wyścigi pozostają nieweryfikowane. Po przyjęciu przez FCM
nie można wycofać alertu, jeżeli mecz anulowano w trakcie sieciowej wysyłki;
tekst jest ogólny, TTL ograniczone, a aktualny stan zawsze sprawdza aplikacja.
Kolejka nie gwarantuje odbioru ani exactly-once, a źródła z przeterminowanym
alertem nadal pozostają w historii. Rejestracja nowego urządzenia nie rozsyła
wstecz starych inboxów. Limit historii UI to pierwsze 10 050 pozycji; dane w bazie
nie są automatycznie kasowane. Trzeba monitorować retencję, rozmiar inbox/kolejki,
dead-letter oraz limit Free; nie zaprojektowano automatycznego płatnego rozszerzania.
Awaria Keystore przy logout offline może uniemożliwić zapis capability usunięcia;
klient mimo to próbuje wyrejestrować token, a online logout usuwa urządzenie przez FK.
FCM registration bazuje na tokenie podanym przez zalogowanego klienta; nie wdrożono
App Check/attestacji. Nie deklarować weryfikacji fizycznego urządzenia przez serwer.

Źródła: opublikowany README i źródła `@capacitor/push-notifications@8.0.0`,
Capacitor 8 BridgeActivity, oficjalne pliki Supabase `schedule-functions.mdx`
i `limits.mdx` z repo supabase/supabase. Bezpośrednie strony capacitorjs.com,
firebase.google.com i supabase.com zwróciły HTTP 403 w tej maszynie; weryfikacja
aktualnych ustawień Firebase/Spark/IAM w konsoli pozostaje do wykonania.


## Pliki zmienione i nowe w tym etapie

```text
.gitignore
AGENTS.md
README.md
app/.env.example
app/android/app/src/main/AndroidManifest.xml
app/android/app/src/main/java/pl/psuda87/slm/MainActivity.java
app/android/app/src/main/java/pl/psuda87/slm/SlmPushConfigurationPlugin.java
app/android/app/src/main/res/drawable/ic_stat_slm.xml
app/capacitor.config.ts
app/cypress/e2e/notifications.cy.ts
app/native/ios/AppDelegate-push.example.swift
app/native/ios/SlmFcmBridge.swift
app/package-lock.json
app/package.json
app/src/notifications/deviceStore.ts
app/src/notifications/financeAdapter.ts
app/src/notifications/model.test.ts
app/src/notifications/model.ts
app/src/notifications/nativePush.ts
app/src/pages/Accounts.tsx
app/src/pages/Events.tsx
app/src/pages/Notifications.css
app/src/pages/Notifications.tsx
app/supabase/config.toml
app/supabase/functions/accounts/handler.ts
app/supabase/functions/accounts/local-entrypoint.example.ts
app/supabase/functions/push-worker/deno.json
app/supabase/functions/push-worker/fcm.test.ts
app/supabase/functions/push-worker/fcm.ts
app/supabase/functions/push-worker/handler.test.ts
app/supabase/functions/push-worker/handler.ts
app/supabase/functions/push-worker/index.ts
app/supabase/migrations/20261014120000_notifications_core.sql
app/supabase/migrations/20261014121000_notifications_rpc_and_worker.sql
app/supabase/migrations/20261014122000_notifications_events_eligibility.sql
app/supabase/operations/enable_push_schedule.sql
app/supabase/tests/notifications.sql
docs/PUSH_FINANCE_ADAPTER.md
docs/PUSH_NOTIFICATIONS.md
docs/STATUS.md
```

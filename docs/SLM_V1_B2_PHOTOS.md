# Aktualizacja profilu — cover i alias legacy

2026-10-24 22:51:36 Europe/Warsaw — implementacja kadrowania i istniejącego aliasu legacy
feat/slm-v1-live, baza d4bf855; wcześniejsze lokalne wpisy diagnostyczne zachowane.
ZMIENIONO: rzeczywiste zdjęcie na Ultimate ma lokalnie object-fit:cover i object-position50%35%.
Wypełnia oryginalny obszar3:4 bez deformacji; istniejące maski/gradienty obejmują cały obraz.
Nie zmieniono globalnego CSS, wymiarów, projektu karty, assetów ani demo sheet/contain w izolowanym demo.
To kadrowanie bez wykrywania twarzy; bardzo nietypowe kadry mogą wymagać przyszłego edytora.
ZMIENIONO: jawny email_account z istniejącej odpowiedzi API steruje edycją aliasu.
Wyłącznie legacy(email_account=false) ma edytowalny login w istniejącym formularzu;
po zmianie pojawia się pole obecnego hasła. Hasło tylko chwilowo w RAM/formularzu,
czyszczone po submit, bez zapisu/logów. Nieznany typ konta pozostaje readonly.
Adapter używa istniejącego identifiers przez SessionManager.changeSession, przekazując
niezmieniony telefon. Weryfikacja hasła, normalizacja, konflikt/UNIQUE i begin/finish
pozostają po stronie dotychczasowego serwera. Nowa zatwierdzona sesja zapisuje się
istniejącym magazynem, a profil jest ponownie odczytany. UUID/techniczny e-mail bez zmian.
Zapis nazwy/numeru następuje przed zmianą aliasu; błąd aliasu nie cofa już zapisanych pól.
Nie podmieniono ani nie wyłączono żadnej funkcji B1/B2, galerii, numeru lub zdjęć.
BLOKADA BACKENDU: dla email_account=true obecny save_email_profile zmienia nickname,
ale nie wymaga hasła dla samego pseudonimu i nie daje unikalności jak alias legacy.
Nie użyto tego jako obejścia. Pole opisano jako pseudonim konta e-mail i pozostawiono
readonly; e-mail logowania nie jest zmieniany. Obsługa zgodna z nowymi wymaganiami
wymaga osobno zatwierdzonej zmiany kontraktu/backendu i sprawdzenia unikalności obu modeli.
PASS: TypeScript/lint, frozen guard46+9,23 ukierunkowane Vitest profilu/sesji,2 Cypress:
zapis/anulowanie nazwy i numeru, cover, upload/replace/delete, galeria/restart/logout oraz
legacy hasło/konflikt/odświeżenie profilu/restart i logowanie nowym aliasem.
Test aliasu korzystał z kontrolowanych odpowiedzi; nie jest testem nowego aliasu
na prawdziwym koncie ani dowodem nowego wdrożenia serwera. Pełnych zestawów nie uruchamiano.
Build live/Capacitor sync/Android debug/JUnit1(cache)/weryfikator APK PASS.
APK zainstalowano -r na POCO bez czyszczenia danych; uruchomienie Status ok,
zgodność sumy na telefonie potwierdzona; crash/uncaughtJS/WebView=0.
SHA25634dbd12444f21d12806ebe81ccd005a840653a993e6c55fdec8a93f3d43d7c4f.
POCO DO ODBIORU: zdjęcia pionowe/kwadratowe/poziome (kadrowanie i maska), restart,
nazwa/numer i zdjęcia nadal działają. Jeśli dostępne konto legacy: login+obecne hasło,
konflikt loginu, restart/logout/logowanie nowym loginem. Dla konta e-mail readonly jest
jawną blokadą, nie awarią logowania; bieżący e-mail nadal służy do logowania.
Zdalny Supabase, RLS, migracje, Storage i Edge bez zmian; bez push/merge i B3/B4.
Dokumentacja sesji sprawdzona: https://supabase.com/docs/guides/auth/sessions .

# Odbiór i uwagi po B2.2 — diagnostyka

2026-10-24 22:42:08 Europe/Warsaw — odbiór B2.2 i trzy uwagi (wyłącznie diagnostyka)
feat/slm-v1-live, d4bf855. Właściciel potwierdził PASS ręczny na POCO: zdjęcia,
imię/nazwisko, numer, zapis/anulowanie i restart. Lokalny B2.2 funkcjonalnie odebrany.
Uwagi poniżej pozostają TODO; nie wyłączono żadnej integracji B1/B2.

1. Zdjęcie Ultimate: CSS variables.css i fictional-portraits.webp są bez różnic względem
   d0f9fa9 (git diff pusty); obejrzano oryginalny arkusz czterech fikcyjnych portretów.
   Obszar portretu ma3:4. Demo sheet: obraz200%/200%, przesunięcie wybranego portretu,
   object-fit:fill; pojedynczy upload:100%/100%, object-fit:contain. Maska gradientowa
   jest na zewnętrznym obszarze, nie na faktycznej powierzchni zdjęcia po contain.
   Zdjęcie kwadratowe/poziome ma wewnętrzne marginesy: jego krawędzie mogą wypaść
   poza strefą wygaszania maski. Demo ma też przygotowane bordowe tło pasujące do karty;
   zwykłe zdjęcie zachowuje własne tło. Kompresja nie usuwa tła ani nie kadruje do3:4.
   Oryginał nie ma osobnego border-radius na portrecie; obrys tarczy nie zaokrągla
   automatycznie wewnętrznych krawędzi zdjęcia. Kod maski nie został usunięty w B2.2.
   To potwierdzona różnica geometrii i uzasadniona przyczyna słabszego efektu, nie dowód
   awarii mask-composite na konkretnym WebView. Prywatnego zdjęcia ani computed styles
   telefonu nie odczytywano. TODO po zgodzie: porównać single/sheet w tym samym WebView,
   następnie uzgodnić lokalną maskę/zaokrąglenie rzeczywistej powierzchni obrazu albo
   kadrowanie z podglądem do3:4, bez deformacji i zmiany projektu karty. Bez automatycznego
   usuwania tła. Nie zmieniono CSS ani przygotowania zdjęć.

2. Login/pseudonim: readonly jest dotychczasowym ograniczeniem adaptera B2, nie brakiem
   wszystkich operacji backendu. Legacy ma identifiers w accounts oraz changeSession:
   obecne hasło weryfikuje Auth, login jest normalizowany, konflikt wstępnie sprawdzany,
   UNIQUE(login_normalized)/UNIQUE(phone) zabezpiecza także wyścig; begin/finish zatwierdza
   nową sesję. UUID i techniczny e-mail pozostają stałe — synchronizacja oznacza aliasy
   i wersję sesji, nie zmianę auth.email/auth.phone ani hasła. Propozycja po zgodzie:
   podłączyć istniejący flow przez adapter, zapisywać zweryfikowaną sesję istniejącym
   SessionManager, odczytać profil ponownie; test starego/nowego loginu, duplikatu,
   błędnego hasła, przerwanej operacji i starej sesji. Nie omijać operation_pending.
   Istotne: identifiers odrzuca email_account. W tym modelu profile.login pochodzi
   z nickname, a logowanie z e-maila Auth; save_email_profile zmienia pseudonim/kontakt,
   nie ustanawia nowego aliasu logowania. Nie wolno nazwać edycji nickname zmianą loginu
   ani obiecać jego unikalności jak legacy. TODO: jawnie rozdzielić typ konta i znaczenie
   pola; ewentualne aliasy dla kont e-mail wymagają osobnej decyzji i testów kontraktu.

3. Edytowalne: imię/nazwisko, zdjęcie i numer już działają; docelowo wybór display_as,
   pseudonim/login i telefon w odpowiednim chronionym przepływie, hasło wyłącznie
   istniejącą operacją Auth. Chronione: UUID, techniczny e-mail, typ konta, rola,
   blokady/wersje/sesje/tokeny i hashe haseł — nigdy zwykły formularz profilu.
   Adres logowania konta e-mail nie jest technicznym polem do dowolnej edycji; poza zakresem.
   Telefon legacy: ponownie wykorzystać identifiers + obecne hasło, normalizację
  9cyfr/+48/0048 do+48XXXXXXXXX, unikalność serwerową i kontrolowaną wymianę sesji.
   Zachować historyczny zagraniczny alias przy niezmienionym numerze; nowych nie dodawać.
   Telefon konta e-mail: istniejący save_email_profile wymaga obecnego hasła przy zmianie,
   ale jest to kontakt, nie automatyczny alias logowania. Przed wspólnym polem trzeba
   sprawdzić kolizje między modelami; osobne indeksy nie dowodzą globalnej unikalności.
   Bez SMS/OTP i bez auth.phone. Hasło potwierdza uprawnienie do zmiany, nie posiadanie
   nowego numeru; nie pokazywać numeru jako zweryfikowanego. Zachować prywatność telefonu.

Zakres kontroli: wyłącznie wskazane komponenty/CSS, lokalne źródła accounts i istniejące
kontrakty Auth/SQL. Bez zapytań do Supabase, zmiany konfiguracji, nowych testów/builda/APK,
push, merge i wdrożeń. Nie zmieniono kodu produkcyjnego ani CSS. Nie rozpoczęto B3/B4.

# Ostatnia poprawka B2.2 — zakończona lokalnie

2026-10-24 22:30:09 Europe/Warsaw — ostatnia poprawka formularza B2.2
Gałąź feat/slm-v1-live; baza899b631/c5eaf2c i późniejsze lokalne zmiany zachowane.
Numer koszulki jest polem pod imieniem i nazwiskiem w istniejącym Edytuj profil:
klawiatura numeryczna, walidacja0–99, Zapisz dane zapisuje oba pola, Anuluj odrzuca oba szkice.
Usunięto osobny przycisk i dodatkowy panel w prawdziwym profilu. Kliknięcie istniejącego
numeru na karcie otwiera ten sam formularz; projektu Ultimate nie zmieniono.
Izolowane demo i pozostałe ekrany bez zmian. Żaden odebrany mechanizm nie został wyłączony.
Wykorzystano dotychczasowe adapter.save oraz adapter.saveNumber, bez nowego API/SQL/Storage.
Odczyt potwierdza zapis obu pól. Dwie operacje API nie stanowią jednej transakcji;
przy częściowym błędzie nie ma fałszywego sukcesu, wymagany ponowny odczyt profilu.
Pusty numer bez wcześniej ustawionego numeru pozostaje pusty; kasowanie istniejącego numeru
nie jest nową operacją — formularz wymaga wartości0–99. Duplikaty nadal dozwolone.
PASS: TypeScript, lint, frozen guard46+9 z dokładną allowlistą zatwierdzonej zmiany formularza;
8 ukierunkowanych Vitest oraz1 Cypress: zapis/anulowanie pól, walidacja100/0/99,
zapis imienia/nazwiska, numer po restarcie, upload/podmiana/delete, powrót z galerii i logout.
Nie uruchamiano pełnego Cypress ani pełnego Vitest. Build live, cap sync, Android debug,
JUnit istniejący1 z cache i weryfikacja APK PASS. APK zainstalowany aktualizacją -r na POCO,
start Status ok; zgodność sumy pliku na telefonie potwierdzona; crash/uncaughtJS/WebView errors=0.
SHA2563ad4d62c29c942d73a9f5e68347f0f1b96bd0f483405b8500dbde82c9af604d3.
B1/B2 pozostają podłączone do rzeczywistego Supabase; wcześniejszy odbiór fizyczny zachowany.
Nowego formularza nie oznaczamy jako ręcznie przetestowanego: zalecany krótki test POCO
Edytuj profil → zmień nazwę/numer → Anuluj → ponów i Zapisz dane → restart/karta.
Status: lokalny zakres B2.2 zakończony, ostatnia poprawka gotowa do krótkiego odbioru ręcznego.
Zdalnie pozostaje osobno zatwierdzony pakiet B2.2: SQL/RPC, accounts i konfiguracja prywatnego
Storage WebP/150KB, po sprawdzeniu faktycznego stanu zdalnego. Teraz go nie odczytywano/zmieniano.
Bez zdalnych migracji/Storage, push, merge, nowych etapów B3/B4 i dodatkowych zadań.

Poprzednie wpisy stanowią historię.

# Aktualizacja odbioru — PASS

2026-10-24 22:23:51 Europe/Warsaw — odbiór B2.2 na POCO
Właściciel po zainstalowaniu poprawki galerii potwierdził: „wszystko działa poprawnie”.
PASS ręczny: pozostanie w panelu po wyborze obrazu, podgląd, zatwierdzenie zdjęcia,
zachowanie po restarcie, podmiana i usunięcie zdjęcia. Numer0–99 potwierdzony wcześniej.
B2.2 funkcjonalnie odebrane lokalnie; kod899b631, feat/slm-v1-live.
Pole numeru pozostaje do osobnych zapowiedzianych instrukcji; brak dodatkowych zmian UI.
Bez zmian kodu, ponownego builda lub instalacji; nie powtarzano testów automatycznych.
B3/B4 nie rozpoczęte. Bez push/merge i wdrożeń zdalnych.
Poprzednie wpisy poniżej zachowują historyczny stan przed potwierdzeniem.

---

# B2.2 — implementacja lokalna i poprawka galerii

2026-10-24 22:20:25 Europe/Warsaw · feat/slm-v1-live · kod **899b631** (baza przygotowania75e8267).
Backend, Storage i SQL zastosowane **wyłącznie lokalnie** po zgodzie właściciela.
Status: numer odebrany na POCO; zdjęcie wymaga ponownego testu po poprawce galerii.
B2.2 nie jest jeszcze formalnie odebrane. Nie rozpoczęto B3/B4.

## Zakres i ponowne użycie kodu

- Własny numer0–99 jest zapisywany w istniejącym slm_player_profiles.jersey_number.
  Zapis i ponowny odczyt serwera, widoczny na własnej karcie, bez fikcyjnego fallbacku.
  Duplikaty dozwolone; ostrzeżenia grupowe pozostają TODO B3. Zapis kontaktu nie zeruje numeru.
- Istniejący picker i formularz numeru otrzymały port danych. Własny profil nie mutuje
  world.players ani identyfikatorów p01/p02. Pozostałe ekrany/dane nadal oznaczone demo.
- Zdjęcie wejściowe JPEG/PNG/WebP dekoduje urządzenie. Kompresja WebP: max800px,
  zachowanie proporcji, bez powiększania, zwykle jakość .80/.75; redukcja rozdzielczości,
  awaryjnie .70/.65. Cel do100KB, twarde150000B; małe obrazy nie są dopełniane do40KB.
  Oryginał tylko w RAM/objectURL, zwalniany po przygotowaniu; brak trwałego zapisu oryginału.
- Upload, podmiana, usuwanie i read-back przez istniejące accounts/SessionManager.
  Dodano zatwierdzony jeden przycisk „Usuń zdjęcie” w istniejących akcjach, bez nowego CSS.
  Presety fikcyjnych portretów zachowane w oryginalnym miejscu, wyłączone w trybie prawdziwego profilu.
- Ponownie użyto działającego lokalnie handlera accounts, profilePhotos, czytników JPEG
  i normalizacji telefonu z wcześniejszej integracji. Nie przenoszono starszego PhotoEditor/modalnego UI.
  app/local-backend/PROVENANCE.json zapisuje SHA256 źródeł aktualnie działającego lokalnego API.
  Nakładka zachowuje pozostałe już istniejące kontrakty; nie podłącza B3/B4 do klienta.

## Bezpieczeństwo i lokalny SQL

app/local-backend/B22_LOCAL_ONLY.sql jest celowo poza automatycznymi migracjami.
Zastosowano go do supabase_db_sunday-league-mates bez resetu. Nie ma nowych tabel,
UNIQUE numeru, publicznego bucketa ani nowych grantów klienta. Istniejące RLS zachowane.

- Prywatny slm-profile-photos: dozwolony nowy upload image/webp, limit150000B.
  Poprzednie własne JPEG pozostają do odczytu; nie było masowej konwersji ani kasowania.
- Backend sprawdza rzeczywiste RIFF/WebP: długość, granice i padding chunków, statyczną
  klatkę VP8/VP8L, wymiary max800, profil ICC z limitami; odrzuca animację, obce chunki,
  niezgodne nagłówki, nadmiar danych i przekroczenie rozmiaru. To walidacja strukturalna
  kontenera/klatki, nie pełny dekoder strumienia entropijnego VP8. Klient dodatkowo dekoduje obraz.
- UUID właściciela i session_id wyłącznie ze zweryfikowanej sesji; ścieżka UUID/losowyUUID.webp.
  Żądania numeru mają ścisłą allowlistę pól. Zdjęcia odrzucają przesłane user_id/path/object_path.
  service_role wyłącznie w lokalnym serwerze, nigdy w APK.
- Numer i commit zdjęcia mają RPC tylko service_role, kontrolę żywej sesji i blokady SQL;
  commit ma expected_revision/CAS i ograniczenia czasu blokowania/zapytania.
- Aktualne zdjęcie nie jest usuwane przed commit nowego. cleanup_path umożliwia ponowienie
  sprzątania starego obiektu. Po timeout/503 commit najpierw read-back, bez ślepego kasowania
  potencjalnie zatwierdzonego pliku. Pewne odrzucenie usuwa nowy kandydat.
- Awaria procesu może zostawić kandydata bez referencji: własny przegląd przy kolejnych
  zapisach sprząta tylko pliki starsze niż24h, max100 na wywołanie, z ochroną aktualnych
  referencji i świeżych plików. Brak gwarancji natychmiastowego cleanup po awarii procesu;
  bez następnej operacji właściciela taki plik może pozostać. Bez publicznego dostępu.
- Body uploadu ma osobną ograniczoną ścieżkę ?photo=upload (210000B); zwykłe akcje12000B.

Lokalne odtworzenie (bez poleceń zdalnych), z katalogu app/:
1. python scripts/prepare-b22-local.py — weryfikuje hash istniejącej lokalnej bazy źródeł
   w sąsiednim worktree premium318-live/.cache/http-edge i przygotowuje .cache/b22-edge.
   Nie jest samodzielnym bootstrapem pustego klona/bazy; wymaga wcześniej istniejącego lokalnego środowiska.
2. Zastosować B22_LOCAL_ONLY.sql wyłącznie lokalnym psql do wskazanego kontenera, ON_ERROR_STOP=1.
3. npx --yes --package=supabase@2.121.0 supabase functions serve --workdir ../.cache/b22-edge --env-file ../.cache/b22-edge/worker.env
4. adb -s c7a559b5 reverse tcp:54321 tcp:54321.
Nie kopiować tego lokalnego entrypointu do wdrożenia produkcyjnego. Zdalny rollout wymaga osobnej decyzji.

## Błąd zgłoszony podczas odbioru POCO

Pierwszy APK B2.2: numer działał, lecz wybór zdjęcia wracał do głównego ekranu i tracił plik — FAIL ręczny.
Przyczyna potwierdzona testem: przejście do systemowej galerii wywołuje suspend/resume;
B1 usuwa WorldApp w fazie checking i montuje go od nowa po weryfikacji sesji.

Poprawka ograniczona do trwającego wyboru pliku: formularz pozostaje zamontowany **ukryty**,
a dotychczasowy gate nadal weryfikuje sesję. Odsłonięcie dopiero po poprawnej odpowiedzi serwera.
Offline/cofnięcie sesji/inna tożsamość usuwa kontynuację. Wybór/anulowanie kończą kontynuację.
Zwykłe wznowienie bez pickera nadal zachowuje dotychczasowe B1; mignięcia nie maskowano.
Nie zmieniono SessionManager ani zabezpieczonego magazynu tokenów.

## Wyniki

PASS automatyczne:
- TypeScript, lint; **215 Vitest /38 plików**, w tym awarie Storage/commit/cleanup,
  niepewny503, GC, utrzymanie ukrytego pickera i usunięcie stanu po cofnięciu sesji.
- **38 kontroli prawdziwego lokalnego Auth/API/RLS/Storage**: 0/99, duplikaty, walidacja,
  upload, podmiana, CAS, delete, restart/refresh, brak/cofnięcie sesji, obcy użytkownik
  i odmowa bezpośrednich RPC/Storage. Dwa uruchomienia, łącznie4 nowe fikcyjne konta zachowane;
  nie kasowano istniejących kont, grup ani danych.
- **23 różne testy Cypress**: frozen9, live wizualne8, B1auth2, B2profile2, codec1, media1.
  Końcowy test media dodatkowo odtwarza hidden/visible podczas wyboru pliku i sprawdza zachowanie panelu.
  Początkowy test B1 wymagał dopisania nowych odczytów zdjęcia do ścisłej listy wywołań;
  nie osłabiono kontroli Auth. Techniczne kliknięcie ukrytego inputu w Cypress jest wymuszone,
  podobnie jak selectFile; rzeczywisty odbiór Androida pozostaje osobny.
- build, build:demo/izolacja16plików, build live, Capacitor sync, assembleDebug,
  testDebugUnitTest (1 istniejący test, wynik z cache), weryfikator identyfikatora/assetów APK.
- Guard frozen3.18:46 plików bez zmian +9 dokładnie dozwolonych technicznych/danych.
  Porównano96 zrzutów:95 identycznych pikselowo. Jedyny znany hero details320light
  ma12335 różniących się pikseli, delta max4/255 — historyczne odstępstwo A, bez poprawiania.
  Zrzuty i parity.json w docs/ui/slm-v1-b22, wyłącznie fikcyjne dane/syntetyczny obraz.

PASS fizyczne: aktualizacja ADB -r i start obu APK; numer potwierdzony przez właściciela.
FAIL wykryty i poprawiony w kodzie: utrata formularza po galerii w pierwszym APK.
NOT TESTED po poprawce: pełny upload/podmiana/usunięcie/restart i oba Wstecz na fizycznym POCO;
wysłano prośbę o ponowny test. Nie oznaczamy tego jako PASS na podstawie Cypress.
NOT TESTED i nieautoryzowane: zdalny Supabase/Storage/Edge — nic nie wdrażano zdalnie.

## APK

app/android/app/build/outputs/apk/debug/app-debug.apk, pl.psuda87.slm.
Kod899b631; APK zbudowany z tego samego drzewa tuż przed lokalnym commitem.
SHA256 **3e81b4fb279e93915c7c0235a9683acb1f89ab8ca61305d6089fc244ee21cd55**.
Drugi APK po poprawce galerii zainstalowano przez adb install -r i uruchomiono: Status ok/COLD.
Potwierdzono zgodność pełnej sumy drugiego APK na telefonie z plikiem builda. W zachowanych logach procesu:0 native crash,0 uncaught JS,0 błędów sieci WebView.
Przy końcowym odczycie proces był zamknięty przez Android PeriodicCleaner(pressure), reason13,
a nie zgłoszony crash. Nie przerywano ponownego ręcznego testu uruchamianiem aplikacji.
Kontynuacja pickera chroni zwykły suspend/resume; nie jest odtwarzaniem pliku po zabiciu całego procesu.
Nie zmieniano ustawień baterii/systemu ani nie dodawano trwałego zapisu oryginału.
Dane aplikacji zachowane, bez uninstall/clear. Lokalny backend54321 dostępny przez adb reverse.
Do pełnego testu POCO nie jest potrzebne wdrożenie zdalne; wymagane działający Docker i USB/reverse.

## Zmienione pliki UI i brak zmian wyglądu

src/demo/Profile.tsx — rzeczywista projekcja zdjęcia/numeru, istniejące formularze i akcje.
src/demo/Identity.tsx — port zapisu/kompresji, wybór pliku, zatwierdzony Usuń zdjęcie,
nieaktywne presety demo w live, komunikaty o rzeczywistym zapisie, techniczne zdarzenia pickera.
src/ui/UltimatePlayerCard.tsx — wyłącznie opcjonalny opis ALT zdjęcia zamiast tekstu „w pamięci demo”.
src/ui/personalProfile.ts — wyłącznie kontrakty typów, bez elementów wizualnych.
src/auth/B1App.tsx — niewizualna kontynuacja pickera pod istniejącym gate; bez zmiany layoutu kont.
Pozostałe: adapter/hook profilu i nowy useOwnPhoto, URL uploadu w api.ts, testy/narzędzia,
local-backend (SQL, ponownie użyte accounts/shared, walidator, mały syntetyczny fixture, proweniencja).
Dokładna lista: git show --stat 899b631. CSS, motywy, ikony, assety, projekt karty i nawigacja nietknięte.
Wyjątek wizualny: wyłącznie uzgodniony przycisk oraz rzeczywiste wartości/stan kontrolek i komunikatów;
nie deklarujemy identycznych pikseli karty z prawdziwym zdjęciem względem fikcyjnego portretu demo.

## Odbiór ręczny / następny krok

1. Profil → Zmień zdjęcie → wybór testowego obrazu: pozostaje panel z podglądem.
2. Zatwierdź zdjęcie → karta; zamknięcie/otwarcie → zdjęcie pozostaje.
3. Podmiana, potem Usuń zdjęcie → inicjały również po restarcie.
4. Anulowanie wyboru galerii i oba Wstecz; logout/relogin bez danych poprzedniego konta.
Numer0–99 działa na POCO; właściciel zapowiedział osobne instrukcje poprawy pola.
Nie zmieniamy tego pola przy okazji. Czekamy na odbiór B2.2. Bez B3/B4, push, merge i wdrożenia zdalnego.

---
## Historia: przygotowanie przed zgodą na backend

# SLM 1.0 — B2.2: przygotowanie i blokady

2026-10-24 · feat/slm-v1-live · baza 2d293c8; runtime nadal odebrane B2.1 (6dd7105).
**B2.2 NIE jest ukończone. Upload, usuwanie i zapis numeru NIE zostały aktywowane.**
Zastosowano końcową instrukcję zadania: gdy wymagane są zmiany backendu,
zakończyć bezpieczną część i zgłosić blokadę. Nie zastąpiono WebP starym uploadem JPEG.

## Audyt istniejącego rozwiązania

- slm_player_profiles.jersey_number istnieje, integer/null, CHECK 0–99, bez UNIQUE numeru.
  Obecne accounts/profile nie zwraca numeru; save_profile zapisuje full_name/display_as.
  Starszy save_email_profile podaje p_number:null, więc nie wolno użyć go jako zapisu numeru.
- Lokalny bucket slm-profile-photos: prywatny, limit 2097152 B, dozwolony tylko image/jpeg.
  storage.objects i slm_profile_photos mają aktywne RLS. Brak polityk bezpośredniego
  dostępu do objects. anon/authenticated nie mogą wywołać slm_profile_photo_commit.
- Istnieją metadane user_id/object_path/revision/cleanup_path/updated_at. Wcześniejsze
  profilePhotos.ts używa kontekstu sesji, UUID użytkownika w ścieżce, revision CAS,
  blokady SQL i retry sprzątania. Nie ma potrzeby tworzenia kolejnych tabel/bucketów.
- Aktualny handler akceptuje tylko JPEG, zapisuje .jpg; commit SQL dopuszcza wyłącznie .jpg.
  Wcześniejszy kompresor zapisuje JPEG1024px/.88, a nie wymagany WebP800px/150KB.
  Stary PhotoEditor ma inny modal/toolbar — nie przeniesiono jego UI do frozen3.18.
- Oryginalne formularze numeru i wyboru zdjęcia istnieją w demo. Picker ma wybór,
  podgląd, zatwierdzenie i anulowanie, ale nie ma usunięcia aktualnego zdjęcia.
  Przycisk Anuluj nie może zostać zamieniony w ukrytą operację destrukcyjną.

Audyt obejmował źródła wcześniejszej integracji i wyłącznie metadane istniejącego
lokalnego Dockera. Nie odczytywano prywatnych zdjęć ani rekordów kont.

## Bezpieczna część przygotowana

Nowe src/profile/preparePhoto.ts oraz imageDimensions.ts:
- ponowne wykorzystanie istniejących czytników nagłówków JPEG/PNG/WebP;
- faktyczne dekodowanie przez przeglądarkę, kompresja canvas do WebP;
- max800px, proporcje zachowane z zaokrągleniem do piksela, brak powiększania;
- jakość normalnie .80/.75, kolejne rozdzielczości max800/640/512/400;
  awaryjnie .70/.65 na ostatnim rozmiarze, potem jawny błąd zamiast dalszej degradacji;
- cel do100000B, twardy limit **150000B** (spełnia również limit150KiB).
  Złożone zdjęcie może pozostać między100–150KB dla zachowania jakości/rozdzielczości.
  Nie dopełniamy lekkich obrazów do40KB ani nie zwiększamy małych obrazów;
- sprawdzenie MIME i faktycznego nagłówka WebP oraz wymiarów wyniku;
  PNG fallback nieobsługiwanego encodera jest błędem, nie pozornym WebP;
- źródło tylko w pamięci/object URL, revocation w finally, canvas zwalniany,
  brak zapisu oryginału/localStorage i brak wywołań sieci;
- techniczny limit wejścia20MiB,8192px/32MP chroni dekodowanie dużych plików;
- parseJerseyNumber waliduje0–99, bez sprawdzania unikalności czy odpytywania grup.

**Moduł nie jest importowany przez entry aplikacji ani podłączony do UI/API.**
Jest gotowym przygotowaniem do integracji po uzgodnieniu backendu, nie funkcją uploadu.
Przyciski w odebranym B2.1 pozostają nieaktywne; nie pokazujemy fałszywego sukcesu.
Nie zmieniono CSS, układu, Ultimate, ikon, motywów, nawigacji i mignięcia B1.
Nie modyfikowano demonstracyjnych zawodników p01/p02 ani nie wiązano ich z Auth.

## Minimalny projekt do przeglądu — NIE zastosowany

- docs/proposals/B22_PROFILE_STORAGE_DRAFT.sql: konfiguracja istniejącego bucketu
  WebP/150000B, wąski service-only RPC zapisu numeru do istniejącej tabeli,
  zgodność ścieżki commit jpg|webp z zachowaniem CAS/session gate/cleanup.
  Brak nowych tabel i UNIQUE numeru. Projekt poza katalogiem migracji; nie uruchomiony
  ani niezaliczony jako przetestowana migracja.
- docs/proposals/B22_BACKEND_PLAN.md: skoordynowane zmiany istniejącego Edge,
  odczyt i zapis numeru, zachowanie numeru przy edycji kontaktu, rzeczywista walidacja
  kontenera WebP/800px/150KB, ograniczony body uploadu, stary JPEG tylko do odczytu,
  sesja/obcy UUID/stale revision, podmiana/usunięcie i sprzątanie po awarii.

Nie wolno zastosować samej konfiguracji bucketu: obecny handler JPEG stałby się niezgodny.
Obecny cleanup nie gwarantuje braku osieroconych plików po awarii procesu pomiędzy
Storage POST a commit. Przy timeout commit mógł się udać: przed usunięciem nowego
obiektu trzeba sprawdzić metadane. Projekt opisuje wymagane zabezpieczenia,
nie deklaruje ich wdrożenia lub zaliczenia.

**Decyzja UI wymagana zgodnie z pkt1 zadania:** proponowany jeden przycisk
„Usuń zdjęcie” w istniejącej sekcji akcji pickera, tylko przy własnym zapisanym zdjęciu.
Te same klasy, bez CSS/nowego modalu/ikon. To projekt wyjątku, nie zmiana UI.
Nie dodano go bez zgody. Pozostałe kontrolki numeru/wyboru mają być wykorzystane ponownie.

## Testy

PASS: TypeScript, lint, **204 Vitest w37plikach** (6 nowych testów przygotowania).
Testy obejmują0/99, wartości błędne i dozwolone duplikaty, proporcje/no-upscale,
normalną jakość, redukcję rozdzielczości, limit bajtów, błąd encodera i niewłaściwy format.
Cypress: prawdziwa kompresja proceduralnego testowego PNG w Chrome do poprawnie
ponownie dekodowanego WebP <=800px/150000B, zachowane4:3 — PASS.
Techniczna fixture HTML jest wyłącznie testem kodeka, nie ekranem aplikacji.
Regresja B1/B2.1 Cypress:12/12 PASS (Auth, profil,8 kombinacji szerokości/motywu).
Łącznie13/13 Cypress wraz z testem kodeka; testy kontraktu korzystają z kontrolowanych odpowiedzi.

PASS: standardowy build, build demo/izolacja16plików, lokalny live build,
cap sync Android, assembleDebug, JUnit1 (UP-TO-DATE), weryfikacja zasobów APK.
Guard UI:47 identycznych plików +8 wcześniej dozwolonych modułów B1/B2.1.
Nie rozszerzano allowlisty o jakiekolwiek nowe zmiany UI.

**NOT TESTED/nieaktywne:** trwały numer, upload/podmiana/usunięcie WebP przez API,
błędy Storage/commit/cleanup, uprawnienia nowego kontraktu i brak osieroconych plików,
odczyt zdjęcia/numeru po restarcie i na innym koncie. To wymaga uzgodnionego backendu.
Nie uznajemy testów kompresora za testy Supabase. Nie dodano service_role do klienta.
Nie tworzyliśmy nowych kont/grup/obiektów Storage i nie resetowaliśmy danych.

## Pliki i APK

Nowe: src/profile/imageDimensions.ts, preparePhoto.ts, preparePhoto.test.ts;
cypress/fixtures/photo-preparation.html, cypress/b22/preparation.cy.ts;
dwa projekty w docs/proposals. Dokumenty: ten raport, ODPOWIEDZI_CODEX, STATUS,
FRONTEND_HANDOFF (TODO B3: ostrzeżenie o powtórzonym numerze, bez blokady).
Żaden istniejący plik runtime/UI nie został zmodyfikowany.

Build Android wykonano, ale APK ma nadal hash odebranego B2.1:
`e422912c4d74b8524ebf5dbdb40ee31680c23c34adf440e8ecce8df703ff322f`.
Ścieżka: app/android/app/build/outputs/apk/debug/app-debug.apk
(w worktree I:\slm\sunday-league-mates\.worktrees\slm-v1-live).
Nie ponawiano instalacji identycznego APK na POCO. Nie ma nowego działającego APK B2.2.
UI/bundle urządzenia pozostaje identyczne, a znany hero A i mignięcie B1 nietknięte.

## Checklista POCO — dopiero po uzgodnionym wdrożeniu kontraktu

1. Ustaw0 i99, zapisz; po restarcie sprawdź kartę i formularz.100/-1/ułamki odrzucane.
2. Na drugim lokalnym koncie ustaw ten sam numer — ma być dozwolony.
3. Wybierz testowy JPEG/PNG/WebP; zobacz proporcje, potwierdź kompresję i zapis.
4. Zastąp i usuń zdjęcie; sprawdź restart, nieudaną sieć i ponowienie.
5. Wyloguj się/zaloguj na inne konto: bez poprzedniego zdjęcia/numeru.
6. Sprawdź B1/B2.1 i oba Wstecz; uczestnicy demo mają pozostać demonstracyjni.

Tej checklisty nie można dziś zaliczyć jako B2.2, ponieważ funkcje nie są aktywne.
Wymagana decyzja: lokalny, skoordynowany pakiet backendu oraz minimalny wyjątek
na przycisk usunięcia. Zdalne wdrożenie wymaga odrębnej wyraźnej zgody.
Nie rozpoczęto B3/B4. Bez push/merge i zmian Supabase/Edge/bucketów/RLS.

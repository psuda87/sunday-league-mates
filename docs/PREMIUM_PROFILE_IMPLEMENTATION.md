# Premium B2/B3 — publiczny pseudonim, nazwa globalna i prywatność

Aktualne wyniki Windows/Supabase/POCO znajdują się w końcowej sekcji „Odbiór techniczny”. Historyczne NOT TESTED/FAIL poniżej zachowano jako zapis poprzedniego środowiska.

2026-10-26 13:20:55 CET. Baza main `edd2e924cc077c67ba804ed4acab6d3e159a15b1`.
Gałąź `feat/premium-profile-name-privacy`. Początkowo czysty Git. PR14/15 i main
nietknięte; analizę PREMIUM_PROFILE_NAME.md odczytano przez refs/pull/15/head.
Nie scalano PR ani nie wdrażano. Supabase Cloud pozostał **nietknięty**.

## Zakres implementacji

Nowy edytor Premium obsługuje pseudonim oraz nickname/first_name/full_name,
podgląd draftu, walidację, anulowanie bez wywołań, Akceptuję/Anuluj i blokadę
równoczesnych zapisów. Używa istniejącego bindingu profilu, karty Ultimate i tokenów
Light/Dark; nie zastępuje prawdziwego profilu fixture. Techniczny login pozostaje
odrębnym polem. Zmiana publicznego pseudonimu nie wywołuje identifiers/Auth,
nie zmienia telefonu/e-mail/hasła/UUID/roli i nie odnawia sesji. Pseudonimy nie
muszą być unikalne. Dotychczasowe konta zachowują swoje pola i ustawienia.

Imię jest NOWYM jawnym polem first_name, domyślnie pustym. Nie zgadujemy go z
full_name i nie przenosimy do niego całego historycznego pola. Puste imię/nazwisko
w wybranym wariancie daje pseudonim. Nie przepisano istniejących nazwisk/aliasów.

## Nowa migracja i kontrakty

`app/supabase/migrations/20261026120000_premium_profile_name.sql` wymaga całego
main, w szczególności B2.2, B3 privacy i phone_receipt_privacy. Zastosowano ją
wyłącznie do nowej izolowanej bazy testowej Docker. Historyczne migracje bez zmian.

- CHECK display_as: nickname/first_name/full_name, jedno ustawienie konta.
- slm_profiles.first_name i slm_group_members.share_first_name, domyślnie ''/false.
  Nie zmieniają istniejących zgód share_full_name ani RLS. Zgoda na samo imię NIE
  dopuszcza surowego wiersza z nazwiskiem przez PostgREST/RLS.
- `save_premium_profile` w istniejącym accounts, RPC slm_premium_profile_save:
  nickname, first_name, full_name, display_as, jersey_number, group_scope,
  accept_disclosure, request_id. Wykonawca i sesja pochodzą z istniejącego context,
  nie z body. Jeden SQL transaction + istniejący advisory lock B3, idempotency key,
  walidacja i kontrola rzeczywistego zakresu członkostw. Bez zmian Auth/sekretów.
- Scope jest listą UUID WSZYSTKICH OBECNYCH NIEARCHIWALNYCH grup użytkownika.
  Potwierdzenie wyjaśnia ten zakres i liczbę grup. Zmiana członkostwa przed zapisem
  powoduje stale_scope, bez zapisu. Nowe członkostwa nie dziedziczą zgód.
- profile DTO dodaje nickname/first_name/group_scope; save_profile akceptuje także
  first_name, ale stary endpoint nie udziela żadnej nowej zgody. Nowy edytor
  korzysta wyłącznie z atomowego save_premium_profile i jawnego profile read-back.
- Serwerowa profile_display_name stosuje tryb globalny dopiero po kontroli relacji
  i odpowiedniej zgody. Group DTO ma display_name niezależnie od raw full_name.
  Lista i karta grupy, LIVE lista członków, szczegóły zapisu, etykiety osób w
  rozliczeniach i zgłoszeniach używają bezpiecznej projekcji. Publiczne wyszukiwanie
  kandydatów/etykiety bez zweryfikowanego kontekstu nadal zwracają pseudonim.
- Grupy consent otrzymuje confirm_nickname. Cofnięcie zgody przy trybie osobowym
  wymaga tego potwierdzenia i atomowo ustawia nickname + cofa zgodę w danej grupie.
  Powtórzony request_id nie wykonuje drugi raz zależnych zmian. Podstawowe reguły
  członkostwa, finansów i zgód pozostają w dotychczasowych dispatcherach.
- Dopasowania pg_get_functiondef zmieniają TYLKO wyrażenia etykiet z istniejącym
  viewer/group; wymagają oczekiwanego kontraktu i przerywają migrację przy rozjeździe
  upstream, zamiast cicho pomijać ochronę. Nie zmieniono obliczeń finansowych.

## Scenariusze A–G

| Scenariusz | Zachowanie |
|---|---|
| A | Nickname pozostaje nazwą mimo dostępnego full_name w szczegółach dla uprawnionych |
| B | Imię bez zgody: potwierdzenie → globalne first_name i share_first_name w aktualnym scope; nazwisko nadal ukryte |
| C | Full name bez zgody: potwierdzenie → globalne full_name i share_full_name w aktualnym scope |
| D | Samo włączenie istniejącego udostępniania nie zmienia display_as i nie wymaga potwierdzenia zmiany nazwy |
| E | Wyłączenie przy trybie osobowym: potwierdzenie → nickname globalnie, zgoda cofnięta tylko w tej grupie; inne zgody pozostają |
| F | First→full wymaga potwierdzenia, jeżeli w dowolnej obecnej grupie brakuje zgody na nazwisko; istniejące pełne zgody bez dodatkowego okna |
| G | Sam wybór nickname nie cofa żadnej zgody |

Przy first-only w grupie dostępna jest akcja „Ukryj udostępnione imię”; istniejący
suwak nadal dotyczy pełnych danych. Nie dodano ekranów konfiguracji per grupa ani
formatów nazwy per grupa. Wyjątek B3 właściciela i administratora do danych pełnych
zachowany i opisany w interfejsie — ukrycie przed członkami nie ukrywa przed adminem.
Outsider nie dostaje grupowego profilu. Nigdy nie przekazujemy nazwiska klientowi
wyłącznie po to, by dopiero klient je ukrył.

Zmiana wobec analizy PR15 jest świadoma: jej zalecenie „nie zmieniać zgód przy
wyborze formatu” zastępują ostateczne scenariusze B/C/E niniejszego zadania.
Nie włączamy zgód automatycznie przy samej zmianie suwaka/bez potwierdzenia.

## Weryfikacja — wykonane i niewykonane

| Test | Wynik |
|---|---|
| TypeScript | PASS |
| Pełny ESLint | PASS |
| Vitest | PASS 248/248,42 pliki; 7 nowych testów edytora, atomowy adapter/read-back i dotychczasowe Auth/sesje |
| Build aplikacji | PASS, pozostają ostrzeżenia wielkości chunków |
| SQL/RLS lokalny kontrakt | PASS 28 asercji: trzy tryby, legacy/e-mail, A–G, dwie grupy, cofnięcie, admin/outsider/raw RLS, scope, idempotency i brak zmiany sesji/loginu |
| Replay | PASS 35 kanonicznych migracji na świeżym PostgreSQL17 |
| Restart PostgreSQL | PASS pseudonim zachowany po restarcie kontenera |
| Build demo | FAIL: allowlista odrzuca src/native/frozenDemoAndroid.ts. Identyczny błąd odtworzony na czystym main edd2e92; nie obchodzono allowlisty |
| Pełne Supabase Auth + PostgREST + Edge HTTP | NOT TESTED — CLI2.121.0 EROFS przy tworzeniu /home/agent/.supabase; starszy installer CLI zakończył się błędem. Nie potwierdzamy pełnego E2E |
| Restart aplikacji/logowanie i powtórny odczyt przez rzeczywisty Auth | NOT TESTED; persistence sprawdzona na PostgreSQL, read-back adaptera testem kontrolowanego API |
| Fizyczny Android, klawiatura, dark/light, komunikaty Ionic na urządzeniu | NOT TESTED |
| Supabase Cloud | Brak odczytów/testów kont/migracji/deploy/Storage/Auth zmian |

SQL uruchomiono na **rzeczywistym PostgreSQL z fixture kontraktów auth/storage**,
nie na pełnej instalacji Supabase. Funkcje SQL/RLS/sesje domenowe są rzeczywiste;
auth.uid()/jwt() oraz auth.users/sessions w bootstrapie to kontrolowany testowy
kontrakt, nie walidacja kryptograficzna JWT ani prawdziwe logowanie. Nie wolno
nazywać tego testem pełnego Supabase ani gotowością produkcyjną.

Powtarzalna kontrola z app: `node scripts/test-premium-profile-sql-local.mjs`.
Tworzy TYLKO nowy kontener slm-profile-contract-<UUID>, --network none, bez portów,
replay +28 asercji + restart + porównanie nazwy; usuwa tylko swój kontener. Żadnego
resetu lub ponownego stosowania migracji do istniejącej bazy. Support bootstrap
jest przeznaczony WYŁĄCZNIE dla tej pustej bazy, nigdy dla prawdziwego Supabase.

## Ryzyka i odbiór lokalny przed merge

1. Na pełnym lokalnym Supabase sprawdzić kontrakt PostgREST własnego profilu
   (join aktywnych grup), routing nowego RPC, normalne logowanie i refresh obu
   rodzajów kont. Nie przenosić tej gałęzi do Cloud bez osobnego polecenia.
2. Zweryfikować HTTP próby obcego user_id, cofnięcie zgody przy otwartej karcie,
   restart aplikacji, opóźnione odpowiedzi i concurrent membership changes. Modele
   mają blokady/generation guards, ale E2E tutaj nie zastępuje SQL/fixture.
3. Na telefonie sprawdzić 320/390px, light/dark, selektor, preview, anulowanie obu
   okien, podwójny tap, brak sukcesu po błędzie sieci i zachowanie sesji. APK/config
   pl.psuda87.slm, Capacitor sync oraz Auth/tokenStore niezmienione.
4. Starsze klienty nie znają first_name/nowego potwierdzenia cofania zgody; serwer
   odmówi niepotwierdzonej mutacji zamiast zostawić ujawniającą nazwę. Aktualizować
   aplikację i backend lokalnie razem. PUBLIC candidate search celowo bez nazwisk.
5. Full-name history nie jest dzielona. Użytkownik wypełnia jawne imię przed jego
   wyświetlaniem; brak wartości daje pseudonim. Nie dopisano nazwisk automatycznie.

## Zmienione pliki

- `app/scripts/test-premium-profile-sql-local.mjs`
- `app/src/auth/api.ts`
- `app/src/auth/profileAdapter.test.tsx`
- `app/src/auth/profileAdapter.ts`
- `app/src/auth/uiAdapter.ts`
- `app/src/auth/useOwnProfile.ts`
- `app/src/demo/GroupScreens.tsx`
- `app/src/demo/Identity.tsx`
- `app/src/groups/GroupControls.tsx`
- `app/src/groups/PremiumGroups.tsx`
- `app/src/groups/model.ts`
- `app/src/groups/useGroups.ts`
- `app/src/live/Groups.tsx`
- `app/src/profile/PremiumIdentityEditor.test.tsx`
- `app/src/profile/PremiumIdentityEditor.tsx`
- `app/src/theme/variables.css`
- `app/src/ui/personalProfile.ts`
- `app/supabase/functions/accounts/handler.ts`
- `app/supabase/migrations/20261026120000_premium_profile_name.sql`
- `app/supabase/tests/premium_profile_name.sql`
- `app/supabase/tests/support/profile_contract_bootstrap.sql`
- `app/vite.demo.config.ts`
- `docs/ODPOWIEDZI_CODEX.txt`
- `docs/PREMIUM_PROFILE_IMPLEMENTATION.md`
- `docs/STATUS.md`

Commit i stan Draft PR zostaną dopisane po zapisie Git. Implementacja do przeglądu,
nie potwierdzenie pełnej integracji/produkcji. Bez merge i bez zmian PR14/15.

## Zapis Git i blokada Draft PR — 2026-10-26 13:23:43 CET

Commit implementacji: `1f9d460d388c0256fc51a3abbfe0fa5cff09caa6`. Zwykły push nowej gałęzi do origin wykonany.
Próba utworzenia Draft PR przez GitHub REST API POST /pulls zwróciła Forbidden
(403); wcześniejszy odczyt GraphQL również Forbidden. Git proxy umożliwia push,
ale nie daje tutaj dostępu do GitHub API. **Draft PR nie został utworzony.**
Nie próbowano wydobywać tokenów ani obchodzić uprawnień. PR14/15 bez zmian.

Formularz utworzenia do main:
https://github.com/psuda87/sunday-league-mates/compare/main...feat/premium-profile-name-privacy?expand=1
Wybrać Draft, tytuł: feat(profile): independent nickname and private global display names.
Opis: implementacja pseudonimu i trzech trybów globalnych, atomowe zgody w aktualnym
scope B3, PASS248 Vitest/TS/lint/build aplikacji/28 SQL RLS/35 replay/persistence,
NOT TESTED pełny Supabase HTTP/Auth/Edge i fizyczny telefon. Demo build FAIL jak
czysty main (frozenDemoAndroid/allowlista). Pełna treść i ryzyka w tym dokumencie.

Końcowy SHA commita raportu będzie w odpowiedzi oraz historii gałęzi. Bez merge,
Cloud, zdalnych migracji/deploy, konfiguracji APK, Auth/sekretów. Wymagany dalszy
odbiór lokalny; nie deklarujemy gotowości produkcyjnej ani pełnego E2E.


## Odbiór techniczny Windows / prawdziwy Supabase / POCO — 2026-10-26 18:33 Europe/Warsaw

Baza przeglądu76da23abdb594ae40e3242d4809d74f5098472de, istniejąca feat/premium-profile-name-privacy / [Draft PR #16](https://github.com/psuda87/sunday-league-mates/pull/16). Poniższe wyniki zastępują historyczne NOT TESTED/FAIL dla obecnego środowiska; stare raporty zachowane. PR14/15 i ich gałęzie nietknięte, main bez merge. Brak odczytów lub zmian Supabase Cloud.

### Środowisko i ochrona danych

Utworzono osobny worktree .worktrees/profile-name-privacy-review, zachowując niezacommitowane STATUS/ODPOWIEDZI w main i B3. Docker Desktop uruchomiono bez resetu. Istniejący supabase_db_sunday-league-mates pozostał34 migracje /64 konta /33 grupy /13 meczów, jak przed testami. Niczego do niego nie stosowano i nie kopiowano jego danych.

Pełny testowy projekt **slm-pr16-review**: API127.0.0.1:56321, PostgreSQL56322, prawdziwe GoTrue/PostgREST/Kong/Storage/Edge,35 kanonicznych migracji. Wyłączono niepotrzebne Studio/analytics/Realtime/mailpit/imgproxy/pooler, nie usługi wymagane do Auth/RPC. Wyłącznie świeże fikcyjne konta i grupy; dane testowe pozostawiono do odbioru. To nie jest nowy projekt Cloud ani płatna usługa.

Auth testowy odpowiada ograniczeniom dotychczasowego SLM: public signup wyłączony, email login włączony, autoconfirm wyłączone, hooki blokujące mail/SMS, wymaganie current_password=true, nonce=false. CLI nie odtworzył domyślnie dwóch wymaganych flag, więc odtworzono **tylko nowy testowy kontener Auth**, zachowując jego CLI labels/healthcheck i DB; stare kopie tego testowego kontenera pozostały zatrzymane. Istniejący Auth sunday-league-mates bez zmian. Skrypt przygotowania i HTTP sprawdzają nazwę/branch/lokalny socket/port, brak fallback do Cloud. Błędy przygotowania środowiska (brak metadanych kontenera/provider disabled) nie były oznaczane jako PASS aplikacji. CLI start wypisał lokalne klucze testowe; roboczy log zredagowano, sekretów nie commitowano i nie umieszczono w raporcie.

### Znalezione i poprawione regresje

1. **HTTP consent_required:** niepotwierdzone cofnięcie zgody trafiało w ogólny503/service_unavailable i przełączało SessionManager w unavailable. Handler mapuje teraz ten konflikt na409/consent_required, pozostawiając działającą sesję; test regresyjny handlera + rzeczywisty scenariusz E potwierdza możliwość odczytu i ponowienia. Bez zmiany Auth, RLS czy zasad zgody.
2. **Okno Ionic:** szybki ponowny zapis przed ionAlertDidDismiss mógł zostać skasowany przez późne zakończenie poprzedniego okna. Krótka blokada logiczna do zakończenia dismiss (bez sztucznego timeoutu) i regresja. Cypress czeka na rzeczywiste zdarzenie Ionic, nie uznaje ukrytego elementu overlay za aktywne okno.
3. **Ukryj udostępnione imię:** nowa akcja dziedziczyła48px geometrię switcha. Styl toru ograniczono do role=switch, akcja ma własny standardowy przycisk min44px i type=button. Obejrzano syntetyczne zrzuty Light/Dark; brak przebudowy karty/nav.
4. **Izolacja demo na Windows:** fileURLToPath zwracał backslash, a Vite slash, więc warunek startsWith omijał allowlistę. Dodano czysty normalizator ścieżek z4 regresjami Windows/Linux. Po przeglądzie dopuszczono dokładnie frozenDemoAndroid.ts (prezentacyjny transport Back/keyboard, bez Auth/API), którego brak powodował zgłoszony historyczny FAIL w środowisku Linux. Nie wyłączono guardu ani nie dopuszczono całego katalogu native; test odrzuca inne moduły native i produkcyjne Auth. Demo build i statyczna kontrola bez Auth/Supabase/Edge PASS.
5. Narzędzia odbioru/build: guard gałęzi dopuszcza PR16, kontrola schematu oczekuje35 wersji. Manifest55 aktualizuje wyłącznie3 pliki już zmienione przez PR16 (Identity/GroupScreens/variables.css), z jawnym wyjątkiem funkcjonalnym. Oryginalny Ultimate/BottomNav i mechanizm tokenStore/sessionManager pozostają bez zmian.

### Faktycznie wykonane testy

| Kontrola | Wynik |
|---|---|
| Prawdziwy pełny lokalny Supabase |35 migracji zastosowanych do nowej instancji; bez bootstrapu auth/storage z fixture |
| Real Auth → Edge → PostgREST/RPC | **33 PASS**: legacy i e-mail, zmiana hasła tymczasowego, login telefonem po zmianie pseudonimu, save/read-back, refresh obu kont, nowy kontroler sesji z refresh tokenu |
| Prywatność real HTTP | A/D nickname mimo zgody, B first-only po potwierdzeniu w2 grupach, C/F full-name po dodatkowej zgodzie, E odmowa bez potwierdzenia i atomowy fallback, G zachowanie zgód; retry/duplikat/stale_scope, nowe grupy bez dziedziczenia, brak zmiany cudzego profilu przez body |
| RLS prawdziwych JWT przez REST | owner/admin dostęp; first-only member/outsider brak raw surname; klient authenticated nie wykonuje uprzywilejowanego RPC |
| Inne DTO | roster/match uczestnicy/finanse bez nazwiska w niedozwolonym zakresie, publiczny outsider dostaje tylko pseudonim; B3 admin exception zachowany |
| Browser → prawdziwy backend | **1 PASS**, bez mockowania odpowiedzi. Przekierowano tylko lokalny URL54321 na izolowany56321 w cy.intercept; normalna aplikacja i cały backend rzeczywiste. Zapis, anulowanie0 mutacji, podwójny tap1 zapis, reload, dwie grupy, cofnięcie i odczyt profilu |
| Rozmiar/motywy w przeglądarce | prywatność grupy320/360/390/430px ×Light/Dark, akcja min44px; syntetyczne zrzuty docs/ui/pr16 |
| TypeScript / ESLint | PASS |
| Vitest | **254 PASS /43 pliki**, w tym regresje409, Ionic i polityki demo |
| Osobny SQL contract harness | **28 PASS**, replay35 i persistence po restarcie PostgreSQL; auth/storage tego harnessu są fixture, NIE drugi test pełnego Auth |
| Build main / Premium / demo + isolation | PASS; znane ostrzeżenia wielkości chunków |
| Source guards / cap sync / Android assembleDebug | PASS32 historyczne pliki/35 wersji/55 Premium; BUILD SUCCESSFUL |
| Android unit |1 istniejący test szablonowy PASS; nie dowód testu Keystore |
| POCO instalacja i start | PASS po osobnej zgodzie właściciela; odbiór funkcjonalny ręczny nadal oczekuje |

Kod serwowanego handlera porównano z kanonicznym źródłem PR16. Nie wykonano płatnych SMS/e-mail, signup, migracji Cloud, zmian starej lokalnej bazy, resetu ani merge. Testy generowały tylko fikcyjne dane w izolowanym projekcie. Niewykonane: pełny ręczny zestaw A–G na fizycznym telefonie, iOS/FCM/Cloud, rzeczywiste upłynięcie godziny JWT. Nie utożsamiać cy.reload/real refresh z ręcznym restartem Androida.

### APK / ADB / wycofanie

APK: `.cache/consolidation/premium-debug.apk` w tym worktree (pełna ścieżka I:\slm\sunday-league-mates\.worktrees\profile-name-privacy-review\.cache\consolidation\premium-debug.apk).
SHA256: **6cf904cef7ad7e0ca087932c22eea3b7e4975e2d43402b69d4228a5d6d608cd2**. pl.psuda87.slm, Sunday League Mates, świeże zasoby dokładnie zgodne z dist-b1, lokalny endpoint54321, brak markerów service key/Cloud, brak logowania mostu. Przed instalacją pobrano poprzedni base.apk do `.cache/pr16-stack/previous-installed.apk`, certyfikaty podpisu zgodne.
Właściciel osobno zatwierdził zastąpienie kodu i przełączenie backendu, z informacją o potrzebie nowego logowania. `adb install -r` Success, bez uninstall/clear; `am start -W` Status ok, c7a559b5 device. Reverse **telefon54321 → komputer56321**. Sprawdzony log startu:0 FATAL EXCEPTION,0 wskazanych błędów połączenia/renderera WebView. Nowa izolowana baza nie zna starej sesji; dane logowania fikcyjnego Zawodnika/Obserwatora przekazano wyłącznie plikiem TEMP poza Git i raportem.

Test działa dopóki lokalny Docker/Edge/USB/reverse są dostępne. W razie wycofania: force-stop aplikacji, przywrócić zgodnie podpisany previous-installed.apk przez install-r oraz reverse54321→54321 do starego backendu (po decyzji właściciela). Nie usuwać danych aplikacji ani baz; konieczność ponownego logowania jest możliwa. Stary lokalny backend nadal istnieje w oryginalnym stanie.

### Krótka checklista POCO i format odpowiedzi

1. Zaloguj Zawodnika z prywatnego pliku TEMP. Profil → Edytuj profil: zmień pseudonim; techniczny login/telefon i numer27 mają pozostać bez niezamierzonej zmiany.
2. Wybierz Imię i Zapisz. Anuluj = bez zapisu ani udzielenia zgód. Ponów i Akceptuję = zapisana nazwa i jawne zgody dla obu obecnych grup.
3. Imię→Imię i nazwisko: sprawdź osobne potwierdzenie nazwiska. Samo włączenie suwaka zgody w grupie nie zmienia globalnej nazwy; sam wybór Pseudonim nie cofa zgód.
4. W POCO PR16 A cofnij zgodę/ukryj imię: Anuluj nic nie zmienia, Akceptuję wyłącza tylko tę zgodę i wraca globalnie do pseudonimu. B zachowuje własne zgody. Przy ponownym wyborze danych osobowych potwierdzenie musi opisywać wszystkie obecne grupy.
5. Obserwatorem porównaj widoczność Zawodnika w A/B; outsider/admin sprawdzono automatycznie realnymi JWT, nie zgaduj prywatności z własnej karty.
6. Zamknij i otwórz aplikację, sprawdź zapis, oba Wstecz i Light/Dark. Brak sieci nie może pokazać niepotwierdzonego sukcesu.

Wklej tylko:
```
Logowanie: PASS/FAIL
Pseudonim: PASS/FAIL
Imię: PASS/FAIL
Imię i nazwisko: PASS/FAIL
Anulowanie: PASS/FAIL
Cofnięcie → pseudonim: PASS/FAIL
Dwie grupy/obserwator: PASS/FAIL
Restart/sesja: PASS/FAIL
Light/Dark/Wstecz: PASS/FAIL
Przy FAIL: konto-rola, grupa A/B, kroki, oczekiwany/rzeczywisty wynik i komunikat.
```
Bez haseł, tokenów, prywatnych zdjęć i rzeczywistych danych osób.

### Powtórzenie lokalnych kontroli

Z katalogu repo: `python app/scripts/prepare-pr16-local.py`. Następnie start **wyłącznie** tego projektu: `npx --yes --package=supabase@2.121.0 supabase start --workdir .cache/pr16-stack --exclude studio,imgproxy,logflare,vector,realtime,mailpit,postgres-meta,supavisor` (wynik z kluczami przechowuj prywatnie/nie wklejaj). Potem `python app/scripts/prepare-pr16-local.py --auth-baseline` i `supabase functions serve accounts --workdir .cache/pr16-stack`. Bez resetu/db push/link. Auth helper odtwarza tylko swój kontener, jeśli potrzebne; zatrzymany poprzednik zachowuje jako kopię.
Z app: `node scripts/test-premium-profile-http-local.mjs` (tylko56321); `SLM_PR16_BROWSER=1` dołącza Cypress przy gotowym Premium preview na5174. Browser runner przekazuje hasło przez stdin, bez video/zrzutów logowania, błędy sanowane. `node scripts/test-premium-profile-sql-local.mjs` jest osobnym testem fixture SQL. `node scripts/create-pr16-phone-fixtures-local.mjs` tworzy tylko nowe fikcyjne dane oraz nowy plik TEMP, nie resetuje wcześniejszych.

**Stan przed merge:** techniczny backend/SQL/UI/build i start Androida zaliczone; wymagany odbiór ręczny właściciela. PR #16 pozostaje draft, bez automatycznego merge. Historyczny problem demo został odtworzony jako różnica platform/guardu i naprawiony z regresją. Nie ma podstaw do deklaracji gotowości Cloud ani pełnego odbioru telefonu przed odpowiedzią właściciela.


Końcowy zapis techniczny: commit `ed71f29` wypchnięty do istniejącego [PR #16](https://github.com/psuda87/sunday-league-mates/pull/16), draft, bez konfliktów i bez merge. SHA zainstalowanego base.apk na telefonie potwierdzony jako6cf904ce…d608cd2. Ręczny odbiór nadal oczekuje; raport docs/ODPOWIEDZI_CODEX.txt.


### Ogólny wynik ręczny właściciela — 2026-10-26 18:37 Europe/Warsaw

Po teście POCO właściciel zgłosił: „generalnie wygląda na to, że wszystko działa”. Wynik ogólnej próby ręcznej pozytywny, bez zgłoszonej usterki. Nie przekazano rozpiski poszczególnych scenariuszy, dlatego nie oznaczono całej macierzy A–G/2 konta/restart/motywy jako indywidualnie potwierdzonej ręcznie. Wcześniejsze szczegółowe testy automatyczne pozostają udokumentowane powyżej. To aktualizacja historycznego statusu „odbiór oczekuje”, bez zmiany APK6cf904ce i bez merge PR #16.


### PR16 — odstępy etykiet formularza — 2026-10-26 18:47 Europe/Warsaw

Przyczyna: PremiumIdentityEditor zagnieżdża input/select wewnątrz label, natomiast odziedziczony display:block nie zapewniał odstępu między tekstem i polem. W prawdziwym Chrome pomiar przed poprawką: 0 px i 6/6 niezaliczonych konfiguracji. Minimalna poprawka w app/src/theme/variables.css: wyłącznie .slm-premium-identity > label jako pionowy flex z gap:7px oraz ograniczenie szerokości/box-sizing pól. Bez zmian komponentów, logiki zapisu, Auth, Supabase, migracji i uprawnień; kolory, obramowania i karta Ultimate bez zmian. Manifest zamrożonego UI aktualizuje tylko hash CSS i jawny wyjątek tej naprawy.

PASS: TypeScript, ESLint, 8 testów PremiumIdentityEditor, source contract 55 plików, build main i Premium. Chrome/Cypress 6/6: 320/360/390 px × Light/Dark, każda konfiguracja przy wysokości 844 i 380 px; odstęp >=6 px dla pseudonimu, imienia, pełnej nazwy, numeru oraz selektora, brak przepełnienia poziomego i fokus/przewijanie ponad footerem. Test używa oryginalnego formularza i CSS z fikcyjnym bindingiem bez sieci, nie jest E2E backendu. Build ma ostrzeżenie o dużych chunkach; bez błędu kompilacji.

Zrzuty z przeglądarki: docs/ui/pr16/profile-labels-light.png oraz profile-labels-dark.png. Zmniejszony viewport symuluje zmianę dostępnej wysokości, nie testuje fizycznej klawiatury Androida. NOT TESTED: nowa poprawka na POCO/realnym IME. Nie przebudowano ani nie zainstalowano APK w tym zadaniu. Do odbioru po osobnej aktualizacji APK: Edytuj profil, fokus i przewinięcie każdego pola przy klawiaturze, oba motywy. Nie powtarzano wcześniejszego odbioru backendu, nie przypisano mu nowego PASS. Commit/push do istniejącego PR #16, bez merge i wdrożeń.


### Aktualizacja POCO po poprawce etykiet — 2026-10-26 18:50 Europe/Warsaw
Kod źródłowy feat/premium-profile-name-privacy / 69f3aa69da8064e9f46e26026a9e7e5fb7096ebb. Właściciel zlecił aktualizację APK. build-consolidation-android.ps1 -Variant premium: świeży Premium build, cap sync, assembleDebug oraz natywny test zadania Gradle (UP-TO-DATE) PASS; kontrola pakietu pl.psuda87.slm, dokładnych zasobów i lokalnego endpointu PASS. APK .cache/consolidation/premium-debug.apk, SHA256155cf3d054ef303f3f6dcc81dc57e6f633a6c3c710ecce4f341abe302603f5c9. Podpis identyczny z poprzednim APK; kopia premium-before-labels-6cf904ce.apk zgodna z poprzednią instalacją na telefonie.
ADB c7a559b5: install -r Success, bez uninstall/clear; firstInstallTime pozostał2026-10-23 21:38:01, lastUpdateTime2026-10-26 18:49:56. Hash faktycznie zainstalowanego base.apk zgodny z nowym artefaktem. Uruchomienie Status:ok, aplikacja na pierwszym planie,0 znalezionych crash markers i0 net::ERR_/błędów JS. Jeden wpis Chromium „Seed missing signature” dotyczy systemowych WebView variations; nie był błędem ładowania aplikacji. Nie deklarujemy całkowicie czystego logu. Backend testowy health HTTP200, tunel telefonu54321→56321 zachowany; Cloud/bazy bez zmian.
Ręczny wygląd/fizyczna klawiatura tej wersji nadal do odbioru przez właściciela: Profil → Edytuj profil, sprawdzić odstęp nad polami pseudonim/imię/pełna nazwa/numer, fokus i przewijanie przy klawiaturze, Light/Dark. Nie wykonywano ręcznej edycji danych ani nie potwierdzano sesji za użytkownika. PR #16 bez merge. Raport docs/ODPOWIEDZI_CODEX.txt.

# Stage 2B — niezależny audyt i przygotowanie odbioru POCO

Data: **2026-10-29, Europe/Warsaw**. Werdykt: **PASS WITH WARNINGS** dla kodu i wykonanej integracji lokalnej. **Odbiór fizycznego POCO: BLOCKED** do przygotowania zgodnego backendu i osobnej zgody właściciela.

Audytowany kod: [`58a9babf257876e47cf6db269a0bf05d2e1db1f4`](https://github.com/psuda87/sunday-league-mates/commit/58a9babf257876e47cf6db269a0bf05d2e1db1f4), [Draft PR #27](https://github.com/psuda87/sunday-league-mates/pull/27), `feat/premium-lineups-stage2b`. GitHub i `refs/pull/27/head` potwierdziły ten sam head; baza PR: `feat/premium-lineups-stage2a`, `3b00ec268a19f64516daebbf0b238d796e826cd1`. PR podczas kontroli: open/draft, nie scalony.

Audyt wykonano na `audit/premium-lineups-stage2b`, utworzonej z dokładnego wskazanego SHA, w `I:\slm\sunday-league-mates\.worktrees\premium-lineups-stage2b-audit`. Zmiany audytu obejmują wyłącznie dokumentację. Nie zmieniono kodu, migracji, przypięć, manifestów, CI ani konfiguracji. Oryginalne worktree `feat/ui-beta` z niezapisanymi zmianami pozostało nietknięte.

Przeczytano rzeczywiste źródła, `AGENTS.md`, `PREMIUM_LINEUPS_STAGE2B.md`, `PREMIUM_LINEUPS_STAGE2A.md`, `PREMIUM_LINEUP_EDITOR_STAGE1.md`, diff PR i testy. Raporty poprzedniej implementacji posłużyły do ustalenia zakresu, nie jako dowód zaliczenia.

## 1. Problemy i ograniczenia

### P3 — odczyt składu mimo nieotwartej zakładki

`app/src/events/PremiumTeams.tsx:17` inicjalizuje `active=true`. Dopiero efekt w liniach 22–27 odczytuje `hidden` rodzica. `app/src/ui/MatchTabs.tsx:8,17–19` domyślnie wybiera Uczestników, ale montuje wszystkie panele. Efekt `app/src/events/usePremiumLineup.ts:113–117` uruchamia więc początkowe `matches_detail` + `lineups_get` (linia 70) także dla ukrytych Składów.

Niezależna próba Vitest z prawdziwymi `MatchTabs`/`PremiumTeams` i kontrolowanym transportem potwierdziła jeden `lineups_get`, gdy nadal aktywna była zakładka Uczestnicy, a panel Składy miał `hidden`. Nie ma automatycznego `lineups_save`, obejścia autoryzacji ani ujawnienia danych outsiderowi. Skutek: zbędny ruch i wcześniejsze wykorzystanie limitu 60 operacji/minutę/użytkownika (`accounts/handler.ts:263`). Nie blokuje dalszego review PR.

Minimalna propozycja późniejszej poprawki: początkowe `active=false`; efekt jawnie ustawia `true` dla użycia bez tabpanelu, a dla tabpanelu ustala widoczność przed dopuszczeniem pierwszego odczytu. Zachować test ukrytej zakładki i test samodzielnego komponentu. **Nie wdrożono**; zmiana chronionego pliku wymaga osobnej decyzji i ponownego review przypięcia.

### Blokada środowiskowa — APK i istniejący backend telefonu są niezgodne

`app/vite.android-stage3.config.ts:2–6` dziedziczy endpoint z `app/vite.premium-finance-local.config.ts:3`: **`http://127.0.0.1:64321/functions/v1/accounts`**. Potwierdzono ten adres także w JS i CSP istniejącego APK. Na komputerze 64321 prowadzi do projektu `slm-premium-real-finance`, który nie ma migracji składów ani obsługi `lineups_get/save`; jego Edge jest zatrzymany. Szczegóły metadanych baz w sekcji 5.

To blokuje odbiór telefonu w zastanej konfiguracji, nie jest regresją wprowadzoną w diffie Stage 2B. Samo zainstalowanie APK nie naprawi backendu. Nie należy dodawać ostatniej migracji do niezgodnego stosu zawierającego eksperymentalne Auth18. W audycie nie migrowano ani nie uruchamiano tego projektu.

### Granice gwarancji

Nie wykryto krytycznego błędu kodu w sprawdzonym zakresie. Nie ma Realtime: zdalne odejście uczestnika lub cofnięcie członkostwa jest rozpoznawane przy następnym sprawdzeniu API/rosteru; UI nie otrzymuje natychmiastowego push. Po rozpoznaniu zmiany stare UUID są usuwane z widoku, a zapis blokowany. Serwer sprawdza dostęp i roster przy każdej operacji, więc nie przyjmuje starego podziału.

Odziedziczony `pg_advisory_xact_lock(20261014,1)` (`20261029140000_match_lineups.sql:46`) serializuje również odczyty i operacje różnych grup. Zapewnia przyjęty porządek blokad; jest ograniczeniem przepustowości, nie dowodem wycieku. Nie wykonywano testu obciążeniowego. Fizyczny WebView, Kong i pełny Storage nie są objęte zaliczonym E2E opisanym poniżej.

## 2. Bezpieczeństwo, zapis i konflikty — wynik przeglądu źródeł

Wszystkie ścieżki w tabeli są względem repozytorium; numery linii odnoszą się do audytowanego SHA.

| Obszar | Sprawdzone zachowanie i dowód w kodzie |
|---|---|
| `lineups_get/save` | `app/supabase/functions/accounts/handler.ts:262–288`: zamknięta lista pól, aktor i session ID wyłącznie z uwierzytelnionego kontekstu, RPC usługowe, kontrolowane kody HTTP. Klient nie podaje autora/roli/grupy. Brak surowej diagnostyki SQL w odpowiedzi. |
| Uprawnienia i grupy prywatne | `app/supabase/migrations/20261029140000_match_lineups.sql:47–60`: ważna sesja, aktualne członkostwo w grupie konkretnego meczu i grupa niearchiwalna, również przed replay. RLS tabeli i odebranie EXECUTE anon/authenticated w liniach 3–15,96–97. Zwykły aktywny członek może zapisać; twórca, organizer lub globalny admin nie zastępują członkostwa. Dostęp publiczny lub zachowany własny udział po odejściu nie daje dostępu do składów. |
| Wersja składu i rosteru | SQL:82–84 porównuje expected_version i token rosteru; token obejmuje wersję wydarzenia oraz aktualne registered UUID (28–38). UI `lineupContracts.ts:27–51` sprawdza tożsamość meczu/grupy, pełny dostęp i zgodność dwóch odczytów. `usePremiumLineup.ts:67–73` dopuszcza jeden ponowny odczyt niespójnej pary. Brak automatycznego zapisu na nowej wersji. |
| Równoczesny zapis | SQL:46–58,82–93: wspólny porządek blokad, CAS i wiersz składu oraz rejestr żądania w jednej transakcji. Dwa różne zapisy na tę samą wersję: jeden commit, drugi 409. `usePremiumLineup.ts:139–166` ma synchroniczną blokadę lotu żądania, nie tylko stan przycisku. Konflikt zachowuje szkic i wymaga decyzji o odświeżeniu. |
| Idempotencja | SQL:61–78 kanonizuje UUID A/B, sprawdza duplikaty, wiąże request_id z aktorem, akcją i całym zamiarem; inna treść z tym samym ID daje konflikt. Replay potwierdzonej operacji następuje po kontroli dostępu, przed ograniczeniami nowego zapisu, więc działa po późniejszej zmianie rosteru/pojemności lub zamknięciu. Projekcja autora replay jest liczona według bieżących zgód, nie przechowuje ujawnionego nazwiska. |
| Sieć, retry i prawdziwy sukces | `usePremiumLineup.ts:142–156,162–163`: niepewna odpowiedź zachowuje identyczny UUID i payload; po potwierdzonym POST/awarii readback retry wykonuje sam GET. Walidowane są receipt i flagi changed/replayed. Komunikat sukcesu dopiero po świeżym, spójnym GET. Sam historyczny receipt nie zastępuje najnowszego składu. |
| Szkic i zmiana konta | `usePremiumLineup.ts:21–33,45–66,91–124`: RAM per SessionManager/użytkownik/grupa/mecz, ponowna weryfikacja sesji przed pokazaniem, generacja odpowiedzi i kontrola aktora. Logout/storage_error czyści także odmontowany edytor, inne konto nie otrzymuje starego draftu/request_id. Odmowa dostępu usuwa zakres. Brak nowego localStorage/Preferences lub utrwalania szkicu offline. |
| Goście i stare wpisy | ID uczestnictwa, nie ID konta; ten sam kontrakt dla gościa. SQL:84 wymaga registered we właściwym meczu, odrzuca rezerwę/wycofanych/obce i powtórzone UUID. `lineupContracts.ts:45–50`, `usePremiumLineup.ts:77–84,118–124`, `PremiumTeams.tsx:29–36` odfiltrowują stale, zachowują nowych poza podziałem i blokują zapis po zmianie rosteru. Gość bez konta nie dostaje fikcyjnego profilu. |
| Autor i no-op | SQL:85–91 aktualizuje wersję, autora i czas wyłącznie przy zmianie kanonicznego A/B. GET, semantycznie identyczny zapis, zamiana i cofnięcie nie tworzą nowego autora. UI pokazuje wyłącznie bezpieczne last_change, nie lokalnego użytkownika jako rzekomego autora. Wersja 0 ma pusty baseline serwera i jawną niezapisaną propozycję Stage 1. |
| Profile i prywatność | Niezmieniony `LineupPlayerProfile.tsx:23–29` pobiera `groups_profile` w scope grupy i sprawdza UUID odpowiedzi; linie 37–38 podają do niezmienionej Ultimate wyłącznie projekcję serwera. Brak fallbacku do prywatnych danych autora z innego DTO. |
| Auth i finanse | Całe `app/supabase` jest bajtowo identyczne z bazą Stage 2A. Diff produkcyjnego Auth, finansów i `app/src/ui` jest pusty; zmienił się tylko test `auth/premiumRuntime.test.tsx`. Nie zmieniono SessionManager ani zasad offline. Istniejąca bramka Auth ukrywa świat po awarii sieci, a RAM edytora umożliwia bezpieczny powrót po recheck. Regresje SQL finansów i testy aplikacji ponowiono. |

## 3. Premium 3.18 — rzeczywisty diff i ocena przypięcia

Nie przyjęto samego PASS strażnika za dowód zgodności. Niezależnie od `premium-route-policy.mjs` odczytano Git bloby historycznych wzorców i obliczono SHA-256 wszystkich **55 plików prezentacji**. Zestaw i hashe manifestu pozostają zgodne: `MAIN=134c52b1aee0d0804cc0cf71f151f95040e7a38f`, zatwierdzone wyjątki `APPROVED=a82397b130ca2296511247e848139edb79308a87` (wybrane demo App/EventForm/GroupScreens/Profile/Teams i ui/MatchHero). Odpowiada to chronionemu Premium 3.18 z zaakceptowanymi późniejszymi wyjątkami, nie nowemu wzorcowi utworzonemu z HEAD. Tekst normalizowano CRLF→LF, obrazy porównano bajtowo.

Dokładnie obejrzano pełny diff czterech plików względem Stage 1 (`b30908e15cedff6ffa1a4ca76f0fb514e04302a7`, treść ta sama w bazie 2A). Wszystkie cztery w audytowanym SHA są identyczne z przypinanym `f47cd80ad49aa6df0faf0dcb04093f2fa1adfbcd`.

| Plik | Diff i uzasadnienie zmiany runtime |
|---|---|
| `app/src/events/PremiumTeams.tsx` | +43/−25. Lokalny useReducer zastępuje kontroler API; pojawia się obserwacja aktywności zakładki (17–29), sprawdzone registered (31–36), jawne refresh/retry/pending/error i prawdziwy Save (70–100). Zachowano mechanikę wyboru/transferu/profilu oraz oryginalny PremiumPitch; bez nowych stylów, geometrii lub kopii karty. P3 opisano wyżej. |
| `app/src/events/lineupEditor.ts` | +8/−4. Dodano load i oddzielny restorePoint; roster przycina baseline/draft/restorePoint. Dzięki temu wersja 0 ma pusty baseline serwera, niezapisaną propozycję i możliwość jej przywrócenia. Algorytm naprzemienny, swap/transfer i semantyczne porównanie podziału pozostały. |
| `app/src/events/lineupContracts.ts` | Nowy, 62 linie. Jawny decoder snapshotu, walidacja pary matches_detail/lineups_get, scope grupy, rosteru i bezpiecznych błędów. Usuwa z UI założenie, że dowolny obiekt API jest prawidłowym składem. |
| `app/src/events/usePremiumLineup.ts` | Nowy, 170 linii. SessionManager/accounts, RAM scope, generacja/flight, CAS/roster, stabilny zamiar retry, obowiązkowy readback, czyszczenie po zmianie tożsamości. Nie wprowadza własnego Auth, uprawnień ani SQL klienta. |

`app/scripts/premium-route-policy.mjs:12–18,44–62` dodaje stałe Git SHA Stage 2B i **zamknięty zbiór tych czterech plików** oraz dwa nowe kontrakty importów. Pozostałe pliki zachowują stare przypięcia. Nie ma wyjątku wildcard, pomijania części pliku, hashowania aktualnego HEAD jako wzorca ani zmiany manifestu 55. Nie zmieniono domyślnego LIVE, routingu Androida/B1/demo lub CI.

`verify-premium-policy-cases.mjs`: zachowano 29 wcześniejszych przypadków. Dwa mutanty dostosowano do faktycznego nowego kodu: restorePoint zamiast baseline oraz warunkowy prawdziwy Save zamiast dawnego przycisku zawsze disabled. Nadal sprawdzają utratę przywracania i bezwarunkowe włączenie Save. Osiem dodatkowych odmów obejmuje decoder, GET/POST, UUID retry, zachowanie szkicu, czyszczenie RAM, aktora i roster token. **37 PASS** potwierdza odmowy, a nie poprawność samej funkcji; tę sprawdzono osobnymi testami poniżej.

Przejrzano również usunięte fragmenty testów Stage 1. Cztery testy czystego modelu pozostały w lineupEditor.test.tsx; interakcje, profile/odmowy, goście, restore i wycofanie uczestnika przeszły do premiumLineupApi.test.tsx z nowym kontraktem. Asercje „backend nie istnieje”, „Save zawsze disabled” i „unmount zawsze porzuca podgląd” przestały opisywać zamówiony Stage 2B; zastąpiły je testy braku automatycznego POST, rzeczywistego zapisu/readback oraz scoped RAM z ponowną autoryzacją. Nie stwierdzono skip/wyłączenia filtrami w celu uzyskania PASS. W demo/eventAccess.test.ts przesunięto istniejący zegar na cały plik, obejmując także dwa przypadki poza describe; daty, asercje i produkcyjny reducer pozostały niezmienione.

**Ocena:** aktualizacja dokładnego przypięcia runtime jest technicznie uzasadniona integracją Stage 2B. Poprzedni wzorzec nie mógł jednocześnie pozostać bajtowo niezmieniony i zapewnić prawdziwego zapisu. Nie stwierdzono rozszerzenia wyjątku na prezentację lub inny moduł. Audyt nie zmienił przypięć i nie zastępuje osobnego review właściciela wymaganego przez `AGENTS.md:9` („Zmiana strażników i CI wymaga osobnego przeglądu właściciela”).

## 4. Faktycznie wykonane testy w tym audycie

Środowisko tej sesji to **Windows i lokalny Docker**, z rzeczywistym dostępem do wskazanych worktree oraz SDK. Nie wykonano osobnego przebiegu w Cloud Codex i nie przypisujemy mu lokalnych wyników. Każdy poniższy zakończony przebieg zwrócił exit 0.

| Kontrola ponowiona podczas audytu | Wynik i granica dowodu |
|---|---|
| `npx --no-install tsc --noEmit`, `npm run typecheck:edge`, `npm run lint -- .` | PASS: aplikacja, strict Edge, ESLint. |
| `npm run test.unit -- --run` | **335 PASS / 53 pliki** z audytowanego drzewa; w tym **23 UI/API** i **23 Edge** na kontrolowanym transporcie. |
| Dwie niezależne próby audytowe | **2 PASS**, osobno od powyższych 335: wykrycie GET ukrytej zakładki oraz utrata starego draftu/request_id po rzeczywistym logout/signIn innego użytkownika na tej samej instancji SessionManager po awarii POST i unmount. Transport fixture. Artefakt lokalny `app/.cache/lineup-audit-probes.test.tsx`, uruchomiony przez `npm run test.unit -- --run .cache/lineup-audit-probes.test.tsx`; nie wchodzi do kodu PR i pozostaje ignorowany. |
| `npm run verify:consolidation` | **41 migracji / 55 plików wizualnych / 10 granic importów PASS**. |
| `npm run test:premium-policy` | **37 PASS**, bez pominięć. Niezależne porównanie 55 wzorców oraz czterech blobów runtime także PASS. |
| `npm run build`, `npm run build:premium-local`, `npm run build:demo` | PASS; izolacja demo **16 plików PASS**. Istniejące ostrzeżenia rozmiaru chunków. |
| `python -X utf8 app/scripts/test-lineups-ui-local.py` | **14 PASS rzeczywistych testów browser/UI + 14 PASS towarzyszących kontroli backendu**. Uruchomiono niezmieniony runner z czystego oryginalnego worktree Stage 2B na dokładnym 58a9bab, ponieważ jego branch guard celowo odrzuca gałąź audytową. Nie obchodzono guarda. |
| `python -X utf8 app/scripts/test-lineups-local.py` | **50 PASS SQL/RLS/PostgREST/konkurencji/restartu**, z czystego bazowego worktree 2A na 3b00ec2, z zachowaniem jego branch guarda. Sprawdzono bajtową identyczność całego app/supabase z 2B. Obejmuje prywatność, no-op autora/czasu/wersji, replay przy cofniętych zgodach i regresje finansów. Ten runner używa bootstrapu Auth i syntetycznych JWT, odrębnie od prawdziwego GoTrue powyżej. |

Rzeczywisty test UI używa Chrome → faktyczny PremiumTeams/SessionManager → tokenów wydanych przez GoTrue → handlera accounts w Edge Runtime → PostgREST → PostgreSQL. Sprawdzono pierwszą propozycję 6:5 bez POST, jawny zapis i bezpiecznego autora, dwóch klientów/409 z zachowaniem szkicu, transfer gościa 5:6, prawdziwy profil grupowy/Ultimate i powrót do szkicu, restore bez POST, utratę odpowiedzi **po commit** i identyczny retry po odmontowaniu przez istniejący Auth, ponowne wejście, jeden wspólny wiersz SQL, odebranie członkostwa/logout, restart oraz 320/390/768 Light/Dark bez overflow i z celami dotykowymi ≥44 px. To rzeczywisty backend w testowym hoście UI, nie pełna aplikacja w fizycznym Android WebView.

Nowe fixtures audytu: `slm-lineups-edge-aab9e771aef2` (+auth/rest/edge) oraz `slm-lineups-stage2a-58f8de471a97` (+rest). Wszystkie sześć kontenerów po testach **zatrzymane i zachowane**; niezależny inspect potwierdził network none/wspólny namespace kontenera, brak mapowania portów. Browser korzystał z tymczasowego mostu loopback. Odtworzono 41 migracji wyłącznie w nowych fixtures. Nie migrowano istniejącej bazy. GoTrue tworzył własny schemat Auth; minimalny Storage służył tylko historycznym migracjom, a lokalny harness zastępował Kong. Te dwa elementy nie otrzymują PASS E2E.

### Niewykonane teraz / raporty odziedziczone

- **Cypress `cypress/e2e` 13/5**: wynik poprzedniej implementacji, nie ponowiono w audycie. Nie mylić z nowym rzeczywistym browser runnerem i 335 ponowionymi testami. Zmieniony legacy `cypress/premium-behavior.cy.ts` nadal nie ma nowego przebiegu na swoim dawnym stosie.
- **Android web build, cap sync, assembleDebug offline**: odziedziczony PASS implementacji, nie ponowiono w tym audycie. Istniejący APK sprawdzono tylko odczytem.
- **POCO/ADB E2E, natywny SecureStorage na telefonie, hardware Back, USB loss/reconnect, background/resume**: niewykonane. Żadnego APK nie zainstalowano i nie zmieniono konfiguracji telefonu.
- **Nowy pełny lokalny stos CLI z Kong/Storage**, test obciążenia, hostowane CI i Supabase Cloud: niewykonane. Cloud, merge i publikacja są poza zakresem/autoryzacją.

## 5. Rzeczywisty stan Windows/Android/backendów

Odczytano wyłącznie metadane migracji i obecność tabel/funkcji w istniejących bazach, w transakcjach READ ONLY. Nie odczytywano kont/telefonów/finansów użytkowników i nie zamieszczono kluczy ani tokenów.

| Lokalny projekt | Stan względem kanonicznych 41 migracji 2B |
|---|---|
| `slm-premium-real-finance`, Kong 64321 / DB 64322 | **44 wpisy**, ale brakuje 6 kanonicznych, jest 9 obcych eksperymentalnych wersji. Nie ma slm_match_lineups ani slm_lineups_dispatch. Edge zatrzymany; zamontowany cached handler nie zawiera obu akcji lineups. **Niezgodny.** |
| `slm-main-stabilization`, Kong 55321 / DB 55322 | **Dokładnie 40 kanonicznych**, bez obcych; brak tylko `20261029140000_match_lineups.sql`. Brak tabeli/RPC składów. Edge zatrzymany i cached handler bez lineups. Nie stosowano migracji ani nie odświeżano źródeł. **Zgodna baza historyczna, jeszcze nie Stage 2A.** |
| `slm-premium-behavior-review`, Kong 65321 / DB 65322 | **48 wpisów**, brakuje końcowej projekcji nazw PR16 i match_lineups, 9 obcych wersji. Brak tabeli/RPC składów. **Niezgodny.** |

Sześć brakujących źródeł na 64321:

```text
20261028174603_premium_match_membership_visibility.sql
20261028174920_premium_member_creation_finance_guard.sql
20261028175508_premium_match_feed_filters.sql
20261028181054_premium_group_admin_only_finance.sql
20261028204500_restore_pr16_match_name_projection.sql
20261029140000_match_lineups.sql
```

Dziewięć dodatkowych wersji w stosach eksperymentalnych: 20261026182532, 20261026182914, 20261026183222, 20261026225907, 20261026231507, 20261026231801, 20261026231929, 20261027063829, 20261027172523. Sama liczba migracji nie potwierdza zgodności. Cached `.cache` nie jest źródłem kanonicznym.

ADB istnieje: `C:\Users\Suda\AppData\Local\Android\Sdk\platform-tools\adb.exe`, wersja **1.0.41**. `adb devices -l`: **0 urządzeń**. Nie potwierdzono modelu/Androida przez getprop; POCO X3 NFC/Android 12 to informacja właściciela. Nie ustawiano adb reverse, nie uruchamiano aplikacji ani logcat. Dostępne są lokalny Docker Desktop 29.8.2, Android Studio/JBR, SDK/build-tools 36.0.0 i istniejący Supabase CLI **2.120.0** (cache npm; nic nie instalowano).

Istniejący artefakt odczytany z worktree Stage 2B:

```text
I:\slm\sunday-league-mates\.worktrees\premium-lineups-stage2b\app\android\app\build\outputs\apk\debug\app-debug.apk
7868562 B
SHA-256 8742579e298e893b7d0abdc68b4e104e8b8cc87ed60267548e5665e556859c63
```

`aapt dump badging`: `pl.psuda87.slm`, versionCode 1/versionName 1.0, minSDK 24, targetSDK 36, debuggable. Zatem Android 12/API31 spełnia statyczne minimum; działania na telefonie nie dowiedziono. APK nie stanowi samodzielnego dowodu źródłowego SHA. Potwierdzono endpoint/CSP wyłącznie 127.0.0.1:64321, brak Cloud accounts URL w JS, `webDir=dist-android-stage3`, `loggingBehavior=none`, WebView debugging false. Konfiguracja źródłowa: `app/capacitor.config.ts:3–10`; debug manifest/network config dopuszcza cleartext tylko localhost/127.0.0.1. Bez zmian app ID lub konfiguracji natywnej.

**Pułapka operacyjna:** domyślny build używa innego wejścia, a `app/src/auth/api.ts:26–27` ma domyślny Cloud URL. Do tego odbioru konieczny jest jawny build android-stage3 i obie flagi Capacitor. Nie używać zwykłego dist jako lokalnego testu telefonu.

## 6. Plan odbioru na POCO — polecenia PowerShell

**To instrukcja przyszłego odbioru, nie polecenie wykonania go teraz. Audyt kończy się przed przygotowaniem trwałego stosu telefonu, instalacją i testami urządzenia.** Właściciel musi najpierw zaakceptować przypięcie i osobno zdecydować o przygotowaniu backendu oraz instalacji/połączeniu telefonu. Nie ma potrzeby instalowania dodatkowych narzędzi.

### A. Kontrole bez zmian danych

```powershell
$ErrorActionPreference = 'Stop'
$repo = 'I:\slm\sunday-league-mates'
$review = Join-Path $repo '.worktrees\premium-lineups-stage2b'
$pinned = '58a9babf257876e47cf6db269a0bf05d2e1db1f4'
Set-Location $review
if ((& git rev-parse HEAD).Trim() -ne $pinned) { throw 'Inny SHA — zatrzymaj odbiór' }
if ((& git status --porcelain)) { throw 'Worktree ma zmiany — zatrzymaj odbiór' }
git branch --show-current
git worktree list
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (!(Test-Path -LiteralPath $adb)) { throw 'Brak istniejącego ADB' }
& $adb version
& $adb devices -l
docker ps --format '{{.Names}} {{.Ports}}'
# Nie publikuj numeru seryjnego telefonu ani danych kont w raporcie.
```

Jeżeli lista urządzeń nadal jest pusta/unauthorized: zatrzymać się i przekazać sam status, bez numeru seryjnego. Audyt nie upoważnia do zmiany USB debugging/ustawień POCO.

Ponowienie już zaliczonych izolowanych testów nie wymaga stosu telefonu:

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\premium-lineups-stage2b'
python -X utf8 app/scripts/test-lineups-ui-local.py
if ($LASTEXITCODE -ne 0) { throw 'UI/API FAIL' }
Set-Location 'I:\slm\sunday-league-mates\.worktrees\premium-lineups-stage2a'
python -X utf8 app/scripts/test-lineups-local.py
if ($LASTEXITCODE -ne 0) { throw 'SQL/RLS FAIL' }
```

### B. Backend — wymagany osobny punkt kontrolny

Rekomendowany jest **nowy, jednoznacznie oddzielny projekt** `slm-lineups-poco-stage2b`, katalog `.cache/poco-lineups-stage2b` w worktree audytu, API **55341**, DB **55342**, shadow **55340**, inspector **55348**. Podczas audytu te porty (oraz 55343) nie miały listenerów; przed startem trzeba sprawdzić ponownie. Żadna konfiguracja tego projektu nie została jeszcze utworzona.

Po zgodzie przygotować nowy katalog z kanonicznych `app/supabase` na 58a9bab, z odmową nadpisania istniejącego katalogu/projektu/wolumenu. Wymagania odbioru przygotowania: dokładnie te same 41 migracji, bez dziewięciu eksperymentalnych Auth18; seed wyłączony; żadnego linku do Cloud; lokalne fikcyjne konta i dane. Kanoniczny `functions/accounts/index.ts:5` celowo odrzuca URL lokalny. Potrzebny jest osobny **lokalny entrypoint w ignorowanym katalogu**, z allowlistą lokalnego Kong/55341 i oryginalnym handlerem, tak jak w istniejących harnessach — bez zmiany produkcyjnego index.ts lub wyłączenia weryfikacji sesji handlera. Dopuścić istniejące originy natywne `https://localhost`/`capacitor://localhost`; nie kopiować ślepo konfiguracji desktopowej 5196. Przygotowanie tego pliku/konfiguracji i danych testowych jest następną osobno zatwierdzaną czynnością, nie gotowym artefaktem niniejszego audytu.

Istniejący `prepare-stabilization-local.mjs` ma celowy branch guard i wskazuje inny projekt/porty; nie uruchamiać go na audytowej gałęzi ani nie fałszować zmiennych CI. Nie należy też używać cached handlerów istniejących stosów.

Po przygotowaniu i sprawdzeniu **nowej** konfiguracji, przyszłe polecenia startu dotyczą wyłącznie nowego katalogu:

```powershell
$cli = 'C:\Users\Suda\AppData\Local\npm-cache\_npx\0e23c24576954b26\node_modules\@supabase\cli-windows-x64\bin\supabase.exe'
$stack = 'I:\slm\sunday-league-mates\.worktrees\premium-lineups-stage2b-audit\.cache\poco-lineups-stage2b'
if (!(Test-Path -LiteralPath "$stack\supabase\config.toml")) { throw 'STOP: nowy stos nieprzygotowany' }
# Dopiero po osobnym review project_id, portów, entrypointu i 41 źródeł:
# & $cli start --workdir $stack --exclude studio,imgproxy,logflare,vector,realtime,mailpit,postgres-meta,supavisor
# & $cli functions serve accounts --workdir $stack
# Wyniki start/status mogą zawierać klucze lokalne — nie wklejać ich do raportu/czatu.
```

Celowo nie ma polecenia reset/db push/link ani migracji istniejącej bazy. Jeśli właściciel zamiast nowego projektu wybierze aktualizację 55321, wymaga to osobnej zgody i zabezpieczenia danych; w tej sesji nic takiego nie wykonano.

Przed telefonem trzeba potwierdzić nowy projekt: 41 **dokładnych** wersji, obecność slm_match_lineups/slm_lineups_dispatch, bieżący handler z obiema akcjami, GoTrue login/status oraz odczyt i kontrolowany zapis lineups przez accounts. Należy przygotować dwóch zwykłych członków jednej fikcyjnej prywatnej grupy, outsidera i 11 registered wpisów z gościem oraz rezerwą poza boiskiem; mecz przyszły, niezakończony. Tych danych nie tworzyć w używanej bazie. Bez tego nie przechodzić do C/D.

Bezpieczna kontrola samych wersji po zatwierdzonym utworzeniu nowego projektu:

```powershell
$dbContainer = 'supabase_db_slm-lineups-poco-stage2b'
$query = 'BEGIN READ ONLY; SELECT version FROM supabase_migrations.schema_migrations ORDER BY version; ROLLBACK;'
$actual = @(& docker exec $dbContainer psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c $query) |
  Where-Object { $_ -match '^\d{14}$' }
if ($LASTEXITCODE -ne 0) { throw 'Odczyt migracji FAIL' }
$canonical = @(Get-ChildItem -LiteralPath "$review\app\supabase\migrations" -Filter '*.sql' |
  ForEach-Object { $_.Name.Split('_')[0] } | Sort-Object)
$migrationDiff = @(Compare-Object $canonical $actual)
if ($actual.Count -ne 41 -or $migrationDiff.Count) { $migrationDiff; throw 'Niezgodny backend — STOP' }
```

### C. Odtworzenie APK z dokładnego SHA — po decyzji o odbiorze

Poniższy blok buduje i synchronizuje lokalne źródła, **nie instaluje APK**. Uruchamiać w osobnym PowerShell; zmienne są tylko procesowe. Nie używać starego skryptu build-consolidation-android.ps1, który celowo obsługuje inne gałęzie/warianty.

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\premium-lineups-stage2b\app'
if ((& git rev-parse HEAD).Trim() -ne '58a9babf257876e47cf6db269a0bf05d2e1db1f4') { throw 'Inny SHA' }
if ((& git status --porcelain)) { throw 'Zmiany w worktree — STOP' }
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:SLM_ANDROID_STAGE3 = '1'
$env:SLM_LOCAL_ANDROID = '1'
Remove-Item Env:SLM_B1_ANDROID -ErrorAction SilentlyContinue
Remove-Item Env:SLM_V1_LIVE_LOCAL -ErrorAction SilentlyContinue
npm.cmd run verify:consolidation
if ($LASTEXITCODE -ne 0) { throw 'verify FAIL' }
npm.cmd run build:android-stage3
if ($LASTEXITCODE -ne 0) { throw 'Android web FAIL' }
npx.cmd --no-install cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync FAIL' }
& .\android\gradlew.bat -p android :app:assembleDebug --offline
if ($LASTEXITCODE -ne 0) { throw 'Gradle FAIL — nie instalować' }
$apk = (Resolve-Path 'android\app\build\outputs\apk\debug\app-debug.apk').Path
Get-FileHash -LiteralPath $apk -Algorithm SHA256
git status --short
```

Przed instalacją sprawdzić zbudowane assets/Capacitor/CSP jak w sekcji 5: wyłącznie lokalny accounts 64321, brak Cloud, Stage3 webDir, logging none. Nie aktualizować hashy/manifestu, jeśli verify odrzuci zmianę. Nowy hash APK może różnić się od istniejącego; zapisać hash rzeczywiście instalowanego pliku.

### D. Telefon — dopiero po osobnej zgodzie

Na gotowym nowym stosie można pozostawić endpoint APK **64321 po stronie telefonu** i skierować go na nowy **55341 komputera** przez USB. Nie trzeba przebudowywać UI lub używać LAN/Cloud. Ponieważ Stage3 używa istniejącego namespace tokenów `slmfinanceandroiddev` (`app/android-stage3/main.tsx:23`), przed zmianą backendu należy normalnie wylogować stare konto w aplikacji. Nie usuwać danych przez pm clear/uninstall. Jeśli normalny logout jest niedostępny, zatrzymać się i uzgodnić dalsze działanie.

```powershell
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$serial = Read-Host 'Numer seryjny jednego autoryzowanego POCO z adb devices -l'
& $adb -s $serial get-state
& $adb -s $serial shell getprop ro.product.model
& $adb -s $serial shell getprop ro.build.version.release
& $adb -s $serial reverse --list
# Jeśli istnieje mapowanie tcp:64321, STOP i decyzja właściciela; nie nadpisywać.
# Dopiero po zgodzie na połączenie nowego backendu:
# & $adb -s $serial reverse --no-rebind tcp:64321 tcp:55341
# if ($LASTEXITCODE -ne 0) { throw 'Mapowanie nie powstało — STOP' }
# Dopiero po OSOBNEJ zgodzie na instalację zatwierdzonego APK:
# & $adb -s $serial install -r $apk
# if ($LASTEXITCODE -ne 0) { throw 'Instalacja FAIL — bez -d, uninstall i kasowania danych' }
```

Po zgodzie otworzyć aplikację ręcznie, zalogować się wyłącznie fikcyjnym kontem nowego lokalnego projektu. Drugą sesję uruchomić na PC w kliencie jawnie wskazującym `http://127.0.0.1:55341/functions/v1/accounts`; zwykły istniejący Premium build na PC ma inny port i nie jest automatycznie drugim klientem tego stosu. Konfigurację takiego klienta przygotować razem z nowym backendem, bez zmiany domyślnego routingu.

Odbiór ręczny (wyniki wpisać osobno, bez tokenów lub danych prawdziwych osób):

1. Potwierdzić lokalny projekt i tożsamość konta. Otworzyć mecz: pierwszy podział 11 osób 6:5, gość obecny, rezerwa poza boiskiem, brak autora i brak automatycznego zapisu.
2. Zapisać raz; potwierdzić wspólny skład/wersję i autora w drugim kliencie. Wyjść/wejść ponownie; podział trwały. Zmiana i cofnięcie do baseline nie aktywuje nowego zapisu/autora.
3. Przenieść gościa A→B, wykonać zamianę dwóch osób; zapisać i odczytać w drugiej sesji. Gość bez konta nie otwiera profilu. Profil członka i hardware Back zachowują szkic oraz pozycję przewijania.
4. Dwa szkice na tej samej wersji: PC zapisuje pierwszy, POCO otrzymuje 409, zachowuje szkic, nie pokazuje sukcesu i nie zapisuje automatycznie. Odświeżenie wymaga świadomej decyzji o zastąpieniu szkicu.
5. PC wycofuje uczestnika/promuje rezerwę. POCO nie może zapisać starego rosteru; po odświeżeniu wycofany znika, nowy jest poza podziałem do jawnego przypisania.
6. W zatwierdzonym scenariuszu utraty USB/backendu sprawdzić ukrycie chronionego świata i brak fałszywego sukcesu; po powrocie i recheck tej samej sesji szkic pozostaje. Dokładnej utraty odpowiedzi po commit nie należy zgadywać z odłączenia kabla — ten przypadek został deterministycznie sprawdzony automatycznie.
7. Zostawić niepewny zapis, wylogować, zalogować inne fikcyjne konto: brak starego szkicu/UUID. Odebrać członkostwo w PC i odświeżyć POCO: brak boiska/autora/profilu; outsider nie otrzymuje prywatnych składów.
8. Sprawdzić background/resume i blokadę po utracie sesji; bez odsłaniania poprzedniego konta. Bezpieczny magazyn ma przechowywać tylko tokeny, nigdy szkic/hasło. Bez włączania WebView debugging/logowania tokenów.
9. Light/Dark i cztery palety, przewijanie, mały ekran, przyciski oraz klawiatura; porównać z zaakceptowanym Premium 3.18 i zrzutami Stage 2B. Nie akceptować przebudowy Ultimate/boiska/menu jako skutku integracji.
10. Zwykły członek nadal nie uzyskuje administracji finansami. Odczytać własne rozliczenie; nie zmieniać prawdziwych kwot ani kont. Zapisać model/Android, SHA źródeł i hash APK, project_id/41 wersji, PASS/FAIL każdego punktu i ograniczenia.

## 7. Decyzja o PR i stan końcowy

**PR #27 można skierować do dalszej integracji po przeglądzie właściciela przypięcia runtime.** Nie znaleziono krytycznej luki wymagającej poprawki przed tym review. P3 z ukrytym odczytem można rozpatrzyć osobno; audyt nie zmienia kodu automatycznie. PR jest zależny od Stage 2A, a nie samodzielną zgodą na merge do main. To nie jest potwierdzenie gotowości aktualnej bazy POCO ani produkcyjnego wdrożenia.

Wykonane w tym audycie: ponowione testy kodu/UI/API/SQL, porównanie chronionej prezentacji i runtime, odczyt lokalnych metadanych backendów/SDK/APK/ADB, raport. **Cloud Codex: brak osobnego przebiegu.** Pozostające na komputerze: osobno zatwierdzony nowy zgodny backend, odtworzenie i kontrola APK, autoryzowane podłączenie/instalacja i ręczny POCO. Niewykonane: pełny Kong/Storage E2E, nowy Cypress/native build, hostowane CI, Cloud, merge/publikacja i testy fizycznego telefonu.

Żadnej migracji/Edge nie wdrożono do istniejącego projektu ani Cloud. Nie zainstalowano APK, nie resetowano bazy, nie zmieniono telefonu, nie scalono PR i nie rozpoczęto kolejnego modułu. Chronologia wyniku: **`docs/ODPOWIEDZI_CODEX.txt`**; bieżący stan: `docs/STATUS.md`. Dalsze czynności wymagają decyzji właściciela; praca kończy się na raporcie audytu.

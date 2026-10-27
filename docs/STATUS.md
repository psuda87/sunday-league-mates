# Przebudowa kont — kandydat nieaktywny, blokery

Kod2e0b0f2, Draft PR #18: https://github.com/psuda87/sunday-league-mates/pull/18 — bez konfliktów i merge, pełna aktywacja BLOCKED.

2026-10-27 00:29 Europe/Warsaw — przebudowa kont: kandydat, aktywacja BLOCKED
Kontynuacja feat/account-model-foundation / Draft PR18 z e81ddac; main134c52b. Resolver nickname/potwierdzonego email bez telefonu/fallbacku, rzeczywista rejestracja bez emaila z idempotencją i wznowieniem po Auth, wspólny atomowy zapis PR16+rename+kontakt z hasłem tylko dla rename, ochrona oczekiwanego UUID, minimalny admin DTO i reset z dodatkowym potwierdzeniem. Domyślne bramki false, UI opt-in bez CSS/karty/nav. Nowe4 migracje tej kontynuacji,42 łącznie; historia bez edycji. Audyt READ ONLY: developer64 kont/46 duplikatów/53 zły format/3 brak; PR16 42/31/15/9 i2 pending; fundament9 bez konfliktów. Anonimowy raport docs/ACCOUNT_MODEL_LOCAL_AUDIT.json, niczego nie nadpisano.
PASS264 Vitest/45, TS/lint,70 SQL/RLS/replay42,49 real HTTP od pustej bazy+21 dodatkowych,12 Chrome (fixture UI), main/Premium/demo build+isolation, source guards. SQL lint4 stare warningi, brak nowych. Potwierdzony email w testach jest fixture; dostarczanie/callback/recovery NOT TESTED. Właściciel wybrał brak wysyłki i zablokowaną aktywację. Po testach58321/59321 active=false i API account_model=false/self_registration=false; backend i dane POCO/Cloud nietknięte. Fikcyjne konta zachowane, bez resetów/merge/deploy, APK nie przygotowano.
Pełnego zadania nie uznano za zakończone: do dokończenia email verification/recovery i ich konfiguracja, legal/anti-bot, mapa kolizji i skoordynowany cutover/odbiór Androida. Raport docs/ACCOUNT_MODEL_CANDIDATE.md i docs/ODPOWIEDZI_CODEX.txt. PR17/14/15 i cudze worktree zachowane.

---

# Model kont — etap1, nieaktywny fundament

Draft PR #18: https://github.com/psuda87/sunday-league-mates/pull/18; implementacja2a6113b.

2026-10-26 19:35 Europe/Warsaw — model kont etap1: nieaktywny fundament
feat/account-model-foundation z main134c52b, osobny worktree. Nowe3 migracje, kanoniczny nickname + pochodny unikalny rejestr/RLS, jawny preflight bez nadpisywania, atomowy rename z aktualnym hasłem i CAS/idempotencją, bez begin/finish/pending/zmiany sesji i bez haseł w SQL. Feature gate domyślnie false, brak UI i przełączenia resolvera/telefonu/rejestracji. Dotychczasowy main/UI i wcześniejsze35 migracji zachowane, PR17 niezmieniony.
PASS TS/lint/build,259 Vitest/44 pliki,47 SQL/RLS/replay38,25 real HTTP/Auth/Edge/PostgREST w NOWYM lokalnym slm-account-foundation57321. Rzeczywiste wyścigi dwóch ownerów i jednego ownera, rollback błędnego hasła/kolizji, sesje/refresh, UUID/profil/numer/grupy/zgody, IDOR i ledger bez sekretów sprawdzone. Chronione źródła/runtime i55 Premium PASS, auto deployment false. Konta fikcyjne pozostawiono; istniejące bazy/POCO/Cloud nietknięte. Bez APK/testu fizycznego/merge. Szczegóły i blokery cutover docs/ACCOUNT_MODEL_FOUNDATION.md; raport docs/ODPOWIEDZI_CODEX.txt. Następny bezpieczny etap: mapowanie konfliktów oraz przygotowanie wspólnego resolvera i transakcyjnego zapisu profilu przed jakąkolwiek aktywacją.

---

# PR16 — poprawka etykiet odebrana na POCO

2026-10-26 18:51 Europe/Warsaw — PR16: ręczny odbiór poprawki etykiet na POCO
Właściciel po aktualizacji APK z kodu69f3aa6 potwierdził: „ok działa jest ok”. Zapisano pozytywny ręczny odbiór poprawki odstępów formularza profilu na POCO. Nie dopisujemy oddzielnych wyników każdego pola, motywu ani scenariusza klawiatury, ponieważ odpowiedź była ogólna. Bez nowych zmian aplikacji/backendu/APK i bez ponawiania testów. PR #16 bez merge; potwierdzenie działania nie jest poleceniem scalania. Raport docs/ODPOWIEDZI_CODEX.txt.

---

# PR16 — APK z poprawką etykiet na POCO

2026-10-26 18:50 Europe/Warsaw — feat/premium-profile-name-privacy; kod69f3aa6. Premium build/cap sync/assembleDebug i weryfikacja APK PASS. Za zleceniem właściciela install-r Success na c7a559b5 bez czyszczenia danych; start Status:ok, hash zainstalowanego APK155cf3d0…603f5c9 zgodny. Podpis/kopia starej wersji sprawdzone. Backend testowy HTTP200/reverse54321→56321; bez Cloud/migracji. Log:0 crash/JS/net::ERR_, jeden systemowy komunikat WebView variations „Seed missing signature”. Następny krok: ręczna ocena odstępów pól i fokus/przewijanie przy fizycznej klawiaturze, Light/Dark. PR16 bez merge; raport docs/ODPOWIEDZI_CODEX.txt i docs/PREMIUM_PROFILE_IMPLEMENTATION.md.

---

# PR16 — poprawka odstępów formularza Premium

2026-10-26 18:47 Europe/Warsaw — feat/premium-profile-name-privacy, baza 67b9e9c. CSS: pionowe etykiety z 7 px przerwą dla zagnieżdżonych pól; żadnych zmian logiki/backendu/kolorów/karty. PASS: TS/lint, 8 Vitest, 6 Chrome/Cypress (320/360/390 × Light/Dark, wysokości 844/380), main/Premium build, source contract55. Przed poprawką wszystkie6 konfiguracji wykazywały odstęp0 px. Nowe fikcyjne fixture/testy i zrzuty docs/ui/pr16/profile-labels-*.png. Fizyczna klawiatura i POCO z tą poprawką NOT TESTED; bez nowego APK/instalacji. Istniejące wyniki backendu pozostają historyczne. Migracje/Edge/Cloud/PR14/15 bez zmian. Aktualizacja istniejącego PR #16, bez merge. Następny krok: ręczny odbiór odstępów i fokus/przewijanie na POCO po osobno zleconej aktualizacji APK. Szczegóły docs/PREMIUM_PROFILE_IMPLEMENTATION.md i docs/ODPOWIEDZI_CODEX.txt.

---

# PR16 — ogólny wynik ręczny POCO pozytywny

2026-10-26 18:37 Europe/Warsaw — właściciel: „generalnie wygląda na to, że wszystko działa”. Nie zgłoszono usterki zainstalowanego APK6cf904ce. Zapisano pozytywną ogólną próbę ręczną; brak oddzielnych wyników pełnej checklisty, bez dopisywania indywidualnych PASS. Wcześniejsze testy techniczne pozostają zaliczone. PR #16 nadal bez merge; brak polecenia scalania. Tylko dokumentacja, bez ponawiania testów ani zmian aplikacji/Cloud/PR14/15. Szczegóły docs/ODPOWIEDZI_CODEX.txt i docs/PREMIUM_PROFILE_IMPLEMENTATION.md.

---

## Historia odbioru technicznego

# PR16 — odbiór techniczny lokalny, oczekuje odbioru ręcznego

PR #16: https://github.com/psuda87/sunday-league-mates/pull/16 — techniczny commit ed71f29 wypchnięty, draft bez konfliktów i merge.

2026-10-26 18:33 Europe/Warsaw — feat/premium-profile-name-privacy, baza76da23a, istniejący PR #16. Odizolowany pełny Supabase slm-pr16-review/API56321 z35 migracjami; oryginalny lokalny backend34/64 konta/33 grupy/13 meczów bez zmian, Cloud/PR14/15 nietknięte.
PASS: real Auth/Edge/PostgREST33 HTTP + real browser1, SQL fixture28/replay35,254 Vitest/43 pliki, TS/lint, main/Premium/demo isolation, guards32/35/55, cap sync/Android. Poprawki:409 consent_required zamiast503, wyścig dismiss Ionic, styl akcji ukrycia imienia, cross-platform allowlista demo z4 regresjami. Bez zmiany migracji i Auth aplikacji.
APK6cf904ce zainstalowano za osobną zgodą install-r na c7a559b5 bez czyszczenia danych, podpis zgodny; kopia poprzedniego APK zachowana. Reverse telefonu54321→komputer56321, start ok, brak znalezionego FATAL EXCEPTION/błędu WebView. Fikcyjne konta Zawodnik/Obserwator i2 grupy odbioru; poświadczenia tylko prywatnym TEMP poza Git. Ręczny odbiór A–G/Android nadal oczekuje, PR draft bez merge. Szczegóły/checklista/rollback: docs/PREMIUM_PROFILE_IMPLEMENTATION.md; odpowiedzi docs/ODPOWIEDZI_CODEX.txt.

---

# Premium profil B2/B3 — 2026-10-26 13:20:55 CET

Gałąź feat/premium-profile-name-privacy z main edd2e92.
Implementacja 1f9d460 wypchnięta; utworzenie Draft PR zablokowane przez
GitHub API403 Forbidden. Link formularza i pełny raport poniżej. Publiczny nickname
niezależny od loginu,3 globalne display_as, jawne first_name i share_first_name,
atomowe potwierdzone zgody w aktualnych grupach, read-back, fallback/RLS i spójne
nazwy grup/kart/zapisów. Nowa migracja20261026120000, historyczne bez zmian.
Supabase Cloud/sekrety/Auth sesje/APK/config nietknięte, bez merge/deploy.

PASS: TS/full lint,248 Vitest, build aplikacji,35 migracji PostgreSQL replay,
28 asercji SQL/RLS i persistence po restarcie PostgreSQL. Auth/Storage w tym
teście to fixture, nie pełny Supabase. NOT TESTED pełne HTTP/Auth/Edge i telefon;
CLI lokalny zablokowany EROFS. Build demo FAIL jak czysty main: frozenDemoAndroid
poza allowlistą. Bez obchodzenia izolacji. Szczegóły/ryzyka/odbiór przed merge:
[PREMIUM_PROFILE_IMPLEMENTATION.md](PREMIUM_PROFILE_IMPLEMENTATION.md).

# Aktualizacja UI B3 po POCO

2026-10-25 21:34 Europe/Warsaw — feat/premium-b3-groups, istniejący PR #13. Poprawiono wyłącznie kompaktowy przełącznik zgody per grupa i przycisk odświeżania (44px, ikona, stan ładowania, deduplikacja). Załadowane dane nie znikają podczas refresh, błąd zapisu zachowuje stan i kontrolkę. Backend/RLS/Auth/Ultimate/BottomNav bez zmian; brak operacji Cloud.
PASS: TS/lint,240 Vitest/41 plików, build Premium i demo/isolation, guards32/55, lokalny HTTP28 i real browser1 (4 szerokości ×2 motywy, zgoda po refresh/reload). Nowego testu POCO ani instalacji APK nie wykonywano. PR pozostaje do zatwierdzenia, bez merge. Szczegóły docs/PREMIUM_B3_GROUPS.md i docs/ODPOWIEDZI_CODEX.txt.

---

# Aktualny stan — Premium B3

2026-10-25 21:05 Europe/Warsaw — feat/premium-b3-groups z main a46f5e4. Premium ma rzeczywiste grupy/członkostwo/zgody przez istniejące RPC; domyślny LIVE zachowany, mecze/finanse Premium nadal demo. Auth/profil/numer/zdjęcia bez cofnięcia integracji; CSS/Ultimate/BottomNav bez zmian.
Lokalnie za zgodą zastosowano wersjonowane B2.2 i dwie migracje B3 (20261025190022/20261025193229), bez resetu. Lokalny Edge z bieżących źródeł. Cloud tylko odczyt: ACTIVE_HEALTHY, 7 migracji wobec34 lokalnie; wdrożenie B3 do Cloud wymaga osobnego przygotowania i zgody, niczego zdalnie nie zastosowano.
PASS: TS/lint,235 Vitest, SQL102+31, replay11/34 migracje, B3 HTTP28 i real browser1 (4 szerokości ×2 motywy), LIVE HTTP20/browser1, Cypress LIVE13 i B1/B2/B22 6, cztery buildy, guards32/55, sync/Android. Natywny unit:1 test szablonowy, nie test Keystore. Lokalne advisors0 WARN/ERROR; cztery znane SQL warnings. Cloud: istniejący Auth WARN i9 INFO, starsza polityka profili niezgodna z B3.
APK premium zainstalowano aktualizacją na POCO i uruchomiono; bez czyszczenia danych. Ręczny odbiór B3 NOT TESTED. Znane ograniczenia: cudze zdjęcia/statystyki niedostępne; Premium wydarzenia nadal demo; FCM/iOS/Cloud niezbadane end-to-end.
PR #13: https://github.com/psuda87/sunday-league-mates/pull/13 — draft, bez scalania; commit implementacji7a9f41f wypchnięty. Następny krok: lokalny odbiór grup na POCO i przegląd PR bez automatycznego merge. Raport/checklista: docs/PREMIUM_B3_GROUPS.md; odpowiedzi: docs/ODPOWIEDZI_CODEX.txt.

---

## Historia przed B3

# Aktualny stan Sunday League Mates

2026-10-25 17:35 Europe/Warsaw — fix/bottom-nav-highlight z main2c3e3f2. Naprawiono wyłącznie aktywny stan i obszar przycisków BottomNav, zachowując + oraz wygląd Premium/kartę Ultimate. TS/lint, 8 jednostkowych testów nawigacji, 8 konfiguracji Cypress (4 szerokości ×2 motywy ×3 warianty paska), build main/Premium, cap sync i source guards PASS. Android assembleDebug PASS. Backend/Auth/SQL/dane bez zmian. Poprawka zakończona; [PR #12](https://github.com/psuda87/sunday-league-mates/pull/12) zawiera wynik scalania i commit main (źródło aktualnego statusu). Użytkownik autoryzował squash merge po zielonych kontrolach, bez wdrożenia. Szczegóły: docs/ODPOWIEDZI_CODEX.txt; zrzuty: docs/ui/bottom-nav.

---

## Stan historyczny przed poprawką BottomNav

# Aktualny stan Sunday League Mates

2026-10-25 17:23 Europe/Warsaw — końcowy przegląd PR #11: sprawdzono ae397c4 względem main 1fadd977, brak konfliktów (main ancestor, GitHub mergeable=true). Brak błędów blokujących. PR oznaczono Ready for review zgodnie z wyraźnym poleceniem właściciela, bez merge.
Domyślny LIVE i 29 migracji main zachowane; Premium B1/B2 jawny wariant lokalny; karta/CSS30772de i55 plików Premium bez regresji. Uwzględniono7/7 ręcznych PASS właściciela. Nie wykryto utraty funkcji/danych w sprawdzonym zakresie.
Powtórzono: TS/lint/229 Vitest, source guards, diff check PASS; SQL9/9 i64/64 (w tym wcześniej pominięty późny cutoff i rzeczywisty push_claim). Security advisors0 problemów, scan367 ścieżek0 rozpoznanych sekretów. Cztery ostrzeżenia SQL nie blokują merge: push_claim ma poprawny wynik runtime; p_number jest zachowaną kompatybilną sygnaturą; v_before/v_rows to nieużywane deklaracje. Brak zmian kodu i nowych migracji. Testy tylko we własnych nowych lokalnych bazach, istniejąca baza bez zmian. Brak zdalnych migracji/deploy/Storage i brak merge. Oczekuje osobne potwierdzenie właściciela na scalenie; FCM/iOS/zdalny rollout niezweryfikowane. Szczegóły: docs/V1_CONSOLIDATION.md.

---

## Historia przed końcowym przeglądem

# Aktualny stan Sunday League Mates

2026-10-25 17:18 Europe/Warsaw — ODBIÓR RĘCZNY KONSOLIDACJI: właściciel potwierdził wszystkie siedem scenariuszy PASS (Premium Auth/sesja, profil/numer, zdjęcia, wygląd Ultimate/oba motywy, oznaczenie demo, funkcje LIVE, brak crashy/błędów uprawnień/utraty danych). Źródło: deklaracja właściciela po testach, nie nowe testy automatyczne agenta.
PR #11 nadal draft i bez scalania. Odbiór ręczny nie jest zgodą na merge ani zdalne wdrożenie. Pozostają wcześniej opisane ostrzeżenia SQL i pominięty test późnego cutoff; nie rozpoczęto kolejnego modułu.

---

## Historia konsolidacji i stan wcześniejszy

# Aktualny stan Sunday League Mates

2026-10-25 17:15 Europe/Warsaw — POCO ponownie widoczne przez ADB; reverse54321 przywrócone, backend HTTP204. Aplikacja ponownie uruchomiona bez czyszczenia danych/logout. Potwierdzenie sesji na ekranie oczekuje na użytkownika.

2026-10-25 17:14 Europe/Warsaw — backend lokalny odpowiada, ale ADB nie widzi POCO. Przywrócenie reverse i ponowienie sesji czeka na ponowne podłączenie USB; bez logout/resetu danych.

2026-10-25 17:10 Europe/Warsaw — Premium B1/B2 konsolidacji zainstalowane na POCO przez install -r i uruchomione. Lokalny API/reverse działają; brak sprawdzanych markerów crasha/transportu w logcat procesu. Bez czyszczenia danych. Odbiór ręczny wyglądu, sesji i profilu oczekuje na właściciela. PR #11 nadal draft, bez merge. Poniższy raport budowy jest historyczny względem tej instalacji.

2026-10-25 17:04 Europe/Warsaw — feat/v1-consolidation, baza main 1fadd977, izolowany worktree .worktrees/v1-consolidation.
Domyślny LIVE main zachowany. Premium B1/B2 to jawny wariant lokalny: realne Auth/własny profil, poza tym oznaczone demo. Karta/CSS z 30772de, wzorzec Premium d0f9fa9. 29 migracji main nienaruszone; 3 wcześniej zatwierdzone lokalne SQL przeniesione do historii (32), bez zależności od cudzej .cache. Lokalny Edge uruchomiony z kanonicznych źródeł; brak migracji/resetu istniejącej i zdalnej bazy, brak wdrożeń zdalnych.
PASS: TS/lint/diff, 229 Vitest, SQL9+63, HTTP B1 9/profil22/zdjęcia38/scoped20, realny browser LIVE1, Cypress B1/B2 6, kodek1, Premium smoke8 rozmiarów/motywów; build main/demo/oba lokalne APK, native unit i weryfikacja zasobów. Release local prawidłowo zablokowany. CORS na 5193 prawidłowo odrzucił test; 5174 PASS bez zmiany zabezpieczeń. Lint SQL kod0 z czterema istniejącymi ostrzeżeniami, jawnie w raporcie. Późny cutoff i fizyczny odbiór konsolidacji NOT TESTED. ADB device potwierdzone, nowego APK nie instalowano; instrukcja install -r w raporcie.
Skan wzorców sekretów bez potwierdzonego sekretu; marker PEM w niezmienionym parserze FCM nie jest kluczem. Brak zmian zdalnych Supabase/Storage, bez B3/B4, Maps i nowych metod Auth. AGENTS.md zawiera nową zasadę moduł→testy→akceptacja→PR→osobno potwierdzony merge main przed następnym modułem.
Szczegóły, SHA APK, pozostałe demo, rozstrzygnięcia i instrukcje odbioru: docs/V1_CONSOLIDATION.md. Zrzuty tylko fikcyjnych danych: docs/ui/v1-consolidation. Gałąź wypchnięta; [draft PR #11](https://github.com/psuda87/sunday-league-mates/pull/11) otwarty bez scalania, implementacja `f50484f`. Następny krok: odbiór POCO i review. Main nadal `1fadd977`.

---

## Stan historyczny przed konsolidacją

# Aktualny stan Sunday League Mates

19.10.2026 ? branch roboczy `feat/integration`, worktree `I:\slm\sunday-league-mates-integration`.
Rdze? integracji: `0ec5200`; dokumentacja i ?r?d?a grafik: `309d57c`. Oba commity wypushowano. [PR #2](https://github.com/psuda87/sunday-league-mates/pull/2) scalono standardowym merge `c28b09d77a6a203954c10060d1e87aa105cfeef2` do main. Lokalny main zsynchronizowano fast-forward bez prze??czania worktree. Bez wdro?enia aplikacji i zdalnej bazy.

## Wykonane funkcje

- Auth legacy i logowanie potwierdzonym e-mailem, profil, wymuszona zmiana has?a, reset oraz bezpieczna trwa?a sesja.
- Wiele grup, zgody/zaproszenia, role, sukcesja i zachowanie w?asnej historii.
- Mecze publiczne/prywatne, atomowe zapisy, go?cie, osobna rezerwa bez autoawansu, obecno?? i odwo?anie.
- Finanse oddzielone mi?dzy grupami: celowe wp?aty, FIFO, korekty, zwroty, audyt i osobne nadwy?ki naliczone/otrzymane.
- Globalna blokada nowych p?atnych zapis?w po dw?ch kwalifikuj?cych zaleg?o?ciach; brak wgl?du w cudze finanse.
- Transakcyjny inbox/outbox powiadomie? finansowych i wydarze?, worker i recheck odbiorc?w; FCM nieaktywne.
- Nowszy interfejs Premium z ui-beta po??czony z rzeczywistym backendem; demo buduje si? osobno.

## Migracje i Edge Functions

Lokalnie zastosowano 29 migracji: 13 historycznych i 16 nowych; ko?cowa `20261019175940_slm_v2_legacy_payment_dto.sql`.
Lokalnie dzia?aj? `accounts` i `push-worker`. W tym etapie nie wdra?ano niczego do chmury, nie zmieniano konfiguracji Supabase/Firebase/SMTP ani plan?w.
Przed przysz?ym rolloutem wymagany osobny przegl?d trzech napraw historycznych migracji i jednoznacznego mapowania dawnej grupy. Replay na fikcyjnych danych zachowa? histori? ledgeru 1:1.

## Wyniki ponowione w tym zadaniu

- TypeScript, ESLint i Deno: PASS. Vitest: 190/190; bootstrap: 6/6.
- SQL legacy: 31 PASS; SQL v2: 55 PASS; replay wszystkich migracji: 9 PASS.
- HTTP Auth: 7 zestaw?w PASS; scoped: 20 PASS; smoke/worker: 9 PASS.
- Rzeczywista przegl?darka ? lokalny Edge ? PostgreSQL: 1 PASS, bez mock?w.
- Cypress z kontrolowanym API: 13/13. To nie s? testy na telefonie.
- Web build, osobny demo build i izolacja 15 artefakt?w, cap sync android: PASS.
- Android assembleDebug + testDebugUnitTest: BUILD SUCCESSFUL; task jednostkowy UP-TO-DATE, nie nowy odbi?r urz?dzenia.
- SQL lint: exit 0, 3 ostrze?enia, brak b??d?w. Szczeg??y w raporcie audytu.
- npm audit: 6 moderate, w produkcji 3 moderate; 0 high/critical. Raport nie jest czysty.
- Skan stagingu i wychodz?cej historii: brak sekret?w; ?r?d?a Androida i package-lock zachowane. Formatowanie ko?c?w plik?w poprawiono po staged diff --check.
- Po testach: 0 kont/grup/mecz?w/scratch DB; 0 tabel SLM bez RLS; 0 RPC SLM dost?pnych anon.

## Git i zasoby

Auth/events/settlements/push zachowane w historii integracji; ui-beta zachowany na osobnej ga??zi i przeniesiony r?cznie.
Nowy dostarczony herb 1254?1254 zabezpieczono w `docs/branding/slm-crest-duo-source.png`; dwie grafiki ?r?d?owe w `pics/`. Nie podmieniano logo aplikacji 450?505.
Oryginalny worktree ui-beta i jego nie?ledzone pliki zachowano; identyczne kopie grafik s? cz??ci? integracji.
Automatyczne wdro?enia Git dla tej wersji wy??czaj? root i app/vercel.json. Nie wywo?ywano deploy ani produkcyjnych migracji.
Ga??zie ?r?d?owe pozostaj? zachowane. Po scaleniu #2 potwierdzono identyczno?? drzew origin/main i sprawdzonej integracji oraz niezmieniony ostatni deployment Vercel. Dodatkow? grafik?, kt?ra pojawi?a si? podczas audytu, zabezpieczono 1:1 jako `docs/branding/slm-gold-crest-comparison-source.png`; nie jest u?ywana przez aplikacj?. Ko?cowa aktualizacja dokumentacji i kopia tej grafiki stanowi? osobny commit zabezpieczaj?cy.

## Ograniczenia i nast?pny etap

SLM 1.0 NIE jest gotowe do publikacji. Osobnej weryfikacji wymagaj? fizyczny telefon, iOS, rzeczywista dostawa FCM oraz pe?ny email/SMTP/domena/legal/callbacki. Signup i poczta nadal zablokowane; istniej?ce konta dzia?aj?. CAPTCHA od?o?ona.
Vector nadal restartuje si?; nie zmieniano Docker socket ani ustawie? Windows. Testowany rdze? dzia?a bez niego.
Pozosta?y moderate zale?no?ci oraz ostrze?enia bundle/Browserslist/Gradle. Brak skonfigurowanych Actions CI i zabezpiecze? main w chwili audytu; nie zmieniano tych ustawie? i niczego nie omijano.
Nast?pny etap: r?czny odbi?r obecnej integracji na telefonie, przegl?d rollout danych i osobne uzgodnienie poczty oraz FCM. Merge kodu nie oznacza wdro?enia ani gotowo?ci do wydania.

Raport: [REPOSITORY_AUDIT.md](REPOSITORY_AUDIT.md). Szczeg??owa historia: [ODPOWIEDZI_CODEX.txt](ODPOWIEDZI_CODEX.txt).


2026-10-27 08:22 Europe/Warsaw — feat/account-model-foundation, Draft PR18 od33e95b3: opcjonalny e-mail/signup/profil, prawdziwy scoped proof SMTP/callback i recovery przez Auth. Bez zmiany primary/UUID/telefonów/zgód. PASS:280 Vitest,88 SQL-RLS/43 migracje,49 core HTTP+21 dodatkowych,29 SMTP-HTTP/3 browser callbacki,9 fault-race,18 UI browser, TypeScript aplikacji i nowych modułów/ESLint/build main+Premium+demo+callback/source guards. Dodatkowy strict całego Edge:3 zastane błędy niezmienionego webp.ts;4 stare SQL warnings. Obie nowe instancje60321/61321 active=false i capabilities=false. Wszystkie konta/wiadomości zachowane; wcześniejsze bazy, POCO, Cloud i inne worktree nietknięte. Internet SMTP/fizyczny Android NOT TESTED; bez APK/merge/deploy. Blokery: prawdziwy darmowy SMTP, domena/HTTPS callback, konflikty kont/legal/anti-bot i wspólna aktywacja. Szczegóły/odtworzenie docs/ACCOUNT_EMAIL_FLOWS.md, zrzuty fikcyjne docs/ui/account-email. Zmiany do push na istniejący Draft PR18; bez merge.

2026-10-27 17:56 Europe/Warsaw — Zakończenie: kod 9ab903f331bf1785fc9f2c5cc0fa6a037466d423 wypchnięty na origin/feat/account-model-foundation. Draft PR18 zaktualizowany i sprawdzony: open/draft=true/merged=false/mergeable=true, main134c52b bez zmiany. Finalne powtórzenie29 SMTP-HTTP/3 callbacków gotowego buildu +9 fault/race PASS po walidacji pojedynczego odbiorcy. SQL i HTTP potwierdziły wyłączenie obu nowych instancji. Raport docs/ACCOUNT_EMAIL_FLOWS.md zawiera „Decyzje podjęte samodzielnie”; docs/ODPOWIEDZI_CODEX.txt i STATUS uzupełnione. Bez merge/Cloud/płatnych usług/resetu/nowego APK; SMTP internetowe, docelowy callback i POCO nadal do osobnego odbioru.

2026-10-27 19:10 Europe/Warsaw — przygotowanie online, PR18 od5de91d3:44 migracje, podpisana bramka/Turnstile gate i transakcyjny przydział rejestracji, bezpiecznie wyłączony niekompletny SMTP, izolacja tokenów nowego projektu, poprawka strict WebP i UTF-8, patche Vitest/qs. Dowody:312 Vitest łącznie z bramką,96 SQL-RLS,102 v2/31 legacy/11 historia,14 preflight-restore,49+21 Auth HTTP,29 SMTP+9 fault,29 chronione API (dostawca captcha fixture),3 publiczne sandbox Cloudflare,18+2 browser,4 real Chrome CSP. Pełny strict/lint/buildy/izolacja demo PASS;6 moderate (3runtime),4 stare SQL warnings pozostają jawnie. Raport docs/SECURITY_AUDIT.md. Osobny zależny Draft PR wydzieli hosting/bramkę/konfigurację Android-PWA i plan cutover. Bez Cloud/merge/publikacji/APK/resetów; rzeczywisty SMTP/widget/domena/legal/odbiór POCO nadal NO-GO. Chronologia docs/ODPOWIEDZI_CODEX.txt.

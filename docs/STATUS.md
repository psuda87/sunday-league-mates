# Git etapu 2 — push zapisany, utworzenie PR BLOCKED

2026-10-28 16:56 Europe/Warsaw — kod `b46689a02d17d5eb6fccc5e3f4d9ed007480640d` wypchnięty na `origin/feat/premium-real-finance-stage2`, zdalny SHA potwierdzony. API GitHuba odrzuciło odczyt/utworzenie Draft PR (`Forbidden`), więc numeru PR nie ma. [Porównanie z właściwą bazą etapu1](https://github.com/psuda87/sunday-league-mates/compare/feat/premium-real-events-stage1...feat/premium-real-finance-stage2?expand=1); przy tworzeniu wybrać Draft, nie merge. Raport: [PREMIUM_REAL_FINANCE_STAGE2.md](PREMIUM_REAL_FINANCE_STAGE2.md). Aktualizacja dokumentów ma osobny commit. Bez zmian istniejących PR/gałęzi; Supabase Cloud nietknięty.

---

# Premium real data — etap 2: finanse, odbiór E2E BLOCKED

2026-10-28 09:03 Europe/Warsaw — `feat/premium-real-finance-stage2` od HEAD PR20 `448a2967489040162bfc6653c197af9afe9dcb55`; docelowa baza Draft PR `feat/premium-real-events-stage1`. PR18/19/20 i ich gałęzie bez zmian. P0: Premium → rzeczywiste `finance_groups`/`group_finance_*`, własne saldo i należności łącznie z gośćmi, statusy/historia/blokada, zgłoszenie wpłaty, panel administratora i potwierdzanie/odrzucanie/księgowanie/approval przez istniejący backend. UUID retry zachowany w RAM także po niepewnym odczycie/remount; scope i sesja sprawdzane, bez fikcyjnego salda przy błędzie. P1 nie rozpoczęto.

PASS: TypeScript, pełny lint, 326 Vitest/54 pliki i końcowy zmieniony zakres17/2, build main/Premium/demo+izolacja16, frozen UI55. Nowa zatrzymana po testach fixture PostgreSQL:44 niezmienione migracje,101 PASS SQL/RLS/finanse (Auth/JWT/Storage fixture), jeden scenariusz późnego cutoff FIFO NOT TESTED ze względu na zegar serwera. Chromium UI z kontrolowanym adapterem:320/390/768 Dark/Light, >=44px, odczyt statusu po decyzji PASS; **nie jest to E2E Supabase**.

BLOCKED: pełny lokalny Supabase/real Auth/Edge/HTTP/Chrome — rozpakowanie obrazów przekroczyło32GB vfs Dockera; brak odbioru dwóch kont przez pełny backend. Ponadto własne DTO nie rozdziela zastosowanych wpłat na poszczególnych gości ani nie daje zwykłemu zawodnikowi wstępnego podziału; decyzja dla historycznego płatnika bez bezpiecznej nazwy z aktualnego DTO grupy wstrzymana. Pełny restart procesu traci RAM niepewnego zamiaru wpłaty: najpierw sprawdzić historię. Android NOT TESTED. Brak zmian backendu/Cloud/Auth/migracji/Edge/Firebase/rozliczania/APK, resetów, merge i wdrożeń. Następny krok: brakujący odbiór dwóch fikcyjnych kont na działającym pełnym izolowanym Supabase, bez aktywacji nowego Auth. Szczegóły i dwa jawnie fixture zrzuty: [PREMIUM_REAL_FINANCE_STAGE2.md](PREMIUM_REAL_FINANCE_STAGE2.md); chronologia `docs/ODPOWIEDZI_CODEX.txt`.

---

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


2026-10-27 20:29 Europe/Warsaw — Etap1 prawdziwych danych Premium, branch feat/premium-real-events-stage1 od aktualnego PR18/845d35e (main134c52b, PR19/54c2241 sprawdzone, wcześniejsze PR bez zmian). Grupy B3 rzeczywiste zachowane; Premium otrzymał rzeczywiste mecze/listę/historię/tworzenie/uczestników/zapisy/gości/rezerwę/rezygnację i odwołanie przez istniejące matches_*. Bez kopiowania demo reducera; osobne demo zachowane, błędy bez fikcyjnych danych i diagnostyki SQL. Istniejący formularz i komponenty Premium ponownie wykorzystane, CSS/Ultimate/assets/BottomNav bez zmian. Czyszczenie prywatnego cache przy recheck i ponowny odczyt po nawigacji/zapisie. Backend/RLS/Auth/Storage i44 migracje niezmienione. Nowa lokalna izolacja slm-premium-real-events63321:44 migracje od zera, nowe fikcyjne konta/grupy/mecze zachowane, kandydat Auth nieaktywny i capabilities=false. Testy:319 Vitest/53 pliki, TS/strict Edge/lint/build main+Premium+demo+local-real/source guards PASS;102 SQL v2/RLS/finanse +31 legacy +11 historia PASS. Prawdziwy HTTP/Auth/PostgREST27 PASS (2grupy/4konta/2gości/ostatnie miejsce concurrent/zgody i izolacja, rezerwa bez auto-awansu, cancel i finanse); Chrome2 PASS i2 odczyty potwierdzające realny zapis przez UI.320/360/390px Light/Dark, zmniejszona wysokość/fokus; fikcyjne zrzuty docs/ui/premium-real-events. Bez nowego APK/sync/instalacji/POCO, Cloud, publikacji, DNS, resetów i merge. Poprzednie6 moderate/4SQL warnings pozostają. BLOCKED: konfigurowalne minimum (backend ma10), pełny odczyt adresu/edycja Premium, integracja finansów Premium; oceny/statystyki/składy/push nadal poza zakresem, bez fikcyjnych wyników. Raport/tabela wszystkich ekranów/instrukcje/testy/decyzje:docs/PREMIUM_REAL_DATA_AUDIT.md. Następny krok: osobny Draft PR i odbiór dwóch kont na POCO dopiero po zgodzie na przygotowanie APK, potem istniejące rozliczenia w Premium. Oryginalne6 lokalnych zmian ui-beta i inne worktree zachowane. Chronologia docs/ODPOWIEDZI_CODEX.txt.


2026-10-28 07:58 Europe/Warsaw — Wznowienie etapu1 po limicie automatycznej kontroli uprawnień. Implementacja/testy z27.10 zachowane; nie powtarzano pełnych testów bez zmiany kodu. Końcowy skan493 ścieżek PASS (brak rozpoznawalnych sekretów, nie pełny audyt historii/PII), składnia obu runnerów Node i git diff --check PASS. Potwierdzone logi:319 Vitest/53 pliki,27 prawdziwy HTTP,2 Chrome +2 odczyty trwałości,102 SQL v2/RLS/finanse +31 legacy +11 historia; buildy/TS/lint/source guards/izolacja demo PASS. GitHub ponownie potwierdził PR18 HEAD845d35e i PR19 HEAD54c2241, oba Draft/niescalone, main134c52b bez zmiany. Przygotowano commit/push osobnego feat/premium-real-events-stage1 i zależny Draft PR do feat/account-model-foundation. Brak nowych zmian backendu/Cloud/APK, aktywacji Auth, resetów lub instalacji. Raport docs/PREMIUM_REAL_DATA_AUDIT.md; chronologia docs/ODPOWIEDZI_CODEX.txt.


2026-10-28 07:59 Europe/Warsaw — Zakończenie etapu1: kod d621f730bfbf501fdedac02f0b104427965afc34 wypchnięty na origin/feat/premium-real-events-stage1; utworzony Draft PR20 https://github.com/psuda87/sunday-league-mates/pull/20, baza feat/account-model-foundation845d35e (PR18). GitHub potwierdził open/draft=true/merged=false/mergeable=true. PR18 HEAD845d35e, PR19 HEAD54c2241 i main134c52b niezmienione. Kontrola diff potwierdziła brak zmian app/supabase, Android/Capacitor, globalnego CSS, Ultimate i BottomNav. Worktree zadania czysty po pushem; oryginalne6 zmian ui-beta zachowane. Wyniki automatyczne z27.10:319 Vitest/53 pliki,27 real HTTP,2 Chrome +2 odczyty zapisu,102+31+11SQL,44 migracje i buildy/TS/lint/source guards/izolacja demo PASS;28.10 skan493 ścieżek i składnia runnerów PASS. Rzeczywiste: grupy, członkostwa, lista/tworzenie/szczegóły meczów, zapisy, goście, rezerwa, rezygnacja i odwołanie. Nieprzeniesione: edycja pełnych danych i finanse Premium; składy/oceny/statystyki/push nadal poza etapem i bez fikcyjnych danych w rzeczywistych widokach. Minimalne10 backendu pozostaje jawnie stałe. Fizyczny POCO NOT TESTED; zgodnie z zadaniem bez APK/instalacji/sync/Cloud/publikacji/resetów/merge lub aktywacji nowego Auth. Najmniejszy następny krok: osobno autoryzowany odbiór tego pionu na POCO, potem istniejące rozliczenia w Premium. Pełny audyt/decyzje/instrukcje/zrzuty:docs/PREMIUM_REAL_DATA_AUDIT.md; chronologia docs/ODPOWIEDZI_CODEX.txt.


2026-10-28 17:37 Europe/Warsaw — Lokalny odbiór Premium Finance Stage2, feat/premium-real-finance-stage2 od zdalnego427adce/b46689a, baza PR20/448a296. Istniejący moduł zachowano; dokończono pełny Supabase64321 (slm-premium-real-finance),44 kanoniczne migracje od zera, GoTrue/Edge/PostgREST i nowe fikcyjne konta. PASS:28 rzeczywistych testów HTTP,102 SQL/RLS/finanse (osobna retained fixture/Auth schema fixture),3 Chrome przez prawdziwy backend +2 odczyty końcowego salda/duplikatów,327 Vitest/54 pliki,18 testów celowanych/2 pliki,TypeScript/strictEdge/ESLint/build main+Premium+demo+lokalnyFinance/sourceguards.320/360/390 Light/Dark/fokus/420px przewijanie; zrzuty realnego lokalnego UI wyłącznie fikcyjnych danych docs/ui/premium-finance-stage2/real-backend. Rzeczywisty przepływ: udział+2gości, zatwierdzenie zakończonego meczu, zgłoszenie/częściowa akceptacja/odrzucenie, nadpłata, ręczna wpłata, wyścig decyzji, dwie grupy/obcy admin/REST-RPC, dwie zaległości/odblokowanie i odwołanie z historią. Po rzeczywistej17:00 sprawdzono dwa zastępstwa FIFO i brak auto-awansu, bez zmiany zegara. Zakończenie osobnego własnego fixture symulowano wyłącznie datą nowego rekordu, reszta przepływu real API.
Naprawiono odtworzony błąd: zamknięty ekran Finance nie czyścił niepewnego UUID po logout; obserwator RAM żyje teraz z managerem i czyści mapę także bez ekranu, zachowując retry po chwilowej awarii. Nowy test najpierw FAIL, potemPASS. Runner SQL naprawiony dlaUTF-8 Windows. W teście błędu sieci zachowano rzeczywistą bramkę Auth: brak połączenia ukrywa dane, refresh przed retry, bez wyłączania zabezpieczeń. Backend/RLS/Edge/Auth/44migracje/finansealgorytm i globalCSS/Ultimate/BottomNav/Android bez zmian. Skan511 ścieżek bez rozpoznawalnych sekretów. Nowy Auth i wszystkie capabilities false potwierdzone finalnym HTTP. Dwie własne fixture SQL zatrzymane, kontenery/wolumeny/dane zachowane; wszystkie wcześniejsze bazy/worktree/6notatekui-beta i POCO nietknięte. Bez Cloud/merge/deploy/DNS/APK/sync/instalacji. Ograniczenia: RAM nie przetrwa pełnego restartu, brak bezpiecznych nazw części historycznych płatników, własny wstępny podział i rozbicie na gości nieudostępnione wAPI, P1 i produkcyjnyAuth/online poza zadaniem. Gotowe do osobno zatwierdzonego przygotowania odbioru POCO, nie produkcji. Raport docs/PREMIUM_REAL_FINANCE_STAGE2.md; chronologia docs/ODPOWIEDZI_CODEX.txt. Przygotowano commit/push oraz Draft PR zbase feat/premium-real-events-stage1.


2026-10-28 17:38 Europe/Warsaw — Zakończenie lokalnego Premium Finance Stage2: kod/testy8743d796d8da08bd613f04fd6258b74cbb5ab9c4 wypchnięte do istniejącej feat/premium-real-finance-stage2. Utworzono https://github.com/psuda87/sunday-league-mates/pull/21 jako Draft, base feat/premium-real-events-stage1/448a296; GitHub potwierdził open/draft=true/merged=false/mergeable=true. Wcześniejsza blokada Forbidden z Cloud nie występuje w lokalnym połączeniu API; nie było potrzeby używania gh lub pozyskiwania tokenów. Main134c52b oraz PR18/845d35e,PR19/54c2241,PR20/448a296 niezmienione. Oryginalne6 lokalnych zmian ui-beta zachowane. Wyniki:327 Vitest/54pliki,28 realHTTP,102SQL,3Chrome+2odczyty salda/duplikatów,TS/strictEdge/lint/buildy/izolacja/sourceguards/diff i skan511 PASS. Potwierdzono finalnym HTTP false dla wszystkich capabilities nowego Auth. Dwie własne nowe SQLfixture zatrzymane bez usunięcia danych, lokalny pełny Supabase finansów zachowany. P0 nadaje się do przygotowania osobno zatwierdzonego odbioru POCO; brak APK/sync/instalacji i fizycznego testu IME/tła. Ograniczenia API historycznych płatników/wstępnych danych/rozbicia gości, trwałości RAM po restarcie iP1 nadal jawne; produkcja/Cloud nieodblokowane. Raport docs/PREMIUM_REAL_FINANCE_STAGE2.md; aktualny STATUS i chronologia docs/ODPOWIEDZI_CODEX.txt uzupełnione. Bez merge/deploy/Cloud/resetów/zmian finansowej polityki.


[2026-10-28 17:50:29 Europe/Warsaw] Android Premium Stage3 — test/android-premium-real-stage3, baza PR21 4b7e740, kod c6e224e.
APK debug pl.psuda87.slm GOTOWY, lokalny64321 i osobny namespace sesji. SHA256 b3f2f27b35a89beb72e3155e5bc63de2bf5f36bb20c0d0182276e5b19991ae6d. TypeScript/lint PASS;25 testów/4 pliki PASS;55 frozen UI PASS;Vite/sync/Gradle/podpis/zasoby PASS. Lokalny POST Android origin PASS, obcy403 i capabilities false. ADB c7a559b5 Android12 podłączony; cert zgodny, stary APK zachowany lokalnie. Bez instalacji/reverse/uruchomienia telefonu; fizyczny test/API z telefonu NOT TESTED, oczekuje osobnej zgody. Kanoniczny Edge/SQL/RLS/Auth/UI nietknięte. Bez Cloud/resetów/migracji/deploy/merge. Raport z decyzjami i checklistą: docs/ANDROID_PREMIUM_STAGE3.md. Chronologia: docs/ODPOWIEDZI_CODEX.txt.


[2026-10-28 18:14:07 Europe/Warsaw] P0 Premium UI restore — fix/premium-real-ui-regression, baza PR22 74b1595. Przyczyna: access own/none renderowane zwykłym panelem zamiast MatchHero; MatchSections używał dekoracyjnych koszulek zamiast Teams; label ze stylem całego formularza psuł selektor. Przywrócono MatchHero/EventPrivacy/MatchTabs i wydzieloną oryginalną geometrię PremiumPitch. Realny roster i jawny ręczny RAM preview/zamiany, bez demo World/reducera i serwerowego udawania. Oryginalny plus potwierdzony dla rzeczywistego admina, niewidoczny dla zawodnika zgodnie z rolą. Scoped layout i Stage3 StatusBar overlay:false. TypeScript/lint PASS;24Vitest/4pliki PASS;1Chrome demo reference+2Chrome real backend PASS;320/360/390 Light/Dark PASS;build main/Premium/demo/sync/Gradle/podpis/zasoby PASS. SHA256 APK e2e2b0f630c56a35dc5166a5424ac0f08a4bbdac55791f6a0a8d88fb16f1f251. Nie instalowano nowego APK; fizyczny odbiór/status bar/IME OCZEKUJE osobnej zgody. Kanoniczny backend/Auth/SQL/RLS/Edge/finanse/Ultimate/BottomNav/globalCSS nietknięte. Zrzuty przed/po docs/ui/premium-ui-restore, raport/procedura nowej grupy bez usuwania fixture: docs/PREMIUM_UI_REGRESSION.md. Niezapisane pliki innych worktree zachowane. Odpowiedzi: docs/ODPOWIEDZI_CODEX.txt.


[2026-10-28 18:15:26 Europe/Warsaw] Wynik P0: kod i zrzuty wypchnięte, commit534986ccb6e57c4aad8b09a870542650fd3ddb13. Draft PR23 https://github.com/psuda87/sunday-league-mates/pull/23 zależny od22, bez merge. APK e2e2b0f630c56a35dc5166a5424ac0f08a4bbdac55791f6a0a8d88fb16f1f251 gotowy w .worktrees/premium-ui-regression/app/android/app/build/outputs/apk/debug/app-debug.apk. Przegląd Chrome przed/po i24 testy PASS, native POCO OCZEKUJE. Wymagana osobna zgoda na aktualizację; nowego APK nie zainstalowano. Pełny raport docs/PREMIUM_UI_REGRESSION.md; odpowiedzi docs/ODPOWIEDZI_CODEX.txt.


[2026-10-28 18:19:33 Europe/Warsaw] PR23 — po osobnej zgodzie zaktualizowano POCO c7a559b5 przez adb install-r: Success. Hash APK e2e2b0f630c56a35dc5166a5424ac0f08a4bbdac55791f6a0a8d88fb16f1f251 zgodny. Bez uninstall/clear. Istniejący reverse64321 potwierdzony; curl z telefonu do lokalnego accounts PASS, capabilities nowego Auth wszystkie false. MainActivity COLD Status:ok; ograniczony odczyt logcat procesu:0 dopasowań fatal/WebView-network/uncaughtJS. Fizyczny odbiór wyglądu/status bara/sesji/logowania i boiska OCZEKUJE potwierdzenia użytkownika. Bez zmian backendu/Cloud/danych biznesowych. Odpowiedzi docs/ODPOWIEDZI_CODEX.txt.


[2026-10-28 19:03:51 Europe/Warsaw] Premium behavior restore — fix/premium-real-ui-regression / Draft PR23. Odzyskano interakcję DemoTeams: przykład RAM z realnego rosteru, punktowe zamiany/goście/nieparzyste/poza podziałem/cofnij; bez udawanego serwerowego zapisu/autora. Dodano filtry current/public/my/group/history po stronie SQL przed paginacją i klienta; obce prywatne list/detail odrzucone. Aktywny członek tworzy bez uzyskania finansów/grupowych ról; aktywacja frontu wymaga nowego kontraktu serwera. Sticky tylko mały tytuł/akcje, bez dużego logo, bez zmian Ultimate/profilu/nav. Nowe3 migracje+allowlista scope/period przetestowane TYLKO w nowej izolacji slm-premium-behavior-review65321/47migracji. Używany POCO64321 nadal44migracje, bez zmiany kont/fixture/Cloud/aktywacji Auth. TS/strictEdge/lint/build main-Premium-demo/frozenUI PASS;30Vitest/5plików,29realHTTP,SQL-RLS-ACL,3Chrome320/360/390Light-Dark PASS;4 stare SQL warnings/0errors. Nowy APK/native odbiór NOT TESTED, brak instalacji/sync. Trwałe składy i CAS tylko projekt docs/PREMIUM_LINEUP_BACKEND_PLAN.md — następny osobny etap. Raport/ograniczenia/nowe zrzuty dopisane do docs/PREMIUM_UI_REGRESSION.md. Odpowiedzi docs/ODPOWIEDZI_CODEX.txt.


[2026-10-28 22:01:09 Europe/Warsaw] Decyzja właściciela: wyłącznie aktualny aktywny administrator grupy zarządza finansami; created_by/organizer/global legacy role nie nadają uprawnień. Nowa migracja20261028181054 i niewizualne availability/cache usePremiumFinance; bez zmian Premium ekranów/CSS/nav. Realny audyt RPC/RLS +48HTTP PASS (twórca-organizator denied, admin approve/corrections, transfer roli tym samym JWT, RLS, outsider/inactive, brak replay po revocation).32Vitest/5plików,SQL admin/legacy/ACL i visibility,RLS PASS;TS/strictEdge/lint/build main-Premium/consolidation/frozen55 PASS;4 stare SQL warnings/0errors. Tylko izolacja65321 ma48migracji; POCO64321 nadal44 i Cloud nietknięte. Bez nowego APK/instalacji/merge/deploy używanego projektu. Raport docs/PREMIUM_UI_REGRESSION.md; zasady AGENTS.md; odpowiedzi docs/ODPOWIEDZI_CODEX.txt.

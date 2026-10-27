# Audyt bezpieczeństwa — przygotowanie kontrolowanego startu

2026-10-27 19:10 Europe/Warsaw. Baza: PR18 `5de91d3`, main `134c52b`. **NO-GO dla publikacji/aktywacji Cloud.** Audyt i testy lokalne Windows/Docker, nie audyt działającego Supabase Cloud. Brak deploy/merge/resetów istniejących baz. Infrastruktura bramki/hostingu jest wydzielana do osobnego zależnego Draft PR; backend Auth pozostaje w PR18.

## Zakres i dowody

- Nowy projekt lokalny **slm-online-readiness /62321**,44 migracje od zera. Przed fixture:0 kont Auth,0 rekordów biznesowych/demonstracyjnych we wszystkich52 tabelach SLM (wyjątek: singleton konfiguracji),0 obiektów Storage; prywatny bucket slm-profile-photos. Kopia/restore do nowej scratch bazy:14 PASS, w tym ACL/RLS i nieaktywne Auth. Istniejące bazy, konta, notatki, PR14/15/17 i dane POCO pozostawiono.
- Katalog:109 funkcji aplikacji,19 SECURITY DEFINER; każda z jawnym search_path. Żadna publiczna funkcja SLM nie ma anon EXECUTE. RLS wszystkich52 publicznych tabel SLM włączone, anon bez praw do tabel. Katalog nie zastępuje testu uprawnień; poniżej wykonano rzeczywiste odmowy REST/RPC.
- SQL v2 **102 PASS**: grupy A/B, globalny admin kont vs administrator/organizator grupy, prywatne projekcje, zgody/revocation, goście, miejsca/rezerwa, wyścig o limit, FIFO, celowe wpłaty, nadwyżki i izolacja finansów, blokada zadłużenia, idempotencja, rollback i historia.
- SQL legacy **31 PASS**; migracja z fikcyjną starą historią **11 PASS**, wszystkie44 kroki, oryginalny ledger/aliasy zachowane. SQL/RLS profilu/Auth/admissions **96 PASS** na jednorazowym PostgreSQL (Auth/Storage tego zestawu fixture).
- Rzeczywisty Supabase HTTP: **49 core+21 dodatkowych** (7 recovery/7 resume/4 UUID/3 admin privacy). Hasła i JWT obsługuje prawdziwy Auth, zapisy przez Edge/PostgREST, nie same fixture.
- SMTP/Mailpit **29 PASS +9 awarie/wyścigi**,3 callbacki rzeczywiście wykorzystane w Chrome, gotowy build z CSP. Nie jest to dowód internetowej dostarczalności.
- Chronione API **29 PASS**: unsigned/direct Edge, fałszywy podpis IP, brak/niepoprawny challenge/cdata, niezmieniona liczba kont po odmowie, retry capability, równoległe5 slotów/6 żądań, inny podmiot nadal rejestruje, próby fałszowania roli/zaproszenia/miejsca/finansów, obcy profil/zdjęcie/REST/RPC, faktyczny upload/read prywatnego Storage, bezpośrednie signup GoTrue zablokowane, poczta20/dobę na sieć i brak blokady innych sieci. Dostawca Turnstile w tym teście to **jawny lokalny fixture**, nie dowód oceny człowieka przez Cloudflare.
- Rzeczywiste publiczne API testowe Cloudflare: **3 PASS** (pass/fail/spent). Wyłącznie opublikowane dummy credentials, odrzucane przez konfigurację online; produkcyjny widget/natywny WebView NOT TESTED.
- Pełne drzewo Auth+infrastruktura: **312 Vitest /53 pliki PASS**, TypeScript aplikacji i strict całego Edge/gateway PASS, lint PASS. Build main/Premium/demo PASS; izolacja demo16 artefaktów PASS; gotowy statyczny callback i nieaktywny kandydat online zbudowane. Wydzielone snapshoty PR są sprawdzane osobno przed pushem.
- Browser UI:18 profile layout +2 static host PASS,320/360/390 Light/Dark, fokus i mniejsza wysokość. Real Chrome/CDP poza proxy Cypress:4 PASS, faktyczne nagłówki/no-referrer/strip fragment i zablokowanie wstrzykniętego inline JS. HTTPS hosting/realny telefon NOT TESTED.

Runnery i odtworzenie: app/scripts/test-cloud-preflight-local.py, audit-online-local.py, test-account-model-sql-local.mjs, test-v2-local.py/test-backend-local.py/test-migrations-local.py z SLM_SECURITY_READINESS=1, poprzednie HTTP z SLM_ONLINE_LOCAL=1, test-online-auth-http-local.mjs. Wszystkie są ograniczone do nowej lokalnej izolacji. Nie czyścić baz ani liczników dla uzyskania PASS; testowy cutover wykonywać tylko raz na pustej instancji. Po testach jawnie wyłączyć active, zachować fikcyjne rekordy.

## Znalezione problemy i poprawki

| Problem | Zmiana / granica |
|---|---|
| Wspólny limit signup30/dobę mógł blokować wszystkich po wyczerpaniu przez jednego klienta | Wyłącznie w nowym trybie online: obligatoryjny serwerowy Turnstile (hostname/action/cdata/TTL/idempotencja), podpisane wejście i transakcyjny przydział5/10min,20/dobę na podmiot. Retry tego samego capability liczone raz. Stare ograniczenia pozostają w lokalnym/legacy wariancie; nie wyłączono ich dla zielonych testów |
| Same XFF/CF nagłówki w Edge nie mają wystarczającego kontraktu zaufania | Nowy tryb wymaga własnej bramki z HMAC, timestamp30s, wiązaniem JSON i Authorization. Bezpośredni Edge odmawia. Bramka pobiera IP tylko z rzeczywistego kontekstu Cloudflare, nadpisuje nagłówki klienta. Nie wolno jej stawiać jako zwykłego serwera ufającego CF-Connecting-IP |
| Rotacja IPv6 / jeden globalny budżet poczty | Podmiot jest dziennym HMAC sieci (IPv6 /64, IPv4 adres), brak surowego IP w SQL. Poczta20/dobę/sieć, zmiana adresu dodatkowo10/dobę/konto, dotychczasowe cooldowny i limity adresu/linku zachowane. Jeden podmiot nie blokuje wszystkich |
| Niekompletny SMTP mógł wywołać błąd inicjalizacji całego worker’a | Czysta walidacja hosta/portu/TLS/credentials/adresu/callbacku; brak/nieprawidłowa konfiguracja zwraca tryb wyłączony. Zdalny transport bez plaintext, TLS>=1.2 i sprawdzanie certyfikatu. Brak fallbacku z TLS do plaintext |
| Ten sam historyczny klucz sesji był używany dla dowolnego przyszłego projektu | Fabryka magazynu per projectRef. Dawne klucze pozostają identyczne, nie są czytane/usuwane przez nowy projekt. Na urządzeniu nadal tylko SecureStorage/Keystore/Keychain, bez fallbacku. Stały wspólny prefiks pluginu plus różne klucze eliminuje wyścig globalnego setKeyPrefix |
|3 błędy strict WebP | Jawny wspólny typ Dimensions dla image/extended zamiast typeof zmiennej zawężonej do null. Brak zmiany walidacji rozmiaru/formatu, testy zdjęć i rzeczywistego Storage PASS |
| Błędne kodowanie polskich wiadomości e-mail | Przywrócono UTF-8 w nowym emailFlows i poprzednim raporcie, bez zmiany historycznych faktów. Test sprawdza poprawny polski temat |
| Znane zgłoszenia zależności narzędzi | Vitest4.1.12 oraz transytywne qs6.16.1 (patch tej samej linii) przypięte w lock/override; bez force fix/major refaktoringu routera |

Nie znaleziono potwierdzonego obejścia RLS/roli/finansów w wykonanych scenariuszach. To ograniczony audyt kodu/katalogu i testy regresyjne, nie gwarancja braku innych podatności ani zewnętrzny pentest.

## Dane, prywatność i tożsamość

UUID, primary GoTrue, telefony, członkostwa, zgody i ledger nie są migrowane przez tę poprawkę. Opcjonalny email_login dopiero po proof; nickname/login transakcyjny po obecnym haśle. Klient nie przekazuje właściciela operacji Auth. Publiczne DTO nie otrzymują e-maila technicznego lub haseł. Metadane użytkownika nie nadają roli admina. Globalny admin służy zarządzaniu kontami, nie przejmuje finansów cudzych grup.

Nowa slm_signup_admissions: wyłącznie UUID żądania, hash losowego capability i dzienny HMAC podmiotu, retencja48h. Nie przechowuje hasła/hashu hasła ani raw IP. slm_auth_metrics: zagregowane godzinowe liczniki przyjęć/odmów, retencja7 dni. Liczniki są prywatne, aktualizowane service_role. Pseudonimizacja nie jest anonimizacją w rozumieniu prawa; potrzebne zatwierdzone privacy/retencja/podmioty przetwarzające. Supabase/Cloudflare/Brevo mogą mieć własne logi — nie obiecujemy ich nieistnienia. Śledzenie linków i logowanie treści należy wyłączyć przed GO.

## Pozostałe ryzyka — NIE zielony audit

- Ostatni npm audit: **6 moderate,0 high/critical**, w tym **3 runtime** (react-router/react-router-dom/@ionic/react-router); pozostałe uuid/xcode/@capacitor/cli w narzędziach. npm audit nadal zwraca kod niezerowy. Własny kod nie używa SSR hydration ani Link/useNavigate z danymi użytkownika; nie jest to dowód braku exploitu w zależnościach. Zmiana major routera koliduje ze stosem Ionic; wymaga osobnego kompatybilnego upgrade i regresji, nie force fix. Publiczne wydanie wymaga rozwiązania lub jawnego odbioru ryzyka ograniczonego pilota.
-4 stare SQL lint: slm_push_claim literal text→jsonb (rzeczywisty wynik array sprawdzony w rollback), slm_email_profile_save nieużywany p_number (numer ma osobny istniejący RPC), group_finance_dispatch_core nieużywane v_before/v_rows. Brak błędów lint/nowych ostrzeżeń. Nie zmieniano finansów lub uprawnień dla kosmetyki; te ostrzeżenia same nie blokują testowego schematu.
- Rozproszony botnet i wyczerpanie darmowych kwot nadal możliwe. HMAC/Turnstile/limity nie są gwarancją dostępności Free ani ochroną DDoS. NAT może łączyć legalnych użytkowników;5/10min i20/dobę trzeba odebrać dla pilota. Własne inne Workery w tej samej strefie należą do granicy zaufania; nie udostępniać im klucza ani prawa do podmiany IP. Cross-zone Worker requests mogą współdzielić adres Cloudflare.
- Captcha/SMTP/HTTPS/Android z prawdziwymi konfiguracjami nieodebrane. Model nadal nieaktywny poza jawnymi testami nowej izolacji. Przerwany reset fail-closed może wymagać właściciela po10min; nie ma bezpiecznej obietnicy recovery dla kont bez e-maila bez operatora/admina.
- Oceny/składy Premium/statystyki nie są implementowanym nowym modułem backendu. Odrzucono fikcyjne żądanie ratings_submit; nie jest to test istniejącego serwera ocen. Premium nadal ma jawne dane demo poza zintegrowanym zakresem. Kandydat Auth nie jest pełnym wydaniem SLM1.0.
- Legal wymaga zatwierdzenia administratora danych, podstaw prawnych, regulaminu i polityki. Istniejący checkbox UI nie stanowi serwerowego, wersjonowanego dowodu przyjęcia niezatwierdzonych dokumentów; tego nie dodawano prowizorycznie.
- Skan obecnego drzewa494 ścieżek: bez rozpoznawalnych prywatnych kluczy/literalnych service JWT/PAT/secret keys i śledzonych env. Nie wypisuje wartości. Nie jest kompletnym audytem historii Git lub wszystkich danych osobowych. Ignorowane cache/backupy/klucze testów nie trafiają do Git.

## Decyzje podjęte samodzielnie

| Problem | Wybór i uzasadnienie | Konsekwencje |
|---|---|---|
| Zaufane IP za proxy | Podpisana własna bramka zamiast zgadywania nagłówka Supabase | Dodatkowy mały komponent Free, osobny PR/odbiór; direct Edge zamknięty w nowym trybie |
| Zasoby Free i rejestracja | Turnstile + przydział per podmiot/capability, agregaty bez raw IP | Brak jednego limitu30 dla wszystkich w chronionej ścieżce, lecz brak gwarancji przeciw botnetowi/NAT false positives |
| Istniejąca sesja po nowym Cloud | Różne klucze magazynu, stary domyślny bez migracji/usuwania | Świeże logowanie do nowego projektu, zachowana poprzednia sesja do ewentualnego powrotu |
| WebP/SQL/dependencies | Minimalna poprawka typu i patch narzędzi; bez kosmetycznej zmiany finansów/major routera | Wzrost pewności testów, jawne pozostawione moderate/ostrzeżenia |
| Wydzielenie hostingu | Zależny Draft PR infrastruktury, PR18 tylko Auth/bezpieczeństwo | Kolejność review/merge wymaga decyzji właściciela; brak deploy/płatnych usług |

Źródła sprawdzone27.10.2026: [Supabase security](https://supabase.com/docs/guides/api/securing-your-api), [Cloudflare headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/), [Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [publiczne testy](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), [qs advisory](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw), [router redirect](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [router SSR](https://github.com/advisories/GHSA-337j-9hxr-rhxg), [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Raport chronologiczny: docs/ODPOWIEDZI_CODEX.txt.

2026-10-27 19:35 Europe/Warsaw — Zamknięcie przygotowania: sam commit Auth `845d35e` wyeksportowany bez infrastruktury:309 Vitest/52 pliki, TS/strict Edge/lint/main+Premium+demo/source guards PASS. Łącznie312 Vitest/53 pliki ponownie PASS. Dodatkowe29 SMTP/HTTP i3 callbacki przez podpisaną lokalną bramkę PASS (CF runtime i provider CAPTCHA fixture, nie dowód produkcji). Nowa izolacja62321 po testach:SQL active=false; account_model/self_registration/email_verification/email_recovery=false odczytane przez podpisane HTTP; dane zachowane. [PR18](https://github.com/psuda87/sunday-league-mates/pull/18) Auth i zależny [PR19](https://github.com/psuda87/sunday-league-mates/pull/19) infrastruktury są Draft, bez merge; oba zweryfikowano bez konfliktów. GO/NO-GO i cutover w ONLINE_READINESS.md/CLOUD_CUTOVER_PLAN.md. Żadne ograniczenia SMTP/widget/telefon/legal/dependencies nie zostały uznane za zaliczone przez same fixture.

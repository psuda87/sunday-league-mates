# Opcjonalny e-mail, callbacki i recovery — lokalny odbiór

2026-10-27 08:22 Europe/Warsaw. `feat/account-model-foundation`, od `33e95b3`, Draft [PR18](https://github.com/psuda87/sunday-league-mates/pull/18). **Nowy Auth pozostaje nieaktywny w działającej aplikacji.** Bez Cloud/deploy/merge/resetów baz. Dawne worktree, notatki i POCO zachowane.

## Zaimplementowane i potwierdzone lokalnie

- Rejestracja nickname+hasło nadal bez obowiązkowego e-maila. Opcjonalny adres przy rejestracji lub Profil → Edytuj profil. Zmiana/dodanie w profilu wymaga obecnego hasła. Serwer nie przyjmuje cudzego UUID ani redirect_to; adres jest walidowany jako pojedynczy bare address, bez list odbiorców i wstrzykiwania nagłówków. Enter w polach e-mail nie zapisuje pozostałych danych profilu.
- Adres staje się loginem dopiero po rzeczywistym potwierdzeniu linku. Podczas zmiany stary działa do potwierdzenia nowego. Kolizja, wygaśnięcie lub błąd zachowuje poprzedni login/UUID/sesję. Globalny UNIQUE i rollback przy konkurujących potwierdzeniach.
- Osobny entrypoint `b1/email-callback.html`: losowy token256 bitów w fragmencie, odczyt jednorazowy i usunięcie z URL przed renderowaniem/żądaniem. Bez query-tokenów, otwartych redirectów, localStorage i automatycznego logowania. Wymagane świadome kliknięcie. Gotowy build ma CSP, no-referrer i noindex, bez zewnętrznych skryptów.
- Resend/cooldown60 s, prywatny status queued/sent/failed, TTL30 min verify/15 min recovery, anulowanie wcześniejszych linków i retry. SQL zawiera tylko SHA256 losowego tokenu, nigdy hasło ani surowy bearer. Tabela i RPC niedostępne dla anon/authenticated.
- Recovery wysyła wyłącznie na potwierdzony email_login; odpowiedź dla znanego/nieznanego adresu jest identyczna, limity i minimalny czas ograniczają enumerację. Reset zmienia hasło przez Supabase Auth, odrzuca stare hasło/chronione JWT/refresh, wymaga ponownego logowania.
- Lease180 s blokuje równoczesnych writerów i pozwala wznowić operację po wygaśnięciu workera. Auth i SQL nie mają wspólnej transakcji: nieznany wynik pozostaje fail-closed. Definitywne odrzucenie Auth zwalnia lease. Jeśli link wygaśnie podczas przerwanej operacji, pozostaje istniejąca naprawa właściciela service_role po10 min i reset administracyjny, nie publiczne obejście.
- Zachowany reset przez globalnego administratora kont (nie admina grupy), potwierdzenie tożsamości/hasła, tymczasowe12 znaków i wymuszona zmiana. Reset unieważnia wcześniejszy link recovery. Konta bez e-maila nadal korzystają z tej ścieżki.
- CSS, Ultimate, motywy, nawigacja, UUID, telefony, członkostwo, finanse i zgody PR16 bez zmian. Nowy warunkowy panel używa istniejących stylów. Do allowlisty demo dodano wyłącznie jego prezentację bez importów Auth/HTTP; izolację artefaktów sprawdzono.

## Dlaczego scoped proof zamiast zmiany primary GoTrue

Wewnętrzny primary email Auth pozostaje stabilny. Natywne updateUser(email)/recovery odnoszą się do primary; użycie ich do aliasu wymagałoby innego modelu i nieatomowej wymiany identyfikatora. Link aplikacji ma wąski zakres verify/recovery, UUID, poprzedni adres i security_version. Dopiero potwierdzenie zmienia **email_login**, nigdy auth.users.email. Nie potwierdzamy administracyjnie adresu użytkownika i nie wydajemy sesji za samo otwarcie URL. Hasła/JWT/weryfikacja pozostają w Supabase Auth. Potwierdzenie aliasu nie jest zmianą flagi potwierdzenia primary w GoTrue.

## Faktyczne testy

| Kontrola | Wynik / granica dowodu |
|---|---|
| TypeScript aplikacji, ESLint |PASS|
| Dodatkowy strict nowych emailFlows/emailSmtp |PASS|
| Dodatkowy strict całego Edge |3 zastane błędy w niezmienionym `_shared/webp.ts`:19,37; NIE PASS tego dodatkowego sprawdzenia|
| Vitest |280 PASS /48 plików (264 wcześniejsze+16 nowych)|
| SQL/RLS |88 PASS, replay43 migracji, nowy jednorazowy PostgreSQL; Auth/Storage w tym zestawie fixture|
| Supabase od pustej bazy |49 PASS Auth/Edge/PostgREST/profil/grupy/zgody/rename/reset legacy i e-mail; nowy slm-email-regression/61321, poczta celowo wyłączona|
| Dodatkowe real HTTP Auth |7 owner recovery+7 signup resume+4 UUID/reuse+3 admin privacy =21 PASS na nowej instancji|
| SMTP/HTTP/browser |29 PASS; Edge → prawdziwy SMTP → Mailpit →3 callbacki Chrome (verify/expired reset/reset). Końcowy przebieg na gotowym buildzie z CSP|
| Realne awarie/współbieżność |9 PASS: pauza tylko testowego Mailpit, timeout/failed/resend, dwa resety/jeden writer, przerwanie/lease/retry, administracyjne unieważnienie linku|
| Browser layout |18 Chrome PASS (12 wcześniejszych+6 email),320/360/390 ×Light/Dark, fokus/przewijanie/viewport844 i380; fikcyjny binding, nie fizyczna klawiatura|
| Buildy |main/Premium/demo/email-local PASS, demo isolation PASS; odziedziczone ostrzeżenia chunków/assetów bez błędu|
| Source guards |PASS:32 historyczne migracje main i chroniony runtime;43 wersje;55 plików Premium z jawnym wyjątkiem pól kandydata; CSS/karta/nav bez zmian|
| db lint |exit0,4 stare ostrzeżenia slm_push_claim/slm_email_profile_save/group_finance_dispatch_core, brak nowych|
| Internet SMTP / fizyczny Android |NOT TESTED; APK/ADB/tunel i działająca aplikacja nietknięte|

Robocze błędy naprawiono: Node DNS w Edge nie rozwiązywał nazwy Dockera (lokalny helper odczytuje IP sprawdzonego własnego Mailpit), ścieżka dev entrypointu, API Cypress16 i helpery testów. Jeden test recovery próbował postarzyć nowy UUID w starej bazie: UPDATE0, brak zmiany danych; poprawiono kontener, końcowe7 PASS na nowej instancji. Wiek/lease symulowano tylko dla nowych fikcyjnych rekordów. Nie wykonano fizycznego przerwania TCP Auth. Przechwycenie Mailpit **nie dowodzi dostarczenia w internecie**.

Zrzuty fikcyjnego profilu, fokus przy wysokości380 px: [Light](ui/account-email/profile-light.png), [Dark](ui/account-email/profile-dark.png). Telefon/GitHub: [Light](https://github.com/psuda87/sunday-league-mates/blob/feat/account-model-foundation/docs/ui/account-email/profile-light.png), [Dark](https://github.com/psuda87/sunday-league-mates/blob/feat/account-model-foundation/docs/ui/account-email/profile-dark.png). Bez haseł i tokenów.

## Migracja / odtworzenie wyłącznie lokalne

Nowa `20261027063829_account_email_callbacks.sql`; poprzednie42 bez edycji. Nowe projekty: slm-account-mail (60321/60322/Mailpit60324) i slm-email-regression (61321/61322). Po testach SQL active=false i API wszystkie account_capabilities=false w obu; konta i wiadomości zachowane. Wcześniejszych baz i Cloud nie migrowano.

1. Z repo: `python app/scripts/prepare-account-email-local.py`, potem start CLI2.121.0 w `.cache/account-email-stack` (nie wykluczać Mailpit): `supabase start --workdir .cache/account-email-stack --exclude studio,imgproxy,logflare,vector,realtime,postgres-meta,supavisor`. Tylko nowa instancja, bez resetu.
2. Ponowić helper po starcie (odczyt IP własnego Mailpit), `python app/scripts/prepare-account-email-local.py --auth-baseline`, `supabase functions serve accounts --workdir .cache/account-email-stack`. Bazowa ochrona Auth jest egzekwowana; poprzedni kontener zachowany.
3. W app: `npx vite build --config vite.email-local.config.ts`, preview tego configu na5182. Lokalny SMTP dopuszcza tylko własny host i odbiorców `.test`; IP i wyjątek bez TLS są ograniczone do tej izolacji.
4. Runnery z repo: `node app/scripts/test-account-email-http-local.mjs` (jawne prepare tylko testowej instancji), następnie `node app/scripts/test-account-email-failures-local.mjs` (pause/unpause testowego Mailpit w try/finally). Nie uruchamiać na bazie aplikacji; po testach wyłączyć active. Nie czyścić danych/podnosić limitów, aby ponowić PASS.
5. Regresja od zera: helper modelu `--email-regression`, start/serve `.cache/account-email-regression`, auth-baseline z tym samym przełącznikiem. Runner HTTP i dodatkowe recovery/resume/uuid/admin-privacy wybierają tę instancję przez `SLM_ACCOUNT_EMAIL_REGRESSION=1`. Pierwszy wymaga pustej nowej bazy; odmawia zamiast resetu.

## Rzeczywisty SMTP i blokery Cloud

Przykład `app/supabase/email.smtp.env.example`: tylko serwer, bez sekretów, domyślnie wyłączony. Nodemailer10.2.1 przypięty; niezależne node_modules tego worktree nie zmieniają środowiska root. Nie wybrano usługodawcy/płatnego planu. Docelowo465/TLS lub dopuszczony STARTTLS, weryfikacja certyfikatu obowiązkowa.25/587 nie używać w Edge.

Przed startem potrzebne: zatwierdzony darmowy limit/usługodawca i sekrety poza Git; domena nadawcy/SPF-DKIM-DMARC; dokładny HTTPS callback, hosting/CSP/Referrer-Policy/frame-ancestors, originy i konfiguracja klienta; odbiór rzeczywistej dostarczalności/linków w docelowych klientach (bez link trackingu zmieniającego bearer); mapa konfliktów kont, legal/anti-bot i skoordynowany cutover. Operacje Cloud i aktywacja wymagają osobnej decyzji.

GoTrue Site URL/Redirect URLs nie zmieniono: scoped callback wybiera tylko SLM_EMAIL_CALLBACK_URL. Przyszłe natywne przepływy wymagają osobnej dokładnej allowlisty, bez wildcardów produkcyjnych. Konfiguracja SMTP w Dashboard Auth nie konfiguruje automatycznie transportu tej warstwy aliasów.

Sprawdzone źródła: [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [password/recovery](https://supabase.com/docs/guides/auth/passwords), [SMTP Edge — oficjalny przykład](https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/send-email-smtp/README.md), [Nodemailer](https://nodemailer.com/smtp). Indeks changelog.md odrzucony przez narzędzie web ze względu na text/markdown; sprawdzono dokumentację tematyczną. Wbudowany SMTP Supabase nie jest gwarantowaną darmową wysyłką produkcyjną.

## Decyzje podjęte samodzielnie

| Problem | Rozwiązanie i uzasadnienie | Konsekwencje |
|---|---|---|
| Opcjonalny adres nie jest stabilnym primary Auth | Wąski aplikacyjny proof aliasu, bez zmiany primary i bez natywnego tokenu logowania; hasła nadal wyłącznie Supabase Auth | Brak zmiany UUID/sesji przy potwierdzeniu. SMTP tej warstwy konfiguruje się osobno od Dashboard Auth; nie udajemy natywnego email-change GoTrue |
| Bezpieczny powrót z wiadomości / skanery linków | Osobny entrypoint, token we fragmencie usuwany przed renderem, jawne kliknięcie, ścisły payload i CSP | Sam podgląd wiadomości/otwarcie URL nie wykonuje operacji; brak automatycznego zalogowania. Docelowy hosting/HTTPS i test na telefonie pozostają do przygotowania |
| Biblioteka i test SMTP bez usługi płatnej | Przypięty Nodemailer10.2.1 tylko na serwerze, istniejący lokalny Mailpit; niezależne node_modules worktree. Walidacja pojedynczego adresu, obiekt odbiorcy zamiast interpretowania listy | Powtarzalna prawdziwa wysyłka lokalna, bez zewnętrznego konta/billingu. Port465/TLS przygotowany; dostarczalność internetowa niepotwierdzona |
| Node DNS nie rozwiązuje lokalnej nazwy Dockera | Helper odczytuje IP tylko sprawdzonego testowego kontenera; wyjątek działa wyłącznie przy jawnym local-test na lokalnym backendzie | Bez wyłączania TLS/weryfikacji certyfikatu dla zdalnego SMTP; po odtworzeniu kontenera trzeba ponowić helper |
| Atomowość nie obejmuje jednocześnie Auth i SQL | Prywatna lease180 s, security_version, anulowanie sesji/linków, retry bez równoczesnego zapisu; nieznany wynik fail-closed | Po przerwaniu może być konieczne ponowienie, a po wygaśnięciu linku istniejąca bezpieczna naprawa właściciela/admina. Nie zwracamy fikcyjnego sukcesu |
| Regresja bez utraty dotychczasowych danych | Dwa nowe projekty lokalne, stare bazy/APK/tunel bez przełączenia, po testach aktywacje wyłączone | Dowód backendu i callbacku jest rzeczywisty, ale nie stanowi odbioru internetowego SMTP ani fizycznego POCO |
| Zastane błędy strict WebP poza zakresem | Nie zmieniano parsera zdjęć tylko dla zielonego wyniku; osobno sprawdzono nowe moduły i wskazano3 błędy | Dodatkowy strict całego Edge pozostaje ograniczeniem; nie deklarujemy jego PASS. Dotychczasowe zdjęcia/limity nie zostały zmienione |

## POCO

Lokalne backend/callback są podstawą do osobnego przygotowania kontrolowanego testu. Nie budowano/instalowano APK ani nie testowano fizycznie. Kandydat nadal wyłączony, istniejące logowanie nieprzełączone.127.0.0.1:5182 w przeglądarce telefonu wymaga odrębnego tunelu/hostingu; sam tunel backendu nie wystarczy. Brak gotowości do aktywacji internetowego recovery/Cloud.

Przyszły odbiór: signup bez e-maila → dodanie adresu → odmowa przed linkiem → wiadomość/callback → login do tego samego profilu → zmiana adresu → expired/resend → recovery i odrzucenie starego hasła/sesji → reset administratora bez e-maila → restart/Light/Dark/Wstecz. Wklejać PASS/FAIL i komunikat, bez haseł/tokenów/linków.

Raport chronologiczny: `docs/ODPOWIEDZI_CODEX.txt`. PR18 Draft, bez merge/deploy.

2026-10-27 17:56 Europe/Warsaw — Kod **9ab903f331bf1785fc9f2c5cc0fa6a037466d423** wypchnięty; PR18 open/Draft/mergeable, bez merge. Obie nowe aktywacje wyłączone i odczytane SQL+HTTP. Końcowy raport i decyzje zapisane w docs/ODPOWIEDZI_CODEX.txt.

2026-10-27 19:10 Europe/Warsaw — Aktualizacja przygotowania online:44 migracje; stricty WebP naprawione, walidacja SMTP fail-closed, wyłączony domyślnie chroniony online mode i osobne klucze sesji nowego projektu. Poprzednie wyniki są historyczne, aktualny audyt i granice: [SECURITY_AUDIT.md](SECURITY_AUDIT.md). Bez Cloud/aktywacji/merge.

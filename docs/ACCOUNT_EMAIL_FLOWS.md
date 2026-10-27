# Opcjonalny e-mail, callbacki i recovery â€” lokalny odbiÃ³r

2026-10-27 08:22 Europe/Warsaw. `feat/account-model-foundation`, od `33e95b3`, Draft [PR18](https://github.com/psuda87/sunday-league-mates/pull/18). **Nowy Auth pozostaje nieaktywny w dziaÅ‚ajÄ…cej aplikacji.** Bez Cloud/deploy/merge/resetÃ³w baz. Dawne worktree, notatki i POCO zachowane.

## Zaimplementowane i potwierdzone lokalnie

- Rejestracja nickname+hasÅ‚o nadal bez obowiÄ…zkowego e-maila. Opcjonalny adres przy rejestracji lub Profil â†’ Edytuj profil. Zmiana/dodanie w profilu wymaga obecnego hasÅ‚a. Serwer nie przyjmuje cudzego UUID ani redirect_to; adres jest walidowany jako pojedynczy bare address, bez list odbiorców i wstrzykiwania nagłówków. Enter w polach e-mail nie zapisuje pozostaÅ‚ych danych profilu.
- Adres staje siÄ™ loginem dopiero po rzeczywistym potwierdzeniu linku. Podczas zmiany stary dziaÅ‚a do potwierdzenia nowego. Kolizja, wygaÅ›niÄ™cie lub bÅ‚Ä…d zachowuje poprzedni login/UUID/sesjÄ™. Globalny UNIQUE i rollback przy konkurujÄ…cych potwierdzeniach.
- Osobny entrypoint `b1/email-callback.html`: losowy token256 bitÃ³w w fragmencie, odczyt jednorazowy i usuniÄ™cie z URL przed renderowaniem/Å¼Ä…daniem. Bez query-tokenÃ³w, otwartych redirectÃ³w, localStorage i automatycznego logowania. Wymagane Å›wiadome klikniÄ™cie. Gotowy build ma CSP, no-referrer i noindex, bez zewnÄ™trznych skryptÃ³w.
- Resend/cooldown60 s, prywatny status queued/sent/failed, TTL30 min verify/15 min recovery, anulowanie wczeÅ›niejszych linkÃ³w i retry. SQL zawiera tylko SHA256 losowego tokenu, nigdy hasÅ‚o ani surowy bearer. Tabela i RPC niedostÄ™pne dla anon/authenticated.
- Recovery wysyÅ‚a wyÅ‚Ä…cznie na potwierdzony email_login; odpowiedÅº dla znanego/nieznanego adresu jest identyczna, limity i minimalny czas ograniczajÄ… enumeracjÄ™. Reset zmienia hasÅ‚o przez Supabase Auth, odrzuca stare hasÅ‚o/chronione JWT/refresh, wymaga ponownego logowania.
- Lease180 s blokuje rÃ³wnoczesnych writerÃ³w i pozwala wznowiÄ‡ operacjÄ™ po wygaÅ›niÄ™ciu workera. Auth i SQL nie majÄ… wspÃ³lnej transakcji: nieznany wynik pozostaje fail-closed. Definitywne odrzucenie Auth zwalnia lease. JeÅ›li link wygaÅ›nie podczas przerwanej operacji, pozostaje istniejÄ…ca naprawa wÅ‚aÅ›ciciela service_role po10 min i reset administracyjny, nie publiczne obejÅ›cie.
- Zachowany reset przez globalnego administratora kont (nie admina grupy), potwierdzenie toÅ¼samoÅ›ci/hasÅ‚a, tymczasowe12 znakÃ³w i wymuszona zmiana. Reset uniewaÅ¼nia wczeÅ›niejszy link recovery. Konta bez e-maila nadal korzystajÄ… z tej Å›cieÅ¼ki.
- CSS, Ultimate, motywy, nawigacja, UUID, telefony, czÅ‚onkostwo, finanse i zgody PR16 bez zmian. Nowy warunkowy panel uÅ¼ywa istniejÄ…cych stylÃ³w. Do allowlisty demo dodano wyÅ‚Ä…cznie jego prezentacjÄ™ bez importÃ³w Auth/HTTP; izolacjÄ™ artefaktÃ³w sprawdzono.

## Dlaczego scoped proof zamiast zmiany primary GoTrue

WewnÄ™trzny primary email Auth pozostaje stabilny. Natywne updateUser(email)/recovery odnoszÄ… siÄ™ do primary; uÅ¼ycie ich do aliasu wymagaÅ‚oby innego modelu i nieatomowej wymiany identyfikatora. Link aplikacji ma wÄ…ski zakres verify/recovery, UUID, poprzedni adres i security_version. Dopiero potwierdzenie zmienia **email_login**, nigdy auth.users.email. Nie potwierdzamy administracyjnie adresu uÅ¼ytkownika i nie wydajemy sesji za samo otwarcie URL. HasÅ‚a/JWT/weryfikacja pozostajÄ… w Supabase Auth. Potwierdzenie aliasu nie jest zmianÄ… flagi potwierdzenia primary w GoTrue.

## Faktyczne testy

| Kontrola | Wynik / granica dowodu |
|---|---|
| TypeScript aplikacji, ESLint |PASS|
| Dodatkowy strict nowych emailFlows/emailSmtp |PASS|
| Dodatkowy strict caÅ‚ego Edge |3 zastane bÅ‚Ä™dy w niezmienionym `_shared/webp.ts`:19,37; NIE PASS tego dodatkowego sprawdzenia|
| Vitest |280 PASS /48 plikÃ³w (264 wczeÅ›niejsze+16 nowych)|
| SQL/RLS |88 PASS, replay43 migracji, nowy jednorazowy PostgreSQL; Auth/Storage w tym zestawie fixture|
| Supabase od pustej bazy |49 PASS Auth/Edge/PostgREST/profil/grupy/zgody/rename/reset legacy i e-mail; nowy slm-email-regression/61321, poczta celowo wyÅ‚Ä…czona|
| Dodatkowe real HTTP Auth |7 owner recovery+7 signup resume+4 UUID/reuse+3 admin privacy =21 PASS na nowej instancji|
| SMTP/HTTP/browser |29 PASS; Edge â†’ prawdziwy SMTP â†’ Mailpit â†’3 callbacki Chrome (verify/expired reset/reset). KoÅ„cowy przebieg na gotowym buildzie z CSP|
| Realne awarie/wspÃ³Å‚bieÅ¼noÅ›Ä‡ |9 PASS: pauza tylko testowego Mailpit, timeout/failed/resend, dwa resety/jeden writer, przerwanie/lease/retry, administracyjne uniewaÅ¼nienie linku|
| Browser layout |18 Chrome PASS (12 wczeÅ›niejszych+6 email),320/360/390 Ã—Light/Dark, fokus/przewijanie/viewport844 i380; fikcyjny binding, nie fizyczna klawiatura|
| Buildy |main/Premium/demo/email-local PASS, demo isolation PASS; odziedziczone ostrzeÅ¼enia chunkÃ³w/assetÃ³w bez bÅ‚Ä™du|
| Source guards |PASS:32 historyczne migracje main i chroniony runtime;43 wersje;55 plikÃ³w Premium z jawnym wyjÄ…tkiem pÃ³l kandydata; CSS/karta/nav bez zmian|
| db lint |exit0,4 stare ostrzeÅ¼enia slm_push_claim/slm_email_profile_save/group_finance_dispatch_core, brak nowych|
| Internet SMTP / fizyczny Android |NOT TESTED; APK/ADB/tunel i dziaÅ‚ajÄ…ca aplikacja nietkniÄ™te|

Robocze bÅ‚Ä™dy naprawiono: Node DNS w Edge nie rozwiÄ…zywaÅ‚ nazwy Dockera (lokalny helper odczytuje IP sprawdzonego wÅ‚asnego Mailpit), Å›cieÅ¼ka dev entrypointu, API Cypress16 i helpery testÃ³w. Jeden test recovery prÃ³bowaÅ‚ postarzyÄ‡ nowy UUID w starej bazie: UPDATE0, brak zmiany danych; poprawiono kontener, koÅ„cowe7 PASS na nowej instancji. Wiek/lease symulowano tylko dla nowych fikcyjnych rekordÃ³w. Nie wykonano fizycznego przerwania TCP Auth. Przechwycenie Mailpit **nie dowodzi dostarczenia w internecie**.

Zrzuty fikcyjnego profilu, fokus przy wysokoÅ›ci380 px: [Light](ui/account-email/profile-light.png), [Dark](ui/account-email/profile-dark.png). Telefon/GitHub: [Light](https://github.com/psuda87/sunday-league-mates/blob/feat/account-model-foundation/docs/ui/account-email/profile-light.png), [Dark](https://github.com/psuda87/sunday-league-mates/blob/feat/account-model-foundation/docs/ui/account-email/profile-dark.png). Bez haseÅ‚ i tokenÃ³w.

## Migracja / odtworzenie wyÅ‚Ä…cznie lokalne

Nowa `20261027063829_account_email_callbacks.sql`; poprzednie42 bez edycji. Nowe projekty: slm-account-mail (60321/60322/Mailpit60324) i slm-email-regression (61321/61322). Po testach SQL active=false i API wszystkie account_capabilities=false w obu; konta i wiadomoÅ›ci zachowane. WczeÅ›niejszych baz i Cloud nie migrowano.

1. Z repo: `python app/scripts/prepare-account-email-local.py`, potem start CLI2.121.0 w `.cache/account-email-stack` (nie wykluczaÄ‡ Mailpit): `supabase start --workdir .cache/account-email-stack --exclude studio,imgproxy,logflare,vector,realtime,postgres-meta,supavisor`. Tylko nowa instancja, bez resetu.
2. PonowiÄ‡ helper po starcie (odczyt IP wÅ‚asnego Mailpit), `python app/scripts/prepare-account-email-local.py --auth-baseline`, `supabase functions serve accounts --workdir .cache/account-email-stack`. Bazowa ochrona Auth jest egzekwowana; poprzedni kontener zachowany.
3. W app: `npx vite build --config vite.email-local.config.ts`, preview tego configu na5182. Lokalny SMTP dopuszcza tylko wÅ‚asny host i odbiorcÃ³w `.test`; IP i wyjÄ…tek bez TLS sÄ… ograniczone do tej izolacji.
4. Runnery z repo: `node app/scripts/test-account-email-http-local.mjs` (jawne prepare tylko testowej instancji), nastÄ™pnie `node app/scripts/test-account-email-failures-local.mjs` (pause/unpause testowego Mailpit w try/finally). Nie uruchamiaÄ‡ na bazie aplikacji; po testach wyÅ‚Ä…czyÄ‡ active. Nie czyÅ›ciÄ‡ danych/podnosiÄ‡ limitÃ³w, aby ponowiÄ‡ PASS.
5. Regresja od zera: helper modelu `--email-regression`, start/serve `.cache/account-email-regression`, auth-baseline z tym samym przeÅ‚Ä…cznikiem. Runner HTTP i dodatkowe recovery/resume/uuid/admin-privacy wybierajÄ… tÄ™ instancjÄ™ przez `SLM_ACCOUNT_EMAIL_REGRESSION=1`. Pierwszy wymaga pustej nowej bazy; odmawia zamiast resetu.

## Rzeczywisty SMTP i blokery Cloud

PrzykÅ‚ad `app/supabase/email.smtp.env.example`: tylko serwer, bez sekretÃ³w, domyÅ›lnie wyÅ‚Ä…czony. Nodemailer10.2.1 przypiÄ™ty; niezaleÅ¼ne node_modules tego worktree nie zmieniajÄ… Å›rodowiska root. Nie wybrano usÅ‚ugodawcy/pÅ‚atnego planu. Docelowo465/TLS lub dopuszczony STARTTLS, weryfikacja certyfikatu obowiÄ…zkowa.25/587 nie uÅ¼ywaÄ‡ w Edge.

Przed startem potrzebne: zatwierdzony darmowy limit/usÅ‚ugodawca i sekrety poza Git; domena nadawcy/SPF-DKIM-DMARC; dokÅ‚adny HTTPS callback, hosting/CSP/Referrer-Policy/frame-ancestors, originy i konfiguracja klienta; odbiÃ³r rzeczywistej dostarczalnoÅ›ci/linkÃ³w w docelowych klientach (bez link trackingu zmieniajÄ…cego bearer); mapa konfliktÃ³w kont, legal/anti-bot i skoordynowany cutover. Operacje Cloud i aktywacja wymagajÄ… osobnej decyzji.

GoTrue Site URL/Redirect URLs nie zmieniono: scoped callback wybiera tylko SLM_EMAIL_CALLBACK_URL. PrzyszÅ‚e natywne przepÅ‚ywy wymagajÄ… osobnej dokÅ‚adnej allowlisty, bez wildcardÃ³w produkcyjnych. Konfiguracja SMTP w Dashboard Auth nie konfiguruje automatycznie transportu tej warstwy aliasÃ³w.

Sprawdzone ÅºrÃ³dÅ‚a: [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [password/recovery](https://supabase.com/docs/guides/auth/passwords), [SMTP Edge â€” oficjalny przykÅ‚ad](https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/send-email-smtp/README.md), [Nodemailer](https://nodemailer.com/smtp). Indeks changelog.md odrzucony przez narzÄ™dzie web ze wzglÄ™du na text/markdown; sprawdzono dokumentacjÄ™ tematycznÄ…. Wbudowany SMTP Supabase nie jest gwarantowanÄ… darmowÄ… wysyÅ‚kÄ… produkcyjnÄ….

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

Lokalne backend/callback sÄ… podstawÄ… do osobnego przygotowania kontrolowanego testu. Nie budowano/instalowano APK ani nie testowano fizycznie. Kandydat nadal wyÅ‚Ä…czony, istniejÄ…ce logowanie nieprzeÅ‚Ä…czone.127.0.0.1:5182 w przeglÄ…darce telefonu wymaga odrÄ™bnego tunelu/hostingu; sam tunel backendu nie wystarczy. Brak gotowoÅ›ci do aktywacji internetowego recovery/Cloud.

PrzyszÅ‚y odbiÃ³r: signup bez e-maila â†’ dodanie adresu â†’ odmowa przed linkiem â†’ wiadomoÅ›Ä‡/callback â†’ login do tego samego profilu â†’ zmiana adresu â†’ expired/resend â†’ recovery i odrzucenie starego hasÅ‚a/sesji â†’ reset administratora bez e-maila â†’ restart/Light/Dark/Wstecz. WklejaÄ‡ PASS/FAIL i komunikat, bez haseÅ‚/tokenÃ³w/linkÃ³w.

Raport chronologiczny: `docs/ODPOWIEDZI_CODEX.txt`. PR18 Draft, bez merge/deploy.

2026-10-27 17:56 Europe/Warsaw — Kod **9ab903f331bf1785fc9f2c5cc0fa6a037466d423** wypchnięty; PR18 open/Draft/mergeable, bez merge. Obie nowe aktywacje wyłączone i odczytane SQL+HTTP. Końcowy raport i decyzje zapisane w docs/ODPOWIEDZI_CODEX.txt.

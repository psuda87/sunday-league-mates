# Audyt i zabezpieczenie integracji ? 19.10.2026

Worktree integracyjny: `I:\slm\sunday-league-mates-integration`, branch `feat/integration`.
Drugi worktree: `I:\slm\sunday-league-mates`, branch `feat/ui-beta`.
Punkt wyj?cia integracji: `20267546c125daf2100fcc41936e7826f936d210`.
Odczytane po fetch `origin/main`: `4db97ba679a412834869fc5c05df4622a1afcb86`.

## Ga??zie i zachowanie prac

- Auth, events, settlements i push-notifications s? przodkami integracji: historia zachowana.
- `ui-beta` nie jest przodkiem: UI przeniesiono r?cznie, bez zast?powania dzia?aj?cego backendu symulatorem.
- 70 wsp?lnych plik?w UI/demo/branding by?o identycznych z `ui-beta`; Groups.tsx przeniesiono do GroupsScreen.tsx, dostosowano importy, Fields i BottomNav. TypeScript, Vitest i oba buildy sprawdzaj? ten wariant.
- Produkcyjne Accounts/SessionManager u?ywaj? live/Groups, Matches i Finance. Demo ma osobny entrypoint i allowlist? builda.
- Wszystkie commity i wcze?niejsze materia?y UI pozostaj? na `origin/feat/ui-beta`, w tym dokumentacja i historyczne screenshoty. Nie kopiowano tych wygenerowanych screenshot?w do integracji.
- Oryginalny worktree i jego trzy nie?ledzone PNG pozostaj? bez zmian. Dwa pliki pics skopiowano 1:1 do pics integracji; nowy herb do docs/branding/slm-crest-duo-source.png. Kopie s? przeznaczone do commita integracji.
- Nowy dostarczony herb ma 1254?1254 px, SHA256 `70fb15d779f406513a8a024bed20ac40e83bc0044609be106b9435e2c6e291c8`. Dotychczasowy slm-logo-primary-transparent.png: 450?505 px, bez zmian. Nowy plik jest materia?em ?r?d?owym; nie podmieniono logo aplikacji.

## Kontrole wykonane w tym zadaniu

| Kontrola | Wynik |
|---|---|
| TypeScript tsc --noEmit | PASS |
| ESLint | PASS |
| Vitest, maxWorkers=4 | 190/190, 33 pliki |
| Bootstrap Node | 6/6 |
| Deno check: accounts i push-worker | PASS |
| SQL legacy/RLS/RPC/wsp??bie?no?? | 31 PASS |
| SQL v2: grupy, finanse, RLS, FIFO, powiadomienia | 55 PASS po naprawie fixture |
| Odtworzenie 29 migracji i zachowanie starej historii | 9 PASS |
| HTTP Auth legacy | 7 zestaw?w PASS |
| HTTP scoped/e-mail | 20 PASS |
| HTTP smoke/worker bez FCM | 9 PASS |
| Rzeczywista przegl?darka ? lokalny Edge ? PostgreSQL | 1 PASS, bez mock?w |
| Cypress z kontrolowanym API | 13/13 |
| Web build | PASS |
| Demo build + izolacja 15 plik?w | PASS |
| Capacitor sync android | PASS |
| Android assembleDebug + testDebugUnitTest, JDK21 | BUILD SUCCESSFUL; unit task UP-TO-DATE |
| db lint --local | exit 0; 3 ostrze?enia, brak b??d?w |

Pierwsza pr?ba bootstrap wskazywa?a nieistniej?cy plik testowy; uruchomiono w?a?ciwy bootstrap-admin.node-tests.mjs i otrzymano 6 PASS.
Pierwszy test SQL v2 nie przeszed?: fixture dodawa? 2 godziny i po 22:00 przenosi? mecz na kolejny dzie?, przez co nie obowi?zywa? cutoff. Naprawiono wy??cznie fixture: pocz?tek 5 minut w przysz?o?ci i kontrola rzeczywistego dnia serwera. Powt?rny ca?y zestaw 55 PASS, tak?e FIFO po 17:00. Przed 17:00 lub blisko p??nocy harness jawnie zg?asza ten scenariusz jako NOT TESTED; nie udaje zmiany zegara RPC.

Testy obejmuj? izolacj? finans?w grup, uprawnienia admina/organizatora, globaln? blokad? dw?ch kwalifikuj?cych d?ug?w i dozwolony mecz bezp?atny, go?ci, wy?cig o ostatnie miejsce, brak autoawansu rezerwy, celowe wp?aty i FIFO grupowe, korekty/zwroty, idempotencj? oraz rollback finans?w przy awarii powiadomienia. Testy u?ywa?y wy??cznie w?asnych fikcyjnych danych lokalnych, sprz?tanych w finally; istniej?cej bazy nie resetowano.

Po sprz?taniu: 29 migracji, 0 kont Auth, 0 grup i mecz?w, 0 scratch DB; 0 tabel SLM bez RLS i 0 publicznych RPC SLM dost?pnych anon.
SQL lint: historyczne niejawne text?jsonb w slm_push_claim oraz dwie nieu?ywane zmienne v_before/v_rows. Bez przepisywania dzia?aj?cych migracji dla kosmetyki.

## Bezpiecze?stwo publikacji

Skan obejmuje pliki ?ledzone i nowe; do staging nie trafiaj? env, PAT, klucze, logi, lokalne bazy, zale?no?ci, APK ani wyniki build?w. Jedno trafienie nag??wka PRIVATE KEY w fcm.ts to regex usuwaj?cy otoczk? PEM, nie klucz. Pozosta?e sta?e s? fikcyjnymi fixture lub nazwami akcji. Przyk?adowy adres Cypress jest fixture szablonu, nie danymi kont u?ytkownik?w.
`.env.example`, package-lock.json, migracje i ?r?d?a Androida zachowane. Dodano ignore lokalnych APK/AAB/baz/dump?w. ?adnych usuni?? plik?w u?ytkownika.

Aktualny npm audit: 6 moderate, 0 high/critical; omit=dev: 3 moderate. npm audit zwraca wynik nieczysty; nie przedstawiamy go jako braku podatno?ci. Nie zmieniano zale?no?ci ani nie u?ywano force fix.

Repozytorium ma integracj? Vercel. Aby push/merge nie publikowa?y aplikacji, dodano git.deploymentEnabled=false w root i app/vercel.json; konfiguracj? demo-only i jej CSP zachowano z ui-beta. Nie zmieniano ustawie? zdalnego hostingu ani istniej?cego wdro?enia. ?r?d?o: https://vercel.com/docs/project-configuration/git-configuration .

GitHub przy audycie: main bez branch protection i rulesets, 0 workflow Actions, brak otwartego PR integracji. Nie ma wymaganych kontroli CI do omini?cia; lokalne testy nie s? kontrolami CI. Po push ponownie sprawdzi? dok?adny SHA PR i status mergeable. Ga??zi ?r?d?owych nie usuwa?.

## Ryzyka i dalsze kroki

- Merge kodu nie wdra?a migracji ani Edge Functions. Zdalnego Supabase nie odczytywano ani nie zmieniano.
- Przed rolloutem: osobny przegl?d historii trzech naprawionych migracji legacy, kopia danych i ustalenie w?a?ciciela starej grupy. Niejednoznaczno?? zatrzymuje migracj? zamiast zgadywa?; test replay nie zast?puje przegl?du prawdziwych danych.
- SMTP, domena, legal, callbacki i rzeczywiste signup/verification/recovery nadal nieaktywne; istniej?cy Auth dzia?a. Zachowano hooki i limity.
- FCM niekonfigurowane: test kolejki/adaptera nie potwierdza dostawy push. Nie wysy?ano maili/SMS ani push do urz?dze?.
- Test aktualnej integracji na fizycznym telefonie i iOS nie zosta? wykonany; stary r?czny odbi?r Auth nie zast?puje odbioru obecnej wersji.
- CAPTCHA od?o?ona. Vector restartuje si?; nie zmieniano socket?w/Windows. Pozosta?e lokalne us?ugi dzia?aj? i wszystkie wymienione testy przesz?y.
- Pozostaj? umiarkowane podatno?ci zale?no?ci oraz ostrze?enia wielko?ci bundla, Browserslist i Gradle flatDir.
- SLM 1.0 nie jest jeszcze gotowe do publikacji.

Wynik publikacji i merge jest rejestrowany w PR feat/integration ? main; bie??cy dokument opisuje faktycznie sprawdzon? zawarto?? przed scaleniem.

## Wynik publikacji

Commity `0ec5200` i `309d57c` wypushowano bez force na origin/feat/integration. PR https://github.com/psuda87/sunday-league-mates/pull/2 mia? mergeable=true, mergeable_state=clean, 0 wymaganych kontroli, 0 check runs i workflow. Zosta? scalony standardowym merge c28b09d77a6a203954c10060d1e87aa105cfeef2. Lokalny main pobrano fast-forward bez zmiany ga??zi worktree. Drzewa origin/main i przetestowanego feat/integration by?y identyczne. Vercel nadal wskazywa? ten sam deployment dpl_42Gau4hZ9o6PesfUfY3E3MWBeNw5 ? brak nowego wdro?enia.

W trakcie audytu w oryginalnym worktree pojawi? si? dodatkowy nie?ledzony plik SLM Gold Crest Logo Comparison.png. Zabezpieczono identyczn? kopi? w docs/branding/slm-gold-crest-comparison-source.png. Orygina? i pozosta?e nie?ledzone grafiki pozostaj? bez zmian. Ko?cowy commit tej kopii i dokumentacji nie zmienia kodu ani wynik?w test?w; wystarcza kontrola integralno?ci PNG i git diff --check.

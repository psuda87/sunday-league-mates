# Stage 2B — Premium edytuje wspólny skład

2026-10-29, Europe/Warsaw. Gałąź `feat/premium-lineups-stage2b` od dokładnego `3b00ec268a19f64516daebbf0b238d796e826cd1` (`feat/premium-lineups-stage2a`). Początkowy worktree czysty; `feat/ui-beta` i jego niezapisane zmiany pozostawiono nietknięte. Stage 1 i 2A wykorzystano, bez ponownego tworzenia backendu.

**Stage 2B technicznie gotowy do integracji po review PR i osobnym przeglądzie przypięcia runtime przez właściciela, wymaganym w AGENTS.md.** Nie wykonano merge, publikacji, migracji do istniejących baz ani instalacji APK. Fizyczny odbiór POCO pozostaje niewykonany. Implementacja runtime: **`f47cd80ad49aa6df0faf0dcb04093f2fa1adfbcd`**. Końcowy zakres testów, strażnika i zrzutów: **`a75799f47a3e6636c2779622f70bc715adc1ab5a`**. Dokumentacja zapisana osobno.

## Zachowanie

- `PremiumTeams` używa istniejącego SessionManager/accounts. Pobiera `lineups_get` i świeże `matches_detail`; sprawdza UUID meczu/grupy, wersję wydarzenia i pełny podział aktualnych registered IDs. Niespójny równoległy odczyt jest powtarzany najwyżej raz, potem wymaga odświeżenia. Nie ma bezpośredniego SQL, nowego Auth ani nadawania ról klientem.
- Wersja 0: istniejący algorytm Stage 1 proponuje naprzemienne 6:5 dla 11 osób. Serwerowy baseline pozostaje pusty, draft zawiera propozycję i jest oznaczony „niezapisana”. Dlatego można świadomie zapisać pierwszy podział bez sztucznej zamiany. Przywracanie wraca do propozycji sprzed edycji; nie udaje zapisu. Sam odczyt nigdy nie wysyła POST zapisu. Dla istniejącego składu baseline i punkt przywracania są bieżącym podziałem serwera.
- Każda osoba/gość używa UUID uczestnictwa. `stale_entry_ids`, rezerwa i wycofani nie trafiają na boisko; nowi registered pozostają poza zapisanym podziałem, z przyciskami A/B. Zmiana rosteru przekazana przez rodzica usuwa stare przypisania z lokalnego modelu i blokuje zapis do odświeżenia. Nie zmienia się automatycznie zapisanej historii backendu.
- Zachowano zamianę dwóch osób, transfer jednej, nieparzyste drużyny, oddzielny baseline/draft/punkt przywracania, bezpieczny profil grupowy i powrót do tego samego szkicu. `PremiumPitch`, Ultimate, karty, BottomNav, CSS i grafiki są bajtowo niezmienione.
- Zapis wysyła wyłącznie event_id, expected_version, expected_roster_version, team_a, team_b, request_id. Autor, grupa i rola nie są danymi uprawniającymi w payloadzie. Przycisk aktywny tylko dla zmiany względem baseline i otwartego meczu; synchroniczny ref blokuje podwójne kliknięcie, a pending blokuje edycję. Komunikat sukcesu pojawia się dopiero po potwierdzonym POST i ponownym, spójnym odczycie.
- Niepewny wynik zachowuje identyczny UUID i payload. Edycja takiego zamiaru pozostaje zablokowana do retry lub świadomego odświeżenia. Po potwierdzonym POST i awarii readback ponawiany jest sam GET, bez nowego zapisu. Replay nigdy nie jest traktowany jako najnowszy snapshot. Nowa świadoma zmiana po sukcesie dostaje nowy UUID.
- Pod boiskiem jest wyłącznie `last_change.display_name` z bezpiecznej projekcji backendu albo „Brak zapisanych zmian”. Otwarcie, zamiana/cofnięcie i identyczny podział nie tworzą pozornego autora. Przy ponownym potwierdzeniu danych nazwa autora jest pobierana na nowo, według bieżących zgód.
- Konflikty wersji, rosteru i idempotencji zachowują szkic, blokują zapis i nie wykonują automatycznego rebase/retry na nowej wersji. Ręczne odświeżenie ostrzega o zastąpieniu szkicu, z możliwością zachowania go. Nieudany odczyt po potwierdzeniu odświeżenia nadal zachowuje dotychczasowy szkic.
- Błędy członkostwa/sesji/archiwizacji ukrywają boisko i autora, bez pokazywania diagnostyki SQL lub prywatnego tytułu. Zakończony/odwołany mecz można odczytać jako historię, ale nie edytować. Czas zamknięcia wyliczany jest z czasu serwera z uwzględnieniem czasu od odczytu; backend pozostaje ostatecznym strażnikiem.

## Sieć, sesja i RAM

Istniejący SessionManager po błędzie sieci ukrywa/odmontowuje chroniony świat. Nie zmieniono tego zachowania Auth. Nowy kontroler przechowuje wyłącznie dane edytora i zamiar zapisu w RAM, w WeakMap per instancja managera, użytkownik, grupa i mecz. Szkic może wrócić po ponownym potwierdzeniu tej samej sesji, ale boisko pozostaje ukryte do nowego sprawdzenia API. Recheck nie nadpisuje brudnego szkicu; zmiana wersji/rosteru wymaga decyzji użytkownika. Zmiana aktora/grupy/meczu i generacja żądania blokują spóźnione odpowiedzi.

Logout, zmiana użytkownika i błąd bezpiecznego magazynu czyszczą RAM także wtedy, gdy edytor jest odmontowany. Odmowa dostępu usuwa dany zakres. Nie dodano localStorage/Preferences, cache haseł/tokenów, zapisów offline ani synchronizacji w tle. Powrót z profilu zachowuje zamontowany edytor. Ponowne otwarcie zakładki odświeża czysty skład; brudny wymaga jawnej decyzji. Realtime nie jest częścią tego etapu.

## Faktycznie wykonane testy

Wszystkie wykonano w tej sesji na **Windows z lokalnym Dockerem**, nie w osobnym Cloud Codex. Końcowe przebiegi poniżej zakończyły się exit 0.

| Warstwa | Wynik i granica dowodu |
|---|---|
| UI/API kontrolowany transport | **23 PASS** w `premiumLineupApi.test.tsx`: pierwszy odczyt/propozycja, readback/reentry, swap, transfer/goście, baseline/undo, autor, duplikaty kliknięć, 409 dwóch klientów, roster, retry UUID, zatwierdzony POST/awaria GET, sesja/członkostwo/archiwizacja, sieć i odmontowanie, historia, profil/odmowa/błędna tożsamość/spóźniona odpowiedź, logout, zmiana aktora, błędny kontrakt. To fixture, nie SQL/RLS. |
| Pełny Vitest | **335 PASS / 53 pliki**, w tym powyższe 23 i dotychczasowe 23 jednostkowe Edge. |
| Rzeczywisty browser → SessionManager → GoTrue → accounts Edge → PostgREST → PostgreSQL | **14 PASS**: dwa wydane przez GoTrue tokeny, początkowe 6:5 bez POST, wspólny zapis/autorstwo, konflikt drugiego edytora, transfer UUID gościa 5:6, profil/back, restore bez POST, utrata odpowiedzi po rzeczywistym commit i identyczny retry po odmontowaniu przez Auth, ponowne wejście, 320/390/768 Light/Dark bez overflow i znaczniki >=44 px. |
| Rzeczywisty backend towarzyszący browserowi | **14 PASS**: 13 odziedziczonych kontroli GoTrue/Edge Stage 2A plus jedna kontrola dokładnie jednego wspólnego wiersza utworzonego przez browser. Obejmuje restart i odebranie dostępu. |
| Regresja SQL/RLS/PostgREST Stage 2A | **50 PASS**, z bazowego worktree `3b00ec2`; potwierdzono bajtową identyczność wszystkich źródeł `app/supabase` z Stage 2B. Bootstrap Auth i syntetyczne JWT w tym konkretnym runnerze, odrębnie od prawdziwego GoTrue powyżej. |
| Dotychczasowy Cypress `cypress/e2e`, Chrome headless | **13 PASS / 5 plików**, kontrolowane API. Nie mylić z powyższym rzeczywistym backendem. |
| TypeScript aplikacji / strict Edge / ESLint | PASS. |
| Premium i konsolidacja | **55 plików wizualnych / 10 granic importów / 41 migracji — PASS**; **37 testów polityki PASS**, wszystkie wcześniejsze próby zachowane. |
| Build LIVE / Premium lokalny / demo | PASS; izolacja demo **16 plików**. Istniejące ostrzeżenia dużych chunków. |
| Android web / `cap sync android` / `:app:assembleDebug --offline` | PASS, lokalny JBR Android Studio i istniejący SDK. APK tylko zbudowany, nie instalowany ani publikowany. Zmiany końców linii plików generowanych normalizowano; brak zmian źródeł natywnych/konfiguracji telefonu. |

### Wiarygodność i napotkane problemy

Nowy runner UI rozszerza fixture Stage 2A o jawny callback testowy, dopuszczany na gałęzi 2B wyłącznie po porównaniu pełnej zawartości wszystkich migracji i handlera z przypiętym `3b00ec2`. Stara ścieżka runnera 2A zachowuje swój branch guard. Baza jest nowa, `--network none`; GoTrue/PostgREST/Edge współdzielą jej przestrzeń sieciową, bez publikacji portów. Przeglądarka korzysta wyłącznie z tymczasowego mostu HTTP na loopback komputera. Utrata odpowiedzi jest świadomie wstrzyknięta po prawdziwym commit; samo API i dane nie są mockowane.

Prawdziwy schemat Auth tworzy GoTrue; wszystkie 41 migracje odtwarzane są od zera. Minimalny schemat Storage służy historycznym migracjom; **Kong i Storage nie są testowane**. Hasła i bootstrap/tokeny fixture nie trafiają do plików źródłowych, raportu ani zrzutów. Bundle testowy pobiera bootstrap z tymczasowej odpowiedzi no-store; SessionManager używa magazynu wyłącznie w RAM.

Pierwsze próby runnera wykazały problemy samego środowiska: kolejność middleware Vite, wybrany cel CDP rozszerzenia zamiast strony, blokady EPERM cache optymalizatora na Windows oraz zbyt wczesną asercję po ponownym wejściu. Runner używa teraz produkcyjnego bundla i własnego serwera loopback, wybiera jawny cel `page`, a profile Chrome tworzy w katalogu tymczasowym poza repo. Profile z wcześniejszych prób zachowano poza drzewem testów aplikacji. Nie zmieniano globalnych ustawień Chrome/Windows ani filtrów testów. Obce testy rozszerzenia przeglądarki, przypadkowo wykryte w początkowej fixture, nie należą do testów SLM; po uporządkowaniu artefaktów wykonano pełne 335 testów bez wykluczania przypadków.

Po godzinie 18:00 wykryto też deterministyczny błąd istniejącego `demo/eventAccess.test.ts`: dwa przypadki poza `describe` nie korzystały z jego zegara, a fikcyjny mecz właśnie stał się przeszły. Identyczny FAIL odtworzono na niezmienionym Stage 2A. Przeniesiono ten sam beforeAll/afterAll na zakres całego pliku; wszystkie daty, warunki i asercje pozostają te same. Kod demo/UI nie został zmieniony.

Końcowe udane fixtures: `slm-lineups-edge-a10a01a6a920` (+ auth/rest/edge), `slm-lineups-stage2a-a1ec4d83aabb` (+ rest). Zatrzymane i zachowane; inspect potwierdził brak portów i izolację. Wcześniejsze próby też zatrzymano/zachowano. Bez resetu/drop istniejącej bazy, instalacji narzędzi lub modyfikacji baz używanych przez telefon.

## Strażnik i zmienione pliki

Nie zmieniono manifestu 55, jego hashy, poprzednich zatwierdzeń backendu, routingu, konfiguracji buildów lub CI. Początkowy guard poprawnie odrzucił celowo zmieniony `PremiumTeams`. Osobny commit testowy dodaje ścisłe przypięcie **czterech plików** do niezmiennego Git SHA `f47cd80`: PremiumTeams, lineupEditor, lineupContracts, usePremiumLineup. Reszta Stage 1 i runtime zachowuje dawne SHA. Nie ma wildcardów, pomijania fragmentów ani porównania do bieżącego HEAD. Wymagane są także dwa nowe importy/adaptery jako granice runtime.

Zachowano wszystkie 29 testów polityki; dwa mutanty wskazują nowe, równoważne miejsca zabezpieczenia Save i punktu przywracania. Dodano 8 odmów: podmiana dekodera, odłączenie GET/POST, utrata UUID retry, zgubienie szkicu, pozostawienie prywatnego RAM po logout, pominięcie aktora i tokenu rosteru. **Osobny review właściciela tej aktualizacji strażnika nadal obowiązuje.**

Pliki funkcji: `app/src/events/PremiumTeams.tsx`, `lineupEditor.ts`, nowe `lineupContracts.ts`, `usePremiumLineup.ts`. Testy: nowe `premiumLineupApi.test.tsx` i `lineupFixture.test-support.ts`, dostosowane `lineupEditor.test.tsx`, `premiumUi.test.tsx`, `auth/premiumRuntime.test.tsx`, `cypress/premium-behavior.cy.ts`, poprawiony zakres zegara `demo/eventAccess.test.ts`. Testy starszego, zawsze wyłączonego Save przeniesiono do mocniejszych scenariuszy API; cztery testy czystego modelu Stage 1 zachowano.

Runner: nowe `test-lineups-ui-local.py`, `test-lineups-ui-browser.mjs`, addytywnie rozszerzony `test-lineups-edge-local.py`. Strażniki: `premium-route-policy.mjs`, `verify-premium-policy-cases.mjs`. Dokumentacja: ten raport, STATUS, ODPOWIEDZI_CODEX, 7 zrzutów w `docs/ui/lineups-stage2b`. `cypress/premium-behavior.cy.ts` dostosowano do serwerowego baseline, ale tego osobnego legacy scenariusza na jego dawnej używanej fixture **nie uruchamiano**; powyższy nowy browser test korzysta z nowej bazy.

## Odtworzenie — PowerShell

Wszystkie główne kontrole już wykonano; nie potrzeba dodatkowych wyników od użytkownika do zamknięcia technicznego 2B. Wymagane istniejące Docker/Python/Node/Chrome i obrazy wskazane digestami w runnerze; bez CLI Cloud.

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\premium-lineups-stage2b'
git branch --show-current # feat/premium-lineups-stage2b
python -X utf8 app/scripts/test-lineups-ui-local.py
if ($LASTEXITCODE -ne 0) { throw 'Rzeczywisty UI/backend nie przeszedł' }
Set-Location app
npm run test.unit -- --run
npm run lint -- .
npm run verify:consolidation
npm run test:premium-policy
npm run build
npm run build:premium-local
npm run build:demo
```

Każdy pełny runner tworzy nową bazę i zachowuje zatrzymane kontenery. Nie uruchamiać `db push`, resetu ani migracji do istniejącego projektu w ramach tego polecenia. Oddzielny SQL runner 2A pozostaje uruchamiany na przypiętej gałęzi 2A.

## Późniejszy odbiór POCO — bez wykonywania teraz

Najpierw osobno zatwierdzić izolowany backend dla telefonu, sprawdzić obecność dokładnej migracji 2A i lokalnej Edge oraz zgodność endpointu APK. Tego backendu nie sprawdzano ani nie zmieniano. Istniejący wariant Android Stage3 ma przypięty lokalny endpoint; udana kompilacja nie potwierdza zgodności używanej bazy telefonu. Nie kierować testów do Cloud.

Po osobnej zgodzie na przygotowanie połączenia i instalację APK przeprowadzić ręcznie:

1. Dwa fikcyjne konta w tej samej grupie, nowy mecz z 11 registered (w tym osobne UUID gości). Pierwszy ekran pokazuje 6:5, brak autora i brak automatycznego zapisu.
2. Zapisać świadomie; drugim klientem odświeżyć i potwierdzić ten sam podział/autora. Zamiana/cofnięcie i transfer powrotny mają pozostawić Save wyłączony oraz autora/czas bez zmian.
3. Transfer gościa do drugiej drużyny daje 5:6; gość nie otwiera profilu. Profil członka i systemowy Android Back zachowują brudny szkic, fokus i przewinięcie.
4. Dwie edycje tej samej wersji: drugi zapis kończy się 409, szkic pozostaje. Odświeżenie ostrzega o zastąpieniu; anulowanie ostrzeżenia zachowuje szkic.
5. Zmiana rosteru, brak sieci/niepewna odpowiedź, odebranie członkostwa i logout nie mogą przywrócić wycofanych ani prywatnych danych. Retry nie tworzy nowej wersji dla tego samego zamiaru.
6. Sprawdzić Light/Dark, dotyk, małą szerokość, zamknięty mecz, obrót/ponowne otwarcie i zachowanie po weryfikacji sesji. RAM znika przy restarcie procesu; to zamierzony brak trwałego szkicu offline.

Nie wykonano `adb install`, `adb reverse`, zmiany ustawień POCO ani nowego wdrożenia. Nie rozpoczynać kolejnego modułu ani wyszukiwarki publicznych meczów.

## Zrzuty i Git

[Dark](https://github.com/psuda87/sunday-league-mates/blob/feat/premium-lineups-stage2b/docs/ui/lineups-stage2b/teams-dark.png), [Light](https://github.com/psuda87/sunday-league-mates/blob/feat/premium-lineups-stage2b/docs/ui/lineups-stage2b/teams-light.png), [konflikt](https://github.com/psuda87/sunday-league-mates/blob/feat/premium-lineups-stage2b/docs/ui/lineups-stage2b/conflict.png), [profil](https://github.com/psuda87/sunday-league-mates/blob/feat/premium-lineups-stage2b/docs/ui/lineups-stage2b/profile.png). Obejrzane rendery rzeczywistych komponentów i fikcyjnych kont nowej bazy; bez sekretów.

**Draft PR utworzony: [#27](https://github.com/psuda87/sunday-league-mates/pull/27)**, base `feat/premium-lineups-stage2a` (`3b00ec268a19f64516daebbf0b238d796e826cd1`), head `feat/premium-lineups-stage2b`. GitHub potwierdził `draft:true`, `state:open`, `merged:false`. Opublikowany przy tworzeniu PR HEAD: `290996da4b0e9f1bf02e6e4f6945d388fca3f647`; końcowe potwierdzenie PR/Git dodano osobnym commitem dokumentacyjnym. Zwykły push objął kod, strażniki, raporty i wszystkie 7 zrzutów. [Porównanie](https://github.com/psuda87/sunday-league-mates/compare/feat/premium-lineups-stage2a...feat/premium-lineups-stage2b?expand=1). Bez merge/deploy. Review właściciela przypięcia runtime i ręczny odbiór POCO nadal pozostają osobnymi krokami.

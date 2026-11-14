# Tito — ponowny odbiór lokalny, 2026-11-10–11

Stan po implementacji `7c00085` i raporcie `2e32b8d`, w osobnym checkoutcie
`I:/slm/tito-lineups-completion`, gałąź `codex/tito-lineups-completion`.
**Pełny odbiór NIE jest zaliczony.** Docker działa, lecz wymagany projekt i porty
zajmuje zachowany stos z 28 października; aktywny strażnik odrzuca gałąź Tito.
Nie wykonano żadnego odczytu/zapisu danych tej bazy, migracji, backfillu ani
operacji Supabase Cloud. Poniższy stan zastępuje historyczne wyniki środowiska
i testów z końca tego dokumentu.

## Środowisko i blokada izolacji

- Windows 11 Enterprise `10.0.26200`, AMD Ryzen 7 5800X; Node `24.14.0`, npm
  `11.9.0`, Python `3.14.3`, Supabase CLI przypięty do `2.121.0`.
- Docker Desktop `4.95.0 (242831)`, silnik Linux/amd64 `29.8.2`, API `1.56`,
  kontekst `desktop-linux`, WSL kernel `6.18.58.1-microsoft-standard-WSL2`.
  Silnik odpowiadał już przy sprawdzaniu; nie uruchamiano ani nie restartowano
  Desktopu/kontenerów. Obraz zachowanej bazy: PostgreSQL `17.11.0.004`.
- `supabase_db_slm-main-stabilization`, ID `65c8f4a2ce37…`, utworzony
  `2026-10-28T21:30:19Z`, zajmuje `55322`; Kong `03382f5f1d64…`, utworzony
  `2026-10-28T21:30:30Z`, zajmuje `55321`. Obydwa uruchomione ponownie
  `2026-11-10T22:00:03Z`, przed badaniem. Uruchomienie starego kontenera nie
  oznacza nowej bazy.
- Etykieta `com.supabase.cli.project=slm-main-stabilization` jest poprawna,
  ale `com.supabase.cli.workdir` wskazuje
  `I:/slm/sunday-league-mates/.worktrees/main-stabilization/.cache/stabilization-stack`,
  a nie checkout Tito. Listenery hosta: `com.docker.backend`/`wslrelay`.
  W nowym checkoutcie nie ma przygotowanego `config.toml` stosu.
- **FAIL preflight:** `prepare-stabilization-local.mjs` i `test-tito-local.mjs`
  zatrzymują się na wymaganiu gałęzi `chore/main-stabilization`. Nawet po osobnym
  zatwierdzeniu wyjątku dla Tito zachowany stos nie spełni warunku świeżości.
  Nie pobierano kluczy ani konfiguracji Cloud używanego stosu; jego braku
  połączenia z Cloud nie uznano za potwierdzony. Warunki pierwszego zapisu
  **nie zostały spełnione**.

Do osobnego przeglądu przygotowano
[propozycję strażnika lokalnego](review/tito-local-stack-guard-proposed.patch).
Patch **nie jest zastosowany**. Dopuszcza dokładnie lokalną gałąź Tito,
zabrania jej trybu CI, odrzuca istniejące kontenery i wolumeny projektu,
zajęte porty, link Cloud, obcy workdir i kontener starszy niż przygotowanie.
Nie zawiera resetu, zatrzymania ani usuwania starego stosu.
[Test propozycji](review/test-tito-guard-proposal.mjs): **18/18 PASS**, wyłącznie
mockowane metadane, bez Docker/SQL. `git apply --check`: PASS.

Właściciel musi osobno przejrzeć patch oraz uzgodnić udostępnienie wymaganych
portów i cykl dwóch nowych środowisk syntetycznych z właścicielem starego
stosu. Nie wystarczy nazwać starej bazy fixture. Zmiana nazwy brancha, portów,
zmiennych CI lub ręczne ominięcie `assertIsolated()` nie są rozwiązaniem.

## Naprawa ujawniona przez Cypress

Początkowy start Cypress kończył się `3221225501` (`0xC000001D`). Proces
dziedziczył `ELECTRON_RUN_AS_NODE`; kod launchera zainstalowanego Cypress
wybiera wtedy tryb Node. Bez tej zmiennej w **samym procesie potomnym** natywny
smoke test kończy się kodem 0, a Cypress uruchamia scenariusze. Nie zmieniano
globalnego środowiska ani ustawień Windows. Binarka Cypress `16.1.1`
(`16.1.1.4005393`) ma poprawny podpis; SHA256
`cb0a3a1d187ce001f968e8729bc24a775c7d9f9f8ed8d639f4e51827359dde19`.
Nie potwierdzono hipotezy o braku instrukcji CPU.

Rzeczywiste kliknięcie Cypress ujawniło regresję: odczyt po focus potrafił
wyzerować tryb zamiany i pierwszy wybrany wpis; trwający odczyt w tle blokował
także edycję/zapis. `usePremiumLineup` zachowuje teraz interakcję przy
niezmienionej wersji/rosterze/uprawnieniach. Jawny zapis/odświeżenie może
zastąpić odczyt w tle, którego spóźniony wynik odrzuca epoka operacji.
CAS, autoryzacja i ochrona niezapisanego szkicu pozostają obowiązujące.
Trzy nowe regresje jednostkowe obejmują oba przypadki oraz odzyskanie możliwości
edycji po chwilowym błędzie odczytu i udanym odświeżeniu bez zmiany wersji.
Ten ostatni test najpierw odtworzył błąd poprawki; warunek zachowania edytora
nie przechwytuje już ścieżki powrotu ze stanu błędu.

## Bieżące wyniki wykonanych kontroli

| Kontrola | Wynik | Dowód / granica |
| --- | --- | --- |
| LIVE `npm run build`, Premium `npm run build:premium-local` po poprawce | PASS | Oba buildy ukończone; ostrzeżenie rozmiaru bundle |
| `npm run lint`, TypeScript `--noEmit`, `npm run typecheck:edge` po poprawce | PASS | Każde polecenie exit 0 |
| Pełny `npm run test.unit -- --run --maxWorkers=2` po poprawce | FAIL | **545 PASS / 1 FAIL, 546 testów, 78 plików**; jedyny błąd logowania jak na czystym main |
| Ukierunkowane `lineupRefresh` + `premiumLineupApi` | PASS | 32/32, w tym trzy nowe regresje |
| Cypress `node scripts/test-tito-browser.mjs` | PASS | **2/2**, Chrome 157, lokalny Vite; transport syntetyczny, nie Auth/Edge/SQL |
| Mobilny Chrome CDP `node scripts/test-tito-chrome.mjs` | PASS | 320/390 px, Light/Dark, 0/99/—/G, wycofane wpisy, dwie syntetyczne sesje, konflikt i zachowanie szkicu; transport syntetyczny |
| Parser pglast `7.22`, SQL i PL/pgSQL | PASS | 52 pliki: 49 migracji i 3 pliki Tito; to kontrola składni, nie zastosowanie migracji ani rozwiązanie referencji PostgreSQL |
| `node --check app/scripts/test-tito-local.mjs` | PASS | Składnia rozszerzonego runnera; jego scenariusze bazy NOT RUN |
| `npm run verify:consolidation` | FAIL | Niezaakceptowana 49. migracja; aktywna allowlista bez zmian |
| `node scripts/verify-frozen-ui.mjs` | FAIL | Rozbieżność przypięcia `account-ui/model.ts`, odtworzona na czystym main |
| `npm run test:premium-policy` | FAIL | 23 PASS / 84 FAIL z 107; bazowa kontrola grafu/przypięcia blokuje dalsze przypadki, nie oznacza to 84 dowiedzionych regresji bezpieczeństwa Tito |
| Istniejący `test_lineups_ci_context.py` | FAIL | 34 PASS / 1 ERROR z 35: WinError 1314 przy tworzeniu symlinka |
| Dekoder i komponent starszej PWA z czystego main | FAIL zgodności | Test opisujący zachowanie: 4/4 PASS; dwa warianty autora NULL odrzucane, szczegóły niżej |

Logi lokalne: `app/.cache/tito-acceptance/`, m.in. `vitest-final.log`,
`build-live-after-fix.log`, `build-premium-final.log`, `final-exits.json`,
`cypress-after-fix.log`, `chrome-after-fix.log`, `sql-parser.json`,
`ci-proposal.log`. Ostatni Vitest zakończył się exit 1 wyłącznie przez test bazowy;
32/32 kontrole ukierunkowane są w `focused-after-fix.log`.
Screenshoty: `app/.cache/tito-browser/evidence/`. Są ignorowane przez Git;
nie zawierają wyników odczytu rzeczywistej bazy ani poświadczeń.

## Kontrola na czystym main i osobny przegląd CI

Utworzono czysty detached worktree `I:/slm/tito-main-control-20261110` na
`51211af24479da9ee9dfef23df2fb400d72a9738`; świeże `npm ci --ignore-scripts`
z tym samym lockfile i to samo środowisko. Nie zmieniono śledzonych plików.

- **FAIL bazowy odtworzony:** `B1App.test.tsx`, 6 PASS/1 FAIL. Linia 48 oczekuje
  „Nie udało się zalogować”, UI zwraca „Nieprawidłowy login, numer telefonu lub
  hasło.” Tito nie zmienia tych plików.
- **FAIL bazowy odtworzony:** hash `app/src/account-ui/model.ts`
  `0238b068348d2c287fcd5237ea1ae102756df7a3309ada5988fe4c0147063b76`, przypięcie
  `799f93912ea392642372d3dd9b8c496f32ed118f550f94dd320784418f86643f`.
  Konsolidacja main przechodzi część migracji i dochodzi do tego błędu UI.
  Tito dodatkowo wymaga przeglądu nowej migracji i zmienionych źródeł.
- WinError 1314 odtworzono również minimalną próbą symlinka w katalogu
  tymczasowym: token procesu nie ma uprawnienia do utworzenia dowiązania.
  Nie zmieniano Developer Mode ani uprawnień Windows.
  [Osobna propozycja testu CI](review/tito-ci-symlink-test-proposed.patch)
  oznacza tylko ten brak uprawnienia jako SKIP i wydziela kontrolę modyfikacji
  workflow do niezależnego testu. Patch nie jest zastosowany; aktywne CI,
  strażniki i przypięcia pozostają niezmienione.
  Kandydat uruchomiony wyłącznie z kodu złożonego w pamięci: **35 PASS / 1 SKIP
  z 36**, bez modyfikacji aktywnego pliku; `git apply --check` PASS.

Logi bazowe: `I:/slm/tito-main-control-20261110/app/.cache/tito-control/`.

## PostgreSQL i prawdziwe sesje — NOT RUN

| Wymagany przebieg | Wynik / następny krok po usunięciu obu blokad izolacji |
| --- | --- |
| Świeża instalacja wszystkich 49 migracji | NOT RUN; wykonać w nowym zatwierdzonym stosie, odczytać końcowe funkcje, ACL i RLS |
| Osobna świeża baza main48 → before → Tito49 → after | NOT RUN; porównać przydziały, historię i rozliczenia oraz brak backfillu w migracji |
| Runner i SQL regresje | NOT RUN; `match_lineups`, `lineup_admin`, `premium_match_visibility`, `public_match_discovery`, `account_privacy`, `notifications`, `settlements`, `premium_admin_finance`, `payment_workflow`, `tito_lineups` |
| Dispatchery: ostatnie miejsce, oba wymuszone porządki manual/auto, request_id retry, rollback | NOT RUN; przygotowane wymuszanie blokad i SQL nie są dowodem wykonania |
| Rezerwa/powrót, wypisanie/nowy zapis, goście, erasure autora, członek/admin/obcy, FIFO/opłaty/powiadomienia | NOT RUN na PostgreSQL |
| Backfill wybranych meczów: dry-run, apply, apply ponownie, pomijanie rozpoczętych/odwołanych, ręczne przydziały, zajęta blokada | NOT RUN; rozszerzony runner porównuje dokładny stan i wymaga zera zmian przy drugim zastosowaniu |
| Czas transakcji backfillu | NOT RUN; brak wartości pomiaru, nie podawać czasu procesu jako czasu SQL |
| Dwie niezależne rzeczywiste sesje lokalny Auth → Edge → PostgreSQL, mobilny Chrome i Cypress | NOT RUN; zaliczone scenariusze z transportem syntetycznym nie zastępują tej ścieżki |

Runner backfillu przygotowuje jawne ID przyszłego, rozpoczętego, odwołanego
i niewybranego meczu. Porównuje całe rekordy meczów, wpisów, składów, historii,
ledger i płatności; zachowuje ręczny przydział. Oddzielny proces utrzymuje
transakcję z globalną blokadą aż do asercji `tito_backfill_busy`.
`BACKFILL_TRANSACTION_MS` używa zegara PostgreSQL w jednym procesie psql od
znacznika po `SET LOCAL` do odczytu po `COMMIT`, z pominięciem startu Docker/psql.
Obejmuje mały narzut kolejnego polecenia w tej samej sesji; nie jest samym
czasem funkcji ani dokładnym czasem posiadania blokady. Kod przygotowany,
**żaden pomiar ani wyścig bazy nie został uruchomiony**.

## Starsza PWA — blokada publikacji i backfillu

[Test kontrolny](review/test-tito-legacy-main.mjs) uruchamia rzeczywisty
`PremiumTeams` i dekoder niezmienionego main, ze sterowaną odpowiedzią DTO
odpowiadającą autorowi ręcznemu/automatycznemu po usunięciu konta lub
backfillowi bez inicjatora. Wynik 4/4 PASS oznacza odtworzenie zachowania:

- Zwykłe Tito z prawdziwym UUID inicjatora: boisko i „Ostatnia zmiana: Tito”.
- Zimny odczyt `user_id=NULL`, manual/automatic: „Nie potwierdzono operacji”,
  brak boiska.
- Odświeżenie otwartego widoku po NULL autora: błąd, poprzednie boisko i stara
  nazwa autora pozostają w RAM, Zapisz wyłączone. Nie wolno przedstawiać tego
  jako potwierdzonego aktualnego składu.

To dowód działania prawdziwego klienta na syntetycznym transporcie. Zestawienie
go z odpowiedzią rzeczywistego PostgreSQL po erasure/backfillu nadal NOT RUN.
Nie przypisano Tito fikcyjnego UUID. **Publikacja aplikacji/serwera i backfill
pozostają zablokowane**, nawet po usunięciu lokalnej blokady Docker.

Konkretny plan odbioru zgodności: najpierw na świeżym lokalnym stosie zapisać
odpowiedzi erasure i backfillu, podać je obu rzeczywistym dekoderom oraz otwartej
i nowo uruchomionej starej PWA. Oddzielnie odebrać klienta tolerującego oba
kontrakty i pokazywanie autorów NULL. Ewentualna publikacja wymaga kolejności:
zgodny klient → potwierdzone odświeżenie/wycofanie starych PWA → migracja serwera
→ powtórzenie odbioru → dopiero osobno zatwierdzony backfill. Samo opublikowanie
nowego JS nie dowodzi aktualizacji już otwartych/zainstalowanych PWA. Jeśli nie
można zapewnić wycofania starego klienta, potrzebny jest osobny wersjonowany
kontrakt odpowiedzi; obecne rozwiązanie pozostaje niezgodne. Nie zastosowano
żadnego z tych kroków publikacji.

## Zakres zapisu tej kontynuacji

Własne zmiany: naprawa focus/odczytu w tle, trzy regresje, środowisko potomne
Cypress, rozszerzenie przyszłego pomiaru backfillu, propozycje do przeglądu
i raport. Migracja Tito, wszystkie migracje main, Edge, aktywne strażniki,
przypięcia, CI, lockfile i konfiguracja Vercel bez zmian w tej kontynuacji.
Oryginalny checkout i źródłowe gałęzie Tito/odświeżania zachowane.
Zwykły commit/push na gałąź zgodnie z AGENTS.md; bez PR, merge, workflow,
wdrożenia ani operacji produkcyjnych. Wynik push i SHA w raporcie końcowym.

---

# Historia: implementacja i pierwsze kontrole, stan raportu 2e32b8d

Poniżej zachowano wcześniejsze wyniki. Informacje o niedostępnym Dockerze,
nieuruchomionym Cypress i starszych licznikach testów dotyczą tamtego przebiegu;
aktualny odbiór opisano powyżej.

Gałąź `codex/tito-lineups-completion`, osobny worktree `I:/slm/tito-lineups-completion`.
Baza: świeżo pobrany `origin/main` `51211af24479da9ee9dfef23df2fb400d72a9738`.
Implementacja jest przygotowana do przeglądu; **odbiór backendu pozostaje NOT RUN**.
Nie zastosowano migracji, backfillu, operacji Cloud ani wdrożenia.

Ponownie porównano końcówki `feat/tito-atomic-lineups` `771ee3f3f7d1140107431cd2e094e362288cabab`
i `feat/lineup-auto-refresh-20261107` `0db40505ea3b64a0fadf6d0f67a2951c6f42ad4d`.
Przeniesiono koncepcję transakcyjnego hooka i odświeżania, bez merge/cherry-pick
całych gałęzi. Migracje main, aktualne projekcje nazw/telefonów, finanse, Auth,
CI, strażniki, przypięcia i konfiguracja Vercel pozostały bez zmian.

## Reguły modułu

- Migracja `20261110205229_tito_lineups_completion.sql` jest nowym krokiem po
  48 migracjach main. Nie uruchamia uzupełniania danych. Punkty integracji
  sprawdzają dokładnie jedno wystąpienie w końcowej definicji funkcji;
  niezgodność przerywa całą transakcję migracji.
- `slm_matches_dispatch` nadal wykonuje istniejące autoryzacje, limit miejsc,
  blokadę zaległości, FIFO, rewizje finansowe, powiadomienia, historię i receipt.
  Hook w `matches_dispatch_core` działa po zwiększeniu wersji meczu, przed
  rewizją finansów i zapisem receipt. Błąd późniejszego etapu wycofuje też Tito.
- Oba dispatchery zachowują kolejność: globalna blokada `20261014,1`, konto,
  mecz, skład. Tito przejmuje ponownie blokady transakcyjne meczu i składu.
  Zmienia tylko wskazany wpis. Ręczne przypisania innych osób pozostają.
  Liczebność liczy wyłącznie aktywne `registered`; remis rozstrzyga `random()`.
- Przejście do rezerwy lub wypisanie usuwa aktywne przypisanie i zapamiętuje
  `lineup_last_team`. Wypisanie z rezerwy zachowuje wcześniejszą pamięć strony.
  Nie ma automatycznej promocji rezerwowego. Członek potwierdza rezerwę sam;
  administrator nie może potwierdzić jej za niego. Reguły obsługi gościa przez
  osobę odpowiedzialną/administratora pozostają w istniejącym dispatcherze.
- **Pełny powrót członka:** nowy zapis tworzy nowy ID udziału. Stronę bierze
  wyłącznie z ostatniego wycofanego udziału tego samego `member_id` w tym meczu
  (kolejno `withdrawn_at DESC`, `joined_at DESC`, `id DESC`). Jeśli ten ostatni
  wpis nie zna strony, nie szukamy starszego. Dla rezerwy używamy tego samego ID.
  W obu przypadkach preferencja obowiązuje tylko, gdy różnica po dołączeniu
  wynosi najwyżej jeden; inaczej wybieramy mniejszą drużynę.
- Gościa identyfikuje wyłącznie ID udziału. Nie ma wyszukiwania poprzedniego
  gościa po nazwie ani zapraszającym. Pamięć strony dotyczy jego własnego wpisu.
- `version`, `roster_version`, CAS i `request_id` pozostają obowiązujące.
  Replay zapisu meczu nie uruchamia hooka ponownie. Replay składu projektuje
  historyczny stan z aktualnymi uprawnieniami i zgodą na nazwę; klient po zapisie
  odczytuje bieżący stan, zamiast używać historycznego receipt jako bieżącego.
- `actor_type=manual|automatic` jest niezależny od nullable `updated_by`.
  Automatyczny Tito może zachować rzeczywiste konto inicjatora zapisu;
  backfill operatora nie wymyśla konta. Ręczny zapis resetuje znacznik na
  `manual`. Usunięcie konta zeruje referencję, zachowując typ. Stare receipts
  bez znacznika są traktowane jako ręczne, również po usunięciu autora.
- Bieżąca lista ukrywa wycofane wpisy członka mającego już `registered/reserve`.
  Pełny DTO, baza, historia i finanse zachowują wszystkie wpisy. Goście nie są
  deduplikowani. Opcjonalny `jersey_number` jest częścią istniejącej projekcji
  uprawnionych uczestników, przez jeden JOIN zamiast RPC profilu dla każdej osoby.
  Obie drużyny pokazują `0–99`, `—` przy braku i `G` dla gościa.
- Premium zachowuje boisko, geometrię, CSS i komponenty wizualne. Odświeżanie
  dotyczy aktywnego widoku online: po potwierdzeniu zmiany, powrocie/focus/online
  oraz co 15 s. Ukryte panele, profil, inne zakładki i tło nie odpytują składu.
  Jednoczesne sygnały powrotu są łączone. Szkic pozostaje w RAM przy konflikcie;
  spóźnione odczyty poprzedniej sesji, meczu lub rosteru są odrzucane.

## Zgodność starszego klienta

Test uruchamia rzeczywisty dekoder z `51211af`, bez uproszczonej imitacji.
PASS dla starych ręcznych receipts oraz nowej odpowiedzi automatycznej z
rzeczywistym UUID inicjatora; dodatkowe pola nie przeszkadzają staremu klientowi.
Nowy klient czyta zarówno stare ręczne odpowiedzi, jak i jawne typy nowych.

**FAIL zgodności starego klienta z autorem NULL:** po usunięciu inicjatora albo
backfillu operatora bez konta stary dekoder odrzuca saved lineup z NULL UUID.
Ręczny autor po erasure miał to ograniczenie już na main. Nie zastępujemy NULL
UUID-em widza ani fikcyjnym kontem Tito. Przed ewentualną publikacją/backfillem
potrzebna jest decyzja o aktualizacji klienta albo osobnym, wersjonowanym
mechanizmie zgodności. Nie deklarujemy pełnej zgodności starszego klienta.

## Rzeczywiste wyniki

| Kontrola | Wynik | Dowód / ograniczenie |
| --- | --- | --- |
| Osobny worktree, aktualne referencje, zachowanie historycznych migracji | PASS | Baza i końcówki powyżej; brak zmian starego checkoutu |
| `npm ci --ignore-scripts --no-audit --no-fund` | PASS | Istniejący lockfile, bez nowych zależności |
| `npm run build` (LIVE), `npm run build:premium-local` | PASS | Ostrzeżenia rozmiaru bundle; bez wdrożenia |
| `npm run lint -- .`, TypeScript, `npm run typecheck:edge` | PASS | Bez zmian handlera ani kontraktu autoryzacji |
| Ostatni pełny `npm run test.unit -- --run --maxWorkers=2` | FAIL | 541 PASS / 1 FAIL, 542 testy; niezmieniony B1App.test.tsx:48 oczekuje „Nie udało się zalogować”, UI zwraca „Nieprawidłowy login, numer telefonu lub hasło.” |
| Końcowe `vitest --run src/events --maxWorkers=2` | PASS | 92/92, 14 plików; obejmuje także później dodaną regresję spóźnionego potwierdzenia po Back |
| Chrome, `node scripts/test-tito-chrome.mjs` | PASS | 320/390 px, Light/Dark, dwa syntetyczne SessionManager, numery, lista wycofanych, konflikt/szkic/odświeżenie; kontrolowany transport, bez SQL/Edge |
| Cypress na lokalnym serwerze, `node scripts/test-tito-browser.mjs` | FAIL | Zainstalowany natywny Cypress 16.1.1 kończy start kodem 3221225501 (0xC000001D); testy nie wystartowały |
| `npm run verify:consolidation` | FAIL | Dokładna allowlista odrzuca nową migrację; strażnik niezmieniony |
| `node scripts/verify-frozen-ui.mjs`, `npm run test:premium-policy` | FAIL | Pierwsza blokada: niezmieniony `app/src/account-ui/model.ts`, hash main `0238b068…`, przypięcie oczekuje `799f9391…`; także nowe zmiany wymagają przeglądu przypięć |
| `python -B -m unittest discover -s scripts -p test_lineups_ci_context.py -v` | FAIL | 34 PASS / 1 ERROR z 35: Windows WinError 1314 przy tworzeniu symlinka; nie zmieniano uprawnień systemu |
| Preflight `prepare-stabilization-local.mjs` / `test-tito-local.mjs` | FAIL | Strażnik odrzuca nową gałąź; nic nie zapisano w bazie |
| Docker, port, identyfikator/etykieta/link Cloud | NOT RUN częściowo | Brak listenera 55321; Docker pipe `dockerDesktopLinuxEngine` niedostępny. Etykiety i brak linku nie mogły być potwierdzone; wymagane warunki zapisu nie są spełnione |
| Migracje od zera / syntetyczny upgrade 48→49 | NOT RUN | Zablokowane preflightem; przygotowano osobne SQL before/after |
| SQL/RLS składów, widoczności, prywatności, powiadomień, finansów | NOT RUN | Przygotowany runner istniejących suites i nowego `tito_lineups.sql`; nie użyto innej bazy |
| Równoległe ostatnie miejsce, oba wymuszone porządki manual/auto, retry, rollback | NOT RUN na SQL | Kod testów gotowy; brak uruchomienia nie jest PASS |
| Dry-run, apply dwa razy, rzeczywisty czas blokady | NOT RUN | Funkcja i testy gotowe; czasu blokady nie zmierzono |
| Dwie rzeczywiste sesje GoTrue→Edge→PostgreSQL, mobilne E2E | NOT RUN | Chrome powyżej sprawdza wyłącznie transport syntetyczny |
| Native sync/build/APK | NOT RUN | Brak zmian natywnych; nie synchronizowano artefaktów testowego wariantu do Androida |

## Lokalny odbiór po osobnym przeglądzie strażników

Nie zmieniać nazwy brancha, zmiennych CI ani przypięć, aby uruchomić testy.
Aktualny runner celowo zaczyna od istniejącego `assertIsolated()` i jest
zablokowany na tej gałęzi. Przygotowanie świeżego stosu wymaga najpierw
przeglądu właściciela; nie należy uruchamiać poleceń poniżej na używanym stosie.

1. Po zatwierdzeniu przygotowania: wyłącznie nowy projekt
   `slm-main-stabilization`, API `http://127.0.0.1:55321`, PostgreSQL `55322`,
   label `com.supabase.cli.project=slm-main-stabilization`, brak project-ref Cloud.
   Wszystkie migracje i funkcje pochodzą z `app/supabase` tej gałęzi.
2. Dla świeżej instalacji zastosować cały łańcuch w nowym stosie. Runner
   `node app/scripts/test-tito-local.mjs` z katalogu repo porównuje skopiowane
   migracje bajtowo po normalizacji CRLF, lokalny adres i etykietę, wiek
   kontenera względem utworzenia gałęzi i zerową liczbę kont/meczów przed zapisem.
   Istniejące testy SQL i nowa regresja wycofują własne fixture. Testy współbieżne
   pozostawiają wyłącznie syntetyczne dane w tym nowym stosie.
3. Upgrade jest osobnym nowym fixture, bez resetowania powyższego stosu:
   przygotować main48, wykonać `tests/support/tito_upgrade_before.sql`, zastosować
   tylko nową migrację, następnie `tests/tito_upgrade_after.sql` oraz kontrolę
   finalnych funkcji/ACL z `tito_lineups.sql`. Jeśli nie można uzyskać nowego
   zatwierdzonego stosu na wymaganym porcie bez naruszenia używanej bazy,
   pozostawić upgrade jako NOT RUN i zgłosić blokadę.
4. Uzupełnić rzeczywiste mobilne Edge E2E, własne finansowe FIFO/powiadomienia
   i pomiar locków. `test-tito-local.mjs` wymusza kolejność posiadacza blokady,
   zamiast akceptować losowy wynik wyścigu. `LOCK_ELAPSED_MS` obejmuje też
   uruchomienie procesów i kontrolowaną pauzę 300 ms; nie nazywać go samym
   czasem wykonania hooka. Osobno zmierzyć czas transakcji backfillu.

## Osobny backfill — tylko wybrane przyszłe mecze

`slm_private.tito_backfill(uuid[],boolean)` jest SECURITY INVOKER, pusty
search_path, bez EXECUTE dla PUBLIC/anon/authenticated/service_role.
To operacja właściciela bazy, nie endpoint aplikacji. Wymaga jawnej listy 1–100
UUID, odrzuca NULL, pomija odwołane i rozpoczęte mecze. Apply sprawdza warunki
ponownie pod blokadą i dopisuje wyłącznie brakujące aktywne ID. Kolejne apply
zwraca zero zmian. Dry-run nie bierze globalnej blokady i nie zapisuje niczego;
wynik może się zdezaktualizować przed apply.

Poniższe przykłady są runbookiem do zatwierdzonego fixture; nie uruchomiono ich
na produkcji. Lista UUID musi pochodzić z osobno zatwierdzonego wyboru meczów.

```sql
-- psql, po zweryfikowaniu izolacji; identyfikator syntetycznego upgrade fixture.
\timing on
begin;
set local lock_timeout='2s';
set local statement_timeout='10s';
select * from slm_private.tito_backfill(
 array['f0000000-0000-4000-8000-000000000004'::uuid], false);
rollback;
```

Apply jest osobnym uruchomieniem tej samej funkcji z `true`, z tymi samymi
timeoutami i natychmiastowym COMMIT po wyniku. Najpierw zapisać manifest
`event_id/version/roster_version/team_a/team_b` oraz planowane brakujące ID,
potem wynik i stan po apply. Zacząć od pojedynczego meczu. Globalna bramka
jest pobierana przez `pg_try_advisory_xact_lock`; zajęta zwraca
`tito_backfill_busy` bez oczekiwania. Blokady są trzymane do końca transakcji;
nie pozostawiać jej otwartej przy ręcznym przeglądaniu wyników.
Nie zadeklarowano bezpiecznego czasu wykonania bez pomiaru na fixture.

## Wycofanie bez utraty późniejszych zapisów

Błąd migracji wycofuje cały krok. Po zastosowaniu użyć nowej migracji naprawczej,
która usuwa wyłącznie dokładnie zidentyfikowany hook Tito z końcowego
dispatchera. Zachować kolumny, bieżące składy, rosnące wersje, udziały,
receipts, historię i finanse. Nie przywracać całej starej definicji dispatchera,
nie cofać łańcucha main i nie wykonywać resetu/down usuwającego dane.

Wycofanie konkretnego backfillu nie może polegać na nadpisaniu całych tablic
kopią „przed”. Gdy wersja i roster nadal odpowiadają manifestowi „po”, można
przygotować korektę tylko ID dodanych przez ten run, z CAS i nową wersją.
Jeśli zaszły późniejsze zapisy/ręczne zmiany, zachować bieżący stan i przygotować
korektę na jego aktualnej wersji; nie usuwać później dołączonych uczestników.
Każda produkcyjna migracja/backfill/naprawa wymaga osobnej decyzji właściciela.

## Publikacja kodu

Zwykły push wyłącznie nowej gałęzi jest autoryzowany przez zadanie i AGENTS.md.
Przed nim sprawdzono: oba `vercel.json` mają `git.deploymentEnabled=false`,
żaden workflow nie ma triggera push, brak aktywnego lokalnego pre-push hooka.
Nie uruchamiano workflow ręcznie. PR dopiero po akceptacji właściciela, merge
wyłącznie po osobnej wyraźnej zgodzie.

Wynik: implementacja `7c00085f72d031a0a53478b753e35f333f312335`, zwykły push
`origin/codex/tito-lineups-completion` **PASS**. Nie utworzono PR ani merge.

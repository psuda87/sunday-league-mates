# Tito — implementacja i granice odbioru, 2026-11-10

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

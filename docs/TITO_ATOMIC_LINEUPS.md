# Tito — atomowe składy (przygotowane, bez odbioru SQL)

Migracja `app/supabase/migrations/20261109230000_tito_atomic_lineups.sql` dodaje `lineup_last_team` do uczestnictw, dopuszcza pustego autora automatycznej zmiany i zmienia projekcję ostatniej zmiany na jawnego Tito. Poprzez kontrolowaną zamianę dokładnego fragmentu istniejącej funkcji zapisów wywołuje przydział po zmianie uczestnictwa, w tej samej transakcji i przed zapisem odpowiedzi idempotentnej. Przydział korzysta ze wspólnej blokady doradczej oraz blokady meczu i składu. Ręczne przypisania pozostałych osób nie są przemieszczane. Zmiana składu zwiększa wersję, a aktualny token rosteru uwzględnia nową wersję meczu. W razie remisu stosowane jest PostgreSQL `random()`.

Rezerwa zapamiętuje stronę przy identyfikatorze uczestnictwa. Powrót wybiera dawną stronę, jeżeli różnica nie przekroczy 1; w przeciwnym razie stronę mniej liczną. Wypis usuwa wyłącznie aktywne przypisanie. Goście mają osobne identyfikatory. Ponowny zapis po wypisaniu jest nowym uczestnictwem; przywrócenie poprzedniej strony dotyczy powrotu z rezerwy.

## Backfill i bezpieczeństwo

Sama migracja **nie wykonuje backfillu**. Tylko operator będący właścicielem funkcji może w izolowanej kopii uruchomić diagnostykę `select * from slm_private.tito_backfill(false);`. Zwraca identyfikatory przyszłych zaplanowanych meczów i liczbę braków, niczego nie zapisuje. Osobne `select * from slm_private.tito_backfill(true);` dopisuje wyłącznie brakujące aktywne uczestnictwa, zachowując istniejące przypisania; obejmuje tylko zaplanowane mecze jeszcze nierozpoczęte. Ponowne wywołanie nie dodaje duplikatów. Funkcja nie ma uprawnień dla `anon`, `authenticated` ani `service_role`. Nie uruchamiano jej na produkcji.

## Kontrole i blokady

- PASS: `npx tsc --noEmit`, `npm run lint`, `npm run build`, 26 testów `premiumLineupApi.test.tsx`, `node --check app/scripts/test-tito-concurrency.mjs`.
- PASS: parsowanie składni SQL i PL/pgSQL migracji i pliku testów przez pglast. To nie weryfikuje schematu, dynamicznego SQL ani działania bazy.
- NOT RUN: migracja w PostgreSQL, SQL/RLS, integracja dispatcherów, wyścigi i retry. `node app/scripts/test-tito-concurrency.mjs` korzysta z niezmienionego `assertIsolated()` i na obecnej gałęzi kończy się przed dostępem do bazy: strażnik wymaga `chore/main-stabilization` oraz przygotowanego stosu `slm-main-stabilization/55321`. Stos nie jest tutaj przygotowany. Nie zmieniano strażnika ani nie podszywano się pod CI.
- FAIL: `verify-frozen-ui.mjs` zgłasza `app/src/account-ui/model.ts`; jego hash odpowiada commitowi bazowego main 51211af, a nie oczekiwanemu przez strażnika. Błąd nie jest częścią tej zmiany; przypięć nie zmieniano.
- Testy przygotowano w `app/supabase/tests/tito_lineups.sql` i `app/scripts/test-tito-concurrency.mjs`. Nie są dowodem ich zaliczenia. Wymagają dopuszczonej przez właściciela ścieżki testowej dla tej gałęzi i nowego, izolowanego stosu ze wszystkimi migracjami tej gałęzi. Nie kierować runnera na istniejącą bazę ani Cloud.

## Plan odbioru, wdrożenia i wycofania

1. Przegląd SQL, ACL, treści dynamicznej aktualizacji funkcji, blokad i zgodności kontraktu wraz z testami RLS oraz konkurencji na nowym stosie testowym. Sprawdzić obie kolejności zapisu administratora i uczestnika, retry, wycofanie i ponowny zapis, gości, wszystkie scenariusze rezerwy, anulowane i historyczne mecze. Dopóki te kontrole nie przejdą, migracja nie jest gotowa do wdrożenia.
2. Przed ewentualnym osobno zatwierdzonym wdrożeniem: sprawdzić wersje funkcji i komplet poprzednich migracji, przygotować oraz sprawdzić odtworzenie kopii danych i plan wycofania, zmierzyć czas blokady globalnej. Wykonać próbę migracji i backfillu na izolowanej kopii. Migracja abortuje przy innej zawartości fragmentu funkcji zapisów.
3. Po wdrożeniu samej migracji i kontroli wersji danych wykonać diagnostykę backfillu, sprawdzić listę z właścicielem i dopiero na osobną decyzję uruchomić apply. Backfill jest jedną transakcją i może utrzymywać blokadę globalną przez dłuższy czas. Zachować migawkę przed zastosowaniem, zwłaszcza ręcznych składów.
4. Wycofanie wymaga kontrolowanej migracji naprawczej przy zachowaniu zmian powstałych po wdrożeniu: przywrócenia poprzedniego dispatchera i projekcji, rozwiązania rekordów `updated_by IS NULL` bez przypisywania ich fikcyjnemu użytkownikowi, oraz decyzji o zachowaniu przydziałów i historii. Nie stosować automatycznie `DROP COLUMN` ani odtwarzania starej kopii na żywej bazie: groziłoby to utratą późniejszych zmian. Schemat wycofania i odtworzenie trzeba przećwiczyć przed wdrożeniem.
5. Ręczny odbiór telefonu (NOT RUN): zapis i odświeżenie składu, oznaczenie Tito, gość, przejście do rezerwy i powrót w obu układach liczebności, wypis, równoczesny zapis i edycja administratora oraz komunikat konfliktu. Sprawdzić widoczność według uprawnień i oba motywy.

Znane ryzyko: serwerowe funkcje i testy jeszcze nie zostały wykonane w PostgreSQL; składnia ciał PL/pgSQL, ACL, integracja z aktualnym schematem i zachowanie blokad wymagają faktycznej weryfikacji. Brak zmian Auth, finansów, UI/CSS, Vercel i produkcyjnego Supabase.

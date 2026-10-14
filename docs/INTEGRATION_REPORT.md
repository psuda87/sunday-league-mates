> Aktualizacja 14.10.2026 po dalszych kontrolach: bieżące wyniki i blokada Docker w [LOCAL_VERIFICATION.md](LOCAL_VERIFICATION.md). Poniższy raport opisuje pierwszy etap; historyczne NIE WYKONANO dla Vitest/Cypress jest już zastąpione wynikami nowego raportu. SQL/Android pozostają niewykonane.

# Integracja wydarzeń, rozliczeń i powiadomień — etap 1

Data: 14.10.2026. Worktree: `I:/slm/sunday-league-mates-integration`.
Branch lokalny: `feat/integration`. Baza: `origin/feat/events` — `6638e18`.
Integracja: najpierw `origin/feat/settlements` — `81d71c7fb24dc4b410f178c3fa4101a5fa2ce410`,
następnie `origin/feat/push-notifications` — `103d08c0dd12e4c0aa59e7d2402d2b02ba0e52b3`.
Pierwsze połączenie fast-forward, drugie lokalny merge z dwoma rodzicami,
zawierający rozwiązania konfliktów i poprawki integracji. Bez pusha ani zmian innych gałęzi.
Oryginalny katalog zachował feat/events i nieśledzony pics/. Nie skopiowano .env/PAT/kont.

## Konflikty i rozwiązania

Sześć konfliktów Git:

- `AGENTS.md`: aktualny etap integracji zastępuje historyczne ograniczenia Cloud;
  tylko typy/lint/build, bez bazy, Firebase i wdrożeń.
- `README.md`, `docs/STATUS.md`: jeden aktualny opis obu modułów, z rozróżnieniem
  dawnych testów wydarzeń od niewykonanych testów integracji.
- `Accounts.tsx`: zachowano oba ekrany i przyciski — Rozliczenia i Powiadomienia,
  licznik inbox, deep link wydarzenia, lifecycle push i bezpieczny logout.
  Własne powiadomienie kategorii finance otwiera rzeczywisty ekran Rozliczeń.
- `Events.tsx`: zachowano sprawdzanie zaległości i panel rozliczenia meczu,
  dodając otwieranie wskazanego meczu z własnego powiadomienia.
- `accounts/handler.ts`: zachowano niezależne routingi settlements_ i notifications_,
  capability detach, istniejącą bramę Auth oraz oba zestawy błędów zapisów.

Konflikt semantyczny bez markerów Git: szósta migracja powiadomień zastępowała
slm_events_dispatch bazową wersją wydarzeń, co usuwałoby część logiki finansowej.
Zawiera teraz pełny finansowy RPC wraz z filtrem notification_registration_allowed,
zgodnym z finance_dues, walidacją kwot, powodem odwołania zatwierdzonego meczu,
blokadą starej ścieżki obecności i flagą settlements_active=true.
Summary z trzeciej migracji finansowej pozostaje aktywne; nie przywrócono szacunku
z events zamiast rzeczywistego rozliczenia. Zapis/rezygnacja i goście korzystają
z istniejącej historii, limitu oraz kontroli uprawnień. Rezerwa nie awansuje sama.

## Kolejność dokładnie sześciu nowych migracji

Po wcześniejszych migracjach Auth i wydarzeń:

1. `20261014100000_settlements_ledger.sql`: kwoty w groszach, stan roboczy,
   rewizje/pozycje, wpłaty, nieusuwalny ledger/audyt, RLS, FIFO i trigger historii.
2. `20261014101000_settlements_rpc.sql`: zweryfikowane operacje finansowe,
   zatwierdzenie po końcu, korekty, obecność niezależna od obowiązku opłaty,
   idempotencja i rozstrzyganie UUID po restarcie.
3. `20261014102000_settlements_events_integration.sql`: nieusuwalna historia events,
   blokada dwóch różnych zaległych meczów i finansowe podsumowanie.
4. `20261014120000_notifications_core.sql`: inbox/preferencje, urządzenia,
   outbox/reminders, RLS, źródła i trigger wydarzeń, kontrakt finansowy.
5. `20261014121000_notifications_rpc_and_worker.sql`: centrum, odczyt/przeczytanie,
   capability detach, claim/check/finish, sesje i filtr uprawnień dostawy.
6. `20261014122000_notifications_events_eligibility.sql`: połączony RPC wydarzeń
   oraz adapter transakcyjny obu modułów finansów/powiadomień.

Nie wykonano żadnej migracji. Zmiany pliku szóstego dotyczą niewdrożonych migracji
z gałęzi Cloud; nie zmieniano zastosowanych migracji bazowych Auth/events.
Nie dodano siódmej nowej migracji. Harmonogram w operations/enable_push_schedule.sql
jest osobną, niewykonaną operacją — nie jest automatycznie uruchamiany przez migracje.

## Adapter finansowy i zgodność serwera

Publiczne slm_events_dispatch i slm_settlements_dispatch mają takie same sygnatury
jak przed integracją. Ich kompletne rdzenie przeniesiono do slm_private;
publiczne wrappery oraz rdzenie są SECURITY INVOKER, search_path='', EXECUTE
wyłącznie dla service_role. Zachowano powtórną kontrolę sesji/roli/hasła w rdzeniach.
RLS i klientowe granty tylko odczytu pozostają; brak klientowego emitera finansów.

Wrapper trzyma wspólny advisory lock `(20261014,1)` przed stanem sesji i meczem,
odczytuje projekcję blokad przed zapisem, wykonuje rdzeń, potem odczytuje ją ponownie.
Nie wysyła powiadomień od stanu pośredniego poszczególnych pozycji ledger.
Emitowane są wyłącznie:

- accept_payment / reject_payment na podstawie rzeczywistego audytu pending →
  accepted/rejected; source_key = finance:payment:<payment_id>:<audit_id>;
- zmiana liczby różnych meczów z długiem przez próg 2, na podstawie finance_dues:
  finance:block:<user_id>:<audit_id>. Kolejny cykl ma nowy audyt, retry tego samego
  żądania nie dopisuje audytu ani drugiego powiadomienia.

Źródło/inbox/outbox oraz księgowanie/audyt commitują się lub rollbackują razem.
Zdarzenie finansowe i cel nawigacji pochodzą z potwierdzonego wyniku/audytu rdzenia,
a nie opcjonalnego event_id podanego przez klienta. Odwołanie/korekta/weryfikacja
wpłaty obejmuje wszystkich dotkniętych płatników, w tym odpowiedzialnych za gości.
Rekordowanie wpłaty administratora może odblokować konto, ale nie udaje zatwierdzenia
zgłoszenia zawodnika. Odczyty i resolve_request nie emitują zdarzeń finansowych.
Snapshot blokad obejmuje zamkniętą grupę; koszt tego odczytu trzeba zmierzyć lokalnie.

Trigger historii finansów wykonuje się przed slm_notification_events; powiadomienia
wolnego miejsca zachowują filtr długów i nie rezerwują miejsca. Następny zapis
sprawdza uprawnienia/limit/termin ponownie pod tą samą blokadą grupy.
Adapter dotyczy zwykłych transakcji przez publiczne RPC; właściciel omijający je
bezpośrednim SQL nie otrzymuje gwarancji emitowania tych zdarzeń.

Edge: accounts (Auth/API), push-worker (dedykowany sekret), lokalny example entrypoint
accounts. Nie wdrożono ich ani nie włączono schedulera. Brak Firebase nie blokuje
inbox; worker bez konfiguracji FCM nie claimuje dostaw. Rzeczywista wysyłka niewykonana.

## Zależności i wykonane kontrole

Zachowano package-lock.json. Jedyny nowy pakiet runtime względem events:
`@capacitor/push-notifications@8.0.0`, zgodny z Capacitor 8. Nie dodano nowych
pakietów integracyjnych. npm ci z istniejącego lockfile: OK (765 pakietów).
CYPRESS_INSTALL_BINARY=0 świadomie pominęło pobieranie binarium; nie jest to test Cypress.

- TypeScript klienta (`npx tsc --noEmit`): OK.
- Strict TypeScript accounts/worker/FCM i lokalnego example entrypoint: OK.
- ESLint: OK, bez błędów/ostrzeżeń po poprawkach. Pierwszy przebieg: dwa nieużywane
  parametry mocka workera oraz dwie ostrzeżone zależności hooków. Naprawiono typed mock
  i jawny stabilny setter błędu; nie dodano niestabilnego całego op do dependencies.
- npm run build: OK; ostrzeżenie chunków >500 kB, bez zmiany limitu ostrzegania.
- git diff --check / brak markerów konfliktów: OK po rozwiązaniu.
- Nie uruchomiono Vitest, SQL, Cypress, Androida, migracji ani dostaw FCM.
  npm wypisał ostrzeżenia deprecated dla istniejących zależności; nie aktualizowano
  ich poza lockfile i nie wykonywano npm audit fix.

## Gotowość następnego etapu i ograniczenia

Kod przygotowany do rozpoczęcia **izolowanych lokalnych testów Supabase**.
Nie jest to dowód poprawności migracji, RLS, FIFO ani adaptera: bez wykonania SQL
nie można uznać tych scenariuszy za zaliczone. Docker, Supabase CLI i Deno nie są
obecnie dostępne w PATH; nie instalowano ich ani nie uruchamiano usług.

Worktree ma ignorowany app/.env.local z wyłącznie lokalnym VITE_SLM_FUNCTION_URL
(http://127.0.0.1:54321/functions/v1/accounts). Nie ma w nim sekretów. Default push
pozostaje wyłączony. Przed następnymi testami accounts trzeba serwować przez
przygotowany local-entrypoint.example.ts (runtime produkcyjnego index.ts blokuje
lokalne URL). Nie deployować przykładu i nie kopiować PAT/kluczy produkcyjnych.

Następny etap po poleceniu użytkownika:

1. Jednorazowy lokalny Supabase, wszystkie bazowe i sześć nowych migracji;
   sprawdzenie kompilacji i grantów wrapperów/rdzeni, RLS i kolejności triggerów.
2. SQL oraz prawdziwe równoczesne RPC: ostatnie miejsce, wpłata kontra zapis,
   FIFO/goście, zatwierdzenie i korekty, cancel, obecność, accept/accept i accept/reject,
   ponowienie request_id i wycofanie transakcji.
3. Dokładnie jeden inbox na audyt/źródło, blokada→odblokowanie→blokada,
   brak emitowania po rollback i brak blokady aplikacji bez Firebase.
4. Dopiero potem unit/Cypress, cap sync i Android; binarium Cypress wymaga instalacji
   przed tym etapem. iOS, realne FCM i Firebase pozostają osobnym niezweryfikowanym etapem.

Stare test-events/test-accounts z usuwaniem danych nieusuwalnej historii wymagają
adaptacji; nie uruchamiać ich na zdalnym projekcie. Przygotowane SQL fixtures kończą
się ROLLBACK, ale nie dowodzą prawdziwych JWT ani pełnej równoczesności.
CAPTCHA i dodatkowe ręczne testy offline/starych sesji są odłożone; nadal niezaliczone.

Źródła przeglądu: [Supabase funkcje](https://supabase.com/docs/guides/database/functions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[ochrona Edge](https://supabase.com/docs/guides/functions/auth),
[changelog](https://supabase.com/changelog).

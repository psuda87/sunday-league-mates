# Premium B2/B3 — publiczny pseudonim, nazwa globalna i prywatność

2026-10-26 13:20:55 CET. Baza main `edd2e924cc077c67ba804ed4acab6d3e159a15b1`.
Gałąź `feat/premium-profile-name-privacy`. Początkowo czysty Git. PR14/15 i main
nietknięte; analizę PREMIUM_PROFILE_NAME.md odczytano przez refs/pull/15/head.
Nie scalano PR ani nie wdrażano. Supabase Cloud pozostał **nietknięty**.

## Zakres implementacji

Nowy edytor Premium obsługuje pseudonim oraz nickname/first_name/full_name,
podgląd draftu, walidację, anulowanie bez wywołań, Akceptuję/Anuluj i blokadę
równoczesnych zapisów. Używa istniejącego bindingu profilu, karty Ultimate i tokenów
Light/Dark; nie zastępuje prawdziwego profilu fixture. Techniczny login pozostaje
odrębnym polem. Zmiana publicznego pseudonimu nie wywołuje identifiers/Auth,
nie zmienia telefonu/e-mail/hasła/UUID/roli i nie odnawia sesji. Pseudonimy nie
muszą być unikalne. Dotychczasowe konta zachowują swoje pola i ustawienia.

Imię jest NOWYM jawnym polem first_name, domyślnie pustym. Nie zgadujemy go z
full_name i nie przenosimy do niego całego historycznego pola. Puste imię/nazwisko
w wybranym wariancie daje pseudonim. Nie przepisano istniejących nazwisk/aliasów.

## Nowa migracja i kontrakty

`app/supabase/migrations/20261026120000_premium_profile_name.sql` wymaga całego
main, w szczególności B2.2, B3 privacy i phone_receipt_privacy. Zastosowano ją
wyłącznie do nowej izolowanej bazy testowej Docker. Historyczne migracje bez zmian.

- CHECK display_as: nickname/first_name/full_name, jedno ustawienie konta.
- slm_profiles.first_name i slm_group_members.share_first_name, domyślnie ''/false.
  Nie zmieniają istniejących zgód share_full_name ani RLS. Zgoda na samo imię NIE
  dopuszcza surowego wiersza z nazwiskiem przez PostgREST/RLS.
- `save_premium_profile` w istniejącym accounts, RPC slm_premium_profile_save:
  nickname, first_name, full_name, display_as, jersey_number, group_scope,
  accept_disclosure, request_id. Wykonawca i sesja pochodzą z istniejącego context,
  nie z body. Jeden SQL transaction + istniejący advisory lock B3, idempotency key,
  walidacja i kontrola rzeczywistego zakresu członkostw. Bez zmian Auth/sekretów.
- Scope jest listą UUID WSZYSTKICH OBECNYCH NIEARCHIWALNYCH grup użytkownika.
  Potwierdzenie wyjaśnia ten zakres i liczbę grup. Zmiana członkostwa przed zapisem
  powoduje stale_scope, bez zapisu. Nowe członkostwa nie dziedziczą zgód.
- profile DTO dodaje nickname/first_name/group_scope; save_profile akceptuje także
  first_name, ale stary endpoint nie udziela żadnej nowej zgody. Nowy edytor
  korzysta wyłącznie z atomowego save_premium_profile i jawnego profile read-back.
- Serwerowa profile_display_name stosuje tryb globalny dopiero po kontroli relacji
  i odpowiedniej zgody. Group DTO ma display_name niezależnie od raw full_name.
  Lista i karta grupy, LIVE lista członków, szczegóły zapisu, etykiety osób w
  rozliczeniach i zgłoszeniach używają bezpiecznej projekcji. Publiczne wyszukiwanie
  kandydatów/etykiety bez zweryfikowanego kontekstu nadal zwracają pseudonim.
- Grupy consent otrzymuje confirm_nickname. Cofnięcie zgody przy trybie osobowym
  wymaga tego potwierdzenia i atomowo ustawia nickname + cofa zgodę w danej grupie.
  Powtórzony request_id nie wykonuje drugi raz zależnych zmian. Podstawowe reguły
  członkostwa, finansów i zgód pozostają w dotychczasowych dispatcherach.
- Dopasowania pg_get_functiondef zmieniają TYLKO wyrażenia etykiet z istniejącym
  viewer/group; wymagają oczekiwanego kontraktu i przerywają migrację przy rozjeździe
  upstream, zamiast cicho pomijać ochronę. Nie zmieniono obliczeń finansowych.

## Scenariusze A–G

| Scenariusz | Zachowanie |
|---|---|
| A | Nickname pozostaje nazwą mimo dostępnego full_name w szczegółach dla uprawnionych |
| B | Imię bez zgody: potwierdzenie → globalne first_name i share_first_name w aktualnym scope; nazwisko nadal ukryte |
| C | Full name bez zgody: potwierdzenie → globalne full_name i share_full_name w aktualnym scope |
| D | Samo włączenie istniejącego udostępniania nie zmienia display_as i nie wymaga potwierdzenia zmiany nazwy |
| E | Wyłączenie przy trybie osobowym: potwierdzenie → nickname globalnie, zgoda cofnięta tylko w tej grupie; inne zgody pozostają |
| F | First→full wymaga potwierdzenia, jeżeli w dowolnej obecnej grupie brakuje zgody na nazwisko; istniejące pełne zgody bez dodatkowego okna |
| G | Sam wybór nickname nie cofa żadnej zgody |

Przy first-only w grupie dostępna jest akcja „Ukryj udostępnione imię”; istniejący
suwak nadal dotyczy pełnych danych. Nie dodano ekranów konfiguracji per grupa ani
formatów nazwy per grupa. Wyjątek B3 właściciela i administratora do danych pełnych
zachowany i opisany w interfejsie — ukrycie przed członkami nie ukrywa przed adminem.
Outsider nie dostaje grupowego profilu. Nigdy nie przekazujemy nazwiska klientowi
wyłącznie po to, by dopiero klient je ukrył.

Zmiana wobec analizy PR15 jest świadoma: jej zalecenie „nie zmieniać zgód przy
wyborze formatu” zastępują ostateczne scenariusze B/C/E niniejszego zadania.
Nie włączamy zgód automatycznie przy samej zmianie suwaka/bez potwierdzenia.

## Weryfikacja — wykonane i niewykonane

| Test | Wynik |
|---|---|
| TypeScript | PASS |
| Pełny ESLint | PASS |
| Vitest | PASS 248/248,42 pliki; 7 nowych testów edytora, atomowy adapter/read-back i dotychczasowe Auth/sesje |
| Build aplikacji | PASS, pozostają ostrzeżenia wielkości chunków |
| SQL/RLS lokalny kontrakt | PASS 28 asercji: trzy tryby, legacy/e-mail, A–G, dwie grupy, cofnięcie, admin/outsider/raw RLS, scope, idempotency i brak zmiany sesji/loginu |
| Replay | PASS 35 kanonicznych migracji na świeżym PostgreSQL17 |
| Restart PostgreSQL | PASS pseudonim zachowany po restarcie kontenera |
| Build demo | FAIL: allowlista odrzuca src/native/frozenDemoAndroid.ts. Identyczny błąd odtworzony na czystym main edd2e92; nie obchodzono allowlisty |
| Pełne Supabase Auth + PostgREST + Edge HTTP | NOT TESTED — CLI2.121.0 EROFS przy tworzeniu /home/agent/.supabase; starszy installer CLI zakończył się błędem. Nie potwierdzamy pełnego E2E |
| Restart aplikacji/logowanie i powtórny odczyt przez rzeczywisty Auth | NOT TESTED; persistence sprawdzona na PostgreSQL, read-back adaptera testem kontrolowanego API |
| Fizyczny Android, klawiatura, dark/light, komunikaty Ionic na urządzeniu | NOT TESTED |
| Supabase Cloud | Brak odczytów/testów kont/migracji/deploy/Storage/Auth zmian |

SQL uruchomiono na **rzeczywistym PostgreSQL z fixture kontraktów auth/storage**,
nie na pełnej instalacji Supabase. Funkcje SQL/RLS/sesje domenowe są rzeczywiste;
auth.uid()/jwt() oraz auth.users/sessions w bootstrapie to kontrolowany testowy
kontrakt, nie walidacja kryptograficzna JWT ani prawdziwe logowanie. Nie wolno
nazywać tego testem pełnego Supabase ani gotowością produkcyjną.

Powtarzalna kontrola z app: `node scripts/test-premium-profile-sql-local.mjs`.
Tworzy TYLKO nowy kontener slm-profile-contract-<UUID>, --network none, bez portów,
replay +28 asercji + restart + porównanie nazwy; usuwa tylko swój kontener. Żadnego
resetu lub ponownego stosowania migracji do istniejącej bazy. Support bootstrap
jest przeznaczony WYŁĄCZNIE dla tej pustej bazy, nigdy dla prawdziwego Supabase.

## Ryzyka i odbiór lokalny przed merge

1. Na pełnym lokalnym Supabase sprawdzić kontrakt PostgREST własnego profilu
   (join aktywnych grup), routing nowego RPC, normalne logowanie i refresh obu
   rodzajów kont. Nie przenosić tej gałęzi do Cloud bez osobnego polecenia.
2. Zweryfikować HTTP próby obcego user_id, cofnięcie zgody przy otwartej karcie,
   restart aplikacji, opóźnione odpowiedzi i concurrent membership changes. Modele
   mają blokady/generation guards, ale E2E tutaj nie zastępuje SQL/fixture.
3. Na telefonie sprawdzić 320/390px, light/dark, selektor, preview, anulowanie obu
   okien, podwójny tap, brak sukcesu po błędzie sieci i zachowanie sesji. APK/config
   pl.psuda87.slm, Capacitor sync oraz Auth/tokenStore niezmienione.
4. Starsze klienty nie znają first_name/nowego potwierdzenia cofania zgody; serwer
   odmówi niepotwierdzonej mutacji zamiast zostawić ujawniającą nazwę. Aktualizować
   aplikację i backend lokalnie razem. PUBLIC candidate search celowo bez nazwisk.
5. Full-name history nie jest dzielona. Użytkownik wypełnia jawne imię przed jego
   wyświetlaniem; brak wartości daje pseudonim. Nie dopisano nazwisk automatycznie.

## Zmienione pliki

- `app/scripts/test-premium-profile-sql-local.mjs`
- `app/src/auth/api.ts`
- `app/src/auth/profileAdapter.test.tsx`
- `app/src/auth/profileAdapter.ts`
- `app/src/auth/uiAdapter.ts`
- `app/src/auth/useOwnProfile.ts`
- `app/src/demo/GroupScreens.tsx`
- `app/src/demo/Identity.tsx`
- `app/src/groups/GroupControls.tsx`
- `app/src/groups/PremiumGroups.tsx`
- `app/src/groups/model.ts`
- `app/src/groups/useGroups.ts`
- `app/src/live/Groups.tsx`
- `app/src/profile/PremiumIdentityEditor.test.tsx`
- `app/src/profile/PremiumIdentityEditor.tsx`
- `app/src/theme/variables.css`
- `app/src/ui/personalProfile.ts`
- `app/supabase/functions/accounts/handler.ts`
- `app/supabase/migrations/20261026120000_premium_profile_name.sql`
- `app/supabase/tests/premium_profile_name.sql`
- `app/supabase/tests/support/profile_contract_bootstrap.sql`
- `app/vite.demo.config.ts`
- `docs/ODPOWIEDZI_CODEX.txt`
- `docs/PREMIUM_PROFILE_IMPLEMENTATION.md`
- `docs/STATUS.md`

Commit i stan Draft PR zostaną dopisane po zapisie Git. Implementacja do przeglądu,
nie potwierdzenie pełnej integracji/produkcji. Bez merge i bez zmian PR14/15.

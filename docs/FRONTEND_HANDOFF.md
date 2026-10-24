# FRONTEND SLM 1.0 — przekazanie do integracji

Stan: Premium3.18 na feat/ui-beta. Frontend i deterministyczne demo są przygotowane
 do integracji; cała aplikacja NIE jest gotowa produkcyjnie. Nie uruchomiono backendu,
 migracji, serwera poczty, Firebase ani wdrożenia. Zakończono zakres3.18.

## Co jest gotowe, a co wymaga serwera

| Obszar | Gotowe UI / pamięć demo | Istniejący kod produkcyjny / brak integracji |
|---|---|---|
| Konta | E-mail/hasło, rejestracja, zgoda, weryfikacja, odzyskiwanie i zmiana hasła, sesja/błędy | Produkcja nadal login/telefon + konta administratora; samorejestracja/e-mail NIE są podłączone |
| Pierwszy profil | Pseudonim, opcjonalne imię/nazwisko, numer0–99, fikcyjny portret lub inicjały;0/0/0/0 | Brak serwerowego kontraktu numeru, zdjęcia i onboardingu |
| Mecze | Lista/filtry, tworzenie/edycja/podgląd, groupId/createdBy/private/public, własny udział outsidera | Istniejące events_* i SQL nie zawierają pełnego modelu wielogrupowego3.16 |
| Grupy | Tworzenie, wyszukiwanie, zgody, zaproszenia/propozycje/wnioski, organizator, sukcesja | GroupState/reducer tylko RAM; brak odpowiadających tabel/RPC/RLS |
| Udział | Zapisy/rezygnacja, goście/usuwanie, rezerwa, obecność | Istniejący moduł events_*; potrzebna rzeczywista regresja z bazą |
| Składy | Boisko, znaczniki/profil, ręczna zamiana/reset | Brak produkcyjnego zapisu składów; nie dodano algorytmu |
| Finanse | Panel roli/własnych pozycji, demonstracyjne statusy/wpłaty w groszach | Osobny rzeczywisty ledger/FIFO/RPC jest w repo, migracje integracji niezweryfikowane |
| Powiadomienia | Dotychczasowe produkcyjne komponenty/kontrakty zachowane | Wysyłka/FCM/scheduler niewdrożone i nieprzetestowane w tej pracy; nie dodano do demo |
| Wygląd | España domyślna, FCB/Lime/Deimos opt-in demo, Light/Dark/Auto | España w produkcji; nie aktywowano tam dodatkowych palet |

## Wspólne komponenty i granica demo

- app/src/account-ui/Fields.tsx: wspólne AccountHeading, SignInFields i PasswordField.
  Accounts.tsx używa wariantu Ionic/legacy z tymi samymi etykietami i operacjami.
  Dodano pokaż/ukryj hasło i blokadę równoczesnego wysyłania formularza; nie
  zmieniono SessionManager, magazynu sesji, Auth API ani uprawnień.
- AccountScreens.tsx: jeden zestaw prezentacyjnych ekranów kont z portem operacji.
  AccountDemo jest małą bramą do ISTNIEJĄCEGO App demo, nie drugą aplikacją.
- ui/UltimatePlayerCard.tsx jest bajtowo identycznym przeniesieniem komponentu3.10.
  demo/UltimatePlayerCard.tsx to zgodny re-export. Nie zmieniono tarczy/stylu/zasobów.
- MatchHeader/Hero/Tabs, istniejące moduły demo, theme.ts/AppearanceSettings i tokeny
  pozostają wspólne. Nie powielano event/group reducerów ani listy zawodników.
- build:demo ma ścisłą allowlistę modułów/zasobów, envDir:false, envPrefix:[],
  publicDir:false; dist-demo zawiera15 plików. AccountScreens jest dozwolonym UI,
  auth/api.ts, SessionManager i auth/uiAdapter.ts NIE wchodzą do demo. CSP nadal
  connect-src none / form-action none. app/vercel.json bez zmian, brak env demo.

## Istniejący kontrakt Auth — nie zastępować go atrapą

Źródła: app/src/auth/api.ts, sessionManager.ts, tokenStore.ts, pages/Accounts.tsx,
app/supabase/functions/accounts/handler.ts, docs/AUTH_MODULE.md i AUTH_PROOF.md.

POST istniejącego endpointu accounts używa body {action,...values} i Bearer sesji.
Session: access_token, refresh_token, expires_in, user_id, role(member/admin),
must_change_password. Profile: user_id, login, phone, full_name,
display_as(nickname/full_name), display_name. ManagedAccount rozszerza rolą i stanem
operacji. Nie traktować wartości roli z UI jako autoryzacji.

Obecne operacje: login, refresh, logout, status, profile, save_profile,
password, identifiers; administracyjne list_accounts/create_account/reset_password.
Legacy login przyjmuje identifier, nie nowy adres e-mail. password wymaga
current_password/new_password i obecnego SessionManager.changeSession; save_profile
przyjmuje full_name/display_as. Nowy auth/uiAdapter.ts wiąże wyłącznie te ISTNIEJĄCE
metody, z capabilities selfRegistration/emailVerification/emailRecovery=false.
Nie uruchomiono tych metod na żadnym rzeczywistym koncie w3.18.

AccountUiPort w account-ui/model.ts to porty PREZENTACJI, nie nowe endpointy:
signIn/signUp/signOut/resendVerification/requestPasswordReset/updatePassword/
restoreSession/completeRedirect/saveProfile. AccountDemo implementuje je lokalnie,
bez weryfikowania haseł lub zakładania kont. Adapter email/Supabase tych portów
pozostaje do wykonania po uzgodnieniu kompatybilnego kontraktu serwera.

Rzeczywista rozbieżność: dotychczasowy Auth używa technicznego UUID@slm.invalid,
loginu/telefonu, disable_signup=true i blokujących hooków e-mail/SMS; nie ma SMTP
ani recovery self-service. Zob. configure-accounts.mjs/AUTH_MODULE.md. Nie wolno
po prostu włączyć nowego formularza na obecnym endpointcie ani usuwać session gate.
Potrzebna osobno autoryzowana migracja modelu kont, potwierdzania i dostarczania
poczty. Dotychczasowe konta i ich bezpieczeństwo muszą zostać zachowane.

Nowy formularz normalizuje e-mail trim/lowercase; hasło min8 znaków i max72 bajty
UTF-8, potwierdzenie i pokaż/ukryj. Pseudonim1–48 nie jest aliasem loginu3–32;
backend musi jawnie rozdzielić te pojęcia. Telefon opcjonalny w UI, wymagany w
obecnym kontrakcie aliasów — wymaga rozwiązania przed uruchomieniem rejestracji.
Zgoda w demo nie jest produkcyjnym rejestrem zgód. Brak zatwierdzonych docelowych
regulaminu i polityki prywatności jest blokadą uruchomienia produkcyjnej rejestracji.

## Sesje, callbacki i dane profilu

Produkcja: SessionManager zachowuje checking/ready/signed_out/unavailable/storage_error,
rotację i serializację refresh, unieważnianie generacji logout i wymuszoną zmianę
hasła. TokenStore pozostaje bez zmian: tylko refresh token, magazyn natywny zgodnie
z AUTH_MODULE, osobna jawna polityka web. Nie przepinać produkcji na symulator.

Demo: domyślny widok świata to jawny podgląd fixture BEZ sesji. Narzędzia demo →
Ekrany kont albo #account/login rozpoczynają symulator. #account/register i
#account/forgot są prezentacją; #account/verify i #account/recovery bez zweryfikowanego
wyniku pokazują błąd linku. Sam URL ani dowolny fragment nie autoryzuje użytkownika.
Poprawny link emuluje wyłącznie jawna kontrolka symulatora; przyszły adapter musi
przetworzyć i potwierdzić wynik Supabase przed otwarciem właściwego ekranu.

Nie ma trwałych sesji/kont demo ani magazynu haseł. Formularze mają hasło wyłącznie
w chwilowym stanie komponentu i czyszczą je po operacji/odmontowaniu. Symulator
nigdy ich nie przechowuje/porównuje, nie loguje ani nie wysyła. Utrata sesji,
wylogowanie, zmiana użytkownika/przejście do kont usuwa poprzedni świat/ramki i
anuluje spóźnione logowanie. Powrót do bezpiecznego modułu events/groups/profile,
bez odtwarzania cudzego profilu/konkretnego prywatnego wydarzenia.

ProfileDraft to UI: nickname, fullName, opcjonalny phone/jerseyNumber/portrait.
accountPlayer przekazuje do wspólnego World tylko jawne pola publiczne: id,
name/nick/fullName, opcjonalny numer/portret oraz zerowe demoTotals. Brak e-maila,
telefonu, hasła na karcie lub w publicznej projekcji. Nowy id demo-new-player jest
stabilny tylko w tej symulowanej sesji; to NIE konto ani identyfikator Supabase.
Brak automatycznych grup, statystyk i uczestnictwa. Dotychczasowa edycja numeru,
profilu/zdjęcia jest wykorzystywana ponownie; brak uploadu lub localStorage zdjęć.
Reset nowego użytkownika zachowuje jego tożsamość i przywraca początkowy świat
bez jego nowo utworzonych grup/meczów. Preferencje wyglądu nie są kasowane.

## Grupy i wydarzenia: oczekiwane zachowanie, nie wymyślone API

Autorytatywna specyfikacja UI/modelu: demo/groups.ts, eventAccess.ts, eventDraft.ts,
data.ts oraz PREMIUM315_GROUPS.md/PREMIUM316_EVENTS.md. GroupState zawiera grupy,
członkostwa organizer/joinedAt, adminId i osobne procesy invitation/proposal/join.
Backend ma zapewnić ich zgody, idempotencję, kontrolę grupową i deterministyczną
sukcesję; obecnie NIE istnieją odpowiadające produkcyjne endpointy.

Game demo ma groupId, createdBy, visibility. OrganizingGroups obliczane z aktualnych
członkostw; własność i recheck formularza/reducera pozostają. Private outsider:
tylko podstawowa karta. Public: udział bez członkostwa. Po reclose zapisany outsider
zachowuje own, bez cudzego rosteru/profili/finansów. Twórca-członek edytuje przyszły
mecz, admin grupy nie staje się właścicielem cudzego meczu. Reguły3.15/3.16 bez zmian.

Istniejący produkcyjny Events/model i slm_events przechowują starts_at/location/
duration_minutes/hourly_rate/total_cost/capacity/minimum_players/status/created_by.
Nie mają groupId/visibility/nazwy meczu/adresu z demo. SQL minimum_players=10,
capacity>=10; demo ma edytowalne minimum. Te rozbieżności trzeba rozstrzygnąć jawnie,
nie podmieniać finansów i reguł w cichym mapowaniu UI.

Istniejący frontend wywołuje events_list/detail/create/edit/join/reserve/withdraw/
guest/edit_guest/move_guest/attendance/cancel przez accounts → slm_events_dispatch.
Uczestnik produkcyjny: member_id lub gość z responsible_user_id; nie tworzyć konta
gościowi. Rezerwa nie awansuje automatycznie. Warstwa nowego UI musi zachować
backendowy wynik, kontrolę miejsc/uprawnień/blokad i polski termin Europe/Warsaw.

## Finanse i powiadomienia — istniejące kontrakty

Źródła: settlements/model.ts, useFinanceOperation, MatchSettlement/Settlements,
SETTLEMENTS_MODULE.md i INTEGRATION_REPORT.md. Istnieją settlements_account/detail/
pending/resolve_request/submit_payment/record_payment/accept_payment/reject_payment/
correct_payment/cost/charge/attendance/replacement/approve. Accounts kieruje je
na slm_settlements_dispatch z p_user/p_session/p_action/p_body. Kwoty w groszach,
request_id i wersja zapewniają spójne ponowienia; nie generować nowego UUID po
niejednoznacznym timeout. Ledger/FIFO/decyzje pozostają serwerowe.

Demo Entry.paidCents i demoFinance to wyłącznie prezentacja; NIE zastąpią prawdziwego
ledgera ani uzgodnienia salda/FIFO. Zwykły widzi własne zobowiązania, w tym gości;
przełącznik financeRole jest tylko testem, nie zabezpieczeniem. Przyszła integracja
musi respektować RLS/role z serwera zamiast kopiować wynik klienta.

Istnieją notifications_list/count/open/read/read_all/preferences/prepare_device/
register/detach, slm_notifications_dispatch i push-worker z osobnym sekretem.
Inbox/preferencje/urządzenia/outbox i adapter finansowy są przygotowane w repo.
FCM HTTPv1, APNs/iOS, native push, scheduler i six pending migrations wymagają
weryfikacji opisanej w PUSH_NOTIFICATIONS.md/PUSH_FINANCE_ADAPTER.md. Nie wdrażano
ich w3.18; brak konfiguracji Firebase nie blokuje demonstracji.

## Migracje i RLS/RPC — lista zastana, nic nie wykonano

Źródłowa kolejność w app/supabase/migrations:

- `20261013185250_slm_auth_proof_setup.sql`
- `20261013191910_accounts_module.sql`
- `20261013193036_accounts_session_hardening.sql`
- `20261013193844_accounts_recovery_and_permissions.sql`
- `20261013212841_events_module.sql`
- `20261013213423_events_edit_validation.sql`
- `20261013213917_events_finite_costs.sql`
- `20261014100000_settlements_ledger.sql`
- `20261014101000_settlements_rpc.sql`
- `20261014102000_settlements_events_integration.sql`
- `20261014120000_notifications_core.sql`
- `20261014121000_notifications_rpc_and_worker.sql`
- `20261014122000_notifications_events_eligibility.sql`

Według archiwalnej dokumentacji bazowe Auth/events były wcześniej wykonywane,
a sześć plików z14.10 (finanse/push) pozostaje nieweryfikowaną integracją.
W3.18 NIE odczytywano stanu zdalnej bazy i NIE potwierdzamy aktualnego zastosowania.
Zachować historię Docker/SQL z LOCAL_VERIFICATION.md; lokalna weryfikacja transakcji,
RLS/JWT i współbieżności była zablokowana przez Docker. operations/enable_push_schedule.sql
to osobna operacja, również nie wykonana. Nie stosować tych plików automatycznie.

Brakuje przyszłych migracji/kontraktów dla wielogrupowości, grupowych ról i zgód,
widoczności/własności/retained outsiderów, onboardingu i rozszerzeń profilu, składów
oraz e-mail self-service. To obszary integracji, NIE istniejące nazwy tabel/RPC
ani gotowy SQL. Niczego nie dopisano do migrations. Nowe RLS/RPC muszą uwzględnić
obecną żywą sesję/gate, prywatność kontaktów, własny udział, idempotencję i atomowość;
ukrycie przycisku w demo nie zapewnia takich gwarancji.

## Kolejność przyszłej integracji — wymaga następnego polecenia

1. Sprawdzić rzeczywisty stan środowiska/migracji i uruchomić izolowany lokalny
   Supabase/Docker; odtworzyć istniejące fixture SQL bez dotykania produkcji.
2. Uzgodnić kompatybilność starych kont z samorejestracją/e-mail, dostarczyć dokumenty
   prawne i bezpieczne callbacki web/Android/iOS. Zachować session gate/TokenStore.
3. Przygotować i zweryfikować brakujące kontrakty/migracje/RLS grup, profili,
   widoczności i własności wydarzeń. Nie traktować modelu RAM jak schematu SQL.
4. Podłączyć wspólne UI do potwierdzonych wyników Auth/profilu/grup/events, z wersjami,
   błędami i uprawnieniami serwera. Usunąć zależność od fixture dla produkcji.
5. Zweryfikować istniejący ledger/FIFO i mapowanie paneli; potem osobno powiadomienia,
   scheduler, tokeny i natywne kanały. Nie wdrażać przy okazji samego UI.
6. Pełne testy integracyjne/RLS/współbieżności, urządzenia i osobna decyzja o wdrożeniu.

## Testy po podłączeniu Supabase

- Rzeczywista rejestracja bez grupy, brak duplikatów i enumeracji kont, e-mail, resend
  z limitami, wygasłe/błędne/ponownie użyte callbacki, reset i zmiana hasła.
- Odzyskiwanie sesji, rotacja refresh, równoległe operacje, logout online/offline,
  wygaśnięcie/cofnięcie i brak danych poprzedniego konta; pamięć natywna Android/iOS.
- Profil/zdjęcie/numer0–99, opcjonalne kontakty, prywatność projekcji, prawdziwe0
  statystyk; reset/utrata sieci bez fałszywych komunikatów sukcesu.
- Grupy: wszystkie zgody, role i sukcesja, próby obcego JWT, wywołania bez UI,
  wyścigi/duplikaty, odejście organizatora, brak nieautoryzowanej listy członków.
- Wydarzenia: ostatnie miejsce, goście/rezerwa bez awansu, długa nazwa, Warsaw/DST,
  ownership/reclose/retained outsider, atomowość i blokady finansowe.
- Ledger/FIFO/grosze/korekty i dwie różne zaległe gry, idempotency/version/timeout,
  prywatność finansów; odróżnić testy SQL od obecnych mocków/UI.
- Inbox/outbox retry/worker locks/FCM, wygasłe tokeny, logout na wielu urządzeniach.
- CSP, brak sekretów i payloadów w logach, 12 kombinacji,320/390/768, klawiatura
  ekranowa, czytnik ekranu, safe areas i callback z maila na urządzeniu.

## Weryfikacja3.18 i ograniczenia

TypeScript/fullESLint/oba buildy OK, Vitest184/184 (33 pliki). Chromium: pełny istniejący
smoke świata oraz grupy/widoczność/palety + nowe konta,320/390/768,12 kombinacji,
zero żądań zewnętrznych i naruszeń CSP. To testy UI/modelu RAM i mocków, nie Supabase.
Dodatkowo produkcyjny login wyrenderowano z zablokowanym Supabase (bez submit):
stare etykiety, pokaż/ukryj, brak footer/overflow OK. Nie jest to test logowania.
Cypress próbowano uruchomić: brak binarnej instalacji16.1.1 (także brak Xvfb w PATH),
więc nie oznaczamy go jako zaliczony. Duże chunki Ionic nadal ostrzeżeniem.
Nie wykonano Android/iOS, prawdziwej klawiatury, e-mail/deep linków na urządzeniu,
pełnego audytu WCAG/czytnika ani rzeczywistego SQL/produkcji. Nie zweryfikowano
statusu automatycznego Vercel. Nie uruchomiono ręcznego deploy ani kolejnego etapu.


## TODO B4 — decyzje właściciela z 2026-10-24, bez implementacji

Ten wpis aktualizuje przyszłe wymagania wydarzeń; nie zmienia obecnego demo ani
zamrożonego Premium 3.18 z d0f9fa9. B4 nie został rozpoczęty. Nie projektowano ekranów,
nie zmieniano API/RLS/migracji. Poniższe decyzje mają pierwszeństwo przed sprzecznymi
historycznymi opisami demo (m.in. edycją wyłącznie przez twórcę).

### Prywatne wydarzenia

- Kafelek jest widoczny również zalogowanym osobom spoza grupy.
- Bez uprawnień nie można wejść w szczegóły prywatnego wydarzenia ani odczytać
  uczestników, telefonów, rozliczeń i innych prywatnych danych.
- Można wysłać prośbę o dołączenie; administrator może ją zaakceptować lub odrzucić.
- Widoczność kafelka i granica prywatnych danych muszą być egzekwowane również przez
  Supabase RLS/API, w tym przy bezpośrednich żądaniach poza UI. Samo ukrycie przycisku
  nie stanowi zabezpieczenia.

### Organizator i uczestnicy

- Własne wydarzenia mają czytelne, dyskretne oznaczenie organizatora.
- Zapisany organizator jest na szczycie listy uczestników.
- Niezapisany organizator jest w osobnym kafelku nad listą i nie zajmuje miejsca
  w limicie uczestników.
- Organizator wydarzenia i administrator grupy to odrębne pojęcia, nawet gdy
  początkowo organizatorem może być tylko administrator.

### Uprawnienia i zarządzanie

- W SLM 1.0 nowe wydarzenia tworzą wyłącznie administratorzy grupy.
- Organizator oraz uprawnieni administratorzy mogą zarządzać wydarzeniem.
- Zarządzanie obejmuje edycję oraz odwołanie z zachowaniem historii i rozliczeń.
- Usunięcie błędnie utworzonego wydarzenia jest możliwe wyłącznie przy braku zapisów
  i powiązanych rozliczeń; weryfikacja warunków musi być odporna na równoległy zapis.
- Zachować możliwość przyszłego rozszerzenia uprawnień do tworzenia wydarzeń.

Przyszła implementacja wymaga osobnego polecenia, audytu istniejącego kontraktu,
serwerowych kontroli i testów dostępu/współbieżności. Ten TODO nie zatwierdza migracji,
wdrożeń ani zmian logiki finansowej. B2 (rzeczywisty profil) także wymaga osobnej zgody.


## TODO B2.2 — zdjęcia po odbiorze B2.1 (2026-10-24)

Tylko plan; B2.2 nie rozpoczęty. Zachować oryginalny UI Premium 3.18.
Wymagania właściciela: maks. 800×800 px, WebP z jakością około 75–80%,
docelowo do 150 KB, kompresja przed wysłaniem, jedno bieżące zdjęcie na użytkownika,
bez przechowywania oryginałów, bezpieczna podmiana oraz usunięcie plików.
Audytować istniejącą lokalną infrastrukturę zdjęć zamiast tworzyć drugi system;
nie przenosić automatycznie poprzednich limitów 1024 px/JPEG/2 MiB jako docelowego kontraktu.
B2.1 nie wywołuje Storage ani operacji zdjęć. Numery/pozycje/„dobry bramkarz”
wymagają odrębnego uzgodnienia brakujących kontraktów; nie dodano ich w tej pracy.
Profil B2.1: docs/SLM_V1_B2_PROFILE.md. B3/grupy nie rozpoczęte.


## TODO B3 — numery zawodników, decyzja 2026-10-24 (bez implementacji)

Numer jest własnością użytkownika, nie grupy. Zakres0–99. Duplikaty są dozwolone;
nie dodawać UNIQUE do jersey_number. Po podłączeniu rzeczywistych grup ostrzegać,
gdy inny członek grupy ma już taki numer, ale pozwalać go zachować i zapisać.
Sprawdzanie musi respektować widoczność członkostw; nie ujawniać osób spoza dozwolonego
kontekstu. W B2.2 nie dodano żadnego sprawdzania duplikatów ani integracji grup.
B2.2 ma blokadę kontraktu i minimalnej kontrolki usuwania — docs/SLM_V1_B2_PHOTOS.md.

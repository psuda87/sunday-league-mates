# Aktualne punkty odniesienia mapy i odbioru — 03.11.2026

Źródłowy main: `1b6ee83356d53b7b34193af88802067dc9b2fede` (44 migracje).
Bieżąca mapa ekranów, funkcji, wejść LIVE/Premium/demo i powiązań testowych:
[SCREEN_FUNCTION_CHECKLIST.md](SCREEN_FUNCTION_CHECKLIST.md).
Jedyny rejestr statusów, SHA, potwierdzeń właściciela i bramek zamknięcia:
[FUNCTION_ACCEPTANCE_LOG.md](FUNCTION_ACCEPTANCE_LOG.md).
Nie kopiować statusów odbioru do technicznej tabeli poniżej.

Poniższa mapa z19.10 pozostaje zapisem historycznym integracji, **nie opisem
aktualnego main**. W szczególności: obecny Premium ma prawdziwe składy z CAS
(migracja41), zapis tylko administratora grupy44, discovery42 i minimum43.
Własny profil ma odrębny pseudonim oraz trzy tryby nazwy z prywatnością PR16.
Dawne zdania „brak backendu składów”, „prywatny basic w feedzie obcych grup” czy
„organizator jest wymagany do każdego tworzenia” nie mogą służyć za aktualną
specyfikację. Szczegóły bieżących ekranów i rozbieżności rendererów są w checkliście;
przechodzący historyczny test nie jest ręcznym odbiorem właściciela.

---

# SLM 1.0 — zgodność Premium 3.18 z backendem

19.10.2026, feat/integration, HEAD 2026754. Docelowa warstwa z ui-beta d0f9fa9
przeniesiona ręcznie, bez merge/rebase. Inwentaryzacja: UI_BRANCH_DIFF.json
(315 ścieżek, 102 app). Zachowano wcześniejsze lokalne naprawy.

Produkcja: /home → Accounts → live/Groups, live/Matches, live/Finance.
Używane są prawdziwe operacje przez SessionManager; brak fixture w źródle danych.
Zachowano MatchHeader, MatchHero, MatchFilters, MatchSections/MatchTabs,
ParticipantGroup/RosterSummary, motyw, assety i nawigację Premium. „Moje” pochodzi
z serwerowego own_participation. Powrót przyciskiem Mecze odtwarza listę.
Demo ma osobny build:demo, CSP connect-src none i nie jest trasą produkcyjną.

| Ekran / operacja | Action → RPC | Tabele / ograniczenia |
|---|---|---|
| Login / sesja / hasło | login, refresh, status, password → Auth i account_* | żywa sesja + security_version, mandatory gate, magazyn natywny |
| Potwierdzone konto e-mail | slm_email_identity | Auth + profiles/roles/security/player_profiles; bez aliasu i automatycznych grup |
| Rejestracja / link / recovery | signup/resend_verification/recover_email | BLOCKED poczta/legal/callback; ekrany demo nie są działającym Auth |
| Profil | profile/save_profile/save_email_profile/identifiers | własny profil, obecne hasło przy kontakcie, unikalny telefon; nazwa według wyboru |
| Grupy | groups_list/search/create/detail → slm_groups_dispatch | groups/members, RLS członków, server DTO |
| Zaproszenia / zgody | groups_inbox/join/invite/phone/decide/cancel_request | requests/audit; obustronne zgody, neutralny lookup telefonu |
| Role / odejście | groups_permission/transfer/remove/leave | scope jednej grupy, sukcesja według serwerowej kolejności, archiwizacja historii |
| Lista / szczegóły | matches_list/detail → slm_matches_dispatch | matches/entries/history; public/full, prywatny basic, retained own; brak cudzych telefonów |
| Formularz | matches_create/edit | organizer do tworzenia, twórca do edycji, wersja i czas Europe/Warsaw; godzina i limit bez zgadywania |
| Zapisy / goście / rezerwa | matches_join/withdraw/guest/edit_guest/move_guest/reserve | atomowy limit, globalna kwalifikacja, osobne miejsca, brak automatycznego awansu |
| Obecność / odwołanie | matches_attendance/cancel | historia i audyt; obecność osobno od obowiązku opłaty |
| Finanse grupy | finance_groups/group_finance_account | ledger/payments/dues; własne dane również po opuszczeniu grupy |
| Obsługa meczu | group_finance_detail/approve/cost/charge/attendance | aktualny admin grupy / twórca meczu, expected_version, powód korekty |
| Wpłaty / zwroty | group_finance_submit_payment/record_payment/accept_payment/reject_payment/correct_payment | pending bez księgowania, celowa lub FIFO grupy, niezmienna tożsamość wpłaty |
| Nadwyżki | group_finance_account/detail DTO | surplus/history; naliczone i otrzymane osobno, tylko główny admin |
| Historia legacy | stare events_*/settlements_* i slm_legacy_scope | zachowane stare kwoty, ograniczony scope; bez tworzenia meczów v1; stary dług spłacany grupowym FIFO |
| Inbox / urządzenie / worker | notifications_*, slm_push_* | własny inbox, session/binding/lease, match_id dla nowych meczów; rzeczywiste FCM nieaktywne |
| Składy / oceny / rozbudowane karty | brak nowego backendu | jawnie niedostępne; nie zastępuj reducerem demo; bez rozszerzania o SLM 1.1 |

Weryfikacja warstw:
- SQL/RLS/RPC v2 55 PASS i backend legacy 31 PASS.
- Rzeczywiste scoped HTTP 20 PASS, Auth legacy 7 zestawów i smoke 9 PASS.
- Przeglądarka BEZ mocków: logowanie e-mail → grupa → mecz → własny zapis → filtr Moje
  → gość na rezerwie → finanse → logout: 1 PASS. Fikcyjne zasoby usunięto.
- Cypress z kontrolowanym API: 13/13 w końcowej pełnej regresji.
- Android: build/test natywny nie są ręcznym odbiorem urządzenia. Brak podłączonego telefonu.
- Nie ogłaszamy pełnego ukończenia wszystkich ekranów Premium ani rejestracji pocztowej.

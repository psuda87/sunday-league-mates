# Aktualny stan Sunday League Mates

Aktualizacja 14.10.2026: **`feat/push-notifications`**, baza
`origin/feat/events` (`6638e18b4ed763e5bdee45ea61416a576e00bbec`). Checkout był
czysty. Potwierdzono zapis i push `origin/feat/settlements`:
`81d71c7fb24dc4b410f178c3fa4101a5fa2ce410`; nie skopiowano rozliczeń ani nie scalano gałęzi.

Przygotowano inbox/nieprzeczytane/kategorie, zdarzenia wydarzeń, przypomnienia
24h/2h z harmonogramem pg_cron, chronione urządzenia i detach przy logout,
worker Edge FCM HTTP v1 z lease/ponowieniami, Android 13+ i opcjonalną konfigurację,
adapter tokenu FCM dla przyszłego iOS oraz osobny kontrakt finansów bez emisji atrap.
Dodano `@capacitor/push-notifications@8.0.0`; odświeżono wyłącznie package-lock
z wyłączonymi skryptami. Instalacja i synchronizacja natywna pozostają do wykonania.

Oczekują migracje `20261014120000_notifications_core.sql`,
`20261014121000_notifications_rpc_and_worker.sql`,
`20261014122000_notifications_events_eligibility.sql` oraz osobny skrypt
konfiguracji harmonogramu `enable_push_schedule.sql`.
**Nie uruchomiono żadnych testów, Cypress, lintowania/typów, buildów, emulatorów,
cap sync, migracji ani wdrożeń. Implementacja jest nieprzetestowana i niewdrożona.**
Commit/push źródeł tej gałęzi są autoryzowane; nie oznaczają wdrożenia lub odbioru.
Ryzyka i wieczorny plan: [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md).
Integracja finansów: [PUSH_FINANCE_ADAPTER.md](PUSH_FINANCE_ADAPTER.md).
Następny krok: izolowana weryfikacja SQL/RLS i Androida, późniejsza konfiguracja
Firebase Spark/FCM, Edge Secrets i Vault. iOS i prawdziwe dostawy pozostają otwarte.

Poniżej zachowano wcześniejszy stan i historyczne wyniki Auth/events; nie są
wynikami nowego modułu powiadomień.

Aktualizacja: 13.10.2026. Branch: `feat/events`. Projekt Supabase: `hjtcyybkxebvdropchac`.
Stan wdrożeń i testów: [AUTH_PROOF.md](AUTH_PROOF.md) i [EVENTS_MODULE.md](EVENTS_MODULE.md).
Podstawowe działanie modułu kont odebrane ręcznie na Androidzie; dodatkowe scenariusze nadal otwarte.
Zapis postępu na koniec dnia: **moduł wydarzeń zaimplementowany i sprawdzony automatycznie; ręczny odbiór Androida jeszcze niewykonany**. Nowe ustalenia dotyczące odznak, MVP, frekwencji, dojazdu i mieszania składów zapisane tylko w specyfikacji, bez implementacji.
Scalono [PR #1: moduł kont i zapamiętywanie sesji](https://github.com/psuda87/sunday-league-mates/pull/1), `feat/auth` → `main`, zwykłym merge bez omijania zabezpieczeń.
Commit scalenia Auth: `4db97ba679a412834869fc5c05df4622a1afcb86`. Lokalny `main` zaktualizowano przez `git pull --ff-only origin main`, a z niego utworzono `feat/events`. Branch `feat/auth` zachowany lokalnie i zdalnie; lokalne pliki zachowane. Następnie użytkownik autoryzował wydarzenia; moduł wdrożono do wskazanego Supabase, bez zmian rzeczywistego administratora. Użytkownik autoryzował commit i push zapisu postępu na `feat/events`, bez scalania do `main`.

## Wykonane

- Szkielet Ionic React / TypeScript / Capacitor, Android, polski interfejs i ciemny motyw z miętowym akcentem.
- Logowanie loginem lub telefonem do jednego konta Supabase Auth; bez publicznej rejestracji, maili i SMS-ów.
- Profile i wybór nazwy; panel administratora tworzący konta i resetujący hasła; zmiana własnych identyfikatorów i hasła po sprawdzeniu obecnego hasła.
- Serwerowe role, RLS, wymuszona zmiana hasła tymczasowego, ograniczenia prób logowania i odrzucanie starych sesji po resecie.
- Zapamiętywanie refresh tokenu: Android Keystore / iOS Keychain; osobna polityka web. Weryfikacja dostępu przy uruchomieniu, odświeżanie, obsługa offline i usuwanie zapisu przy wylogowaniu.
- Generowane hasła tymczasowe: 12 znaków. Własne hasło: minimum 8 znaków, maksimum 72 bajty UTF-8.
- Lokalna procedura pierwszego administratora, bez publicznego bootstrap.
- Wydarzenia: lista/szczegóły, formularz administratora, atomowe zapisy do początku, goście i osobna rezerwa, zarządzanie uczestnikami, odwołanie oraz obecność. Nazwy z profili, kontakt do gościa lub zapraszającego. Minimum po 17:00 wymaga decyzji, bez automatycznego odwołania.
- Historia i odpowiedzialne konto pod przyszłe rozliczenia zachowane również po rezygnacji. Koszt na osobę tylko szacunkowy. Naliczanie, FIFO, wpłaty, blokada zaległości, oceny, składy i push nie są wdrożone.

## Wdrożenia

Migracje w `app/supabase/migrations/`, zastosowane do wskazanego projektu:

- `20261013185250_slm_auth_proof_setup.sql` — historyczna infrastruktura próby Auth.
- `20261013191910_accounts_module.sql` — docelowy moduł kont i blokady wiadomości.
- `20261013193036_accounts_session_hardening.sql` — zabezpieczenia sesji.
- `20261013193844_accounts_recovery_and_permissions.sql` — naprawa przerwanych operacji i uprawnienia.
- `20261013212841_events_module.sql` — wydarzenia, uczestnicy, historia, RLS i atomowy RPC.
- `20261013213423_events_edit_validation.sql` — edycja daty i walidacja 24:00.
- `20261013213917_events_finite_costs.sql` — odrzucanie NaN w kwotach.

Edge Function: **`accounts`, aktywna wersja 6**, źródła w `app/supabase/functions/accounts/`; dodane operacje `events_*`, bez nowego publicznego endpointu testowego.
Auth: rejestracja i CAPTCHA wyłączone, hooki blokujące e-mail/SMS aktywne, minimum hasła 8.
Zmiana polityki odtwarzalna przez `app/scripts/configure-password-policy.mjs`; limity pozostały bez zmian.

## Ostatnie wyniki kontroli

| Kontrola | Wynik |
|---|---|
| Build webowy, typy klienta i strict Edge / lint | OK |
| Vitest | 29/29, 6 plików |
| Testy narzędzia bootstrap | 6/6 |
| Cypress, przeglądarka z kontrolowanym API | 7/7 (2 wydarzenia + 5 Auth) |
| Rzeczywiste testy Auth/API na fikcyjnych kontach | 7 grup zaliczonych; dane własnych testów usunięte |
| Rzeczywiste testy wydarzeń/API | 7 grup PASS: uprawnienia, wyścig o miejsce, goście, rezerwa, historia po17, reset starych sesji, zamknięcie/cancel |
| SELECT granic Europe/Warsaw | 17:00 zimą i latem oraz dokładny początek: OK |
| Granice haseł | 7 znaków odrzucone, 8 przyjęte; tworzenie i reset generują 12 |
| Zmiana technicznego e-maila | Hook odmawia (403), adres bez zmian, wysyłka zablokowana |
| Synchronizacja Androida / assembleDebug, lintDebug, testDebugUnitTest | OK |
| Android — ręczne potwierdzenie użytkownika | Pierwsze logowanie, wymuszona zmiana, oba aliasy, panel; zachowanie sesji po otwarciu, ekran logowania po logout, tworzenie zawodnika i reset z panelu |

Testy automatyczne i kompilacja nie są testami na urządzeniu. Szczegóły: [AUTH_PROOF.md](AUTH_PROOF.md).
Bieżące kontrole wydarzeń wykonano automatycznie; nie są nowym ręcznym odbiorem Androida.
Fikcyjne konta, mecze i ich dane usunięto; nie wykonywano testów na rzeczywistym administratorze.
Niezależny odczyt: 0 testowych meczów, uczestników i historii wydarzeń. Kontrola
nieignorowanych plików nie wykryła sekretów; `git diff --check` bez błędów.

## Otwarte problemy i ograniczenia

- Ręczne testy offline i unieważniania starej zapisanej sesji po resecie (również po zmianie nowego hasła) **odłożone decyzją użytkownika; niezaliczone, nie blokują dalszych prac**. Automatyczne testy tych mechanizmów nie są odbiorem na telefonie. Pierwsza zmiana hasła nowego zawodnika nie ma osobnego ręcznego potwierdzenia. Tworzenie/reset z panelu, ponowne otwarcie z sesją i ponowne otwarcie po logout są potwierdzone.
- iOS: magazyn przewidziany w kodzie, platforma i testy urządzenia jeszcze nieprzygotowane.
- Wydarzenia wymagają odbioru na telefonie; odświeżanie ręczne, brak Realtime. Dwuznaczne godziny zmiany na czas zimowy przyjmują standardową interpretację PostgreSQL.
- CAPTCHA odłożona poza etap; istniejące limity pozostają aktywne.
- Historyczne zasoby próby Auth pozostają do kontrolowanego usunięcia; brak publicznych endpointów testowych/bootstrap. Lista w [AUTH_MODULE.md](AUTH_MODULE.md).
- Ostatni audyt: 6 moderate, bez high/critical; produkcyjne: 3 moderate dotyczące routera. Szczegóły: [AUDYT_ZALEZNOSCI.md](AUDYT_ZALEZNOSCI.md).
- Ostrzeżenia wielkości chunków i danych Browserslist; webowy localStorage nie zapewnia ochrony tokenu przed XSS. Brak portretu `app/public/images/player-demo.png`.

## Następny krok

Ręcznie sprawdzić moduł wydarzeń na Androidzie według EVENTS_MODULE.md, potem ustalić etap rozliczeń (pełne naliczanie, FIFO, wpłaty i blokada dwóch zaległych meczów). Odłożone ręczne testy Auth nie blokują dalszych prac i nie są zaliczone. iOS niezweryfikowany, CAPTCHA odłożona.

Kontrola scalenia: brak konfliktów; brak zgłoszonych statusów CI, check runs i recenzji. Odczyt konfiguracji ochrony `main` przez integrację zwrócił 403 `Resource not accessible by integration`; zwykłe API merge zaakceptowało scalenie. Nie zmieniano zabezpieczeń. Dotychczasowe wyniki testów aplikacji pozostają aktualne; nie wykonywano nowych testów.

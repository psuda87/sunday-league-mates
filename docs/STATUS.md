# Aktualny stan Sunday League Mates

Aktualizacja: 13.10.2026. Branch: `feat/auth`. Projekt Supabase: `hjtcyybkxebvdropchac`.
Stan wdrożeń i testów według ostatnich potwierdzonych przebiegów w [AUTH_PROOF.md](AUTH_PROOF.md).
Podstawowe działanie modułu kont odebrane ręcznie na Androidzie; dodatkowe scenariusze nadal otwarte.
Bieżące zadanie: zapis decyzji o odłożonych testach i przygotowanie PR `feat/auth` → `main`, bez scalania.

## Wykonane

- Szkielet Ionic React / TypeScript / Capacitor, Android, polski interfejs i ciemny motyw z miętowym akcentem.
- Logowanie loginem lub telefonem do jednego konta Supabase Auth; bez publicznej rejestracji, maili i SMS-ów.
- Profile i wybór nazwy; panel administratora tworzący konta i resetujący hasła; zmiana własnych identyfikatorów i hasła po sprawdzeniu obecnego hasła.
- Serwerowe role, RLS, wymuszona zmiana hasła tymczasowego, ograniczenia prób logowania i odrzucanie starych sesji po resecie.
- Zapamiętywanie refresh tokenu: Android Keystore / iOS Keychain; osobna polityka web. Weryfikacja dostępu przy uruchomieniu, odświeżanie, obsługa offline i usuwanie zapisu przy wylogowaniu.
- Generowane hasła tymczasowe: 12 znaków. Własne hasło: minimum 8 znaków, maksimum 72 bajty UTF-8.
- Lokalna procedura pierwszego administratora, bez publicznego bootstrap. Mecze, rozliczenia, oceny i powiadomienia nie są zaimplementowane.

## Wdrożenia

Migracje w `app/supabase/migrations/`, zastosowane do wskazanego projektu:

- `20261013185250_slm_auth_proof_setup.sql` — historyczna infrastruktura próby Auth.
- `20261013191910_accounts_module.sql` — docelowy moduł kont i blokady wiadomości.
- `20261013193036_accounts_session_hardening.sql` — zabezpieczenia sesji.
- `20261013193844_accounts_recovery_and_permissions.sql` — naprawa przerwanych operacji i uprawnienia.

Edge Function: **`accounts`, aktywna wersja 5**, źródła w `app/supabase/functions/accounts/`.
Auth: rejestracja i CAPTCHA wyłączone, hooki blokujące e-mail/SMS aktywne, minimum hasła 8.
Zmiana polityki odtwarzalna przez `app/scripts/configure-password-policy.mjs`; limity pozostały bez zmian.

## Ostatnie wyniki kontroli

| Kontrola | Wynik |
|---|---|
| Build webowy i typy / lint | OK |
| Vitest | 24/24 |
| Testy narzędzia bootstrap | 6/6 |
| Cypress, przeglądarka z kontrolowanym API | 5/5 |
| Rzeczywiste testy Auth/API na fikcyjnych kontach | 7 grup zaliczonych; dane własnych testów usunięte |
| Granice haseł | 7 znaków odrzucone, 8 przyjęte; tworzenie i reset generują 12 |
| Zmiana technicznego e-maila | Hook odmawia (403), adres bez zmian, wysyłka zablokowana |
| Synchronizacja Androida / assembleDebug | OK |
| Android — ręczne potwierdzenie użytkownika | Pierwsze logowanie, wymuszona zmiana, oba aliasy, panel; zachowanie sesji po otwarciu, ekran logowania po logout, tworzenie zawodnika i reset z panelu |

Testy automatyczne i kompilacja nie są testami na urządzeniu. Szczegóły: [AUTH_PROOF.md](AUTH_PROOF.md).
W poprzednim zadaniu tworzenia tego dokumentu powtórzono build/typy, lint,
Vitest (24/24) i Cypress (5/5). W bieżącym zadaniu zapisu odbioru wykorzystano
te wyniki bez ponawiania testów; `git diff --check` i kontrola indeksu bez błędów,
bez wykrytych sekretów lub artefaktów. Nie zmieniano kodu ani konfiguracji zdalnej.

## Otwarte problemy i ograniczenia

- Ręczne testy offline i unieważniania starej zapisanej sesji po resecie (również po zmianie nowego hasła) **odłożone decyzją użytkownika; niezaliczone, nie blokują dalszych prac**. Automatyczne testy tych mechanizmów nie są odbiorem na telefonie. Pierwsza zmiana hasła nowego zawodnika nie ma osobnego ręcznego potwierdzenia. Tworzenie/reset z panelu, ponowne otwarcie z sesją i ponowne otwarcie po logout są potwierdzone.
- iOS: magazyn przewidziany w kodzie, platforma i testy urządzenia jeszcze nieprzygotowane.
- CAPTCHA odłożona poza etap; istniejące limity pozostają aktywne.
- Historyczne zasoby próby Auth pozostają do kontrolowanego usunięcia; brak publicznych endpointów testowych/bootstrap. Lista w [AUTH_MODULE.md](AUTH_MODULE.md).
- Ostatni audyt: 6 moderate, bez high/critical; produkcyjne: 3 moderate dotyczące routera. Szczegóły: [AUDYT_ZALEZNOSCI.md](AUDYT_ZALEZNOSCI.md).
- Ostrzeżenia wielkości chunków i danych Browserslist; webowy localStorage nie zapewnia ochrony tokenu przed XSS. Brak portretu `app/public/images/player-demo.png`.

## Następny krok

Przegląd PR `feat/auth` → `main` i ustalenie zakresu następnego etapu. Odłożone ręczne testy nie blokują dalszych prac i pozostają do wykonania w późniejszym terminie. iOS jest niezweryfikowany, CAPTCHA odłożona. Scalenie wymaga osobnej decyzji użytkownika.

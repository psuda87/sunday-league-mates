# Auth SLM 1.0 — stan lokalnej implementacji

19.10.2026, feat/integration. Supabase Auth przechowuje i sprawdza wszystkie hasła.

Działa logowanie potwierdzonym e-mailem obok zachowanych aliasów login/telefon.
slm_email_identity sprawdza auth.users.email_confirmed_at i provisionuje wyłącznie
profil, member i stan sesji; bez fikcyjnego telefonu, grupy lub roli administratora.
Nie zmienia istniejących aliasów, haseł ani identyfikatorów kont.
Metadane użytkownika nie nadają ról. Nowe konto może następnie utworzyć własną grupę.

Nowy profil ma pseudonim, opcjonalny kontakt, imię/nazwisko i wybór nazwy.
Zmiana kontaktu wymaga obecnego hasła i unikalności względem profili oraz aliasów.
Hasło zmienia wyłącznie Auth. Reset administratora wymaga zmiany hasła tymczasowego,
a stare JWT i refresh tokeny nie odzyskują dostępu po tej zmianie.
SessionManager i bezpieczny magazyn natywny pozostają używane, bez przechowywania haseł.

Zaimplementowane serwerowe signup/resend_verification/recover_email są domyślnie
zatrzymane PRZED wywołaniem Auth przez mail_unconfigured. Przełącznik środowiska
SLM_EMAIL_SIGNUP_ENABLED nie został włączony. Publiczna rejestracja Auth jest wyłączona,
blokujące hooki maili/SMS pozostają aktywne. Nie skonfigurowano SMTP ani realnej poczty.

BLOCKED: rzeczywista rejestracja i dostarczenie weryfikacji/recovery. Produkcyjne ekrany
rejestracji, potwierdzenia linku i recovery/callback nie są jeszcze podłączone do
zaakceptowanego przepływu pocztowego; warianty AccountScreens pozostają izolowanym UI.
Nie deklarujemy pełnego zakończenia nowego Auth. Kolejny etap wymaga decyzji o bezpłatnej
poczcie, domenie, legal i allowliście callbacków web/Android/iOS; następnie implementacji
i rzeczywistego odbioru linków, wygaśnięć i ponowień. Nie włączać samego przełącznika.

Migracja istniejącego technicznego adresu na prywatny wymaga osobnego, bezpiecznego
przepływu z obecnym hasłem i potwierdzeniem Auth. Nie wdrożono automatycznej konwersji
ani łączenia kont po adresie. Dotychczasowe logowanie pozostaje dostępne.

Testy: HTTP Auth legacy 7 zestawów PASS; nowe konta i scoped HTTP 20 PASS, także zmiana
hasła, reset, mandatory gate i stare sesje. Fikcyjne lokalne konta tworzył Admin API
z email_confirm=true wyłącznie jako fixture; to NIE test dostarczenia weryfikacji.
SQL odrzuca niepotwierdzony adres i metadata admin. Przeglądarka z rzeczywistym
lokalnym API: PASS. Po testach konta i powiązane dane usunięte.

Źródła sprawdzone 19.10.2026:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/reference/javascript/auth-signup
- https://supabase.com/docs/guides/database/postgres/row-level-security

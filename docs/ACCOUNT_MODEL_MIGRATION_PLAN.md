# Docelowy model kont — plan bezpiecznej migracji

2026-10-26 19:16 Europe/Warsaw. **Wyłącznie analiza**, `feat/premium-account-identifiers`, Draft PR17; baza main134c52b po PR16, diagnostyka97ede53. Poniższe decyzje właściciela zastępują wcześniejsze założenie dwóch niezależnych nazw: **pseudonim=login, globalnie unikalny; opcjonalny e-mail jako alternatywny login; telefon tylko kontakt; hasło obowiązkowe**. Nie zmieniono aplikacji, kont, konfiguracji, SQL ani działającego Supabase. Nie wykonano nowych prób resetu/zmiany danych. Historyczny audyt PR17 pozostaje dowodem błędu begin/finish, nie docelową specyfikacją.

## 1. Minimalny model danych

| Dane | Docelowe źródło | Zasada |
|---|---|---|
| UUID | istniejące auth.users.id i FK | bez tworzenia nowych kont dla migracji, bez łączenia kont |
| Pseudonim=login | istniejące slm_player_profiles.nickname | jedno kanoniczne pole, NOT NULL i globalny unikalny indeks znormalizowanej wartości; DTO login tylko alias tego samego pola |
| Imię/nazwisko/display_as | istniejące slm_profiles | opcjonalne; zachować PR16 first_name/full_name i3 tryby |
| Telefon kontaktowy | istniejące slm_player_profiles.contact_phone | opcjonalny, normalizacja zachowana, nigdy resolver logowania |
| Hasło | wyłącznie Supabase Auth | żadnych haseł/skrótów w tabelach aplikacji, logach i idempotencji |
| Wewnętrzny adres Auth | prywatny rejestr identyfikatorów po UUID | zachować istniejący adres Auth, również techniczny legacy; nie wyświetlać jako e-mail użytkownika |
| Opcjonalny e-mail logowania | jedno prywatne, znormalizowane i unikalne pole nullable email_login w adaptowanym rejestrze | tylko potwierdzony adres użytkownika; techniczny adres nie jest automatycznie e-mailem użytkownika |

Najmniejsza przebudowa rejestru: adaptować istniejące `slm_aliases` (user_id/technical_email), dodać nullable `email_login`; stare login/login_normalized/phone zachować chwilowo dla kompatybilności i rollbacku, potem wycofać. Nie dodawać drugiego publicznego pola login ani drugiej kopii nickname. Nazwę tabeli można pozostawić, żeby nie mnożyć migracji. Docelowy rejestr jest po jednym wierszu na UUID dla obu dawnych typów kont; obecny test „jest slm_aliases ⇒ legacy” musi przestać decydować o modelu Auth.

`email_login` jest potrzebne do oddzielenia opcjonalnego identyfikatora użytkownika od zachowanego wewnętrznego Auth e-maila, również przy późniejszym dodaniu adresu do konta bez e-maila. Wpisy aktywne wyłącznie po potwierdzonym procesie; bez tymczasowych/ad hoc flag w user_metadata. Migracja może przenieść już potwierdzony osobisty adres obecnego konta e-mail. Dla legacy pozostawia null. Nie zgadywać po samej domenie lub zawartości JWT: pochodzenie ustalić z istniejących rekordów, flag i auth.email_confirmed_at; sprzeczność trafia do ręcznego przeglądu. Prywatny adres Auth może być widoczny w tokenie Supabase — nie traktować go jako sekretu ani nie obiecywać pełnego ukrycia przed właścicielem konta. Nie ujawniać go w publicznych DTO.

Nie usuwamy i nie zmieniamy technicznych adresów Auth podczas tej migracji. Zmiana pseudonimu/telefonu/realnego aliasu nie zmienia UUID ani pierwotnego adresu używanego wewnętrznie do `authLogin`. Dla nowych kont bez e-maila potrzebny jest nadal wewnętrzny adres zgodny z istniejącym sprawdzonym modelem Auth; użytkownik nie musi go znać. Nie nadawać fikcyjnego osobistego e-maila.

## 2. Bezpieczna migracja istniejących danych

1. **Inwentaryzacja tylko do odczytu**: odizolowany backup i raport niepublikowany w Git — wszystkie UUID, stan security/pending, aliasy, nickname, kontakty i potwierdzenia e-mail; liczby oraz sumy kontrolne relacji. Bez wartości osobowych w raporcie publicznym. Nie skanowano teraz danych Cloud ani nie modyfikowano kont.
2. Kandydat pseudonimu: obecny nickname PR16; dla jego braku stary login legacy. To propozycja do zatwierdzenia, **nie automatyczny wybór** między dwoma różnymi istniejącymi nazwami. Sprawdzić globalnie także login innego konta, NFC/wielkość liter, puste/za długie nazwy, spacje i znaki niedopuszczalne. Obecny nickname PR16 pozwala na1–48 znaków, login na3–32 bez spacji, więc zgodność formatu nie jest dana.
3. Przy duplikatach/kolizjach nie scalać UUID, nie dopisywać losowych cyfr po cichu i nie odbierać komuś starego loginu. Przygotować listę decyzji właściciela i uzgodnione nowe pseudonimy; do tego czasu **blokada cutover danej spójnej partii/globalnego indeksu**, stary login działa w starym modelu. Rozstrzygnąć także ryzyko, że nowy pseudonim jednej osoby przejmie stary login innej. Bez automatycznej rezerwacji wszystkich starych nazw na zawsze.
4. SQL expand: nowe pole email_login i zgodne helpery; nowe procedury jeszcze nieaktywne. Następnie kontrolowany backfill kanonicznego nickname, rejestru i contact_phone dla tych samych UUID. Gdy contact_phone i stary phone różnią się, nie nadpisywać w ciemno: zachować oba w zabezpieczonym backupie i rozstrzygnąć, który jest kontaktem. Nie kopiować telefonu do auth.users.phone.
5. Pod blokadą zapisów identyfikatorów ponownie sprawdzić konflikty i założyć globalny indeks/ograniczenia. Dla małego zbioru zwykły indeks w transakcji jest prostszy; online/concurrently wymaga osobnej strategii migracji i kontroli błędów. Normalizacja jest autorytatywna w PostgreSQL, a nie tylko JS preflight.
6. Aktywować razem kompatybilny SQL + Edge + frontend, po testach na kopii. **Stare zapisy profilu z PR16 także muszą przechodzić nowy kontrakt**, aby save_premium_profile/save_email_profile/save_profile nie obchodziły potwierdzenia hasłem ani globalnej unikalności. Stare identifiers nie mogą pozostawać alternatywnym sposobem zmiany dwóch rozbieżnych nazw. Stary APK ma otrzymać kontrolowaną odmowę/komunikat aktualizacji przy niedozwolonej operacji.
7. Cutover usuwa wyszukiwanie po telefonie i nie dodaje tajnego fallbacku do poprzednich loginów. Pozostawienie telefonu w zapomnianym endpointcie lub przywrócenie go przez rollback nie jest zgodnością z nowym modelem. Zachować kontakt i uprawnione „Zadzwoń”.
8. Dopiero po odbiorze usunąć stare pola/ograniczenia/helpery, które przestały być potrzebne. Rollback ma osobną decyzję bezpieczeństwa i nie może nadpisywać nowych pseudonimów starym snapshotem. Stare migracje pozostają niezmienione; wdrożenie wymaga nowych wersjonowanych plików SQL i osobnej zgody na Cloud.

Nie zmieniać group_members, zgód share_first_name/share_full_name, ról, ocen, ledgerów, rozliczeń, wydarzeń ani zdjęć. Weryfikować zachowanie tych danych kontrolnymi odczytami, zamiast przebudowywać moduły. Nie usuwać istniejących pending przez UPDATE null: rozpoznać rodzaj operacji, szczególnie przerwaną zmianę hasła, i użyć kontrolowanej naprawy właściciela po przeglądzie. Zabezpieczone kopie danych zawierających PII poza Git.

## 3. Atomowa zmiana pseudonimu bez operation_pending

**Proponowany wariant minimalny: zachować aktywne sesje przy zmianie samego pseudonimu** — UUID, hasło i poziom uprawnień nie zmieniają się. To propozycja polityki sesji do zatwierdzenia. Nie używać `SessionManager.changeSession('identifiers')` ani begin/finish do tej operacji. Nie wykonywać aktualizacji Auth e-maila/hasła.

Edge: istniejące verifyPassword + limit prób i świeży kontekst sesji; potwierdzenie tylko gdy nickname zmienia się według ustalonej normalizacji. Następnie jedna transakcja RPC: blokada konta w zgodnej kolejności z PR16, ponowne sprawdzenie session_valid/security_version/owner, UNIQUE nickname, update i idempotencja. Konflikt23505 →409, rollback zachowuje poprzednią nazwę i sesję. Request_id wiązać z ownerem i bezsekretnym payloadem; konflikt tego samego id/innych danych →409. Brak przechowywanego „proof=true” od klienta. Wylogowanie/reset równoległe nie mogą zaakceptować zapisu na podstawie nieaktualnej sesji.

**Ważna pułapka PR16:** slm_premium_profile_save zapisuje p_body w slm_v2_requests. Po dodaniu pola obecnego hasła nie wolno przesłać pełnego body formularza do RPC/ledgeru. Edge musi wybrać jawnie dozwolone pola i usunąć hasło przed SQL, audytem i porównaniem idempotencji. verifyPassword korzysta z hasła tylko w pamięci.

Jeżeli pseudonim, display_as, dane imienia i zgody zapisywane są jednym formularzem, to finalny zapis tych danych musi pozostać jedną transakcją PR16 z dotychczasowym potwierdzeniem ujawnienia A–G. Błąd unikalności/anulowanie ma wycofać całość, a nie pozostawić nowe zgody ze starym loginem. SQL nie weryfikuje hasła samodzielnie: uprzywilejowany RPC wyłącznie przez przejrzany Edge, brak EXECUTE anon/authenticated. Polityki RLS nadal sprawdzają UUID i żywą sesję.

## 4. Konkretne pliki i funkcje do zmiany w przyszłej implementacji

| Obszar | Pliki/funkcje |
|---|---|
| Nowe wersjonowane SQL | app/supabase/migrations/: kanoniczny nickname/unikalność, rejestr obu typów kont, resolver nickname/email_login, atomowy save; historyczne35 migracji bez edycji |
| Prywatne projekcje i zapis PR16 | slm_email_identity, slm_email_profile_save, slm_premium_profile_save, slm_private.public_player_name/profile_display_name; zgodne odczyty nickname i zachowane redakcje |
| Edge accounts | app/supabase/functions/accounts/handler.ts: alias/profile/login/verifyPassword, identifiers, save_premium_profile/save_email_profile/save_profile, create_account, signup i list_accounts; reset_password przegląd kompatybilności |
| Sesja | app/src/auth/sessionManager.ts: serializacja mutacji i generation; zachować TokenStore i refresh, brak przechowywania hasła |
| Adaptery i DTO | app/src/auth/api.ts, uiAdapter.ts, profileAdapter.ts, useOwnProfile.ts, app/src/ui/personalProfile.ts — jedna nazwa, prywatny opcjonalny e-mail, kontakt bez funkcji loginu |
| Istniejące formularze | app/src/profile/PremiumIdentityEditor.tsx, src/demo/Identity.tsx/Profile.tsx, src/pages/Accounts.tsx, src/account-ui/Fields.tsx/AccountScreens.tsx/model.ts — tekst „Pseudonim lub e-mail”, jedno pole nazwy i potwierdzenie hasłem, bez nowego projektu UI |
| Telefon | app/supabase/functions/_shared/phone.ts i auth/phone.test.ts — normalizacja kontaktów pozostaje, login nie wywołuje isPhoneIdentifier/normalizeLoginPhone |
| Narzędzia/testy | scripts/accounts-admin*.mjs, test-accounts-local.mjs, test-scoped-http-local.mjs, audit-account-identifiers-local.mjs, test-premium-profile-http-local.mjs, supabase/tests/premium_profile_name.sql i testy adapterów/formularzy |

Demo/symulator nie może wejść do prawdziwego Auth; odpowiednie teksty i model kont zmieniać tylko w świadomie wspólnych komponentach. Nie zmieniać karty, CSS ani meczów/rozliczeń w tym zadaniu. Oddzielna lokalna poprawka ołówka na feat/ui-beta nie jest częścią PR17 i pozostaje nietknięta.

## 5. Rejestracja, e-mail i odzyskiwanie

- Rejestracja docelowo: obowiązkowy pseudonim+hasło, opcjonalny e-mail, bez obowiązkowego telefonu/imienia. Rezerwacja nickname/utworzenie profilu musi być odporne na równoległe signup; Auth i SQL nie tworzą wspólnej transakcji. Przy przerwaniu provisioning konto bez poprawnego stanu sesji nie uzyskuje dostępu. Cleanup dotyczy wyłącznie nowego konta tej operacji; nie wolno usuwać istniejącego UUID przy kolizji lub automatycznie łączyć kont po mailu.
- Dla już potwierdzonych osobistych adresów migracja może zachować alternatywne logowanie bez wysyłki. Dodanie/zmiana nowego e-maila wymaga zatwierdzonego potwierdzenia własności, żeby nie przypisać cudzego adresu i nie otworzyć przejęcia/recovery. Bez takiego procesu nie aktywować nowego email_login. Nie używać admin email_confirm=true dla realnych zgłoszeń jako zamiennika weryfikacji.
- Repo ma signup/resend/recover_email za SLM_EMAIL_SIGNUP_ENABLED i lokalnie blokujące hooki. Nie uznajemy opisu kodu za odczyt rzeczywistej konfiguracji Cloud ani nie wyłączamy działającej rejestracji użytkownika. Przed zmianą uzgodnić rzeczywisty punkt wejścia i konfigurację; bez prób wysyłania wiadomości w tej analizie.
- Bez e-maila nie ma samodzielnego odzyskiwania przez e-mail; telefon kontaktowy nie jest dowodem tożsamości. Nie dodawać SMS/OTP ani obiecywać recovery. Potrzebna procedura ręcznego potwierdzenia właściciela konta oraz rola uprawniona do resetu, bez odczytu starego hasła. Utrata hasła jedynego administratora wymaga osobnej ścieżki właściciela projektu.

**Czy reset administratora działa dla wszystkich typów?** Endpoint reset_password działa po UUID, nie zależy od istnienia aliasu i technicznie obsługuje oba istniejące typy. Źródło ma realny test legacy w scripts/test-accounts-local.mjs i test e-mail w scripts/test-scoped-http-local.mjs (reset12 znaków, odrzucenie starej sesji/refresh, temporary gate i obowiązkowa zmiana). Historyczne wyniki opisują AUTH_PROOF.md / AUTH_MODEL_SLM_1_0.md. **To nie dowód dla wszystkich stanów kont ani nowego modelu**: list_accounts pobiera tylko slm_aliases, więc UI może nie pokazać kont e-mail; reset wymaga globalnej slm_roles.admin, nie administratora grupy, nie obejmuje self_reset, brakującego security ani już operation_pending. Awaria Auth między begin/finish nadal może pozostawić blokadę. prepare_recovery jest osobnym narzędziem service_role właściciela po10 minutach, nie publicznym recovery. W tej analizie niczego nie resetowano; pełny odbiór po zmianie modelu obowiązkowy. Nie obiecujemy uniwersalnego odzyskiwania.

## 6. Krytyczne testy i małe etapy

1. **Audyt danych i decyzje** — tylko odczyt, raport kolizji/formatów/proweniencji e-mail/telefonów/pending; backup. Akceptacja mapowania bez zmiany UUID. Żadnej automatycznej migracji przy nierozstrzygniętych kolizjach.
2. **SQL expand na nowej izolowanej instancji** — replay, dry-run/backfill kopii, unikalność NFC/case/Unicode i równoległość, konflikt z historycznym loginem. Porównać UUID oraz liczniki relacji/zgód/zdjęć/rozliczeń; żadnych testów niszczących istniejące konto.
3. **Edge i atomowy zapis** — udane dwa typy kont, dwa konta walczące o nickname, podwójne kliknięcie/request_id, utrata odpowiedzi, błędne hasło, rollback wszystkich pól/zgód; oba konta nadal mogą się zalogować po przegranym konflikcie. Brak operation_pending dla rename i brak haseł w p_body/slm_v2_requests/logach. RLS/IDOR/metadane roli, świeżość sesji przy równoległym logout/reset. Sprawdzić identyczną normalizację SQL/Edge, brak publicznego odczytu rejestru/e-maili.
4. **Frontend Premium i kompatybilność** — jedno pole nickname/login, hasło w pamięci i kasowane; read-back, Anuluj, potwierdzenia PR16 A–G,3 tryby,2 grupy, numer/zdjęcie bez zmian; stare wersje formularzy nie omijają nowego zapisu. Unit/TypeScript/lint/build i przeglądarka/POCO Light-Dark/klawiatura, bez redesignu.
5. **Cutover i odbiór** — nickname oraz potwierdzony opcjonalny e-mail logują do tego samego UUID; techniczny e-mail nie jest oferowany jako osobisty alias; telefon/stary login odrzucone w każdym publicznym resolverze. Bezpośredni Auth JWT nadal nie omija bramki zatwierdzonych sesji/RLS. Restart/refresh/logout i macierz resetu legacy/e-mail/bez-emaila/disabled/pending/admin oraz ręczne przekazanie hasła. Rejestracja z/bez e-maila, duplikat, niedostarczona weryfikacja i osierocony provisioning. E-mail bez realnego dowodu własności pozostaje nieaktywny, recovery NOT TESTED dopóki nie odebrane.
6. **Dopiero po akceptacji** — osobny PR implementacyjny lub uzgodniona kontynuacja PR17, odrębna zgoda na wdrożenie Cloud, odbiór modułu i osobny merge. Potem ewentualny contract cleanup. Ten dokument ani wcześniejszy PR17 nie są zgodą na wykonanie migracji.

### Brakujące decyzje / blokery

- Format i normalizacja wspólnego nickname/login (propozycja minimalna: obecne3–32, NFC i bez rozróżniania wielkości liter; obecne pseudonimy mogą nie pasować), reguły dla konfliktu starego loginu z zaakceptowanym pseudonimem innego konta oraz zatwierdzone nazwy zastępcze. Bez arbitralnego rozstrzygania.
- Potwierdzenie proponowanego zachowania sesji: rename z obecnym hasłem zachowuje sesje; reset/zmiana hasła zachowują odrębne zasady cofania. Jeśli wymagane wylogowanie innych sesji przy rename, zaprojektować atomową wymianę sesji, a nie begin/finish.
- Bezpłatny i faktycznie dostępny sposób weryfikacji nowego e-maila/publicznego signup oraz ręczne recovery; brak dowodu oznacza brak aktywacji danego przepływu, nie rezygnację z hasła.
- Czy kontakty telefoniczne mogą się powtarzać (zalecane, skoro nie są loginem); domyślna historyczna unikalność nie musi być nowym wymaganiem. Nie usuwać jej bez potwierdzenia.
- Okno cutover i sposób wymuszenia aktualizacji starego APK, backup/rollback, rozwiązanie istniejących pending i dostępność uprawnionego administratora kont.

**Weryfikacja tej pracy:** przegląd źródeł, migracji, PR16/17 i istniejących testów; wyłącznie dokumentacja. Nie uruchamiano nowych testów modyfikujących konta, buildów ani migracji. Historyczne254 Vitest/28 SQL/20 poprawnych kontroli+4 GAP z PR17 nie stają się PASS proponowanego modelu. Raport docs/ODPOWIEDZI_CODEX.txt.

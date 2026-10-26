# Przebudowa kont — kandydat, aktywacja zablokowana

2026-10-27 00:29 Europe/Warsaw. Gałąź `feat/account-model-foundation`, kontynuacja Draft PR18 z e81ddac; main nadal134c52b po PR16, PR17 niezmieniony. **Nie spełniono wszystkich kryteriów pełnej przebudowy.** Właściciel potwierdził brak działającej wysyłki/callbacków i polecił przygotować kod/testy, pozostawiając aktywację zablokowaną. Nie przedstawiamy kandydata jako nowego produkcyjnego Auth.

## Zaimplementowane i przetestowane lokalnie

- Jeden resolver kanonicznego nickname (trim/NFC/lower PostgreSQL) i potwierdzonego email_login. Zero fallbacku do telefonu lub dawnego aliasu. Kontrola faktycznego potwierdzenia Auth i zgodności wewnętrznego adresu; techniczny adres bez osobistego email_login nie jest publicznym loginem. Jednolity błąd nieznanego nicku/telefonu/technicznego e-maila/błędnego hasła; limity prób zachowane.
- Publiczny endpoint rejestracji **bez e-maila**: nickname+hasło, opcjonalny kontakt i pełna nazwa. Nowy UUID tylko dla nowego konta; member bez grup/globalnego admina. Idempotentne zadania z losową capability SHA256, bez haseł ani ich hashy w SQL. Hasło przechowuje wyłącznie Auth. Serwer nadaje losowy wewnętrzny adres Auth; jego administracyjne potwierdzenie nie jest i nie zastępuje potwierdzenia osobistego adresu użytkownika. Wpisanie rzeczywistego e-maila zwraca mail_unconfigured **przed** utworzeniem Auth/konta.
- Powtórzenie rejestracji nie tworzy drugiego konta i nie zmienia hasła. Przerwanie między utworzeniem Auth a SQL można wznowić nickname+poprawnym hasłem z tym samym UUID; złe hasło nie tworzy stanu aplikacji. Brak aktywnego profilu/członkostw przed ukończeniem provisioning. Rezerwacje obejmują tylko niezakończone zadania; zakończona historia nie blokuje starego nicku po rename.
- Ponowienie dawnej rejestracji zwraca oryginalny UUID i bieżący nickname. Opcjonalny expectedUserId w istniejącym SessionManager odrzuca sesję innego konta **przed** zapisem refresh tokenu, nawet jeżeli dawny nick przejęło konto z takim samym hasłem. Nie zmieniono TokenStore/Keystore ani polityki logout/refresh; wyjątkową zmianę SessionManager jawnie opisano w source contract i pokryto regresjami.
- `model_profile`: jedna transakcja łączy CAS/rename, pola PR16, numer, kontakt i zgody A–G. Potwierdzenie obecnym hasłem przy zmianie nickname; sama zmiana kontaktu nie wymusza zmiany loginu. Brak begin/finish/pending dla rename; błąd hasła, kolizja lub brak zgody nie zapisuje części pól ani nie odbiera sesji. Tylko jawne pola trafiają do SQL, current_password nie trafia do ledgeru. Stare niezgodne writery otrzymują426 przed modyfikacją.
- Oryginalny formularz Premium ma warunkowe pole telefonu i hasła oraz nową semantykę jednej nazwy. B1App/port rejestracji mogą korzystać z kandydata wyłącznie po jawnym opt-in; domyślne wejście nadal tego nie włącza. Pierwotny CSS, karta Ultimate, motywy i nawigacja bez zmian. Numer/zdjęcie można nadal edytować w istniejącym profilu po rejestracji; nowy formularz rejestracji nie pokazuje nieobsługiwanego początkowego numeru zamiast go ignorować.
- Reset konta nadal wymaga globalnej roli kont, nigdy samego admina grupy. W kandydacie administrator dodatkowo potwierdza niezależne sprawdzenie tożsamości i powód oraz podaje obecne hasło. Stare hasło nie jest odczytywane. Nowe tymczasowe12 znaków wymusza zmianę; stare hasło/JWT/refresh nie odzyskują dostępu. Lista kont administratora ma minimalną projekcję: bez nazwiska/telefonu/grup. Przerwane operacje pozostają fail-closed; istniejąca naprawa właściciela service_role po10 minutach została sprawdzona, nie dodano publicznego obejścia.

## Migracje i zgodność

Łącznie **42 migracje**: wcześniejsze35 +3 fundamentu +4 nowe tej kontynuacji:
- 20261026225907_account_model_candidate: stan aktywacji false, resolver, wspólny zapis profilu i provisioning/zadania rejestracji;
- 20261026231507_account_model_pending_signup_resume: bezpieczne wznowienie przerwanego provisioning;
- 20261026231801_account_model_contact_preflight: kontakt legacy kopiowany przy jawnym przygotowaniu bez zmiany UUID; różny kontakt lub numer zagraniczny wymagają decyzji, brak nadpisywania; aktywacja nie może powtórnie przywrócić usuniętego kontaktu;
- 20261026231929_account_model_signup_reservations: częściowy UNIQUE tylko niezakończonych rezerwacji.

Nie edytowano historycznych migracji ani modułów meczów/rozliczeń. Przygotowanie istniejącego środowiska jest osobną operacją, nigdy częścią automatycznego zastosowania migracji. Kontakty legacy pozostają w swoich rekordach aż do zatwierdzonego przeniesienia; nie ukrywamy zagranicznego numeru przez ciche usunięcie. Historyczne ograniczenie unikalności kontaktów pozostaje; zmiana tej polityki wymaga decyzji. Bez kont ze zmienionym UUID i bez łączenia kont po adresie.

## Audyt lokalnych danych — tylko READ ONLY

Anonimowe rekordy i grupy duplikatów: [ACCOUNT_MODEL_LOCAL_AUDIT.json](ACCOUNT_MODEL_LOCAL_AUDIT.json). Bez nazw, telefonów, e-maili, haseł i UUID. Kategorie mogą się nakładać.

| Instancja | Konta | Duplikat nickname | Nieprawidłowy format | Brak nickname | Pending |
|---|---:|---:|---:|---:|---:|
| developerska sunday-league-mates |64|46|53|3|0|
| slm-pr16-review |42|31|15|9|2|
| wcześniejszy fundament |9|0|0|0|0|

Nie znaleziono w tym odczycie konfliktu z cudzym starym loginem, mieszanej klasyfikacji, różnego kontaktu lub zagranicznego kontaktu; brak osobistego e-maila legacy jest oczekiwany, nie błędem. Wynik dotyczy lokalnych baz, nie Supabase Cloud. Dwóch pending PR16 nie naprawiano — są historycznym wynikiem diagnostyki; nie traktujemy ich jako zgody na reset.

**Procedura właściciela:** po anonimowym ID/grupie z raportu operator lokalnie odtwarza powiązanie z UUID używając saltu w ignorowanym `.cache/account-audit-salt` (hash z UUID, nigdy uprawnienie). Ogląda dane tylko w lokalnym narzędziu. Zatwierdza mapę UUID/stara wartość/nowy nickname prywatnie poza Git; nie wysyła raportu z PII do czatu. Migracja sprawdza oczekiwaną starą wartość, pełną globalną unikalność i transakcyjny rollback. Bez zatwierdzonej mapy oraz decyzji dla braków/pending nie uruchamiać przygotowania. Kod nie wybiera zwycięzcy duplikatu i nie dopisuje cyfr po cichu.

## Faktyczne testy końcowe

| Kontrola | Wynik i granica dowodu |
|---|---|
| TypeScript / ESLint |PASS|
| Vitest |264 PASS /45 plików; zgody, formularze, retry capability i oczekiwany UUID|
| Replay / SQL / RLS |70 PASS,42 migracje na nowym jednorazowym PostgreSQL; Auth/Storage w tym zestawie są fixture|
| HTTP od **pustej** bazy |49 PASS na nowym slm-account-final/59321, finalny schemat42; publiczny endpoint → prawdziwy Auth/Edge/PostgREST → grupy/profil/rename/logout/nowy login/odmowa telefonu → izolacja → reset legacy/e-mail/bez e-maila|
| Dodatkowe real HTTP |7 naprawy przerwanej operacji +7 wznowienia rejestracji +4 UUID/reużycia nazwy +3 minimalnej projekcji admina; osobny slm-account-candidate/58321|
| Browser UI |12 Chrome/Cypress: legacy+candidate ×320/360/390 ×Light/Dark, wysokości844/380, fokus/przewijanie/odstępy. Oryginalne komponenty, fikcyjny binding; nie E2E backendu ani fizyczna klawiatura Androida|
| Buildy |main/Premium/demo PASS; izolacja demo PASS, ostrzeżenia dużych chunków i rozwiązywania emitowanych assetów bez błędu|
| Source guards |42 wersje, chronione historyczne źródła i55 Premium PASS; jawny wyjątek oczekiwanego UUID i warunkowych pól; CSS/karta/nav bez zmian, automatyczne deploymenty false|
| SQL lint |exit0;4 znane ostrzeżenia w starych slm_push_claim, slm_email_profile_save i group_finance_dispatch_core. Nowe funkcje bez ostrzeżeń|
| E-mail delivery/callback/recovery, realny Android |NOT TESTED / BLOCKED, nie oznaczać PASS|

E-mail potwierdzony w testach to **jawnie utworzony lokalny fixture zgodności**, nie dostarczenie maila do użytkownika. Wznowienie rejestracji testuje odtworzony punkt przerwania po Auth/przed SQL; nie wykonano chaos testów fizycznego zerwania TCP. W teście naprawy zasymulowano wiek11 minut wyłącznie nowego fikcyjnego konta. Pierwsze robocze przebiegi ujawniły zbyt ścisłe oczekiwanie403 zamiast bezpiecznego widoku discovery i konflikt stałego numeru fixture — poprawiono test, nie reguły grup. Finalny49 PASS przebieg wykonano w całkowicie nowej pustej bazie, bez resetu. Jedna gorąca próba wznowienia nie przeszła oczekiwanego statusu; końcowa, jawnie diagnostyczna próba7 PASS, bez obchodzenia potwierdzenia hasłem.

## Stan aktywacji i czego NIE ukończono

Po testach ustawiono **active=false w obu nowych projektach** i odczytano API: account_model=false/self_registration=false na58321 i59321. Nie jest aktywny nowy Auth w aplikacji ani backendzie POCO. Cloud i wcześniejsze bazy użytkownika nietknięte; wszystkie rzeczywiste fikcyjne konta Auth testów pozostawiono. Wyłączony silnik Docker uruchomiono z instalacji użytkownika bez resetu/zmian ustawień Windows. Źródła kontenera pochodzą z tej gałęzi, nie innego worktree.

**Brak pełnego zakończenia:** dodanie/zmiana osobistego e-maila, jego callbacki i dostarczenie oraz e-mail recovery wymagają dalszej implementacji i sprawdzonej bezpłatnej konfiguracji. Obecnie zwracają kontrolowaną odmowę lub pozostają niedostępne, nigdy fikcyjny sukces. Rejestracja z podanym e-mailem nie jest ukończona. Zgodnie z decyzją właściciela nie aktywowano części nowego modelu dla użytkowników. Osobistego e-maila nie wolno aktywować przez admin email_confirm=true. Regulamin/polityka w istniejącym UI nadal wymagają zatwierdzenia przed publicznym startem.

Rejestrację ogranicza twardy globalny budżet30 prób/dobę bez ufania spoofowalnym nagłówkom IP; nie jest to gotowe skalowalne anti-bot. Napastnik może wyczerpać wspólny budżet. Bezpośredni signup Auth w testach jest wyłączony, aplikacyjne publiczne signup idzie przez kontrolowany Edge. Przed publicznym uruchomieniem potrzebna decyzja o bezpłatnej ochronie antyautomatycznej, monitorowaniu i sposobie ręcznego rozwiązywania zadań signup, w których Auth nie został jeszcze utworzony. Nie dodano CAPTCHA ani nowej płatnej usługi.

## Odtworzenie / następne kroki

1. `python app/scripts/audit-account-model-local.py` odczytuje tylko trzy wskazane istniejące lokalne projekty. Zatwierdzić prywatną mapę konfliktów. Nie stosować automatycznego rename/naprawy do baz użytkownika.
2. Lokalny kandydat: `python app/scripts/prepare-account-model-local.py`, start CLI `.cache/account-model-stack` jak fundament, auth-baseline i functions serve. Tryb `--final` dotyczy osobnego **NOWEGO** `.cache/account-model-final`/59321. Dane/klucze tylko w ignorowanym cache.
3. Runner HTTP `test-account-model-http-local.mjs` obsługuje `SLM_ACCOUNT_MODEL_FINAL=1` i wymaga wtedy0 kont: **nigdy nie resetuje bazy**, ponowna próba na tym samym niepustym projekcie zatrzymuje się. Testy włączają stan wyłącznie w pustej testowej instancji; po testach wyłączyć go ponownie. Do pracy na wypełnionym kandydacie potrzebna świadoma, lokalna decyzja operatora po sprawdzeniu stanu; nie ponawiać cutover na ślepo. Pozostałe runnery HTTP obejmują recovery/resume/uuid/admin-privacy; SQL runner i Vitest są odrębne od pełnego HTTP.
4. Dokończyć potwierdzanie dodanego e-maila/callback/recovery, odebrać realne dostarczenie, legal i anti-bot. Dopiero wtedy wspólny cutover backend+UI i testy rzeczywistego klienta w przeglądarce/Androidzie. Zachować wyraźną odmowę dla starych klientów, bez telefonicznego fallbacku.
5. **APK nie przygotowano**, ponieważ pełny Auth nie spełnia kryteriów zakończenia. Nie ma podstaw do odbioru nowego modelu na POCO ani do wdrożenia/przygotowania „czystej” bazy Cloud przez kasowanie danych. Można planować przyszłą konfigurację, ale każda operacja Cloud wymaga osobnej zgody i rozwiązania blokad.

Raport docs/ODPOWIEDZI_CODEX.txt. Draft PR18, bez merge/deploy/publikacji i bez zmian PR17/14/15. Lokalne zmiany karty w root feat/ui-beta zachowane, nie przenoszone przy okazji.

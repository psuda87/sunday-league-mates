# Plan uwierzytelniania Sunday League Mates

Data analizy: 13.10.2026. Projekt: `hjtcyybkxebvdropchac`.

Aktualizacja realizacji 13.10.2026: wdrożono moduł z technicznym e-mailem i dwoma aliasami; pojedynczy test hooka zmiany e-maila przeszedł (403, adres niezmieniony). Użytkownik potwierdził podstawowe testy Androida; nowe zapamiętywanie refresh tokenu przez Keystore/Keychain wymaga jeszcze testu na telefonie. **CAPTCHA na polecenie użytkownika jest odłożona poza bieżący etap; integracji nie prowadzimy i nie włączamy jej.** Zachowano liczniki prób oraz limity Auth. Stan i procedury: [AUTH_MODULE.md](AUTH_MODULE.md), wyniki: [AUTH_PROOF.md](AUTH_PROOF.md). Pierwotna analiza poniżej nie oznacza ukończenia modułu ani gotowości publicznego wydania.

Status: rekomendacja techniczna do weryfikacji przed implementacją, a nie zatwierdzenie nowych wymagań biznesowych. Podstawą są `AGENTS.md` i specyfikacja v1.2, szczególnie rozdziały 3, 4, 13–15. Nie utworzono tabel, kont, funkcji ani nie zmieniono konfiguracji zdalnej.

Dokumentację wyszukano przez działający MCP `supabase-slm` (`search_docs`); `get_project_url` potwierdził adres projektu. Sprawdzono także oficjalne referencje API i [changelog Supabase](https://supabase.com/changelog). Nie odczytano rzeczywistych ustawień Auth ani planu rozliczeniowego projektu: poniższe ustawienia są wymaganiami wdrożenia, nie opisem aktualnej konfiguracji.

## 1. Wniosek i wybór wariantu

Supabase Auth może przechowywać i sprawdzać jedno hasło konta. Login/pseudonim nie jest natywnym identyfikatorem logowania Auth; potrzebne jest serwerowe mapowanie identyfikatorów. Własne dane aplikacji obejmują aliasy i stan uprawnień, **nigdy hasła ani ich skróty**.

Natywny wariant telefon + hasło jest udokumentowany: serwerowe `auth.admin.createUser({ phone, password, phone_confirm: true })` tworzy potwierdzony telefon, a `signInWithPassword({ phone, password })` nie wymaga OTP. Potwierdzenie administracyjne nie dowodzi własności numeru. Dostawca SMS jest potrzebny do przepływów wymagających potwierdzania przez SMS. [Tworzenie konta](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [logowanie hasłem](https://supabase.com/docs/guides/auth/passwords).

Nie potwierdzono jednak przez zmianę ustawień, czy panel tego projektu pozwoli włączyć Phone bez konfiguracji dostawcy. Ponadto zwykła zmiana `auth.phone` uruchamia potwierdzenie SMS, a wyłączenie potwierdzeń może otworzyć drogę do zmiany numeru bez obecnego hasła przez publiczny endpoint Auth. RLS tabel aplikacji nie chroni endpointów Auth. Nie należy uznawać samej funkcji pośredniczącej za rozwiązanie tych problemów. [Phone Login](https://supabase.com/docs/guides/auth/phone-login).

**Rekomendacja dla pełnego zestawu wymagań:** stabilny, techniczny identyfikator e-mail w Supabase Auth oraz dwa aliasy aplikacji: login i telefon. Oba aliasy serwer zamienia na to samo konto Auth i wywołuje email + password. Użytkownik nadal wpisuje wyłącznie „Login lub numer telefonu”; nie potrzebuje skrzynki pocztowej. Hasło pozostaje w Supabase Auth. Ten wariant omija dostawcę SMS oraz synchronizowanie zmiennego numeru w dwóch miejscach.

Techniczny adres jest losowy, niezależny od telefonu i loginu, nie zmienia się przy edycji profilu i nie służy wysyłaniu wiadomości. Nie jest sekretem: może znaleźć się w tokenie Auth. Format i akceptowaną domenę trzeba sprawdzić lokalnie; nie zakładamy, że Auth przyjmie dowolną domenę zastrzeżoną. Nie używać prawdziwych adresów osób trzecich.

Konto tworzy serwer przez `createUser({ email: technicalEmail, password: temporaryPassword, email_confirm: true })`, bez `signUp`, `inviteUserByEmail`, OTP ani magic link. Wyłączenie publicznych rejestracji nie zastępuje ochrony pozostałych endpointów. Rekomendowany bezpłatny **Send Email Hook** ma odrzucać wszystkie próby wysyłki udokumentowanym błędem; zastępuje wbudowaną wysyłkę. Potwierdzenia e-mail pozostają włączone, więc bezpośrednia zmiana technicznego adresu nie może zakończyć się bez potwierdzenia. Wyłączyć również powiadomienia bezpieczeństwa. Nie stosować hooka zwracającego sukces bez wysłania: niepotrzebnie pozostawiałby aktywne przepływy OTP. [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [obsługa błędów i dostępność hooków](https://supabase.com/docs/guides/auth/auth-hooks).

To zastosowanie udokumentowanych mechanizmów, lecz cały wariant wymaga testów integracyjnych, szczególnie blokady zmiany adresu i braku wiadomości. Jeśli testy nie potwierdzą tych właściwości, wdrożenie pozostaje zablokowane; nie uruchamiamy płatnej usługi. Natywny wariant telefoniczny pozostaje alternatywą po osobnej weryfikacji ustawień i blokowania SMS, nie jest obiecaną konfiguracją tego projektu.

## 2. Mapowanie loginu i telefonu oraz profil

Proponowane dane serwerowe: UUID konta Auth, unikalny znormalizowany login, unikalny telefon, techniczny adres Auth, aktywność konta i członkostwo. Oddzielnie: imię i nazwisko, wybór nazwy wyświetlanej oraz dane bezpieczeństwa opisane dalej. To model logiczny, nie migracja SQL.

Propozycja normalizacji wymagająca ustalenia przed implementacją: telefon w E.164, login po usunięciu otaczających spacji i bez rozróżniania wielkości liter; login nie może wyglądać jak numer. Unikalność wymusza baza, także przy jednoczesnych żądaniach. Nie zgadywać prefiksu kraju ani zasad polskich znaków bez decyzji. Gość bez konta nie jest aliasem Auth.

Publiczny endpoint logowania przyjmuje identyfikator i hasło; CAPTCHA jest odłożona poza bieżący etap. Serwer ogranicza próby, znajduje konto w prywatnym mapowaniu i wywołuje `signInWithPassword` dla jego technicznego adresu. Wynik musi zawierać oczekiwany UUID. Klient nigdy nie pobiera listy aliasów ani adresu do samodzielnego rozwiązywania. Nieistniejący alias, złe hasło i niedostępne konto zwracają ten sam komunikat: „Nieprawidłowy login, numer telefonu lub hasło”. Ograniczać także różnice czasowe i koszty obsługi nieznanych aliasów.

Nazwę wyświetlaną obliczamy z profilu: pseudonim albo imię i nazwisko zgodnie z wyborem; przy braku pełnego imienia i nazwiska zawsze pseudonim. Nie używamy tej nazwy do autoryzacji. Numery udostępnia wyłącznie widok dla uprawnionych członków grupy po zakończeniu zmiany hasła.

## 3. Hasło tymczasowe: blokada po stronie serwera

Nie znaleziono udokumentowanej flagi Supabase automatycznie realizującej „hasło tymczasowe — zmień przy pierwszym logowaniu”. Proponujemy prywatny stan aplikacji: `must_change_password`, stan operacji, wersję bezpieczeństwa konta i zatwierdzone sesje. Brak stanu oznacza odmowę dostępu.

Po utworzeniu konta lub resecie `must_change_password = true`. Supabase może wydać prawidłowy JWT, ale aplikacja pozwala wtedy tylko sprawdzić własny stan, zmienić hasło i wylogować się. Wszystkie dane biznesowe i operacje administracyjne pozostają niedostępne.

Blokada musi obejmować:

- restrykcyjną politykę RLS dla odczytu i zapisu wszystkich tabel biznesowych (`USING` i `WITH CHECK`) wraz z normalnymi regułami właściciela/członkostwa;
- prywatne Storage, RPC, widoki i kanały Realtime; bez publicznych plików ani długowiecznych podpisanych URL omijających kontrolę;
- każdy endpoint serwera, również używający klucza uprzywilejowanego, który omija RLS.

Stan sprawdzamy w bazie podczas żądania. Nie polegamy wyłącznie na `user_metadata` ani na fladze w JWT: metadane użytkownika są edytowalne, a token może zawierać nieaktualny stan. Funkcja pomocnicza RLS ma minimalne uprawnienia, ustalony `search_path` i nie może pozwalać klientowi na modyfikowanie stanu. [RLS i ograniczenia metadanych JWT](https://supabase.com/docs/guides/database/postgres/row-level-security).

Endpoint kończący zmianę weryfikuje JWT w Supabase, aktualną wersję operacji i obecne hasło przez Auth, przyjmuje nowe hasło różne od obecnego, wykonuje zmianę w Auth i dopiero po sukcesie usuwa blokadę. Nie zapisuje żadnego z haseł. Oddzielny klient Auth dla każdego żądania zapobiega mieszaniu sesji; pomocniczej sesji sprawdzającej hasło nie zwracamy ani nie zatwierdzamy do dostępu aplikacji.

Bezpośrednie `auth.updateUser` nie może usunąć flagi aplikacji. Zmiana hasła z pominięciem endpointu może pozostawić konto zablokowane; potrzebny będzie bezpieczny reset administratora. Nie przyjmujemy oświadczenia klienta „hasło już zmienione” jako dowodu.

Reset najpierw blokuje konto i unieważnia zatwierdzone sesje, następnie zmienia hasło w Auth. Dopiero sukces pozwala przekazać nowe dane ręcznie. Auth i baza nie tworzą jednej transakcji: operacje muszą być serializowane na konto, mieć identyfikator i porównanie wersji przed zakończeniem. Nie trzymać transakcji SQL otwartej przez wywołanie HTTP. Awaria pozostawia blokadę i umożliwia bezpieczne ponowienie przez administratora.

JWT po wylogowaniu może pozostać ważny do wygaśnięcia. Dlatego po resecie stare sesje nie mogą odzyskać dostępu nawet po usunięciu flagi. Proponujemy zatwierdzanie konkretnych `session_id` dla bieżącej wersji bezpieczeństwa dopiero po logowaniu przez serwer; kontrola obejmuje również istnienie sesji w Auth. Odświeżony JWT tej samej unieważnionej sesji nadal jest odrzucany. Nowa sesja uzyskana bezpośrednio z Auth wymaga jawnej kontroli i zatwierdzenia przez endpoint aplikacji. [Sesje i unieważnianie](https://supabase.com/docs/guides/auth/sessions).

## 4. Administrator, reset i zmiana danych

Role przechowujemy w prywatnym, nieedytowalnym dla zawodników członkostwie. Serwer sprawdza aktualną rolę i stan sesji przy każdej operacji administracyjnej; `user_metadata`, parametr `role` oraz ukryty przycisk nie dają uprawnień. Ewentualny claim roli jest wyłącznie pomocniczy. Nie tworzymy publicznego endpointu nadawania pierwszego administratora.

Klucz secret/service_role jest tylko w sekretach serwera, nigdy w Ionic, `VITE_*`, repozytorium czy logach. Każdy uprzywilejowany endpoint sam weryfikuje JWT, UUID wykonawcy i jego uprawnienia. Sam CORS albo publishable key nie stanowi uwierzytelnienia.

Administrator generuje silne losowe hasło tymczasowe, ustawia je przez `auth.admin.updateUserById(userId, { password })` i przekazuje ręcznie. API administracyjne stosuje zmiany bez przepływów potwierdzenia; nie daje odczytu obecnego hasła. Nie pobieramy także hashy z wewnętrznych tabel Auth. Historia obejmuje wykonawcę, konto, czas i wynik, bez haseł i tokenów. [Administracyjna aktualizacja](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).

Zmiana loginu lub telefonu: tylko własne konto, zatwierdzona sesja, obowiązek podania obecnego hasła sprawdzonego przez Auth i zgodność UUID. Następnie atomowa aktualizacja aliasów z ograniczeniami unikalności; nie zmieniamy technicznego adresu ani `auth.phone`. Stary alias przestaje działać. Pola te nie mają bezpośrednich uprawnień UPDATE/RPC dla klienta. Operacja nie jest dostępna podczas obowiązkowej zmiany hasła.

Zwykła zmiana hasła również powinna wymagać obecnego hasła na serwerze. Dokumentacja opisuje `current_password` i ustawienie wymagania obecnego hasła; trzeba sprawdzić je z wybraną wersją SDK. Nie używamy przepływu `reauthenticate()` z nonce wysyłanym mailem/SMS. Starsze ustawienie „Secure password change” wymaga takiego nonce dla starszej sesji i samo nie spełnia wymagań. Ochrona przed wyciekłymi hasłami jest płatna; nie opieramy na niej planu. [Bezpieczeństwo haseł](https://supabase.com/docs/guides/auth/password-security).

## 5. Ograniczanie prób i granice Free

Propozycja: licznik prób i krótkotrwałe opóźnienia w PostgreSQL, atomowo według IP oraz znormalizowanego aliasu/UUID, wspólne dla telefonu i loginu. Ograniczyć logowanie, sprawdzanie obecnego hasła, reset i tworzenie kont; dodać limit całego endpointu. Konkretne progi i retencja wymagają strojenia. Unikać trwałej blokady konta, którą może wywołać obca osoba. IP brać wyłącznie z zaufanej infrastruktury; dowolny nagłówek klienta jest fałszowalny.

CAPTCHA jest odłożona poza bieżący etap decyzją użytkownika; nie włączać Auth CAPTCHA ani nie kontynuować integracji `captchaToken`. Istniejące limity pozostają. Liczniki aplikacji nie obejmują bezpośrednich wywołań Auth; dodatkowa ochrona pozostaje tematem przyszłego etapu. Nie zakładamy płatnego WAF/Redis. [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [API logowania](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).

Dokumentacja rate limits nie gwarantuje nam pełnej, konfigurowalnej blokady prób password per konto. Limitu odświeżania tokenów nie przedstawiamy jako limitu błędnych haseł. Serwer pośredniczący może skupiać ruch pod jednym IP; udokumentowane `Sb-Forwarded-For` wymaga klucza `sb_secret`, jawnego włączenia przekazywania IP i zaufanego źródła adresu. Legacy service_role nie wspiera tego mechanizmu. [Rate limits](https://supabase.com/docs/guides/auth/rate-limits).

Hook Password Verification Attempt jest dostępny dopiero w Teams/Enterprise, więc **nie można na Free obiecać własnej blokady wszystkich prób na publicznym Auth**. Free pozwala na Send Email/Send SMS i Custom Access Token, ale hook tokenowy nie zastępuje ograniczania nieudanych prób hasła. Jeśli wymaganiem stanie się ścisły globalny limit prób per konto, potrzebna będzie ponowna decyzja o rozwiązaniu; płatny plan nie jest automatycznym wyjściem.

Free ma limit 500 000 wywołań Edge Functions miesięcznie na organizację; uwierzytelnianie i jego nadużycia zużywają tę pulę. Monitorować również Auth MAU, bazę i transfer według aktualnego panelu. Po przekroczeniu limitów akceptujemy ograniczenie działania, bez upgrade i płatnych nadwyżek. Projekt Free może być pauzowany przy niskiej aktywności; nie obiecujemy gwarantowanej dostępności ani płatnych kontroli czasu sesji. [Limity funkcji](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations), [checklista produkcyjna](https://supabase.com/docs/guides/deployment/going-into-prod).

## 6. Wymagane ustawienia panelu — do wykonania dopiero w implementacji

| Obszar | Rekomendowane ustawienie |
|---|---|
| Organization / Billing | Potwierdzić Free; nie aktywować planu płatnego ani dodatków. |
| Authentication / General configuration | Allow new users to sign up: OFF; anonymous sign-ins: OFF; manual identity linking: OFF. |
| Sign In / Providers | Dla wariantu rekomendowanego Email ON, Confirm Email ON, Secure Email Change ON; Phone i nieużywane OAuth/Web3 OFF. |
| Authentication / Hooks | Send Email: odrzucający hook PostgreSQL, bez SMTP i bez zapisywania payloadów/OTP. Brak dostępu wykonawczego dla anon/authenticated/public; minimalne granty dla supabase_auth_admin. |
| Email / Security notifications | Wyłączyć automatyczne powiadomienia o zmianach hasła, adresu, telefonu i czynników MFA; sprawdzić każdy dostępny typ. |
| Password security | Ustalić silne minimum hasła; sprawdzić wymaganie obecnego hasła. Nie włączać nonce przez mail/SMS ani płatnej ochrony wyciekłych haseł. |
| Attack protection / Rate Limits | CAPTCHA odłożona, nie włączać. Zachować obecne limity; forwarding IP tylko z zaufanego serwera i wspieranym kluczem. |
| URL configuration | Własne, dokładne dozwolone adresy; bez szerokich wildcardów produkcyjnych. |
| API / dane / Storage | RLS i granty minimalne, prywatne zasoby, niewystawione mapowania i stan bezpieczeństwa. |
| Edge Functions / Secrets | Klucze uprzywilejowane tylko po stronie serwera; logowanie bez treści żądań i nagłówków autoryzacji. |

Nazwy sekcji panelu mogą się zmieniać. Ustawienia rejestracji są udokumentowane w [General configuration](https://supabase.com/docs/guides/auth/general-configuration). Brak własnego SMTP nie oznacza braku poczty: istnieje wbudowana wysyłka, którą w rekomendacji zastępuje hook.

## 7. Pierwszy administrator

Po przyszłym wdrożeniu zabezpieczeń właściciel projektu uruchamia jednorazowy, lokalny skrypt administracyjny w zaufanym środowisku. Sekret podaje z lokalnego magazynu/zmiennej procesu, a nie z argumentu polecenia lub pliku śledzonego przez Git. Skrypt tworzy potwierdzone konto przez Admin API, z losowym hasłem tymczasowym, i przypisuje rolę konkretnemu otrzymanemu UUID przez uprawnioną operację bazy.

Tworzenie konta i przypisanie roli nie są atomowe: brak członkostwa/stanu pozostawia konto bez dostępu. Skrypt ma być odporny na ponowienie i nie promować przypadkowego konta znalezionego po podobnym loginie. Nie stosować „pierwszy zarejestrowany jest adminem”. Pierwszy administrator także musi zmienić hasło przed funkcjami grupy. Po zakończeniu usunąć lokalny sekret i skryptowi odebrać dostęp operacyjny; nie pozostawiać endpointu bootstrap. Dostęp do panelu Supabase chronić MFA konta właściciela. TOTP dla administratora aplikacji pozostaje dodatkową propozycją wymagającą decyzji, bez SMS.

## 8. Warunki odbioru przed wdrożeniem

1. Admin tworzy konto mimo wyłączonej publicznej rejestracji; oba aliasy i jedno hasło prowadzą do jednego UUID. Brak SMS/maili także przy bezpośrednim OTP, recovery, zmianie e-maila i powiadomieniach bezpieczeństwa.
2. JWT z hasłem tymczasowym nie daje dostępu przez REST, RPC, Storage, Realtime ani funkcję administracyjną. Zmiana metadanych i bezpośrednia zmiana hasła nie usuwają blokady.
3. Reset blokuje stare JWT i refresh tokeny również po ukończeniu zmiany nowego hasła. Równoległy reset nie jest cofany przez kończącą się wcześniejszą zmianę.
4. Zawodnik nie nadaje sobie roli ani nie resetuje innej osoby. Złe obecne hasło odrzuca zmianę aliasów; konflikt unikalności nie pozostawia częściowego zapisu.
5. Awaria między bazą a Auth pozostawia konto zablokowane, z możliwością bezpiecznej naprawy. Nie ma haseł/tokenów w logach, historii ani tabelach aplikacji.
6. Limity aplikacji obejmują naprzemienne używanie obu aliasów. Mobilna CAPTCHA i jej weryfikacja są odłożone poza bieżący etap; nie należą do aktualnych kontroli.
7. Prywatność telefonów oraz wybór nazwy spełniają specyfikację. Pierwszy administrator powstaje tylko przez kontrolowaną procedurę właściciela.

Testy te są planem przyszłej implementacji. Nie wykonano ich na projekcie zdalnym w ramach tej analizy i nie uznajemy rekomendacji za gotowe, działające uwierzytelnianie.

## 9. Kontrola dokumentacji i istniejącego szkieletu

Dodano wyłącznie ten dokument. Wcześniejsze zmiany `AGENTS.md`, `README.md`, specyfikacji i katalog `pics/` pozostawiono bez ingerencji. Build webowy i lint: OK; Vitest: 1/1; Cypress: 1/1. Build/Vitest wymagały uruchomienia poza sandboxem po `spawn EPERM`; Cypress wymagał usunięcia odziedziczonego `ELECTRON_RUN_AS_NODE=1` wyłącznie w procesie testowym. Pozostały ostrzeżenia o wielkości chunków i nieaktualnej bazie Browserslist. Kontrola białych znaków dokumentu nie zgłosiła błędów. Nie synchronizowano Androida, ponieważ nie zmieniono kodu webowego. Nie wykonano commita ani pusha.

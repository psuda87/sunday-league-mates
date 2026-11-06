# Testowy scenariusz meczów i składek

2026-11-05, `feat/premium-legal-pages`, projekt `hjtcyybkxebvdropchac`.
Na wyraźne polecenie właściciela przygotowano wyłącznie nowe fikcyjne dane.
Nie zmieniano istniejących kont, członkostw, haseł, meczów ani rozliczeń.

Operacja: `e55e1aef-0df5-4866-bfac-6ac064b155bd`.
Grupa „SLM Test — mecze i składki”: `a51b34c8-dc3b-42a8-9c4e-02722c80e960`.
12 fikcyjnych członków, w tym osobne konto administratora grupy i gracza.
Wszystkie konta mają globalną rolę member; administrator dotyczy wyłącznie tej grupy.
Loginów, haseł, tokenów i danych kont nie zapisano w wersjonowanej dokumentacji.

- Rozegrany: `f7d631ad-5ff5-4cab-a0d8-396770a82bd9`, 4 listopada2026,19:00 Warszawa.
- Nadchodzący: `98f631c6-33c1-4e97-91fd-14ad23c4fbec`, 6 listopada2026,19:00 Warszawa.
- Oba: prywatne, boisko testowe,90min,12 miejsc/12 zapisanych, koszt270zł (180zł/h).
- Rozegrany zatwierdzony do rozliczenia normalnym group_finance_approve.
  12 należności po23zł; nadwyżka naliczona6zł, bez otrzymanych rzeczywistych pieniędzy.
- Administrator ma własne23zł nieopłacone. Konto gracza i trzeci fikcyjny zawodnik
  zgłosili po23zł przez group_finance_submit_payment: dokładnie2 pending,0 accepted.
  Ich należności nie zostały spłacone samym zgłoszeniem wpłaty.

Konta utworzono oficjalnym Supabase Auth Admin API jako potwierdzone fikcyjne
tożsamości, bez wysyłania wiadomości na fikcyjne adresy. Nie modyfikowano tabel
haseł ani konfiguracji normalnej rejestracji. Dodatkowa zgoda właściciela objęła
jednorazową zabezpieczoną operację w accounts: wersja14 → tymczasowa15 →16.
Po operacji potwierdzono zgodność wszystkich10 plików accounts16 z poprzednią14
oraz niezmienione verify_jwt. Nie pozostawiono endpointu bootstrap/testowego.
Zachowano wcześniejszy wyjątek CORS5196; nie wdrażano backendu46 z tej gałęzi.

Nowa grupa, mecze i zapisy powstały transakcyjnie jako jawne dane testowe. Pierwsza
próba transakcji została w całości cofnięta z powodu niejednoznacznego aliasu SQL;
poprawiona transakcja zakończyła się sukcesem. Nie usuwano ani nie przeliczano
wcześniejszych danych. Nie wykonano DDL, migracji, zmian usług płatnych ani UI.

PASS przez zwykłe API accounts: poprawne logowanie trzech nowych kont, odczyt
obu meczów po12 uczestników, grupa12 członków z właściwym administratorem,
saldo administratora -2300gr,2 wpłaty pending po2300gr, brak administracyjnej
projekcji surplus dla gracza. Sesje użyte do przygotowania zostały wylogowane.
Niezależny odczyt SQL:12 charge, minimum2300gr,2 pending,0 accepted,
0 globalnych administratorów w tym zestawie i600gr naliczonej nadwyżki.
To kontrola testowych danych/API, nie potwierdzenie rzeczywistych przelewów.

Identyfikacja do późniejszego sprzątania: wskazane group/event UUID oraz tag
`auth.users.raw_user_meta_data.slm_fixture_operation` równy UUID operacji.
Przed usuwaniem uwzględnić FK i historię finansową; nie usuwać innych grup/kont
na podstawie podobnej nazwy. Dane dostępowe i manifest roboczy pozostają lokalnie
w ignorowanym `.cache/slm-finance-fixture-20261105`, poza repozytorium.

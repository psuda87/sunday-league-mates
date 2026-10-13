# Moduł wydarzeń

Stan: 13.10.2026, `feat/events`. Wdrożenia wyłącznie do `hjtcyybkxebvdropchac`.
Auth jest scalony do main. Lokalne zmiany AGENTS.md i STATUS.md z poprzedniego
zadania zachowano i uzupełniono. Implementację przygotowano bez commita/pusha;
następnie użytkownik autoryzował zapis postępu na feat/events, bez scalania do main.

## Zakres i obsługa

Po zalogowaniu i wymaganej zmianie hasła przycisk **Mecze** otwiera listę.
Administrator tworzy i edytuje termin, miejsce, czas gry, stawkę, całkowity koszt
i limit. Godzina oraz limit są wymagane i nie mają zgadywanych wartości.
Minimum to 10 osób; domyślne wartości: 90 minut, 180 zł/h, 270 zł.
Zmiana czasu/stawki aktualizuje proponowany koszt, który można ręcznie poprawić.
Szybkie przyciski wybierają najbliższy czwartek lub niedzielę według daty Warszawy
otrzymanej z serwera (również bieżący dzień, jeśli jest odpowiednim dniem tygodnia).

Szczegóły zawierają uczestników, gości i osobną rezerwę. Każdy członek może zapisać
siebie i swoich gości, edytować dane gościa i zrezygnować. Gość zajmuje osobne
miejsce; przechowujemy konto odpowiedzialne za przyszłą opłatę. Wycofanie udziału
zapraszającego nie usuwa automatycznie gości. Administrator może dodawać innych
zawodników, wskazać odpowiedzialne konto gościa i zarządzać wszystkimi zapisami.

Rezerwa nie zajmuje miejsc. Przejście z rezerwy wymaga jawnego zapisu i ponownej
kontroli limitu — bez automatycznego awansu lub priorytetu. Przeniesienie z uczestników
na rezerwę zwalnia miejsce, ale zachowuje poprzedni stan w historii.
Powiadomienia push nie są wdrożone i interfejs nie potwierdza ich wysłania.

Do początku meczu można zapisywać się i rezygnować, także po 17:00. Po początku
zamknięte są także operacje gości i rezerwy; administrator nadal może oznaczać
nieobecność i odwołać mecz. Zapisani są domyślnie obecni. Nieobecność nie zmienia
konta odpowiedzialnego ani statusu zapisu. Po 17:00 w dniu meczu, przed początkiem,
mniej niż 10 zapisanych oznacza potrzebę decyzji administratora. System nie odwołuje
meczu automatycznie. Nie ma automatycznego zakończenia ani naliczania na początku.

Wyświetlane nazwy wynikają z bieżącego profilu (wybrane imię/nazwisko lub pseudonim,
z fallback do pseudonimu). Avatar to inicjały, bez pełnej karty, oceny i składów.
„Zadzwoń” uruchamia dialer; dla gościa bez numeru prowadzi do zapraszającego.
Lista pobiera 50 meczów na stronę; strony wybierają najnowsze terminy, w obrębie
strony prezentowane chronologicznie. Dane odświeża przycisk i każda udana operacja;
nie ma Realtime ani odświeżania w tle. Ostateczną decyzję zawsze podejmuje serwer.

## Model i bezpieczeństwo

- `slm_events`: termin timestamptz, miejsce, czas, stawka i koszt (numeric 12,2),
  minimum 10, obowiązkowy limit, scheduled/cancelled, autor i znaczniki czasu.
- `slm_event_participants`: uczestnik kontowy lub gość, niezmienne konto odpowiedzialne,
  registered/reserve/withdrawn, osobne absent, czas zapisu i rezygnacji.
  Wycofane wpisy pozostają; ponowny zapis po rezygnacji tworzy nowy udział.
- `slm_event_history`: globalny numer identity, mecz i udział, wykonawca,
  odpowiedzialne konto, rodzaj operacji, czas serwera, granica 17:00, after_cutoff
  i snapshot zdarzenia/udziału oraz previous_status/previous_event.

Historia i uczestnicy nie zawierają haseł/tokenów. Numer kolejności ustala serwer,
może mieć luki. Operacje jednego meczu są serializowane blokadą jego rekordu;
czas odczytywany jest przez clock_timestamp() po oczekiwaniu na blokadę.
To zapewnia kolejność zdarzeń danego meczu i ponowną kontrolę początku meczu.
Historia zachowuje wcześniejszą granicę i dane także po edycji terminu. Przejście
registered → reserve jest rozpoznawalne po previous_status — przyszłe rozliczenia
muszą uwzględnić je jako zwolnienie miejsca, tak jak rezygnację.

RPC `slm_events_dispatch` jest SECURITY INVOKER, ma pusty search_path i grant
wyłącznie dla service_role. Weryfikuje zatwierdzoną, żywą sesję, wersję, aktywność,
brak operacji bezpieczeństwa i zmianę hasła, a rolę odczytuje z tabeli.
Blokada SHARE stanu bezpieczeństwa utrzymuje tę weryfikację podczas transakcji.
Edge Function `accounts` weryfikuje JWT przez Auth, przekazuje własne user_id/sid
i tłumaczy stałe błędy; nie ufa tożsamości/roli podanej w body. Zachowano limity Auth
i globalne; dla operacji wydarzeń dodano ograniczenie 90/min na konto.

RLS jest włączone na trzech tabelach. authenticated ma jedynie SELECT meczów
i aktywnych zapisów przez istniejący current_session_valid(); anon nie ma grantów.
Bezpośrednie writes i RPC nie są dostępne klientowi, również administratorowi UI.
Historia dostępna tylko serwerowi. Partial unique index zapobiega podwójnemu
aktywnemu zapisowi konta na jednym meczu. Gość używa request_id UUID jako ID
udziału: powtórzenie tego samego żądania nie zajmie drugiego miejsca. Dwa różne
ID z tą samą nazwą mogą oznaczać dwóch gości; nie utożsamiamy ludzi na podstawie nazwy.

Termin administrator podaje jako lokalną datę/godzinę Europe/Warsaw; PostgreSQL
konwertuje na timestamptz. Nieistniejące godziny przejścia na czas letni są odrzucane
przez porównanie zwrotne; 24:00 jest odrzucane. Dwuznaczna godzina przy zmianie na
czas zimowy używa standardowej interpretacji PostgreSQL (czas standardowy), bez
osobnego wyboru przesunięcia w UI. Wynik szczegółów zawsze pokazuje termin Warszawy.

## Wdrożenia i odtwarzanie

Zastosowano migracje z `app/supabase/migrations/` w kolejności:

1. `20261013212841_events_module.sql` — tabele, RLS, indeksy, podsumowanie i atomowy RPC.
2. `20261013213423_events_edit_validation.sql` — edycja daty bez dodatkowej blokady
   po 17:00 (historia zachowuje stare snapshoty) i walidacja 24:00.
3. `20261013213917_events_finite_costs.sql` — odrzucenie PostgreSQL numeric NaN.

Wymagane są wcześniejsze migracje Auth. Źródła Edge: `app/supabase/functions/accounts/`;
wdrożono `accounts` **wersja 6**, bez nowego endpointu/bootstrap i sekretów klienta.
Nie zmieniano planu, ustawień Auth, rzeczywistego administratora ani zasobów proof.
Nie dodano zależności. `accounts-admin.mjs` przyjmuje jawny expected branch;
historyczne narzędzia zachowują domyślne feat/auth, test-events wymaga feat/events.

## Wyniki kontroli

- Build webowy i TypeScript klienta: OK. Strict TypeScript handlera Edge: OK. ESLint: OK.
- Vitest: **29/29 w 6 plikach**, w tym strefa/DST, brak zgadywanych pól,
  brama wydarzeń oraz regresja Auth i sesji.
- Cypress Chrome: **7/7**, w tym 2 nowe testy wydarzeń i 5 istniejących Auth.
  Pierwszy przebieg wykrył błędny selektor atrybutu Ionic w teście; po poprawce
  odczytu właściwości komponentu finalny przebieg przeszedł.
- Rzeczywisty `node app/scripts/test-events.mjs`: **7 grup PASS** — uprawnienia,
  tymczasowe hasło/stare sesje i RLS, wymagane pola/DST, wyścig o ostatnie miejsce,
  duplikaty, limit z gośćmi, niezależna rezerwa, zarządzanie gościem i obecnością,
  zapis po 17:00, historia rezygnacji, reset fikcyjnego konta i stare sesje,
  odwołanie i zamknięcie na początku. Sekrety tylko w pamięci, własne fixture'y usunięte.
  Pierwszy przebieg zatrzymał błędny limit godziny w harnessie (23 zamiast końca dnia);
  poprawiono harness, nie czas serwera ani limit usług.
- Testy narzędzia bootstrap: **6/6**. Finalny test API potwierdził również odrzucenie NaN.
- Niezależny odczyt po cleanup: 0 meczów, 0 uczestników i 0 wpisów historii wydarzeń;
  istniejące konta pozostawiono. Kontrola 135 nieignorowanych plików repozytorium:
  brak wykrytych lokalnych sekretów, PAT, rzeczywistych JWT i kluczy prywatnych.
- Dodatkowe zapytania tylko SELECT, bez danych fixture: podsumowanie przed/od 17:00
  zimą (16:00 UTC) i latem (15:00 UTC), zamknięcie dokładnie w chwili początku: OK.
- `cap sync android`, `assembleDebug`, `lintDebug`, `testDebugUnitTest`: OK.
  To kompilacja i automatyczne kontrole, **nie testy modułu wydarzeń na telefonie**.
- Po utrzymaniu request_id formularza gościa do sukcesu ponowiono build/lint,
  Cypress (7/7), cap sync i assembleDebug. Bez nowych zależności i bez commita/pusha.

Test API po 17:00 wymaga wieczornego okna serwera Warszawy; nie podmienia zegara
ani nie dodaje endpointu testowego. Zmienia termin tylko własnego fikcyjnego meczu,
aby sprawdzić zamknięcie zapisów. Do uruchomienia potrzebny lokalny, ignorowany
PAT jak w narzędziach Auth; nie podawaj go w rozmowie, argumentach ani logach.

Security advisor: INFO RLS bez policies dla celowo niedostępnej historii/serwerowych
tabel i WARN wyłączonej płatnej ochrony leaked-password. Nie włączano płatnej funkcji.
[Opis INFO](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[ochrona haseł](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Pozostały ostrzeżenia dużych chunków i danych Browserslist oraz wcześniejsze moderate
z audytu zależności; w tym zadaniu nie zmieniano zależności i nie ponawiano audytu.

## Ograniczenia i test na telefonie

Naliczanie należności, FIFO/przejęcia, wpłaty i blokada dwóch zaległych meczów są
**niewdrożone**. estimated_per_person to total_cost/liczba aktualnych zapisanych,
bez rezerwy i bez wycofanych, z opisem „rozliczenia nie są jeszcze aktywne”.
Nie jest to kwota do zapłaty; po odwołaniu również nie deklarujemy anulowania
nieistniejących należności. Odpowiedzialność finansową i obecność przechowujemy
osobno, ale nie naliczamy skutków żadnej z nich. Brak push, ocen, składów i kart UT.

Ręczny odbiór wydarzeń na Androidzie jeszcze nie wykonany. CAPTCHA pozostaje
odłożona, iOS niezweryfikowany. Odłożone ręczne testy offline i starej sesji Auth
nie są zaliczone i nie blokują tego etapu; automatyczny test resetu ich nie zastępuje.
Panel nie usuwa meczów ani kont: odwołanie pozostawia historię do przyszłych rozliczeń.

1. W `app/` uruchom `npm run build`, `npx cap sync android`, `npx cap open android`.
   W Android Studio uruchom nowy build na telefonie. Web: `npm run dev`.
2. Administrator: **Mecze → Utwórz mecz**. Wybierz czwartek/niedzielę, podaj godzinę,
   miejsce i własny limit. Sprawdź 90/180/270 oraz edycję i szacunkowy koszt.
3. Na fikcyjnym koncie zawodnika sprawdź zapis/rezygnację, gościa bez numeru i z
   fikcyjnym numerem (nie wykonuj połączenia); bez numeru dialer wskazuje zapraszającego.
4. Sprawdź osobną rezerwę i zwolnienie miejsca: brak autoawansu; jawny zapis zajmuje miejsce.
   Administrator może dodawać usuwać zapisy innych, poprawiać gości i zaznaczać nieobecność.
5. Odwołaj fikcyjny mecz: musi pozostać widoczny jako odwołany i blokować zapisy.
   Przy rzeczywistym początku sprawdź zamknięcie; przy <10 po 17:00 — potrzebę decyzji.
6. Zapisz wyniki odbioru bez danych kont w STATUS.md. Odwołaj ręczny mecz testowy;
   usunięcie jego danych wymaga osobnej, ograniczonej do tego fixture operacji właściciela.

Źródła sprawdzone przed implementacją:
[Supabase Database Functions](https://supabase.com/docs/guides/database/functions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[blokady PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html),
[limity Edge Free](https://supabase.com/docs/guides/functions/limits),
[changelog](https://supabase.com/changelog).

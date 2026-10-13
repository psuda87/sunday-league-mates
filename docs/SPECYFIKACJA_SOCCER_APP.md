# Sunday League Mates — specyfikacja pierwszej wersji

Wersja: 1.2 • Data: 13.10.2026 • Język aplikacji: polski

Dokument przeznaczony do dalszej pracy w VS Code, Android Studio i Codexie. Przygotowano repozytorium i szkielet Ionic React + TypeScript + Capacitor. Zatwierdzona nazwa produktu: Sunday League Mates; identyfikator: pl.psuda87.slm. Kierunek wizualny i karta zawodnika są zatwierdzone zgodnie z rozdziałami 4 i 12. Wersja 1.2 aktualizuje wyłącznie dokumentację, bez implementacji wyglądu ani uwierzytelniania.

Status realizacji 13.10.2026: na polecenie użytkownika rozpoczęto moduł kont na `feat/auth`. Minimalne ekrany używają ciemnego motywu; docelowa karta, mecze, rozliczenia i oceny nie są implementowane na tym etapie. `AUTH_MODULE.md` opisuje rozwiązanie i procedury, `AUTH_PROOF.md` wyniki oraz potwierdzone przez użytkownika podstawowe testy Androida. Pojedyncza próba zmiany technicznego e-maila potwierdziła blokadę przez hook. CAPTCHA jest odłożona poza bieżący etap; zachowujemy ograniczenia prób. Zatwierdzono zapamiętywanie sesji bez hasła: natywne tokeny w Keystore/Keychain, sprawdzanie dostępu na serwerze przy starcie, obsługa offline/odświeżania/wygaśnięcia, lokalne usunięcie po logout i odmowa starych sesji po resecie. Nowy magazyn oraz tworzenie/reset zawodnika z panelu wymagają jeszcze testów ręcznych.

## 1. Cel i zakres

Aplikacja dla jednej zamkniętej grupy grającej w piłkę na orliku, zwykle w czwartki i niedziele. Ma zastąpić zapisy w ankietach, ręczne pilnowanie składek i przypadkowy podział drużyn.

Pierwszą platformą jest Android. Projekt ma umożliwiać przygotowanie wersji iOS ze wspólnego kodu. Nie ma integracji z płatnościami: aplikacja prowadzi ewidencję należności, a administrator ręcznie potwierdza otrzymane wpłaty.

Zakres: konta tworzone przez administratora, karty zawodników, mecze, zapisy, goście, rezerwa, rozliczenia, anonimowe oceny, wyrównywanie składów, grafika boiska i powiadomienia.

Wszystkie usługi muszą działać na bezpłatnych planach. Nie włączamy płatnych planów ani rozliczania za użycie. Zatwierdzony kierunek: Supabase Free oraz Firebase Spark wyłącznie do FCM. Nie korzystamy z SMS-ów ani automatycznej poczty.

## 2. Status ustaleń

Zasady oznaczone jako „ustalone” wynikają z rozmowy z użytkownikiem. „Propozycja wdrożeniowa” oznacza wybór pomocniczy, który nie został jeszcze osobno zatwierdzony. Punkty otwarte opisano w rozdziale 15; nie należy samodzielnie traktować ich jako zaakceptowanych wymagań.

## 3. Role i konta — ustalone

### Zawodnik

- Ma własne konto utworzone przez administratora i kartę zawodnika; dane początkowe otrzymuje ręcznie.
- Przegląda wydarzenia, listy uczestników, karty innych członków i składy.
- Zapisuje się, rezygnuje i zapisuje na rezerwę.
- Dodaje gości, zarządza ich zapisami i finansowo za nich odpowiada.
- Widzi swoje należności, pozycje za gości oraz status wpłat.
- Ocenia uprawnionych uczestników meczu w wyznaczonym czasie.

### Administrator

- Jako jedyny tworzy i edytuje mecze oraz podejmuje decyzję o ich odwołaniu.
- Tworzy konta zawodników i zarządza grupą; ręcznie przekazuje dane początkowe.
- Potwierdza wpłaty, anuluje należności i rozstrzyga wyjątkowe przypadki.
- Może dobrać gościa spoza grupy oraz zaznaczyć zastępstwo.
- Odznacza osoby nieobecne; pozostali zapisani domyślnie są obecni.
- Kontroluje podejrzane oceny i poprawia automatyczne składy.

### Logowanie i zarządzanie danymi konta — ustalone

- Nie ma publicznej rejestracji ani zaproszeń mailowych. Nie wysyłamy SMS-ów ani automatycznej poczty, także przy tworzeniu konta i resetowaniu hasła.
- Konto pozwala logować się numerem telefonu lub unikalnym loginem/pseudonimem, z tym samym hasłem. Pole logowania ma etykietę „Login lub numer telefonu”. Numer jest identyfikatorem, bez weryfikacji SMS.
- Administrator ustawia hasło tymczasowe. Pierwsze logowanie wymaga jego zmiany przed korzystaniem z pozostałych funkcji aplikacji.
- Generowane hasło tymczasowe ma maksymalnie 12 znaków; moduł generuje dokładnie 12 znaków kryptograficznie losowych. Hasło ustawiane przez użytkownika wymaga minimum 8 znaków (maksimum 72 bajty UTF-8 w obecnym Supabase Auth); maksimum 12 znaków nie dotyczy własnego hasła użytkownika.
- Administrator może resetować hasło do tymczasowego i przekazać je ręcznie. Po takim resecie następne logowanie ponownie wymaga zmiany hasła. Administrator nie może odczytać obecnego hasła zawodnika.
- Zawodnik może zmienić hasło, login/pseudonim i numer telefonu. Zmiana loginu lub numeru wymaga podania obecnego hasła.
- Login i numer telefonu muszą być unikalne; oba identyfikatory prowadzą do tego samego konta.
- Role administracyjne są przyznawane wyłącznie przez uprawnioną operację serwera. Użytkownik nie może nadać sobie roli administratora.

Propozycja wdrożeniowa: utrzymanie sesji po ponownym uruchomieniu. Techniczny sposób logowania loginem lub telefonem w Supabase wymaga sprawdzenia aktualnej dokumentacji przed implementacją; nie zakładamy jeszcze konkretnego rozwiązania i nie tworzymy własnego systemu przechowywania haseł.

## 4. Karta zawodnika i ocena poziomu

### Ustalone

- Login/pseudonim oraz opcjonalne imię i nazwisko, opcjonalne zdjęcie i avatar zastępczy.
- Ustawienie „Wyświetlaj mnie jako” pozwala wybrać login/pseudonim albo imię i nazwisko. Wybrana nazwa obowiązuje na kartach, listach uczestników, ekranie ocen i grafice składów. Bez imienia i nazwiska używamy loginu/pseudonimu.
- Numery telefonów są widoczne dla zalogowanych członków grupy. Na karcie zawodnika i liście uczestników przycisk „Zadzwoń” otwiera systemowy dialer z numerem; połączenie wykonuje użytkownik w dialerze.
- Jedna ocena ogólna w skali 1–10; bez formularza wielu umiejętności.
- Początkowy poziom nowego zawodnika: 7.
- Nowy zawodnik ma oznaczenie „Nowy zawodnik”. Sposób stabilizacji oceny, warunki zakończenia tego oznaczenia oraz szczegóły rang pozostają zgodne ze statusem ustaleń poniżej.
- Ranga lub podobne oznaczenie pojawia się po zebraniu 5 ocen.
- Pierwsza słaba ocena nie może gwałtownie obniżyć poziomu.
- Znacznik „dobrze broni” jest dodatkowym atutem przy dobieraniu drużyn. Nie oznacza stałego bramkarza: zawodnicy zmieniają się na bramce.
- Nie ma sztywnych pozycji, stron boiska ani rozbudowanego podziału na pomoc/atak/obronę w formularzu ocen.

### Wygląd i warianty karty — ustalone

- Własny styl Sunday League Mates inspirowany kartami FIFA/EA FC Ultimate Team: charakterystyczny kształt, duży portret, wyraźna ocena i nazwa zawodnika.
- Grafitowo-zielone tło, miętowe obramowanie i subtelna poświata, zgodne z motywem opisanym w rozdziale 12.
- Karta jest komponentem HTML/CSS z dynamicznymi danymi, a nie jednym obrazem zawierającym tekst.
- Nazwa odpowiada ustawieniu „Wyświetlaj mnie jako”: login/pseudonim albo imię i nazwisko; bez imienia i nazwiska stosujemy login/pseudonim.
- Jedna ocena ogólna w skali 1–10, prezentowana z jednym miejscem po przecinku, np. „7,0”. Format wyświetlania nie zatwierdza wzoru stabilizacji.
- Znacznik „dobrze broni” przedstawiamy ikoną rękawic z czytelnym opisem. Nie oznacza stałej pozycji ani stałego bramkarza.
- Pełna karta na ekranie profilu; przycisk „Zadzwoń” pod pełną kartą. Obowiązują dotychczasowe zasady dostępu do numerów i kontaktu.
- Kompaktowy widok na liście uczestników: avatar, nazwa i ocena. Dotychczasowy przycisk „Zadzwoń” pozostaje dostępny na liście uczestników.
- Układ responsywny, czytelny na małych ekranach telefonu.
- Rozliczenia nie są elementem publicznej karty zawodnika; dostęp do karty nadal ogranicza członkostwo w grupie.

Propozycje informacji dodatkowych: liczba ocen i rozegranych meczów. Wymagają potwierdzenia przed implementacją; nie są zatwierdzonymi polami karty.

### Portret testowy do prototypu — ustalone

Używamy dostarczonego avatara anime: zawodnik od przodu, biało-niebieska koszulka z numerem 27, okrągła ramka i stadion w tle. Planowana lokalizacja: `app/public/images/player-demo.png`. Pierwszy wariant wykorzystuje cały avatar, bez wycinania postaci. Dane przykładowe: Piotr, poziom 7,0, „Nowy zawodnik”. Numer 27 jest elementem zdjęcia testowego, nie zatwierdzonym polem profilu.

Weryfikacja 13.10.2026: plik `app/public/images/player-demo.png` nie istnieje i wymaga ręcznego dodania. Nie tworzymy zastępczego zdjęcia. Opis referencji pochodzi z zatwierdzonych ustaleń; w tej aktualizacji dokumentacji nie dodajemy ani nie przetwarzamy grafiki.

### Propozycja wdrożeniowa: stabilizacja oceny

Przed uzyskaniem 5 ważnych ocen karta pokazuje „Nowy zawodnik”, a algorytm składów przyjmuje poziom 7. Od piątej oceny poziom wynosi:

`poziom = (5 × 7 + suma ważnych ocen) / (5 + liczba ważnych ocen)`

Przykład: pięć ocen ze średnią 5 daje poziom 6. Początkowa siódemka stopniowo traci wpływ. Nie jest to zwykła średnia — należy opisać to w informacji o ocenie. Poziom pokazywany z jednym miejscem po przecinku; algorytm używa pełnej precyzji. Nazwy rang i progi wymagają uzgodnienia. Sposób nadawania znacznika „dobrze broni” także wymaga potwierdzenia; proponowana edycja przez administratora.

## 5. Wydarzenia i zapisy — ustalone

Administrator tworzy wydarzenie z datą, godziną rozpoczęcia, czasem trwania, miejscem, kosztem i maksymalną liczbą miejsc. Minimum wynosi 10 osób.

Domyślne dane do formularza: czwartek lub niedziela, 90 minut, 180 zł/h, łączny koszt 270 zł. Czwartek zwykle zaczyna się o 19:30; godzina niedzielna nie została ustalona. Domyślne wartości można zmienić.

- Zapis zajmuje jedno miejsce. Każdy gość zajmuje kolejne osobne miejsce.
- Nie można przekroczyć limitu; ograniczenie sprawdza serwer.
- Można dołączyć po 17:00, także 5 minut przed meczem, jeśli jest miejsce i konto nie jest zablokowane.
- Przyjmujemy zamknięcie zwykłych zapisów na początku meczu; późniejsze korekty administratora to propozycja wdrożeniowa.
- O 17:00, jeśli jest mniej niż 10 osób, administrator decyduje, czy mecz odwołać, czy dobrać osoby i kontynuować. System nie odwołuje go sam.
- Odwołanie meczu anuluje wszystkie związane z nim należności i zobowiązania.

Rezerwa nie zajmuje miejsca i nie tworzy opłaty. Gdy miejsce się zwolni, osoby z rezerwy dostają informację. Nie ma automatycznego awansu ani uprzywilejowania pierwszej osoby na rezerwie: miejsce dostaje pierwszy skuteczny zapis. Kliknięcie musi przejść ponowną kontrolę limitu i blokady.

## 6. Obowiązek zapłaty, rezygnacja i FIFO — ustalone

Zapis, odpowiedzialność finansowa oraz faktyczna obecność to trzy oddzielne informacje.

### Przed 17:00 w dniu meczu

Rezygnacja jest bezpłatna. Zwalnia miejsce i nie pozostawia zobowiązania, również w przypadku gościa.

### Od 17:00 do początku meczu

- Zapisani zostają objęci obowiązkiem zapłaty. Kwota jest jeszcze szacunkowa.
- Rezygnacja zwalnia miejsce, ale pozostawia zobowiązanie i dodaje osobę do kolejki zastępstw.
- Nowy zapis przejmuje najstarsze aktywne zobowiązanie w kolejce FIFO. Poprzedni płatnik zostaje zwolniony z tej pozycji.
- Gdy nie ma aktywnego zobowiązania do przejęcia, nowy zapis tworzy dodatkowego płatnika.
- Administrator może anulować zobowiązanie, np. po rezygnacji przy wystarczającej liczbie zawodników. Nie odbywa się to automatycznie.
- Gościa obowiązują te same zasady; jego płatnikiem jest zapraszający.

FIFO: pierwsza skutecznie zapisana rezygnacja jest rozliczana pierwsza. Serwer ustala kolejność; przy identycznym czasie używa dodatkowego jednoznacznego numeru kolejności. Przejęte lub anulowane zobowiązanie nie może być wykorzystane drugi raz.

### Początek meczu

System ustala końcową liczbę płatnych udziałów i generuje należności. Liczy aktywnych uczestników i nieanulowane udziały osób, które zrezygnowały za późno bez zastępstwa. Nie nalicza opłaty rezerwie.

Sama nieobecność nie anuluje opłaty. Administrator może rozstrzygnąć wyjątek osobną operacją. Korekty po rozliczeniu muszą pozostawiać historię; sposób ponownego podziału kosztu wymaga ustalenia.

### Przykłady

| Sytuacja przy koszcie 270 zł | Rozliczenie |
|---|---|
| 10 zawodników | 10 udziałów po 27 zł |
| Z 10 osób jedna rezygnuje po 17:00, bez zastępstwa | 9 grających i 1 rezygnujący: nadal 10 udziałów po 27 zł |
| Zastępca zajmuje miejsce tej osoby | 10 udziałów po 27 zł; płaci zastępca zamiast rezygnującego |
| Z 13 osób jedna rezygnuje, administrator anuluje jej opłatę | 12 udziałów po 22,50 zł |
| Wśród 10 osób jest zawodnik i jego jeden gość | Zawodnik odpowiada za 54 zł: dwa udziały po 27 zł |

## 7. Goście — ustalone

Każdy uprawniony zawodnik może dodać osobę bez konta, podając jej imię lub pseudonim. Gość jest uczestnikiem konkretnego wydarzenia, nie staje się członkiem grupy.

- Zajmuje miejsce, liczy się do minimum i podziału kosztu.
- Należność automatycznie trafia na konto osoby, która go dodała.
- W rozliczeniu widać osobno udział własny i każdy udział gościa.
- Zapraszający może zrezygnować z udziału gościa zgodnie z regułami godziny 17:00.
- Administrator może potwierdzić wpłatę lub anulować należność.
- Nowy gość może przejąć zobowiązanie z FIFO.
- Gość może mieć opcjonalny numer telefonu, widoczny dla zalogowanych członków grupy. Jeśli go podano, „Zadzwoń” prowadzi do dialera z numerem gościa; przy jego braku kontakt prowadzi do numeru zapraszającego. Zasada obowiązuje na liście uczestników i przy prezentowaniu kontaktu gościa.

Propozycje wdrożeniowe: gość bez konta nie wystawia ani nie otrzymuje ocen; administrator może nadać mu orientacyjny poziom na potrzeby jednego meczu, domyślnie 7, oraz zaznaczyć dobrego bramkarza. Przy gościu dodanym przez administratora też należy wskazać odpowiedzialne konto — wyjątek od tej zasady wymaga osobnej decyzji.

## 8. Rozliczenia i blokada — ustalone

Koszt meczu dzielony jest przez liczbę płatnych udziałów. Kwoty przechowujemy w całych groszach. Przy niepodzielnej kwocie rozdzielamy resztę po 1 groszu w stałej kolejności, tak aby suma dokładnie równała się kosztowi. Kolejność rozdziału to szczegół wdrożeniowy.

Należności powstają na początku meczu. Administrator ręcznie oznacza je jako zapłacone; nie ma bramki płatniczej ani automatycznego potwierdzania przelewów.

**Dwa mecze z nieopłaconym saldem blokują nowe zapisy i dodawanie gości.**

- Liczymy różne mecze, nie liczbę pozycji ani gości.
- Udział własny i trzech gości w jednym meczu to jedna zaległość za ten mecz.
- Konto z jedną zaległością może dołączyć do kolejnego meczu.
- Po wpłacie lub anulowaniu należności, gdy pozostaje mniej niż dwa nieopłacone mecze, blokada znika.
- Nie usuwamy automatycznie wcześniejszych zapisów.
- Nie blokujemy rezygnacji, przeglądania aplikacji ani podglądu rozliczeń.

Propozycja wdrożeniowa: potwierdzanie całych pozycji (udział własny/gość) bez częściowych wpłat w pierwszej wersji. Użytkownik widzi wyłącznie własne rozliczenia, administrator wszystkie. Korekta błędnie oznaczonej wpłaty jest możliwa z zapisem historii.

## 9. Faktyczna obecność i oceny

### Zatwierdzone dodatki — bez implementacji w etapie wydarzeń

- Odznaki za liczbę rozegranych meczów oraz serie co 10 spotkań. Szczegółowe progi liczby meczów i definicja ciągłości serii pozostają do dopracowania.
- Odznaka za komplet obecności w miesiącu oraz odznaki okresowe: kwartał, półrocze i rok. Szczegółowe progi i zasady kwalifikacji wymagają dopracowania.
- Odznaki zawierają datę zdobycia i opis. Nie ustalono jeszcze nazw ani wyglądu odznak.
- Podsumowania frekwencji, bez rankingu duetów.
- Status „Już jadę” i możliwość zgłoszenia spóźnienia. Nie zastępują faktycznej obecności oznaczanej przez administratora i nie zmieniają odpowiedzialności finansowej.

### MVP — zatwierdzony kierunek, szczegóły otwarte

Próg dotyczy liczby głosujących, a nie liczby głosów oddanych na zwycięzcę.
Przy 10 uczestnikach wymagane jest minimum 6 głosujących. Wariant zastępczy
jest oparty na średniej ocen meczowych. Nie ustalono jeszcze ogólnego progu
dla innych liczebności ani warunków uruchomienia wariantu zastępczego.
Remisy i uwzględnianie gości (jako głosujących i kandydatów) wymagają doprecyzowania.
MVP, odznaki, statusy dojazdu i podsumowania nie są obecnie zaimplementowane.

### Ustalone

- Zapisani uczestnicy są domyślnie obecni; administrator odznacza nieobecnych.
- Ocena dotyczy tylko innego zawodnika, który faktycznie grał w tym samym meczu.
- Nie można ocenić siebie, rezerwowego ani nieobecnego.
- Okno ocen trwa od końca meczu do 24 godzin po jego zakończeniu.
- Jest jedna ocena ogólna: całkowita liczba od 1 do 10.
- Oceny są anonimowe dla zawodników; administrator może sprawdzić autora w celu moderacji.
- Skrajnie niskie lub podejrzane oceny muszą być monitorowane. Jedynka nie jest automatycznie nieważna.

### Propozycje wdrożeniowe

- Ekran przedstawia prostą listę zawodników. Można ocenić część osób i pominąć pozostałe.
- Jedna ocena dla pary autor–oceniany w danym meczu; edycja możliwa do zamknięcia okna.
- Próg 5 ocen liczony z ważnych ocen; wymóg różnych autorów pozostaje do uzgodnienia.
- Administrator ma kolejkę ocen do kontroli: jedynki, serie bardzo niskich ocen oraz znaczące rozbieżności względem innych ocen z meczu. Konkretne progi nie są jeszcze ustalone.
- Unieważnienie wymaga powodu i przelicza poziom zawodnika. Podejrzana ocena pozostaje ważna do decyzji administratora, chyba że uzgodnimy kwarantannę.
- Jeśli administrator później oznaczy kogoś jako nieobecnego, oceny wystawione przez tę osobę i jej wystawione za ten mecz tracą ważność. Jej należność pozostaje niezależna.

## 10. Automatyczne składy

### Dodatkowe ustalenia — do późniejszej implementacji

- Mieszamy składy między meczami przy zachowaniu wyrównanego poziomu drużyn. Konkretny algorytm i waga różnorodności wymagają dopracowania; nie zatwierdzamy dotychczasowych propozycji algorytmicznych przez ten zapis.
- Wskazujemy drużynę zakładającą narzutki. Sposób wskazania pozostaje do doprecyzowania.

Ustalone: po zebraniu ocen aplikacja proponuje wyrównane drużyny; widok na grafice boiska z nazwami wybranymi w „Wyświetlaj mnie jako”, z loginem/pseudonimem przy braku imienia i nazwiska. Goście są podpisani podanym imieniem lub pseudonimem. Znacznik dobrego bramkarza jest wzmocnieniem drużyny, bez przydzielania stałej pozycji. Administrator może zmienić podział.

Propozycja wdrożeniowa:

1. Użyj listy aktualnie grających, w tym gości; pomiń rezygnujących i rezerwę.
2. Przyjmij poziom 7 dla nowych zawodników i gości bez określonego poziomu.
3. Podziel na dwie drużyny o możliwie równych liczebnościach.
4. Minimalizuj różnicę poziomu, uwzględniając równomierny podział osób dobrze broniących.
5. Pozwól administratorowi zamienić zawodników i zatwierdzić składy.

Nie używamy płatnej usługi AI do tego algorytmu. Zmiana listy uczestników oznacza istniejący podział jako wymagający aktualizacji; nie nadpisuje po cichu zatwierdzonego składu. Dokładna waga umiejętności bramkarskich i postępowanie przy nieparzystej liczbie osób wymagają strojenia na prawdziwych meczach.

## 11. Powiadomienia

Ustalone: nowe wydarzenie, wolne miejsce dla rezerwowych i nieopłacone składki.

Proponowane dodatkowe komunikaty: przypomnienie przed 17:00, brak minimum dla administratora, odwołanie lub istotna zmiana wydarzenia, zwolnienie z opłaty po zastępstwie i otwarcie okna ocen. Częstotliwość przypomnień o długu wymaga uzgodnienia.

Powiadomienia push uzupełnia skrzynka informacji wewnątrz aplikacji. Odmowa zgody na push nie uniemożliwia korzystania. Brak dostarczenia powiadomienia nie zmienia zasad zapisów ani opłat. Komunikaty nie ujawniają innych osób ani cudzych długów. Serwer ogranicza duplikaty i ponawia nieudane wysyłki.

## 12. Ekrany pierwszej wersji

1. Logowanie („Login lub numer telefonu”) i obowiązkowa zmiana hasła tymczasowego; reset do hasła tymczasowego wykonuje administrator.
2. Start: najbliższy mecz, status zapisu, własne nieopłacone saldo.
3. Lista wydarzeń i historia.
4. Szczegóły meczu: termin, koszt szacunkowy/końcowy, limit, uczestnicy, rezerwa, zapis/rezygnacja, goście i składy.
5. Zawodnicy i karta zawodnika.
6. Moje rozliczenia: podział na mecze i pozycje własne/gości.
7. Ocenianie po meczu.
8. Powiadomienia.
9. Profil i ustawienia konta: zmiana hasła, loginu i numeru, opcjonalne imię i nazwisko oraz „Wyświetlaj mnie jako”.
10. Panel administratora: tworzenie kont i reset haseł tymczasowych, wydarzenia, obecność, wpłaty, anulowania, moderacja ocen i składy.

Interfejs mobilny, krótka ścieżka zapisu i wystawiania ocen. Nazwa Sunday League Mates i poniższy kierunek wizualny są zatwierdzone; docelowa ikona aplikacji wymaga ustalenia.

### Kolorystyka — ustalone

Domyślny ciemny motyw inspirowany przesłanym przykładem LocalSend: ciemne tło z subtelnym zielonym odcieniem oraz stonowany akcent miętowo-turkusowy.

| Rola | Początkowy kolor |
|---|---|
| Tło | `#0D1613` |
| Karty i panele | `#15221D` |
| Akcent | `#80D4C5` |
| Tekst główny | `#DFE7E3` |

To paleta początkowa; odcienie można dopracować dla czytelności. Dodatkowe informacje mają mniej wyrazisty kolor, zachowując czytelność. Błędy i zaległości muszą mieć osobne, czytelne oznaczenia; statusów nie rozróżniamy wyłącznie kolorem, lecz także opisem lub symbolem. Kolory definiujemy centralnie jako zmienne motywu. Warianty karty i portret testowy opisano w rozdziale 4.

## 13. Kierunek techniczny i dane

Zatwierdzony stos aplikacji: React + Ionic + TypeScript + Capacitor. Zatwierdzony kierunek usług: Supabase Free dla Auth, PostgreSQL, Storage i logiki serwera oraz Firebase Spark wyłącznie do FCM. Wszystkie usługi muszą mieścić się w bezpłatnych planach; nie włączamy planów płatnych ani rozliczania za użycie. Limity i dostępność potrzebnych funkcji wymagają sprawdzenia przed implementacją; brak funkcji w bezpłatnym planie wymaga ponownego ustalenia rozwiązania, a nie uruchomienia płatnej usługi. Dokładna konfiguracja push i przyszłego iOS pozostaje do weryfikacji. VS Code do kodu, Android Studio do Androida; lokalna kompilacja iOS wymaga macOS i Xcode.

Techniczny sposób obsługi loginu lub telefonu z jednym hasłem w Supabase wymaga sprawdzenia aktualnej dokumentacji Auth, tworzenia kont przez administratora, zmiany identyfikatorów oraz wymuszenia zmiany hasła tymczasowego. Numer nie jest weryfikowany SMS-em. Nie tworzymy własnego systemu przechowywania haseł; hasła obsługuje mechanizm uwierzytelniania dostawcy. Nie zapisujemy haseł w profilach, tabelach aplikacji ani logach. Na tym etapie nie implementujemy uwierzytelniania.

Logiczne obiekty danych:

| Obiekt | Cel |
|---|---|
| Grupa i członkostwo | Jedna grupa w interfejsie, identyfikacja członków i ról |
| Konto zawodnika | Utworzone przez administratora, unikalny login i numer telefonu, obowiązek zmiany hasła tymczasowego; bez przechowywania haseł w modelu aplikacji |
| Profil zawodnika | Login/pseudonim, opcjonalne imię i nazwisko, wybór nazwy wyświetlanej, zdjęcie, znacznik bramkarza, wyliczony poziom |
| Wydarzenie | Daty, miejsce, koszt, limity i status |
| Uczestnik wydarzenia | Konto lub gość, opcjonalny numer gościa, zapraszający, odpowiedzialne konto, status obecności |
| Zobowiązanie i zastępstwo | Odpowiedzialność po 17:00, kolejność FIFO, przejęcia |
| Należność i historia operacji | Końcowa kwota, wpłata, anulowanie, administrator i powód |
| Ocena i moderacja | Autor, odbiorca, mecz, wartość, ważność i historia |
| Skład | Drużyna, uczestnik, status zatwierdzenia |
| Urządzenie i powiadomienie | Token push, odbiorca i status wysyłki |

To model logiczny, nie gotowy schemat SQL. W pierwszej wersji nie budujemy interfejsu wielu grup.

Wymagania techniczne:

- Serwer sprawdza uprawnienia, blokadę, limit miejsc, FIFO i termin ocen; interfejs nie jest źródłem tych decyzji.
- Przy równoczesnych zapisach rezerwacja miejsca i przejęcie opłaty odbywają się w jednej transakcji.
- Naliczanie i wysyłki są odporne na powtórne uruchomienie: nie tworzą podwójnych należności.
- Godzina 17:00 jest interpretowana w strefie Europe/Warsaw, z obsługą zmiany czasu. Znaczniki czasu przechowujemy jednoznacznie.
- Zadania serwera działają również przy zamkniętych aplikacjach i potrafią nadrobić pominięte rozliczenie.
- Zapis/rezygnacja offline nie jest potwierdzony, dopóki serwer go nie przyjmie.
- Dostęp do danych i zdjęć ograniczamy do uprawnionych członków; finanse do właściciela i administratora. Autorzy ocen nie są zwracani zwykłym użytkownikom.
- Sekretne klucze serwera nie trafiają do aplikacji. Tabele dostępne przez API muszą mieć właściwe reguły RLS.
- Administracyjne korekty finansowe i moderacja pozostawiają historię.
- Serwer kontroluje uprawnienia tworzenia kont i resetowania haseł, unikalność loginu i numeru oraz wymaganie obecnego hasła przy ich zmianie. Wymóg zmiany hasła tymczasowego nie może polegać wyłącznie na ukryciu ekranów w interfejsie.
- Numery telefonów są dostępne wyłącznie zalogowanym członkom grupy; nie udostępniamy ich publicznie. Widoczność numerów nie zmienia ograniczeń dotyczących finansów i autorów ocen.

## 14. Kolejność realizacji i kryteria odbioru

### Etapy

1. Domknięcie punktów otwartych; prywatne repozytorium, README, AGENTS.md i środowisko lokalne.
2. Weryfikacja techniczna Auth i limitów bezpłatnych usług; konta tworzone przez administratora, logowanie loginem lub telefonem, hasła tymczasowe, role i karty zawodników.
3. Wydarzenia, limity, zapisy, goście i rezerwa.
4. Granica 17:00, FIFO, rozliczenie, wpłaty i blokada.
5. Faktyczna obecność, oceny, stabilizacja i moderacja.
6. Automatyczne składy i grafika boiska.
7. Pełne powiadomienia, testy na urządzeniach i przygotowanie Androida; następnie weryfikacja iOS. Podstawy push przygotowujemy wcześniej, przy konfiguracji projektu.

### Kluczowe scenariusze odbioru

- Osoba bez konta utworzonego przez administratora nie dołącza do grupy; brak publicznej rejestracji i zaproszeń mailowych. Zawodnik nie tworzy kont innych osób ani nie uzyskuje uprawnień administratora.
- Administrator tworzy konto z hasłem tymczasowym i ręcznie przekazuje dane; nie jest wysyłany SMS ani automatyczna wiadomość e-mail.
- Logowanie loginem oraz numerem telefonu z tym samym hasłem otwiera to samo konto; formularz pokazuje „Login lub numer telefonu” i nie wymaga kodu SMS.
- Pierwsze logowanie hasłem tymczasowym wymusza jego zmianę; próba pominięcia tego kroku nie daje dostępu do pozostałych funkcji.
- Administrator resetuje hasło do tymczasowego bez odczytu dotychczasowego; poprzednie hasło nie działa, a następne logowanie wymusza zmianę nowego hasła tymczasowego.
- Utworzenie konta i reset zwracają 12-znakowe hasło tymczasowe. Zmiana na hasło 7-znakowe jest odrzucana; 8-znakowe jest przyjmowane po sprawdzeniu obecnego hasła. Dłuższe własne hasła są dozwolone do granicy 72 bajtów UTF-8.
- Zawodnik zmienia hasło; nowe działa z oboma identyfikatorami, a poprzednie nie działa.
- Zmiana loginu lub numeru z błędnym obecnym hasłem jest odrzucona. Z poprawnym hasłem i wolnym identyfikatorem jest przyjęta; nowy identyfikator działa, a stary przestaje prowadzić do tego konta.
- Utworzenie lub zmiana konta na już zajęty login albo numer jest odrzucana, także przy równoczesnych operacjach.
- Wybór „Wyświetlaj mnie jako” spójnie zmienia podpis na karcie, liście uczestników, ekranie ocen i grafice składów. Bez imienia i nazwiska wszystkie te widoki pokazują login/pseudonim.
- Zalogowany członek grupy widzi numery; osoba niezalogowana ani spoza grupy ich nie odczytuje. „Zadzwoń” na karcie i liście uczestników otwiera dialer z właściwym numerem.
- Dla gościa z numerem dialer otrzymuje numer gościa; bez numeru otrzymuje numer zapraszającego.
- Konfiguracja usług używa Supabase Free i Firebase Spark wyłącznie do FCM, bez płatnych planów i rozliczania za użycie. Gdy potrzebna funkcja nie mieści się w bezpłatnych ograniczeniach, nie następuje automatyczne przejście na płatny plan.
- Dwie osoby próbują zająć ostatnie miejsce: tylko jeden zapis jest przyjęty.
- Rezygnacja przed 17:00 nie tworzy opłaty; po 17:00 pozostawia zobowiązanie.
- Dwie rezygnacje i jeden zastępca: zwolniona jest pierwsza osoba zgodnie z FIFO.
- Rezerwa nie awansuje automatycznie ani nie płaci.
- Udział własny i gość tworzą dwie pozycje finansowe, ale jeden nieopłacony mecz.
- Dwa nieopłacone mecze blokują nowy zapis i gościa; rozliczenie jednego odblokowuje konto.
- Nieobecność nie anuluje długu, lecz odbiera prawo do ocen za ten mecz.
- Ocena własna, osoby z innego meczu oraz ocena po terminie są odrzucane przez serwer.
- Zwykły zawodnik nie odczytuje autorów ocen ani cudzych finansów.
- Rozliczenie powtórzone po awarii nie nalicza długu drugi raz.
- Suma kwot w groszach odpowiada kosztowi wydarzenia.
- Odwołanie meczu anuluje zobowiązania i należności.
- Nowy zawodnik zachowuje poziom startowy zgodnie z wybraną metodą stabilizacji.
- Domyślny widok używa ciemnego motywu z zielonym odcieniem i stonowanym miętowo-turkusowym akcentem; kolory pochodzą z centralnych zmiennych motywu. Tekst główny i dodatkowy pozostaje czytelny na telefonie.
- Błąd, zaległość i pozostałe statusy można rozpoznać również bez rozróżniania kolorów dzięki opisom lub symbolom.
- Pełna karta profilu ma charakterystyczny kształt, duży portret, dynamiczną nazwę i ocenę z jednym miejscem po przecinku oraz przycisk „Zadzwoń” pod kartą; nie pokazuje rozliczeń.
- Nowy zawodnik pokazuje poziom 7,0 i „Nowy zawodnik”; „dobrze broni” ma ikonę rękawic i czytelny opis, bez przypisania stałej pozycji.
- Lista uczestników pokazuje kompaktowy avatar, nazwę i ocenę; oba warianty są czytelne na małym ekranie. Liczba ocen i meczów nie jest dodawana bez osobnego potwierdzenia.
- Po ręcznym dodaniu portretu testowego prototyp pokazuje cały avatar Piotra bez wycinania postaci; numer 27 pozostaje częścią zdjęcia i nie tworzy pola profilu. Brak pliku jest odnotowany, bez generowania zastępczego zdjęcia.

## 15. Punkty do domknięcia bez blokowania przygotowania projektu

1. Docelowa ikona aplikacji, maksymalna liczba graczy i godzina niedzielna. Nazwa, kierunek kolorystyki i wygląd karty są zatwierdzone; odcienie palety początkowej można dopracować dla czytelności.
2. Potwierdzenie wzoru stabilizacji, liczenia pięciu ocen oraz nazw i progów rang.
3. Kto nadaje znacznik „dobrze broni”; poziom gościa na potrzeby składów.
4. Częstotliwość przypomnień o długu i dokładne progi moderacji.
5. Korekty kosztów po rozpoczęciu meczu, częściowe wpłaty oraz przypisanie płatnika gościa dodanego przez administratora.
6. Mecze zaczynające się przed lub o 17:00: obecna granica dotyczy zwykłych rozgrywek wieczornych; taki wyjątek wymaga osobnej reguły.
7. Usunięcie konta i okres przechowywania historii rozliczeń i ocen.
8. Techniczna obsługa dwóch identyfikatorów jednego konta w Supabase bez SMS i automatycznej poczty, wymuszenie zmiany hasła tymczasowego oraz format/normalizacja loginów i numerów gwarantujące unikalność. Wymagania biznesowe są zatwierdzone; rozwiązanie techniczne wymaga dokumentacji i weryfikacji.
9. Weryfikacja limitów Supabase Free i Firebase Spark dla wymaganych funkcji oraz sposobu realizacji zadań serwera i przyszłego iOS w bezpłatnych ograniczeniach.
10. Potwierdzenie dodatkowych informacji na karcie: liczby ocen i rozegranych meczów. Ręczne dodanie dostarczonego avatara pod `app/public/images/player-demo.png` przed użyciem w prototypie.

## 16. Poza zakresem pierwszej wersji

Płatności online, publiczna rejestracja i dołączanie, zaproszenia mailowe, SMS-y, automatyczna poczta, płatne plany usług i rozliczanie za użycie, obsługa wielu grup w interfejsie, czat, ligi i tabele wyników, rozbudowane statystyki meczowe, oceny wielu umiejętności i płatne AI. Projekty usług i publikacja w sklepach nie są tworzone w ramach samego aktualizowania tej specyfikacji.

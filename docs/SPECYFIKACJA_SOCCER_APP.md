# Soccer App — specyfikacja pierwszej wersji

Wersja: 1.0 • Data: 13.10.2026 • Język aplikacji: polski

Dokument przeznaczony do dalszej pracy w VS Code, Android Studio i Codexie. Nie oznacza rozpoczęcia implementacji ani utworzenia repozytorium. Nazwa produktu i wygląd pozostają do wyboru.

## 1. Cel i zakres

Aplikacja dla jednej zamkniętej grupy grającej w piłkę na orliku, zwykle w czwartki i niedziele. Ma zastąpić zapisy w ankietach, ręczne pilnowanie składek i przypadkowy podział drużyn.

Pierwszą platformą jest Android. Projekt ma umożliwiać przygotowanie wersji iOS ze wspólnego kodu. Nie ma integracji z płatnościami: aplikacja prowadzi ewidencję należności, a administrator ręcznie potwierdza otrzymane wpłaty.

Zakres: konta na zaproszenie, karty zawodników, mecze, zapisy, goście, rezerwa, rozliczenia, anonimowe oceny, wyrównywanie składów, grafika boiska i powiadomienia.

## 2. Status ustaleń

Zasady oznaczone jako „ustalone” wynikają z rozmowy z użytkownikiem. „Propozycja wdrożeniowa” oznacza wybór pomocniczy, który nie został jeszcze osobno zatwierdzony. Punkty otwarte opisano w rozdziale 15; nie należy samodzielnie traktować ich jako zaakceptowanych wymagań.

## 3. Role i konta — ustalone

### Zawodnik

- Ma własne konto i kartę zawodnika; do grupy trafia przez zaproszenie.
- Przegląda wydarzenia, listy uczestników, karty innych członków i składy.
- Zapisuje się, rezygnuje i zapisuje na rezerwę.
- Dodaje gości, zarządza ich zapisami i finansowo za nich odpowiada.
- Widzi swoje należności, pozycje za gości oraz status wpłat.
- Ocenia uprawnionych uczestników meczu w wyznaczonym czasie.

### Administrator

- Jako jedyny tworzy i edytuje mecze oraz podejmuje decyzję o ich odwołaniu.
- Zarządza zaproszeniami i grupą.
- Potwierdza wpłaty, anuluje należności i rozstrzyga wyjątkowe przypadki.
- Może dobrać gościa spoza grupy oraz zaznaczyć zastępstwo.
- Odznacza osoby nieobecne; pozostali zapisani domyślnie są obecni.
- Kontroluje podejrzane oceny i poprawia automatyczne składy.

Propozycje wdrożeniowe: logowanie e-mail i hasłem, reset hasła, utrzymanie sesji po ponownym uruchomieniu; zaproszenia jednorazowe z terminem ważności. Role administracyjne są przyznawane wyłącznie przez uprawnioną operację serwera. Użytkownik nie może nadać sobie roli administratora.

## 4. Karta zawodnika i ocena poziomu

### Ustalone

- Imię/nazwisko lub pseudonim, opcjonalne zdjęcie i avatar zastępczy.
- Jedna ocena ogólna w skali 1–10; bez formularza wielu umiejętności.
- Początkowy poziom nowego zawodnika: 7.
- Ranga lub podobne oznaczenie pojawia się po zebraniu 5 ocen.
- Pierwsza słaba ocena nie może gwałtownie obniżyć poziomu.
- Znacznik „dobrze broni” jest dodatkowym atutem przy dobieraniu drużyn. Nie oznacza stałego bramkarza: zawodnicy zmieniają się na bramce.
- Nie ma sztywnych pozycji, stron boiska ani rozbudowanego podziału na pomoc/atak/obronę w formularzu ocen.

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

Ustalone: po zebraniu ocen aplikacja proponuje wyrównane drużyny; widok na grafice boiska z nazwiskami/pseudonimami. Znacznik dobrego bramkarza jest wzmocnieniem drużyny, bez przydzielania stałej pozycji. Administrator może zmienić podział.

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

1. Logowanie, przyjęcie zaproszenia, reset hasła.
2. Start: najbliższy mecz, status zapisu, własne nieopłacone saldo.
3. Lista wydarzeń i historia.
4. Szczegóły meczu: termin, koszt szacunkowy/końcowy, limit, uczestnicy, rezerwa, zapis/rezygnacja, goście i składy.
5. Zawodnicy i karta zawodnika.
6. Moje rozliczenia: podział na mecze i pozycje własne/gości.
7. Ocenianie po meczu.
8. Powiadomienia.
9. Profil i ustawienia konta.
10. Panel administratora: wydarzenia, obecność, wpłaty, anulowania, zaproszenia, moderacja ocen i składy.

Interfejs mobilny, krótka ścieżka zapisu i wystawiania ocen. Wizualny styl, nazwa i ikona nie są jeszcze zatwierdzone.

## 13. Kierunek techniczny i dane

Proponowany stos: React + Ionic + TypeScript + Capacitor; Supabase dla Auth, PostgreSQL, Storage i logiki serwera; powiadomienia Android przez FCM, iOS przez APNs. VS Code do kodu, Android Studio do Androida; lokalna kompilacja iOS wymaga macOS i Xcode. Docelowe wersje zależności i dokładna konfiguracja push zostaną zweryfikowane przy implementacji.

Logiczne obiekty danych:

| Obiekt | Cel |
|---|---|
| Grupa i członkostwo | Jedna grupa w interfejsie, identyfikacja członków i ról |
| Profil zawodnika | Nazwa, zdjęcie, znacznik bramkarza, wyliczony poziom |
| Zaproszenie | Dostęp do zamkniętej grupy |
| Wydarzenie | Daty, miejsce, koszt, limity i status |
| Uczestnik wydarzenia | Konto lub gość, zapraszający, odpowiedzialne konto, status obecności |
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

## 14. Kolejność realizacji i kryteria odbioru

### Etapy

1. Domknięcie punktów otwartych; prywatne repozytorium, README, AGENTS.md i środowisko lokalne.
2. Konta na zaproszenie, role i karty zawodników.
3. Wydarzenia, limity, zapisy, goście i rezerwa.
4. Granica 17:00, FIFO, rozliczenie, wpłaty i blokada.
5. Faktyczna obecność, oceny, stabilizacja i moderacja.
6. Automatyczne składy i grafika boiska.
7. Pełne powiadomienia, testy na urządzeniach i przygotowanie Androida; następnie weryfikacja iOS. Podstawy push przygotowujemy wcześniej, przy konfiguracji projektu.

### Kluczowe scenariusze odbioru

- Osoba bez ważnego zaproszenia nie dołącza do grupy; zawodnik nie uzyskuje uprawnień administratora.
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

## 15. Punkty do domknięcia bez blokowania przygotowania projektu

1. Nazwa aplikacji, styl i maksymalna liczba graczy; godzina niedzielna.
2. Potwierdzenie wzoru stabilizacji, liczenia pięciu ocen oraz nazw i progów rang.
3. Kto nadaje znacznik „dobrze broni”; poziom gościa na potrzeby składów.
4. Częstotliwość przypomnień o długu i dokładne progi moderacji.
5. Korekty kosztów po rozpoczęciu meczu, częściowe wpłaty oraz przypisanie płatnika gościa dodanego przez administratora.
6. Mecze zaczynające się przed lub o 17:00: obecna granica dotyczy zwykłych rozgrywek wieczornych; taki wyjątek wymaga osobnej reguły.
7. Usunięcie konta i okres przechowywania historii rozliczeń i ocen.

## 16. Poza zakresem pierwszej wersji

Płatności online, publiczne dołączanie, obsługa wielu grup w interfejsie, czat, ligi i tabele wyników, rozbudowane statystyki meczowe, oceny wielu umiejętności i płatne AI. Repozytorium, projekty usług i publikacja w sklepach nie są tworzone w ramach samego spisania tej specyfikacji.

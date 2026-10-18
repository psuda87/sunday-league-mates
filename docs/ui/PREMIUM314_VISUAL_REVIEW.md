# Premium España 3.14 — tworzenie i edycja tylko w demo

Użytkownik doprecyzował w trakcie pracy: **pozostają trzy zakładki Mecze /
Zawodnicy / Profil; Składy wyłącznie wewnątrz meczu**. Nie dodano globalnego
modułu ani skrótu Składy. Zwykły użytkownik używa dokładnie istniejącego
BottomNav, administrator — demo-only wariantu z tymi samymi ikonami/akcjami.

## Trzy cykle rzeczywistego Chromium po doprecyzowaniu nawigacji

1. Render 390×844 oraz kontrola 320/768. Plus 56×56, wystaje 20px. Maska
   radialna wycina rzeczywisty otwór w powierzchni paska, SVG rysuje krawędź
   wyprofilowania. Przejście do trzech zakładek wymagało oddzielenia centralnej
   ikony Zawodnicy od przycisku; pierwsze 34px górnego paddingu dawały zbyt
   mało optycznego odstępu między ikoną a złotą krzywizną.
2. Padding administratora zwiększony do 40px. Ponowny render Dark/Light i
   320/390/768: co najmniej 8px między plusem a ikoną Zawodnicy, wszystkie
   przyciski mają wygodne cele dotykowe, plus pozostaje wyśrodkowany. Cztery
   niezmienione karty nadal widoczne przy 390×844; footer rezerwuje swoje miejsce,
   nie jest nakładką zasłaniającą zawartość. Zwykły zawodnik zachowuje stary pasek.
3. Skrócono wyłącznie nowy opis formularza do „Demo · pamięć sesji ·
   Europe/Warsaw”; mniejszy, zwarty odstęp odzyskuje miejsce na pola. Ponowny
   render i cały scenariusz tworzenia/edycji. Podgląd przewija do góry i otrzymuje
   fokus nagłówka bez dekoracyjnej obwódki. Przy 320px dłuższy tytuł Podgląd
   meczu świadomie zawija się do dwóch wierszy, nie nachodzi na herb ani strzałkę.
   Formularz jest przewijany — nie wciskamy wszystkich pól kosztem ich czytelności.

Intermediates: /tmp/p314-three-cycle1, -cycle2, -cycle3 (lokalne artefakty pracy).
Finalne poniższe pliki to rzeczywiste zrzuty React/Ionic, nie wygenerowane makiety.
Nie podmieniono fotografii, herbu, portretów, filtrów ani zaakceptowanych kart.
Admin ma wyższy footer niż zwykły gracz, aby plus i środkowa zakładka nie kolidowały.

## Zrzuty

- [Administrator Dark](premium314-bottom-nav-admin-dark.png)
- [Administrator Light](premium314-bottom-nav-admin-light.png)
- [Zwykły zawodnik](premium314-bottom-nav-user.png)
- [Nowy mecz](premium314-create-match.png)
- [Podgląd](premium314-create-preview.png)
- [Edycja](premium314-edit-match.png)
- [320px](premium314-bottom-nav-320.png)

## Zasady i ograniczenia

Narzędzia demo → Rola wydarzeń → Administrator demo. Uprawnienie
canManageDemoEvents jest współdzielone przez pasek, formularz i reducer; zmiana
użytkownika/reset przywraca zawodnika. Rola wydarzeń nie daje automatycznie
wglądu w cudze finanse — wcześniejsza osobna symulacja finansowa pozostaje.
Żaden przełącznik nie jest rzeczywistym zabezpieczeniem serwerowym.

Formularz i podgląd wspólne dla tworzenia i edycji nadchodzących meczów. Brak
edycji historii/anulowanych, usuwania i nowej funkcji anulowania. Domyślnie jutro
18:00 Europe/Warsaw, 90min, minimum10, limit15, 270zł, Harcerska1 Chorzów.
Dowolny dzień tygodnia. Kwoty parsowane istniejącym parseDemoMoney do groszy.
Walidacja dodatnich liczb całkowitych, limit≥minimum i aktywni (wraz z gośćmi),
przyszłego terminu, miejsca oraz kwoty≥0. Jawne granice formularza demo:
czas1–1440min, limit≤100, koszt≤1mln zł, nazwa80/miejsce120/adres180 znaków.
Nie są to nowe produkcyjne zasady biznesowe. Nieistniejące/niejednoznaczne
lokalne godziny zmiany czasu są odrzucane z komunikatem zamiast cichej korekty.

Podgląd nic nie zapisuje. Utworzenie ma klucz deduplikacji i monotoniczny id
sesji, pustą listę uczestników. Edycja zachowuje wpisy, gości, rezerwę, wpłaty i
podział; aktualizuje metadane/koszt. Minimum jest opcjonalnym parametrem
prezentacji wspólnych komponentów, nadal domyślnie10 dla produkcji. Nowy mecz
obsługuje istniejące operacje demo; reset usuwa dodane mecze. Bez API/persistencji.

Kontrole i końcowy SHA opisane w docs/ODPOWIEDZI_CODEX.txt i historii Git.
Android/iOS, klawiatura natywna oraz rzeczywiste safe areas wymagają urządzenia.
Cypress niewykonany (brak Xvfb), zastąpiony w tym zakresie bezpośrednią kontrolą
Chromium — nie jest to deklaracja zaliczenia Cypress. Bez ręcznego deploy.

Porównanie zaakceptowanych ekranów zwykłego użytkownika z poprzednim finalnym
renderem3.13:9/10 identycznych SHA256 (Mecze, szczegóły, Uczestnicy, Składy,
Rozliczenie Dark). Light rozliczenia:17 pikseli w bbox(16,408)–(18,526), różnica
maks1/255 na kanał na obrysie wierszy; obejrzano, bez zmiany układu i treści.
Nie retuszowano ani nie zastępowano renderów w celu wyrównania sum kontrolnych.

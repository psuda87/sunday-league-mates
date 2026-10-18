# Premium España3.11 — interaktywne boisko

## Materiały i zakres

Rzeczywiście obejrzano premium38-teams.png (stare listy), premium310-player-card-
dark/light.png i premium36-details-dark.png. Nie użyto grafiki z internetu ani
generowanej makiety. Tylko zakładka Składy w demo; brak zmian produkcyjnych
komponentów/operacji i konfiguracji app/vercel.json. Demo nadal bez Auth/API/
Supabase/Edge/sekretów i rzeczywistych danych. Nowy Teams.tsx dodany jawnie do
istniejącej allowlisty modułów, bez poluzowania kontroli zasobów/CSP/env.

## Model i interakcje

Game.lineup.a/b zawierają id wpisów Entry. Na istniejących fixture wybranych
meczów przygotowano przykładowy naprzemienny podział uczestników. To dowolny
podział demonstracyjny, bez ocen/umiejętności/produkcji. Część meczów nie ma
lineup, pokazuje stan pusty i przycisk Utwórz przykładowe składy. Mniej niż2
osoby blokuje tworzenie, anulowany mecz nie wyświetla boiska. Reset używa
aktualnie zapisanych uczestników, a reset całego demo odtwarza oryginalne fixture.

teamEntries filtruje id według registered, usuwa duplikaty/stare wpisy. Wycofanie
lub usunięcie gościa od razu usuwa znacznik, bez promocji rezerwy. Nowy zapis/
gość jest jawnie Poza podziałem, bez automatycznego przydziału; reset podziału
uwzględnia wszystkie obecnie aktywne wpisy. Gość bez playerId ma neutralny numer
G/nazwę i span, nie link. W trybie zamiany można go przestawić jako uczestnika.
Numer czytany bezpośrednio z aktualnego world.players, więc edycja3.10 jest
widoczna po powrocie z karty. Brak drugiego katalogu osób/pobierania danych.

Zwykły przycisk znacznik otwiera dotychczasowy globalny profil. Pełna nazwa
w aria-label i sr-only, skrócone nazwisko na boisku z elipsą. Tryb Zamień
zawodników wyłącza otwieranie profilu i ustawia aria-pressed na wyborze.
Drugi wybór z przeciwnej drużyny dispatchuje lineup_swap, reducer sprawdza
obie strony/aktualne id i status meczu. Zamiana nie zmienia wpisów, uczestnictwa,
rezerwy, numeru/profilu ani finansów. Kliknięcie ponownie odznacza; inna osoba
z tej samej strony zastępuje wybór. Reset/kontrolka kończąca czyści zaznaczenie.
Globalny stos nawigacji niezmieniony, powrót przywraca mecz/Składy/scroll.

## Boisko i rozmieszczenie

CSS: ciemnozielone pasy, lokalne miękkie światła, złota obręcz i cień. SVG:
linie boczne/końcowe/środkowa, pola karne/bramkowe, łuki i bramki. Koło środkowe
wykonano w CSS z aspect-ratio1, aby pozostało kołem niezależnie od viewportu.
A u góry bordo/złoto, B na dole jasny ivory/granat ze złotem. Nazwy drużyn
z licznikami i barwną legendą, nie sam kolor. Otoczenie reaguje na Dark/Light/Auto.

Układy prezentacyjne dla1–8 osób/stronę: np.5 =1/2/2,6 =1/2/3,7 =1/3/3,
8 =1/2/2/3; B odwraca kolejność rzędów. To rozmieszczenie, nie stałe pozycje
i nie algorytm doboru. Rzędy flex, max3 kolumny, znacznik44px/obszar66px+.
Wysokości obu połów według większej liczby rzędów, dla8–7 tyle samo miejsca
po obu stronach. Nazwy elipsowane, pełna nazwa dostępna klawiaturze/czytnikowi.

## Trzy cykle rzeczywistych renderów

1. Nowe boisko i interakcje, render320/390/768. Ogląd Dark: dobra hierarchia
   numerów i nazw, ale środek SVG był owalny, a przy różnej liczbie rzędów
   wysokości połów mogły się różnić. Pierwszy Vitest wykrył stary tekst/selektor
   list w Demo.test.tsx; zastąpiono kontrolą nowego boiska i15 znaczników.
2. Wydzielono koło CSS1:1 i obliczono wysokości z zapasem na pełne44px kółka/
   nazwiska. Obejrzano Light/320, zaznaczenie i pusty stan. Kontrola Chromium
   przeszła profile/powroty, zamiany/reset,6–6/7–6/8–7, numery i usuwanie gości.
3. Zaznaczenie wzmocnione symbolem✓ (nie sam kolor), pusty stan również po
   spadku liczby uczestników poniżej2. Ponowny render i rozszerzone pomiary:
   brak nakładania prostokątów znaczników, hit>=44px, równe połowy, brak overflow.

4. Dodatkowy ogląd768 wykrył zbyt szeroką proporcję przy rozciąganiu do688px.
   Dodano max-width420px i centrowanie, ponownie wyrenderowano wszystkie szerokości
   i sprawdzono wysokość> szerokość boiska. Na telefonach wymiary nie zmieniły się.

## Zrzuty rzeczywistego React/Ionic Chromium

- [Dark](premium311-teams-dark.png)
- [Light](premium311-teams-light.png)
- [320px](premium311-teams-320.png)
- [768px](premium311-teams-768.png)
- [Tryb zamiany](premium311-teams-swap.png)
- [Brak składów](premium311-teams-empty.png)

## Ograniczenia

Wyłącznie demonstracja w pamięci. Podział/numery giną po resecie/reloadzie.
Nie ma produkcyjnego algorytmu, wyboru pozycji, zapisu Supabase, uprawnień
admina ani algorytmu promocji rezerwy. Przy większej obsadzie boisko wymaga
pionowego scrolla; dolna nawigacja nie przykrywa przewijalnej treści.
Android/iOS i rzeczywisty backend nieweryfikowane; bez deklaracji produkcji.

## Weryfikacja końcowa

ESLint/TypeScript/build aplikacji/build demo OK. Vitest112/112 w19 plikach.
Nowe testy modelu i UI: zamiany tylko przeciwnych stron/stale żądanie, reset,
własny gość/wycofanie/rezerwa/nieprzypisani, puste/anulowane mecze, nawigacja
vs tryb zamiany, żywy numer0. Chromium320x844/390x844/768: obie drużyny i liczby,
profile/Enter/powrót do Składów, zamiana/reset/utworzenie i brak tworzenia poniżej2,
6–6/7–6/8–7, numer7→0→99 i marker po edycji, usunięcie gości12→10 bez promocji,
powroty/scroll/wyszukiwanie, Dark/Light/Auto, szerokości/hit>=44/brak kolizji
znaczników/równe połowy/pionowe boisko/brak poziomego overflow.
Demo15plików,6 dotychczasowych assetów; kontrola allowlisty, CSP, bajtów zasobów,
braku Auth/Supabase/Edge/API i obcych żądań OK. To testy demo i atrapy API aplikacji,
nie rzeczywisty Supabase. Home Dark/Light, Details Dark, Participants Dark oraz
karta3.10 Dark/Light porównane SHA256 — bajtowo identyczne z poprzednim etapem.
Cypress niewykonany (brak Xvfb), Android/iOS nieweryfikowane. Duże chunki Ionic
nadal. Backend/finanse/Firebase/konfiguracja Vercel nietknięte, bez migracji/
merge/ręcznego deploy. Automatyczny podgląd Vercel niezweryfikowany.

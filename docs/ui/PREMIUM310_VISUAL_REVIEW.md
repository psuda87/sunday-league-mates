# Premium España3.10 — dopracowanie istniejącej karty

## Materiały i granica zmian

Obejrzano premium39-player-card-dark/light.png i oryginalną koncepcję
[Ultimate](reference/slm-ultimate-player-card-concept.jpg). Nie zmieniono krzywej
tarczy, złotej ramki, nazwiska, oficjalnego herbu ani fikcyjnych portretów WebP.
Bez nowych obrazów, zależności i danych rzeczywistych. Nie odtwarzamy ekranów ocen,
statystyk szczegółowych, mediów i historii z koncepcji. Mecze/Szczegóły bez przebudowy.

## Trzy cykle rzeczywistego React/Ionic Chromium

1. Karta pomniejszona, numer/gwiazdki i4 pola. Ogląd390/320: mocniej widoczne trybuny
   i reflektory dzięki odsłonięciu boków maską, ale zieleń murawy pod nazwiskiem
   zbyt silna. Skorygowano kontrolę historii w skrypcie po celowym usunięciu
   dawnego rozwijanego panelu profilu; płatność testowana przez listę historii meczów.
2. Gradient przyciemnia murawę od48% do92%, pozostawiając trybuny i światła.
   Ogląd Dark/320 i formularza Light: wszystkie4 pola mieszczą się nad nawigacją,
   edycja jest44px i ma czytelny błąd. Pełny Chromium przeszedł walidację numeru
   i ponowne otwarcie z Uczestników/Składów oraz usuwanie gości.
3. Łagodniejszy pionowy fade koszulki (start od68% zamiast77%), numer850 weight.
   Ponowny rzeczywisty render, kontrola całej ramy, nazwiska,5 złotych gwiazdek,
   statystyk w pojedynczym rzędzie oraz320/390/768 i Dark/Light/Auto.

## Rozmiar i dane

Proporcje niezmienne340:502. Przy390 i768 szerokość340→300 (-11,76%),
wysokość502→442,94 (-11,76%). Przy320: szerokość300→264 (-12%),
wysokość442,94→389,79 (-12%). Font nazwiska pozostał24–36px, numer2.1rem.
Numer u góry po lewej, herb po prawej, pięć gwiazdek w stopie pod nazwiskiem.
Gwiazdki aria-hidden/pointer-events:none, bez wartości liczbowej i ocen.

DemoPlayer ma jerseyNumber i jawnie przypisane demoTotals: goals/assists/mvp.
Te3 wartości są stałymi fikcyjnymi sumami do oceny layoutu, nie obliczeniami
z obecności, zapisów lub finansów. Mecze nadal z historycznych, potwierdzonych
fikcyjnych obecności. Nie dodano produkcyjnych statystyk ani algorytmu.

Ołówek na numerze tylko własnej karty, hit44px. Formularz przyjmuje całkowite0–99,
ma label/błąd aria-invalid/describedby i Anuluj. Reducer ponownie kontroluje
właściciela, Number.isInteger i zakres, odrzuca cudzą edycję/NaN/ułamki.
0 jest prawidłowy; duplikaty dozwolone. Wspólny world aktualizuje wszystkie
instancje karty, zachowuje numer przy nawigacji/zmianie symulowanej osoby.
Reset/scenariusz/reload przywracają fixture, bez zapisu na urządzeniu lub serwerze.
Historia profilu usunięta zgodnie z3.10; globalny mechanizm powrotów niezmieniony.

## Różnice i ograniczenia

Portrety nadal frontalne, nie takie same jak trzy czwarte z koncepcji. Maski
odsłaniają stadion, nie zastępują zdjęcia ani nie retuszują jego pikseli.
Przy otwartym formularzu można przewinąć do statystyk; normalna karta z4 polami
mieści się nad dolną nawigacją. Bez testu prawdziwej klawiatury Android/iOS,
backendu i rzeczywistego Supabase. Brak deklaracji zgodności pikselowej/produkcji.

## Zrzuty

- [Dark390](premium310-player-card-dark.png)
- [Light390](premium310-player-card-light.png)
- [320](premium310-player-card-320.png)
- [768](premium310-player-card-768.png)
- [Edycja numeru i walidacja](premium310-player-number-edit.png)

## Wyniki końcowe

TypeScript/ESLint/build aplikacji/build demo OK, Vitest108/108 w18 plikach.
Nowe testy: pełna walidacja UI+reducer, własność/zmiana właściciela/0/99/duplikaty/
nieprawidłowe wartości, stałość fikcyjnych sum i dekoracyjne gwiazdki.
Chromium320/390/768: karta/proporcje/portrety/fallback,4 pola w jednym rzędzie
powyżej footer w normalnym widoku, bez poziomego scrolla; numer7→0→99,
odrzucenie pustego/-1/100/2.5/abc, powrót z Uczestników i Składów, tylko właściciel
edytuje; wyszukiwanie/reset/motywy/operacje3.8 i usuwanie obu typów gościa OK.
Build demo15 statycznych plików, allowlista/CSP/env bez zmian, brak Auth/Supabase/
Edge/API i obcych żądań. To nie test prawdziwego Supabase. Cypress nie uruchomiono
(brak Xvfb), Android/iOS i klawiatura natywna niezweryfikowane. Duże chunki Ionic
nadal. Home Dark/Light, Details Dark i Participants Dark porównane SHA256 ze
zrzutami poprzedniej wersji — bajtowo identyczne. Bez backendu/finansów/Vercel/
merge/migracji/ręcznego wdrożenia. Automatyczny Vercel niezweryfikowany.

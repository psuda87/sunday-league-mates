# Beta 2.3 — analiza i iteracje wizualne

Przed implementacją obejrzano approved-three-themes.jpg, beta22-home-dark.png,
beta22-home-light.png oraz render nowego oryginalnego herbu. Pobranie gałęzi
fast-forward do 0243660 dostarczyło herb; nie tworzono zastępczego logo.

Różnice początkowe względem trzeciego telefonu:
- Tekst SLM zamiast kompaktowego herbu; header około70px, brak właściwego znaku.
- Tytuł zaczyna się około159px, bo nad nim są banner i kicker; referencja nie ma tych linii.
- Karta390px viewport: y206–496, wysokość290px, promień23px. Referencja ma
  niską, znacznie bardziej zwartą kartę (po przeskalowaniu do tej szerokości około180–210px).
- Zdjęcie142x164 jest pionowe; referencyjne zdjęcie około połowy szerokości karty,
  lecz poziome, z dużo mniejszą wysokością. Dodatkowy podpis zdjęcia nie pochodzi z referencji.
- Zbyt duże paddingi20px, odstępy20px nad licznikiem i wysoka typografia metadanych.
- CTA zaczyna się około516px, jest oddalone od góry przez wysokość karty i komunikaty.
- Dolna nawigacja ma duże tło aktywnej pozycji; referencja podkreśla raczej samą ikonę/tekst.
- Panele suwaka i wyglądu dominują dół ekranu. Referencja zawiera tylko mecz/CTA/nawigację.
- Tło poprzedniej wersji ma równy bordowy zafarb, referencja mocniej kontrastuje prawie
  czarny grafit z czerwienią w górnej części. Referencyjny telefon ma inny kadr/aspekt
  niż viewport390x844, dlatego nie da się uczciwie obiecać zgodności piksel w piksel.

Plan korekty: oryginalny SVG54x61, tytuł tuż pod headerem, niższa karta, zdjęcie~112px
wysokości, ciaśniejsze metadane/pasek, CTA bez dodatkowego tekstu DEMO, mniej paneli.
Tryby i suwak w Narzędziach demo. B poziomy z ikonami, domyślnie Uczestnicy.

## Iteracja 1 — rzeczywisty render 390x844

Obejrzano Dark i szczegóły po pierwszym buildzie; zrzuty iteration1-home-Dark/Light
zachowane obok finalnych. Herb54x61 w x18/y8; tytuł y101; karta y151.6/h212;
zdjęcie142.5x112; CTA y379.6/h54; footer y777/h67. Usunięto kicker/bannery z góry,
panele demo schowano do details. B domyślnie Uczestnicy, jedna linia ikon.
Ocena: karta już znacznie bliższa referencji, ale zdjęcie zbyt ciemne na dole,
a poświata bordo rozlana na całą dolną część ekranu. Metadane i padding można ścieśnić.

## Iteracja 2 — korekta i ponowny render/ocena

Zmniejszono padding16->14, promień16->14, zdjęcie112->104px i interlinię metadanych.
Poświatę ograniczono do górnego prawego obszaru; dolna część wróciła do niemal czerni.
Zmniejszono krycie gradientu zdjęcia, aby odzyskać fotograficzną nawierzchnię boiska.
Obejrzano finalne home Dark/Light i details Dark/Light, wszystkie390x844.

| Element | Beta22 (około) | Iteracja1 | Finalna iteracja2 |
|---|---|---|---|
| Tytuł, y | 159 | 101 | 101 |
| Wysokość karty | 290 | 212 | 200 |
| Zdjęcie | 142x164 | 142.5x112 | 144.3x104 |
| CTA, y | 516 | 379.6 | 367.6 |
| Karta, promień | 23 | 16 | 14 |

Dokładne pomiary DOM obu motywów: beta23-measurements.json. To pomiary renderu,
nie fikcyjna makieta. Różnice referencji szacowano ze skompresowanej grafiki,
a nie z oryginalnego projektu/prototypu o znanej siatce.

## Pozostałe różnice i granice

Nowy oryginalny herb ma pionową tarczę, podczas gdy referencja pokazuje szerszy znak.
Nie zmieniano SVG ani jego proporcji. Zdjęcie jest materiałem użytkownika o innym
kadrze niż referencyjny stadion, bez potwierdzenia Harcerskiej. Rok/data, minimum10,
subtelne oznaczenie przykładowych danych i Narzędzia demo są dodatkami potrzebnymi
w działającym interfejsie. Aktualne wymaganie3 zakładek różni się od4 na referencji.
Przy844px wysokości pozostaje więcej wolnego tła pod CTA niż w krótszym kadrze
referencyjnego telefonu; nie wypełniano go fikcyjnymi funkcjami. Nie odtwarzano
obudowy/statusbara i nie deklarujemy zgodności piksel w piksel ani odbioru Androida.

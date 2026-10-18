# Premium España3.9 — Ultimate Player Card

## Materiały

Nowa zaakceptowana grafika dwóch ekranów Ultimate Player Card NIE była dostępna
w checkout ani załącznikach bieżącego zadania. Obecne reference/ zawiera tylko
starsze grafiki Premium meczów. Nie deklarujemy obejrzenia brakującej referencji
ani zgodności pikselowej. Opis użytkownika jest specyfikacją tej implementacji.
Gdy użytkownik dostarczy oryginał, zachować go w docs/ui/reference/; wygenerowane
portrety nie są zatwierdzoną referencją koncepcyjną.

Oficjalny slm-logo-primary-transparent.png i stadium-bg-main.jpg bez edycji.
Nowy assets/demo/fictional-portraits.webp: cztery całkowicie fikcyjne portrety
wygenerowane image_gen do demo, bez pobierania zdjęć rzeczywistych osób z sieci.
Oryginał PNG1086×1448 zachowano w katalogu generacji środowiska; WebP przekonwertowano
FFmpeg bez kadrowania, ma 117036 bajtów. Cztery komórki543×724 (3:4),
stałe przypisanie20 osób: indeks i -> kolumna i%2, rząd floor(i/2)%2. Cztery twarze
są świadomie powtarzane; nie twierdzimy, że są to20 unikalnych zdjęć.
SHA256 WebP: 94777ea97968f6c05b6611a45c98e0d9c1bf044b33c7b5db8d9404863e039ec2.
SHA256 oryginału PNG: 72505d00ce30a38916765a661ecd35827871fc94fd12387d8cfb9140398c88fa.

Prompt w skrócie: cztery odrębne fikcyjne dorosłe osoby, portrety do klatki
piersiowej, bordowe koszulki bez znaków i tekstów, pełna głowa z marginesem,
stadionowe oświetlenie, macierz2×2, spójne ciemne tło; bez znanych osób/klubów.
To zasób demonstracyjny wygenerowany do projektu, nie fotografia członka grupy.

## Komponent i trzy cykle renderów

UltimatePlayerCard to HTML/CSS, nie obraz całego interfejsu. Własny polygon tarczy,
złoty gradient ramy, ozdobne szczyty/wytrawiona linia, bordowo-czarne wnętrze,
światła stadionu, oficjalny herb i duże złote nazwisko. Zdjęcie3:4 nie jest rozciągane;
maskowany jest dół koszulki, nie głowa. Max340×502; przy320px karta300×443,
przy390/768px340×502. Rzeczywiste wymiary sprawdza Chromium z tolerancją pikselową.
Zastąpienie zdjęcia pojedynczym plikiem: portrait={src:'/lokalny-portret.webp'};
komórki sprite opcjonalne, obraz pojedynczy używa contain. Brak uploadu/API.
Fallback z inicjałami zachowuje tarczę/herb/nazwisko. Opcjonalny numer obsługiwany
prezentacyjnie, ale nie dodano numerów do danych, których model ich nie zawiera.
Bez pozycji, wieku, wzrostu, wagi, kontaktów, ocen, bramek/asyst/MVP i flag narodowych.

1. Ogląd rzeczywistego renderu390/320: duży portret, pełna głowa, dolne nazwisko,
   rama i herb. Zweryfikowano, że nie ma prostokątnego awatara ani panelu ocen.
2. Dodano subtelne stadionowe glinty i poświatę, ponownie wyrenderowano i obejrzano
   Dark oraz Light. Karta pozostaje bordowa na jasnym tle. Skorygowano selektor
   testu alertu: IonicAlert jest light DOM, w odróżnieniu od IonicButton Shadow DOM.
3. Dodano górną linię ramy i elastyczne źródło pojedynczego portretu; ponownie
   obejrzano render390/768. Końcowy smoke obejmuje też inny portret i rzeczywisty
   błąd dekodowania obrazu (lokalny HTML zamiast grafiki) -> inicjały, bez awarii.

Pod kartą krótki licznik rozegranych meczów z istniejącego modelu3.8. Nie dodano
nowych statystyk. Stara historia zachowana zwinięta, żeby nie łamać powrotów i
scenariuszy3.8; nie ma nowego rozbudowanego ekranu statystyk ani systemu ocen.

## Usuwanie gości

Ikona44×44 wyłącznie przy własnym gościu w nadchodzącym meczu. IonAlert podaje
konkretną osobę, Anuluj/Usuń gościa; dla osoby bez profilu komunikat nie sugeruje
istnienia konta. Reducer sprawdza id wpisu, inviterId i status. Powtórne żądanie
jest no-op. Wpis oznaczany withdrawn, profil/portret osoby pozostaje w katalogu.
Rezerwa nie awansuje, liczba miejsc i należności są przeliczane. Wcześniejsza
symulowana wpłata zostaje w danych i sumie zebranej; wycofane płatne wpisy są
jawnie pokazane jako zachowane wpłaty zapraszającego. Brak produkcyjnego FIFO.
Zamknięto też obejście przez withdraw: gość z kontem nie może usunąć zaproszenia
należącego do innego zapraszającego głównym CTA. To reguła tylko modelu demo.

## Zrzuty rzeczywistego React/Ionic

- [Dark](premium39-player-card-dark.png)
- [Light](premium39-player-card-light.png)
- [320px](premium39-player-card-320.png)
- [768px](premium39-player-card-768.png)
- [Potwierdzenie usunięcia](premium39-guest-remove.png)
- [Inny portret](premium39-player-card-alternate.png)
- [Fallback](premium39-player-card-fallback.png)

## Weryfikacja i granice

TS/ESLint/oba buildy OK. Vitest104/104 w17 plikach: model, ownership/idempotencja,
rezerwa/liczniki/profil, zachowanie wpłaty, macierz stałych zdjęć i fallback.
Chromium320/390/768: proporcje/cała karta/nazwisko, portrety/awaria obrazu,
profile globalne i powrót, oba typy gościa, cancel/confirm, brak usuwania cudzych,
liczniki12->11->10 i rezerwa2, wcześniejsze scenariusze3.8, motywy i CSP OK.
Demo15 plików statycznych; nowy WebP jawnie emitowany i porównywany bajtowo,
sygnatura/rozmiar sprawdzane. Brak Auth/Supabase/API/Edge i żądań zewnętrznych.
Nie zmieniono produkcyjnych stron, modelu backendu, finansów, RPC/RLS/migracji,
Firebase ani vercel.json. Cypress niewykonany (brak Xvfb), Android/iOS/realny backend
nieweryfikowane, duże chunki Ionic nadal. Bez merge/ręcznego deploy; Vercel auto
niezweryfikowany. Brak referencji to istotna granica oceny zgodności wizualnej.

## Uzupełnienie po otrzymaniu właściwej koncepcji Ultimate

Oryginał [dwóch telefonów](reference/slm-ultimate-player-card-concept.jpg)
użytkownik dostarczył po implementacji3.9. Obraz rzeczywiście otwarto i porównano
z premium39-player-card-dark.png. Powyższy opis braku obrazu jest historyczny.

Różnice przed korektą: schodkowe/kanciaste barki tarczy zamiast płynnej korony,
pojedynczy mocny obrys zamiast dwóch cienkich złotych linii, herb po lewej zamiast
po prawej, zbyt prosty górny ornament. Zmieniono krzywą SVG w clipPath objectBoundingBox
(z unikalnym id React useId dla wielu kart) i dodano niezależną linię wewnętrzną
z non-scaling-stroke. Rama nadal skalowalna340:502, portrety/herb bez edycji.
Przesunięto herb na prawą stronę, wzmocniono dwa lokalne refleksy. Po pierwszym
rzeczywistym renderze przeniesiono dolny ornament do wnętrza zwężenia ramki.
Ponownie wyrenderowano Chromium; zrzuty premium39-* odświeżone.

Nadal inne: portrety frontalne do klatki piersiowej zamiast zdjęcia trzy czwarte
i koszulki z większą ilością tułowia; ciemne tło samych zdjęć ogranicza widoczność
stadionu. Nie zmieniano tożsamości zdjęć ani zatwierdzonego herbu, nie kopiowano
znaków odzieżowych koncepcji. Brak numeru/pozycji w danych — nie wymyślono ich.
Nie implementowano paneli ocen, mediów, rozszerzonych statystyk ani przycisku koszulki
z referencji. Nie deklarujemy zgodności pikselowej ani gotowości produkcyjnej.

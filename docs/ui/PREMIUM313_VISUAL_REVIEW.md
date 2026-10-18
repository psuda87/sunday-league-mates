# Premium España3.13 — Mój profil i ustawienia

## Materiały i konstrukcja

Obejrzano rzeczywiste premium310-player-card-dark/light, premium312-settlement-
dark/light oraz Premium branding board. Nie projektowano nowej karty/znaku.
Profil główny korzysta z DemoProfile personal, tej samej UltimatePlayerCard i
tego samego bloku4 podstawowych statystyk. Zwięzły nagłówek Mój profil z
oficjalnym herbem, karta/numer/gwiazdki/4 pola, niżej3 przyciski44px oraz
zwijane ustawienia. Nie powielono nazwiska lub zdjęcia nad kartą.
CSS nie zmienia zaakceptowanych selektorów Ultimate; nowe reguły tylko kontrolek
tożsamości i awatarów po świadomej zmianie zdjęcia. Brak nowych grafik/dependencies.

## Jeden rekord, własne uprawnienia demonstracyjne

Model ma istniejące DemoPlayer.name (bez nowych pól backendu). Formularz Imię
i Nazwisko/nazwa wyświetlana składa je w pojedynczą nazwę, normalizuje spacje,
limit48 znaków Unicode, bez pustej nazwy/znaków sterujących/nawiasów<>.
Nowa akcja identity modyfikuje tylko aktualnie symulowanego zawodnika.
Portrait też tylko własny; reducer dopuszcza jawne4 komórki WebP albo lokalny
raster data URL, nigdy URL sieciowy/SVG. Inne profile mają wyłącznie odczyt,
bez edycji cudzych danych także w demonstracyjnym trybie finansowego admina.

Numer wykorzystuje dotychczasowy formularz w DemoProfile i akcję jersey — ten
sam ołówek na karcie i przycisk z edytora uruchamiają jedną ścieżkę0–99,
duplikaty dozwolone, nie powstał drugi walidator/stan numeru w edytorze nazw.
Statystyki/finanse/zapisy/ID nie zmieniają się przy edycji tożsamości.
Wszystkie ekrany odczytują world.players po tym samym id. Zmiana nazwy jest
widoczna w sortowaniu/wyszukiwaniu, uczestnikach, boisku, rozliczeniu i kartach.
Po zatwierdzeniu zdjęcia okrągłe awatary tych widoków pokazują nowy portret,
boisko zachowuje numer nad delikatnym zdjęciem w znaczniku. Przed edycją
poprzednie zaakceptowane inicjały/znaczniki pozostają bez zmian.
Reset demo przywraca fabryczne nazwy/numery/portrety. Brak persistencji danych.

## Zdjęcie: prawdziwy podgląd bez uploadu

AvatarPicker daje4 istniejące generatywne, fikcyjne portrety z jednego WebP.
Wybór zmienia tylko draft/podgląd; Anuluj odrzuca, Zatwierdź zapisuje do world.
Akceptuje też lokalne PNG/JPEG/WebP do2MiB, max4096px na bok. Sprawdzane
sygnatury MIME, zgodność deklarowanego typu i dekodowanie/wymiary obrazu.
SVG/inne formaty, uszkodzone, za duże/niepoprawne pliki mają czytelny błąd.
Nie przesyłamy plików, nie używamy Storage/obcych usług/object URL/canvas/nowych
zależności. FileReader→data URL→obraz natywnie w przeglądarce. Obecna CSP
img-src self data: wystarcza, connect-src none bez zmian. Nie zapisujemy
obrazów do localStorage/serwera/repo. Nie przechowujemy nazwy lokalnego pliku.
Licznik generacji odrzuca spóźniony odczyt po zmianie wyboru lub odmontowaniu.

Karta nadal contain dla pojedynczego zdjęcia: zachowuje proporcje i pełny obraz,
bez automatycznego kadrowania/usuwania tła. Macierz portretów3:4 ma stałe
pozycje; miniatury okrągłe kadrują do awatara bez deformacji twarzy.
Test pliku lokalnego używa istniejącej oficjalnej ikony PNG, nie prywatnej
fotografii. Zrzuty pokazują tylko fikcyjne portrety, sprzed tej próby plikowej.

## Ustawienia i konto

AppearanceSettings nadal steruje Auto/Jasny/Ciemny, reaguje na system i zapisuje
wyłącznie stary wybór motywu. Każda instancja ma unikalną nazwę grupy radio,
aby profil i Narzędzia demo nie odznaczały sobie opcji. Zmieniono identyfikator,
nie system motywów. Hasło/Powiadomienia/Wylogowanie/Dane konta to4 jawne pozycje
Niedostępne w demo, bez handlerów i fałszywych komunikatów wykonania.
Nie ma prawdziwej sesji, wylogowania, Auth, push ani uploadu do backendu.

## Trzy cykle rzeczywistego React/Ionic Chromium

1. Ogląd własnej karty Dark/Light, formularza, wyboru i ustawień. Karta pasuje
   do3.10 i mieści się ze statystykami oraz kontrolkami na390. Wykryto
   pozostawanie błędu po poprawieniu nazwy, angielski natywny przycisk pliku
   i czerwony globalny komunikat po zwykłej edycji — do poprawy.
2. Czyszczenie błędu w trakcie poprawiania, polska etykieta wyboru pliku44px,
   cichy feedback własnego profilu, właściwe flex/44px opcji motywu. Obejrzano
   Light/form/picker/settings; pełny Chromium przeszedł.
3. Aktywny przycisk edytora ma aria-expanded i złote obramowanie. Po zamknięciu
   edytora fokus wraca do nazwy na karcie; formularz zachowuje scroll/fokus pól.
   Ponowne renderowanie, próba odrzucenia SVG/anulowania lokalnego pliku/
   zatwierdzenia PNG i resetu pełnej tożsamości.

## Zrzuty rzeczywistego UI

- [Mój profil Dark](premium313-my-profile-dark.png)
- [Mój profil Light](premium313-my-profile-light.png)
- [Edycja](premium313-profile-edit.png)
- [Wybór zdjęcia](premium313-avatar-picker.png)
- [Ustawienia](premium313-settings.png)
- [320px](premium313-my-profile-320.png)

## Ograniczenia

Dane są jawnie fikcyjne, zmiany tylko RAM i giną po resecie/reloadzie. Nie ma
uprawnień/sesji produkcyjnych ani backendu, uploadu, metadanych fizycznych, ocen,
filmów lub nowych statystyk. Lokalny PNG i odrzucenie SVG weryfikuje Chromium;
obsługaJPEG/WebP opiera się też na dekoderze przeglądarki. Nie weryfikowano
prawdziwej klawiatury/galerii Androida ani iOS — wymagają telefonu. Formularze
mają44px pola i scroll-margin, ale nie deklarujemy weryfikacji natywnej klawiatury.
Brak deklaracji gotowości produkcyjnej.

## Wyniki końcowe

ESLint/TypeScript/build aplikacji/build demo OK; Vitest122/122 w21 plikach.
Nowe testy: własność/nazwa/normalizacja/limit/portret/zakaz zewnętrznegoURL/SVG,
cancel/commit, brak edycji cudzych, jedna karta/4 statystyki, własny numer nadal
ten sam formularz, reset i niezależne grupy radio.
Chromium320x844/390x844/768: profil/nazwa/numer0/avatar/cancel, aktualizacja
katalogu/uczestników/składów/rozliczenia/innych kart, readonly cudzych/powroty,
reset przywracający Alex/10/portret0-0, lokalnyPNG preview/cancel/commit i
odrzucenieSVG, brak obrazów w localStorage/CSP naruszeń/obcych żądań.
Dark/Light/Auto i pierwszeństwo trybu ręcznego także bezpośrednio z nowych
ustawień; dotychczasowe zapisy/rezerwa/goście/składy/finanse/role/kwoty nadal OK.
Izolacja15 plików/6 istniejących zasobów, allowlista tylko Identity/portraits,
bez Auth/API/Supabase/Edge/sekretów i bez zmian CSP/env/vercel.json.
Porównanie trzeciego cyklu:10/10 poprzednich zrzutów SHA256 identycznych.
Dodatkowy końcowy przebieg:9/10 identycznych; Rozliczenie Light różni się17
pikselami na lewym obrysie wierszy (bbox16,408–18,526, max1/255 na kanał), bez różnicy geometrii
lub treści. Zrzut obejrzano; nie retuszowano obrazów, aby wymuszać zgodność.
To testy fikcyjnego demo i istniejących atrap API, nie prawdziwy Supabase.
Cypress niewykonany (brak Xvfb); Android/iOS, natywna klawiatura/galeria i
prawdziwy backend nieweryfikowane. Duże chunki Ionic nadal. Bez migracji/merge/
ręcznego deploy. Automatyczny Vercel niezweryfikowany.

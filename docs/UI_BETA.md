# Premium3.18 FINAL UI — 2026-10-19 12:25:09 CEST

Zakończono frontendowy zakres SLM1.0 do dalszej integracji, bez deklaracji gotowości
produkcyjnej aplikacji. Dodano wspólne ekrany kont i jawny symulator: login/signup/
verify/resend/forgot/reset/change password/first profile oraz checking/expired/
network/logout. Nowy zawodnik ma0statystyk/brak grupy; używa istniejącej Ultimate,
publiczne/prywatne i grupy zgodnie z3.15/3.16. Brak haseł w trwałym stanie/sieci.
Kontrola generacji blokuje spóźnione logowanie, logout usuwa poprzednie widoki.
España pozostaje domyślna,4palety×3tryby, preferencje zachowane po logout.

Produkcja zachowuje login/telefon, SessionManager/TokenStore i istniejący kontrakt;
współdzieli pola Ionic. Nowe UI e-mail NIE jest podłączone do serwera. Obecny Auth
blokuje signup/pocztę; wymagane przyszłe kontrakty/migracje i dokumenty prawne.
Nie zmieniano backendu/SQL/RLS/RPC/Firebase/finansów/config Vercel i zasad grup/meczów.

Weryfikacja: TS/fullESLint/oba buildy/izolacja15plików OK; pełny Vitest184/184
(33pliki). Chromium pełny świat demo + grupy/widoczność/palety/konta,320/390/768,
12kombinacji, brak żądań zewnętrznych/CSP. Dziewięć prawdziwych zrzutów premium318.
Cypress próbowano: brak binarnej instalacji16.1.1 (i Xvfb), niewykonany. Android/iOS,
realna klawiatura, e-mail/deep links i baza/RLS/transakcje niewykonane; mocki nie są
Supabase. Ostrzeżenie chunków pozostaje. Nie wykonano merge/migracji/ręcznego deploy.
Nie zweryfikowano automatycznego Vercel. Historyczne ograniczenia Dockera/SQL poniżej
pozostają. Nie rozpoczęto3.19 ani backendu.

Dokumenty: [zamknięcie UI](ui/PREMIUM318_FINAL_UI.md),
[przekazanie backendowe](FRONTEND_HANDOFF.md). Raport i SHA w ODPOWIEDZI_CODEX.txt.

# Premium 3.17 — 2026-10-19 11:39:28 CEST

Tylko izolowane demo:4 palety España/FCB/Classic Lime/Deimos-Code, niezależne
od Jasny/Ciemny/Auto (12 kombinacji). Jeden rejestr istniejących tokenów CSS,
wybór w Profil→Ustawienia oraz Narzędziach demo. Domyślnie España/Auto;
localStorage slm.palette + istniejące slm.appearance, bez danych osobowych/API.
Reset wydarzeń zachowuje preferencje; zmiany systemowe działają na żywo w Auto.
Gdy magazyn przeglądarki jest zablokowany, wybór działa w pamięci bieżącej strony.
Produkcja nie aktywuje nowych palet (initializeTheme domyślnie bez opt-in).

Deimos: rzeczywiście odczytano3 wskazane CSS repo psuda87/code-finder, commit
`a13f389d6d477afbb6fc34aeb0ee9c49847a3ade`; użyto wyłącznie wartości kolorów,
bez kopiowania kodu/danych/logotypu. FCB granat/bordo, Lime ciemna zieleń/limonka.
España zachowuje układ/teksturę/zasoby; jedyna korekta starego koloru: najjaśniejszy
stop czerwonego CTA Dark F01937→E71835, kontrast białego tekstu4,29→4,59:1.
Nowe palety mają własne subtelne tła zamiast narzuconej bordowej tekstury España.
Herb, zdjęcia, Ultimate i boisko/dolna nawigacja nie zostały przebudowane.

Prywatne/Publiczne z ikonami zamkniętej/otwartej kłódki Ionic wewnątrz prawego
górnego rogu kart; tylko nazwa grupy pozostaje nad kartą. Po jednej etykiecie,
bez emoji i kolizji. Karty nadal121px, plus56px/20px. Lokalizacja formularzy:
kontrolowane DD.MM.RRRR i HH:mm z klawiaturą numeryczną i separatorami; brak
natywnych date/time zależnych od języka systemu. ISO, Warsaw/DST i walidacja
pozostają. Podgląd/Informacje/ograniczony udział wyświetlają pl-PL h23.

STANDARD: TypeScript i ESLint zmienionego zakresu OK; demo build + izolacja15
plików/CSP OK. Vitest173/173 w29 plikach, po końcowych poprawkach zawężone32/32
w5 plikach (w tym dodatkowy test wejścia cyframi; bez deklaracji pełnego174/174).
Chromium:12 kombinacji,8 widoków palet+3 dodatkowe zrzuty,320/390/768, brak overflow,
privacy badge w karcie, persistence/reload/reset/Auto, smoke zapis/grupa/profil/
rozliczenie i zachowanie uprawnień. Kontrast wybranych par tekst/powierzchnia,
muted/surface, primary/accent i gradient CTA≥4,5:1. Dodatkowo sprawdzono focus,
modal Deimos (1E1E1E/FFFFFF), cyfrowe wpisanie terminu/podgląd. Rzeczywiste20.10.2026
18:00 sprawdzone również przy en-US i America/New_York. Brak zewnętrznych żądań.
Bez pełnej starej regresji Chromium, Cypress, produkcyjnego builda i Android/iOS;
nie jest to pełny audyt WCAG. Duży chunk Ionic nadal ostrzeżeniem. Backend/model
grup i finansów/RPC/RLS/migracje/Firebase/vercel.json bez zmian; bez merge/deploy.
Historia Dockera i niezweryfikowanych migracji poniżej zachowana. Zakończono3.17.
Dokumentacja i11 prawdziwych zrzutów: [ui/PREMIUM317_THEMES.md](ui/PREMIUM317_THEMES.md).

# Premium España 3.16 — 2026-10-19 09:54:56 CEST

Wyłącznie izolowane demo. Game ma groupId/createdBy/visibility; wszystkie10 meczów
przypisano deterministycznie do istniejących grup, bez zmiany wpisów/składów/wpłat.
Formularz wybiera tylko grupy admina/organizatora, domyślnie private; jedna grupa
wybierana automatycznie. Usunięto globalne eventRole. Plus korzysta na żywo
z członkostw/uprawnień grupowych, bez zmiany56px/20px/notch i menu Mecze/Grupy/Profil.
Uprawnienia ponownie sprawdzane przy podglądzie, zatwierdzeniu i w reducerze.
Edycja/widoczność wyłącznie twórcy, który nadal jest członkiem grupy; brak prawa
edycji cudzych wydarzeń dla administratora. Utrata organizer blokuje nowe mecze,
ale nie odbiera własności już utworzonych; wyjście z grupy blokuje ich edycję.

Private outsider: tylko nazwa/termin/grupa/oznaczenie, bez przycisku szczegółów,
licznika, uczestników, profili, składów, finansów i suwaka w narzędziach.
Public: dostęp i dotychczasowe zapisy/goście/rezerwa, bez automatycznego członkostwa.
Ponowne zamknięcie zachowuje wszystkie wpisy i historię. Zapisany outsider ma
ograniczony widok własnego udziału, miejsca/terminu i własnych zobowiązań;
może wycofać swój wpis/usunąć własnego gościa, a istniejący rezerwowy ręcznie
zająć zwolnione miejsce (bez awansu automatycznego i bez nowych zapisów/gości).
Cudze profile/składy/wpłaty i lista grupy pozostają niedostępne. Istniejąca wpłata
po wycofaniu zachowuje własny wgląd finansowy, bez nowych uprawnień uczestnictwa.
Finansowy tryb admina demo działa tylko dla członków grupy; outsider zawsze tylko
własne pozycje. Nie zmieniono zasad finansowych/FIFO/blokady dwóch zaległych meczów.

STANDARD: TS i ESLint zmienionych plików OK; build demo + ścisła izolacja15 plików
OK; Vitest164/164 w27 plikach, końcowo formularz7/7 (w tym dodatkowy przypadek
odebrania wybranej grupy, gdy inna nadal daje prawo tworzenia). Wybrane Chromium
320/390/768, Dark/Light/Auto, dostęp/własność/zapis/reclose/powrót profilu i krótki
smoke grup/składów/rozliczeń OK; bez zewnętrznych żądań i błędów CSP.7 rzeczywistych
zrzutów premium316-*.png. Bez pełnej starej regresji Chromium, produkcyjnego builda,
Cypress i testów natywnych Android/iOS. Znane ostrzeżenie chunka Ionic >500kB.
Backend/Auth/RPC/RLS/migracje/Firebase/finanse produkcyjne/vercel.json bez zmian;
bez merge i ręcznego wdrożenia. Historyczne ograniczenia Dockera/backendu poniżej
pozostają aktualne. Szczegóły: [ui/PREMIUM316_EVENTS.md](ui/PREMIUM316_EVENTS.md).
Zakończono3.16; kolejny etap wymaga osobnego zadania.

# Premium España3.15 — 2026-10-19 08:54:16 CEST

Wyłącznie izolowane demo: wspólny GroupState (grupy, członkostwa, zgłoszenia),
Moje grupy / tworzenie / szukanie / szczegóły / panel administratora. Nawigacja
Mecze–Grupy–Profil, osobny plus56px/20px nadal z symulacji eventRole3.14;
uprawnienia grupowe przygotowane, bez wiązania meczów z grupą przed3.16.
Zaproszenie admina wymaga zgody odbiorcy; propozycja członka najpierw zgody
admina, potem odbiorcy; prośba o dołączenie zgody admina i może być anulowana.
Deduplikacja i sprawdzanie uprawnień również w reducerze. Jedyny admin grupy,
organizer lokalny dla członkostwa, usunięcie cofa dostęp/uprawnienia, transfer
manualny z potwierdzeniem. Odejście admina: najstarszy organizator → najstarszy
członek → stabilny playerId przy remisie; ostatni usuwa pustą grupę po potwierdzeniu.
Członkowie otwierają istniejącą kartę Ultimate innych członków. Outsider nie
widzi listy ani profili grupy, także po zmianie użytkownika w otwartej karcie.
Telefon: dokładna normalizacja, brak wyników/ujawnienia istnienia kontaktu,
stały komunikat; wyłącznie niedzwoniące kontakty fikcyjne. Nick szukany tylko
w panelu zapraszania członka, min2 znaki/max5 wyników, bez globalnego katalogu.
Fixture40 zawodników,4 grupy (25/35/8/1 członków), stan bez grup i otrzymane
zaproszenie; stare20 profili i mecze zachowane, bez nowych obrazów.
TS i ESLint zmienionego zakresu OK, demo build/izolacja15 plików/CSP OK,
150/150 Vitest w25 plikach, wybrane Chromium320/390/768 i8 rzeczywistych zrzutów
premium315-*.png OK. STANDARD: bez produkcyjnego builda, pełnej starej regresji
Chromium, Cypress, Android/iOS. Backend/Auth/RPC/RLS/Firebase/finanse/Vercel
bez zmian. Migracji/merge/ręcznego deploy nie wykonywano. Ograniczenia Dockera
/backendu poniżej zachowane. Kontrakty i zakres3.16: ui/PREMIUM315_GROUPS.md.

# Premium3.14 — korekta menu — 2026-10-18 20:05:31 CEST

Na polecenie użytkownika dolne menu demo ma teraz wyłącznie Mecze / Profil.
Zawodnicy nie są osobną zakładką ani katalogiem w demo. Profile innych osób
otwiera się wyłącznie z konkretnego meczu: Uczestnicy, Składy, Rozliczenie;
powrót przywraca mecz/panel i aktywną pozycją menu pozostają Mecze.
Admin: centralny plus56px/20px pomiędzy dwiema zakładkami. Zmieniono górny padding
z40px na standardowe5px: footer w Chromium bez
safe area ma86px zamiast121px (o35px mniej). Gracz: dwa symetryczne przyciski,
bez plusa. Produkcyjny BottomNav/Auth/backend/Vercel bez zmian.
TS/ESLint/oba buildy/131 Vitest i kontrola Chromium320/390/768 OK; demo izolacja
15 plików/CSP OK. Rzeczywiste zrzuty ui/premium314-compact-nav-*.png.
Android/iOS/klawiatura natywna nadal wymagają weryfikacji, bez ręcznego deploy.

# Premium España3.14 — 2026-10-18 19:57:42 CEST

Wyłącznie demo: centralny plus56px / wystaje20px, rzeczywista maska i złota
krzywizna notch, safe area i miejsce zarezerwowane przez footer. Zgodnie z
późniejszą odpowiedzią użytkownika nadal3 zakładki Mecze/Zawodnicy/Profil;
Składy tylko w meczu. Zwykły gracz zachowuje istniejący BottomNav. Administrator
wydarzeń w Narzędziach demo ma plus i Edytuj mecz dla nadchodzących wydarzeń.
Wspólny EventForm: podstawowe pola/min/max/koszt, walidacja, Europe/Warsaw/DST,
podgląd bez mutacji, utworzenie z pustą listą i stabilnym id/kluczem deduplikacji,
edycja bez utraty zapisów/gości/rezerwy/składów/wpłat, Anuluj bez zapisu. Limit
nie może spaść poniżej aktywnych osób. Minimum prezentacji jest parametrem,
domyślne10 dla istniejącej aplikacji bez zmiany reguł. Nowe mecze działają ze
wspólnymi operacjami demo; reset je usuwa. Rola wydarzeń jest osobną symulacją,
nie udostępnia automatycznie cudzych finansów. Bez API/persistencji/backendu.
TS/ESLint/oba buildy OK,131/131 Vitest w23 plikach,3 cykle Chromium320/390/768
oraz pełna regresja starych scenariuszy OK. Izolacja15 plików/CSP OK.9/10
zaakceptowanych zrzutów identycznych SHA256; Rozliczenie Light tylko17 pikseli
obrysu o1/255 (bez zmiany geometrii/treści). Zrzuty premium314-*.png i analiza
ui/PREMIUM314_VISUAL_REVIEW.md. Cypress brak Xvfb, Android/iOS/klawiatura natywna
nieweryfikowane. Duże chunki Ionic nadal. Backend/Docker ograniczenia poniżej
pozostają aktualne; bez migracji, merge i ręcznego deploy. Vercel niezweryfikowany.

# Premium España3.13 — 2026-10-18 18:36:29 CEST

Wyłącznie demo: dolny Profil otwiera Mój profil, istniejący DemoProfile i jedną
kartę Ultimate3.10 +4 pola, bez kopiowania karty. Edytuj profil/Zmień zdjęcie/
Ustawienia, bez zbędnych powtórzeń nazwy i zdjęcia. Jedno DemoPlayer.name (imię
+druga część nazwy), własna edycja/walidacja48 znaków; numer nadal ta sama akcja
jersey i istniejący formularz0–99. Inne profile tylko odczyt dla innych osób.
Fikcyjne4 portrety i lokalny PNG/JPEG/WebP≤2MiB/4096px, podgląd/Anuluj/Zatwierdź;
FileReader/data URL tylko RAM, bez uploadu/Storage/localStorage/repo. Nie zmieniono
CSP, obrazów źródłowych ani konfiguracji Vercel. AvatarPicker ignoruje opóźnione
wyniki po anulowaniu/zmianie wyboru. Wspólny world aktualizuje wszystkie widoki
przez id; dopiero po wyborze zdjęcia awatary list/boiska pokazują zmianę.
AppearanceSettings nadal wspólne: Auto/Light/Dark, unikalne grupy radio przy
jednoczesnym montowaniu w profilu i narzędziach. Konto:4 jawne niedostępne pozycje,
bez pozornego hasła/push/wylogowania/sesji. Reset odtwarza fixture.
Backend/Auth/RPC/RLS/migracje/finanse/Firebase bez zmian. Szczegóły
ui/PREMIUM313_VISUAL_REVIEW.md, raport ODPOWIEDZI_CODEX.txt. Starsze ograniczenia
backendu/Dockera pozostają poniżej. TS/ESLint/oba buildy OK;122/122 Vitest
i Chromium320/390/768: nazwa/numer/avatar/lokalnyPNG/SVG/cancel/reset/readonly/
spójność danych i nowe ustawienia Auto/Light/Dark OK. Izolacja15 plików/CSP OK.
Pozostałe zaakceptowane widoki bez przebudowy;3.cykl10/10 SHA256 identycznych,
końcowo9/10 i17 różniących pikseli obrysu Rozliczenia Light (opis w review). Cypress brak Xvfb; native
klawiatura/galeria/backend nieweryfikowane, duże chunki Ionic nadal.

# Premium España3.12 — 2026-10-18 18:11:49 CEST

Wyłącznie demo: nowy Finance.tsx w Rozliczeniu.4 kafelki2×2, postęp0–100%,
lista udziałów z inicjałami/klikalnymi profilami/statusami i kwotami, nadpłata
osobno. Model Entry.paidCents wspólny; demoFinance projektuje własne pozycje
(z gośćmi obciążającymi zapraszającego) lub pełny widok administratora demo.
Zwykły zawodnik nie widzi cudzych pozycji/wpłat. Koszt/udział wspólny wydarzenia,
ale Wpłacono/Pozostało/postęp wyraźnie własne; administrator widzi cały mecz.
Tylko admin demo edytuje0/pełna/własna kwota, grosze/liczby całkowite; nie są to
przelewy ani wpłaty produkcyjne. Przełącznik ról nie jest zabezpieczeniem.
Domyślnie player; zmiana użytkownika/reset też przywraca player. Wspólne fixture
20osób/10meczów, w pierwszym meczu6400gr fikcyjnych wpłat mieszanych.
Retained wpłaty po wycofaniu pozostają w sumie/widoku właściciela, bez FIFO
i automatycznej alokacji. Brak backendu/Auth/RPC/RLS/migracji/Firebase/vercel.json.
Pozostałe zaakceptowane UI bez przebudowy. Szczegóły ui/PREMIUM312_VISUAL_REVIEW.md,
raport ODPOWIEDZI_CODEX.txt. TS/ESLint/oba buildy OK;116/116 Vitest i Chromium
320/390/768: własne/admin/partial/0/full/over/retained/reset/profile oraz
regresja gości/składów/zapisów OK. Izolacja15 plików/CSP OK. Pozostałe UI
porównane SHA256 bez zmian. Cypress brak Xvfb, native/backend nieweryfikowane.
Duże chunki Ionic nadal. Starsze ograniczenia backendu/Dockera pozostają.

# Premium España3.11 — 2026-10-18 17:43:30 CEST

Wyłącznie demo: nowe boisko SVG/CSS w zakładce Składy, naturalne ciemne pasy,
linie/koło/pola/bramki i światło. Dwie drużyny: bordo/złoto u góry, ivory/złoto
u dołu; numery0–99 z tych samych DemoPlayer i czytelne skrócone nazwiska.
Zwykłe kliknięcie otwiera tę samą kartę3.10; osobny tryb zamiany wybiera dwie
osoby z przeciwnych drużyn (obrys+✓), reset podziału i puste stany/create.
Game.lineup przechowuje id wpisów, teamEntries filtruje wyłącznie registered,
bez rezerwy/wycofanych. Nowe osoby jawnie Poza podziałem do ręcznego resetu.
Usunięty gość znika z boiska, gość bez profilu nie ma linku ani fikcyjnego konta.
Podział wyłącznie w pamięci, bez algorytmu produkcyjnego/API/persistencji.
Mecze/Szczegóły/Zawodnicy/karta3.10 bez przebudowy; backend/Auth/RPC/RLS/migracje/
finanse/Firebase/vercel.json bez zmian. allowlista demo dopuszcza tylko Teams.tsx.
Szczegóły i zrzuty ui/PREMIUM311_VISUAL_REVIEW.md, raport ODPOWIEDZI_CODEX.txt.
TS/ESLint/oba buildy OK;112/112 Vitest i Chromium320/390/768: numery/profile/
zamiany/reset/goście/puste stany/kolizje/motywy/izolacja15plików OK. Zrzuty
premium311-* i porównanie SHA256 potwierdzają brak zmian zaakceptowanych ekranów.
Cypress brak Xvfb, Android/iOS nieweryfikowane, duże chunki Ionic nadal.
Wcześniejsze ograniczenia backendu/Dockera pozostają aktualne poniżej.

# Premium España3.10 — 2026-10-18 17:29:33 CEST

Wyłącznie demo: zaakceptowana tarcza/herb/portrety3.9 zachowane, stadion wyraźniejszy
przez maskowane boki zdjęcia i gradient nad murawą. Karta max300×443 zamiast340×502
(-11,76% obu wymiarów); na320 szerokość264 zamiast300 (-12%). Numer0–99 na tarczy,
ołówek44px tylko właściciela, walidacja UI+reducer, pamięć wspólna do resetu/reloadu.
Pięć dekoracyjnych złotych gwiazdek (aria-hidden, bez ocen). Pod kartą4 pola w rzędzie:
Mecze z potwierdzonej fikcyjnej obecności, Bramki/Asysty/MVP z jawnie przypisanych
stałych demoTotals, niezależnych od zapisów/obecności. Historia profilu3.8 usunięta
na polecenie3.10; profil ma tylko kartę,4 pola i chwilowy formularz numeru. Stos
nawigacji/powroty zachowane, bez nowych zakładek. Szczegóły ui/PREMIUM310_VISUAL_REVIEW.md.
Backend/Auth/RPC/RLS/migracje/finanse/Firebase/Vercel i produkcyjne UI bez zmian.
TS/ESLint/oba buildy OK;108/108 Vitest i Chromium320/390/768, Dark/Light/Auto,
numer/własność/powroty/usuwanie gości/izolacja15plików OK. Cypress brak Xvfb,
Android/iOS nieweryfikowane, duże chunki Ionic nadal. Starsze ograniczenia
backendu/Dockera pozostają. Raport ODPOWIEDZI_CODEX.txt.

# Ultimate3.9 — otrzymana referencja, 2026-10-18 17:11:13 CEST

Oryginał użytkownika zapisany i obejrzany: ui/reference/slm-ultimate-player-card-concept.jpg.
Zaktualizowano wyłącznie kartę demo: krzywe korony/ramy, podwójny złoty obrys,
herb po prawej i światło. Bez rozbudowy statystyk/ocen/mediów i bez nowych portretów.
Portrety frontalne nadal różnią się od ujęcia trzy czwarte w koncepcji.
Starsze wpisy o braku referencji opisują stan sprzed jej dostarczenia.
Szczegóły w ui/PREMIUM39_VISUAL_REVIEW.md i ODPOWIEDZI_CODEX.txt.

# Premium España3.4 — szczegóły i Uczestnicy

Home3.3 zachowany: końcowe Dark/Light są bajtowo identyczne. Zmiany tylko szczegółów:
niższy fotograficzny nagłówek, nazwa z dostępnych danych, powrót, pasek/minimum10,
44px CTA i pojedynczy poziomy pasek4 zakładek (domyślnie Uczestnicy).
Wspólny ParticipantGroup/RosterSummary pokazuje Zapisani/Goście/Rezerwa, wolne
miejsca, inicjały i statusy. Po5 zapisanych: Pokaż wszystkich/Zwiń z zachowaniem
stanu panelu. Numery i działania wyłącznie według istniejących danych/uprawnień.
UI single-flight w work() chroni przed przypadkowym podwójnym wywołaniem;
backend/RPC/finanse/UUID i zasady zapisów niezmienione.

Demo to nadal fikcyjne osoby i nieaktywne zapisy; Składy Planowane bez algorytmu,
Rozliczenie Funkcja w przygotowaniu, bez fałszywych należności. Prawdziwy panel
finansowy aplikacji zachowany. [Analiza3 cykli](ui/PREMIUM34_VISUAL_REVIEW.md),
[Uczestnicy Dark](ui/premium34-participants-dark.png),
[Light](ui/premium34-participants-light.png), [grupy](ui/premium34-participants-groups-dark.png).
90/90 Vitest, lint/TS/oba buildy, Chromium320/390/768/obrót844x390/izolacja OK.
To nie test rzeczywistego Supabase ani urządzenia. Poniżej historia.

---

# UI Beta3.3 — Floating Crest

Pełny primary-transparent450x505 bez zmian pikseli, contain/height:auto, zamiast
przyciętego header-transparent. Znak z poświatą w normalnym flow IonContent,
bez osobnego paska IonToolbar i fixed/sticky. Tło strony ciągłe w Dark/Light.
Górny safe area jawnie doliczany; powiadomienia i footer zachowane.
Karty/filtry/szczegóły i dane bez przebudowy. Na390x844 cztery karty, około5px
więcej miejsca niż3.2; główny zysk jest wizualny. Na768 pełny herb nieco wyższy.

[Analiza3 cykli](ui/PREMIUM33_VISUAL_REVIEW.md), [Dark](ui/premium33-home-dark.png),
[Light](ui/premium33-home-light.png), [320](ui/premium33-home-320.png),
[768](ui/premium33-home-768.png). Lint/TS/buildy/Vitest87/87/Chromium OK.
Symulacja top safe area32px i scroll są sprawdzone; Android/iOS pozostają do odbioru.
Historia niżej. Nowy primary zastępuje używanie header z poprzedniego etapu.

---

# UI Beta3.2 — naturalne logo i stadionowe karty

Nowe prawdziwe RGBA: header-transparent290x280 oraz primary-transparent450x505.
Maski na oryginalnych pikselach, wnętrze tarczy chronione, oryginałów nie nadpisano.
Header82px/branding84px zamiast92/96; tytuł y94, pierwsza karta y196 zamiast227
na390x844. Safe areas pozostają po stronie Ionic. Light ma jasny nagłówek i cień
herbu bez kwadratu. Karty121px, jaśniejsze zdjęcia, refleks, cienki złoty rant,
głębia datownika i kontrastowe tła badge. Bez zmian danych, filtrów i operacji.

[Analiza/iteracje](ui/PREMIUM32_VISUAL_REVIEW.md), [Dark](ui/premium32-home-dark.png),
[Light](ui/premium32-home-light.png), [header](ui/premium32-header-detail.png),
[logo Dark](ui/premium32-logo-preview-dark.png), [logo Light](ui/premium32-logo-preview-light.png).
Node weryfikuje alfa i narożniki, build demo sprawdza też dokładne bajty pochodnej.
87/87 Vitest i wszystkie kontrole web OK; urządzenia i prawdziwy Supabase nieweryfikowane.
Niżej historia. Nakaz3.1 zachowania tła oryginalnego PNG zastępuje osobna pochodna
z przezroczystością; same oryginały nadal pozostają bez zmian.

---

# UI Beta 3.1 — oficjalne logo i lista Mecze

B. Urban Club — Hiszpania: oryginalny slm-logo-header.png, proporcje290:280,
wyświetlenie92px; RGB bez przezroczystości. Nie wycinano tła. SVG tylko archiwum.
Nowe tła stadionu i tekstura pochodzą wyłącznie z dostarczonego zestawu.
Ciemny brand header także w Light; reszta Light zachowuje jasne powierzchnie.

Demo usuwa dominujący Następny mecz i CTA z listy. Tytuł Mecze i MatchFilters,
cztery zwarte klikalne karty121px z datownikiem, nazwą wyłącznie demo, lokalizacją,
godziną i badge miejsc. Na390x844 cztery karty mieszczą się przed footerem.
Nadchodzące4/Moje2/Historia1, powrót zachowuje filtr. Suwak i Auto/Light/Dark
nadal w zwijanych Narzędziach demo; szczegóły i nieaktywny przycisk zapisu pozostają.
Realna lista filtruje tylko istniejącą stronę i czas serwera; Historia obejmuje
rozpoczęte/odwołane. Moje jawnie nieaktywne bez danych o uczestnictwie na liście.
Istniejące CTA, blokada, rezygnacja, goście i uprawnienia bez zmian.
PWA:192/512 purpose any oraz favicon64. Android adaptive/maskable nieukończone.

[Analiza i porównanie](ui/PREMIUM31_VISUAL_REVIEW.md),
[Dark](ui/premium31-home-dark.png), [Light](ui/premium31-home-light.png),
[320px](ui/premium31-home-320.png), [768px](ui/premium31-home-768.png).
Lint/TypeScript/oba buildy i Vitest87/87 OK, Chromium320/390/768/motywy/filtry/CSP OK.
Nie jest to test urządzenia ani prawdziwego Supabase; szczegóły w STATUS.md.
Poniższe etapy historyczne:3.1 zastępuje nakazy używania starego herbu w UI.

---

# UI Beta 3.0 — Premium España

Nowe grafiki Premium rzeczywiście dostarczono i obejrzano. Pełna specyfikacja,
trzy cykle render/korekta i zestawienie referencja/render:
[PREMIUM_VISUAL_SPEC.md](ui/PREMIUM_VISUAL_SPEC.md).

MatchHero to wspólna fotograficzna karta z datownikiem, lokalizacją i czasem,
wersją kompaktową listy i większą fotografią szczegółów. Cały kafelek klikalny,
CTA pozostaje osobno. Prawdziwa lista używa dotychczasowego matches/open/RPC.
Uczestnicy są wizualnie podzieleni na zawodników, gości i rezerwę. Dostępne
kontakty i operacje pozostają zależne od dotychczasowych uprawnień.
Herb oryginalny, centralny; systemowe fonty bez sieci. Tokeny wyłącznie variables.css.
Składy: dekoracyjne boisko/koszulki i Planowane, bez nazw/algorytmu.

Izolowane demo:3 fikcyjne mecze, wybór odpowiada dacie i liczbie uczestników;
uczestnicy z fikcyjnymi imionami/inicjałami, rezerwa osobno. Żadnych telefonów,
kont, prawdziwych sald. Narzędzia i motywy nadal zwijane; Auto/Light/Dark bez zmian.
allowlista/env/CSP/zasoby bez rozszerzenia. Zasób herbu nadal sprawdzany bajtowo.
Vitest85/85; Chromium320/390/768 i izolacja OK, Cypress brak Xvfb.
Nie jest to deklaracja pełnej zgodności ani weryfikacji Androida/backendu.
Poniższe etapy są historyczne; ich stwierdzenia o braku obrazów lub osób w demo
zostały zastąpione niniejszym etapem. Nigdy nie dodawać fikcyjnych osób do aplikacji.

---

# UI Beta 2.3 — referencja i wybrany B

Oryginalny slm-crest-espana.svg z assets/branding zastępuje placeholder w obu
nagłówkach, bez edycji źródła. Dopasowano proporcje karty i fotografii po obejrzeniu
referencji oraz dwóch renderów390x844; szczegółowa analiza, pomiary i pozostałe
różnice: [BETA23_VISUAL_REVIEW.md](ui/BETA23_VISUAL_REVIEW.md).

Wspólny MatchTabs (używany przez MatchSections i DemoMatchDetails) implementuje B:
pojedynczy poziomy pasek z ikonami, domyślnie Uczestnicy. Roving tabindex i ARIA,
strzałki z zawijaniem/Home/End, tylko jeden widoczny panel. Panele pozostają
zamontowane, więc nie tracą formularzy i stanu; bez zmian operacji finansowych i RPC.
Na320px dozwolony lokalny scroll paska; dokument nie przewija się w poziomie.
Karta nadal natywnie klikalna, zapis jako osobne rodzeństwo.

Demo prowadzi kartą do #details-b, alias #details też działa. Porównanie A/B i stary A
są wyłącznie archiwalnym narzędziem. Narzędzia demo zwijane, z suwakiem0–15,
Light/Dark/Auto i opisem izolacji. Na głównym ekranie tylko subtelne Dane przykładowe.
Dane pozostają fikcyjne, finansów ani nazwisk nie dodano. Nie tworzymy brakujących funkcji.

SVG jawnie dołączony do dist-demo (publicDir nadal false). Weryfikator wymaga obecności
i dokładnej zgodności bajtów z oryginałem. CSP/env/allowlista modułów zachowane,
jedyny nowy dozwolony moduł źródłowy to MatchTabs; brak dostępu do backendu.

Finalne rendery390x844: [Home Dark](ui/beta23-home-dark.png),
[Home Light](ui/beta23-home-light.png), [Details Dark](ui/beta23-details-dark.png),
[Details Light](ui/beta23-details-light.png). Zachowano też pierwszą iterację Home.
Testy: lint/TypeScript/oba buildy, Vitest84/84 i Chromium320/390/768 OK;
Cypress brak Xvfb, Android/iOS niewykonane. Nie testowano prawdziwej bazy.
Duże chunki i braki weryfikacji backendu pozostają. Vercel bez ręcznego deploy;
status automatyczny niepotwierdzony (API GitHub Forbidden).

Poniżej historyczne etapy; decyzja B zastępuje wcześniejsze brak wyboru.

---

# UI Beta 2.2 — klikalna karta i porównanie A/B

Karta MatchHero ma opcjonalne onOpen/openDisabled. Natywny button jest na całej
powierzchni article, a treść (w tym dostępny progressbar) pozostaje jego rodzeństwem.
Przycisk zapisu znajduje się poza article. Brak zagnieżdżonych przycisków i ręcznego
udawania obsługi klawiszy; natywne Enter/Spacja, focus ring i hover. Events usuwa
osobny przycisk Szczegóły meczu, nadal używa istniejącego open/RPC i obsługi błędów.

Demo: kliknięcie karty prowadzi do porównania, nie wybiera docelowej wersji:
- `/#compare`: A i B jeden pod drugim, jasno opisane, działające przykłady.
- `/#details-a`: pełny widok sekcji przewijanych.
- `/#details-b`: pełny widok zakładek z jednym widocznym panelem.
Fragmenty URL nie wymagają rewrites ani importu routera pełnej aplikacji. Bezpieczna
lista widoków, obsługa hashchange/back/forward, ręczne otwarcie i reload. W podglądzie
pełnej aplikacji analogiczne fragmenty po /ui-demo. Powrót do meczów dostępny w każdym
widoku. Nie przeniesiono zakładek do rzeczywistego modułu wydarzeń.

DemoMatchDetails zawiera wyłącznie fikcyjny opis i licznik; Składy planowane,
Rozliczenie niedostępne, bez sald. Wariant B: tablist/tab/tabpanel, aria-selected,
aria-controls/labelledby, roving tabindex; strzałki z zawijaniem oraz Home/End.
Niewidoczne panele mają hidden. Identyfikatory unikalne także na stronie porównawczej.
Dokładnie ten sam opis wydarzenia i licznik w A i B. Wariant nie jest utrwalany jako
wybór docelowy. Realna aplikacja zachowuje istniejące sekcje i reguły biznesowe.

Dopracowano głębię bordo/grafitu, krawędź karty i kadr zdjęcia; ciepły Light zachowany.
Wszystkie kolory nadal w centralnych tokenach. Brak herbu: pozostaje slot, bez nowego logo.
Referencja dostępna i zapisana: [zatwierdzone trzy ekrany](ui/reference/approved-three-themes.jpg).
Korzystano z niej, bez deklarowania zgodności piksel w piksel; inne zdjęcie i brak herbu
nadal odróżniają render od grafiki. Referencja jest dokumentacją, nie zasobem bundle demo.

Zrzuty prawdziwego renderu React/Ionic, z dolną nawigacją:
[Home Dark](ui/beta22-home-dark.png), [Home Light](ui/beta22-home-light.png),
[Porównanie Dark](ui/beta22-compare-dark.png), [Porównanie Light](ui/beta22-compare-light.png),
[A Dark](ui/beta22-a-dark.png), [A Light](ui/beta22-a-light.png),
[B Dark](ui/beta22-b-dark.png), [B Light](ui/beta22-b-light.png).
Home390x844, porównanie390x2500, A390x2200, B390x1600; wyższe viewporty pozwalają
obejrzeć sekcje bez montażu obrazu. To rendery Chromium, nie test fizycznego telefonu.

Testy: lint/TypeScript/oba buildy OK, Vitest84/84 (14 plików), Chromium320/390/768
home/compare/A/B bez przewijania poziomego, natywna klawiatura i nawigacja zakładek,
tryby/live system/suwak oraz brak API/wywołań zewnętrznych/naruszeń CSP OK.
Cypress brak Xvfb, niewykonany; Android/iOS/prawdziwy backend niewykonane.
Duże chunki Ionic pozostają. Allowlista dodaje tylko DemoMatchDetails, nie Auth/App.

Automatyczny podgląd Vercel po push skonfigurowany zgodnie z informacją użytkownika;
nie uruchamiano ręcznej publikacji ani nie potwierdzano sukcesu wdrożenia.
Poniżej historia poprzednich etapów.

---

# UI Beta 2.1 — nawigacja i szczegóły meczu

Dolna nawigacja zawiera teraz trzy pozycje: Mecze, Zawodnicy, Profil. Składy nie
są ekranem globalnym. Nowy wspólny MatchSections porządkuje szczegóły wydarzenia:
Informacje, Uczestnicy, Składy, Rozliczenie. Przyciski sekcji nie udają zakładek:
wszystkie sekcje są widoczne, a przycisk przewija i ustawia dostępny fokus.

Istniejące operacje i formularze Events zachowane, tak samo role i API. Sekcja
Uczestnicy obejmuje zapisanych, rezerwę, gości i dozwolone operacje administratora.
Składy oznaczono Planowane. Rozliczenie administratora nadal pobiera prawdziwe dane
istniejącym mechanizmem; zawodnik otrzymuje wskazanie swoich Rozliczeń, bez cudzych
danych. Szczegóły mają własny tytuł, zamiast nazywania starszego meczu Następnym.

Odseparowane demo: przycisk Szczegóły meczu na karcie otwiera przykład tego eventu,
Wróć do meczów wraca na listę i przewija na początek. Nawigacja główna resetuje
widok szczegółów. Demo nie ma prawdziwych osób ani transakcji; wyłącznie licznik,
przykładowy termin i opisy planowanych funkcji. Light/Dark/Auto i suwak zachowane.
Do allowlisty dodano wyłącznie MatchSections, bez dostępu do App/Auth/Edge.

Weryfikacja: lint/TypeScript/buildy OK, Vitest82/82, Chromium home i szczegóły
320/390/768 bez przepełnienia, nawigacja/powrót, motywy, suwak, CSP/izolacja OK.
Cypress brak Xvfb, niewykonany; Android/iOS niewykonane. Nie testowano prawdziwego SQL.
Nowe rendery: [Home Dark](ui/beta21-home-dark.png), [Home Light](ui/beta21-home-light.png),
[Szczegóły Dark](ui/beta21-details-dark.png), [Szczegóły Light](ui/beta21-details-light.png).
Home390x844 obejmuje nawigację; szczegóły390x1280 przewinięto do czterech sekcji.

Nie wykonywano ręcznego wdrożenia. Status automatycznej publikacji niepotwierdzony
(API deploymentów GitHub: Forbidden); nie podajemy niezweryfikowanych adresów.
Poniżej historia poprzednich etapów.

---

# Aktualizacja UI Beta 2.0 — 17.10.2026

Dark ma bordowe tło, głębszą kartę, większą godzinę, czerwony przycisk z cieniem,
stonowane złote akcenty i aktywną nawigację. Light zachowuje ciepłą jasną paletę.
Wszystkie kolory są centralnymi tokenami CSS; komponenty są wspólne dla aplikacji i demo.

MatchHero przyjmuje opcjonalne imageSrc, domyślnie /images/match-evening.jpg.
Kadr CSS object-fit cover, object-position 60% 65%, stałe proporcje/obszar obrazu,
width/height i async decoding. Błąd ładowania przywraca istniejący stadium.svg bez
pętli ponowień. Zdjęcie dostarczone przez użytkownika (73 KB, 1280x785, bez EXIF),
bez pobierania zdjęć z sieci; nie przedstawiamy go jako potwierdzonej lokalizacji
Harcerska 1. Dekoracyjny obraz nie przekazuje istotnych danych meczu.

Nie znaleziono zatwierdzonego herbu SLM. Slot logo 64x48 i prosty napis są tymczasowe;
nie tworzono nowego herbu. Referencję trzech telefonów z wcześniejszego załącznika
ponownie obejrzano, lecz nie odtworzono dokładnie zdjęcia stadionu i herbu.

Naprawa Auto: utrzymanie subskrybowanego MediaQueryList przez cały czas aplikacji,
bez tworzenia kolejnych obiektów przy każdym odczycie. Początkowo test headless
wykrywał brak reakcji live; po poprawce końcowy przebieg przeszedł. Regresja w Vitest.

Zrzuty z prawdziwego renderu statycznego demo React/Ionic, bez przeróbek graficznych:
[Dark](ui/beta2-dark.png), [Light](ui/beta2-light.png),
[Dark rozszerzony](ui/beta2-dark-full.png), [Light rozszerzony](ui/beta2-light-full.png).
Podstawowe 390x844 obejmują footer; rozszerzone 390x1280 pokazują więcej kontrolek.

Lint/TypeScript/oba buildy OK, Vitest 81/81; Chromium 320/390/768, brak przewijania
poziomego, motywy/live system/suwak i obraz OK. Brak API i naruszeń CSP w demo.
Cypress: brak Xvfb, niewykonany. Android/iOS niewykonane. Duże chunki pozostają.
Nie zmieniono RPC, RLS, Edge, Auth, ledgera ani konfiguracji Firebase. Brak publikacji.
Dalsze informacje o granicy demo w DEMO_VERCEL.md; poprzednie etapy poniżej.

---

# UI Beta — España Light & Dark

17.10.2026, feat/ui-beta z origin/feat/integration 2026754. Referencję trzech ekranów
dostarczoną przez użytkownika obejrzano w rozmowie. Zrealizowano układ Hiszpania;
nie kopiowano herbów ani znaków federacji. Oryginalna dekoracyjna ilustracja
stadionu w public/images/stadium.svg nie udaje zdjęcia rzeczywistej lokalizacji.
Pobranie fotografii stockowej było niedostępne (HTTP 403); ilustrację można później
zastąpić zaakceptowanym, licencjonowanym zdjęciem. Nie użyto portretu zawodnika.

## Architektura motywów

- theme/variables.css: centralne tokeny España, jasna baza i nadpisanie klasy
  ion-palette-dark. Kolory Ionic, powierzchnie, inputy, toolbar, footer, overlay,
  alert/toast dziedziczą motyw. Usunięto wymuszone dark.always.
- ui/theme.ts: auto/light/dark, prefers-color-scheme, reakcja live na zmianę systemu,
  ręczna preferencja ma pierwszeństwo; localStorage slm.appearance zawiera tylko wygląd.
  Odmowa dostępu do storage zachowuje wybór w pamięci bieżącej aplikacji.
- index.html: mały bootstrap przed renderowaniem ogranicza miganie błędnego motywu.
- ui/AppearanceSettings.tsx: natychmiastowa zmiana w profilu. Synchronizacja kart okna.
- data-theme=espana jest punktem rozszerzenia dla zatwierdzonych w przyszłości rodzin
  Lime/Barcelona/Deimos/Gold; nie wprowadzono ich ani wyboru nieistniejących motywów.
- Obsłużono focus, etykiety, reduced-motion i możliwość powiększania strony.

## Mecze i nawigacja

MatchHero pokazuje dzień, czas i datę Europe/Warsaw, lokalizację i dekorację stadionu.
MatchCapacityProgress korzysta wyłącznie z registered_count i capacity z RPC:
backend liczy członków i gości; rezerwa nie zwiększa zajętości. Pasek ma opis,
minimum 10, stan pusty/minimum/komplet i dostępny progressbar. Bez obliczeń finansów.

Events wyszukuje najbliższy przyszły scheduled mecz; w razie wielu przyszłych
wydarzeń czyta dalsze istniejące strony RPC, aż do przeszłości/końca listy. Szczegóły
ustalają własny zapis. CTA korzysta z istniejących events_join/reserve/withdraw;
po operacji odświeża serwer. Pełny mecz proponuje rezerwę, zadłużenie blokuje nowy
zapis, ale nie rezygnację. Przed potwierdzeniem stanu finansów zapis pozostaje
nieaktywny. Nie wprowadzono reguły zamykania o 17:00. Serwer nadal rozstrzyga
uprawnienia, miejsca, czas i konflikty; interfejs nie gwarantuje skuteczności zapisu.

Logo SLM i dzwonek prowadzący do istniejącego centrum powiadomień. Dolna nawigacja:
Mecze, Zawodnicy, Składy, Profil; safe areas. Nie ma API katalogu graczy na bazowej
gałęzi: zakładka wskazuje listy uczestników meczów. Składy jawnie niedostępne.
Zachowano menu konta z rozliczeniami, panelem administratora i logout, poniżej treści.
Nie zmieniano mechanizmów sesji ani zabezpieczeń. Start po loginie prowadzi do meczów.

## Bezpieczny podgląd

/ui-demo jest osobnym ekranem statycznym, bez SessionManager/API, prawdziwych kont,
telefonów, tokenów i panelu admina. Dane: demonstracyjna lokalizacja, 12/15, jawny
komunikat DEMO; CTA nieaktywne. Nie zapisuje żadnych operacji biznesowych.

Cloud nie udostępnia narzędzia publikacji portu ani publicznego tunelu. Vite działa
lokalnie na 5174, HTTP /ui-demo=200, ale localhost/prywatny adres kontenera NIE jest
adresem do otwarcia z telefonu użytkownika. Niczego nie opublikowano.
Zrzuty obu motywów zapisano w docs/ui/espana-dark.png i espana-light.png.
Na komputerze: w app npm ci --ignore-scripts, npm run dev -- --host 0.0.0.0;
otworzyć na telefonie w tej samej zaufanej sieci adres LAN komputera /ui-demo.
Nie wystawiać całego serwera developerskiego publicznie. Ewentualna publikacja demo
wymaga osobnej zgody i odseparowania od produkcyjnej konfiguracji.

## Weryfikacja i granice

Wyniki bieżącej sesji w STATUS.md. Testy RPC UI używają atrap, nie Supabase.
Chromium headless sprawdza 320/390/768 px bez poziomego przepełnienia, ręczne tryby,
zmianę prefers-color-scheme bez restartu, progressbar i brak wywołań backendu w demo.
To nie pełny audyt WCAG ani test Androida. Cypress przygotowany, uruchomienie
zablokowane brakiem Xvfb (binarium Cypress 16.1.1 pobrano poprawnie).

Wieczorem: uruchomić pełny Cypress z Xvfb lub na komputerze; sprawdzić profil,
logout, panel admina, powiadomienia i CTA na atrapach. Testy Auth dostosowano do startu na meczach i przejścia do Profilu;
Cypress nie potwierdził jeszcze tych scenariuszy. Następnie Android: build i cap sync na komputerze,
jasny/ciemny/auto także po powrocie z tła, klawiatura, safe areas, status/navigation
bar, powiększenie tekstu, modale/alerty/toasty, ostatnie miejsce i blokada. Realne
zapisy wyłącznie na izolowanym backendzie testowym po odbiorze migracji.

Nie zmieniono migracji, RPC, RLS, ledgera/FIFO, Edge, Firebase ani magazynu sesji.
Sześć migracji integracji pozostaje niezastosowanych; rzeczywiste SQL/RLS/wyścigi,
Android/iOS/FCM niepotwierdzone. Historyczna blokada silnika Docker na Windows
pozostaje w dokumentacji integracji. W tej sesji nie uruchamiano bazy ani wdrożeń.

Powtarzalny smoke Chromium (Node z WebSocket): uruchomić Vite na 5174 oraz Chromium
--headless --no-sandbox --disable-dev-shm-usage --remote-debugging-port=9222
--user-data-dir=/tmp/slm-ui-chromium about:blank; następnie z app
node scripts/test-ui-beta-browser.mjs. Wyłącznie izolowany Cloud/lokalny profil,
port debug na loopback; bez publikacji. Zrzuty domyślnie w /tmp/slm-ui-preview.

## Samodzielny build do Vercel — 17.10.2026

`/ui-demo` w pełnej aplikacji nie jest granicą publikacji. Osobny `npm run build:demo`
buduje odrębne `demo/main.tsx` do `dist-demo`, bez App/Auth/Edge/Supabase.
Demo ma teraz suwak zajętości 0–15. Konfiguracja i wyniki: [DEMO_VERCEL.md](DEMO_VERCEL.md).
Brak wdrożenia. Nie publikować pełnego `dist`.

## Premium3.7 — katalog i profil zawodnika

Players jest wspólnym UI bez fetch/Auth: przyjmuje minimalne key/name, nie renderuje
key ani prywatnych pól. Inicjały zamiast niedostępnych portretów, brak jersey/ocen.
A–Z PL, wyszukiwanie z diakrytykami, empty/no-results/unavailable, profil i fokus
po powrocie. MatchHeader ma opcjonalny tytuł i etykietę powrotu, domyślne Mecze
pozostały identyczne. CSS wyłącznie .slm-player*; istniejące Mecze i Szczegóły
bajtowo niezmienione w porównawczych zrzutach. Dark/Light/Auto bez nowego systemu.
Demo ma8 jawnie fikcyjnych osób. Produkcyjny katalog wymaga osobnego minimalnego
kontraktu dla członka grupy; list_accounts admin-only nie jest takim kontraktem.
Aplikacja pokazuje niedostępność, nie używa admin API i nie symuluje listy.
Statystyki wymagają zweryfikowanych obecności zakończonych meczów, nie zapisów.
Nie ma nowych migracji/RPC, numerów koszulek/statystyk ani publikowanych kontaktów.
Analiza3 cykli i screenshoty: ui/PREMIUM37_VISUAL_REVIEW.md. Testy:92/92 Vitest,
Chromium320/390/768; nie są to realne testy Supabase/Androida.

## Premium3.8 — interaktywny świat demo

Nowe src/demo/data.ts jest jedynym źródłem fixture:20 osób/10 meczów, deterministyczny
snapshot18.10.2026. App.tsx ma wspólny reducer i stos widoków (źródła pozostają
zamontowane), Panels.tsx renderuje listy/składy/finanse, Profile.tsx jest jedynym
profilem demo ze statystykami i historią. Profile otwierane z nazw, nie całych wierszy
z niezależnymi akcjami. Powrót aplikacyjny zachowuje zakładkę/query/scroll/fokus,
także profil -> mecz z historii -> profil. Odświeżenie resetuje dane; brak trwałego
zapisu/deep linków profili i deklaracji obsługi systemowego Back.

Zapis/wypis/guest/rezerwa/claim i suwak zmieniają wspólne listy i liczniki.
Obecności w zakończonych meczach tworzą statystyki; koszt27000gr dzielony dokładnie
z deterministyczną resztą, płaci zapraszający gościa. Wpłata symulowana lokalnie,
blokada tylko przy2 zakończonych nieopłaconych meczach. Żadna z tych funkcji nie
jest implementacją produkcyjnego ledgera/FIFO ani uprawnień. Składy to podgląd
oparty na aktualnych uczestnikach, bez sportowego algorytmu i zapisów serwerowych.
Narzędzia:reset/scenariusz/user/0–15/motyw, zwinięte domyślnie. Poprzednie fixture
DemoMatchDetails i archiwalny przepływ porównania A/B zastąpione aktualnym demo.
Historyczne opisy braku symulowanych kwot/statystyk/aktywnych zapisów poniżej
zostały zastąpione tym etapem na wyraźne polecenie użytkownika; produkcja nietknięta.

TS/ESLint/oba buildy,98/98 Vitest i Chromium320/390/768, izolacja/CSP OK.
Zrzuty i opis: ui/PREMIUM38_DEMO_REVIEW.md. Nie są to testy Supabase/Androida.

## Premium3.9 — Ultimate Player Card i własny gość

Karta demo jest osobnym prezentacyjnym UltimatePlayerCard: własna tarcza CSS,
złota rama, stadion/bordo, duży portret, herb i nazwisko. Cztery fikcyjne portrety
w jednym WebP są stałe dla20 osób; bez danych/zdjęć realnych użytkowników.
Photo prop obsługuje także pojedynczy src z contain i fallback inicjałów. Nie ma
uploadu, oceny ani numeru koszulki zmyślonego dla danych. Krótki licznik meczów
pochodzi z istniejących obecności, historia poprzedniego etapu jest zwinięta.
Nie tworzono nowego panelu statystyk/rankingów. Przyszłe gwiazdki8->5,5->2.5
pozostają planem, bez kodu systemu ocen w tej iteracji.

Nowa referencja Ultimate niedostępna: projekt według opisu, bez deklaracji
obejrzenia/odtworzenia brakującej grafiki. Po otrzymaniu zachować oryginał
w ui/reference/. Portrety wygenerowane nie są tą referencją. Źródła/3 cykle:
ui/PREMIUM39_VISUAL_REVIEW.md. Screenshoty premium39-* to prawdziwy Chromium.

Kosz przy własnym gościu -> IonAlert -> konkretny wpis withdrawn. Właściciel
sprawdzany w reducerze, powtórzenie no-op, profil i rezerwa zachowane, brak promocji.
Także profilowany gość nie może wycofać zaproszenia innej osoby głównym CTA.
Wcześniejsze symulowane wpłaty zostają w sumie zebranej i są jawnie pokazane;
nie jest to produkcyjna alokacja kredytu/FIFO. Zmiany wyłącznie demo.
104/104 Vitest, TS/lint/oba buildy i Chromium320/390/768/CSP OK. Izolacja15 plików;
nowy WebP jawnie dołączony i porównywany bajtowo, brak poluzowania sieci/backendu.

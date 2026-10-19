# Premium 3.17 — palety, prywatność kart i polski termin

Baza `0e83425b57dec2bd5b4e16f96a45a74bbf877280`, zawiera implementację3.16
`15d91a817b5c17eb23143c30683832f94a8d191a`. Początkowy Git czysty;
fetch origin/feat/ui-beta zgodny z HEAD. Wyłącznie izolowane demo, bez nowych
zależności, obrazów brandingowych, backendu i zmian app/vercel.json.

## Jeden system kolorów

Nie ma kopii ekranów ani arkusza na każdy ekran/motyw. Istniejące `theme.ts`,
`AppearanceSettings` i `variables.css` rozszerzono o rejestr tokenów w jednym
`src/demo/palettes.css`. España korzysta z dotychczasowych wartości. Selektory
`:root[data-theme=...]:not(.ion-palette-dark)` i `.ion-palette-dark` zmieniają
wyłącznie wartości. Auto korzysta z tych samych dwóch zestawów, bez duplikacji.

| Rola semantyczna | Istniejący token |
| --- | --- |
| Tło / tekst | --ion-background-color / --ion-text-color (+rgb) |
| Powierzchnia / podniesiona | --slm-panel / --slm-card-top |
| Tekst pomocniczy | --slm-text-secondary |
| Primary / kontrast | --ion-color-primary / --ion-color-primary-contrast |
| Akcent / wypełnienie | --slm-gold / --slm-fill (historyczna nazwa gold oznacza teraz akcent) |
| Obramowania | --slm-border, --slm-card-rim, --slm-photo-line |
| Gradienty / podświetlenie | --slm-button-top/bottom, --slm-active-top/bottom, --slm-header-glow |
| Statusy semantyczne | istniejące danger i count-ready/low/empty; czytelne etykiety nie zależą od palety |

Ionic toolbar/item/card/tab-bar/overlay/placeholder korzystają z istniejących
powiązań z tymi tokenami; primary ma odpowiednie rgb/contrast/shade/tint.
Nawigacja, plus, formularze, grupy, otoczenie profilu, zakładki i rozliczenia
zmieniają kolory bez zmiany logiki. Oficjalny herb, stadionowe fotografie,
zaakceptowana karta Ultimate (bordo/złoto) i naturalne boisko/znaczniki pozostają
stałą identyfikacją graficzną, bez przebudowy. Nie kopiowano chronionych znaków FCB.

## Dokładne wartości bazowe

| Paleta / tryb | Tło | Surface | Raised | Tekst | Muted | Primary | Akcent | Fill |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| España Light | #F7F5F0 | #FFFFFF | #FFFFFF | #20242A | #62636A | #B72C38 | #866315 | #C59A39 |
| España Dark | #0B0C10 | #17191D | #222126 | #F5F5F5 | #BBB9C0 | #B72C38 | #E5C460 | #D4AF37 |
| FCB Light | #F4F5FA | #FFFFFF | #EBEFF8 | #18243B | #526078 | #173B83 | #71520E | #E8BE62 |
| FCB Dark | #080F22 | #101B37 | #172849 | #F5F7FF | #B7C5DF | #173B83 | #E8BE62 | #E8BE62 |
| Classic Lime Light | #F4F8EF | #FFFFFF | #EAF1E2 | #172A27 | #4E6356 | #30643A | #426516 | #77A32B |
| Classic Lime Dark | #172A27 | #28463D | #315347 | #F2FBEA | #C0D3C3 | #30643A | #B9F254 | #B9F254 |
| Deimos-Code Light | #F7F3FC | #FFFFFF | #EEE7F8 | #241A32 | #65576F | #7142BD | #65409A | #7142BD |
| Deimos-Code Dark | #121212 | #1E1E1E | #2A2235 | #FFFFFF | #C7BBD7 | #7142BD | #B58AFF | #9D6BFF |

Kontrast primary: #FFFFFF dla wszystkich. Dodatkowe barwy: FCB bordo #9C173B,
ciemny granat #101B37; Lime głębia #172A27 i jasny brzeg #D8FAA0; Deimos #C534DF
w subtelnej poświacie, #53308C w głębi plusa/datownika, #7B44D4 w separatorach.
Wariant jasny ma ciemniejszy akcent tekstowy dla czytelności. Dla nowych palet
button-bottom = color-mix(primary82%,black), tint/shade=85%primary+15%white/black;
pozostałe alfy i szczegółowe odcienie są jawnie zapisane w rejestrze CSS.

España nie została przeprojektowana. Zachowano jej teksturę, kartę121px,
typografię, zdjęcia, układ i nawigację/plus56px/20px. Jedyna korekta starego
koloru to najjaśniejszy stop gradientu CTA Dark #F01937→#E71835: kontrast
białego małego tekstu wzrósł4,29→4,59:1. Dolny stop #C50025 i primary #B72C38
bez zmian. Pozostałe palety mają cichy gradient zgodny z ich kolorem zamiast
nieodpowiedniej, narzuconej bordowej tekstury España; fotografii nie zmieniono.

### Potwierdzenie Deimos-Code

Odczytano WYŁĄCZNIE trzy wskazane pliki CSS `psuda87/code-finder` w commicie
`a13f389d6d477afbb6fc34aeb0ee9c49847a3ade`, bez checkoutu kodu do SLM:

- app/src/index.css: #121212, #1E1E1E, #7142BD, #FFFFFF (także odcienie633AA6/7F55C4).
- app/src/App.css: #121212, #1E1E1E, #9D6BFF, #FFFFFF.
- app/src/component/LogoHeader.css: #C534DF, #53308C, #7142BD, #7B44D4.

Do SLM wprowadzono tylko nieszkodliwe wartości kolorystyczne; żadnego kodu,
danych ani logotypu Code-Finder. To właściwe repo, nie generator deimos_code_cards.

## Wybór, Auto i trwałość

Profil→Ustawienia: osobne „Motyw kolorystyczny” (4 opcje z próbkami) i „Wygląd”
(Automatyczny/Jasny/Ciemny). Dostępne też w zwijanych Narzędziach demo.
`slm.palette` zapisuje espana/fcb/lime/deimos, istniejące `slm.appearance`
auto/light/dark. Są to wyłącznie nieosobowe preferencje przeglądarki. Nie
modyfikują World/GroupState ani danych wydarzeń. Reset fixture ich nie usuwa.
W razie blokady storage obie opcje zachowują spójny wybór w pamięci tej strony;
nie gwarantujemy trwałości po odświeżeniu przy niedostępnym localStorage.

`initializeTheme({palettes:true})` działa w demo przed mount React. Produkcja
używa dotychczasowego initializeTheme() bez opt-in, pozostając przy España;
nie aktywuje zapisanej palety demo. Ręczny tryb jasności ma pierwszeństwo;
Auto nasłuchuje prefers-color-scheme bez restartu. Storage event synchronizuje
karty tej samej przeglądarki, a ustawienia profilu i narzędzi współdzielą wybór.
Nie tworzono nowej tabeli ani mechanizmu sesji/Auth.

## Prywatność na karcie

Opcjonalny prezentacyjny slot badge w MatchHero. Demo EventPrivacy wstawia
Ionic lockClosedOutline+„Prywatne” albo lockOpenOutline+„Publiczne”. Badge
jest wewnątrz article, prawy górny róg, półprzezroczyste ciemne tło i mały
czytelny tekst. Brak emoji, zagnieżdżonych przycisków i przechwytywania kliknięć.
Nazwy pozostają bez zmian; stara etykieta nad kartą została usunięta, nad kartą
pozostaje tylko nazwa grupy. Także karta locked, ograniczony własny udział i
podgląd używają tego komponentu. Karty listy nadal121px, bez kolizji z nazwą,
godziną czy licznikiem przy320/390/768. Korekta paddingów nie zmienia fontów.

Nie zmieniono visibility ani reguł eventAccess/groupCanOrganize. Publiczny
zapis nie dodaje członkostwa, a zmiana palety nie otwiera prywatnego meczu.
Modele grup/własności/finansów/uczestnictwa z3.16 pozostają bez zmian.

## Polska data i godzina

Nie jest to zmiana samego lang. Formularze tworzenia i edycji mają kontrolowane
inputy tekstowe DD.MM.RRRR i HH:mm z inputMode=numeric. Można wpisać20102026
oraz1800; widoczny tekst ma separatory20.10.2026 i18:00. Podpowiedzi dostępne
przez aria-describedby. Wklejenie prawidłowo sformatowanego terminu także działa.
Nie ma natywnych date/time ani zależnego od en-US wyboru AM/PM.

parseEventDate konwertuje polski zapis na dotychczasowe ISO date, a eventInstant
nadal rozstrzyga Warsaw/DST (w tym luki/niejednoznaczne godziny). Przeszłość
nadal odrzuca istniejące validateEvent.
Przechowywany startsAt pozostaje ISO UTC. Podgląd i panele informacji używają
pl-PL z day/month2-digit, year numeric, hourCycle h23 i Europe/Warsaw.
Datownik kart zachowuje zaakceptowany polski skrót miesiąca; czas jest24h.

W Chromium wymuszono en-US i America/New_York: widoczne pola20.10.2026/18:00,
podgląd i ponowna edycja zachowały18:00 w Warszawie. To rzeczywisty render,
nie deklaracja na podstawie samego lang. Natywne klawiatury Android/iOS jeszcze
nie zostały sprawdzone na urządzeniu.

## Weryfikacja STANDARD

- npx tsc --noEmit: OK.
- ESLint zmienionych plików TS/TSX oraz konfiguracji demo: OK.
- node --check nowych/dostosowanych skryptów MJS: OK.
- npm run build:demo: OK, ścisła allowlista rozszerzona tylko o palettes.css;
  weryfikator15 statycznych plików bez App/Auth/Supabase/Edge/sekretów: OK.
  Bez zmian CSP/vercel.json/zmiennych środowiskowych/zależności.
- Pełny Vitest na pierwszym gotowym zakresie:173/173,29 plików.
  Po końcowym maskowaniu cyfr/podglądzie/fallbacku storage uruchomiono tylko
 5 odpowiednich plików:32/32 (łącznie174 różne przypadki; nie deklarujemy
  jednego pełnego uruchomienia174/174 po ostatniej zmianie).
- Testy palet:12 kombinacji, niezależność, storage/restore, Auto live, fallback
  invalid/blocked, synchronizacja ustawień i opt-in wyłącznie demo.
- Daty: polskie formatowanie, lato/zima, niepoprawny kalendarz/past/DST,
  odrzucenie AM/PM, kontrolowany formularz i niezmieniony zapis ISO, cyfry telefonu.
- `scripts/test-demo-themes-browser.mjs`:12 kombinacji, przełączenie systemu
  w Auto, trwałość po reload i resecie, po jednym badge wewnątrz kart z ikonami,
  brak kolizji/duplikatów/overflow,121px i320/390/768; formularz/podgląd/edycja,
  wybrane grupy, profil i finanse, zapis i zachowanie jego stanu po zmianie palety,
  brak plusa/uprawnień/dostępu prywatnego dla outsidera także po zmianie palety.
- Dodatkowy krótki focus Chromium na finalnym buildzie: modal Deimos miał
  tło rgb(30,30,30) i tekst rgb(255,255,255); widoczny2px focus klawiatury;
  wejście samymi cyframi dało polski termin, podgląd zawierał termin i kłódkę.
- Żadne żądanie zewnętrzne ani błąd CSP nie wystąpiły.

Kontrola kontrastu wybranych par w rzeczywistych computed styles:

| Paleta / tryb | Tekst/tło | Muted/surface | Primary | Najjaśniejszy CTA | Akcent/surface |
| --- | --- | --- | --- | --- | --- |
| espana dark | 17.93:1 | 9.06:1 | 6.12:1 | 4.59:1 | 10.39:1 |
| espana light | 14.31:1 | 5.98:1 | 6.12:1 | 5.70:1 | 5.51:1 |
| fcb dark | 17.82:1 | 9.78:1 | 10.55:1 | 10.55:1 | 9.70:1 |
| fcb light | 14.24:1 | 6.36:1 | 10.55:1 | 10.55:1 | 7.20:1 |
| lime dark | 14.15:1 | 6.56:1 | 6.98:1 | 6.98:1 | 7.81:1 |
| lime light | 13.97:1 | 6.48:1 | 6.98:1 | 6.98:1 | 6.76:1 |
| deimos dark | 18.73:1 | 9.14:1 | 6.53:1 | 6.53:1 | 6.39:1 |
| deimos light | 15.12:1 | 6.67:1 | 6.53:1 | 6.53:1 | 7.63:1 |

Pary tekstowe mają≥4,5:1. To reprezentatywne kontrole tokenów i wybranych
stanów, nie pełny audyt WCAG wszystkich pikseli fotografii/każdego disabled,
hover i nakładki w12 wariantach. Sprawdzono keyboard focus i stan zablokowanego
dostępu, czytelność błędów nadal pokrywają testy formularza. Nie wykonywano
pełnej starej regresji Chromium/Cypress, produkcyjnego builda, Android/iOS,
natywnej klawiatury ani nowego audytu zależności. Znane ostrzeżenie dużego chunka
Ionic >500kB pozostaje. Brak migracji, zmian backendu/finansów i ręcznego deploy;
automatycznego podglądu Vercel nie weryfikowano. Historyczne ograniczenia Dockera
zachowano w STATUS. Zakończono3.17, bez rozpoczęcia następnego etapu.

## Rzeczywiste zrzuty React/Ionic

- [espana-dark](premium317-espana-dark.png)
- [espana-light](premium317-espana-light.png)
- [fcb-dark](premium317-fcb-dark.png)
- [fcb-light](premium317-fcb-light.png)
- [lime-dark](premium317-lime-dark.png)
- [lime-light](premium317-lime-light.png)
- [deimos-dark](premium317-deimos-dark.png)
- [deimos-light](premium317-deimos-light.png)
- [theme-settings](premium317-theme-settings.png)
- [match-privacy-badges](premium317-match-privacy-badges.png)
- [polish-date-time](premium317-polish-date-time.png)

Raport, lista plików i SHA: [ODPOWIEDZI_CODEX.txt](../ODPOWIEDZI_CODEX.txt).

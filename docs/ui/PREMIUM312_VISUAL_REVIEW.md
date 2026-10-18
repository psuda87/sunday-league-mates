# Premium España3.12 — Premium Finance UI

## Zakres i materiały

Przeczytano instrukcje i ostatni raport; rzeczywiście otwarto premium38-settlement,
premium311-teams-dark, premium310-player-card-dark i premium36-details-dark.
Stary pionowy dl i listę zastąpił src/demo/Finance.tsx. Pozostałe panele nie
zostały przebudowane. Bez zasobów z internetu/generowania obrazów, bez zależności.
Demo nadal ściśle odseparowane od produkcyjnej aplikacji/API/Auth/Supabase/Edge.

## Układ i wspólny model

Cztery kafelki2×2: koszt meczu, udział, wpłacono, pozostało; ikonki Ionic,
centralne CSS tokeny, subtelny bordowy gradient, złote kwoty/cień/obramowanie.
Pasek ma nazwę dostępną, procent i sumy, aria-valuemin/max/now/text, szerokość
max100%. Nadpłata osobno; pozostało nigdy ujemne. Na osobę pokazuje przedział,
gdy deterministyczny podział groszy daje różne udziały. Żadne liczby przykładowe
nie są wpisane do JSX — kwoty z Entry.paidCents, charges i demoFinance.

20 istniejących osób/10 meczów bez drugiego zestawu danych. Pierwszy mecz
ma jawnie przypisane wpłaty gr2250/1000/0/2250/0/0/0/0/0/0/900/0 =6400gr,
koszt27000gr/12 aktywnych udziałów =2250gr/osobę. Admin:64zł/270zł→24%
(po zaokrągleniu procentu). Kamil(p02) odpowiada za siebie i2 gości:
6750gr udziałów/3150gr wpłat/3600gr pozostało→47%. To jawne dane fikcyjne.
Zakończone mecze zachowują wcześniejsze fixture; model nie tworzy nowych
produkcyjnych naliczeń, księgowania lub przelewów.

Każda pozycja ma inicjały, pełną nazwę (zawijanie bez obcinania), należne/wpłacone
i opisany status Opłacono/Częściowo/Do zapłaty/Nadpłata z symbolem i kolorem.
Osoba z playerId otwiera tę samą kartę3.10; gość bez konta ma tekst, nie link.
Wiersz nie przechwytuje kliknięć swoich niezależnych kontrolek.

## Zakres widoczności

Zgodnie z docs/SETTLEMENTS_MODULE.md zwykły zawodnik widzi własne zobowiązania,
pełny snapshot finansowy należy do administratora. W demo financeRole domyślnie
player; demoFinance filtruje po właścicielu entry.inviterId??entry.playerId.
Zawodnik widzi także własne wpisy za zaproszonych gości, nie cudze salda/wpłaty.
Nie renderujemy cudzych wierszy/formularzy. Koszt/udział wynika z publicznych
informacji wydarzenia. Wpłacono/Pozostało mają dopisek Twoje, a postęp dotyczy
sumy własnych udziałów, nie całego meczu. Bez pozycji własnych: czytelny pusty
stan i0%, bez podsuwania cudzych danych. Admin demo ma całą listę i podsumowanie
całego meczu. Zmiana symulowanej osoby i reset wyłączają tryb administratora.

To NIE jest prawdziwe zabezpieczenie ani RLS. Całe fixture istnieje w pamięci
przeglądarki, a przycisk Administrator demo celowo umożliwia testowanie roli.
Nie używać tego mechanizmu do prawdziwych danych. Auth/role produkcyjne nietknięte.

## Interakcje

Tylko admin demo: zwijane menu Zmień wpłatę z pełną kwotą udziału,0 lub własną
kwotą. Edytor inline z label, inputMode decimal, błędem aria-invalid/describedby,
Zapisz/Anuluj i44px hit. Własna kwota przyjmuje przecinek lub kropkę, maksymalnie
2 miejsca po przecinku,0–1000000zł. Parser tworzy całkowite grosze przez
rozdzielenie części dziesiętnej, bez mnożenia floatowej kwoty. Reducer sprawdza
rolę, aktywny udział, nieanulowany mecz, safe integer i zakres. Powtórzone
ustawienie kwoty nie podwaja wpłaty; to zmiana łącznej wartości, nie przelew.

Wspólny world zachowuje płatność podczas powrotów/mecze/profile, odświeża sumy,
statusy, procent i istniejące symulowane blokady. Reset odtwarza początkowe dane.
Usunięta pozycja nie usuwa wpłaty: wpłaty poza aktywnymi udziałami są widoczne
oddzielnie dla właściciela/admina i wliczane w sumę. Nie są automatycznie
alokowane do innych pozycji; status wiersza dotyczy wpłaty przypisanej do niego.
To nie ledger/FIFO produkcji. Rezerwa nie ma należności i nie jest promowana.

## Trzy cykle rzeczywistych renderów

1. Ogląd390 Dark/320: wszystkie4 kwoty i3 własne pozycje czytelne, panel wyraźnie
   niższy od starego dl. Pierwszy TypeScript wykrył zawężenie typu akcji;
   poprawiono warunek rozróżniający payment_set, bez osłabiania typów.
2. Dodano dyskretne obramowane statusy i lokalny bordowy refleks kafelków.
   Obejrzano Light/320; etykiety i kwoty czytelne. Pełny Chromium sprawdził
   częściowe/0/100%/nadpłatę, widoczność roli, reset i stare scenariusze.
3. Dopracowano fokus klawiatury i ramkę edytora inline. Ponowny render oraz
   kontrole2×2,44px touch i braku overflow kwot/nazw. Rozszerzono sprawdzanie
   retained wpłaty gościa i jej ukrycia po zmianie właściciela.

## Zrzuty rzeczywistego React/Ionic Chromium

- [Dark](premium312-settlement-dark.png)
- [Light](premium312-settlement-light.png)
- [Administrator demo](premium312-settlement-admin.png)
- [Wpłata częściowa](premium312-settlement-partial.png)
- [320px](premium312-settlement-320.png)

## Ograniczenia

Wyłącznie fikcyjna symulacja, brak zatwierdzania przelewów lub banków, uploadu,
Auth/API/połączenia z prawdziwym systemem. Brak persistencji. Wpłaty zachowane
po wycofaniu nie są alokowane FIFO. Statusy udziałów są indywidualne, sumy
ogólne mogą zawierać nieprzypisane retained kwoty i nadpłatę. Android/iOS/
klawiatura natywna/realny Supabase nieweryfikowane. Bez deklaracji produkcji.

## Wyniki końcowe

ESLint/TypeScript/build aplikacji/build demo OK; Vitest116/116 w20 plikach.
Testy modelu/UI: widoczność własnych3 pozycji i2 gości, brak cudzych danych,
role/guard reducera, reset/zmiana osoby, kwoty gr i parser, sumy, częściowe/0/
pełne/nadpłaty, clamp100%, retained i jego prywatność, powtarzalne ustawienia.
Chromium320x844/390x844/768: siatka2×2, kwoty bez overflow,44px kontrole,
widoczność profili/role/0→100%/nadpłata, nieprawidłowe kwoty, częściowa11,25,
powrót do Rozliczenia i zachowanie danych, reset fixture, goście/składy/numery/
zapisy/rezerwa/blokada oraz Light/Dark/Auto/CSP OK. Brak regresji tych scenariuszy.
Nowy moduł tylko w jawnej allowliście, output15 plików/6 istniejących zasobów;
kontrola izolacji bez Auth/Supabase/Edge/API i obcych żądań. Bez nowych zależności.
To testy demo i istniejące atrapy API aplikacji, nie prawdziwy Supabase.
SHA256 home Dark/Light, details Dark, participants Dark, karta Dark/Light oraz
Składy Dark/Light — bajtowo identyczne z poprzednim etapem3.11.
Cypress nie uruchomiono (brak Xvfb); Android/iOS i prawdziwy backend nieweryfikowane.
Duże chunki Ionic nadal. Bez backendu/produkcji/Auth/RPC/RLS/migracji/Firebase/
vercel.json/merge/ręcznego deploy. Automatyczny podgląd Vercel niezweryfikowany.

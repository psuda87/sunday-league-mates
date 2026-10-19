# Premium España 3.16 — wydarzenia grupowe w izolowanym demo

Baza `3a3a69b6148dfa9e81850f33dee4f7571801cde1`, zawiera implementację3.15
`2c9b2e536312e16b41b9ca915497a081700ee07f` i korektę menu `e72a36a`.
Przed pracą czysty Git; pobrane origin/feat/ui-beta miało ten sam HEAD.
Bez nowego backendu, zależności, tabel, API, sekretów i zmian vercel.json.

## Jeden model i prawa organizatora

`Game` posiada obowiązkowe groupId, createdBy i visibility private/public.
`EventInput` nie pozwala edytować createdBy. Reducer zapisuje wyłącznie jawnie
wymienione pola wejściowe: próba wstrzyknięcia wpisów lub właściciela jest ignorowana.
Nowy mecz zawsze wskazuje istniejącą grupę i twórcę world.userId; klucz tworzenia
chroni przed powtórnym zatwierdzeniem. Reset przywraca fixture i usuwa nowe mecze.
Grupa raz utworzonego wydarzenia nie jest przenoszona w edycji.

`organizingGroups` korzysta z istniejącego `groupCanOrganize` i aktualnego
GroupState: admin grupy albo członek organizer=true. Zero grup: brak plusa/formularza;
jedna: wybór automatyczny; kilka: jawny wybór. Nie ma eventRole, event_role ani
przełącznika globalnych uprawnień wydarzeń. Plus zachowuje56px/20px, notch, safe
area i menu Mecze/Grupy/Profil. Zmiana członkostwa/uprawnień aktualizuje UI od razu.

Formularz i reducer ponownie sprawdzają wybraną grupę przy zapisie. Zachowanie
innej dozwolonej grupy nie umożliwia zapisania podglądu dla odebranej grupy.
`canEditEvent`: tylko createdBy==userId, aktualne członkostwo właściwej grupy
oraz status upcoming. Admin nie edytuje cudzych meczów. Odebranie organizer
nie odbiera właścicielowi-członkowi edycji istniejącego meczu, lecz blokuje nowe.
Wyjście/usunięcie z grupy blokuje edycję również właścicielowi, bez transferu
createdBy ani usuwania historii. Jeśli znika pusta grupa zgodnie z3.15, mecze
pozostają z jej identyfikatorem i etykietą „Grupa archiwalna”; brak członkostwa
nie pozwala nimi zarządzać. Publiczne pozostają publiczne, prywatne zachowują
jedynie potrzebny dostęp istniejących uczestników. Bez automatycznej sukcesji
właściciela wydarzenia przy sukcesji administratora grupy.

## Widoczność i własny udział

| Kontekst użytkownika | Lista | Szczegóły / akcje |
| --- | --- | --- |
| Członek właściwej grupy | Pełna karta, grupa, widoczność, licznik | Dotychczasowe panele/zasady udziału |
| Outsider, public | Pełna karta | Udział/goście/rezerwa według istniejących reguł, bez członkostwa w grupie |
| Outsider, private, brak udziału | Nazwa, termin, grupa, „Prywatne”, opis ograniczenia | Brak przycisku otwarcia; bez uczestników/licznika/składów/profili/rozliczeń |
| Outsider, private, zachowany udział | Karta organizacyjna własnego meczu | Tylko własny udział, miejsce/adres/termin/czas i własne pozycje finansowe |

`eventAccess` zwraca full/own/none. own oznacza istniejący zapis/rezerwę, własnego
gościa albo zachowaną wpłatę powiązaną z użytkownikiem. Nigdy nie daje pełnego
rosteru, składów ani profili innych uczestników. Własny profil nadal dostępny.
W tym widoku można wycofać własny zapis/usunąć własnego gościa z potwierdzeniem.
Zachowana rezerwa może ręcznie zająć wolne miejsce z tego samego wpisu, z ponowną
kontrolą miejsca i dotychczasowej blokady zaległości. Nie powstaje nowy zapis,
nie ma automatycznej promocji. Nowe osoby/goście wymagają full. Po wycofaniu
wszystkich własnych aktywnych wpisów bez zachowanych wpłat dostęp wygasa.
Wpłata po wycofaniu pozostaje własną historią finansową, a nie nowym prawem zapisu.

Private→public→private zmienia wyłącznie metadane. entries, paidCents, lineup,
attendance i stany rezerwy nie są usuwane. Nie ma zapisu do GroupState przy
zapisie publicznym. Zapisany outsider nie uzyskuje listy grupy ani dostępu do
innych prywatnych wydarzeń tej grupy. Podstawowa karta locked nie otrzymuje
MatchHero z ukrytymi licznikami; ograniczone dane rzeczywiście nie są renderowane.
Także narzędzia demo nie ujawniają suwaka/licznika niedostępnego meczu.

Każda operacja gry przechodzi przez access guard w reduceWorld przed istniejącą
logiką. Panele/boisko/finanse mają również własne guards, a profile zachowują
kontekst gameId/groupId i sprawdzają go ponownie przy zmianie użytkownika.
Bezpośrednia nawigacja/formularz nie omijają kontroli. Są to kontrole modelu
fikcyjnego RAM, a NIE zabezpieczenia produkcyjne: cały fixture jest częścią demo.

Finanse: nie zmieniono charges, groszy, wpłat, FIFO ani blokady dwóch zaległych
zakończonych meczów. Rozszerzono wyłącznie projekcję uprawnień: finansowy admin
demo działa dla członków właściwej grupy; publiczny/retained outsider nawet po
akcji finance_role=admin widzi tylko swoje pozycje, nie może zmieniać wpłat.

## Deterministyczne przypisanie dotychczasowych meczów

| Mecze | Grupa / twórca | Widoczność |
| --- | --- | --- |
| demo-1,3,5,7,9 | group-1 / p01 | private |
| demo-2 | group-2 / p02 | public |
| demo-6,8,10 | group-2 / p02 | private |
| demo-4 | group-3 / p03 | public |

Żaden wpis uczestnictwa, gość, rezerwa, wpłata, skład ani obecność nie został
zmieniony przez to przypisanie. Są to wyłącznie fikcyjne dane dotychczasowego demo.

## Weryfikacja STANDARD

- TypeScript: npx tsc --noEmit OK.
- ESLint jawnie zmienionych plików TS/TSX i vite.demo.config.ts OK.
- npm run build:demo OK: ścisła allowlista modułów, weryfikacja15 statycznych
  plików/oryginalnych zasobów, brak Auth/Supabase/Edge/sekretów. Dopisano tylko3
  konkretne pliki demo do allowlisty; nie poluzowano reguł ani CSP/vercel.json.
- Vitest164/164,27 plików; po dodaniu końcowego scenariusza cofniętej wybranej
  grupy uruchomiono wyłącznie EventForm.test.tsx:7/7. Nie powtarzano całej regresji
  dla zmiany samego testu (łącznie165 różnych przypadków sprawdzonych).
- Nowy eventAccess.test: fixture, per-group create/revoke, creator edit/leave,
  transfer bez zmiany własności, deny wszystkich akcji outsidera, public join i
  guest bez członkostwa, reclose bez utraty danych, own finance, zachowana rezerwa,
  usuwanie gościa bez promocji, idempotencja, whitelist payload, pusta grupa/reset.
- EventForm + EventAccessView: selektor wielu/jednej/zero grup, private default,
  recheck podglądu po cofnięciu wybranej grupy pomimo innych praw, prywatny DOM,
  standalone guards, ograniczona własna projekcja i brak finansowego admina.
- node scripts/test-demo-event-groups-browser.mjs: rzeczywisty Chromium/CDP,
  320/390/768, publiczny zapis i gość bez członkostwa, private/public/reclose,
  outsider locked, bezpośredni formularz odrzucony, organizator z wyborem grupy,
  brak edycji admina-nietwórcy, reset, motywy i brak poziomego przewijania.
  Powrót Ultimate→Składy i ograniczony własny profil→udział; otwarta karta
  innej osoby znika po zmianie użytkownika bez dostępu. Ręczne zajęcie miejsca
  z zachowanej rezerwy po zamknięciu również przeszło w Chromium.
  Krótki smoke grup, zapisów/gości, boiska i projekcji rozliczenia; brak żądań
  zewnętrznych i błędów CSP. Plus nadal56px/20px w3 szerokościach.
- Pierwszy przegląd prawdziwych renderów: czytelne badge grupy/widoczności,
  brak zmiany kart i notch; selektory44px, locked bez metadanych uczestników.
  Powtórzono tylko potrzebne kontrole po dopracowaniu dostępu własnej rezerwy.

Historyczne skrypty grup i formularza dostosowano do uprawnień grupowych;
ich pełnych scenariuszy nie uruchamiano w3.16. Nowy skrypt STANDARD przeszedł.

Nie wykonano produkcyjnego builda, pełnej dawnej regresji Chromium, Cypress,
Androida/iOS, natywnej klawiatury/safe areas. Ostrzeżenie dużego chunka Ionic
>500kB pozostaje. To demo bez serwera; rzeczywiste RLS/atomowość/wyścigi/autoryzacja
pozostają osobnym etapem integracji. Historyczne blokady Dockera/Supabase z STATUS
zachowane. Nie wykonano migracji, merge ani ręcznego deploy. Automatycznego
podglądu Vercel nie zweryfikowano. Zakończono3.16, bez rozpoczęcia kolejnego etapu.

## Rzeczywiste zrzuty React/Ionic

- [Lista meczów](premium316-match-list.png)
- [Grupa w formularzu](premium316-create-group-select.png)
- [Prywatny mecz — członek](premium316-private-match.png)
- [Publiczny mecz — outsider po zapisie](premium316-public-match.png)
- [Outsider — zablokowane prywatne karty](premium316-outsider-locked.png)
- [Edycja widoczności przez twórcę](premium316-visibility-edit.png)
- [Nawigacja i karty320px](premium316-bottom-nav-320.png)

Raport/SHA: [ODPOWIEDZI_CODEX.txt](../ODPOWIEDZI_CODEX.txt).

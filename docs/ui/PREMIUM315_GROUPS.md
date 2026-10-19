# Premium España 3.15 — kontrakt grup demo

Gałąź `feat/ui-beta`, baza `a3bcaf1` z korektą `e72a36a`. Tylko izolowane
`npm run build:demo`. Brak backendu, nowych zależności, obrazów i zmian Vercel.
Najnowszy raport i SHA: [ODPOWIEDZI_CODEX.txt](../ODPOWIEDZI_CODEX.txt).

## Wspólny model

| Dane | Znaczenie |
| --- | --- |
| `World.groupState.groups` | Stabilne id, nazwa, opis, jeden `adminId`, klucz deduplikacji utworzenia |
| `members` | Para groupId/playerId, joinedAt i flaga organizer; obecność rekordu oznacza aktywne członkostwo |
| `requests` | invite/proposal/join, pending/accepted/rejected/cancelled, odbiorca, autor, kanał |
| `nextId`, `clock` | Monotoniczne id i deterministyczny czas dołączenia w sesji demo |
| `groupCanOrganize` | Członek danej grupy jest jej adminem albo ma organizer=true |
| `canViewGroupProfile` | Oglądający i oglądany należą do tej samej wskazanej grupy |

`groups.ts` importuje z data.ts tylko typy. `reduceWorld` deleguje operacje
`group_*` do modelu; jedna akcja aktualizuje cały GroupState. Stare mecze i
profile nie są kopiowane.40 fikcyjnych osób umożliwia grupy25 i35-osobowe oraz
scenariusze z osobami z zewnątrz; pierwsze20, ich numery, portrety i mecze
pozostają zachowane. Dodatkowe20 korzysta z tych samych4 fikcyjnych portretów,
bez generowania obrazów. Dwie dodatkowe grupy8/1 służą zaproszeniu i scenariuszowi
ostatniego członka. p40 początkowo nie ma grup. Wszystko tylko RAM; reset usuwa
zmiany. Brak abonamentów/limitów członkostwa i unikalności nazw.

## Zgody i uprawnienia

| Operacja | Uprawniony | Efekt |
| --- | --- | --- |
| Utworzenie grupy | Dowolny symulowany zarejestrowany gracz | Twórca członkiem i adminem |
| Zaproszenie | Admin danej grupy | Oczekuje na odbiorcę, bez dopisania go |
| Propozycja | Członek danej grupy | Najpierw akceptuje admin, później odbiorca zaproszenia |
| Prośba | Osoba spoza grupy | Akceptuje/odrzuca admin; autor może anulować pending |
| Organizer | Admin → inny obecny członek | Flaga wyłącznie w tej grupie |
| Usunięcie | Admin → inny członek | Utrata członkostwa i uprawnień; profil i mecze pozostają |
| Transfer | Admin → obecny członek | Zmiana jedynego admina, po potwierdzeniu |
| Wyjście | Własne członkostwo | Transfer automatyczny lub usunięcie pustej grupy |

Reducer rewaliduje rolę i status, nie ufa ukryciu przycisków. Nie da się wymusić
członkostwa zaproszeniem ani zaakceptować cudzej otrzymanej oferty. Ponowne
zatwierdzenie nie duplikuje członkostwa; addMember zamyka pozostałe pending
tej osoby/grupy. Usunięcie/odejście autora anuluje jego niezatwierdzone propozycje.
Odebranie organizer nie odbiera administracji; admin nie usuwa się tą drogą.

Gdy admin odchodzi: pozostali organizatorzy, najwcześniejsze joinedAt; jeżeli
ich brak — wszyscy pozostali, najwcześniejsze joinedAt. Remis rozstrzyga
playerId. Nowy admin ma pełne uprawnienia przez adminId. Grupa nie pozostaje
bez admina. Przy ostatnim członku UI potwierdza usunięcie pustej grupy i jej
zgłoszeń. Ręczny transfer oraz usuwanie członka także wymagają potwierdzenia.

## Prywatność demonstracji

Publiczne wyszukanie grupy udostępnia tylko id potrzebne nawigacji, nazwę, opis
i licznik — żadnych członków czy kontaktów. Lista członków i karta Ultimate
wymagają wspólnego członkostwa; Frame pamięta groupId i ponownie sprawdza dostęp
po zmianie użytkownika. Powrót używa istniejącego stosu/scroll/focus.

Nick/nazwa: tylko w panelu zaproszeń dostępnym członkom, min2 znaki, max5 wyników.
Nie ma globalnego katalogu zawodników. Telefon: dokładne9 cyfr po normalizacji
+48/0048/spacji/nawiasów/myślników. Brak wyników i informacji o istnieniu;
komunikat identyczny. Dane testowe `000000001`…`000000040` są niedzwoniące,
fikcyjne i powiązane z p01…p40 wyłącznie w modelu. Nie kopiować do produkcji.

Prywatna próba ma jednolite pokwitowanie również dla nieistniejącego kontaktu,
członka i wcześniej zaproszonego. Wtedy targetId=null i nic nie jest dostarczane
do aktualnego członka ani nieistniejącej osoby. Admin widzi tylko ogólną
„Propozycję prywatnego zaproszenia”, bez numeru/odbiorcy/wyniku wyszukania.
Kanał telefoniczny nie jest liczony w publicznych licznikach zgłoszeń na kartach.
Pokwitowania bez odbiorcy kończą się cancelled i nie blokują późniejszej
prawidłowej próby. Zatwierdzenie propozycji telefonicznej ponownie sprawdza
kontakt/członkostwo oraz istniejące zaproszenie. Known/unknown dają ten sam widoczny wynik. Odbiorca prawidłowej oferty widzi ją
wyłącznie we własnej skrzynce.

To kontrola UI/modelu **fikcyjnego klienta**, nie produkcyjne zabezpieczenie.
Fixture są w bundle. Brak RLS/Auth/API, prawdziwych telefonów/e-maili/sekretów.

## Nawigacja i wizualna kontrola STANDARD

Mecze / Grupy / Profil. Plus pozostaje osobną akcją z3.14. Nowa środkowa
zakładka ma ikonę+etykietę poniżej plusa; przy adminie44px jej celu pozostaje
odsłonięte pod przyciskiem. Plus56×56, wystaje20px, maska i złota krzywizna bez
zmiany kolorystyki. Przy braku uprawnienia eventRole plus niewidoczny, zakładki
w trzech równych kolumnach. Safe area jak dotąd. Footer admina105px w Chromium
bez safe area (vs86 przy dwóch zakładkach; mniej niż wcześniejsze121px).

Obejrzano rzeczywiste Dark/Light, szczegóły, zarządzanie, formularz i zaproszenia.
Kontrole320/390/768: brak poziomego overflow, dotyk≥44, długa nazwa zawija się,
formularz jest przewijany, ostatnie wiersze nie są zasłaniane. Jeden przegląd;
nie wykonywano trzech obowiązkowych cykli ani pełnej starej regresji.

- [Moje grupy Dark](premium315-groups-dark.png)
- [Moje grupy Light](premium315-groups-light.png)
- [Szczegóły](premium315-group-details.png)
- [Tworzenie](premium315-create-group.png)
- [Zaproszenia](premium315-invitations.png)
- [Prośba](premium315-join-request.png)
- [Uprawnienia](premium315-admin-permissions.png)
- [320px](premium315-groups-320.png)

TypeScript, lint zmienionego zakresu, build demo/izolacja i150/150 Vitest
zaliczone. `scripts/test-demo-groups-browser.mjs`: zgody/odmowy/propozycje/
prośby/cancel, organizator, usunięcie, transfer, sukcesja, ostatni członek,
reset, prywatny telefon, profil/guard po zmianie użytkownika/directroute,
320/390/768, motywy i CSP. Jedynie krótki smoke starego meczu. Nie wykonano
produkcji/builda aplikacji, starej pełnej regresji Chromium, Cypress, urządzeń
Android/iOS i prawdziwego Supabase. Natywna klawiatura i safe areas do sprawdzenia.

## Granica 3.16 i zamrożony SLM1.0

**Nie zaimplementowano** groupId w meczu, wyboru grupy w formularzu, prywatności
wydarzeń ani zmiany ich właściciela/autoryzacji. Dotychczasowy eventRole i
edycja meczów3.14 pozostają niezależne od nowych ról grupowych. Selector
`groupCanOrganize(world,groupId,playerId)` oraz stabilny id grupy przygotowują
powiązanie jednego meczu z jedną grupą w3.16.

3.16 ma dopiero sprawdzać uprawnionego członka przy tworzeniu, edycję wyłącznie
przez twórcę, prywatne/publiczne wydarzenia dla zalogowanych, zmianę widoczności,
zachowanie zapisanych outsiderów po zamknięciu i brak dopisywania ich do grupy.
Nie dodano tych funkcji przed ukończeniem3.15. Cztery palety España/FCB/Classic
Lime/Deimos-Code i samorejestracja pozostają w zamrożonym SLM1.0 jako osobne
zadania. Nie dodano ocen, push, płatności, abonamentów ani globalnej administracji.

Dodatkowo wykonano tylko krótki wariant `SLM_GROUPS_FOCUS=phone node
scripts/test-demo-groups-browser.mjs` po poprawce prywatnego pokwitowania:
ponowne zaproszenie po usunięciu członka, identyczny komunikat i ukrycie odbiorcy
propozycji przed adminem, zgoda admina+odbiorcy. Końcowy pełny Vitest150/150;
ostatnie utwardzenie deduplikacji sprawdzone dodatkowo tylko w testach modelu i UI grup (19/19).

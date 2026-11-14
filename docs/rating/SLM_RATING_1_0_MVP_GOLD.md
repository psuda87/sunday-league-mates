# SLM Rating 1.0 + MVP Gold — zatwierdzone założenia

Status: **koncepcja funkcjonalna i wizualna zaakceptowana (13.11.2026)**. Dokumentacja, nie implementacja. UI Premium 3.18 pozostaje bazą; bez merge kodu bez odbioru na telefonie.

## 1. Rating zawodnika
- Skala **1–10**, bez sztucznej dolnej granicy 7. Każdy zaczyna od **7,0/10 = 3,5/5 gwiazdki**.
- **Pierwsza zmiana ratingu dopiero po co najmniej 5 ocenionych meczach**. Później oceny aktualizowane po zamknięciu okna oceniania.
- Rating docelowo **globalny dla zawodnika w całej aplikacji**, również jeśli występuje w wielu grupach; na etapie implementacji sprawdzić skutki różnej surowości grup.
- Wynik drużyny (wygrana/remis/przegrana) **nie daje punktów**.
- Wstępne wagi wpływu: **80% oceny kolegów, 12% MVP, 5% gole/asysty, 3% frekwencja**. Nie traktować tych wag jako gotowej formuły sumującej surowe liczniki: frekwencja tylko na plus, a premie mają limity.
- Szczegółowa formuła wygładzania ratingu, normalizacji między grupami i miesięcznych premii wymaga osobnej specyfikacji/testów na danych przykładowych. Nie przyjmować przykładowych liczb za zatwierdzone algorytmy.

## 2. Oceny po meczu
- Oceny **1–10**, anonimowe dla innych zawodników; głosuje tylko uczestnik danego meczu i tylko na innych uczestników; **zakaz samooceny**.
- Okno **48 h od zakończenia meczu**. Brak głosu = brak danych, nie zero.
- Chronić przed pojedynczymi złośliwymi „1” i wzajemnym zawyżaniem przez dwie osoby, bez automatycznego odrzucania wszystkich ocen skrajnych. Mechanizm odporny na manipulację wymaga testów i zasad prywatności.
- Do startu ratingu liczy się 5 meczów z rzeczywiście otrzymanymi ocenami, nie pięć samych obecności.

## 3. MVP
- Każdy uczestnik może zagłosować na jednego innego uczestnika; bez głosu na siebie.
- Głosowanie ważne przy udziale **minimum połowy uczestników** (np. 5/10, 6/12); brak kworum = bez MVP.
- **MVP Gold**: samodzielne pierwsze miejsce w ważnym głosowaniu.
- **MVP akumulacyjne**: remis na pierwszym miejscu w ważnym głosowaniu daje każdemu współliderowi **0,25 jednostki**; cztery takie remisy dają jedno MVP akumulacyjne. Remisy i licznik zachować w historii.
- MVP i premie miesięczne nie mogą dominować nad ocenami kolegów.

## 4. Gole, asysty, frekwencja
- Gole i asysty zawodnik **wpisuje sam**, na zasadzie zaufania, bez obowiązkowej weryfikacji przez innych. Dane widoczne w podsumowaniu; ewentualne zgłoszenie błędu pozostaje pomysłem, nie zatwierdzonym procesem.
- Mały, ograniczony wpływ na rating; malejąca korzyść z kolejnych goli/asyst, by nie faworyzować napastników i nie premiować nadużyć.
- Podsumowanie i wpływ goli/asyst oraz frekwencji **na koniec miesiąca**; liczniki nowego miesiąca od zera, **historia pozostaje**.
- Frekwencja daje **wyłącznie dodatni bonus**, bez kar za kontuzję, urlop czy nieobecność.
- MVP ustalane po głosowaniu, jego wpływ na rating może być rozliczany miesięcznie.

## 5. MVP Gold — ważność
- Aktywne maksymalnie **7 dni od zakończenia meczu**, który przyniósł MVP Gold.
- Jeżeli zawodnik wcześniej rozegra kolejny mecz i nie zdobędzie ponownie MVP Gold, efekt wygasa **po rozstrzygnięciu ważnego głosowania** tego meczu.
- Jeśli kolejne głosowanie nie osiągnie kworum, nie odbieramy aktywnego wyróżnienia przed upływem 7 dni.
- Ponowny Gold odnawia okres od nowego meczu. Wszystkie zdobyte Goldy i MVP akumulacyjne zostają w historii.

## 6. UI — zaakceptowany projekt wizualny
Referencja: obecny UI SLM Premium 3.18, komponent `app/src/ui/UltimatePlayerCard.tsx`, style `app/src/theme/variables.css`. **Nie tworzyć karty od nowa**. Zachować kształt tarczy, stadion, zdjęcie, herb, numer, nazwisko, nawigację i układ.

- **Profil własny i cudzy**: MVP Gold = metaliczne, ciemnozłote tło/gradient, złota ramka i korona/znak MVP Gold, efektowny refleks; przy **każdym wejściu** na profil z aktywnym Gold krótka animacja zdobycia wyróżnienia (~1,5 s).
- **Gwiazdki**: pięć większych, **bez opisu**, bezpośrednio **pod pseudonimem/nazwiskiem**, w łuku z **najniższą gwiazdką pośrodku** (odwrotność wcześniejszego łuku). Wypełnienie proporcjonalne do ratingu, także połówki: 7/10 = dokładnie 3,5/5. Gwiazdki nie zależą od MVP.
- **Lista członków grupy**: mocno widoczny złoty wiersz/akcent i korona MVP Gold.
- **Lista uczestników meczu**: analogiczny wyraźny złoty znacznik i podświetlenie.
- **Boisko/składy**: wyróżnienie aktualnego MVP na znaczniku zawodnika, korona/etykieta, bez naruszenia czytelności drużyn.
- **Refleks we wszystkich czterech miejscach**: powtarzający się, krótki, ukośny, metaliczny błysk co ok. **4–5 sekund**, nie jednorazowy; intensywność dostosowana do powierzchni. Wspólna implementacja CSS/komponent, bez pollingów i kosztów serwera; `prefers-reduced-motion`.
- MVP akumulacyjne: stała odznaka w profilu/historii, bez złotego tła Gold.

## 7. Materiały wizualne
Zatwierdzony **kompozyt czterech ekranów** przedstawia: profil MVP Gold, listę grupy, boisko i listę uczestników. Jest **wizualną koncepcją**, nie wiernym zrzutem z działającej aplikacji. Bazowe zrzuty zostały dostarczone przez użytkownika w rozmowie 13.11.2026.

**Do dołączenia do repo jako binarne assety** (nie zostały umieszczone w tym commicie dokumentacyjnym):
- `docs/rating/assets/mvp-gold-approved.png` — zaakceptowany kompozyt czterech ekranów;
- `docs/rating/assets/current-profile.jpg`;
- `docs/rating/assets/current-group.jpg`;
- `docs/rating/assets/current-pitch.jpg`;
- `docs/rating/assets/current-match-participants.jpg`.

> Uwaga: dopóki pliki nie zostaną fizycznie dodane do Git, powyższa lista jest manifestem, a nie działającymi linkami. Nie traktować dokumentacji jako kompletnego archiwum obrazów.

## 8. Wdrożenie i odbiór
1. Audyt istniejącego kodu ratingów, statystyk, profili, grup, wydarzeń, składów i polityk RLS.
2. Osobna gałąź implementacyjna. Nie ruszać innych ekranów ani zatwierdzonego UI.
3. Zaimplementować logikę z testami: uprawnienia, anonimowość, 48 h, 5 meczów, kworum MVP, remisy, 7 dni, archiwizacja miesięczna, odporność na manipulacje.
4. Podgląd na `slm-ui-demo.vercel.app`, test telefonu i odbiór użytkownika.
5. **Merge dopiero po wyraźnej akceptacji użytkownika.**

## 9. Otwarte szczegóły do implementacji
- Dokładny wzór ratingu (wagi i maksymalne premie), stabilizacja po 5 meczach, obsługa rzadkich ocen.
- Kryterium rozstrzygnięcia przy remisach wieloosobowych i przypadkach z bardzo małą liczbą głosów mimo kworum.
- Polityka zgłaszania nieprawidłowych statystyk i anonimowość wobec administratorów.
- Czy i jak wpływ Gold/akumulacyjnego MVP na rating naliczać co miesiąc, bez podwójnego naliczania.

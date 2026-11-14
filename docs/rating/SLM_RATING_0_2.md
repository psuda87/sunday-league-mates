# SLM Rating 0.2 — zasady zatwierdzone przez właściciela 14.11.2026

Zastępuje „propozycję 0.1”. Źródłem prawdy dla obliczeń jest serwer: `app/supabase/migrations/20261114190000_rating_module.sql`.
`app/src/rating/ratingFormula.ts` odwzorowuje te same wzory (testy używają tych samych liczb co `tests/rating_module.sql`).

## Ocena
- Jedna ogólna ocena zawodnika dla wszystkich grup, skala 1–10, start 7,0 (3,5 gwiazdki).
- **Ocena krocząca:** po każdym ocenionym meczu przesuwa się o 10% w stronę średniej ocen otrzymanych w tym meczu.
  Mecz liczy się, gdy zawodnika oceniły co najmniej 2 osoby.
- Publicznie widać 7,00 do czasu 5 ocenionych meczów; potem realną ocenę (karta: gwiazdki, w chmurce dwa miejsca po przecinku).
- Nowy sezon nie zeruje oceny — zawodnik zaczyna z oceną końcową poprzedniego sezonu.

## Ocenianie meczu
- Okno: od końca meczu przez 48 godzin. Oceny można zmieniać do zamknięcia okna. Oceny są anonimowe.
- Oceniają i są oceniani tylko członkowie, którzy zagrali (zapisani, nieoznaczeni jako nieobecni). Goście bez konta nie biorą udziału.
- Nikt nie ocenia siebie i nie głosuje na siebie.
- **MVP:** kworum to co najmniej połowa uczestników. Samodzielny zwycięzca = MVP Gold; remis = po 0,25 MVP dla remisujących, bez złota.
- **MVP Gold** trwa najwyżej 7 dni i przepada wcześniej, gdy w późniejszym meczu z udziałem posiadacza MVP Gold zdobędzie ktoś inny.
- **Akcja meczu:** każdy wskazuje drużynę A albo B; drużyna z większością głosów dostaje premię dla wszystkich swoich zawodników. Remis — nikt.
- **Gole i asysty** wpisuje sam zawodnik. **Wynik meczu** może wpisać i poprawić każdy uczestnik (widać, kto zmienił ostatni).
  Rozbieżność (więcej goli lub asyst niż wynik drużyny; asyst tyle samo co goli) jest tylko informacją — gole nadal się liczą.

## Premia miesięczna (najwyżej +0,6, dolicza się na stałe)
Liczona po zakończeniu miesiąca (czas Europe/Warsaw), gdy wszystkie mecze miesiąca są rozliczone. Liczniki nowego miesiąca od zera, historia zostaje.

| Składnik | Maks. | Wzór |
|---|---|---|
| MVP | 0,30 | pełna przy średnio 1 MVP na 2 mecze |
| Gole i asysty | 0,12 | `1 − e^(−(gole+asysty)/mecze/4)` — malejąca korzyść |
| Akcja meczu | 0,10 | udział meczów z wygraną akcją |
| Frekwencja | 0,08 | `(zagrane + rezerwy) / (zapisy + rezerwy)`, od 2 zapisów w miesiącu |

- Bez rozegranego meczu w miesiącu nie ma premii. Premie nigdy nie odejmują.
- Zapis na rezerwę liczy się do frekwencji jak obecność (nieopisywane zawodnikom w zasadach).

## Poza tym etapem
- Sezony (ustawiane ręcznie przez administratora aplikacji; statystyki i rankingi sezonu, sezon letni) — niezaimplementowane.
- Kafelki statystyk w profilu (Mecze, Bramki, Asysty, MVP) — nadal bez danych.
- Zgłaszanie nadużyć, powiadomienia o otwarciu okna ocen — niezaimplementowane.
- Uruchomienie: nic sprzed `slm_rating_config.enabled_from` (czas migracji) nie jest oceniane.

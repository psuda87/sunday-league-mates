# Odznaki — plan (2026-11-16, gałąź `feat/badges`)

Źródła: `assets/badges/badges.json` (17 zatwierdzonych kodów), issue #68 (wcześniejsza propozycja zasad),
grafiki w lokalnym folderze `badges/` (poza repo; wygląd odznak uznany za gotowy).

## Decyzje właściciela (2026-11-16)
- Odznaki pod kartą zawodnika, pod rzędem statystyk (Mecze/Bramki/Asysty/MVP).
- Układ: **lista jedna pod drugą** — obrazek, nazwa, opis, status (zdobyta + data) albo pasek postępu.
- Grafiki: przygotowane pliki z folderu `badges/` (styl uznany za gotowy).
- Karta zawodnika (`UltimatePlayerCard`) bez zmian.
- D0: grafiki wybrane — 17 plików w głównym folderze `badges/` (podfoldery to odrzucone warianty i arkusze).
- D1: Powrót króla — powrót po **60 dniach** przerwy.
- D2: Ostatnia chwila — zapis **w dniu meczu po 17:00** (Europe/Warsaw, ta sama granica co odpowiedzialność finansowa).
- D7: gole/asysty wpisywane przez zawodników akceptowane; liczą się wyłącznie, gdy suma bramek drużyny
  **zgadza się z wynikiem** meczu (`score_a`/`score_b` dla `lineup_last_team`) — niezgodne statystyki meczu są pomijane.
- D10: sekcja zwinięta — **zdobyte zawsze widoczne**, niezdobyte (z postępem) pod „Pokaż pozostałe (N)”.
- D4: Wieczny rezerwowy — liczy się każdy **zapis na rezerwę**, bez względu na to, czy zawodnik wszedł do gry.
- D5: Król strzelców — **osobno w każdej grupie**, sezon = rok kalendarzowy (1.01–31.12); przyznawany po zakończeniu roku.
- D6: Rekruter — **każdy gość osobno**, także gdy to ta sama osoba w kolejnych meczach.
- D9: **bez wyliczania wstecz** — odznaki liczone od dnia wdrożenia.
- D3: seria (Żelazne płuca) — **kolejne mecze grupy**: każdy nieodwołany mecz grupy, w którym zawodnik nie zagrał,
  przerywa serię (wariant B). Liczone osobno w każdej grupie.
- D7a: **Turysta (SLM-ZER-010) usunięty** z zestawu.
- Nowe (2026-11-16), nazwy robocze, grafiki do dostarczenia:
  - SLM-MON-003 „Kwartał na boisku”, SLM-MON-006 „Pół roku na boisku”, SLM-MON-012 „Rok na boisku” —
    **3/6/12 kolejnych miesięcy kalendarzowych**, w każdym **co najmniej 2 rozegrane mecze**; jeden „zawalony” miesiąc
    zeruje licznik. Miesiąc, w którym grupa nie miała żadnego meczu (np. przerwa wakacyjna), nie przerywa serii.
  - SLM-YRS-080 „Regularny” — **≥ 80% nieodwołanych meczów grupy** w roku kalendarzowym, osobno w każdej grupie.
  Zestaw: 20 odznak (17 − Turysta + 4).
  Grafiki: MON-003 `Neon Bronze Soccer Calendar 3 Badge-1`, MON-006 `Neon Shield Soccer Challenge 6 Badge-2`,
  MON-012 `Crowned Football Calendar 12Emblem-3`, YRS `Neon Golden Football Trophy 2027-4`
  (próg 80% zgodny z grafiką; wpisany rok 2027 — do rozstrzygnięcia: wersja bez roku + rok wyświetlany w aplikacji).
- D8: pozostałe odznaki liczone **łącznie ze wszystkich grup** (osobno byłoby za łatwo). Osobno w grupie liczą się
  tylko: seria (Żelazne płuca), Król strzelców i Regularny.

## Wygląd wiersza (propozycja)
```
(obrazek 56 px)  Weteran                         ✓ 12.10.2026
                 50 rozegranych meczów
(obrazek, szary) Legenda boiska
                 ████████░░░░░░░░░░  34/100 meczów
```
- Zdobyte: pełny kolor, data zdobycia; niezdobyte: wyszarzone (grayscale + przezroczystość) i postęp.
- Dotknięcie wiersza: większy obrazek i pełny opis warunku.
- Jeden komponent w trzech miejscach z kartą: Mój profil (`demo/Profile.tsx`), profil z grupy (`groups/PremiumGroups.tsx`),
  profil ze składów (`events/LineupPlayerProfile.tsx`). Widoczność jak karta: członkowie wspólnych grup.

## Grafiki → kody
| Kod | Nazwa | Plik w `badges/` |
|---|---|---|
| SLM-MAT-001 | Debiutant | `Metallic Debutant Soccer Shield Badge-1` |
| SLM-MAT-010 | Stały bywalec | `Metallic Soccer Shield Badge with Cyan Glow-3` |
| SLM-MAT-050 | Weteran | `Veteran Soccer Achievement Badge-4` |
| SLM-MAT-100 | Legenda boiska | `Legendary Football 100 Badge-5` |
| SLM-STR-010 | Żelazne płuca | `Żelazne Płuca Neonowy Emblemat-6` |
| SLM-GOL-100 | Snajper | `Neon SNAJPER Soccer Champion Badge-7` |
| SLM-TOP-001 | Król strzelców | `Król Strzelców Emblem Badge-1` |
| SLM-AST-100 | Asystent | `Soccer Assist Champion Badge-3` |
| SLM-WIN-005 | Niezwyciężony | `Niezwyciężona futbolowa odznaka 5 gwiazd-1` |
| SLM-ATT-020 | Pewniak | `Metallic PEWNIAK Calendar Crest-1` |
| SLM-REL-020 | Niezawodny | `Niezawodny Złoty Herb z Kalendarzem-2` |
| SLM-COM-001 | Powrót króla | `Powrót Króla_ Królewska Piłkarska Odznaka-3` |
| SLM-GST-010 | Rekruter | `Metallic Esports Recruiting Badge-4` |
| SLM-BEN-010 | Wieczny rezerwowy | `Glossy Eternal Substitute Bench Crest-5` |
| ~~SLM-ZER-010~~ | ~~Turysta~~ | usunięta 2026-11-16 |
| SLM-PHX-005 | Feniks | `Fiery Phoenix FENIKS Soccer Crest` |
| SLM-LST-005 | Człowiek ostatniej chwili | `Człowiek Ostatniej Chwili – Sportowy Emblemat-2` |

Obróbka techniczna (bez zmiany wyglądu): WebP ok. 256 px (~30 KB zamiast ~2 MB), prawdziwa przezroczystość tam,
gdzie szachownica jest wtopiona w obraz (np. `Neon Debutant`), docelowo `app/public/assets/badges/<KOD>.webp`.

## Skąd dane (istniejące tabele)
| Kod | Warunek | Źródło | Uwagi |
|---|---|---|---|
| MAT-001/010/050/100 | rozegrane mecze 1/10/50/100 | `slm_match_entries` (zapisany, `absent=false`) + `slm_matches` (zakończony, nieodwołany) | gotowe |
| STR-010 | 10 meczów z rzędu | jw., kolejność `starts_at` | definicja przerwania serii (D3) |
| GOL-100 / AST-100 | 100 goli / asyst | `slm_match_stats` | wpisywane przez zawodników (D7) |
| TOP-001 | król strzelców sezonu | `slm_match_stats` | sezon i zakres (D5) |
| WIN-005 | 5 wygranych z rzędu | `slm_match_rating_state.score_a/b` + `slm_match_entries.lineup_last_team` | tylko mecze z wynikiem i składem |
| PHX-005 | wygrana po 5 porażkach z rzędu | jw. | jw. |
| ATT-020 | 20 zapisów zakończonych grą | `slm_match_entries` | gotowe |
| REL-020 | 20 meczów bez nieusprawiedliwionej nieobecności | `absent`, `withdrawn_at` | „nieusprawiedliwiona” = D3 |
| COM-001 | powrót po przerwie | historia obecności | długość przerwy (D1) |
| GST-010 | 10 przyprowadzonych gości | wpisy gości z `responsible_user_id`, gość zagrał | unikalność gości (D6) |
| BEN-010 | 10 razy na rezerwie | `status='reserve'` w chwili meczu | D4 |
| ~~ZER-010~~ | usunięta | — | — |
| LST-005 | 5 zapisów w ostatniej chwili | `joined_at` vs `starts_at` | okno czasowe (D2) |

## Do rozstrzygnięcia
- D0, D1, D2, D7, D10 — rozstrzygnięte (wyżej).
- D11. Definicje 4 nowych odznak (miesiące gry, regularność roku) i ich grafiki.


## Etapy (każdy: gałąź → testy → akceptacja → PR → merge → deploy, za zgodą)
1. Grafiki: wybór wariantów, WebP, `app/public/assets/badges/`, manifest w `app/src`.
2. UI: komponent listy z danymi przykładowymi (demo) — akceptacja wyglądu na telefonie.
3. Backend: tabela `slm_badges` (RLS, tylko `service_role`), przeliczanie w leniwym rozliczaniu meczu (jak oceny),
   idempotentnie; akcja `badges_player` w `accounts`; wyliczenie wstecz.
4. Podłączenie UI do danych; opcjonalnie wpis w dzwonku „Nowa odznaka”.

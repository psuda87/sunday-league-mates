# Odznaki — plan (2026-11-16, gałąź `feat/badges`)

Źródła: `assets/badges/badges.json` (17 zatwierdzonych kodów), issue #68 (wcześniejsza propozycja zasad),
grafiki w lokalnym folderze `badges/` (poza repo; wygląd odznak uznany za gotowy).

## Decyzje właściciela (2026-11-16)
- Odznaki pod kartą zawodnika, pod rzędem statystyk (Mecze/Bramki/Asysty/MVP).
- Układ: **lista jedna pod drugą** — obrazek, nazwa, opis, status (zdobyta + data) albo pasek postępu.
- Grafiki: przygotowane pliki z folderu `badges/` (styl uznany za gotowy).
- Karta zawodnika (`UltimatePlayerCard`) bez zmian.

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
| SLM-MAT-001 | Debiutant | **3 warianty**: `Debiutant_ Pierwszy Mecz-2`, `Metallic Debutant Soccer Shield Badge-1`, `Neon Debutant Football Crest-1` |
| SLM-MAT-010 | Stały bywalec | `Neon Soccer Badge_ Stały Bywalec 10-4` |
| SLM-MAT-050 | Weteran | **2 warianty**: `Veteran 50 Soccer Crest-5`, `Veteran Soccer Achievement Badge-4` |
| SLM-MAT-100 | Legenda boiska | **2 warianty**: `Legendary Football 100 Badge-5`, `-6` |
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
| SLM-ZER-010 | Turysta | `TURYSTA_ Zakaz Goli w Raju-6` |
| SLM-PHX-005 | Feniks | `Fiery Phoenix FENIKS Soccer Crest` |
| SLM-LST-005 | Człowiek ostatniej chwili | `Człowiek Ostatniej Chwili – Sportowy Emblemat-2` |
| — | ? | `Metallic Soccer Shield Badge with Cyan Glow-3`, `Neon Crown Soccer Champion Badge-4` — bez przypisania |

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
| ZER-010 | 10 meczów z rzędu bez gola | `slm_match_stats` | mecz bez wpisanych statystyk (D7) |
| LST-005 | 5 zapisów w ostatniej chwili | `joined_at` vs `starts_at` | okno czasowe (D2) |

## Do rozstrzygnięcia
- D0. Warianty grafik: który Debiutant, Weteran i Legenda; do czego dwa nieprzypisane pliki.
- D1. Powrót króla: po ilu dniach przerwy (propozycja: 60)?
- D2. Ostatnia chwila: zapis ile przed meczem (propozycja: w dniu meczu po 17:00 albo < 3 h przed startem)?
- D3. Seria i „nieusprawiedliwiona nieobecność”: nieobecność mimo zapisu albo rezygnacja po 17:00 (jak w #68)?
- D4. Rezerwowy: liczyć bycie na rezerwie w chwili rozpoczęcia meczu?
- D5. Król strzelców: sezon = rok kalendarzowy, osobno w każdej grupie?
- D6. Rekruter: każdy gość osobno czy unikalne osoby (po telefonie/nazwie)?
- D7. Gole/asysty wpisują sami zawodnicy — akceptujemy ryzyko „nabijania” dla GOL/AST/TOP/ZER?
  Mecz bez wpisanych statystyk: liczy się jako 0 goli (Turysta) czy jest pomijany?
- D8. Zakres: wszystkie grupy łącznie (propozycja) czy osobno w każdej grupie?
- D9. Wyliczyć wstecz z historii przy wdrożeniu (propozycja: tak)?
- D10. Lista: wszystkie 17 od razu, czy zwinięta sekcja „Odznaki 5/17” rozwijana dotknięciem?

## Etapy (każdy: gałąź → testy → akceptacja → PR → merge → deploy, za zgodą)
1. Grafiki: wybór wariantów, WebP, `app/public/assets/badges/`, manifest w `app/src`.
2. UI: komponent listy z danymi przykładowymi (demo) — akceptacja wyglądu na telefonie.
3. Backend: tabela `slm_badges` (RLS, tylko `service_role`), przeliczanie w leniwym rozliczaniu meczu (jak oceny),
   idempotentnie; akcja `badges_player` w `accounts`; wyliczenie wstecz.
4. Podłączenie UI do danych; opcjonalnie wpis w dzwonku „Nowa odznaka”.

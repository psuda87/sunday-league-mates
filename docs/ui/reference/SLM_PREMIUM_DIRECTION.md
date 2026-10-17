# SLM Premium España — zatwierdzony kierunek wizualny (2026-10-17)

Użytkownik wybrał **nowe dwie grafiki premium** jako docelowy kierunek estetyczny aplikacji Sunday League Mates. To rozwinięcie wcześniejszej referencji `docs/ui/reference/approved-three-themes.jpg`, a nie jej zamiennik.

## Dwie referencje do zapisania jako obrazy
- `docs/ui/reference/slm-premium-three-phones.jpg` — trzy telefony na tle stadionu i hiszpańskich barw; ekrany Mecze / Uczestnicy / Składy.
- `docs/ui/reference/slm-premium-ui-branding-board.jpg` — tablica projektowa: trzy ekrany, herb z koroną i piłką, paleta, ikony, szczegółowe proporcje.

**Aktualizacja:** oba JPG dostarczono w commicie `2f2d8a2`, obejrzano i wykorzystano w UI 3.0. Analiza: `../PREMIUM_VISUAL_SPEC.md`.

**Historyczny status przed dostarczeniem:** obrazy wygenerowano w rozmowie ChatGPT, ale pliki JPG nie zostały jeszcze przeniesione do repozytorium. Nie deklaruj, że są obecne, zanim faktycznie się pojawią. Przy najbliższym zadaniu Codex ma je dodać, jeśli użytkownik udostępni paczkę `slm-premium-references.zip`, zachowując powyższe ścieżki.

## Priorytety projektowe
1. Dark España: bordo / czerń / złoto, światła stadionu, duża głębia wizualna i subtelne refleksy.
2. Herb SLM z koroną i piłką; istniejący wektor: `app/public/assets/branding/slm-crest-espana.svg`.
3. Zwarta, klikalna karta meczu; bez osobnego przycisku „Szczegóły”.
4. Szczegóły meczu: zakładki Informacje / Uczestnicy / Składy / Rozliczenie, domyślnie Uczestnicy.
5. Dolna nawigacja: Mecze / Zawodnicy / Profil.
6. Nie kopiuj fikcyjnych nazwisk, wyników, sald ani innych danych z ilustracji do prawdziwej aplikacji.
7. Renderowane obrazy to koncepcje, nie screeny działającego UI. Implementacja ma pozostać responsywna i dostępna.
8. Przed zakończeniem porównuj rzeczywiste zrzuty Chromium z referencjami, nie ograniczaj się do zielonego builda.

**Nie publikować ani nie modyfikować backendu tylko z powodu tego dokumentu.**

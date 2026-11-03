# Rejestr odbioru funkcji SLM

Punkt startowy mapy: main **1b6ee83356d53b7b34193af88802067dc9b2fede**, 03.11.2026.
Zakres: **33 konteksty ekranowe / 162 funkcje**. Opisy i zależności:
[SCREEN_FUNCTION_CHECKLIST.md](SCREEN_FUNCTION_CHECKLIST.md). Nie kopiujemy listy
wymagań do dziennika. To jedyne miejsce bieżących statusów i decyzji funkcjonalnych.

## Statusy i dowody

| Status | Warunek / co nie wystarcza |
|---|---|
| DO WERYFIKACJI | Funkcja zmapowana, brak aktualnego pełnego odbioru. Może być aktywna lub niezaimplementowana; dostępność opisuje checklista |
| BŁĄD | Zgłoszona niezgodność; zapisujemy źródło, oczekiwane/rzeczywiste zachowanie i reprodukcję. Zgłoszenie właściciela nie wymaga wcześniejszego testu automatycznego |
| W TESTACH | Jest konkretny kandydat/SHA naprawy i trwa walidacja; nie wystarcza plan lub makieta |
| ZATWIERDZONE | Właściciel jawnie potwierdził podane ID, zakres i dokładny SHA po ręcznym odbiorze; testy automatyczne i sam merge nie są potwierdzeniem |
| ZAMKNIĘTE | Właściwy zaakceptowany kod wszedł przez PR do main, zapisano merge SHA/PR i regresję; brak nierozstrzygniętych błędów w zaakceptowanym zakresie |

„ZGŁOSZONY BŁĄD” to etykieta sprawy BUG-SKL-001, a jej formalny status to BŁĄD,
zgodny z pięciostanowym rejestrem. NIE URUCHOMIONO/PASS/FAIL są wynikami testów,
nie dodatkowymi statusami odbioru. BRAK W UI/DEMO to dostępność, nie zatwierdzenie.
Domyślnie brak zgody właściciela (—). Nie przypisujemy nikomu potwierdzenia na
podstawie przypuszczenia, merge lub zdań autora raportu „gotowe”.

## Procedura jednej funkcji

1. **Wybór:** wskazać ID lub mały zestaw powiązanych ID i zakres problemu.
   Odczytać aktualny main i AGENTS, odnotować bazę/SHA i niezapisane prace.
   Utworzyć osobną gałąź; nie „naprawiać przy okazji” niezwiązanych ekranów.
2. **Kontrakt:** opisać scenariusz, użytkownika/rolę, grupę, dane syntetyczne,
   wynik oczekiwany/rzeczywisty i kryteria odbioru. Zgłoszenie otrzymuje BŁĄD.
   Dla UI utrzymać Premium3.18 i aktualne zatwierdzone wyjątki; nie przepinać guardów
   lub rozszerzać uprawnień tylko po to, by otrzymać PASS.
3. **Poprawka:** zapisać kod/testy na gałęzi i dokładny kandydat SHA; W TESTACH.
   Bez produkcyjnych danych i zdalnych operacji bez odrębnego upoważnienia.
4. **Testy:** wykonać celowane unit/kontrakty oraz negatywne przypadki uprawnień,
   potem odpowiedni lint/TS/build i obowiązujące strażniki. Dla zmiany backendu
   wymagane prawdziwe SQL/RLS/HTTP na nowej zgodnej fixture, dla natywnej zmiany
   odpowiedni Android/telefon. Zapisać PASS/FAIL/NOT RUN, komendę, środowisko,
   datę i SHA. Mock/demo nie są dowodem Supabase lub dostarczenia push.
5. **Ręczny odbiór:** przekazać właścicielowi konkretny build/SHA, kroki i dowody.
   Potwierdzenie musi wskazywać ID, SHA, środowisko/urządzenie i zaakceptowany zakres.
   Brak odpowiedzi nie jest zgodą. Po błędzie wraca BŁĄD; po jawnej akceptacji
   ZATWIERDZONE. Zmiana kodu po odbiorze wymaga ponownej oceny zakresu.
6. **PR i merge:** PR opisuje finalny zakres i ograniczenia. Merge wyłącznie po
   osobnej wyraźnej zgodzie właściciela lub wykonaniu przez właściciela; żadnego
   automatycznego merge na podstawie tego rejestru. Jeśli chronione piny wymagają
   zmian, osobny review ich dokładnego zakresu. Nie scalać starego stosu ponownie.
7. **Zamknięcie:** odnotować PR, SHA testowanego/zaakceptowanego kodu i merge SHA,
   potwierdzić jego obecność w main oraz właściwy smoke/regresję; ZAMKNIĘTE.
   Sam commit dokumentacji lub deployment nie zamyka funkcji. Nowa regresja
   otwiera nową sprawę BŁĄD, nie usuwa historii starego odbioru.

Dla funkcji już istniejącej w main można wykonać odbiór bez sztucznej poprawki:
odnotować brak zmian i przebadany main SHA. Jeśli nie ma PR naprawy, wpisać
„nie dotyczy — odbiór istniejącego kodu”, zachować dowód obecności tego SHA i
regresję; nie tworzyć pustego merge. ZAMKNIĘTE nadal wymaga decyzji właściciela.
Jeżeli funkcja jest świadomie wyłączona, odbiór placeholdera nie zatwierdza docelowej
integracji. Wycofanie funkcji również wymaga decyzji i śladu, nie usunięcia ID.

## Punkty odniesienia wyglądu

Premium3.18 **d0f9fa9f840d2bd7f4985d00c24ee9a703f6b3e4**, karta
**30772dee1b0049c74e6682d47ab4d4848252855f** i 55 chronionych plików pozostają
zaakceptowanym wzorcem wizualnym z instrukcji właściciela, z późniejszymi dokładnymi
wyjątkami w bieżącym premium-route-policy. To nie jest ogólny funkcjonalny odbiór
main1b6ee83, działającego backendu lub telefonu. Nie zmieniono UI ani manifestu.

## Stan początkowy wszystkich funkcji

Status początkowy dotyczy odbioru na badanym main, nie deklaracji implementacji.
„Plan Txx” wskazuje regresję z checklisty; wynik wszystkich takich testów w tym
zadaniu: **NIE URUCHOMIONO** (wyłącznie dokumentacja). SHA bazy nie jest SHA
zatwierdzonym. Po zmianie statusu uzupełnić wiersz i dopisać zdarzenie chronologiczne.

| ID ekran/funkcja | Status | SHA zatwierdzony | Potwierdzenie właściciela / dowód | Regresja: plan, wynik i artefakt | PR / SHA merge |
|---|---|---|---|---|---|
| S01-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T01; NIE URUCHOMIONO | — |
| S01-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T01; NIE URUCHOMIONO | — |
| S01-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T01; NIE URUCHOMIONO | — |
| S01-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T01; NIE URUCHOMIONO | — |
| S02-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T02; NIE URUCHOMIONO | — |
| S02-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T02; NIE URUCHOMIONO | — |
| S02-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T02; NIE URUCHOMIONO | — |
| S02-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T02; NIE URUCHOMIONO | — |
| S02-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T02; NIE URUCHOMIONO | — |
| S02-F06 | DO WERYFIKACJI | — | — brak odbioru | Plan T02; NIE URUCHOMIONO | — |
| S03-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T01; NIE URUCHOMIONO | — |
| S03-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T01; NIE URUCHOMIONO | — |
| S03-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T01; NIE URUCHOMIONO | — |
| S03-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T01; NIE URUCHOMIONO | — |
| S04-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T03; NIE URUCHOMIONO | — |
| S04-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T03; NIE URUCHOMIONO | — |
| S04-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T03; NIE URUCHOMIONO | — |
| S04-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T03; NIE URUCHOMIONO | — |
| S04-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T03; NIE URUCHOMIONO | — |
| S04-F06 | DO WERYFIKACJI | — | — brak odbioru | Plan T03; NIE URUCHOMIONO | — |
| S04-F07 | DO WERYFIKACJI | — | — brak odbioru | Plan T03; NIE URUCHOMIONO | — |
| S04-F08 | DO WERYFIKACJI | — | — brak odbioru | Plan T03; NIE URUCHOMIONO | — |
| S05-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S05-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S05-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S05-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S05-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S05-F06 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S05-F07 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S06-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S06-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S06-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S06-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S06-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T04; NIE URUCHOMIONO | — |
| S07-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S07-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S07-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S07-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S07-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S08-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S08-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S08-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S08-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S08-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S08-F06 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S08-F07 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S08-F08 | DO WERYFIKACJI | — | — brak odbioru | Plan T05; NIE URUCHOMIONO | — |
| S09-F01 | BŁĄD | — | Zgłoszenie BUG-SKL-001; brak odbioru | Plan T06; NIE URUCHOMIONO | — |
| S09-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T06; NIE URUCHOMIONO | — |
| S09-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T06; NIE URUCHOMIONO | — |
| S09-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T06; NIE URUCHOMIONO | — |
| S09-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T06; NIE URUCHOMIONO | — |
| S09-F06 | DO WERYFIKACJI | — | — brak odbioru | Plan T06; NIE URUCHOMIONO | — |
| S09-F07 | DO WERYFIKACJI | — | — brak odbioru | Plan T06; NIE URUCHOMIONO | — |
| S09-F08 | DO WERYFIKACJI | — | — brak odbioru | Plan T06; NIE URUCHOMIONO | — |
| S09-F09 | DO WERYFIKACJI | — | — brak odbioru | Plan T06; NIE URUCHOMIONO | — |
| S09-F10 | DO WERYFIKACJI | — | — brak odbioru | Plan T06; NIE URUCHOMIONO | — |
| S09-F11 | DO WERYFIKACJI | — | — brak odbioru | Plan T06; NIE URUCHOMIONO | — |
| S10-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S10-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S10-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S10-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S10-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S10-F06 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S10-F07 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S11-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S11-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S11-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S11-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S11-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S11-F06 | DO WERYFIKACJI | — | — brak odbioru | Plan T07; NIE URUCHOMIONO | — |
| S12-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S12-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S12-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S12-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S12-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S13-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S13-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S13-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S14-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S14-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S14-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S15-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S15-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S15-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S15-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S16-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S16-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S16-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S16-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S17-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S17-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S17-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S17-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S17-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S17-F06 | DO WERYFIKACJI | — | — brak odbioru | Plan T08; NIE URUCHOMIONO | — |
| S18-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T09; NIE URUCHOMIONO | — |
| S18-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T09; NIE URUCHOMIONO | — |
| S18-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T09; NIE URUCHOMIONO | — |
| S18-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T09; NIE URUCHOMIONO | — |
| S19-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T09; NIE URUCHOMIONO | — |
| S19-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T09; NIE URUCHOMIONO | — |
| S19-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T09; NIE URUCHOMIONO | — |
| S19-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T09; NIE URUCHOMIONO | — |
| S20-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T10; NIE URUCHOMIONO | — |
| S20-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T10; NIE URUCHOMIONO | — |
| S20-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T10; NIE URUCHOMIONO | — |
| S20-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T10; NIE URUCHOMIONO | — |
| S20-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T10; NIE URUCHOMIONO | — |
| S20-F06 | DO WERYFIKACJI | — | — brak odbioru | Plan T10; NIE URUCHOMIONO | — |
| S21-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T11; NIE URUCHOMIONO | — |
| S21-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T11; NIE URUCHOMIONO | — |
| S21-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T11; NIE URUCHOMIONO | — |
| S21-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T11; NIE URUCHOMIONO | — |
| S21-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T11; NIE URUCHOMIONO | — |
| S22-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T12; NIE URUCHOMIONO | — |
| S22-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T12; NIE URUCHOMIONO | — |
| S22-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T12; NIE URUCHOMIONO | — |
| S22-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T12; NIE URUCHOMIONO | — |
| S23-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T13; NIE URUCHOMIONO | — |
| S23-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T13; NIE URUCHOMIONO | — |
| S23-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T13; NIE URUCHOMIONO | — |
| S23-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T13; NIE URUCHOMIONO | — |
| S23-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T13; NIE URUCHOMIONO | — |
| S23-F06 | DO WERYFIKACJI | — | — brak odbioru | Plan T13; NIE URUCHOMIONO | — |
| S23-F07 | DO WERYFIKACJI | — | — brak odbioru | Plan T13; NIE URUCHOMIONO | — |
| S23-F08 | DO WERYFIKACJI | — | — brak odbioru | Plan T13; NIE URUCHOMIONO | — |
| S24-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T14; NIE URUCHOMIONO | — |
| S24-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T14; NIE URUCHOMIONO | — |
| S24-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T14; NIE URUCHOMIONO | — |
| S24-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T14; NIE URUCHOMIONO | — |
| S24-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T14; NIE URUCHOMIONO | — |
| S25-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T15; NIE URUCHOMIONO | — |
| S25-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T15; NIE URUCHOMIONO | — |
| S25-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T15; NIE URUCHOMIONO | — |
| S25-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T15; NIE URUCHOMIONO | — |
| S26-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T15; NIE URUCHOMIONO | — |
| S26-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T15; NIE URUCHOMIONO | — |
| S26-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T15; NIE URUCHOMIONO | — |
| S26-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T15; NIE URUCHOMIONO | — |
| S27-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T10; NIE URUCHOMIONO | — |
| S27-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T10; NIE URUCHOMIONO | — |
| S27-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T10; NIE URUCHOMIONO | — |
| S27-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T10; NIE URUCHOMIONO | — |
| S28-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S28-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S28-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S29-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S29-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S29-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S30-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S30-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S31-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S31-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S32-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S32-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S32-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T16; NIE URUCHOMIONO | — |
| S33-F01 | DO WERYFIKACJI | — | — brak odbioru | Plan T17; NIE URUCHOMIONO | — |
| S33-F02 | DO WERYFIKACJI | — | — brak odbioru | Plan T17; NIE URUCHOMIONO | — |
| S33-F03 | DO WERYFIKACJI | — | — brak odbioru | Plan T17; NIE URUCHOMIONO | — |
| S33-F04 | DO WERYFIKACJI | — | — brak odbioru | Plan T17; NIE URUCHOMIONO | — |
| S33-F05 | DO WERYFIKACJI | — | — brak odbioru | Plan T17; NIE URUCHOMIONO | — |

## BUG-SKL-001 — automatyczne generowanie składów

- **Ekran/funkcja:** S09 / S09-F01.
- **Status:** BŁĄD — ZGŁOSZONY BŁĄD przez właściciela w bieżącym poleceniu.
- **Wersja odniesienia inwentaryzacji:** main1b6ee83; SHA faktycznie uruchomionego
  przez właściciela APK/backendu **nie podano**. Nie utożsamiać go z tym main.
- **Objaw zgłoszony:** trzeba ręcznie przypisywać zapisanych graczy do drużyn.
- **Oczekiwanie:** automatyczny kompletny początkowy podgląd A/B dla zapisanych,
  z gośćmi i nieparzystą liczbą, bez nadpisania ręcznych zmian i bez autosave.
- **Odtworzenie:** jeszcze niewykonane. Kod ma już preview dla version0/can_write;
  osobno rozpoznać pierwszy podział, nieuprawnioną rolę i nowych graczy w zapisanym
  rosterze. Nie ma potwierdzonej diagnozy braku całego algorytmu.
- **Naprawa/SHA kandydata/SHA zaakceptowany/PR/merge:** — brak, to zadanie niczego
  nie implementuje. Ręczne A/B nie jest przyjętą naprawą zgłoszenia.
- **Regresja:** T06 + przypadki10/11/12 osób, gość registered/reserve, dwie sesje,
  CAS/roster/retry, przywrócenie/cofnięcie i no-op autora. Pełne kryteria pozostają
  w [checkliście](SCREEN_FUNCTION_CHECKLIST.md#zgłoszony-błąd-automatycznych-składów).
- **Decyzja właściciela:** zgłoszenie problemu, **nie** zatwierdzenie poprawki.

## Karta kolejnego zdarzenia — wzór do wypełnienia

```text
Zdarzenie: ACC-YYYYMMDD-NNN
Data/godzina/strefa:
ID ekranu/funkcji (lub mały zestaw):
Poprzedni status → nowy status:
Sprawa / objaw / oczekiwany wynik / kroki odtworzenia:
Baza main i SHA kandydata:
Środowisko, wariant P/L/D, rola/grupa, wersja backendu, urządzenie:
Zakres kodu i brak zmian poza funkcją:
Testy regresyjne: komendy; PASS/FAIL/NOT RUN; SHA; data; link do dowodów:
Ograniczenia / niewykonane testy / otwarte ryzyka:
Ręczny odbiór właściciela: dokładna treść, data, link do potwierdzenia:
SHA zatwierdzonego kodu i zaakceptowane ID:
Oddzielna zgoda na merge:
PR i SHA merge/main (lub uzasadnienie: istniejący kod bez poprawki):
Smoke/regresja po integracji:
Powód zamknięcia albo ponownego otwarcia:
```

Nie wpisywać haseł, tokenów, prawdziwych telefonów, danych prywatnych lub treści
produkcyjnych przelewów. Zrzuty wyłącznie na syntetycznych danych.

## Historia zmian rejestru

| Zdarzenie | Funkcje | Zmiana / dowód |
|---|---|---|
| ACC-20261103-001 | Wszystkie ID | Inwentaryzacja źródeł main1b6ee83, bez ręcznego odbioru i bez uruchamiania testów aplikacji; stan początkowy DO WERYFIKACJI |
| ACC-20261103-002 | S09-F01 | Zgłoszenie właściciela w poleceniu tego zadania → BŁĄD, BUG-SKL-001; brak naprawy i akceptacji |

Późniejsze wpisy dopisujemy chronologicznie, nie nadpisujemy dowodów poprzedniego
SHA. Aktualny wiersz można uaktualniać, ale historia pokazuje każdą zmianę statusu.

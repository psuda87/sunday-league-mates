# Aktualizacja kontroli Premium 3.18 — 2026-10-29 13:51 Europe/Warsaw

**Wynik: PASS.** Historyczny FAIL przypięcia runtime opisany niżej został usunięty przez minimalną zmianę oczekiwań, bez zmiany kodu aplikacji. Gałąź `fix/premium-lineup-stage1-contract` od dokładnego `b30908e15cedff6ffa1a4ca76f0fb514e04302a7`; początkowy worktree czysty, lokalny i zdalny HEAD Stage1 zgodne. Poprzednia baza `39ef2e3` i wzorzec `d0f9fa9` zachowane.

## Ustalona przyczyna i klasyfikacja

Diff Stage1 względem39ef2e3 obejmuje16 plików:2 istniejące pliki runtime,2 nowe zależności edytora/profilu, aktualizacje testów, runner Chromium, dokumenty i4 zrzuty. Brak zmian chronionych komponentów wizualnych lub backendu. Strażnik zatrzymywał się na pierwszej różnicy, lecz sprawdzenie całej listy przypięć wykazało dokładnie dwie:

| Plik / warunek | Oczekiwanie sprzed Stage1 | Stage1 | Klasyfikacja |
|---|---|---|---|
| `app/src/events/PremiumEvents.tsx` | SHA256 `4f831c5819bf…` z `a82397b` | `3e3cd4bc80e0…`; przekazanie manager/userId/groupId do profilu | Zamierzona funkcja Stage1; nieaktualne przypięcie całego pliku |
| `app/src/events/PremiumTeams.tsx` | SHA256 `dad199918fbf…` z `a82397b` | `4a7b26822c20…`; baseline/draft, transfer, przywracanie i profil | Zamierzona funkcja Stage1; nieaktualne przypięcie całego pliku |
| `lineupEditor.ts`, `LineupPlayerProfile.tsx` | Nieobecne na starej liście runtime | Nowe zależności | Luka pokrycia strażnika, nie regresja UI; objęte teraz dokładnym przypięciem |
| Oczekiwania UI/Cypress: stara etykieta zapisu i kasowanie składu przez undo | Stary przycisk i pusty wynik | „Zapisz” nadal disabled; odtworzony baseline | Stage1 już poprawnie dostosował te testy; nie cofano ich do nieaktualnych oczekiwań |
| 55 plików wyglądu, pitch, Ultimate, karty, BottomNav, style | Dotychczasowe źródła zatwierdzeń | Bez zmian | PASS; nie znaleziono regresji wymagającej poprawki UI |

Kontrolne podstawienie **wyłącznie w pamięci** starych dwóch plików pozwoliło przejść wszystkim pozostałym warunkom starej polityki; plików roboczych nie cofano. Osobny probe ujawnił, że poprzednia polityka nie wykrywała podmiany nowego modelu. Nie rozwiązywano błędu przez globalne przestawienie APPROVED na nowy HEAD ani przepisywanie hashy manifestu55.

## Minimalna zmiana kontraktu

`app/scripts/premium-route-policy.mjs` zachowuje `MAIN=134c52b…`, `APPROVED=a82397b…`, wszystkie55 plików wizualnych, stare wyjątki, walidację migracji/Auth/routingu/konfiguracji i ochronę pozostałego runtime. Dodaje **dokładny niezmienny Git SHA `b30908e15cedff6ffa1a4ca76f0fb514e04302a7` tylko dla czterech jawnie wymienionych plików**: PremiumEvents, PremiumTeams, lineupEditor i LineupPlayerProfile. Dwa istniejące przypięcia zostają aktualizowane; dwa nowe chronią rzeczywistą logikę funkcji zamiast samego wrappera. Nadal porównywana jest pełna zawartość z obiektem Git, z dotychczasową normalizacją CRLF. Nie dodano ignorowania fragmentów, wildcardów ani samodzielnego zatwierdzania bieżących plików.

Dodano wymagane importy modelu/profilu oraz istniejącego kontraktu grup i Ultimate. `verify-premium-policy-cases.mjs` zachowuje wszystkie12 dotychczasowych prób negatywnych i dodaje10 nowych. Każda próba sprawdza teraz także, czy mutant faktycznie zmienił źródło — test nie może przejść na pustej zamianie tekstu. Zmian strażnika dokonywano na podstawie wyraźnego polecenia właściciela dotyczącego jego przeglądu, a nie jako obejścia historycznej blokady.

## Kontrole wykonane w tej aktualizacji

| Kontrola | Wynik |
|---|---|
| Odtworzenie początkowego strażnika | FAIL na PremiumEvents; pełna diagnoza także PremiumTeams |
| `node scripts/verify-frozen-ui.mjs` po zmianie | **PASS:55 plików wizualnych i8 granic importów**, pełny runtime i wykluczenie nowego Auth |
| `npm run test:premium-policy` | **23/23 PASS**:1 rzeczywisty graf i22 odrzucone mutacje, bez skip/disabled |
| `npm run verify:consolidation` | PASS; źródła/migracje/routing i wyłączony deployment zachowane |
| TypeScript | PASS |
| Pełny ESLint | PASS |
| Pełny Vitest | **297/297 PASS,51 plików**; obejmuje zachowanie Stage1 i profile |
| Build LIVE / Premium lokalny / demo | PASS; izolacja demo16 PASS; zastane ostrzeżenie dużych chunków pozostaje |
| Chromium/Cypress i fizyczny Android | **NOT RUN w tej aktualizacji** — brak zmiany kodu aplikacji, stylów i zachowania. Wyniki renderów Stage1 poniżej są historyczne, nie nowym PASS |
| Supabase/SQL/RLS/Cloud | Bez operacji i bez zmian; nie uruchamiano integracji bazowych |

Nowe próby odrzucają cofnięcie obu plików Stage1, wyłączenie detekcji zmian, utratę baseline, włączenie pozornego zapisu, pominięcie kontroli UUID profilu, pusty adapter, zmianę geometrii boiska, restylizację BottomNav i zastąpienie Ultimate. Istniejące próby podmiany kart, routingu, entrypointów, manifestu i buildów nadal przechodzą jako oczekiwane odmowy.

## Rekomendacja i ograniczenia

**Stage1 jest gotowy do dalszej integracji jako lokalny edytor, po review zmian kontraktu.** Bloker nieaktualnego przypięcia runtime usunięty; nie stwierdzono nowej regresji wymagającej zmiany aplikacji. Nie oznacza to gotowości produkcyjnej całej aplikacji ani zgody na merge.

Pozostają ograniczenia opisane w etapie1: brak trwałego zapisu/autora/CAS, profil tylko w istniejącym uprawnionym kontekście grupy, brak nowego fizycznego odbioru Androida i pełnego Supabase E2E. Etapu2 nie rozpoczęto. Strażnik nadal wymaga dostępności przypiętych obiektów Git w checkout CI, tak jak wcześniejsza polityka; `b30908e` jest przodkiem tej gałęzi. Same testy nie chronią przed celową zmianą testów/strażnika — nadal potrzebny review właściciela.

Zmieniono tylko2 skrypty polityki/testów i dokumentację. Manifest55, UI, backend, Auth, RLS, migracje, konfiguracja wdrożeń i zależności pozostały bez zmian. Commit poprawki kontroli: **`b377174799723345c07647b32769d9319a89c507`**, wypchnięty na `origin/fix/premium-lineup-stage1-contract`. Baza `feat/premium-lineup-editor-stage1` pozostaje na b30908e. Końcowe potwierdzenie Git jest osobnym commitem dokumentacyjnym.

### Git / Draft PR — 2026-10-29 13:53 Europe/Warsaw

**Draft PR nie utworzono.** Żądanie POST GitHub API z `draft=true`, bazą Stage1 i właściwym head zwróciło `Forbidden`. Nie obchodzono ograniczenia ani nie pozyskiwano nowych tokenów. [Porównanie do utworzenia Draft PR](https://github.com/psuda87/sunday-league-mates/compare/feat/premium-lineup-editor-stage1...fix/premium-lineup-stage1-contract?expand=1); wybrać bazę `feat/premium-lineup-editor-stage1`, head `fix/premium-lineup-stage1-contract` i **Create draft pull request**. Tytuł: „Premium 3.18: minimalna aktualizacja strażnika po Stage 1”. Nie ma numeru PR, który można potwierdzić. Bez merge i wdrożeń.

---

# Historyczny raport wdrożenia Stage1

# Edytor składów Premium — etap 1

2026-10-29, Europe/Warsaw. Branch `feat/premium-lineup-editor-stage1`, utworzony z dokładnego `39ef2e3937b781439864029a92c12de315024263` (`chore/main-stabilization`, PR24). Zdalny HEAD bazy potwierdzono przed pracą. Początkowy worktree był czysty; nie przełączano ani nie zmieniano innych worktree/PR. Docelowy Draft PR jest zależny od `chore/main-stabilization`, nie od main.

## Zmiany

- Zachowano bajtowo `ui/PremiumPitch.tsx`: oryginalne linie, murawę, formacje i geometrię Premium 3.18 wywodzącą się z `demo/Teams.tsx`, `d0f9fa9` i etapu boiska `189896f`. Nie zmieniano stadionowych kart, UltimatePlayerCard, CSS motywów, BottomNav ani grafik.
- Zachowano wybór dwóch znaczników do zamiany. Ponowne wskazanie tej samej osoby usuwa zaznaczenie; inna osoba z tej samej drużyny zmienia wybór; osoba z przeciwnej drużyny kończy zamianę.
- Dodano osobny tryb „Przenieś zawodnika”: wybór znacznika i jawne potwierdzenie drużyny docelowej. Nie wymaga drugiej osoby; nie koliduje z otwieraniem profilu.
- `lineupEditor.ts` rozdziela `baseline` i `draft`. Początkowy, jawnie lokalny podgląd rozdziela rzeczywistych zapisanych naprzemiennie A/B i zachowuje jego kopię jako baseline. Dla 11 osób daje 6:5. Nie ma losowania, rankingów ani algorytmu oceny.
- „Przywróć skład” kopiuje baseline, czyści tryb i zaznaczenie. Nie przelicza nowego podziału. Porównanie bazuje na przypisaniach ID→drużyna, nie kolejności kluczy ani liczbie kliknięć. Zamiana i zamiana powrotna oraz transfer i transfer powrotny dają brak zmian.
- Wszystkie operacje używają identyfikatorów **uczestnictwa**. Goście jednego zapraszającego pozostają oddzielni. Rezerwa/wycofani nie trafiają na boisko. Po zmianie rosteru usunięte wpisy są usuwane z obu lokalnych snapshotów; nowe zostają poza podziałem do jawnego przypisania. Przywrócenie nie wskrzesza wycofanych.
- „Zapisz” jest **zawsze wyłączony**. Wymaganie aktywności wyłącznie dla zmienionego szkicu nie jest zgodą na pozorny zapis: detekcja zmian działa i jest przetestowana, ale brak backendu pozostaje dodatkową bezwzględną blokadą. UI jasno pokazuje ten powód. Nie ma fikcyjnego autora ani czasu ostatniej zmiany.

### Profile i powrót

Normalne kliknięcie zawodnika otwiera istniejącą `UltimatePlayerCard`, z odczytem przez już istniejące `groups_profile(group_id,user_id)`. Parametr użytkownika oznacza wyłącznie cel odczytu; tożsamość oglądającego i uprawnienia nadal sprawdza istniejący serwer. Nie dodano nowego RPC ani endpointu.

Przejście jest dostępne w kontekście członkostwa oglądającego w grupie. Serwer musi dodatkowo udzielić dostępu do wskazanego profilu; odmowa lub błędny UUID odpowiedzi daje błąd, bez fallbacku do prywatnych danych rosteru. Goście bez kont nie mają przycisku profilu. Profile publicznych outsiderów, których istniejący grupowy kontrakt nie udostępnia, nie są obchodzone nową ścieżką. Wymagałyby osobnego uzgodnionego API w etapie2.

Karta używa wyłącznie nazwy i numeru zwróconych w bezpiecznej projekcji. Zdjęcia innych zawodników/statystyki nie są udostępniane przez ten kontrakt; nie zastąpiono ich fixture. Profil jest tylko do odczytu. Sprawdzanie sesji ukrywa kartę, a nieaktualna odpowiedź po powrocie nie może jej przywrócić.

Edytor pozostaje zamontowany pod profilem: powrót odtwarza ten sam mecz, zakładkę i lokalny szkic. Przycisk powrotu i systemowy Ionic back mają tę samą akcję; fokus wraca na znacznik, a scroll Ionic jest przywracany, jeśli dostępny. Fizycznego Androida/IME nie testowano.

## Wyniki kontroli

| Kontrola | Wynik |
|---|---|
| TypeScript `npx tsc --noEmit` | PASS |
| Pełny ESLint `npm run lint -- .` | PASS |
| Pełny Vitest | **297 PASS / 51 plików** |
| Końcowy zmieniony zakres po korekcie odstępów/fokusu | **15 PASS / 3 pliki** |
| `npm run build` | PASS; zastane ostrzeżenie dużych chunków |
| `npm run build:premium-local` | PASS |
| `npm run build:demo` i kontrola izolacji | PASS; 16 plików statycznych, bez produkcyjnego Auth/Supabase/Edge |
| `node scripts/verify-frozen-ui.mjs` — 55 plików wyglądu | PASS, żaden chroniony plik wizualny nie zmieniony |
| Ten sam skrypt — dokładne przypięcie runtime | **Historyczny FAIL, obecnie PASS po aktualizacji opisanej na początku raportu**: przypina `PremiumEvents.tsx` i `PremiumTeams.tsx` do poprzedniego commita. Wykrywa celowe zmiany tego zadania; zatrzymuje się na PremiumEvents. Nie zmieniano strażnika, manifestu, hashy ani CI, aby to ominąć |
| Chromium z kontrolowanym adapterem profilu | PASS: 320/390/768, Dark/Light, brak overflow, znaczniki >=44 px, 6:5, zamiana/cofnięcie, transfer gościa, przywrócenie, profil/powrót |
| Pełny Supabase/Auth/HTTP/Cypress E2E | **NOT TESTED** w tym etapie; nie uruchamiano ani nie zmieniano baz. Dotychczasowy Cypress scenariusz dostosowano do przywracania baseline zamiast kasowania podglądu, lecz nie przypisano mu PASS |
| Fizyczny Android / systemowy back i przewijanie | **NOT TESTED**; brak synchronizacji Capacitor/APK/instalacji |

Nowych 8 testów obejmuje model, gości, UI i odczyt profilu: prawidłową projekcję, odmowę serwera, outsidera, błędny UUID odpowiedzi i spóźnioną odpowiedź po powrocie. Testy używają fikcyjnego transportu; nie są dowodem działania RLS na uruchomionym Supabase. Istniejące testy UI i runtime zachowano, dostosowując oczekiwania do nowej nazwy przywracania i stale wyłączonego zapisu.

Z `app/` można powtórzyć zakres: `npm run test.unit -- --run src/events/lineupEditor.test.tsx src/events/premiumUi.test.tsx src/auth/premiumRuntime.test.tsx`. Odtwarzalny render: `node scripts/test-lineup-editor-browser.mjs`; uruchamia i zamyka własne Vite/Chromium, dane testowe w ignorowanym `.cache/lineup-stage1`. Nie łączy się z Supabase i nie tworzy publicznego podglądu. Pełny guard runtime pozostaje niezaliczony do osobnego przeglądu zaakceptowanych zmian, zgodnie z AGENTS.md: „Zmiana strażników i CI wymaga osobnego przeglądu właściciela”.

### Rzeczywiste rendery React/Ionic — wyłącznie fixture UI

- [Boisko Dark](ui/lineup-editor-stage1/teams-dark.png).
- [Boisko Light](ui/lineup-editor-stage1/teams-light.png).
- [Transfer gościa](ui/lineup-editor-stage1/transfer-guest.png).
- [Istniejąca karta zawodnika](ui/lineup-editor-stage1/profile.png).

Zrzuty są z uruchomionych komponentów i jawnie fikcyjnego adaptera `groups_profile`, nie z rzeczywistej bazy i nie z programu graficznego. Obejrzano finalne rendery; murawa, oznaczenia drużyn i ramka Ultimate pozostały z istniejących komponentów. Ograniczono komunikaty nad boiskiem; informacja o braku serwerowego zapisu/autora jest również pod nim.

## Zakres plików

- Nowe: `app/src/events/lineupEditor.ts`, `lineupEditor.test.tsx`, `LineupPlayerProfile.tsx`, `app/scripts/test-lineup-editor-browser.mjs`.
- Zmiany integracyjne: `app/src/events/PremiumTeams.tsx`, `PremiumEvents.tsx` (tylko przekazanie kontekstu istniejącego profilu).
- Aktualizacja testów: `app/src/events/premiumUi.test.tsx`, `app/src/auth/premiumRuntime.test.tsx` (wyłącznie etykieta przycisku w teście), `app/cypress/premium-behavior.cy.ts`.
- Dokumenty: ten raport, `docs/STATUS.md`, dopisany wpis `docs/ODPOWIEDZI_CODEX.txt`, 4 zrzuty powyżej.

Backend, Auth, migracje, RLS, finanse, dane, grafiki, globalny CSS, geometria boiska, Ultimate, BottomNav, konfiguracja Vercel/Android i zależności są niezmienione. Nie wykonano operacji Supabase Cloud, migracji, resetów, merge ani wdrożeń.

## Ograniczenia wymagające etapu 2

1. Brak tabel/RPC składu, trwałego baseline i autora. Obecny baseline jest wyraźnie lokalnym punktem przywracania, nie rzekomym odczytem serwera. Podgląd znika po opuszczeniu meczu/restarcie.
2. Przyszły zapis wymaga aktywnego członkostwa, wersji składu i rosteru, transakcji, walidacji UUID uczestników, ochrony przed równoczesną edycją i idempotencji. Zapis bez rzeczywistej zmiany nie może aktualizować autora/czasu/wersji. Projekt: `PREMIUM_LINEUP_BACKEND_PLAN.md`; w tym etapie nie został wdrożony.
3. Po odebraniu członkostwa lub zmianie rosteru potrzebny serwerowy konflikt przy zapisie. Obecne lokalne kontrole UI nie są zabezpieczeniem backendu.
4. Rozszerzanie profilu na osoby spoza uprawnionego kontekstu grupy i udostępnianie zdjęć wymaga osobnego kontraktu, nie zgadywania na podstawie meczu publicznego.
5. Przed merge wymagany przegląd zmian przypiętego runtime i jawna decyzja właściciela o aktualizacji jego reguły zatwierdzeń. Nie zmieniano jej automatycznie.

## Git / wynik próby Draft PR — 2026-10-29 13:05 Europe/Warsaw

Commit implementacji **`6acde90598a7bd67ce97eb676089d5995bb8fe9e`** wypchnięto zwykłym pushem na `origin/feat/premium-lineup-editor-stage1`. Zdalna gałąź została utworzona. Końcowe uzupełnienie dokumentacji jest osobnym commitem po SHA implementacji.

**Draft PR NIE został utworzony:** żądanie `POST /repos/psuda87/sunday-league-mates/pulls` z `draft=true`, head etapu1 i base `chore/main-stabilization` zwróciło `Forbidden`. Odczyt PR24 przez API także był niedostępny; stan HEAD bazy sprawdzono natywnym Git. Nie pozyskiwano tokenów ani nie obchodzono blokady. Nie ma numeru PR, który można podać jako utworzony.

[Porównanie do utworzenia zależnego Draft PR](https://github.com/psuda87/sunday-league-mates/compare/chore/main-stabilization...feat/premium-lineup-editor-stage1?expand=1). Wybrać **Create draft pull request**, baza `chore/main-stabilization`, head `feat/premium-lineup-editor-stage1`. Proponowany tytuł: „Premium: odwracalna edycja składów i profile zawodników — etap 1”. Opis powinien zachować wynik FAIL strażnika runtime i NOT TESTED pełnego Supabase/Android, wraz z zakresem etapu2 z tego raportu. Bez merge i wdrożeń.

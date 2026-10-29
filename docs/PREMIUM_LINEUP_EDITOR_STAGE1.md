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
| Ten sam skrypt — dokładne przypięcie runtime | **FAIL / wymaga przeglądu**: przypina `PremiumEvents.tsx` i `PremiumTeams.tsx` do poprzedniego commita. Wykrywa celowe zmiany tego zadania; zatrzymuje się na PremiumEvents. Nie zmieniano strażnika, manifestu, hashy ani CI, aby to ominąć |
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

SHA implementacji i wynik utworzenia Draft PR zostaną dopisane po zapisaniu kodu.

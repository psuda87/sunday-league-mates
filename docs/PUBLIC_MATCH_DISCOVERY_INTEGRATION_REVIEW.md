# Public Match Discovery — przegląd integracyjny Cloud

2026-11-01 UTC. **PASS kontroli źródeł/frontendu; WARN ograniczeń; BLOCK aktywacji
CI i integracji bez decyzji właściciela oraz odbioru rzeczywistego backendu.**
Nie jest to zgoda na merge, deploy lub zmianę Supabase Cloud.

## Zweryfikowany punkt wyjścia

- Gałąź źródłowa: `feat/public-match-discovery-stage2b`, zdalny HEAD
  **`fd4fccdc1c22caa5f217625809689f336139a122`**. Taki sam ref `refs/pull/28/head`.
- Nowa gałąź przeglądu: `review/public-match-discovery-integration`, checkout czysty
  przed rozpoczęciem. Nie zmieniono gałęzi źródłowej ani istniejącej historii.
- Dokładne bazy porównania: Stage3B **e04d9a47560de36657da76f12ae63e20ef2299cb**,
  audyt2A **ddd3a3e2eaefdf449bc83c34c6335f42a2da4aab**. Zdalne refy potwierdzone.
- `main` nadal **134c52b1aee0d0804cc0cf71f151f95040e7a38f**. Main nie jest najnowszym
  skonsolidowanym runtime. Nie dodawać ponownie całych PR20–23 ani Auth18.
- Przeczytano AGENTS, STATUS, raport backendu2A, raport Stage2B, patche i manifesty
  review. Wyniki Windows z raportu2B traktowano jako historię, nie wyniki tej sesji.

## Backend, RLS i granice danych — bez nowej regresji w źródłach

Cały zestaw migracji i handler są bajtowo identyczne z **24a59e1**, badanym w2A.
Względem Stage3B dochodzą wyłącznie migracja42 i read/list delta handlera;
wszystkie41 historycznych SQL bez zmian. Stage2B nie zmienia żadnego SQL/handlera.

Przejrzano ponownie: session_valid, match_feed_visible, match_summary, delegację
matches_list, whitelist query i marker wersji. Publiczne query jest literalne,
max100 znaków, wyłącznie scope public, po nazwie grupy/meczu. Predykaty widoczności,
zakresu, okresu i query są przed LIMIT/OFFSET. Max100 DTO i lookahead101, brak
podnoszenia limitu przez klienta. Sortowanie starts_at+UUID rozstrzyga remisy.

Nowy helper to SECURITY INVOKER/pusty search_path/EXECUTE tylko service_role;
klient nie otrzymuje bezpośredniego dostępu. Service_role omija RLS, dlatego
rzeczywistą granicą są weryfikacja aktora/sesji w Edge oraz predykaty i ACL SQL.
Nie wystarczy samo włączenie RLS. Nie dodano grantów ani polityk.

Prywatne obce wydarzenia są wykluczone przed wyszukiwaniem/paginacją. Zwracany
summary nie dodaje prywatnych profili, członków, wpłat lub składów. Nazwa grupy,
UUID organizatora/grupy i cena samego wydarzenia są istniejącymi polami DTO,
nie uprawnieniem do prywatnych endpointów. Publiczne detail zachowuje dozwoloną
projekcję uczestników wydarzenia i zgód PR16, nie udostępnia katalogu całej grupy.
Nie dodano automatycznego członkostwa ani nowej ścieżki zapisów.

**Granica dowodu:** w tej sesji to przegląd źródeł i testy jednostkowe Edge z
kontrolowanym transportem. Nie ponowiono SQL/RLS ani rzeczywistego GoTrue/Edge.
Wcześniejsze52SQL/50lineups/HTTP/Chromium z raportu Windows nie są tutaj PASS.

## UI, sesje i współbieżność

Stage2B zmienia trzy pliki runtime: PremiumEvents.tsx, usePremiumEvents.ts,
premiumContracts.ts. Diff względem audytu jest zgodny z opublikowanym patchem.
Zachowano CSS, MatchHero/karty stadionowe, header, BottomNav, Ultimate, Auth,
finanse i składy. Obejrzano zapisane zrzuty2B Dark/Light: rzeczywiste renderowania
z testowego harnessu, nie dzisiejszy render Cloud ani odbiór telefonu.

- Istniejący selektor: Wszystkie/all, Moje grupy/groups, Publiczne/public;
  pozostają mine i konkretne grupy. Pole search tylko w public, istniejący styl.
- Debounce300ms, reset strony i natychmiastowe unieważnienie starej generacji.
  Nowy zakres nie czeka na stare żądanie. Identyczna strona/parametry współdzielą
  żądanie; stare odpowiedzi nie przywracają starego wyniku.
- Przy zmianie sesji/użytkownika: wyczyszczenie wyników/grup/query, anulowanie
  debounce i unieważnienie ticketów. SessionManager/B1 nadal kontrolują pokazanie
  danych; 503 nie jest obchodzone lokalną demonstracją lub fallbackiem danych.
- Marker1 i offset/limit/has_more/next_offset są walidowane. V1 renderuje stronę
  serwera bez lokalnego odsiewania/sortowania. Starszy backend zachowuje legacy
  feed, nowe zakresy nie udają udanego wyszukiwania.
- Brak istotnego błędu runtime wymagającego poprawki. Dziewięć testów kontrolera
  pokrywa m.in. stare odpowiedzi, debounce, paging, logout/zmianę konta i retry.
  Nie oznacza to pełnego testu wszystkich wyścigów na rzeczywistym serwerze.

## Aktywne przypięcia — technicznie ścisłe, zgoda właściciela osobno

| Kontrakt | Sprawdzony zakres |
|---|---|
| Backend | dokładnie migracja42 + handler z24a59e1 |
| Discovery UI | dokładnie trzy runtime z ae2fd9550b3688f80bfc69d811eb2423743b8329 |
| Historyczne migracje | dokładny zestaw i treść41 z e04d9a4; żadnej dowolnej43 |
| Premium | niezmieniony manifest55 i wszystkie jego pliki;10 granic importów |
| Pozostałe runtime | dotychczasowe historyczne piny, bez wildcardów lub nowych wyjątków |
| CI | aktywny helper/workflow/approval JSON wciąż identyczny ze Stage3B |

PASS45 policy = stare37+8 dodatkowych odmów. Sprawdzono SHA256 manifestów2B/CI,
backendowe dwa hashe2A oraz zgodność obu patchy runtime/active-pins z prawdziwym
diffem Git. Nazwanie źródła „approved” w kodzie nie zastępuje decyzji właściciela.

Stary `public-discovery-contracts-proposed.patch` i jego manifest wejść testowych
są materiałami **historycznymi2A**. Nie stosować ich do2B: git apply --check daje
oczekiwane „patch does not apply”, ponieważ piny zostały już zmienione. Backendowe
hashe nadal poprawne; stare hashe testów nie są nowym allowlist CI.

## Wykryta i poprawiona blokada NIEAKTYWNEJ propozycji CI

Przy niezmienionym patchu2B jego32 testy overlay przechodziły, ale nie sprawdzały
całego verify_sources ani komendy testowej workflow po aktualizacji helpera.
Nowy niezależny test pełnej ścieżki wykazał **15 błędów w uruchomieniu23 testów**:
syntetyczne repozytoria nie miały historii6d96391/discovery i nadal modelowały41.
To nowo odtworzona blokada propozycji, nie błąd Windows ani powód do pomijania testów.

Poprawiono tylko materiały w docs/review, bez aktywacji:

1. `public-discovery-ci-proposed.patch` obejmuje teraz również precyzyjną adaptację
   `test_lineups_ci_context.py`: syntetyczne base→Stage3B→discovery→CI,42 migracje.
   Zachowuje23 nazwy przypadków i asercje. Pozytywny test repin dotyczy jawnie
   przeglądanego helpera CI, nie dowolnej zmiany runnera; nowy gate ogranicza runner
   do dokładnej transformacji41→42. Próby samodzielnego zatwierdzenia zmian handlera,
   runnera i testów przez nowy pointer są niezależnie odrzucane.
2. Transformacja testów ma dokładnie trzy sprawdzane fragmenty starego źródła.
   Zmieniony/nieoczekiwany fragment jest odrzucany. Nie ma pomijania testów,
   wildcardu lub uznania wszystkich przyszłych zmian za dozwolone.
3. `public-discovery-ci-candidate.json`: pierwotny overlay18 do43f69a6 niezmieniony;
   osobno dodano SHA256 patcha i czterech przyszłych plików CI. Pozostałe źródła
   nadal dokładnie przypięte. Sam helper jest wiązany przez przyszły jawnie
   przeglądany implementation commit, nie przez samoprzypięcie.
4. Rozszerzony test overlay: **33 PASS**. Nowy `test_discovery_ci_full_gate.py`:
   **40 PASS** pełnej ścieżki i odmów oraz **23 PASS** proponowanego zestawu startu.
   Osobne temporary Git fixtures, bez Docker, zmiennych GitHub lub workflow launch.

Obecny aktywny source gate nadal prawidłowo **BLOCK**: wskazuje6d96391 i odrzuca
zmieniony premium-route-policy.mjs (dalej także resztę discovery/42). Nie przestawiano
approval JSON. Proponowany patch nie uruchamia dodatkowego joba discovery; aktualizuje
kontrakt istniejących suite SQL/Edge/UI. Realne testy discovery pozostają oddzielnym
warunkiem odbioru. Żaden lokalny test źródeł nie jest hostowanym PASS.

## Kontrole wykonane w tej sesji Cloud

| Kontrola | Rzeczywisty wynik |
|---|---|
| Pełny Vitest | **PASS361 /55 plików** |
| TypeScript app / strict Edge / pełny ESLint | **PASS** |
| Consolidation / runtime / visual | **PASS42 dokładne SQL /55 plików /10 granic** |
| Premium policy | **PASS45**, bez skip |
| Aktywne launch-contract Stage3B na Linux | **PASS23**, bez wcześniejszych błędów Windows |
| Lokalne preflight — czyste testy negatywne | **PASS9**, bez utworzenia bazy |
| Poprawiona NIEAKTYWNA propozycja CI | **PASS33 +40 pełnych source-check +23 proponowane launch-contract**, zakresy odrębne |
| LIVE, Premium-finance-local, Android-stage3 web, demo | **PASS4**; demo isolation16 |
| Zgodność hashy/diffów, brak zmian aktywnego app/CI | **PASS**, również git diff --check |
| Aktywny source gate / stary patch2A | **BLOCK / nie stosuje się**, oczekiwane odmowy |
| SQL/RLS, rzeczywiste GoTrue/Edge/PostgREST | **NOT RUN w Cloud tej sesji** |
| Nowy Chromium/Cypress/native Gradle/Windows/POCO | **NOT RUN** |
| Hosted Actions, deployment/migracje istniejących baz/Cloud | **NOT RUN** |

Docker lokalny jest dostępny (odczyt version/ps), ale istniejące runnery celowo
nie dopuszczają nowej gałęzi review. Faktyczna odmowa discovery nastąpiła **przed**
utworzeniem kontenera. Nie fałszowano nazw gałęzi, metadanych GitHub ani nie
poszerzano guardów, aby uruchomić DB. Żadnej nowej fixture/migracji bazy w tej sesji.

## Ryzyka i wymagane decyzje przed integracją

1. **Akceptacja zakresu kodu i aktywnych pinów:** backend24a59e1 (dwa pliki),
   UIae2fd95 (trzy pliki) i trzech strażników2B. To osobna decyzja właściciela;
   techniczny PASS niniejszego review jej nie zastępuje.
2. **Akceptacja poprawionej propozycji CI:** dokładne cztery przyszłe pliki i hashe
   z manifestu. Dopiero osobne zadanie może zastosować patch i utworzyć commit CI,
   a kolejny commit przypiąć pełne SHA implementation. Bez aktywowania jobów tutaj.
3. **Zgoda na rzeczywisty przebieg odbioru:** po potwierdzeniu bezpłatnego limitu,
   z izolowanym backendem42, osobne wyniki SQL/RLS i real GoTrue/Edge/UI. Wymagane
   zamknięcie leave/revoke z raportu2B oraz testy discovery. Opt-in repo i uruchomienie
   GitHub Actions wymagają odrębnego polecenia; nie ustawiano zmiennych.
4. **Decyzja o integracji po wynikach:** main nadal jest starszy. Należy ocenić
   zależny stos od Stage3B, a nie tylko diff PR28. Zachować historyczne commity
   potrzebne git show i ancestry; squash/rebase usuwające przypięte obiekty wymagają
   osobnego rozwiązania kontraktu. Nie scalać ponownie starych PR20–23/Auth18.
   Sama akceptacja review lub pinów nie jest zgodą na merge ani deploy/migrację Cloud.

Pozostają: offset bez snapshotu przy zmianach danych, globalna blokada advisory,
koszt skanowania/sortowania bez testu obciążeniowego. Backend działa jako zaufany
serwer z service_role; guardy źródeł są ochroną przed pomyłką, nie kryptograficzną
zgodą właściciela ani zamiennikiem uprawnień produkcyjnych. Odbiór Android safe area,
klawiatury i pracy po powrocie z tła wymaga telefonu. Profilu ani innych modułów
nie przebudowywano.

## Zakres publikacji tego review

Wyłącznie raport, STATUS, chronologiczny wpis ODPOWIEDZI_CODEX oraz nieaktywne
materiały CI w docs/review. Zero zmian app/, aktywnych guardów/workflow/pointerów,
Auth, RLS/migracji, finansów, składów, CSS/assets/native lub manifestu55.
Bez merge, rebase, deployu, płatnych zasobów, zmian repo variables, produkcyjnych
sekretów i Supabase Cloud. SHA implementacji review/publikacji dopisany poniżej.

## Publikacja

Commit raportu/poprawki propozycji/testów: `ea034e37a22e5cd20c5d87952f20a3f713382ef1`. Zwykły push
`review/public-match-discovery-integration` potwierdzony odczytem zdalnego refu.
[Dokładny diff review](https://github.com/psuda87/sunday-league-mates/compare/feat/public-match-discovery-stage2b...review/public-match-discovery-integration?expand=1).
Końcowe potwierdzenie publikacji jest osobnym commitem dokumentacyjnym, bez
zmian źródeł lub wyników. PR/Actions/merge/deploy nie wykonywano.

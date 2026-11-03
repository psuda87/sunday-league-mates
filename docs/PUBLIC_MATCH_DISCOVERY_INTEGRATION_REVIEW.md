# Public Match Discovery — przegląd integracyjny Cloud

## Aktualizacja Cloud 2026-11-03 22:58 UTC — Stage 2B już znajduje się w main

**PASS ponowionego przeglądu wskazanego historycznego Stage2B; WARN nieaktualnej
bazy zadania; BLOCK ponownego stosowania archiwalnych patchy CI do dzisiejszego
main.** Nie jest to ocena gotowości produkcyjnej obecnego main.

### Faktyczny stan Git

- Źródłowy `feat/public-match-discovery-stage2b` nadal ma HEAD
  **fd4fccdc1c22caa5f217625809689f336139a122** — bez nowych zmian aplikacji.
- Żądana gałąź review już istniała z nowym commitem
  **324fbdf7b01b039497ca444975337014671a0850**. Zachowano jego raport Windows oraz
  test60. Lokalną referencję przesunięto wyłącznie do istniejącego potomka po
  sprawdzeniu ancestry; bez merge, rebase, resetu lub nadpisania historii.
- Zdalny `main` jest obecnie na **1b6ee83356d53b7b34193af88802067dc9b2fede**:
  merge PR32 `release/slm-2.0-rc`, zawierający też merge PR33. Git merge-base
  --is-ancestor potwierdza, że **całe Stage2B/fd4fccd jest już przodkiem main**.
- Main zawiera również Stage2C **d7b36eee379acf5036f8ea8aaeeea5f7791c8a04**
  i osobne przypięcie **cb63962e0ff4ccfbc4fb7157e4627beeee5ae8d5**. Obecny
  CI implementation main to **2f4adedfbaeb2dd1e69f8dc22c62823fc2f0c168**.
  Są już **44 migracje**, nie42. Migracja discovery42 jest nadal niezmieniona.

Wnioski dawnych raportów „main jest starszy” i „należy dopiero aktywować CI2C”
są historyczne. **Nie scalać ponownie Stage2B i nie stosować starego patcha41→42
lub dawnego pointera do main44.** Niczego nie cofano do historycznej wersji.

### Niezależna ponowna kontrola wskazanego splotu źródeł

Ponowiono porównania do Stage3B/e04d9a4 oraz audytu2A/ddd3a3e. Na gałęzi review
całe app/ i aktywne CI są niezmienione względem fd4fccd; backend odpowiada dokładnie
24a59e1. Od ostatniego review zmieniły się tylko dokumenty i pomocniczy test guardów.
Poprzednią analizę session_valid, service-only invoker ACL, predykatów widoczności,
filtrów przed LIMIT/OFFSET i minimalnego DTO sprawdzono względem tych samych źródeł.
Nie znaleziono nowej zmiany backendu lub błędu bezpieczeństwa wymagającego poprawki.
RLS nie chroni przed service_role: nadal istotne są kontrola sesji i uprawnień SQL.

Trzy UI runtime są nadal dokładnieae2fd95; kontrola generacji odpowiedzi, debounce,
resetu strony, walidacji marker/paging i kasowania danych po zmianie sesji pozostała
bez zmian. Ponowiono testy kontrolera i negatywne mutacje runtime/backendu/41SQL.
Manifest55, karty, CSS, Ultimate, BottomNav, Auth, finanse i składy nie były zmieniane.
To przegląd historycznego2B — późniejsze zmiany main w tych modułach **nie są objęte
pełnym nowym audytem** ani poniższym wynikiem361Vitest.

### CI i faktycznie wykonane kontrole tej sesji Cloud Linux

| Kontrola na gałęzi review/Stage2B | Wynik 2026-11-03 22:58 UTC |
|---|---|
| Vitest | **PASS361 /55 plików** |
| TypeScript aplikacji / strict Edge / pełny ESLint | **PASS** |
| Consolidation / visual / import boundaries | **PASS42 /55 /10** |
| Premium policy | **PASS45**, bez skip |
| Negatywne rzeczywiste Premium/consolidation | **PASS60**, wszystkie41 historycznych SQL i dodatkowa43 |
| Aktualny tu zestaw launch-contract | **PASS23** Linux |
| Negatywne preflight bez tworzenia bazy | **PASS9** |
| Archiwalna nieaktywna propozycja CI | **PASS33 overlay +40 pełnego gate'u +23 proponowanych launch-contract** |
| LIVE / Premium-finance-local / Android-stage3 web / demo | **PASS4**, izolacja demo16 |
| Historyczny aktywny source gate2B | **BLOCK oczekiwany** na premium-route-policy.mjs; to nie wynik gate'u main |
| SQL/RLS, GoTrue/Edge/PostgREST, Chromium/Cypress | **NOT RUN w tej sesji** |
| Windows/native Gradle/telefon i GitHub-hosted Actions | **NOT RUN w tej sesji** |

Wyników SQL/HTTP/Android z innych sesji nie zaliczano ponownie. Nie uruchamiano
Docker fixture ani migracji; nie fałszowano kontekstu GitHub lub gałęzi runnera.
Nie zmieniano helperów, przypięć, workflow, zmiennych repozytorium ani planu opłat.
Materiały CI z tego review zachowano jako audyt historyczny; nie dodano kolejnej
konkurencyjnej implementacji obok już zintegrowanego Stage2C.

### Bieżące ograniczenia i rzeczywiste decyzje właściciela

1. **Nie ma już decyzji o ponownej integracji Stage2B do main:** ancestry dowodzi,
   że kod wszedł do repozytorium. Nie wnioskujemy z tego o deployu lub gotowości
   produkcyjnego Supabase — tego nie sprawdzano i nie zmieniano.
2. Jeżeli celem jest gotowość **obecnej aplikacji**, zatwierdzić osobny zakres
   przeglądu `main` **1b6ee83356d53b7b34193af88802067dc9b2fede** (lub wtedy nowszego,
   ponownie zweryfikowanego HEAD), wraz z jego aktualnymi44 migracjami i kontraktami.
   Nie przenosić na main historycznego wyniku PASS dla42.
3. Przed hostowanym odbiorem nadal potrzebne jest odrębne polecenie uruchomienia
   Actions po potwierdzeniu darmowego limitu/opt-in oraz zgoda na testy wyłącznie
   w nowym izolowanym backendzie **zgodnym z wybranym aktualnym SHA**. W tym zadaniu
   nie ustawiano zmiennych ani nie aktywowano jobów.
4. Odbiór telefonu, rzeczywistej sesji/uprawnień i test obciążenia nie są pokryte
   testami źródeł. Znane ograniczenia offsetu bez snapshotu, skanowania i globalnego
   locka pozostają ryzykiem historycznego API. Nowa zgoda na deploy/migracje Cloud
   byłaby osobną decyzją, której nie zakładamy.

Ta kontynuacja dodaje wyłącznie aktualizację raportu, STATUS i chronologiczny wpis
ODPOWIEDZI_CODEX. Nie zmienia kodu, patchy CI, przypięć lub guardów i nie otwiera PR.
Wszystkie wcześniejsze raporty i zmiany z324fbdf zachowane. W tej sesji nie wykonano
żadnego merge; wykryty merge PR32 był już obecny na origin przed rozpoczęciem.

---


## Aktualizacja 2026-11-02 — ponowny niezależny przegląd, faktyczne środowisko Windows

**PASS ponowionych kontroli źródeł/frontendu i nieaktywnego overlay CI; WARN środowiska; BLOCK aktywnego source gate Stage2B.** Nie aktywowano CI, nie zmieniono repo variables ani aplikacji. Poniższy pierwotny raport Cloud pozostaje historycznym zapisem wcześniejszej sesji, nie nowymi wynikami z Windows.

### Stan Git i kontynuacja istniejącej pracy

Stage2B nadal `fd4fccdc1c22caa5f217625809689f336139a122`. Gałąź żądana przez właściciela **już istniała** na origin pod `22b2e61936adba117452a108eedda147aff4ae4e`, z przeglądem `ea034e3` i poprawionymi materiałami CI. Nowy oddzielny worktree kontynuuje tę historię przez zwykłe przesunięcie fast-forward lokalnej referencji — bez merge, resetu, force push, powielania implementacji lub nadpisania zdalnej gałęzi. Zastane zmiany i inne worktree zachowano.

Narzędzia dostępne w tej sesji wskazywały lokalny PowerShell/Windows i `I:\slm\sunday-league-mates`, a nie Cloud Linux. Nowych wyników nie przypisujemy do Cloud. Zainstalowane zależności udostępniono przez junction dopiero po sprawdzeniu identycznego package.json/package-lock względem dostępnego RC. Bez instalacji dodatkowych narzędzi. Docker nie odpowiadał i nie został uruchomiony; próba utworzenia symlinka w nowym katalogu tymczasowym potwierdziła WinError1314.

### Ponowiony review rzeczywistego kodu

- Migracja42 i handler nadal odpowiadają dokładnie24a59e1; każda z41 migracji Stage3B pozostaje identyczna. Migracja zastępuje wyłącznie oczekiwaną gałąź list dispatchera; nie dodaje tabel/polityk/grantów do klientów i nie zmienia mutacji Auth/finance/lineups.
- Prześledzono session_valid, match_feed_visible, match_summary oraz Edge actor/session → scoped RPC. Helper SECURITY INVOKER, pusty search_path, EXECUTE tylko service_role. RLS nie stanowi ochrony przed service_role: ochronę stanowią aktualna sesja, predykaty widoczności i uprawnienia w wywoływanej funkcji. Listowanie/scope/query filtrują przed LIMIT101/OFFSET, następnie emitują100 rekordów i has_more/next_offset. Prywatne obce wydarzenia nie są kandydatami wyszukiwania.
- Query jest literalne (position/lower, bez interpolowanego SQL lub wzorców LIKE), max100 znaków, wyłącznie public. Deterministyczne starts_at+UUID nie usuwa znanej granicy offsetów przy równoczesnej zmianie danych. Publiczny wynik nie tworzy członkostwa ani dostępu do finansów/składów/profili grupy.
- Trzy rzeczywiste runtime nadal odpowiadają ae2fd95. Sprawdzono generacje i in-flight refresh, zmianę scope/query, debounce300ms, reset strony, odrzucenie spóźnionego wyniku, walidację markera1/metadanych strony, clear przy zmianie fazy sesji/użytkownika. B1/SessionManager nadal ukrywa chronione dane podczas recheck; brak demo fallback. Utrata członkostwa wybranej grupy resetuje zarówno selektor, jak i query serwera.
- Manifest55, CSS, karty, header, nawigacja i Ultimate są niezmienione. Opublikowane runtime.patch i active-pins.patch porównano z faktycznym git diff audytddd3a3e→43f69a6: zgodne. Nie stwierdzono nowego istotnego błędu runtime wymagającego zmiany przypiętych źródeł.

### CI i ograniczenia guardów

Nieaktywny patch poprawiony wcześniej w ea034e3 nie został zastosowany do app. Ponowiono33 pozytywne/negatywne kontrole z kanonicznego klonu testowego (`core.autocrlf=false` wyłącznie w nowym klonie), w tym hash patcha i czterech przyszłych źródeł, zachowanie23 nazw przypadków, dokładny overlay18 oraz niezmienione walidatory repo/event/SHA/ancestry/local Docker/resources/cleanup. Nie aktualizowano manifestów pod wynik testu.

Wykonano również60 niezależnych kontroli aktualnych Premium/consolidation w nowej kopii tymczasowej. Odrzucono dodatkową migrację43, zmianę każdej z41 historycznych migracji,42/handlera, Auth/vault, finansów, składów i UI. Znana granica: sam runtime policy nie przypina treści migracji restore_pr16 z20261028204500, natomiast obowiązujący consolidation ją odrzuca; nie przypisujemy pojedynczemu policy ochrony, której nie zapewnia. Checker: [test_discovery_runtime_guards.mjs](review/test_discovery_runtime_guards.mjs).

Aktywny source gate faktycznie odrzucił checkout na `app/scripts/premium-route-policy.mjs`, ponieważ pointer wciąż wskazuje Stage3B/6d96391. Jest to oczekiwany **BLOCK**, nie PASS ani nowa regresja. Nie przestawiono wskaźnika. Historyczne40 kontroli pełnego proposed verify_sources +23 proposed launch-contract z wcześniejszego Cloud **nie były ponawiane** w tej sesji: pełne testy wymagają m.in. rzeczywistego symlinka, którego ten Windows nie umożliwia. Nie pomijano asercji, nie fałszowano GitHub env.

Istnieje już także osobna gałąź Stage2C `chore/public-discovery-stage2c`/e246c51 z implementacją CI d7b36ee i osobnym pointerem cb63962. Nie przenoszono jej wstecz do Stage2B. Przed integracją właściciel powinien wybrać zachowanie istniejącej historii Stage2C albo osobną aktywację propozycji z tego review; nie stosować dwóch konkurencyjnych kontraktów ani historycznego patcha2A do już przypiętego backendu.

### Testy faktycznie wykonane w tej kontynuacji

| Kontrola | Wynik 2026-11-02 |
|---|---|
| TypeScript aplikacji / strict Edge / ESLint | **PASS**, TS w buildach |
| Vitest | **PASS361/55 plików**, w tym testy Edge/discovery i UI/controller |
| Premium policy | **PASS45/45** |
| Consolidation/visual/imports | **PASS42/55/10** |
| Backend/UI/historia/manifest/patche | **PASS**, rzeczywiste porównania Git i treści |
| Negatywne Premium/consolidation | **PASS60**, prywatna kopia i przywracanie stanu |
| Negatywne preflight bez Dockera | **PASS9** |
| Nieaktywny CI overlay | **PASS33**, kanoniczny klon testowy, bez CI launch |
| Buildy web | **PASS6**: default, premium-local, live-local, premium-finance-local, android-stage3, demo; izolacja demo16 |
| Aktywny CI source gate | **BLOCK oczekiwany**, brak aktywacji kontraktu discovery |
| Pełny proposed gate40 i active/proposed launch-contract23 | **NOT RUN ponownie**, brak właściwego Linux/symlink; wcześniejsze Cloud wyniki oddzielnie poniżej |
| SQL/RLS, real GoTrue/Edge/PostgREST, nowy Chromium | **NOT RUN**; Docker niedostępny, brak nowej bezpiecznej fixture |
| Native Gradle, Windows UI/Android Studio i telefon | **NOT RUN**; web Android build nie jest testem APK/telefonu |
| GitHub-hosted/Actions, deploy/migracje/Cloud | **NOT RUN**, brak dispatch/aktywacji/płatnych zasobów |

### Werdykt i dokładne decyzje przed integracją

1. Zatwierdzić dokładne źródła backend24a59e1 (2 pliki), runtimeae2fd95 (3 pliki) i aktywne zmiany trzech guardów Stage2B; bez zmiany55 i rozszerzenia zakresu na inne moduły.
2. Wybrać kontrakt CI: zachować już istniejący stos Stage2C/d7b36ee→cb63962 po jego review albo osobno zatwierdzić poprawioną nieaktywną propozycję i pełne testy w Linux, commit implementacji, potem osobny pointer. Ta sesja nie aktywuje żadnej opcji ani Actions.
3. Przed uznaniem całej integracji za odebraną zapewnić odbiór izolowanego backendu42, w tym brak obcych prywatnych wyników, RLS/HTTP, leave/revoke oraz sesje/wyścigi. Wyniki Windows/Cloud historycznych testów nie są dowodem wykonania tych scenariuszy teraz. Osobny hosted run tylko po decyzji o darmowym limicie/opt-in; nie jest konieczne automatyczne uruchamianie Actions w tym zadaniu.
4. Wydać osobną decyzję o merge dopiero po rozstrzygnięciu powyższego; zachować ancestry i pełne źródłowe SHA. Żadnej zgody na deploy/migracje Cloud nie wywodzić z technicznego PASS.

Pozostają znane ryzyka: offset bez snapshotu, globalny advisory lock/koszt skanowania i brak bieżącego testu obciążenia/odbioru rzeczywistego backendu. **Nie ma nowej poprawki aplikacji:** kontynuacja dodaje ten raport i odtwarzalny test negatywny, a wcześniej przygotowane poprawki CI pozostają wyłącznie w docs/review. App, workflowy, aktywne piny, zmienne repo i sekrety bez zmian.

---

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

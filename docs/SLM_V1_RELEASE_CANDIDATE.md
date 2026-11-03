# SLM1.0 — zintegrowany kandydat do testów

30.10.2026, Europe/Warsaw. Gałąź `feat/slm-v1-release-candidate`, worktree `I:\slm\sunday-league-mates\.worktrees\slm-v1-release-candidate`. **PASS technicznego kandydata i buildów; WARN zakresu produktu; BLOCK wdrożenia pełnego RC do obecnego Cloud.** Nie deklarujemy gotowej produkcyjnej wersji1.0.

## Historia i baza

Gałąź utworzono z dokładnego Stage2C `e246c514af0fbca79dee892d9aa0e31b937a83c3`. Po fetch potwierdzono aktualne HEAD wszystkich zależności z [mapy](PUBLIC_MATCH_DISCOVERY_INTEGRATION_MAP.md): main134c52b→stabilizacja39ef2e3→Stage1b30908e/fix7ad5c75→lineups2A3b00ec2→lineups2B58a9bab→CI3A45d9a4d→CI3Be04d9a4→discovery24a59e1→audytddd3a3e→discovery2Bfd4fccd→2Ce246c51. Wszystkie kolejne krawędzie ancestry sprawdzono przez Git. Stage2C już zawiera cały ten stos; dodatkowy merge/rebase/cherry-pick nie był potrzebny.

Aktualny `origin/main=134c52b1aee0d0804cc0cf71f151f95040e7a38f` jest przodkiem kandydata. Lokalny branch maina46f5e4 pozostawiono. Poprawna baza ewentualnego Draft PR całego stosu to ten zweryfikowany main; PR27/28/29 zachowują własne bazy i status Draft, nie są automatycznie zamykane. Nie wykonano merge do main. [HEAD/SHA wszystkich zależności](review/rc-release-evidence.json).

## Review zakresu względem main

W stosie96 plików app różni się od origin/main; to odziedziczone zmiany zatwierdzonych etapów i testów, nie96 nowych zmian tego zadania. **Drzewo app RC jest identyczne z e246c51**, bez zmian funkcjonalnych lub guardów. Historyczne35 migracji main zachowane; kolejnych7 daje dokładne42. Wzorzec55 i manifest bez zmian.

Eksperymentalny Auth18/`845d35e1bc644be5935d3658ed1e3a57cd74b518` nie jest przodkiem. Żadna z9 migracji obecnych wyłącznie w tamtym stosie nie występuje w RC; brak niezatwierdzonych emailProof/onlineClient/account_model_candidate. Nie scalano całych PR18/19/20–23. Istniejący handler ma odziedziczone funkcje e-mail za flagą domyślnie niewłączoną; ich obecność nie jest aktywacją nowego Auth18. Flagi/signup/SMTP nie zmieniano.

| Moduł | Faktyczny stan kodu RC |
|---|---|
| Auth/sesja |istniejący model main, login/telefon i kompatybilność istniejących kont e-mail; Keystore, recheck, logout; bez aktywacji nowego signup/recovery|
| Profil/grupy/prywatność |rzeczywiste API, własny profil/foto/numer, grupowe zgody i uprawnienia; statystyki LIVE jawnie niedostępne|
| Mecze/zapisy/goście/rezerwa |rzeczywiste kontrolery i SQL, członkostwo oraz public/private; tworzy aktywny członek|
| Finanse |ledger/FIFO/należności/wpłaty/nadwyżki grupowe; aktualny aktywny admin grupy, bez eskalacji z created_by lub dawnej/globalnej roli|
| Składy2A/2B |trwały zapis A/B, członkowie/goście, CAS/roster/idempotencja/no-op, bez fałszywego autora lub sukcesu|
| Public discovery |scopes all/groups/public/mine/group, query, marker1, has_more/next_offset, debounce/stale response/logout|
| Push |SQL i kod worker/FCM obecne, ale nie potwierdzono działania usługi i dostarczenia; Cloud nie ma workera|
| Premium3.18 |zachowany wygląd; pełny real-data wariant jawny Premium/Android Stage3; domyślny LIVE/Home nieprzełączony|
| Pełna specyfikacja1.0 |nie można potwierdzić kompletności: docelowa samorejestracja e-mail jest odłożona, oceny/statystyki i automatyczny dobór drużyn nieukończone; ręczne trwałe składy nie są algorytmem wyrównywania|

To kandydat istniejącego zatwierdzonego stosu do odbioru, nie samowolne uzupełnienie wszystkich historycznych propozycji specyfikacji. Przed nazwaniem całości pełnym1.0 właściciel musi jawnie rozstrzygnąć wymagania odroczone oraz wybór domyślnego wejścia i transportu HTTPS. Nie dodawano tych modułów w tym zadaniu.

## Ścisłe przypięcia

- Backend: `24a59e104bfe80b4d2f41cbd0ad02b58fc546040`, dokładnie handler i42; wcześniejsze41 identyczne z e04d9a4.
- Runtime UI: `ae2fd9550b3688f80bfc69d811eb2423743b8329`, dokładnie PremiumEvents/usePremiumEvents/premiumContracts;55 plików i inne wyjątki zachowane.
- CI: kod/testy `d7b36eee379acf5036f8ea8aaeeea5f7791c8a04`, osobny pointer `cb63962e0ff4ccfbc4fb7157e4627beeee5ae8d5`, dokładny overlay18 z43f69a6 nad6d96391/bazą45d9a4. Nie zmieniano pól/zakresów ani workflow.

Ponownie sprawdzono rzeczywiste źródła, manifest, ancestry, CI source gate na zwykłym klonie Git w Linux oraz pełny diff app. Obiekty/ancestry pozostają. Nie squashować ani rebase’ować przypiętych commitów; szczególnie pary d7b36ee→cb63962. W przeciwnym razie potrzebne nowe osobne review implementacji i następny commit metadata; automatyczny rehash nie jest naprawą.

## Faktyczne testy tej sesji

| Zakres | Wynik |
|---|---|
| ESLint / TypeScript aplikacji / strict Edge |**PASS**; TS także w każdym buildzie|
| Vitest |**PASS361 /55 plików**|
| Premium policy |**PASS45**|
| Consolidation/visual/imports |**PASS42/55/10**|
| Linux kontrakt/source |**PASS26**, rzeczywisty source gate z implementationd7b36ee,10 rzeczywistych odmów nieautoryzowanych zmian; klon branch RC wskazywał e246c51|
| Baza referencyjna z tego zadania |**PASS42 replay oraz syntetyczne dane7→42**, zachowanie legacy/rola/mapowanie/RLS47/ACL discovery; PostgreSQL, minimalne kontrakty Auth/Storage, nie GoTrue HTTP|
| Cloud audyt odczytowy |**WYKONANY**:7 wersji, katalogi, Edgev6, advisory, booleany danych/owner; żadnych mutacji|
| Web buildy |**PASS6**: build, premium-local, live-local, premium-finance-local, android-stage3, demo; izolacja demo16|
| Android |**PASS** Capacitor sync + assembleDebug offline, ponownie po przenośnych ścieżkach pluginów; inspekcja ZIP/API/CSP/config|
| GitHub-hosted / Cloud restore / Cloud deployment |**NOT RUN**; status Actions sprawdzany przy publikacji, bez ręcznego dispatch lub zmiany opt-in|
| Real GoTrue/Edge HTTP/Chromium/Cypress w tej sesji |**NOT RUN**; kod, zależności i runtime aplikacji identyczne z2C, wcześniejszych PASS nie zaliczano ponownie. Nowa różnica środowiska Cloud7 została zbadana osobną referencją SQL|
| Emulator Run/debug UI i fizyczny POCO |**NOT RUN**, APK nie instalowano; jedynie dostępność AVD/WHPX i build|

Zachowane granice Stage2C: pojedynczy runtime policy nie porównuje treści migracjiPR16, ale pełne consolidation i source gate ją chronią. Windows symlink wymaga uprawnienia; w tej sesji uruchomiono rzeczywiste testy Linux26, nie ponawiano Windows SourceTests i nie przypisano im odziedziczonego PASS. Nie rozluźniano testów ani guardów.

## Supabase: gotowość BLOCK

Cloud ma **7/42 migracji**,13 tabel aplikacji i tylko accounts v6; brak Storage bucketów i push-worker. Metadata badanego prefiksu7 (funkcje, kolumny, polityki) zgadza się z kanoniczną referencją, lecz3 historyczne wpisy SQL mają inne hashe. Brak pełnego restore rzeczywistych danych i diff wszystkich obiektów, konfiguracji Auth/secrets oraz zatwierdzonego przełączenia klienta HTTPS. Nie należy teraz deployować RC ani używać istniejącego Cloud jako pełnego backendu testowego.

[Audyt i kompletny plan backup/diff/migracji/rollback — bez wykonania](SUPABASE_RC_DEPLOYMENT_PLAN.md). Obecny pojedynczy admin legacy spełnia preflight mapowania; nie odczytywano jego tożsamości ani nie zmieniano kont. Nowa fixture `slm-rc-reference-7ecd4b5224ce` zatrzymana/zachowana; żadnej migracji używanej bazy telefonu lub Cloud.

## Android Studio: build gotowy, LIVE wymaga backendu42

[Dokładne polecenia i debug](ANDROID_STUDIO_RC.md). APK lokalny Premium Stage3, API `http://127.0.0.1:64321/functions/v1/accounts`, Keystore, logging none/WebView debug false. SHA256 **ca6de17a63b6de01f461b49bde95c8b2403edc6c809115b3a369cf585f70e1fc**. Źródła natywne niezmienione. Nie jest to zatwierdzony produkcyjny build HTTPS.

Wymagane następne kroki są konkretne:

1. Review RC i zakresu1.0: zatwierdzić/odroczyć samorejestrację, oceny/statystyki/algorytm i push; zaakceptować docelowy routing/HTTPS oraz zachowanie historii i pinów. Nie scalać istniejących Draft PR automatycznie.
2. Osobno autoryzować zabezpieczenie i restore Cloud do kopii, rozstrzygnąć3 historyczne różnice i pełny katalog, a na kopii odtworzyć8–42 i przetestować rzeczywiste legacy/Auth/finance. Dopiero potem rozważyć wykonanie planu Cloud; bez resetu lub migration repair dla uzyskania PASS.
3. Dla odbioru emulatora przygotować nowy zgodny pełny backend42 (lub po osobnej zgodzie zweryfikowany Cloud i klient HTTPS), wykonać pełny login→grupy→mecze→goście→składy→discovery→finanse→logout i opcjonalny rzeczywisty hosted CI we właściwym, zatwierdzonym kontekście. POCO pozostaje osobnym etapem.

W repo zapisano wyłącznie raporty, metadane bez PII, manifest42 i odtwarzalny test nowej referencji. Prywatne źródła odczytanego Edge są tylko w ignorowanym cache, nie zawierają eksportu sekretów; bundle Git i APK również nie są publikowane. Sześć zastanych usług SLM pozostawiono; główne worktree z sześcioma zmianami właściciela zachowane. Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

## Publikacja i faktyczny CI

Raport/testy referencyjne opublikowano w `01538e35e24d241f99f0840ca355da11abd62e72`. Utworzono [Draft PR #30](https://github.com/psuda87/sunday-league-mates/pull/30) do zweryfikowanego main134c52b; API potwierdza open/draft, merged=false, mergeable=true. Nowa gałąź zachowuje41 commitów całego stosu względem main i pełne wymagane ancestry; nie jest squash integracji. PR27/28/29 pozostają open/draft z niezmienionymi HEAD i bazami.

Dla01538e3 GitHub API zwróciło dwa workflowy z pull_request: frontend/run41115653939 i isolated integration/run41115653617, oba completed/**skipped**. Oznacza to **hosted testy NOT RUN**, a nie PASS. Nie uruchamiano workflow_dispatch i nie zmieniano zmiennych opt-in ani workflow. Kolejny commit jedynie dopisuje potwierdzenie publikacji. [Porównanie całego stosu](https://github.com/psuda87/sunday-league-mates/compare/main...feat/slm-v1-release-candidate).

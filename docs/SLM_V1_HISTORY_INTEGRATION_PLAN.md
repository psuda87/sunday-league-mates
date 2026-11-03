# SLM v1.0 — plan integracji z zachowaniem historii

2026-11-02 18:03 Europe/Warsaw. **PASS aktualnych źródeł, ancestry i kompatybilności istniejącego testowego merge; WARN końcowej integracji, która wymaga decyzji właściciela.** Nie wykonano żadnego merge/rebase/squash, deployu, migracji baz ani aktywacji Actions. Nie zmieniono kodu aplikacji, guardów lub pinów.

## Zweryfikowany stan

Po `git fetch origin` i bieżących odczytach GitHub API:

| Element | Dokładny HEAD / stan |
|---|---|
| Zdalny main | `134c52b1aee0d0804cc0cf71f151f95040e7a38f` |
| PR24, chore/main-stabilization → main | `39ef2e3937b781439864029a92c12de315024263`, open/Draft, merged=false, mergeable/clean |
| PR28, discovery2B → audit/public-match-discovery-backend | `fd4fccdc1c22caa5f217625809689f336139a122`, open/Draft, merged=false, mergeable/clean; baza `ddd3a3e2eaefdf449bc83c34c6335f42a2da4aab` |
| PR29, Stage2C → Stage2B | `e246c514af0fbca79dee892d9aa0e31b937a83c3`, open/Draft, merged=false, mergeable/clean |
| Odbiór backend42 | `test/public-discovery-backend42-acceptance`, źródłowy commit `ae6bb4be2eafb9e5a8e70ef695242b40cc5d54cc` |
| Docelowa gałąź przygotowawcza / PR30 → main | **feat/slm-v1-release-candidate**, `1575bef77f0b24a8c74373018895b7b872ebc06a`, open/Draft, merged=false, mergeable/clean |
| PR31 → RC, osobny zakres | `1b3aed659749f1084cab8cd4f47f99a54a50c8b9`, open/Draft, nie jest częścią sprawdzanego RC |

Lokalny branch main nadal wskazuje starszy a46f5e4; do analizy użyto aktualnego **origin/main**, nie zmieniano lokalnego brancha. Zachowano niezacommitowane notatki RC/Stage2C i sześć zmian właściciela w głównym worktree.

Ponownie potwierdzono każdą krawędź ancestry:

`main134c52b → stabilizacja39ef2e3 → Stage1b30908e → kontrakt7ad5c75 → lineups2A3b00ec2 → lineups2B58a9bab → CI3A45d9a4d → CI3Be04d9a4 → discovery24a59e1 → audytddd3a3e → discovery2Bfd4fccd → CId7b36ee → pointercb63962 → Stage2Ce246c51 → acceptanceae6bb4b`.

Pełne SHA wszystkich krawędzi i rzeczywiste różnice historii: [dowody Git](review/slm-v1-integration-history.json). Aktualny RC i acceptance mają wspólnego przodka **e246c51**. RC ma cztery późniejsze commity dokumentacyjne, acceptance jeden commit raportu/testu. Żadna gałąź nie zawiera wszystkich dokumentów drugiej. **Całe app, .github i AGENTS.md są identyczne** między RC, acceptance i pobranym testowym merge PR30.

## Zakres i ścisłe kontrakty

- Konsolidacja PR24 już selektywnie zachowała potrzebne zmiany PR20–23 i jest przodkiem RC. PR20 nadal bazuje na eksperymentalnym Auth; cały ten historyczny stos pozostaje osobny. **Nie scalać PR20–23 ponownie.** PR18 `845d35e1bc644be5935d3658ed1e3a57cd74b518` nie jest przodkiem żadnego z trzech sprawdzonych kandydatów. Żadna migracja występująca wyłącznie w tym stosie Auth względem main nie występuje w RC.
- Backend handler i migracja42: dokładnie `24a59e104bfe80b4d2f41cbd0ad02b58fc546040`. Sprawdzono niezależnie treści plików i identyczność obiektów wszystkich41 wcześniejszych SQL względem e04d9a4. Dokładnie42 migracje, bez43.
- Trzy pliki runtime discovery: dokładnie `ae2fd9550b3688f80bfc69d811eb2423743b8329` (PremiumEvents, usePremiumEvents, premiumContracts). Manifest Premium55 zachowany.
- Kod/testy CI: dokładnie **d7b36eee379acf5036f8ea8aaeeea5f7791c8a04**. Pointer: niezmieniona treść z **cb63962e0ff4ccfbc4fb7157e4627beeee5ae8d5**, nadal wskazuje d7b36ee i historyczną bazę45d9a4d. Oba oryginalne commity muszą zostać przodkami końcowego main.
- Nie scalać PR31 automatycznie: zawiera osobne poprawki Android Safe Area, selektora i formularza gościa oraz własne rozszerzenie kontraktu CI. Zachowanie go jako osobnego etapu jest konieczne dla tego dokładnego kontraktu. Obecny RC nie jest najnowszym zakresem poprawek Androida ani implementacją wszystkich planowanych statystyk/ocen/nowego Auth.

## Dokładny kandydat i merge commit

Pobrano **istniejący obiekt GitHub** `refs/pull/30/merge`, SHA **e73041ab60873cc420a2c2169aec14ffa4a1128b**. Nie tworzono własnego merge commita ani nie przesuwano gałęzi. Jego rodzice, w kolejności wymaganej przez validator:

1. `134c52b1aee0d0804cc0cf71f151f95040e7a38f` — aktualny main.
2. `1575bef77f0b24a8c74373018895b7b872ebc06a` — aktualny RC.

Drzewo **całego repo** merge jest identyczne z RC (`125df7422cf1dd995dd72ee6d72a1cdeb827c918`). Source gate przeszedł na tym konkretnym merge, na RC1575bef i na źródłowym acceptanceae6bb4b. Zwykły merge jest więc kompatybilny z obecnymi pinami i ancestry. To nie oznacza uruchomienia hosted kontekstu lub zatwierdzenia przyszłego, jeszcze nieistniejącego SHA.

Po dołączeniu dokumentów acceptance do RC lub zmianie main GitHub wygeneruje **inny** testowy merge. Dzisiejszy e73041a nie obejmuje jeszcze historii acceptanceae6bb4b. Nie przypisujemy mu takiego ancestry i nie deklarujemy PASS przyszłego commita. Nowy konkretny HEAD i jego merge ref wymagają ponownej krótkiej kontroli źródeł/rodziców.

## Faktyczne kontrole tej sesji

| Kontrola | Wynik |
|---|---|
| Aktualne refs/PR API,14 krawędzi ancestry, wykluczenie Auth18 | **PASS** |
| Niezależne porównanie backend/UI/CI/pointer i41+1 SQL | **PASS** |
| Rzeczywisty source gate trzech dokładnych checkoutów | **PASS**, wskazuje d7b36ee |
| Linux syntetyczne kontrakty, w tym symlink/workflow | **PASS26/26**, poprzednia granica Windows1314 nie występuje w tym uruchomieniu Linux |
| Celowe naruszenia rzeczywistych źródeł na PR30 merge | **PASS10 odmów**: PR16 SQL, handler, Auth, finanse, składy, discovery runtime, chronione UI, helper CI, testy CI, dodatkowa43; przywrócony baseline i czyste klony |
| Premium policy | **PASS45/45** na aktualnym RC |
| Consolidation / frozen UI / import boundaries | **PASS42/55/10** na aktualnym RC |
| Nowe pełne SQL/GoTrue/Edge fixture | **NOT RUN**, backend bajtowo identyczny z odebranym ae6bb4b; wyniki52SQL+44HTTP z poprzedniego zadania pozostają dowodem odbioru, nie nowym uruchomieniem |
| TS/lint/Vitest/build/Chromium/Android ponownie | **NOT RUN**, brak zmian app/konfiguracji; nie powielano niezwiązanych kosztownych testów |
| GitHub-hosted | **NOT RUN**: dla RC1575bef dwa workflowy completed/**skipped**, dla e73041a i ae6bb4b zero runs |

Linux to nowy **offline kontener narzędziowy**, nie nowe środowisko bazodanowe: istniejący przypięty obraz `sha256:522be6ca97cc065e5448f5890da98a9f2f102fe28b17ec7d2acbbe9ed17d8aea`, Python3.12.16/Git2.47.3, network-none, bez portów, Docker socket i istniejących baz. Zwykłe klony z lokalnego read-only bundle, bez zewnętrznej sieci/GitHub env. Istniejący checker Stage2C uruchomiono bez zmian. Kontener `slm-integration-history-check-20261102` zakończył exit0 i pozostał zatrzymany; wszystkie trzy klony czyste. Syntetyczne przykłady metadanych w unittest nie ustawiają kontekstu procesu ani nie uruchamiają CI fixture.

Pierwsza próba uruchomienia policy nie wystartowała przez błędną ścieżkę przekierowania logu; poprawiono ścieżkę i faktyczne uruchomienie dało45PASS. Nie zaliczano samego kodu wyjścia PowerShell. Surowy log Docker zawiera opakowane przez PowerShell komunikaty Git stderr, nie błąd testów; sprawdzono exit0 i końcowe podsumowania. [Wyciąg Linux](review/slm-v1-integration-linux-results.txt), [API PR/CI i wyniki](review/slm-v1-integration-pr-status.json).

## Jedna rekomendowana kolejność — wyłącznie do zatwierdzenia

1. **Zatwierdzić zakres jednego PR30 całego stosu do main.** PR24 i PR28/29 traktować jako przeglądy zależności już obecnych w RC, bez osobnego scalania każdego rodzica. Nie scalać PR20–23, Auth18 ani PR31. Nie zamykać Draft PR automatycznie; decyzja o oznaczeniu ich jako pokrytych zakresem należy do właściciela po końcowej integracji.
2. **Po osobnej zgodzie dołączyć historię acceptance do feat/slm-v1-release-candidate zwykłym merge.** Zachować oryginalny ae6bb4b i cztery dokumentacyjne commity RC, wszystkie instrukcje Android/Cloud i pełną chronologię. Wspólnie zmienione `docs/STATUS.md` i `docs/ODPOWIEDZI_CODEX.txt` wymagają ostrożnego połączenia wpisów, nie wybrania jednej całej wersji. app/.github/AGENTS mają pozostać identyczne z dzisiejszym kandydatem. Jeśli dołączana będzie też niniejsza kontynuacja raportu na acceptance, przypiąć jej aktualny pełny HEAD przy zatwierdzeniu. W tym zadaniu tego merge nie wykonano.
3. **Zamrozić nowy SHA RC i pobrać nowy refs/pull/30/merge.** Sprawdzić rodziców `[aktualny main, nowy RC]`, ancestry d7b36ee/cb63962/ae6bb4b, source gate w kanonicznym checkout oraz policy/consolidation. Gdy zmieniły się tylko docs i źródła backendu pozostały identyczne, nie powtarzać pełnych fixture52/44. Każda zmiana źródeł wymaga odrębnego review i adekwatnych testów, bez automatycznego re-pin.
4. **Dopiero po akceptacji tych wyników zatwierdzić zwykły merge PR30 do main.** Bez squash/rebase/cherry-pick zastępujących wymagane commity. Nie ma potrzeby tworzenia kolejnego równoległego PR całego stosu. Hostowane CI pozostaje NOT RUN, dopóki rzeczywiście nie wykona się zatwierdzonego przebiegu; właściciel musi świadomie zaakceptować ten stan lub osobno zlecić CI, bez aktywacji w tej pracy. Po scaleniu potwierdzić rzeczywisty końcowy SHA i ancestry. **Integracja kodu nie jest zgodą na Cloud/deploy.**

Są to dwa potrzebne połączenia historii: raport acceptance do istniejącego RC, potem cały RC do main. Osobny merge PR24 przed tym jest zbędny i zmieniłby testowy merge do ponownej kontroli; nie jest rekomendowaną ścieżką minimalną. PR28 nie trzeba przenosić/rebazować na main, ponieważ jego oryginalne commity już są w RC.

## Pozostałe ryzyka i decyzje właściciela

- **WARN, nie BLOCK kodu:** przyszły dokumentacyjny merge nie istnieje, więc nie ma jego SHA ani wykonanego na nim source gate. Bieżący dokładny kandydat i testowy merge PASS nie zwalniają z kroku3.
- **Zakres wydania:** obecny RC nie zawiera PR31, docelowej rejestracji, pełnych ocen/statystyk i potwierdzonego push. Właściciel decyduje o ich odroczeniu; nie przedstawiać technicznego RC jako kompletnej produkcyjnej1.0. Dodanie PR31 teraz zmienia weryfikowany kontrakt i wymaga osobnej ścieżki review.
- **Backend/Android:** odbiór backend42 dotyczy izolowanej fixture. Nie potwierdza zgodności istniejącej bazy telefonu ani Cloud. Wcześniejszy audyt Cloud7/42 jest historycznym ostrzeżeniem, nie dzisiejszym odczytem; Cloud nie odpytywano. Backup/diff/restore i wdrożenie wymagają osobnego zadania. Chromium, naturalna expiry/refresh i pełny Android LIVE pozostają osobnym odbiorem.
- **Historia/obiekty:** zachować d7b36ee/cb63962 oraz źródła wszystkich dokładnych git-show pinów. Szczególnie a82397b z fix/premium-real-ui-regression nie jest przodkiem RC, ale jest potrzebnym historycznym źródłem; nie usuwać ostatniej referencji. Nie zmieniano ani nie usuwano żadnych gałęzi.

Raport i dowody to jedyne zmiany tego zadania, obok dopisania STATUS i `docs/ODPOWIEDZI_CODEX.txt`. Nie zmieniono RC/main/PR metadata, istniejących danych ani ustawień CI. Aktualny SHA raportu jest HEAD gałęzi test/public-discovery-backend42-acceptance; źródło ae6bb4b pozostaje niezmiennym przodkiem.

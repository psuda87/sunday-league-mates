# Redukcja gałęzi — Etap 1: frontend i Premium

2026-11-01, Europe/Warsaw. Audyt po fetch i sprawdzeniu GitHub. RC: `1575bef77f0b24a8c74373018895b7b872ebc06a`; main: `134c52b1aee0d0804cc0cf71f151f95040e7a38f`. PR31: `1b3aed659749f1084cab8cd4f47f99a54a50c8b9`, wciąż Draft do RC — **nie jest częścią RC**. Lokalny main a46f5e4 jest starszy, więc porównania wykonywano do origin/main.

Nie tworzono ani nie usuwano gałęzi, tagów lub worktree. Bez merge/rebase/squash/deploy/Supabase i zmian kodu/guardów/UI. Raport i notatki zapisano lokalnie w istniejącym czystym worktree RC, bez commita/push. Sześć zmian właściciela w głównym ui-beta pozostawiono.

## Decyzje

| Gałąź | Decyzja | Porównanie rzeczywistej treści z main i RC; pozostała zmiana lub blokada |
|---|---|---|
| fix/bottom-nav-highlight | **DELETE** | Poprawka przeniesiona squash PR12/a46f5e4, obecna w main i RC. Trzy pliki fixture/testów identyczne; aktualny CSS ma dodatkowo późniejszą poprawkę formularza profilu, manifest jest nowszy. Zrzuty BottomNav zachowane w main. Brak potrzebnej zmiany. |
| fix/premium-profile-display-name | **REVIEW** | Wyłącznie dwa commity dokumentacyjne, bez zmian app względem bazy. Kontrakt nazw zaimplementowany później w main/PR16 i zachowany w RC wraz z naprawą projekcji. Unikalny historyczny docs/PREMIUM_PROFILE_NAME.md, otwarty PR15, worktree premium-profile-name z lokalnym cache. Najpierw rozstrzygnąć archiwizację dokumentu/PR. |
| fix/premium-real-ui-regression | **KEEP** | Zaakceptowany frontend/role finansowe selektywnie przeniesiono do stabilizacji/RC, poza main; nowsze składy i discovery zastępują część dawnego runtime. Nie przenosić całej gałęzi z eksperymentalnym Auth18. **a82397b jest twardym źródłem policy i ma tylko tę zdalną referencję**, nie jest przodkiem RC ani żadnego zachowanego tagu. PR23 i własny worktree/cache. Usunięcie ostatniej referencji grozi utratą obiektu wymaganego przez guardy po GC/świeżym fetch. |
| feat/slm-v1-polish-stats | **KEEP** | Dziewięć commitów ponad RC,15 zmienionych plików app: native insets, GuestForm, selektor/CSS, testy i dokładne kontrakty. Brak w main i RC. PR31 otwarty Draft, osobny worktree. To rzeczywiście potrzebny zakres przed integracją, bez modułu goli/ocen. |
| feat/ui-beta | **KEEP** | Rdzeń zaakceptowanego Premium przeniesiony do main/RC,72 historycznie zmienione pliki app identyczne z RC. Pozostają unikalne dostarczone grafiki referencyjne, card-preview i historyczne materiały. Główny worktree ma6 niezacommitowanych zmian, w tym usunięcie edycji numeru z samej karty — **nie zatwierdzono ani nie przeniesiono tego do RC**. Jest też zdalny checkpoint dokładnego HEAD. |
| feat/premium318-live | **DELETE** | Stara osobna implementacja LIVE jest funkcjonalnie zastąpiona main/RC: aktualne kontrolery grup/meczy/finansów/profilu i chroniony shell. Nie utożsamiać braku dawnych plików live/Profile/FinanceSummary z brakiem funkcji. Historia i stare testy/narzędzia zachowane w premium319/320 oraz dokładnym zdalnym tagu checkpoint. Brak potrzebnej nieprzeniesionej poprawki zatwierdzonego UI. |
| feat/premium319-android | **DELETE** | Rozwija318 głównie o trwały fikcyjny seed telefonu i dokumentację; nie stanowi nowego zatwierdzonego modułu produkcyjnego. Seed nie jest funkcją aplikacji ani źródłem danych RC. Całość jest przodkiem320 i ma dokładne zdalne checkpointy, w tym local-phone-fixtures. Brak potrzebnej poprawki końcowego UI. |
| feat/premium320-visual-parity | **REVIEW** | WIP c6c2ff6:50 plików/+1065/-70 względem319; własne FootballPitch/LineupPreview/PhotoEditor, backNavigation, portraitFraming i testy wizualne. Nie są identycznym końcowym Premium3.18; część możliwości pokrywają nowe native/back hooks, preparePhoto i trwałe składy RC. Pozostają unikalne prototypy kadrowania i testy do decyzji, nie automatycznego przeniesienia. Worktree premium318-live i jego cache zachować. |
| feat/slm-v1-live | **REVIEW** | B1/B2/B2.2/foto/numer/aliasy przejęte przez main/RC;91 historycznie zmienionych plików app identycznych z RC. RC ma nowsze grupy/nazwy/zdarzenia/składy, kanoniczny backend zamiast lokalnej kopii B22_LOCAL_ONLY. Pozostają stare parity fixtures/testy/manifesty i worktree z602 plikami cache (~103MB). Dokładny zdalny tag zachowuje5c3f13f (proweniencja manifestów), ale prywatne lokalne artefakty nie są tagowane. Najpierw przejrzeć/zabezpieczyć worktree, bez usuwania danych. |
| feat/premium-lineup-editor-stage1 | **DELETE** | b30908e jest przodkiem RC, nie main. Rzeczywisty editor/profil i jego kontrakty są w RC; Stage2A/2B rozszerza zapis/CAS/roster/idempotencję. SHA wymagany przez policy pozostaje osiągalny z RC. Brak brakującej funkcji. |
| fix/premium-lineup-stage1-contract | **DELETE** | 7ad5c75 jest przodkiem RC, nie main. Poprawka guardów ze b377174 i raport są w jego historii; późniejsze dokładne piny zachowują ten kontrakt. Brak unikalnej potrzebnej zmiany. |

Ancestry nie traktowano jako samodzielnego dowodu kompletności. Porównano zmiany względem merge-base, odpowiednie pliki i zachowanie obecnych komponentów. Przykłady: BottomNav zachował całą poprawkę CSS mimo późniejszego dodatku profilu; PR16 realizuje wcześniejszy plan PR15; sprawdzenie zgodności event.id z żądanym ID jest w premiumContracts, mimo braku starego matchResponse; preparePhoto/imageDimensions zastępują dawną ścieżkę zdjęć. Nie przenoszono alternatywnego starego routingu, wyglądu ani kopii backendu.

## Dokładna lista bezpiecznych kandydatów do usunięcia referencji

| Gałąź | Oczekiwany aktualny SHA | Zabezpieczenie historii / lokalny stan |
|---|---|---|
| fix/bottom-nav-highlight | 25404f45ca415ea6f5eaa04780707a820cb415ca | main/RC mają kod i zrzuty PR12. Lokalna gałąź istnieje; katalog bottom-nav-highlight ma obecnie branch **main**, nie tę gałąź. |
| feat/premium318-live | 4b14e0ce5c225900aca8d7c36442f8aa23fc3c56 | Istniejący lokalny i zdalny tag checkpoint/2026-10-25-premium318-live wskazuje dokładny HEAD; zachowana320. Lokalna gałąź bez przypisanego worktree. |
| feat/premium319-android | ac4954c41b876ae47055174176116a4877c952a5 | Dokładne lokalne/zdalne checkpoint/2026-10-25-premium319-android i local-phone-fixtures; zachowana320. Lokalna gałąź bez worktree. |
| feat/premium-lineup-editor-stage1 | b30908e15cedff6ffa1a4ca76f0fb514e04302a7 | Przodek RC1575bef; brak lokalnej gałęzi i worktree tego brancha. |
| fix/premium-lineup-stage1-contract | 7ad5c75414cf669d4471f3122e93073dab9aa8d7 | Przodek RC1575bef; brak lokalnej gałęzi i worktree tego brancha. |

Dla wszystkich pięciu potwierdzono brak otwartego PR **zarówno jako head, jak i base**, brak przypisanego worktree i brak niezacommitowanych plików należących do takiego worktree. Nie mają oddzielnego katalogu roboczego z unikalnymi danymi do usunięcia. Stare materiały318/319 pozostają w istniejących tagach i worktree320. Historyczny bottom-nav commit dokumentacyjny potwierdza zakończony PR12, nie wnosi nowej funkcji; kod/testy/zrzuty są zachowane.

Lista dotyczy wyłącznie usuwania referencji branch, **nie katalogów o podobnych nazwach, cache, tagów lub baz**. Lokalne usunięcie nieprzodków może wymagać jawnej świadomej operacji po potwierdzeniu zawartości; nie wydano żadnego polecenia kasowania. Przed faktycznym usunięciem ponownie sprawdzić SHA/PR/worktree, ponieważ stan może się zmienić. Nie usuwać pozostałych sześciu gałęzi w tym etapie.

## Ryzyko cofnięcia Premium i dane lokalne

Nie zastępować bieżącego RC pełnym drzewem żadnej starej gałęzi. Przeniesienie starego variables.css/manifestu z BottomNav usunęłoby późniejsze style profilu; ui-beta ma starszy shell i lokalne niezakończone zmiany karty;318/319 mają wcześniejszą architekturę LIVE;320 zmienia zatwierdzone boisko/karty;23 zawiera także niewłączony Auth18 i dawne lokalne składy. Stage1 nie zastępuje nowszego backendu składów. Istniejące zabezpieczenia Premium nie były dopasowywane do historii.

Przypisane worktree (poza ui-beta) miały czysty git status, ale istotne ignorowane pliki: premium-profile-name cache1/~526B, premium-ui-regression124/~1MB, premium318-live42/~4.4MB, slm-v1-live602/~103MB. Brak odczytu/zapisu sekretów lub prywatnych rekordów. Docker nie odpowiadał; nie uruchamiano go dla audytu. **Mounty kontenerów i pełna unikalność prywatnych cache NOT RUN/niepotwierdzone**, więc te worktree pozostają zachowane i poza listą usuwania.

## Kontrole

- **PASS** bieżącego RC `npm run verify:consolidation`:42 dokładne migracje,55 chronionych plików i10 granic importów. To sprawdzenie zgodności źródeł końcowego zaakceptowanego UI, nie nowy test wizualny emulatora.
- **PASS** porównania kodu/historii, aktualne GitHub PR, istnienie i dereferencja checkpointów na origin. **3 KEEP /3 REVIEW /5 DELETE**.
- **NOT RUN** powtarzanie pełnych testów, buildów i dawnych gałęzi, SQL/Supabase, fizyczne urządzenie/emulator. Brak zmiany implementacji, więc nie było potrzeby powtarzania pełnych zestawów.

Pełne SHA i podsumowanie porównań z main/RC: [frontend-branch-reduction-stage1.json](review/frontend-branch-reduction-stage1.json). Nie wykonano żadnego usunięcia. Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

## Późniejsza autoryzowana operacja — 2026-11-01

Po osobnym poleceniu właściciela usunięto **wyłącznie pięć zdalnych gałęzi z powyższej listy**, zwykłym `git push --delete`, bez force. Bezpośrednio przed każdą operacją ponownie odczytano GitHub branch (dokładny poprzednio sprawdzony SHA, protected=false), pełną listę otwartych PR (brak gałęzi jako head/base) i repozytoryjne rulesety (pusta lista). Ponowiono kontrolę main134c52b/RC1575bef. BottomNav ma identyczne app z zatwierdzonym a46f5e4 będącym przodkiem main/RC;318/319 mają zachowany potrzebny zakres w niezmienionym RC oraz dokładne zdalne checkpointy i potomną320; obie gałęzie Stage1 są przodkami RC. Przy niezgodności operacja miała zostać pominięta, ale wszystkie warunki zostały spełnione.

Faktycznie usunięte: `fix/bottom-nav-highlight`, `feat/premium318-live`, `feat/premium319-android`, `feat/premium-lineup-editor-stage1`, `fix/premium-lineup-stage1-contract`. **Pominięte/BLOCKED:0.**

Po operacji ponownie odczytano `git ls-remote --heads origin` i GitHub branches: **45→40 gałęzi**. Brak dodatkowych usunięć, nowych gałęzi lub zmian SHA pozostałych40. Snapshoty refs/heads, tagów i worktree są identyczne przed/po. Lokalne gałęzie, katalogi, pliki, cache i dane pozostały; nie uruchamiano prune ani usuwania lokalnych referencji. Zapisano tylko tę aktualizację raportu/STATUS/ODPOWIEDZI, bez commitowania kodu, merge, rebase, deploy lub Supabase.

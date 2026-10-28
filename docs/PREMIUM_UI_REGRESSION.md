# P0 — przywrócenie Premium nad prawdziwymi danymi

2026-10-28 18:14:07 Europe/Warsaw. Branch `fix/premium-real-ui-regression`, baza PR22 `74b1595d7a8dc79d50ba451df6afe2ea6da95e55`. Odrębny worktree; sześć zmian root ui-beta i trzy niezapisane dokumenty Stage3 pozostawiono bez zmian. Nie scalano PR ani nie wykonywano deploy/migracji/resetów. APK **GOTOWY, NIE ZAINSTALOWANO**.

## Przyczyna i mapowanie oryginalnych komponentów

Porównano historię przed20 (PR18 `845d35e`, Premium `d0f9fa9`) z integracją20 (`d621f73`) i finansami21 (`b46689a`). Wskazanie błędów przed implementacją przekazano użytkownikowi.

| Element | Wcześniej | Stage3 przed poprawką | Naprawa |
|---|---|---|---|
| Lista | demo/App → EventLabel/EventPrivacy + MatchHero compact | PremiumEvents używał MatchHero tylko dla access=full; own/none renderował zwykły slm-panel | Ten sam oryginalny MatchHero dla wszystkich pozycji; jawna ograniczona projekcja dla own/none bez liczników/capacity/duration, których API nie udostępniło |
| Nazwa grupy/prywatność | Etykieta grupy nad kartą, mały badge w karcie | Łączony span slm-privacy-badge bez oryginalnej prezentacji | Oryginalne EventPrivacy i slm-event-label, nazwy z API bez podmiany |
| Szczegóły | demo/App → DemoPanels → MatchTabs | PremiumEvents → MatchSections | Bezpośrednio oryginalny MatchTabs, te same4 zakładki i dane/akcje Stage1/2 |
| Boisko | demo/Teams.tsx: SVG, formacje, znaczniki, jawny tryb zamian | MatchSections: dekoracyjne koszulki i piłka | Wydzielony PremiumPitch zawiera oryginalną geometrię/rozmieszczenie; używa go nadal DemoTeams i nowy live adapter PremiumTeams |
| Dodawanie | DemoBottomNav .slm-demo-create | Nadal ten sam komponent, zależny od organizujących członkostw | Nie zmieniono oryginalnego plusa. Potwierdzono na prawdziwym adminie grupy: widoczny, otwiera EventForm; na zawodniku prawidłowo ukryty. Brak plusa u zawodnika nie był błędem uprawnień |
| Selektor | Brak dodatkowej nakładki formularza na głównym demo | label ze slm-group-form (styl całego formularza), select bez odpowiedniego układu | Scoped blokowy/grid układ etykiety i select, osobny wiersz rozliczeń, oba≥44px, bez pozycjonowania na oko |
| Nagłówek | MatchHeader poza klasą listy | Header wewnątrz slm-matches-screen | Dedykowany korzeń PremiumEvents i lista we własnej sekcji, oryginalny header/safe-area CSS |
| Status bar | Native transport | Overlay mógł umieszczać WebView pod statusem; env() zależy od platformy | Tylko opt-in wejście Android Stage3 prosi istniejący StatusBar o overlay:false; brak sztywnej wysokości CSS. Rzeczywisty efekt na POCO wymaga odbioru po instalacji |

Duże ciemne karty odtworzono w prawdziwej przeglądarce: były prywatnymi meczami spoza grupy zalogowanego zawodnika, nie uszkodzeniem zdjęcia ani starym cache. Pole access nadal pochodzi wyłącznie z serwera; naprawa prezentacji nie daje dostępu do cudzych szczegółów. Prywatne karty pokazują wyłącznie dostępne podstawowe dane i komunikat zamiast wymyślonego0/0. Historia i przyszłe wydarzenia używają jednego MatchHero.

## Boisko — co rzeczywiście działa

- Rzeczywista lista wyłącznie registered z autoryzowanego matches_detail; rezerwa/wycofani nie trafiają na boisko. Wycofanie usuwa znacznik z lokalnego widoku przy nowym DTO.
- Początkowo brak przydziału. Użytkownik ręcznie wybiera A/B; nie dodano algorytmu losowania. Kliknięcie jednej osoby z każdej drużyny w trybie zamian zamienia je tylko w RAM.
- Jawny napis „Lokalny podgląd · bez zapisu na serwerze”. Po opuszczeniu meczu/restartach podział znika; ukrycie samej zakładki zachowuje RAM do wyjścia z meczu. Brak endpointów zapisu składów/zamian w przejrzanym API/SQL, nie dodano ich.
- Brak numerów koszulek i zdjęć w DTO uczestnika → znak „—” dla zawodnika, G dla gościa; bez fikcyjnych numerów, demo zawodników, statystyk i linku do obcego profilu. Kliknięcie w zwykłym trybie identyfikuje rzeczywistego uczestnika; pełna karta innej osoby wymaga przyszłego bezpiecznego kontraktu.
- Demo reducer pozostał wyłącznie demo; live adapter nie tworzy World ani nie importuje reduceWorld. Wspólny PremiumPitch jest czystą prezentacją, bez Auth/API/store.

## Zmiany i ochrona zamrożonego wyglądu

Zmodyfikowano PremiumEvents, MatchHero (tylko opcjonalność autoryzowanych pól), demo/Teams (wydzielenie prezentacji), opt-in android-stage3/main. Dodano PremiumPitch, PremiumTeams i scoped premiumEvents.css, testy i browser runner. Dopuszczono samą prezentację PremiumPitch w allowliście demo.

**variables.css, UltimatePlayerCard, BottomNav, MatchHeader, MatchTabs, EventForm, kontrolery/Auth/SessionManager, finanse, SQL/RLS/Edge/Storage i konfiguracje backendu bez zmian względem22.** Kontrakt55 plików obejmuje53 niezmienione źródła i2 jawne autoryzowane wyjątki: Teams/MatchHero. Zaktualizowano wyłącznie te2 hashe wraz z uzasadnieniem. Nie przedstawiamy odświeżonych hashy jako dowodu niezmienności tych2 plików. Ich zachowanie sprawdzono testami, oryginalne demo nadal działa i build isolation przechodzi.

Wszystkie operacje logowania/sesji, grup, tworzenia matches_create, zapisów/rezerwy/gości/cancel, refresh i finansów używają niezmienionych portów Stage1/2. Nie cofnięto backendu. Fizyczne zachowanie sesji nowego APK i ponowny pełny scenariusz wpłat nie zostały wykonane w tej poprawce.

## Wyniki rzeczywiście wykonane

| Kontrola | Wynik |
|---|---|
| TS aplikacji i osobno wejścia Android | PASS |
| ESLint | PASS, bez ostrzeżeń |
| Vitest Finance/Events/Teams/regresja UI | **24 PASS /4 pliki** |
| Chrome referencja demo | **1 PASS**, oryginalny zbudowany demo Stage2 |
| Chrome → prawdziwy Auth/Edge/DTO Stage2 | **2 PASS**, zawodnik i administrator; bez fixture odpowiedzi HTTP, bez mutacji rekordów biznesowych |
| Rozmiary320/360/390 × Light/Dark | PASS, pomiar szerokości/braku nachodzenia selektora na rozliczenia, kompaktowych kart, nagłówka z symulowanym safe area24px i paska w rzeczywistym viewport |
| Szczegóły/4 zakładki/realny odczyt finansów | PASS w Chrome |
| Boisko | PASS, ręczne A/B, zamiana, wymiary3 szerokości ×2 motywy, brak reserve/withdrawn; unit test braku utrwalenia |
| Administrator + formularz | PASS, oryginalny plus widoczny, EventForm dostępny przy320px i zmniejszonej wysokości560px z fokusem; nie wysyłano nowego meczu |
| Build domyślnej aplikacji / Premium Stage3 | PASS |
| Build demo + izolacja | PASS,16 artefaktów, bez Auth/API w bundle |
| Kontrakt UI | PASS,53 niezmienione +2 uzasadnione wyjątki opisane wyżej |
| Capacitor sync / Gradle debug | PASS,275 zadań |
| Pakiet/podpis/zasoby/endpoint | PASS, assets APK bajtowo zgodne ze świeżym buildem, lokalny64321/istniejący vault namespace, brak rozpoznanych secret/JWT/private-key wzorców i URL projektu Cloud w web bundle |
| Fizyczny POCO status bar/IME/Back/resume/nowy wygląd | **NOT TESTED**, APK nie zainstalowano |

Przy pracy znaleziono i poprawiono także zbyt wcześnie zwijający się panel ręcznego ustawiania (po przypisaniu pierwszej osoby). Testy najpierw wykryły błąd, po poprawce Chrome PASS. Runner usuwa ELECTRON_RUN_AS_NODE odziedziczone po IDE; pomiary korzystają z faktycznego okna przeglądarki zamiast początkowej wartości konfiguracji Cypress. Zachowano zrzuty przed/po między uruchomieniami. Buildy mają ostrzeżenia chunk size i zastane komunikaty bundlera/Gradle; nie deklarujemy czystego audytu zależności.

## Porównanie wizualne — obejrzane rzeczywiste zrzuty

Folder `docs/ui/premium-ui-restore/premium-ui-restore.cy.ts/`:

- `original-premium-dark.png` — oryginalne demo, wyłącznie dane demonstracyjne;
- `before-list-dark.png`, `before-pitch-placeholder.png` — Stage2/Stage3 przed naprawą z rzeczywistym lokalnym API;
- `after-list-320-light.png`, `after-list-320-dark.png`, analogicznie360/390;
- `after-details-dark.png`, `after-pitch-dark.png`, `after-admin-create.png` — naprawione widoki Chrome nad rzeczywistymi lokalnymi kontami/danymi.

To Chrome mobile viewport, nie zrzuty nowej wersji z POCO. Dane kont są fikcyjne; logowanie w testach nie jest fotografowane, hasła/tokenu nie zapisano w obrazach lub Git. Nazwy fixture i daty2099 pozostają widoczne bez maskowania.

## APK do odbioru — bez automatycznej instalacji

`I:/slm/sunday-league-mates/.worktrees/premium-ui-regression/app/android/app/build/outputs/apk/debug/app-debug.apk`

SHA256 **`e2e2b0f630c56a35dc5166a5424ac0f08a4bbdac55791f6a0a8d88fb16f1f251`**.

Pakiet `pl.psuda87.slm`, nazwa zachowana, debug cert SHA256 `1324e26980d16dbdca3dac8830b752924960ab1bcd418f84083f549f00692457` zgodny z poprzednim Stage3. Endpoint64321 i namespace `slmfinanceandroiddev` pozostają, sesji nie czyszczono. Wykonano wyłącznie build/sync, nie instalację. Kopia poprzedniego kodu nadal w worktree Stage3, jego obecna instalacja niezmieniona. Wygenerowane ścieżki Gradle przywrócono do przenośnych node_modules; APK/cache/local.properties nie są w Git.

Dopiero po odrębnej zgodzie właściciela: zweryfikować hash, USB reverse64321 i install-r, bez uninstall/clear. Następnie konta Stage2 z lokalnego pliku Temp: zawodnik → lista/grupa/karty; administrator → plus/formularz; oba motywy, Back, status bar, scroll nad BottomNav, lokalny podgląd i zamiany, finanse i sesja po restarcie. To warunek końcowej akceptacji — PASS Chrome nie zastępuje odbioru telefonu.

## Oddzielna procedura zwykłej grupy/meczu testowego — NIE WYKONANO

1. Pozostawić wszystkie Finance Browser/Alpha/Beta, płatności i fixture2099 bez zmian. Nie wykonywać SQL cleanup/resetu.
2. Zalogować istniejące lokalne konto testowe; w Grupy utworzyć nową grupę np. „SLM — odbiór POCO”, używając rzeczywistego groups_create i konta, które stanie się administratorem tej grupy.
3. Zaprosić drugie istniejące konto; przyjąć zaproszenie na nim (bez wymuszonego członkostwa).
4. Jako admin wybrać grupę i oryginalny +. Ręcznie wprowadzić nazwę, uzgodniony przyszły termin, rzeczywiste miejsce/adres, czas gry, limit oraz kwotę wyłącznie testową; zachować minimum backendu10. Sprawdzić podgląd i dopiero świadomie zapisać przez matches_create. Nie udawać nowego backendowego minimum lub Google Maps.
5. Drugie konto odświeża i widzi ten sam rekord; test zapisu/gości/rezerwy zgodnie z limitem. Nie zatwierdzać finansów przyszłego meczu i nie przesuwać czasu istniejących danych. Test rozliczeń wykonać na istniejącym zakończonym fixture lub po rzeczywistym zakończeniu nowego testowego meczu.

Procedura nie utworzyła teraz nowych kont/grup/meczów i nie zmieniła fixture.

## Pozostała praca i decyzje

- Właściciel musi odebrać nowy APK na POCO; status bar poprawiono poprzez natywne nie-overlay dla Android12, efekt fizyczny jeszcze niepotwierdzony. Android15+ może wymagać innej obsługi edge-to-edge; nie deklarujemy jej jako wykonanej.
- Brak serwerowego zapisu składów/zamian, bezpiecznego DTO numerów/portretów innych uczestników i ich kart; wyłącznie oznaczony lokalny podgląd. Nie zmieniano RLS/kontraktu backendu.
- Publiczne ograniczone karty nie pokazują ukrytych liczników — zamierzona różnica danych od demo, nie błąd wizualny.
- Brak automatycznego generowania drużyn, fikcyjnych podziałów, normalizacji nazw fixture w UI lub nowych danych testowych.
- Nowy Auth18 nadal nieaktywny; bez Cloud, płatnych usług, wdrożeń i merge. Nie ponawiano pełnej regresji SQL/HTTP finansów, ponieważ ich kod/kontrakty są niezmienione.

Samodzielnie wybrano współdzielony prezentacyjny Pitch zamiast kopiowania demo reducera, ręczny podgląd zamiast nowego algorytmu, opcjonalną projekcję karty zamiast fałszywego0/0 oraz natywny inset zamiast sztucznego CSS przesunięcia pod konkretny telefon.


[2026-10-28 18:15:26 Europe/Warsaw] Wynik P0: kod i zrzuty wypchnięte, commit534986ccb6e57c4aad8b09a870542650fd3ddb13. Draft PR23 https://github.com/psuda87/sunday-league-mates/pull/23 zależny od22, bez merge. APK e2e2b0f630c56a35dc5166a5424ac0f08a4bbdac55791f6a0a8d88fb16f1f251 gotowy w .worktrees/premium-ui-regression/app/android/app/build/outputs/apk/debug/app-debug.apk. Przegląd Chrome przed/po i24 testy PASS, native POCO OCZEKUJE. Wymagana osobna zgoda na aktualizację; nowego APK nie zainstalowano. Pełny raport docs/PREMIUM_UI_REGRESSION.md; odpowiedzi docs/ODPOWIEDZI_CODEX.txt.


[2026-10-28 18:19:33 Europe/Warsaw] PR23 — po osobnej zgodzie zaktualizowano POCO c7a559b5 przez adb install-r: Success. Hash APK e2e2b0f630c56a35dc5166a5424ac0f08a4bbdac55791f6a0a8d88fb16f1f251 zgodny. Bez uninstall/clear. Istniejący reverse64321 potwierdzony; curl z telefonu do lokalnego accounts PASS, capabilities nowego Auth wszystkie false. MainActivity COLD Status:ok; ograniczony odczyt logcat procesu:0 dopasowań fatal/WebView-network/uncaughtJS. Fizyczny odbiór wyglądu/status bara/sesji/logowania i boiska OCZEKUJE potwierdzenia użytkownika. Bez zmian backendu/Cloud/danych biznesowych. Odpowiedzi docs/ODPOWIEDZI_CODEX.txt.


# Przywrócenie zachowania Premium — 2026-10-28 19:03:51 Europe/Warsaw

Gałąź `fix/premium-real-ui-regression`, kontynuacja istniejącego Draft PR23 (base PR22). Baza tej aktualizacji `5de79ce`. Przed zmianami sprawdzono statusy root/worktree i PR23. Zachowano wszystkie niezapisane notatki; poniższy wpis nie zastępuje wcześniejszego odbioru instalacji lub raportu P0.

## Diagnoza i plan przekazane przed kodem

DemoTeams + demo/data miały podział `exampleLineup` (parzyste/nieparzyste indeksy), interaktywny wybór dwóch znaczników i `lineup_swap` w RAM. Stage1 wprowadził placeholder, poprzedni P0 odzyskał geometrię, lecz główne ustawianie odbywało się selectami. Demo nie miało trwałego backendu/autora/CAS. LIVE i Premium dzielą istniejący serwer matches_dispatch: stary list zwracał wszystkie mecze, a create wymagał organizer. Stąd niezgodność z nowymi regułami; samo ukrycie React nie wystarczało.

Trwałe składy wyraźnie oddzielono jako kolejny etap **przed** implementacją. Powstał konkretny projekt: [PREMIUM_LINEUP_BACKEND_PLAN.md](PREMIUM_LINEUP_BACKEND_PLAN.md). Nie wdrożono tabel/RPC zapisu składów, autora ani CAS. Nie przedstawiamy ich jako PASS.

## Zrealizowane zachowania

- Start: aktualne grupy + dostępne nadchodzące publiczne. Historia: aktualne grupy + własne historyczne wpisy po wyjściu (także odpowiedzialność za gości). Obce prywatne wydarzenia nie są zwracane w list ani detail. To nowa decyzja właściciela, zastępująca wcześniejsze publiczne prywatne kafelki.
- Zakres: Wszystkie dostępne / konkretna grupa / Publiczne / Moje mecze, do tego Nadchodzące/Historia. Zakres i okres wykonują się w SQL **przed LIMIT/OFFSET**, z zawsze obowiązującą autoryzacją. Edge przepuszcza tylko nowe niesekretne scope/period; p_user i p_session nadal wyłącznie z serwera. React dodatkowo odrzuca obce prywatne DTO ze starszego API.
- `own_history` jest niezależne od aktywnego zapisu. Dzięki temu historyczne wycofane wpisy lub odpowiedzialność za gości nie znikają tylko dlatego, że nie są już registered/reserve.
- Każdy aktywny członek może tworzyć we własnej niearchiwalnej grupie. Oryginalny BottomNav + i EventForm zachowane. Frontend włącza nową regułę wyłącznie po `member_creation_enabled:true`; wobec starego backendu nadal respektuje jego ograniczenia, bez fałszywie aktywnego plusa.
- Ważna zależność: stare match_finance nadawało uprawnienia każdemu twórcy-członkowi. Nowy zwykły twórca **nie** uzyskuje finansów ani uprawnień zarządzania grupą; finance wymaga administratora albo twórcy nadal posiadającego rolę organizatora. Kwoty, FIFO, wpłaty, ledger i reguły naliczania bez zmian. Wąskie ograniczenie uprawnień twórcy jest celową częścią tej aktualizacji, nie zmianą logiki kwot.
- Boisko: oryginalne PremiumPitch, przycisk Utwórz lokalny podgląd, odzyskany deterministyczny podział demo — jawnie przykład w RAM, nie wynik zapisany/losowanie serwera. Nieparzyste liczby, goście, wybór dwóch osób, natychmiastowa zamiana i Zakończ zamiany działają. To adaptacja dawnego zachowania, bez kopiowania World/reduceWorld i bez nowego algorytmu oceny/doboru.
- Zamiast selectów główna interakcja odbywa się na boisku; nieprzypisani mają listę z prostymi A/B. Nowe wpisy pozostają poza podziałem, wycofane/rezerwa usuwane z lokalnego przypisania. Publiczny outsider nie może edytować; wymagane członkostwo z rzeczywistych grup.
- Cofnij zmiany odtwarza brak zapisanego serwerowego baseline. Zapis na serwerze pozostaje wyłączony, etykieta informuje o braku zapisanego składu. Nie generujemy autora ani daty i nie zapisujemy do localStorage. Cofnięcie/niezmieniony zapis i zachowanie prawdziwego autora/CAS wymagają następnego etapu; obecne testy potwierdzają tylko uczciwy lokalny szkic.
- Kompaktowy sticky header pokazuje tytuł/powrót/odświeżanie, bez dużego logo. Dekoracyjny nagłówek przewija się normalnie. IntersectionObserver obserwuje rzeczywisty scroll element Ionic, stała geometria baru nie przesuwa strony przy aktywacji; scroll-padding/scroll-margin chronią fokus. Przy wyjściu ustawienie scroll-padding jest odtwarzane.
- Elastyczna szerokość tytułu i odstęp na safe-area po prawej zapobiegają obcięciu herbu. Zachowane natywne nie-overlay StatusBar i BottomNav; brak zmian Ultimate, globalnego CSS i profilu.

## Backend i izolacja — dokładny stan

Trzy nowe wersjonowane migracje utworzone CLI (starych44 nie zmieniono):

1. `20261028174603_premium_match_membership_visibility.sql`: prywatny feed predicate, filtrowanie przed paginacją, odmowa detail, member create, bezpieczne current_group_member/own_history DTO.
2. `20261028174920_premium_member_creation_finance_guard.sql`: zwykły twórca nie uzyskuje roli finansowej; istniejące grants/role bez rozszerzenia.
3. `20261028175508_premium_match_feed_filters.sql`: zakres/okres w SQL przed paginacją. Zachowano zabezpieczony publiczny dispatcher i niewystawione prywatne funkcje.

Zastosowano **wyłącznie do nowej** izolacji `slm-premium-behavior-review`, API65321, UI5192,47 migracji. Rzeczywiste GoTrue/Edge/PostgREST i nowe fikcyjne konta/grupy/mecze wyłącznie tam. Dla testów historii przesunięto wyłącznie własne świeżo utworzone fixture meczów o3h wstecz; nie zegar i nie stare dane. Wszystkie testowe dane/kontenery zachowane, bez resetów/usuwania.

**Używany backend POCO premium-finance64321 nadal ma44 migracje.** Nie zastosowano do niego nowych migracji ani nowego handlera. Cloud bez zmian. Nowy model Auth nieaktywny w obu środowiskach. Konta/hasła POCO, numery, UUID i wcześniejsze fixture są nietknięte. Backend testowy nie ma Storage/Studio/Realtime/SMTP, bo ten odbiór ich nie wymaga; nie jest to pełna regresja zdjęć lub poczty.

Przygotowanie nowej izolacji: `python app/scripts/prepare-premium-behavior-local.py` i przypisany jej CLI start, bez resetów. Helper jest przypięty do brancha i nowego project_id. Dalsze migrowanie tylko tej izolacji poleceniem CLI z `.cache/premium-behavior-stack`; nie uruchamiać podobnych poleceń z katalogu starego projektu. Canonical backend: app/supabase, generated cache jest jedynie uruchomieniem tych źródeł.

## Faktyczne testy

| Kontrola | Wynik |
|---|---|
| TypeScript app + osobno Android entry; strict Edge | PASS |
| ESLint | PASS, bez ostrzeżeń |
| Celowany Vitest Events/UI/filters/Finance/oryginalne Teams | **30 PASS /5 plików** |
| Real Auth → Edge → SQL HTTP | **29 PASS**, brak fixture odpowiedzi HTTP |
| HTTP prywatność | Brak tytułu/UUID obcego prywatnego meczu w DTO, detail odmówiony; publiczne telefony ukryte; dawny członek otrzymuje własne prywatne wpisy, bez cudzych uczestników |
| HTTP uprawnienia | Zwykły członek tworzy z własnym UUID mimo próby owner spoof; obcy/były członek odrzuceni; brak finansów i realny groups_permission403; admin zachowuje finance authority |
| HTTP filtry | Current/public/history/former-own, scope group/public/mine i period na serwerze PASS; query nie omija ACL |
| Direct REST/RPC + SQL/RLS/ACL | PASS, bez direct dispatcher/helper i grantów do zapisu/zmiany ról; invoker i RLS zachowane; nowy Auth false |
| Lokalny SQL lint |0 błędów, **4 zastane warnings**: push_claim1, email_profile_save1, finance_dispatch_core2; nie naprawiano poza zakresem |
| Chrome real backend | **3 PASS**: filtry/+ członka/formularz; odd roster/goście/swap/undo/sticky; historia po wyjściu |
| Chrome mobile320/360/390 ×Light/Dark | PASS, szerokości, prawy brzeg herbu, scroll, kompaktowy sticky bez img; wariant z symulowanym top safe-area24px |
| Build main/Premium/demo + izolacja demo | PASS,16 izolowanych artefaktów; ostrzeżenia chunk size/bundlera jawne |
| Frozen UI |55 źródeł zgodnych z istniejącym kontraktem PR23; dziś bez zmian oryginalnych komponentów demo/Ultimate/BottomNav/globalCSS |
| Nowy APK/native POCO/IME/Back/resume | **NOT TESTED**, brak builda APK, sync/instalacji i działań na telefonie w tej aktualizacji |
| Trwały zapis/autorstwo/CAS składów | **NIE ZAIMPLEMENTOWANO**, wyłącznie projekt następnego etapu |

Nie uruchamiano pełnej starej regresji ani migracji na używanym stacku. Testy przechwyciły realną kolizję automatycznie przewijanego przycisku ze sticky barem; poprawiono stałą geometrię i przewijanie z odstępem, po czym Chrome PASS bez force-click. Test spóźnionego detail zaadaptowano do nowego pobrania listy po zmianie zakresu; nadal potwierdza odrzucenie starej odpowiedzi.

## Zrzuty porównawcze

Wcześniejszy wygląd i interakcja formularza przypisań: `docs/ui/premium-ui-restore/premium-ui-restore.cy.ts/after-pitch-dark.png`, wcześniejsze karty `after-list-390-dark.png` z poprzedniego P0.
Nowe rzeczywiste zrzuty: `docs/ui/premium-behavior/premium-behavior.cy.ts/filters-320-light.png`, `filters-390-dark.png`, warianty360/390Light/Dark i `pitch-sticky-dark.png`. Obejrzano zrzuty listy, boiska i sticky; wyłącznie fikcyjne dane z realnego backendu. Zbiory fixture są różne, dlatego to porównanie układu/zachowania, nie test identycznych pikseli. Zdjęcia telefonu/IME nowej wersji nie istnieją i nie są deklarowane.

## APK i następny bezpieczny krok

Kod Premium buduje się — **można przygotować nowy APK po uzgodnieniu docelowego lokalnego backendu**. Nie przygotowano i nie zainstalowano teraz APK, bo używana baza64321 nadal ma stary kontrakt. Aby na niej odebrać nową regułę członkostwa i serwerową prywatność, potrzebne jest odrębnie zatwierdzone zastosowanie tych3 migracji i lokalnej aktualizacji allowlisty scope/period handlera, z backupem/weryfikacją bez resetu. Alternatywą jest jawny APK do nowej izolacji65321 z osobną sesją; obecnego APK nie przełączano i nie podmieniano konfiguracji Androida.

Trwałe składy/autorstwo/CAS realizować jako następny samodzielny etap według projektu, po jego zatwierdzeniu. Nie wdrażać częściowo ani nie przedstawiać disabled przycisku jako ukończonego zapisu. W tym zadaniu nie wykonano merge/deploy do używanego projektu lub Cloud, zmiany danych produkcyjnych ani instalacji telefonu.

Przy kontroli funkcji/RLS wykorzystano aktualne [zalecenia Supabase dla funkcji](https://supabase.com/docs/guides/database/functions) i [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): serwerowe API z jawnie zweryfikowaną sesją, ograniczone EXECUTE, prywatne helpery, bez poszerzania grantów. Źródła te opisują model zabezpieczeń; wyniki PASS powyżej pochodzą z wykonanych testów projektu.

Kontrola consolidation została zaktualizowana z44 do47 plików migracji (nowe3). Hashy32 historycznych migracji i chronionych źródeł main nie zmieniono. Guard zachowuje ancestry, wyłączony deployment i canonical local preparation; po aktualizacji PASS.


# Ostateczna decyzja finansowa właściciela — 2026-10-28 22:01:09 Europe/Warsaw

**Obowiązuje wyłącznie aktualny, aktywny administrator grupy.** To zastępuje wcześniejszą sekcję tego raportu, w której twórca-organizator zachowywał finanse. Zasady zapisano również na początku AGENTS.md; nie zmieniono wcześniejszych wpisów historycznych.

## Wynik audytu RPC/RLS

| Ścieżka | Wynik / zmiana |
|---|---|
| `group_finance_admin` | Bieżący admin_id + członkostwo + niearchiwalna grupa + aktywne konto bez operacji w toku; usunięty wyjątek archived dla ostatniego admina |
| `match_finance` | Wyłącznie group_finance_admin dla rzeczywistej grupy wydarzenia; zero sprawdzania created_by lub organizer |
| `own_finance_scope` | Zweryfikowana bieżąca sesja i aktualna rola w tej grupie; event_id musi należeć do group_id, bez alternatywnej ścieżki przez twórcę |
| `group_finance_dispatch_core` / publiczny dispatcher | Odczyt administracyjny, approve/cost/charge/attendance, record/accept/reject/correct_payment przechodzą przez powyższe helpery; własne account/submit_payment zachowane |
| Legacy settlements/events + `finance_admin` RLS | Korzystają z legacy_finance_manager; tylko administrator faktycznie zmapowanej grupy legacy, bez globalnej roli jako fallbacku. Dodatni test poprawnie zmapowanego administratora i ujemny byłego/globalnego w transakcji z rollback |
| Polityki ledger/payments/surplus | Aktualna rola sprawdzana przez own_finance_scope; osobne własne wiersze pozostają dostępne. Direct REST po transferze roli starym tokenem nie pokazuje cudzych wpisów |
| `matches_create/edit` | Tworzenie przez aktywnego członka, edycja podstawowych danych przez twórcę nadal działa; edycja nie zatwierdza kosztów ani nie nadaje ról |
| Dostęp bezpośredni | Publiczne dispatchery nadal service-only; klienckie helpery finansowe tylko finance_admin i own_finance_scope z tożsamością z sesji; brak rozszerzonych grantów |

Przejrzano rzeczywiste definicje wdrożonych funkcji oraz źródła migracji. Jedyną aktywną funkcją finansową z odwołaniem do created_by był match_finance; po poprawce takich funkcji jest0. Nie usuwano created_by z wydarzenia — nadal identyfikuje autora i służy prawu edycji podstawowych danych.

Grupy, mecze i finanse używają istniejącego wspólnego advisory lock(20261014,1), więc transfer roli i operacje finansowe zachowują istniejącą serializację. Nowe żądanie po zatwierdzonym transferze czyta aktualną rolę w bazie; nie potrzebuje refresh JWT. To nie oznacza automatycznego wymazania wcześniej odczytanego ekranu na innym urządzeniu: bez Realtime widok odświeża się przy dotychczasowym odświeżeniu/wznowieniu, a decyzję serwer odrzuca od razu.

## Implementacja bez zmian wyglądu

Nowa migracja `20261028181054_premium_group_admin_only_finance.sql` zastępuje cztery powyższe helpery. Nie zmienia kont, UUID, admin_id, kwot, ledgera ani poprzednich migracji. Private SECURITY DEFINER i ich istniejące ACL zachowane tam, gdzie wymaga ich RLS; pusty search_path i kwalifikacje. Legacy manager jest invoker. Brak nowych grantów.

Jedyna produkcyjna zmiana frontendu to niewizualny `usePremiumFinance`: stara wskazówka manage nie wystarcza bez świeżego potwierdzenia administratora w projekcji konta (surplus!==null); po zdarzeniu istniejących grup ponownie pobiera zakres i usuwa cache panelu administratora. Własne konto nadal działa. Nie zmieniono ekranów, markup, tekstów interfejsu, CSS, assetów, nawigacji ani zamrożonych komponentów Premium.

## Wykonane kontrole

- **48 rzeczywistych testów HTTP PASS** w izolacji65321: członek tworzy/edytuje podstawowe dane; twórca także z flagą organizatora nie ma żadnej z10 testowanych operacji finansowych. Własne należności/historia/zgłoszenie wpłaty działają. Admin zatwierdza zakończony fixture, akceptuje wpłatę i wykonuje korektę wpłaty/kosztu.
- Transfer administratora: dokładnie ten sam stary access token, bez refresh/login, traci admin RPC, cudzy ledger przez RLS i możliwość replay dawnego zatwierdzonego UUID. Dotyczy też własnego meczu byłego administratora, który nadal jest organizatorem. Nowy admin bez ponownego logowania widzi zakres i akceptuje kolejną wpłatę.
- Obcy administrator grupyB nie może tworzyć/czytać finansów grupyA. Nieaktywny członek nie tworzy; nieaktywny admin nie podejmuje decyzji i nie czyta cudzego ledgera. Ostatni admin poza zarchiwizowaną grupą nie zachowuje wyjątku finansowego.
- **32 Vitest/5 plików PASS**, w tym regresja starego manage hint i utraty cached admin przy slm-groups-changed. Nie jest to wyłącznie ukrycie przycisków — serwer i RLS sprawdzono osobno realnym HTTP.
- SQL test admin/legacy-map/ACL w transakcji rollback + dotychczasowy test visibility/RLS/ACL PASS. Dodatnie/ujemne testy legacy helperów nie są deklaracją pełnego finansowego E2E starych kont.
- TypeScript app, strict Edge, ESLint, build main i Premium PASS. Consolidation:32 historyczne migracje zachowane,48 wersjonowanych plików; frozen Premium55 źródeł PASS. SQL lint0 błędów i4 dotychczasowe ostrzeżenia. Bez pełnej ciężkiej regresji.

Fixture kosztów zakończono wyłącznie przez zmianę starts_at świeżo utworzonego lokalnego testowego meczu. Testy czasowo dezaktywowały wyłącznie własne nowe konta fixture i przywróciły ich aktywność w finally; nie dotknięto kont POCO. Pomocnicza zmiana roli globalnej/mappingu legacy do testów została cofnięta; brak zapisanych haseł/tokenów w raportach, SQL lub Git. Dane testowe zachowane.

## Stan wdrożenia i ograniczenia

Tylko nowa izolacja `slm-premium-behavior-review`65321 ma48 migracji. **Używany backend POCO64321 nadal44, bez zastosowania tej poprawki. Cloud bez zmian.** Nowy Auth nadal nieaktywny. Nie zbudowano/nie instalowano nowego APK, nie wykonano merge ani deployu do używanego projektu. Pełna nowa polityka będzie chroniła używany backend dopiero po osobno uzgodnionym lokalnym wdrożeniu przygotowanych4 migracji i istniejącej zmiany allowlisty filtrów, nie po samym APK.

Trwałe składy i odbiór nowego UI pozostają odrębnymi, wcześniej opisanymi etapami. Nie rozszerzano tego zadania o nowe ekrany edycji lub finanse.

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

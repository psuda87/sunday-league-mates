# Premium — prawdziwe dane, etap 1

2026-10-27, Europe/Warsaw. Branch `feat/premium-real-events-stage1`, baza PR18 **845d35e1bc644be5935d3658ed1e3a57cd74b518**, main **134c52b1aee0d0804cc0cf71f151f95040e7a38f**. Na początku sprawdzono fetch i otwarte PR:18 Auth,19 infrastruktura zależna od18,17 diagnostyka,15 audyt profilu,14 Cloud,7 Android. PR19 HEAD54c2241. Nie modyfikowano tych PR ani ich gałęzi. Nowa integracja jest osobnym zależnym Draft PR do brancha18; nie potrzebuje hostingu z19. Po odbiorze18 należy osobno zdecydować o kolejności review/retargetowania.

## Audyt ekranów: źródła przed i po integracji

Kategorie: **1** działający backend i prawdziwy UI, **2** backend istnieje, lecz Premium używa demo lub nie ma podłączenia, **3** wyłącznie demo/niegotowy backend. Obecność SQL bez wykonanych testów nie oznacza E2E.

| Ekran/funkcja Premium | Źródło przed zmianą | Stan po etapie1 / kategoria | Zmiana lub następny krok | Priorytet1.0 |
|---|---|---|---|---|
| Logowanie, sesja, logout | B1 SessionManager → accounts → Auth | LIVE /1, dotychczasowy kontrakt | Bez przebudowy Auth. Nowy model z18 nadal nieaktywny | P0 |
| Rejestracja i e-mail/recovery18 | Kandydat accounts/SQL/proof | Kod istnieje, aktywacja BLOCKED | SMTP/HTTPS/widget/legal i osobny odbiór; nie aktywowano | P0 poza tym zadaniem |
| Własny profil, nazwisko, numer, zdjęcie | B2/B2.2/PR16 adaptery, profile i prywatny Storage | LIVE /1 | Zachowane istniejące bindingi i testy; bez zmiany Ultimate | P0 |
| Moje grupy, tworzenie, członkowie | useGroups → groups_* → SQL/RLS | LIVE /1 | Wykorzystano istniejący B3; przyjazny pusty stan, bez fikcyjnych osób | P0 |
| Szukanie grup, prośby, zaproszenia | B3 groups_search/inbox/decide | LIVE /1 | Dobrowolne przyjęcie; sama prośba/zaproszenie nie jest członkostwem | P0 |
| Role i zgody profilu w grupie | B3/PR16, projekcje serwera | LIVE /1 | Bez zmiany RLS, domyślnych zgód lub globalnego display_as | P0 |
| Aktywna grupa meczów | Wcześniej niezależne fixture demo | LIVE /1 | Selektor tylko rzeczywistych członkostw; stan w sesji UI, bez nowej tabeli/preferencji | P0 |
| Lista: nadchodzące, historia, moje | World.games z demo/data.ts; gotowe matches_* w LIVE | DEMO→LIVE /2→1 | Nowy kontroler używa matches_list/server_now i stabilnych event UUID; strony100 | P0 |
| Utworzenie meczu | EventForm → reducer RAM | DEMO→LIVE /2→1 | Ten sam EventForm z opcjonalnym portem danych → matches_create | P0 |
| Informacje o meczu | Fikcyjny Game | DEMO→LIVE /2→1 | matches_detail, właściwy UUID, realny koszt/czas/limit, prywatne projekcje | P0 |
| Zapis, rezygnacja, rezerwa | Demo reducer | DEMO→LIVE /2→1 | matches_join/reserve/withdraw; brak lokalnej symulacji wyniku | P0 |
| Jeden/dwóch gości | Fikcyjne wpisy RAM | DEMO→LIVE /2→1 | matches_guest, każdy gość osobno; odpowiedzialność pozostaje po stronie serwera | P0 |
| Komunikat o wolnym miejscu | Symulacja demo | LIVE /1 po odświeżeniu | Stan pobrany z serwera, przycisk potwierdzenia; bez automatycznego awansu i bez nowego push | P0 |
| Lista uczestników i rezerwy | Fikcyjne nazwiska/portrety | DEMO→LIVE /2→1 | Wyłącznie DTO serwera, inicjały, kontakt tylko gdy dozwolony; kolejność zgłoszeń | P0 |
| Profil członka grupy | B3 groups_profile | LIVE /1 w zakresie publicznego DTO | Zachowane. W rosterze brak linku do fikcyjnego profilu; zdjęcia innych osób/rozbudowana karta nieprzenoszone | P1 |
| Edycja meczu, gościa, obecność | Backend i starszy domyślny LIVE działają | /2 w Premium; nieprzeniesione | Nadal dostępne w dotychczasowym LIVE. Osobny zakres Premium, bez pozornego zapisu pól | P1 |
| Odwołanie meczu | Gotowy matches_cancel, demo RAM | LIVE /1 | Panel uprawnionej osoby z potwierdzeniem/powodem; zachowana historia i finanse | P0 |
| Składy/boisko/zamiany | DemoTeams, fikcyjny podział | BRAK w rzeczywistym widoku /3 | Wyłącznie istniejący panel Planowane bez przypisanych osób; brak algorytmu/zapisu | Później |
| Rozliczenie w Premium | DemoFinance/kwoty RAM; prawdziwe group_finance_* i starszy LIVE | /2; jawnie niedostępne w nowym widoku | Bez fikcyjnych wpłat/sald. Backend i dotychczasowy LIVE zachowane | Najmniejszy następny moduł |
| Oceny i statystyki | Demo totals/ramki | BRAK rzeczywistych /3 | Własny profil ma —, nie dopisano ocen/statystyk | Po etapie1 |
| Powiadomienia/ustawienia | Osobny backend inbox/FCM, placeholder Premium | NIEPOTWIERDZONE E2E /2 | Bez nowych push. Telefon/iOS/dostarczalność poza zakresem | Osobny etap |
| Wygląd, motywy, nawigacja | Zamrożone Premium3.18 + zaakceptowane poprawki | Zachowane | CSS/assets/Ultimate/BottomNav bajtowo bez zmian | P0 |

## Co zostało zaimplementowane

`B1App` po istniejącej bramce sesji uruchamia `PremiumWorld`. Kontroler `usePremiumEvents` odczytuje rzeczywiste `matches_list`, `matches_detail` i `groups_list`. Slot wydarzeń zastępuje demonstracyjny fragment powłoki; nie kopiuje reducera demo. Ścieżki `#match-create` i stare hashe nie otwierają już fikcyjnego formularza w tym wariancie. Narzędzia demo/fixture i ich oznaczenia pozostają w oddzielnym buildzie demo, bez podłączenia Auth/API. Domyślny routing głównego LIVE nie zmienił się.

Istniejący formularz Premium otrzymał opcjonalny czysto prezentacyjny port `live`; osobne demo zachowuje dotychczasowy flow. Sugestia: najbliższy przyszły czwartek/niedziela18:00,90min,180zł/h,270zł; organizator może zmienić dzień/godzinę/czas/stawkę/koszt. Boisko/adres i limit wymagają ręcznego wpisania, bez fikcyjnej lokalizacji. Test obejmuje również poniedziałek i zmianę stawki/czasu. Limity/uprawnienia/odpowiedzialność za gości/cutoff/FIFO są egzekwowane dotychczasowym SQL, nie reducerem UI.

Po zapisie następuje ponowny odczyt meczu i listy. Brak API lub wadliwy DTO daje empty/error/retry, nigdy fixture. Walidowane są zgodność żądanego UUID, kompletność dopuszczonej projekcji, unikalność wpisów i spójność liczników pełnego rosteru. Outsider nie dostaje zastępczych liczników. Identyfikatory member_id/responsible_user_id pozostają stabilne; gość nie otrzymuje fikcyjnego profilu.

Mutacje mają blokadę równoległych kliknięć i request_id zachowywany przy ponowieniu nieudanej operacji. Każdy gość to oddzielna istniejąca operacja; dodanie dwóch nie jest udawane jako jedna atomowa transakcja. Błąd drugiego nie cofa pierwszego. Wycofanie jest dostępne mimo blokady nowych płatnych zapisów. Powrót z galerii/recheck Auth czyści prywatny cache i ponownie pobiera listę, także gdy natywna kontynuacja pozostawiła powłokę zamontowaną. Inne urządzenie korzysta z ręcznego odświeżenia; nie dodano Realtime/pollingu lub push.

## Rzeczywiste ograniczenia / BLOCKED

- **Konfigurowalne minimum:** obecny SQL/DTO/zasady finansowe mają stałe10. Nie udostępniono fałszywego zapisu innej wartości. Zmiana wymaga osobnego spójnego kontraktu, migracji i regresji finansów; nie zmieniano reguł w tym zadaniu.
- **Pełny odczyt adresu/edycja Premium:** matches_create zapisuje adres, lecz summary nie zwraca go. Nie podłączono edycji z pustym adresem, która mogłaby nadpisać zapisane dane. Istniejący LIVE i zapis adresu pozostają zachowane; rozszerzenie odczytu to osobny zakres.
- Formularz zachowuje dotychczasowy zatwierdzony limit UI do100 uczestników; backend ma szerszy kontrakt. Nie zmieniano go dla tego małego etapu. Lista stronicowana po100: filtry dotyczą bieżącej strony, dostępne są kolejne strony. To nie udawany kompletny serwerowy filtr wszystkich danych.
- Uprawnienie tworzenia pozostaje zgodne z istniejącym kontraktem: administrator grupy i jawnie upoważniony organizator. Nie dodano nowego prawa ani globalnego administratora meczów; delegację nadaje admin. Regresja potwierdza odmowę zwykłemu członkowi.
- Finanse rzeczywiste istnieją, lecz nowy Premium nie ma jeszcze ich podłączenia. Nie pokazuje demonstracyjnych wyników. Oceny, statystyki, składy, rozbudowane karty i push pozostają poza etapem1.
- PR18 nie jest scalony ani aktywowany, PR19 nie jest wdrożony; SMTP/domeny/legal/Cloud pozostają osobnymi blockerami wydania online. Ten PR nie oznacza gotowości produkcji.

## Backend, bezpieczeństwo i dane

**Zero zmian SQL/RLS/Edge/Auth/Storage i zero nowych migracji.** W repo zachowano wszystkie44 migracje; historyczne32 main i55 plików kontraktu Premium sprawdzone. Cztery jawne wyjątki prezentacji: `demo/App.tsx` (slot), `demo/EventForm.tsx` (port), `demo/GroupScreens.tsx` (zwykłe teksty), `demo/Profile.tsx` (aktualne teksty statusu). Pozostałe hashe bez zmiany, w szczególności karta/kolory/motywy/assets/nav. Zmiana B1App dotyczy wyłącznie wyboru powłoki po starej bramce sesji i napisu o wyglądzie. Żadnych nowych mechanizmów logowania.

Do testów utworzono osobny lokalny projekt **slm-premium-real-events**: API63321,DB63322,Mailpit63324,UI5185. Replay44 od zera bez seedów; potem wyłącznie nowe fikcyjne konta/grupy/mecze. Nowy model SQL pozostaje active=false, wszystkie capabilities=false sprawdzone przez prawdziwy HTTP. Bez resetu/kasowania istniejących baz i bez usuwania kont testowych. Lokalny Auth baseline dopasowany tylko w nowym kontenerze; poprzedni kontener zachowano, stare projekty/POCO/tunele nietknięte. Generated local Edge w ignorowanym cache używa dokładnie handlera tej gałęzi i nie jest przeznaczony do deploy.

Zachowane ryzyka wcześniejszego audytu:6moderate zależności (3runtime),4 stare SQL lint warnings. Nie wykonano kolejnego audytu internetowego ani nie zadeklarowano ich usunięcia. Brak nowych bibliotek/zmian lockfile. Kopii kluczy, haseł, tokenów ani rzeczywistych danych nie dodano do repo. Dane logowania testów przeglądarki przekazywane stdin, Cypress16 cy.env, logowanie wpisywania wyłączone, zrzuty tylko fikcyjnych danych.

## Wyniki faktycznie wykonanych testów

| Kontrola | Wynik |
|---|---|
| TypeScript aplikacji / strict Edge / ESLint | PASS, lint bez ostrzeżeń |
| Pełny Vitest | **319 PASS /53 pliki**; obejmuje B1/B2/B3 i nowe testy kontraktów/kontrolera/formularza, retry/dedup/late-response/recheck |
| Celowane testy przed końcową regresją | 31 PASS /4 pliki; po poprawkach testów wszystkie zielone |
| Rzeczywisty PostgreSQL v2 / RLS / finanse | **102 PASS**, m.in. dwa scope grup, FIFO późnej rezygnacji, brak auto-awansu, dwie zaległości z wyjątkiem bezpłatnych meczów, role i niezmienna historia |
| Regresja legacy / replay historii | **31 +11 PASS**, pełne44 migracje, stare ledger/aliasy zachowane; wyłącznie nowe scratch DB |
| Prawdziwy lokalny Auth/Edge/PostgREST/REST/RPC | **27 PASS**:4 konta,2 grupy, przyjęcie/prośba, wspólny mecz,2 gości, reserve/withdraw, równoległe ostatnie miejsce, spoofing/REST/RPC, finanse/cancel, refresh |
| Końcowy Chrome → Premium → prawdziwy serwer | **2 PASS**, po nich2 odczyty potwierdzające faktyczny zapis uczestnika i utworzenie meczu przez UI |
| UI mobilne | 320/360/390px ×Light/Dark, pusty i zapełniony roster, zmniejszona wysokość420px/fokus/przewijanie; automatyczny Chrome, nie fizyczna klawiatura Android |
| Build main / Premium / demo / local real-data | PASS; demo16 artefaktów bez kodu Auth/API |
| Kontrola źródeł | 32 chronione migracje,55 Premium, domyślne wdrożenia wyłączone PASS |
| Android APK / systemowy Wstecz / fizyczny POCO | **NOT TESTED**: zgodnie z zakresem bez APK/sync/instalacji |
| Supabase Cloud / SMTP / hosting | **NOT TESTED / nietknięte** |

W toku pierwszego uruchomienia nowy runner Cypress wskazał niewłaściwy katalog projektu, a nowy test używał usuniętego Cypress.env. Poprawiono tylko narzędzia testowe (`project:app`, cy.env z log:false); nie wyłączano zabezpieczeń lub limitów. Końcowy wynik2PASS dotyczy faktycznego kodu i zapisów serwera. Sprawdzone przez agenta zrzuty końcowe pokazują rzeczywisty pusty widok Light i kompaktowy roster Dark:

- [Light — pusty mecz](https://github.com/psuda87/sunday-league-mates/blob/feat/premium-real-events-stage1/docs/ui/premium-real-events/premium-real-events.cy.ts/real-empty-light.png)
- [Dark — uczestnicy i dwóch gości](https://github.com/psuda87/sunday-league-mates/blob/feat/premium-real-events-stage1/docs/ui/premium-real-events/premium-real-events.cy.ts/real-participants-dark.png)

## Odtworzenie i odbiór

Branch guard wszystkich nowych narzędzi wymaga feat/premium-real-events-stage1. `python app/scripts/prepare-premium-events-local.py` przygotowuje wyłącznie nowy ignorowany lokalny stack. CLI start z `--workdir .cache/premium-events-stack` nigdy nie jest resetem; nie powtarzać poleceń czyszczących. Następnie `--auth-baseline`, lokalny functions serve accounts z tym workdir i `npx vite --config vite.premium-real-local.config.ts` z app/. Endpoint jest sztywny localhost63321, bez .env/Cloud fallbacku. Build testowy: `npm run build:premium-real-local` → ignorowany dist-premium-real-local. Standardowy build Premium nadal używa dotychczasowej konfiguracji lokalnej54321; niczego na POCO nie przełączono.

HTTP: z root `node app/scripts/test-premium-events-http-local.mjs`. Browser dodatkowo SLM_PREMIUM_BROWSER=1, albo sam pion UI z SLM_PREMIUM_BROWSER_ONLY=1. Kody/nazwy użytkowników są generowane tylko dla nowej izolacji; nie są kontami do produkcji i nie są wypisywane. SQL regressions: SLM_PREMIUM_REAL_EVENTS=1 z odpowiednimi trzema istniejącymi runnerami; sprawdzają dokładną etykietę nowego kontenera i tworzą własne scratch DB. Nie kierować testów do istniejącej używanej bazy.

Przed przyszłą osobno zatwierdzoną instalacją POCO: przygotować aktualizację właściwego wariantu i potwierdzić endpoint, bez uninstall/clear. Odbiór dwóch kont: wejście do wspólnej grupy → ten sam event UUID → zapis obu → jeden/dwóch gości → odświeżenie na drugim koncie → pełny mecz/rezerwa → rezygnacja → komunikat o miejscu i ręczne potwierdzenie → restart/Wstecz/klawiatura/oba motywy. Wklejać PASS/FAIL i komunikat, bez haseł/tokenów. Nie oznaczamy tego odbioru jako wykonanego.

## Decyzje podjęte samodzielnie

1. **Baza PR18 zamiast19/main:** potrzebny aktualny kontrakt profilu, ale nie nowa infrastruktura. Zależny Draft PR zachowuje oba wcześniejsze PR bez zmian i nie aktywuje Auth.
2. **Porty w istniejącej prezentacji:** nowy kontroler/DTO i slot, zamiast podmiany Premium starszym LIVE lub przenoszenia demo reducera. Skutek: ten sam wygląd, prawdziwe UUID i serwerowe reguły; osobne demo nadal przydatne.
3. **Minimum/adres/finanse:** brak pozornego zapisu lub przepisywania reguł. Zidentyfikowane braki oznaczone BLOCKED/nieprzeniesione, stary backend/LIVE pozostaje funkcjonalny.
4. **Testy na nowej lokalnej izolacji:** koszt dodatkowego stacku Free/lokalnego, ale bez dotykania istniejących danych. Nowe rekordy zachowane, żadnego resetu dla zielonego wyniku.
5. **Bez Realtime i zbiorczej atomowości gości:** odświeżenie po własnej mutacji oraz ręczne na drugim urządzeniu, jeden serwerowy zapis na gościa. Brak nowych reguł i nieuzasadnionych gwarancji transakcyjnych.

Najmniejszy następny etap: ręczny odbiór tego pionu na POCO po osobnej decyzji o przygotowaniu APK, następnie podłączenie istniejącego group_finance do zakładki Premium bez zmiany naliczania/FIFO. Oceny/składy/statystyki nadal osobno. Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

Źródła techniczne sprawdzone27.10.2026: [Supabase roles](https://supabase.com/docs/guides/database/postgres/roles), [API/RLS](https://supabase.com/docs/guides/api/securing-your-api), [Cypress16 cy.env](https://docs.cypress.io/api/commands/env). Weryfikacja opiera się przede wszystkim na rzeczywiście wykonanych testach tego checkoutu.

2026-10-28 07:58 Europe/Warsaw — Końcowa kontrola po wznowieniu: kod bez zmiany od zapisanych testów27.10; skan493 ścieżek bez rozpoznawalnych sekretów i składnia runnerów PASS. Wcześniejszy limit automatycznego review zatrzymał wyłącznie końcową kontrolę/push; nie utracono implementacji ani wyników. PR18/19 i main ponownie zweryfikowane bez zmiany.

2026-10-28 07:59 Europe/Warsaw — Publikacja kodu d621f730bfbf501fdedac02f0b104427965afc34: [Draft PR20](https://github.com/psuda87/sunday-league-mates/pull/20), baza PR18/845d35e. Stan open/Draft/niescalony, brak konfliktów przy weryfikacji. PR18/19/main oraz backend/CSS/Ultimate/nav/Android bez zmiany. Oryginalny worktree ui-beta zachowuje wszystkie6 lokalnych zmian. Nie wykonano Cloud/APK/merge.

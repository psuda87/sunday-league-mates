# Konsolidacja stabilnego main — 2026-10-28

Draft PR: [#24](https://github.com/psuda87/sunday-league-mates/pull/24), `chore/main-stabilization` → `main`. Bez merge i deployu.

## Stan i pochodzenie

- `origin/main`: `134c52b1aee0d0804cc0cf71f151f95040e7a38f` (PR16). Lokalny `main` w innym worktree pozostaje na `a46f5e4`; nie przełączano go ani nie nadpisywano notatek.
- Commity konsolidacji: `e73d5fe` — selektywna integracja; `cb13ee9` — ochrona Premium, testy, CI i zgodność prywatności. Osobny końcowy commit zawiera dokumentację.
- Zinwentaryzowano 17 worktree i 52 lokalne/zdalne referencje. HEAD i zawartość niezacommitowanych plików w pozostałych 16 worktree pozostały bez zmian. Niezapisane zmiany karty w katalogu głównym **nie zostały przejęte jako zatwierdzony wzorzec**.
- Pełne dane: [gałęzie/worktree](BRANCH_WORKTREE_INVENTORY.json), [otwarte PR](CONSOLIDATION_PR_INVENTORY.json), [graf importów](SOURCE_INVENTORY.json), [pochodzenie plików i źródłowe commity](../app/scripts/stabilization-provenance.json).
- Aktualne `feat/ui-beta`: `2d5984c`; wzorzec `d0f9fa9`, zaakceptowana karta `30772de`, tag `checkpoint/2026-10-25-ui-beta`: `dbc1d5c` — zachowane. UltimatePlayerCard, variables.css i BottomNav są identyczne z zaakceptowanym main.

| PR | HEAD | Baza | Decyzja konsolidacji |
|---|---|---|---|
| 18 | 845d35e | main | Poza zakresem: kandydat nowego modelu Auth/SMTP/recovery, aktywacja niezatwierdzona |
| 19 | 54c2241 | #18 | Poza zakresem: online readiness zależne od nowego Auth |
| 20 | 448a296 | #18 | Wybrane rzeczywiste wydarzenia i adaptery, bez przejmowania Auth18 |
| 21 | 4b7e740 | #20 | Rzeczywiste rozliczenia na istniejących kontraktach main |
| 22 | 74b1595 | #21 | Jawny wariant Android Stage3, bez instalacji |
| 23 | a82397b | #22 | Przywrócone Premium, filtrowanie, lokalne boisko, aktualna rola admina finansów |

Wszystkie sześć źródłowych PR pozostaje Draft, bez formalnych reviews; GitHub zgłaszał możliwość scalenia z ich własną bazą, co nie oznacza akceptacji ani gotowości Cloud. Dodatkowo otwarte #7/#14/#15/#17 zinwentaryzowano, nie zmieniano ich baz ani statusów. #15 jest audytem poprzedzającym PR16; #17 pozostaje diagnostyką modelu kont. #7 częściowo zastąpiono nowszym Androidem, ale zachowuje dokumentację/narzędzia.

Nie wykonano sześciu merge'y. Nowa gałąź ma wyłącznie main jako podstawę; nie dodano sztucznego rodzica z PR23, który oznaczałby eksperymentalny Auth18 jako scalony. Historia źródeł pozostaje na starych gałęziach i w jawnym rejestrze SHA per plik.

## Co działa i co pozostaje osobno

| Obszar | Stan w kandydacie |
|---|---|
| Auth/sesja/B1 | LIVE, mechanizmy main; bez nowego Auth18 i bez aktywacji poczty |
| Profil/PR16/zdjęcie/numer | LIVE; potwierdzono legacy i e-mail, prywatność A–G, Storage, refresh i restart kontrolera |
| Grupy/członkostwo/zgody | LIVE, istniejące API/RLS i dobrowolne członkostwo |
| Mecze/uczestnicy/goście/rezerwa | LIVE; serwer kontroluje dostęp i zapis; istniejący formularz Premium |
| Tworzenie/edycja | Aktywny członek tworzy; podstawowa edycja oddzielona od finansów. Stary LIVE również respektuje serwerową capability i filtry przed paginacją |
| Finanse | LIVE; aktualny aktywny administrator grupy, bez uprawnień z created_by/organizera/globalnej lub dawnej roli |
| Własne należności/wpłaty | LIVE dla członka, bez dostępu do cudzych finansów |
| Feed/historia | Własne aktualne grupy i przyszłe publiczne; własna historia po odejściu. Obce prywatne niewidoczne, filtr SQL przed LIMIT/OFFSET |
| Boisko/zamiany | Rzeczywisty uprawniony roster, jawny lokalny szkic RAM, cofnięcie i goście; brak trwałego zapisu/autora. Projekt kolejnego etapu w PREMIUM_LINEUP_BACKEND_PLAN.md |
| Statystyki/oceny | Bez fikcyjnych statystyk udających rzeczywiste dane. Pełny moduł nie jest ukończony |
| Powiadomienia | Istniejący kod main i SQL zachowane; dostarczenie push/FCM nie było testowane |
| Izolowane demo | Nadal osobny build; brak Auth/API w bundle. Współdzielony katalog demo nie jest martwym kodem |

Domyślny `app/src/main.tsx → App → Accounts` nadal uruchamia LIVE main. `app/b1/main.tsx → B1App → PremiumWorld → demo/App` to jawny Premium z rzeczywistymi slotami wydarzeń/grup/profilu. Android Stage3 używa tego samego B1App. `app/demo/main.tsx` pozostaje izolowaną demonstracją. **Nie przełączono domyślnego routingu na Premium/demo.**

## Migracje i wykryta regresja

Zachowano bajtowo po normalizacji EOL wszystkie 35 istniejących migracji main. Dalej, w tej kolejności:

1. `20261028174603_premium_match_membership_visibility.sql`
2. `20261028174920_premium_member_creation_finance_guard.sql`
3. `20261028175508_premium_match_feed_filters.sql`
4. `20261028181054_premium_group_admin_only_finance.sql`
5. `20261028204500_restore_pr16_match_name_projection.sql` — nowa poprawka zgodności konsolidacji.

Łącznie **40**, bez dziewięciu migracji eksperymentalnego Auth18. Rejestr i historyczne skróty kontroluje guard.

Rzeczywisty test profilu PR16 wykrył, że nowszy pełny dispatcher matches nadpisywał projekcję display_as samym publicznym pseudonimem. Nie był to wyciek nazwiska, ale utrata funkcji. Ostatnia migracja przywraca istniejące `profile_display_name` z fallbackiem `public_player_name` dla zawodnika i osoby odpowiedzialnej. Brak zmian danych, zgód, grantów, Auth i wyliczeń finansowych; nieznany kształt dispatchera powoduje przerwanie zamiast cichego patchowania. Nie edytowano wcześniejszych migracji.

Nowy stack `slm-main-stabilization`, HTTP **55321**, przygotowano wyłącznie ze źródeł tej gałęzi. Odtworzono pierwsze 39 migracji, następnie zastosowano wyłącznie lokalnie migrację zgodności. Nowe syntetyczne konta/grupy i obrazy pozostawiono w tej bazie. Nie resetowano żadnej bazy. Używane instancje POCO/64321, PR16/56321 i Cloud nie były celem testów ani migracji.

## Ochrona Premium i bezpieczeństwo

- Kontrakt 55 plików porównywany również z niezmiennymi obiektami Git main/zaakceptowanego a82397b. Tylko sześć historycznie zaakceptowanych wyjątków wizualnych ma hashe z tego źródła; nie dopasowywano hashy do nowego wyglądu.
- Guard sprawdza rzeczywiste importy, wrappery, warunki renderowania, HTML/Vite/Capacitor, listę buildów, 35+4 historyczne migracje i brak kandydata Auth. Pinowane są także warstwy grup, finansów, boiska oraz style real-data Premium.
- 13 testów: poprawny graf i 12 prób obejścia przez routing/import/komponent/entrypoint/Capacitor/build/hash/listę plików. Oddzielny test B1 renderuje prawdziwy shell, kontrolery, kartę, boisko i własny profil bez mockowania komponentów UI; transport fixture nie jest opisany jako E2E.
- Testy HTTP dowodzą braku eskalacji przez created_by, organizera i globalną rolę, natychmiastowego odebrania praw finansowych po zmianie admina oraz blokady bezpośredniego REST/RPC. RLS i prywatność nazw/telefonów sprawdzono osobno.
- Native refresh token pozostaje w Keystore; dotychczasowy domyślny namespace zachowany, jawny Stage3 ma oddzielny namespace. Bez fallbacku do Preferences/localStorage na Androidzie i bez logowania mostu.
- Brak sekretów/plików .env/APK/kluczy prywatnych w dodanych plikach; skan staged sprawdza wzorce tokenów i kluczy, nie jest pełnym audytem historii wszystkich dawnych commitów.
- Ochrona repo nie jest odporna na celową zmianę samych guardów/CI. Potrzebny przegląd właściciela i zatwierdzona ochrona gałęzi; CODEOWNERS sam jej nie wymusza.

## Wykonane kontrole

| Kontrola | Wynik |
|---|---|
| TypeScript aplikacji + strict Edge | PASS; dwie zastane deklaracje wymiarów obrazu poprawiono wyłącznie typowo, bez zmiany walidacji |
| ESLint | PASS |
| Vitest | **289/289**, 50 plików |
| Guard Premium/migracji + próby obejścia | PASS; **13/13** |
| Prawdziwy Auth/Edge/PostgREST — mecze | **29/29** |
| Prawdziwe uprawnienia finansowe | **48/48** |
| Regresja PR16 + legacy/e-mail/refresh/Storage | **39/39**; łącznie **116** kontroli HTTP |
| SQL/RLS | **6/6** zestawów: integration-contracts, premium_profile_name, premium_match_visibility, premium_admin_finance, settlements, notifications; fixtures SQL kończą się rollback |
| Chrome przez prawdziwy lokalny HTTP | **3/3**, 320/360/390 px, Light/Dark, private/history, plus, boisko/goście/nieparzysta liczba, zamiana/cofnięcie, sticky header i BottomNav |
| Build LIVE/Premium/demo/Android web | PASS; izolacja demo PASS |
| Capacitor sync + assembleDebug | PASS; JDK21/SDK36, końcowy exit 0 |
| GitHub-hosted CI | **NOT RUN**, przygotowana konfiguracja ręczna |
| Fizyczny POCO / podpis aktualizacji / resume | **NOT TESTED w tym zadaniu**; APK nie instalowano |
| Cloud/SMTP/recovery/FCM delivery | **NOT TESTED**, brak wdrożeń/aktywacji |

Zrzuty rzeczywiście działającego Premium: [320 Dark](https://github.com/psuda87/sunday-league-mates/blob/chore/main-stabilization/docs/ui/main-stabilization/premium-behavior.cy.ts/filters-320-dark.png), [390 Light](https://github.com/psuda87/sunday-league-mates/blob/chore/main-stabilization/docs/ui/main-stabilization/premium-behavior.cy.ts/filters-390-light.png), [boisko/sticky](https://github.com/psuda87/sunday-league-mates/blob/chore/main-stabilization/docs/ui/main-stabilization/premium-behavior.cy.ts/pitch-sticky-dark.png). Obejrzano renderowane obrazy, nie wywnioskowano wyglądu z samego builda. To nie jest nowy ręczny odbiór właściciela ani pełny pikselowy test całej aplikacji.

### Pozostałe ostrzeżenia

SQL lint: cztery zastane ostrzeżenia, bez nowych błędów: `slm_push_claim` text→jsonb przy inicjalizacji `result`; nieużywany `p_number` w `slm_email_profile_save`; nieużywane `v_before`/`v_rows` w finansach. Pierwsze wymaga osobnej weryfikacji przed odbiorem dostarczania push, którego tutaj nie potwierdzamy. Pozostałe trzy dotyczą nieużywanych wartości. Nie obniżano poziomu kontroli, nie poprawiano przy okazji powiadomień.

`npm audit`: **0 high/critical, 6 moderate**, obejmujących router/Ionic oraz narzędzia Capacitor/xcode/uuid. Router ma advisory open redirect oraz SSR hydration; aplikacja nie używa SSR, nie stwierdzono tu wejścia niezaufanego URL do nawigacji, lecz nie uznano alertu za naprawiony. Rekomendowany przez audit skok routera do major8 wymaga oddzielnej zgodności Ionic/nawigacji. Nie wykonano force-fix. Ostrzeżenia dużych bundle/Browserslist/Gradle pozostają nieblokującymi ostrzeżeniami narzędzi.

## GitHub/CI i kolejność dalszej pracy

Sprawdzono tylko odczyty: prywatne repo, brak wcześniejszych workflow, `main protected=false`, brak rulesets/required checks; squash/merge/rebase dozwolone, automatyczne usuwanie gałęzi wyłączone. Ustawień nie zmieniano. Nowy PR jest Draft, bez konfliktu z main.

Przygotowany workflow ma wyłącznie `workflow_dispatch`, warunek potwierdzenia bezpłatnego limitu, read-only permissions, timeout, pełne SHA oficjalnych actions, brak sekretów i uploadu artefaktów. Nie uruchomiono go zdalnie. Po zatwierdzeniu trzeba również uwzględnić wymóg obecności workflow na domyślnej gałęzi dla workflow_dispatch. Nie jest jeszcze automatycznym wymaganym checkiem PR. Zasady kosztów i pinowania: [GitHub billing](https://docs.github.com/en/actions/concepts/billing-and-usage), [secure use](https://docs.github.com/en/actions/reference/security/secure-use).

Rekomendowana kolejność: odbiór #24 → osobna zgoda i merge #24 → decyzja o losie zastąpionych zakresów #20–#23 (bez ich kolejnych merge'y) → dokończenie i oddzielny odbiór #18 → dopiero #19/Cloud readiness. Nie zmieniono baz ani statusów dawnych PR. Źródłowe referencje należy zachować także dlatego, że guard odczytuje z nich niezmienne obiekty Git.

## Kod do późniejszego przeglądu, bez usuwania

Graf wskazał pięciu kandydatów poza punktami wejścia: ExploreContainer.tsx i jego CSS, Home.css, demo/GroupsScreen.tsx (nadal testowany), notifications/financeAdapter.ts (nadal testowany). To kandydaci do analizy, nie dowód bezpiecznego usunięcia. demo/App, Teams, GroupScreens, Profile i AccountScreens są rzeczywiście współdzieloną prezentacją. LIVE Accounts/Events/Settlements/Notifications i historyczne akcje pozostają osiągalne. Nie usunięto plików.

Gałęzie feat/auth, feat/events, feat/integration oraz zdalne push-notifications/settlements są już przodkami main — kandydaci do późniejszej archiwizacji po sprawdzeniu worktree, nie do automatycznego usunięcia. Checkpointy UI/źródłowe PR18–23 zachować. Historyczne raporty B1/B2/B3 i stare instrukcje w AGENTS pozostały; nowy wpis nadrzędny i ten raport opisują aktualny stan zamiast przepisywać historię.

## Android i decyzje właściciela

APK: `I:/slm/sunday-league-mates/.worktrees/main-stabilization/app/android/app/build/outputs/apk/debug/app-debug.apk`, package `pl.psuda87.slm`, nazwa Sunday League Mates, SHA-256:
`04e182e600d28b0de3e06c73d9332cc28a0210f1d127732928c718dbd721990c`.

To zachowany wariant Stage3 z endpointem **64321**; nie przekonfigurowano APK na testowe55321 ani nie migrowano używanej bazy64321. Przed instalacją trzeba osobno uzgodnić kompatybilny backend/endpoint i aktualizację bez czyszczenia danych. Sam build nie dowodzi zgodności z aktualnie używaną bazą telefonu.

Wymagają decyzji właściciela: odbiór wyglądu i selektywnego zakresu #24 (w tym nowej migracji zgodności), ewentualny test/instalacja POCO, merge, włączenie wymaganych kontroli/ochrony GitHub i potwierdzenie bezpłatnego CI. Zdalne migracje, Storage, SMTP/Auth18, Cloud i usuwanie gałęzi wymagają odrębnych decyzji. Nie przełączono domyślnego UI ani nie rozpoczęto kolejnego modułu.

Samodzielne decyzje: odseparowano eksperymentalny Auth zamiast scalać cały stos; wykorzystano istniejącą prezentację i main Auth; odtworzono PR16 formatter osobną migracją po rzeczywistym FAIL; poprawiono tylko dostępność/filtrowanie starego LIVE; CI pozostawiono ręczne przy nieznanym bezpłatnym limicie; nie usuwano niejednoznacznie używanego kodu ani źródeł wzorca.

Status: **przygotowane do odbioru w Draft PR #24, nie oznacza zgody na merge ani gotowości wdrożenia Cloud**. Chronologiczny zapis odpowiedzi: `docs/ODPOWIEDZI_CODEX.txt`.

# Final audit PR24 — 2026-10-28, Europe/Warsaw

## Werdykt: READY FOR OWNER REVIEW

Nie wykryto P0/P1 w sprawdzonym zakresie. Werdykt dotyczy kodu konsolidacji i przetestowanej lokalnej konfiguracji, **nie jest zgodą na merge, wdrożenie Cloud ani aktualizację POCO**. Pozostałe ograniczenia i decyzje są wymienione poniżej. Zielone testy nie dowodzą pełnego bezpieczeństwa.

- Audytowany PR: [#24](https://github.com/psuda87/sunday-league-mates/pull/24).
- Osobny Draft PR raportu: [#25](https://github.com/psuda87/sunday-league-mates/pull/25), bez zmian w kodzie PR24.
- Dokładny HEAD: **`39ef2e3937b781439864029a92c12de315024263`**.
- Sprawdzony `origin/main`: **`134c52b1aee0d0804cc0cf71f151f95040e7a38f`**.
- GitHub: PR24 Draft, `mergeable=true`, brak konfliktu z tym main. Main jest przodkiem PR24. Nie wykonano merge/rebase ani zmiany PR24.
- Raport powstaje na osobnej gałęzi `audit/pr24-final`, z PR do `chore/main-stabilization`; nie stanowi alternatywnego PR scalającego całą konsolidację do main.

To ponowny przegląd tego samego agenta, oparty na odczycie kodu/katalogu PostgreSQL i nowych próbach; nie jest recenzją drugiego człowieka ani zewnętrznym audytem. Wyniki wcześniejszego autora rozdzielono od kontroli ponowionych.

## 1. Konsolidacja i migracje

Ponownie pobrano referencje i metadane GitHub. Źródłowe PR pozostają Draft, bez zmiany HEAD/baz:

| PR | HEAD | Baza | Zakres w PR24 |
|---|---|---|---|
| 18 | 845d35e1 | main | Nowy Auth, SMTP i recovery poza konsolidacją |
| 19 | 54c2241e | #18 | Online readiness poza konsolidacją |
| 20 | 448a2967 | #18 | Selektywnie rzeczywiste wydarzenia, bez Auth18 |
| 21 | 4b7e7402 | #20 | Rzeczywiste finanse |
| 22 | 74b1595d | #21 | Jawny wariant Android Stage3 |
| 23 | a82397b1 | #22 | Premium, filtry, lokalne boisko, aktualny admin finansów |

`stabilization-provenance.json`: sprawdzono **47 plików źródłowych**, bez niezgodnych source_sha256. Cztery różnice względem wskazanego źródła odpowiadają opisanym adaptacjom: Android main bez accountModel, dwa skrypty HTTP dla osobnej instancji i test SQL bez tabeli kandydata Auth. Pozostałe adaptacje main są jawnie wymienione osobno. Nie znaleziono przejęcia eksperymentalnego Auth18/online19; Auth18 nie jest przodkiem tej gałęzi, tabela `slm_account_model_state` nie istnieje w przetestowanej bazie, handler accounts zachowuje main Auth i dodaje jedynie pola filtrów meczów.

Zachowano wszystkie **35 migracji main**. Dalsza kolejność jest poprawna:

1. `20261028174603_premium_match_membership_visibility.sql`
2. `20261028174920_premium_member_creation_finance_guard.sql`
3. `20261028175508_premium_match_feed_filters.sql`
4. `20261028181054_premium_group_admin_only_finance.sql`
5. `20261028204500_restore_pr16_match_name_projection.sql`

Ważna kolejność: migracja 2 ma historyczną pośrednią regułę creator+organizer; dopiero 4 ustala ostateczne admin-only. Migracja 3 ponownie definiuje dispatcher, a 5 przywraca projekcję nazw PR16 po tej definicji. Nie wolno zatrzymać wdrożenia na częściowym zestawie ani ręcznie zmieniać kolejności. Migracja 5 jest wykonywana raz przez ledger migracji; jej strażnik celowo odrzuci nieoczekiwany kształt funkcji lub ręczne ponowne uruchomienie.

Nowa baza `slm-main-stabilization/55321` ma faktycznie **40 migracji**. W poprzednim zadaniu odtworzono 39, utworzono syntetyczne dane, potem zastosowano 40. zgodnościową; testy po niej przeszły. W tym audycie nie stosowano migracji. Ponownie odczytano końcowe funkcje i przetestowano ich zachowanie, zamiast wnioskować wyłącznie z pierwszej definicji w historii SQL.

Zgodność jest potwierdzona dla wersjonowanego schematu main i tej izolowanej instancji. **Nie potwierdzono schematu/ledgera używanej bazy POCO ani Cloud**; mogą zawierać dodatkowe migracje lub lokalne definicje. Przed jakimkolwiek wdrożeniem potrzebny oddzielny preflight historii, backup i kontrola końcowych funkcji/grantów. Merge kodu nie wykonuje tych operacji; automatyczne wdrożenia pozostają wyłączone.

## 2. Rzeczywisty routing i Premium

Prześledzono importy oraz renderowanie, nie tylko sumy kontrolne:

- Domyślny `src/main → App → Home/Accounts` nadal uruchamia LIVE main. Nie przełączono go potajemnie na demo/Premium.
- `b1/main` i `android-stage3/main` uruchamiają B1App z dotychczasowym SessionManager. B1App przekazuje rzeczywiste `manager/userId/personalProfile/groupsView` do PremiumWorld.
- PremiumWorld używa współdzielonego demo/App jako prezentacji, ale przekazuje rzeczywiste eventsView/liveEvents. Listę i szczegóły renderuje PremiumEvents, karty stadionowe MatchHero, zakładki MatchTabs, finanse PremiumFinance/PremiumGroupFinance, boisko PremiumTeams/PremiumPitch. Nie przejęto reducera demo jako źródła prawdy.
- UltimatePlayerCard, variables.css i BottomNav są zgodne z zaakceptowanym main/kontraktem karty30772de; późniejsze wyjątki Premium pochodzą ze wskazanego a82397b. Lokalnych niezacommitowanych zmian root/feat-ui-beta nie uznano automatycznie za zaakceptowany wzorzec.
- Plus pozostaje akcją istniejącej nawigacji; dostępność wynika z członkostwa i capability serwera. Filtry są przekazywane do API; SQL stosuje widoczność/scope/period przed LIMIT/OFFSET.
- Boisko obsługuje rzeczywisty uprawniony roster, gości, nieparzystą liczbę i zamiany lokalne. Nie ma pozornego zapisu na serwerze; autor ostatniej zmiany nie jest fabrykowany.
- Sticky header to mały pasek tytułu/akcji po przewinięciu, a nie przyklejone dekoracyjne logo. Safe-area, dolny odstęp i BottomNav pozostają w istniejących stylach Premium.

Ponownie wykonano test renderowania B1 i testy UI/finansów. Dodatkowe dwa Chrome E2E przez prawdziwe HTTP pokazały własną kartę oraz finanse członka i admina; karta mieściła się w szerokościach320/360/390 w Light/Dark. Obejrzano faktyczne zrzuty. Nie ma nowego odbioru całego UI przez właściciela ani testu fizycznego Android safe-area.

**Ograniczenie strażnika:** hipotetyczna podmiana `PremiumGroupFinance.tsx` na pusty komponent została zaakceptowana przez `verifyPremiumRuntime(..., overrides)`. Oryginalnego pliku nie zmieniono. Aktualny wrapper jest prawidłowy i przechodzi nowy test przeglądarkowy, ale 13 istniejących prób obejścia nie zapewnia pełnej ochrony wszystkich renderowanych wrapperów. Szczegóły P2-01 poniżej.

## 3. Bezpieczeństwo serwera

Sprawdzono Edge accounts, końcowe definicje SQL, ACL/RLS i rzeczywiste odpowiedzi HTTP:

| Reguła | Dowód |
|---|---|
| Aktywny członek tworzy mecz | POST matches_create dla zwykłego członka PASS; inactive/outsider/inny admin odrzuceni |
| Finanse tylko aktualnego aktywnego admina | Końcowe group_finance_admin/match_finance/own_finance_scope odwołują się do bieżącej grupy i aktywnego konta |
| Brak praw z created_by/organizer/globalnej roli | Odmowy pełnego zestawu operacji finansowych twórcy/organizera; brak fallbacku globalnego admina; kontrola mapowania legacy |
| Odebranie roli działa natychmiast po stronie serwera | Te same stare access token i request_id po transferze roli otrzymują odmowę; RLS ukrywa cudzy ledger; nowy admin działa bez odświeżenia logowania |
| Prywatne mecze nie wyciekają | Obce prywatne tytuły/DTO niewidoczne, detail odrzucone, publiczny roster bez cudzych telefonów, historia byłego członka tylko własna |
| Własne finanse członka nadal działają | Own account/dues, submit_payment, odczyt zaakceptowanych wpłat i dalsza obsługa przez nowego admina |
| Bez obejścia bezpośrednim REST/RPC | Próby bezpośredniego odczytu i RPC z podstawionym p_user odrzucone |

Odczyt katalogu: **0 tabel public.slm_* bez RLS**, **0 publicznych SECURITY DEFINER slm_* wykonywalnych przez anon/authenticated**. To nie jest dowód poprawności każdej polityki; dlatego wykonano także próby HTTP i SQL na konkretnych rolach. Edge bierze tożsamość z potwierdzonej sesji, a nie z p_user w body czy edytowalnego user_metadata.

Kod serwowany lokalnie porównano ze źródłami: brak nieoczekiwanych różnic; jedyna różnica to deklaracja typu `_shared/webp.ts` bez zmiany zachowania. Prywatność PR16 pozostaje w końcowym dispatcherze dzięki migracji40. SecureStorage utrzymuje dotychczasowy domyślny klucz i oddzielny klucz Stage3; brak native fallbacku do Preferences/localStorage, loggingBehavior none.

Aktualna dokumentacja Supabase potwierdza konieczność wspólnej kontroli grants i RLS oraz chronienia service_role: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security). Odczytano również changelog. Werdykt opiera się na zachowaniu konkretnego lokalnego schematu/wersji CLI, nie na założeniach o aktualnym Cloud.

## 4. Testy i wiarygodność dowodów

### Ponowione w tym audycie

| Kontrola | Wynik |
|---|---|
| Źródła/provenance/pochodzenie/migracje | PASS; 47 poprawnych source hashes, 35 starych +5 nowych migracji |
| Guard Premium | PASS dla aktualnego drzewa; dodatkowy negatywny probe ujawnił lukę pokrycia wrappera |
| Celowane Vitest | **19/19**, 4 pliki: premiumRuntime, premiumUi, finance, memberCreation |
| Rzeczywisty Auth/Edge/REST — uprawnienia finansowe | **48/48** |
| Rzeczywisty Auth/Edge/REST — widoczność i filtry meczów | **29/29** |
| SQL/RLS | **6/6** zestawów, transakcyjne fixtures z rollback |
| Dodatkowy Chrome E2E | **2/2**: karta/finanse członka i finanse admina, prawdziwy HTTP55321 |
| Katalog bezpieczeństwa/migracji | PASS dla opisanych zapytań; candidate absent, 40 migracji |
| slm_push_claim initializer | jsonb_typeof = array w transakcji zakończonej rollback; ostrzeżenie inicjalizacji nie dało błędu runtime w tej próbie |
| APK/config/manifest/zasoby | PASS; właściwy pakiet i entry, 0 brakujących/niezgodnych zasobów APK względem dist-android-stage3 |
| GitHub/main/konflikty | PASS dla odczytów; stan ochrony opisany osobno |

Całość HTTP i SQL dotyczyła wyłącznie istniejącej **izolowanej instancji testowej55321**, nowych fikcyjnych fixtures i nieprodukcyjnych obrazów. Nie używano bazy POCO64321 ani Cloud. Skrypty zachowały nowe fixtures; tymczasowe zmiany stanów kont w kontrolach negatywnych przywrócono przez finally, a SQL fixtures wykonano z rollback. Nie resetowano baz ani nie wdrażano Edge Functions.

### Wcześniejsze wyniki sprawdzone, bez bezcelowego powtarzania

Raport/logi konsolidacji są zgodne ze stanem kodu: 289 Vitest/50 plików, TypeScript aplikacji i strict Edge, ESLint, 13 testów strażnika, dodatkowe39 HTTP profilu/Auth/Storage, 3 Chrome dla filtrów/historii/boiska320/360/390 Light/Dark, build LIVE/Premium/demo/Android web, Capacitor sync i assembleDebug exit0. Sprawdzono logi, stan źródeł i artefakt; **nie powtarzano pełnego zestawu ani buildów w tym audycie**. Nie sumujemy19 z289 ani nowych E2E z poprzednimi jako jednego pełnego uruchomienia.

Logi lokalne: `.worktrees/main-stabilization/.cache/final-audit/` (bez eksportowania kont/secrets). Zrzuty audytu: [Ultimate](https://github.com/psuda87/sunday-league-mates/blob/audit/pr24-final/docs/ui/final-main-audit/final-main-audit.cy.ts/own-ultimate-dark.png), [finanse członka](https://github.com/psuda87/sunday-league-mates/blob/audit/pr24-final/docs/ui/final-main-audit/final-main-audit.cy.ts/member-real-finance-dark.png). Dane na obrazach są syntetyczne. Scenariusz dodatkowego E2E: `docs/audit/PR24_RENDERED_RUNTIME.cy.ts`; nie jest nowym modułem aplikacji ani aktywną konfiguracją CI.

## 5. Problemy i ryzyka

Brak wykrytych P0/P1. Poniższe punkty nie oznaczają usunięcia istniejących alertów:

| ID / priorytet | Plik / przyczyna | Wpływ i minimalne dalsze działanie |
|---|---|---|
| P2-01 | `app/scripts/premium-route-policy.mjs`, `app/src/finance/PremiumGroupFinance.tsx`: wrapper nie jest pinowany ani osobno badany przez stare próby obejścia | Aktualny render poprawny, lecz przyszła podmiana może przejść guard. Dodać wrapper do kontroli faktycznej ścieżki i test mutacyjny. Nie zmieniano guardów ani hashy podczas audytu |
| P2-02 | `app/vite.premium-finance-local.config.ts`, `app/capacitor.config.ts`: APK64321 kontra testowana baza55321 | Nie instalować jako dowodu zgodności z40migracjami. Osobno uzgodnić endpoint/kompatybilny backend, stan sesji i aktualizację bez czyszczenia danych |
| P2-03 | GitHub `/branches/main`, `.github/workflows/stabilization-review.yml`, `.github/CODEOWNERS`: brak ochrony/required checks; tylko ręczny workflow | Ryzyko pominięcia recenzji lub zmiany samych guardów. Właściciel powinien zatwierdzić zasady ochrony i CI po weryfikacji darmowego limitu. CODEOWNERS bez ochrony nie wymusza review. Po merge workflow nie staje się automatycznym checkiem main/PR |
| P2-04 | `app/package-lock.json`: 6 istniejących moderate alertów router/Ionic/Capacitor/xcode/uuid | Nie są nową regresją PR24. Nie wykazano tu ścieżki open redirect; SSR nie jest używane. Alerty pozostają otwarte. Oddzielna zgodna aktualizacja/testy nawigacji, bez force-major-upgrade w audycie |
| P3-01 | `20261014121000_notifications_rpc_and_worker.sql:112` i starsze funkcje email_profile/finansów: 4 ostrzeżenia SQL | Inicjalizacja push_claim działała w ponowionej próbie; nie potwierdza to FCM delivery. Pozostałe ostrzeżenia dotyczą nieużywanych p_number/v_before/v_rows. Osobno sprawdzić pełny push, nie przebudowywać teraz |
| P3-02 | `app/src/ui/UltimatePlayerCard.tsx` / zamrożone style nameplate: długi jednolity syntetyczny pseudonim zawija się i jest częściowo przycinany maską | Kosmetyka, widoczna na zrzucie; karta nie wychodzi poza viewport. Zgodne z dotychczasowym kodem wzorca, nie jest nową zmianą PR24. Poprawa wymaga osobnego zatwierdzenia wyjątku UI |

W root/feat-ui-beta pozostają niezacommitowane zmiany m.in. usunięcia ołówka numeru. PR24 ich nie zawiera, co było jawnie wskazane w raporcie konsolidacji. Nie nadpisano ich ani nie uznano za zatwierdzony commit. Właściciel powinien oddzielnie odebrać ten zakres; nie przenosić starego komponentu kosztem nowszych propsów zdjęć.

Ryzyka migracji: rzeczywisty Cloud/POCO może mieć inną historię; obowiązkowa pełna sekwencja pięciu kroków; końcowy patch zależy od konkretnej definicji funkcji i celowo przerywa przy drift; nie sprawdzono zachowania na danych produkcyjnych. Nie usunięto starych gałęzi — źródłowe referencje są też potrzebne do odczytu niezmiennych obiektów Git przez guard.

## 6. Android i GitHub

APK SHA-256: `04e182e600d28b0de3e06c73d9332cc28a0210f1d127732928c718dbd721990c` — zgodny z raportem konsolidacji. Manifest: `pl.psuda87.slm`, Sunday League Mates. Z ZIP APK odczytano `webDir=dist-android-stage3`, `loggingBehavior=none`; wszystkie zasoby dist są zgodne, brak wskazanych markerów kandydata Auth. Potwierdzono endpoint64321. To nie jest test działania na fizycznym telefonie ani pełny audyt bundle.

GitHub odczytano ponownie: main nadal134c52b, **protected=false**, rulesets **0**. Nie zmieniano ustawień. GitHub-hosted Actions nie uruchamiano. Istniejący workflow jest ręczny, ograniczony do gałęzi chore/main-stabilization i potwierdzenia bezpłatnego limitu; wymaga osobnej decyzji o przyszłej polityce CI.

## 7. Nie sprawdzono i wymagane akceptacje

**NOT TESTED:** fizyczny POCO/ADB/resume/klawiatura/status bar, podpis aktualizacji względem telefonu, nowy ręczny odbiór właściciela, rzeczywista baza Cloud/POCO i ich upgrade, dostarczalność SMTP/recovery, FCM delivery, obciążenie/wyścigi poza konkretnymi testowanymi scenariuszami, pełna historia repo pod kątem dawnych sekretów, wszystkie możliwe alternatywy obejścia guardów. Nie jest to deklaracja100% bezpieczeństwa.

Właściciel podejmuje osobno decyzje o: (1) odbiorze zakresu/wyglądu PR24 i akceptacji pozostałych P2/P3, (2) ochronie main i bezpłatnych kontrolach CI, (3) ewentualnym merge PR24, (4) preflight/backup/planie migracji i backendzie do odbioru Androida, (5) instalacji/testach telefonu. Cloud, Auth18/SMTP/online19 i usuwanie gałęzi wymagają odrębnych zgód. READY FOR OWNER REVIEW nie udziela żadnej z tych zgód.

Nie przygotowano poprawki produkcyjnej ani P0/P1 Draft PR, ponieważ takiego błędu nie wykryto. Osobny Draft PR audytu zawiera wyłącznie raport, zapis statusu/odpowiedzi, scenariusz testowy i syntetyczne zrzuty. Zapis końcowej odpowiedzi: `docs/ODPOWIEDZI_CODEX.txt`.

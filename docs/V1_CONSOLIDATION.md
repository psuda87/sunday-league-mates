# SLM 1.0 — pierwszy PR konsolidacyjny

2026-10-25 17:04 Europe/Warsaw. Gałąź `feat/v1-consolidation` z main `1fadd977`. Implementacja `f50484f`; [draft PR #11](https://github.com/psuda87/sunday-league-mates/pull/11) otwarty bez scalania. Osobny worktree `.worktrees/v1-consolidation`; źródłowe gałęzie i katalog użytkownika zachowane.


## Końcowy przegląd przed merge — 2026-10-25 17:23 Europe/Warsaw

**Rekomendacja: PR #11 gotowy do review i rekomendowany do scalenia po osobnym potwierdzeniu właściciela. Nie znaleziono błędów blokujących. Nie wykonano merge.**

Sprawdzony HEAD `ae397c41547da307edf15963e22b4fe0dae789e3`, zgodny z origin/feat/v1-consolidation. Po fetch main nadal `1fadd977d9737f371b75a59eee63ce6c50e4cb3b`; jest przodkiem HEAD. GitHub potwierdził mergeable=true. Późniejszy commit tego przeglądu zmienia wyłącznie dokumentację, nie oceniany runtime. PR oznaczono Ready for review (draft=false), zgodnie z nowym wyraźnym poleceniem właściciela; merged=false.

### Integracja i wygląd

- Manifest źródeł potwierdza zachowanie App/main, pages/live, BottomNav, SessionManager/tokenStore, release guard i wszystkich 29 wcześniejszych migracji main. Lockfile niezmieniony. Brak usuniętych plików względem main.
- Premium B1/B2 pozostaje jawnym wariantem lokalnym: rzeczywiste Auth/sesja i własny profil, reszta oznaczone demo. Domyślny LIVE main nie został zastąpiony. Sprawdzono blokadę widoków chronionych, wymuszenie zmiany hasła, generacje zapytań przy zmianie konta oraz serwerowy read-back profilu/zdjęcia.
- CSS karty jest identyczny z 30772de; UltimatePlayerCard identyczny z odebranym kodem live 5c3f13f (w tym wcześniej zaakceptowane cover dla własnego zdjęcia). Kontrola SHA 55 plików Premium PASS. Brak nowych zmian UI.
- Uwzględniono 7/7 ręcznych PASS właściciela na POCO: Auth/sesja, profil/numer, zdjęcia, karta/oba motywy, oznaczenie demo, LIVE grupy/mecze/zapisy/goście/rozliczenia, brak crashy/błędów uprawnień/utraty danych. To wyniki właściciela, nie nowe fizyczne testy agenta.

### Bezpieczeństwo i dane

Sprawdzono przyrost handlera accounts, trzy dodane migracje i obsługę zdjęć. Pozostają: sesja sprawdzana na serwerze, blokada hasła tymczasowego, role z danych serwerowych zamiast user_metadata, aktualne hasło i nowa sesja przy zmianie legacy aliasu, brak zmiany technicznego e-maila. Prywatny bucket/metadata, brak bezpośredniego dostępu anon/authenticated, service-only RPC, owner UUID z sesji, limit WebP150000B/800px, ograniczony odczyt body, rate limit, CAS i sprzątanie plików. Nowe funkcje mają security invoker, pusty search_path i odebrane domyślne EXECUTE.

Lokalne `db advisors --local --type security --level warn --fail-on error`: 0 problemów. Skan 367 śledzonych ścieżek: 0 rozpoznanych sekretów (bez wypisywania wartości). Zachowane deploymentEnabled=false i release guard. Nie używano zdalnej bazy, nie wdrażano SQL/Storage/Edge. Kontrole lokalne nie zastępują oddzielnej weryfikacji stanu i backupu przed ewentualnym zdalnym wdrożeniem.

Nie wykryto utraty funkcji ani danych w zakresie konsolidacji: chroniony runtime i stare migracje nienaruszone, replay sprawdza zachowanie aliasów, sesji, ledger i zobowiązań, właściciel potwierdził brak utraty danych. Testy SQL używają wyłącznie własnych nowych baz; istniejącej bazy ani danych telefonu nie czyszczono. Nie jest to deklaracja wykonania backupu produkcji lub pełnego porównania wszystkich jej rekordów.

### Cztery ostrzeżenia SQL — żadne nie blokuje tego merge

| Ostrzeżenie | Ocena i dowód |
|---|---|
| slm_push_claim: niejawna konwersja inicjalizatora '[]' do JSONB | Istniejące w main. Rzeczywisty test wywołuje RPC jako service_role, odbiera poprawną tablicę z zadaniem i sprawdza ponownie uprawnienia dostarczenia. PASS; brak błędu wykonania lub regresji w PR. Jawne ::jsonb można rozważyć osobno. |
| slm_email_profile_save: unused p_number | Celowe zachowanie sygnatury kompatybilnej z dotychczasowym API. Numer zapisuje odrębne działające RPC; edycja kontaktu/nazwy ma go nie zerować. Testy B2.2 i ręczny odbiór potwierdzają zapis. Nie zmieniać sygnatury przy okazji. |
| group_finance_dispatch_core: unused v_before | Pozostałość deklaracji, bez wpływu na wykonanie lub decyzje uprawnień. Funkcja pochodzi z main; regresja scoped finance/FIFO PASS. |
| group_finance_dispatch_core: unused v_rows | Jak wyżej: nieużywana deklaracja, bez wpływu na wynik. Nie osłabia RLS i nie usuwa danych. |

Lokalny db lint ponownie: kod 0, te same cztery ostrzeżenia; nie przedstawiamy tego jako braku ostrzeżeń. Brak uzasadnienia dla nowej migracji wyłącznie kosmetycznej w ramach przeglądu.

### Kontrole powtórzone w tym przeglądzie

TypeScript PASS; lint PASS; Vitest **229/229, 39 plików** PASS; guard źródeł main/Premium PASS; diff --check PASS. Pełny replay32 z kontrolą historycznych danych **9/9 PASS**. PostgreSQL/RLS/scoped finance/równoległość/FIFO/Storage B2.2 **64/64 PASS** — tym razem także rzeczywisty późny cutoff (wcześniej był pominięty), oraz realne slm_push_claim. Własne bazy testowe usunięto, oryginalna baza nienaruszona.

Nie zmieniano kodu, więc nie powtarzano buildów Androida i Cypress; ich wcześniejsze PASS dotyczą tego samego runtime f50484f, następne commity zawierają tylko dokumentację. Odbiór ręczny 7/7 pozostaje zaliczony. FCM end-to-end/iOS i zdalny rollout nadal poza zakresem; nie są potwierdzone tym przeglądem.

Dokumentacja bezpieczeństwa pomocnicza: [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control); sprawdzono też aktualny changelog Supabase. Nie aktualizowano zależności ani usług.

Następny krok: osobne potwierdzenie właściciela na merge PR #11. Oznaczenie Ready for review nie jest merge ani zgodą na wdrożenie i rozpoczęcie następnego modułu.

## Aktualizacja odbioru — 2026-10-25 17:18 Europe/Warsaw

Właściciel potwierdził następujące wyniki ręczne po instalacji Premium na POCO i sprawdzeniu LIVE. Zastępują wcześniejsze NOT TESTED dotyczące tych konkretnych scenariuszy odbioru.

- PASS — Premium: logowanie i zachowanie sesji po restarcie.
- PASS — Profil: zmiana imienia i numeru zawodnika.
- PASS — Zdjęcie: dodanie, podmiana i usunięcie.
- PASS — Karta Ultimate: wygląd, kadrowanie, motyw jasny/ciemny.
- PASS — Premium: pozostałe ekrany wyraźnie oznaczone jako demo.
- PASS — LIVE: grupy, mecze, zapis, goście i rozliczenia.
- PASS — Brak crashy, błędów uprawnień i utraty danych.

PR #11 pozostaje draftem i bez merge. Próba oznaczenia jako gotowy do review została odrzucona przez automatyczną kontrolę zatwierdzania: brak osobnej zgody na zmianę stanu oraz możliwe powiadomienie recenzentów. Nie ponawiano operacji. Brak nowych zmian runtime, zdalnego rollout i testów automatycznych; wcześniejsze ograniczenia SQL/FCM/iOS pozostają.

## Zakres i rozstrzygnięcia

- Zgodnie z decyzją właściciela domyślny LIVE main pozostaje. `src/main.tsx`, `App.tsx`, `pages/*`, `live/*`, BottomNav, SessionManager, tokenStore i release guard Androida bez zmian. Nie zastąpiono prawdziwych grup/meczów/finansów demo.
- Premium B1/B2 z `feat/slm-v1-live` / `5c3f13f` jest osobnym jawnym wariantem lokalnym `b1/`, `vite.b1.config.ts`. Rzeczywiste: Auth, sesja, własne imię i nazwisko, numer 0–99, przesłanie/podmiana/usunięcie zdjęcia, legacy alias z aktualnym hasłem. E-mail techniczny i identyfikatory kont e-mail pozostają chronione. Grupy/mecze/finanse w TYM wariancie to nadal oznaczone demo.
- Cały arkusz `variables.css` jest dokładnie z zaakceptowanego `30772de` na feat/ui-beta (checkpoint `checkpoint/2026-10-25-ui-beta`, HEAD `2d5984c`). Duży diff zawiera zaakceptowane formatowanie i przeniesienie reguł. Karta zachowuje istniejący parametr `cover` dla przesłanego portretu; reszta Premium pochodzi ze wzorca d0f9fa9. Nie odtwarzano wyglądu od zera.
- Selektywny port zamiast merge całych gałęzi. Zachowano main BottomNav z Grupami, etykietę e-mail/login/telefon i pole `email_account` API. Stare GroupsScreen i źródłowe gałęzie pozostawiono. Samodzielny kontrakt 55 plików zastępuje zależność guardu od historii innych branchy.
- Nie rozwijano B3/B4, Maps, nowych metod logowania ani zmian prywatności. Własny profil LIVE Premium i pełne ekrany LIVE main współistnieją jako dwa punkty wejścia; nie deklarujemy pełnej integracji Premium grup/wydarzeń/finansów.

## Backend i bezpieczeństwo

29 migracji main zachowanych bez zmian semantycznych/bajtowych po normalizacji CRLF/LF. `scripts/consolidation-sources.json` i verifier kontrolują ich SHA oraz źródła runtime main. Dodano trzy wcześniej zatwierdzone lokalne SQL: filtr match_summary (20261023193156), prywatne zdjęcia (20261023200138), pakiet B2.2 (20261025160000, wcześniej B22_LOCAL_ONLY.sql). Razem 32 wersjonowane kroki, bez cofania RLS i scoped finances.

Kanoniczne `supabase/functions/accounts` zachowuje operacje main i dodaje sprawdzone zdjęcia/numer. WebP maks. 150000 B / 800 px, walidacja formatu, uwierzytelnienie przed większym body, rate limit, prywatny bucket, RPC tylko service-role, owner UUID z sesji, CAS rewizji i sprzątanie plików. Klient konwertuje JPEG/PNG/WebP; historyczny JPEG nadal odczytywany.

`prepare-edge-local.py` kopiuje źródła tylko z tego checkoutu do jego ignorowanej .cache. Brak zależności od sibling worktree, SQL poza historią lub cudzej .cache. Skrypt nie wykonuje SQL/link/db push/deploy. Lokalne narzędzia dopuszczają nową gałąź, zachowują blokady hosta i konfiguracji Auth.

Pełny replay wykonano wyłącznie w własnych świeżych bazach testowych lokalnego kontenera, potem usunięto tylko te bazy. Istniejąca baza miała już zatwierdzony B2.2; nie zastosowano do niej nowych migracji w tym zadaniu. Lokalny Edge przełączono na kanoniczne źródła. Brak resetów, zdalnych migracji/Storage/Edge deploy i zmian danych telefonu. Oba Vercel config zachowują deploymentEnabled:false, brak workflow automatycznego SQL/deploy.

Kontrola wzorców w nieignorowanych plikach: brak potwierdzonych sekretów, tokenów service-role, plików .env lub osadzonych kluczy prywatnych. Jedyny marker PEM jest niezmienionym parserem FCM bez treści klucza. worker.env pozostaje ignorowany. To nie jest gwarancja wykrycia wszystkich danych osobowych/sekretów w pełnej historii Git.

## Wykonane kontrole

| Kontrola | Wynik |
|---|---|
| TypeScript, lint, diff --check | PASS |
| Vitest | 229 PASS / 39 plików |
| Replay 32 migracji, zachowanie danych historycznych | 9 PASS |
| PostgreSQL/RLS/scoped finanse/FIFO/równoległość/B2.2 | 63 PASS; późny cutoff pominięty ze względu na rzeczywisty zegar |
| Rzeczywiste HTTP B1 / B2.1 / B2.2 / scoped main | 9 / 22 / 38 / 20 PASS |
| Przeglądarka → lokalny Edge → PostgreSQL LIVE main | 1 PASS: login, grupa, mecz, zapis, gość-rezerwa, finanse, logout |
| Cypress B1/B2/B2.2 z kontrolowanym API | 6 PASS |
| Rzeczywisty kodek obrazu Chrome | 1 PASS |
| Premium smoke 320/360/390/430, oba motywy | 8 PASS, wyłącznie fikcyjne dane |
| Guard migracji/runtime/deploy i 55 plików Premium | PASS |
| Build domyślnego main / demo + izolacja / lokalny LIVE / Premium | PASS |
| Capacitor sync, assembleDebug, testDebugUnitTest | PASS dla obu wariantów, w tym natywny magazyn tokenów |
| APK: tożsamość, wszystkie zasoby zgodne z dist, localhost API | PASS dla obu wariantów |
| Release z flagą lokalnego transportu | poprawnie ODRZUCONY przez istniejący guard |
| POCO fizycznie | ADB device potwierdzone; nowej gałęzi nie instalowano, odbiór NOT TESTED |

Pierwsze realne testy przeglądarki na 5193 otrzymały prawidłowe CORS 403; ponowienie na dozwolonym 5174 PASS bez poszerzania allowlisty. Pierwszy harness SQL nie kopiował wiersza bucket w schema-only kopii; poprawiono go na replay 32 migracji tylko w WŁASNEJ nowej bazie, ponowienie PASS. Test eventAccess wykorzystuje istniejący w live kontrolowany zegar, bez zmian logiki biznesowej.

`supabase db lint --local --schema public,slm_private --level warning --fail-on error`: kod 0 z czterema istniejącymi ostrzeżeniami: cast text→jsonb w slm_push_claim, unused p_number w slm_email_profile_save, unused v_before/v_rows w finansach. Nie naprawiano ich przy okazji. Pozostają ostrzeżenia bundlera o dużym chunku, Gradle flatDir i starszym Browserslist. Nie aktualizowano zależności.

Zrzuty: [Profil 390 Dark](ui/v1-consolidation/profile-390-dark.png), [Light](ui/v1-consolidation/profile-390-light.png), [320](ui/v1-consolidation/profile-320-dark.png), [Mecze](ui/v1-consolidation/home-390-dark.png), [Login](ui/v1-consolidation/login-390-light.png). To smoke i kontrola źródeł, nie dowód pełnej zgodności pikselowej ani ręczny odbiór telefonu.

## Odtworzenie lokalne

Z `app` na feat/v1-consolidation, przy działającym dotychczasowym Supabase/Auth. Lockfile niezmieniony; podczas pracy użyto istniejących zależności przez lokalne junction.

```powershell
npm run verify:consolidation
python scripts/prepare-edge-local.py
npx --yes --package=supabase@2.121.0 supabase functions serve --workdir ../.cache/http-edge --env-file ../.cache/http-edge/worker.env
```

W innym terminalu jedno wybrane UI na dozwolonym porcie:

```powershell
# Pełny LIVE main z lokalnym backendem
npx vite --config vite.live-local.config.ts --host 127.0.0.1 --port 5174 --strictPort
# ALBO jawny Premium B1/B2, poza własnym profilem demo
npx vite --config vite.b1.config.ts --host 127.0.0.1 --port 5173 --strictPort
```

Kontrola migracji bez aktualizacji istniejącej bazy:

```powershell
python scripts/test-migrations-local.py
python scripts/test-v2-local.py
```

Na czystym środowisku testy odtwarzają 32 kroki w odrębnej bazie. NIE aktualizują istniejącego środowiska. Zastosowanie brakujących migracji i odpowiadającego accounts do istniejącej/zdalnej bazy wymaga osobnej decyzji. Nie używać db reset ani przypadkowego db push; env/klucze pozostają poza Git.

## APK i odbiór POCO

Z app:

```powershell
.\scripts\build-consolidation-android.ps1 -Variant live
.\scripts\build-consolidation-android.ps1 -Variant premium
```

Artefakty poza Git, względem worktree: `.cache/consolidation/live-debug.apk` i `premium-debug.apk`. Zbudowane z integracyjnych źródeł roboczych, nie z samej bazy main. SHA256 aktualnych artefaktów:

- LIVE: ed2b58903b900baedec2e7657d25af20bc03a022bb9112147ae8d906dc2b8714
- Premium: 60e89dbd56bf675368050a7360adefc12daffd6bc762c515f4c4ebf2eacb6da5

Ten sam pakiet pl.psuda87.slm i lokalny podpis debug: instalujemy warianty kolejno jako aktualizację, nie obok siebie. Nie zastąpiono samodzielnie aplikacji na telefonie starszym UI main. Po wyborze wariantu, z katalogu worktree:

```powershell
adb -s c7a559b5 reverse tcp:54321 tcp:54321
adb -s c7a559b5 install -r .cache/consolidation/live-debug.apk
# ALBO zamiast powyższej instalacji:
# adb -s c7a559b5 install -r .cache/consolidation/premium-debug.apk
adb -s c7a559b5 shell monkey -p pl.psuda87.slm -c android.intent.category.LAUNCHER 1
```

Bez uninstall/clear. Przy błędzie podpisu zatrzymać się, nie usuwać danych jako obejścia.

Ręcznie w LIVE: prawdziwe grupy, wydarzenie, zapis/goście/rezerwa, rozliczenia. W Premium: imię/numer zapis i anulowanie, zdjęcie/podmiana/usunięcie, legacy alias z obecnym hasłem, restart, oba Wstecz, zaakceptowana karta i jawne demo pozostałych ekranów. Hasła i prywatne zdjęcia poza raportem.

## Pozostało

Premium grupy/wydarzenia/finanse do późniejszej integracji z LIVE, zgodnie z decyzją właściciela. Rzeczywisty push FCM i iOS NOT TESTED; zachowano źródła main, bez nowych sekretów. Późny cutoff i odbiór POCO wymagają oddzielnej kontroli. Zdalne migracje/Storage/Edge nie wdrożone, wymagają osobnej zgody oraz kontroli stanu i backupu. Znane ostrzeżenia SQL pozostają jawne.

Zasada moduł → testy → akceptacja → PR → osobno zatwierdzony merge main przed kolejnym modułem zapisana w AGENTS.md. Ten PR pozostaje bez scalania. Następny krok: odbiór telefonu i review, bez rozpoczynania kolejnego modułu.

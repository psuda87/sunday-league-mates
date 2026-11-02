# SLM — poprawki Androida i formularzy, bezpieczny punkt kontrolny

## Aktualizacja 31.10.2026 — odblokowanie guardów PR #31

**PASS wszystkich obowiązujących guardów w kanonicznym środowisku. PR #31 gotowy do dalszej integracji z RC po decyzji właściciela, nadal Draft, bez merge.** To ocena poprawek Android/formularzy, nie ukończenie modułu goli/ocen. Historyczne BLOCK i wyniki poniżej opisują stan przed tą aktualizacją.

Przy rozpoczęciu aktualny lokalny/zdalny HEAD i API PR wskazywały `5a8669156b87c1d7c4e7da03fcc30349852d21d8`, nie starszy616a8c6. Baza PR bez zmian: RC1575bef. Worktree czysty; sześć niezacommitowanych zmian właściciela w głównym ui-beta zachowano. Przeczytano aktualne AGENTS i procedurę Stage2C. Polecenie właściciela autoryzuje niniejszy osobny review kontraktów, bez zmiany zasad wdrażania.

### Wynik audytu rzeczywistych źródeł

- `PremiumEvents.tsx`: różnica dotyczy wyłącznie importu/wydzielenia formularza i przeniesienia jego stanu. Warunki full-access, własnego registered entry, otwartych zapisów, blokady finansowej i wolnego miejsca zachowane. Kontrakt `guest_name/guest_phone/list` oraz istniejący `data.act('guest', body)` pozostają. Właściciel, odpowiedzialny finansowo i request_id nadal pochodzą z dotychczasowego kontrolera/serwera.
- `GuestForm.tsx`: wspólny, istniejący normalizer bez SDK/sieci/sekretów, polski numer i ograniczenie długości przed wywołaniem API. Blokada duplikacji przez ref, zachowany szkic po błędzie, brak fałszywego sukcesu. Historyczne zagraniczne kontakty nie są edytowane przez nowy formularz. Błąd nie publikuje szczegółów serwera. Key meczu i zachowane panele MatchTabs oddzielają szkice bez utraty przy zmianie zakładki.
- `premiumEvents.css`: osiem dodanych linii ograniczonych do kontrolek selektora i `.slm-guest-form`. Zamrożone55 źródeł, manifest, boisko, karty, nawigacja, motywy, logo bez zmian. Zmiany wyglądu są dokładnie wcześniej zamówionymi korektami kontrolek, nie rozszerzeniem wyjątków UI.
- `MainActivity`/`SlmWindowInsets`: jeden natywny listener zastępuje listener decor Capacitor, odczytuje rzeczywiste system bars/cutout/IME i przekazuje obsłużone insets jako zero. Brak sumowania kolejnych paddingów; dolny odstęp max(nav,IME). Brak mostu do Auth lub dodatkowej ścieżki API. Oryginalne2 testy instrumentacyjne sprawdzają syntetyczne przejścia oraz rzeczywiste położenie WebView po page commit. To nie pełny odbiór wszystkich klawiatur/Android12; regresję trzeba powtórzyć przy zmianie Capacitor.
- Testy Cypress używają rzeczywistych komponentów/CSS z jawnym fikcyjnym kontrolerem bez API. Nowe HTML/TSX to dokładnie przypięte fixture dev/test, nie nowe produkcyjne wejście. Żaden Vite config, entrypoint, CSP, logging, Keystore, workflow, Auth/RLS/finance/lineup/discovery controller lub handler nie zmienił się w tej aktualizacji. Nie znaleziono rzeczywistego naruszenia blokującego zatwierdzenie tego zakresu.

### Co blokowało i co zmieniono

1. Policy porównywał PremiumEvents do ae2fd95, CSS do a82397b; nowy GuestForm i native nie miały osobnego przypięcia. To oczekiwany drift po zmianie, nie powód wyłączenia kontroli. W `704e4a8f2c787c8644e8a8999f99e06bb7b91a7b` dodano dokładny `POLISH_UI=3f181e906dcad95ba570e62d71fb9e666e9836e0` dla **trzech** źródeł (PremiumEvents, premiumEvents.css, GuestForm) i `POLISH_ANDROID=f2edf565abd2f3f67a0cc3a28d6c01c5e93806f8` dla **trzech** plików (MainActivity, SlmWindowInsets, test). Dodano wiązanie importu GuestForm i wspólnego normalizera. Discovery pin pozostaje dla usePremiumEvents/premiumContracts; wszystkie poprzednie piny zachowane.
2. `verify:consolidation` kończył się FAIL przy wywołaniu tego samego runtime policy, choć historia42 i frozen55 już przechodziły. Nie wymagał zmiany własnego skryptu ani `consolidation-sources.json`; po precyzyjnym zatwierdzeniu policy przechodzi całość. Nie zmieniono ani jednego hasha manifestu55.
3. Source CI porównywał całe app do d7b36ee; blokował native, nowe pliki i zmienione runtime. W `7c45656ab89105ba53a53e7c1f2fd7049b762666` dodano **dokładny overlay12** z704e4a8: 10 plików aplikacji/testów PR31 i 2 pliki policy/testów. Pełna lista i SHA256 w [pr31-guard-evidence.json](review/pr31-guard-evidence.json). Najpierw wciąż weryfikowany jest oryginalny Stage3B, następnie dawny overlay discovery18 i niezmieniona implementacja Stage2C/d7b36ee; dopiero na końcu PR31. Wszystkie pliki poza12 muszą pozostać identyczne; nowe/missing/ignored/symlink wejścia nadal odrzucane. Gate i jego SourceTests pozostają przypinane osobną implementacją jak wcześniej, bez dopuszczenia arbitralnej zmiany runtime/policy przez sam repin.
4. Osobny commit wskaźnika **`6e9ce9d09a7f590ff17f6e7241848cdeccca327e`** ustawia `lineups-ci-approval.json` implementation na7c45656. Base45d9a4 niezmieniony. To końcowy commit aktywacji kontraktów; późniejsze commity tej aktualizacji zawierają wyłącznie raport/dowody. Nie squashować ani rebase’ować tej historii. Pełny końcowy SHA publikacji dokumentacji podano w odpowiedzi i aktualnym HEAD PR31.

Wszystkie funkcje walidacji kontekstu GitHub, repo, SHA/event/parents, opt-in bezpłatnego limitu, hosted Linux/X64, local/empty Docker, zasobów, ścieżek, label cleanup i CLI są zgodne AST z5a86691. Zmieniono wyłącznie verify_sources i dodano jeden helper dokładnego overlay. Workflow/triggery/sekrety/ustawienia Actions bez zmian. Nie fałszowano zmiennych GitHub.

### Faktyczne wyniki tej aktualizacji

| Kontrola | Wynik |
|---|---|
| Premium policy | **PASS53/53**: wszystkie istniejące45 plus8 nowych negatywnych, żadnego usunięcia asercji |
| verify:consolidation | **PASS42 migracje /55 frozen /11 import boundaries** |
| SourceTests i launch-contract Linux | **PASS29/29**, stare26 i3 nowe przypadki: repin nowych źródeł, rozszerzenie/pominięcie overlay, ancestry PR31 i Stage2C |
| Rzeczywisty source guard | **PASS** w zwykłym klonie Git wewnątrz offline Linux oraz osobnym kanonicznym klonie Windows |
| Negatywne Premium/consolidation | **PASS60**, mutacje w prywatnej kopii: każda z41 historycznych migracji,42, dodatkowa43, handler/Auth/finance/lineups/UI |
| Negatywne rzeczywistego CI source | **PASS69 odmów**, wszystkie42 migracje, extra43, wszystkie12 źródeł overlay, CI/testy, Auth/vault, finanse, składy, discovery, UI, manifesty i workflow. Baseline PASS przed/po; końcowy klon czysty |
| TypeScript / ESLint / strict Edge | **PASS**, wykonane ponownie |
| Vitest | **PASS372/372,56 plików**, wykonane ponownie |
| Build aplikacji | **PASS**, wykonany ponownie |
| Chromium | **PASS6/6**, ponownie Chrome156,320/360/390,Light/Dark,zmniejszony viewport; test UI bez backendu |
| Android instrumentation/Gradle | **NOT RUN ponownie**: implementacja Androida i testy identyczne z poprzednim zakresem zPASS2/build; tych wcześniejszych wyników nie liczymy jako nowych |
| SQL/RLS/HTTP/Cloud/POCO | **NOT RUN**: brak zmian SQL/Edge/API; nie dotykano baz, Cloud ani urządzenia |
| GitHub-hosted | **NOT RUN**, aktualny stan sprawdzany przy publikacji; brak dispatch lub zmiany opt-in |

W mieszanym roboczym checkout Windows pierwszy bezpośredni byte-check zgłosił LF/CRLF. Nie dodano normalizacji do guardów i nie zmieniano globalnego Git config. Osobny nowy klon z lokalnym `core.autocrlf=false` ma PASS tej samej implementacji; zwykły klon Linux ma PASS wraz z realnymi symlink/ancestry tests. Nie maskowano różnicy przez zmienianie asercji. Pierwotne45 FAIL wynikało dodatkowo z konstrukcji testów: każdy negatywny wymaga najpierw PASS baseline; po zatwierdzeniu dokładnych źródeł wszystkie45 przechodzą.

Izolacja Linux: istniejący lokalny tools image522be6c, network none, read-only root/evidence, tmpfs klon, cap-drop ALL/no-new-privileges, bez socketu Dockera, bazy i sekretów. [Odtwarzalny checker](review/pr31-linux-source-check.py). Inne worktree/bazy i sześć zastanych usług zachowano.

**Pozostałe ograniczenia produktu nie są blokadą tych guardów:** backend lokalny nadal41 (pełne discovery wymaga42), statystyki/gole/oceny/edycja grup/telefon Premium pozostają TODO. PR31 zawiera ukończone poprawki i ich kontrakty; nie implementuje tych modułów. Ostateczne merge nadal wymaga decyzji właściciela.

---

31.10.2026, Europe/Warsaw. **WARN: ukończony zakres Android/formularze. BLOCK: integracja przy obecnych przypięciach. Zadanie grup/statystyk nie jest ukończone.**

Gałąź `feat/slm-v1-polish-stats`, osobny worktree `.worktrees/slm-v1-polish-stats`, baza: aktualny lokalny i zdalny RC `1575bef77f0b24a8c74373018895b7b872ebc06a`. Historia RC zachowana; bez squash/rebase/merge. Zastane sześć zmian właściciela na `feat/ui-beta` oraz inne worktree pozostawiono. Porównano źródła RC, ui-beta, profil/privacy i visual-parity; nie znaleziono gotowego produkcyjnego modułu goli/ocen do bezpiecznego przeniesienia. Nie importowano Auth #18.

## Wykonane

- `f2edf56`: natywna obsługa system bars, display cutout i IME w `SlmWindowInsets`; `MainActivity` instaluje jeden listener po inicjalizacji Capacitor. Rzeczywiste piksele z AndroidX, bez stałego paddingu zależnego od telefonu. Dolny odstęp to maksimum paska i IME. Przekazanie zerowych obsłużonych insetów do WebView zapobiega podwójnemu odstępowi z CSS/Ionic. Listener zastępuje listener SystemBars na decor; styl/widoczność pasków pozostają obsługiwane przez Capacitor. Wymaga ponownego sprawdzenia przy aktualizacji Capacitor.
- `3f181e9`: wydzielony rzeczywisty formularz `GuestForm`, walidacja przed API, limit surowego zapisu 32 znaki oraz dokładnie dziewięć cyfr po normalizacji istniejącym wspólnym kodem. Obsługuje +48/0048 i dotychczasowe separatory, pusty numer opcjonalny, klawiaturę tel. Nowe zagraniczne numery odrzuca zgodnie z aktualnym handlerem. Nie zmienia ani nie przepisuje istniejących kontaktów E.164.
- Formularz zachowuje szkic po odrzuconej lub niepotwierdzonej operacji, czyści dopiero po `true` z istniejącego kontrolera, blokuje podwójny submit i pozostawia dotychczasową odpowiedzialność finansową. Brak nowego endpointu, automatycznego retry lub zmiany request_id. Key meczu oddziela szkice różnych wydarzeń; MatchTabs zachowuje zamontowane panele.
- Scoped CSS: oddzielone etykiety/pola formularza, kontrolki co najmniej 44px, brak rozszerzania poza ekran. Selektor „Aktywna grupa” ma czytelny kolor tekstu, rozmiar i miejsce na strzałkę, również „Moje mecze”. Logika zakresów/discovery/paginacji niezmieniona.

Źródła mechanizmu natywnego: [Android edge-to-edge](https://developer.android.com/develop/ui/views/layout/edge-to-edge), [Capacitor SystemBars](https://capacitorjs.com/docs/apis/system-bars) oraz lokalny kod przypiętego Capacitor 8.5.3. To natywna rezerwacja bezpiecznego viewportu, nie przebudowa Premium.

## Faktyczne testy lokalne Windows

| Kontrola | Wynik |
|---|---|
| TypeScript i build aplikacji | PASS `npm run build` |
| Build Premium Android Stage3 | PASS `npm run build:android-stage3` |
| Demo build/izolacja | PASS `npm run build:demo`, 16 plików izolowanego demo |
| Strict Edge | PASS `npm run typecheck:edge`; źródła Edge niezmienione |
| ESLint | PASS po poprawieniu regex bez wyłączania reguły |
| Pełny Vitest | PASS 372/372, 56 plików; po równoważnej korekcie regex celowane 11/11 |
| Formularz + discovery celowane | PASS 20/20: normalizacja, złe numery, reserve, disabled, duplicate, błąd/szkic/retry oraz istniejące testy discovery |
| Chromium/Cypress | PASS 6/6, Chrome 156: rzeczywiste komponenty i CSS, 320/360/390px, Light/Dark, wysokość 844/380; fikcyjny kontroler, **bez API/backendu** |
| Capacitor sync | PASS; wyłącznie wygenerowane przez tę sesję ścieżki dwóch plików Gradle przywrócono do HEAD, aby nie commitować ścieżek junction |
| Gradle | PASS `assembleDebug` i `assembleDebugAndroidTest --offline` |
| Android instrumentation | PASS 2/2 przez rzeczywisty AndroidJUnitRunner na emulator-5554, AVD Medium_Phone_API_36.1; potwierdzono `ro.kernel.qemu=1` przed instalacją |
| Native scenariusze | PASS sztucznie dostarczone insets: portrait, cutout/landscape, IME, dismissal, brak kumulacji; oddzielnie rzeczywiste położenie WebView poniżej status bara po page commit |
| Frozen Premium 55 | PASS porównanie wszystkich 55 plików z manifestem, manifest bez zmian |
| Historyczne źródła/42 migracje | PASS część `verify-consolidation.mjs`; brak zmian SQL/Edge/Auth/finansów/składów |
| Premium policy | **FAIL 45/45**: zmienione dokładnie przypięte runtime. Testów negatywnych nie uznajemy za zaliczone przy nieprzechodzącym baseline |
| `verify:consolidation` całość | **FAIL** w końcowym `verifyPremiumRuntime`, mimo zaliczonej historii i 55 plików |
| Rzeczywisty CI source guard lokalnie | **FAIL** na `MainActivity.java`; kontrakt przypina całe drzewo app, również natywne pliki i listę wejść |
| GitHub-hosted | NOT RUN; lokalne PASS nie oznacza hosted PASS |
| SQL/RLS/GoTrue/Edge HTTP/równoczesne zapisy backendu | NOT RUN; Docker podczas kontroli nie odpowiadał, nie uruchamiano go ani nowej bazy |
| Pełny LIVE / Android 12 / realna klawiatura ekranowa | NOT RUN; testy insets IME i zmniejszony viewport nie zastępują całego przebiegu z rzeczywistą klawiaturą |
| Fizyczny POCO | NOT RUN; żadnych operacji |

Początkowy `connectedDebugAndroidTest --offline` był zablokowany brakiem cache pluginów UTP 31.13.0. Bez instalowania nowych narzędzi zainstalowano wygenerowane APK aplikacji i testów **wyłącznie na emulatorze** i uruchomiono testy przez ADB. Początkowe uruchomienie Cypress blokowała odziedziczona `ELECTRON_RUN_AS_NODE=1`, potem domyślny specPattern. Usunięto zmienną tylko dla procesu i wskazano jawny specPattern, zachowując konfigurację repo i wszystkie asercje.

## Android i odtworzenie testów

APK lokalny: `app/android/app/build/outputs/apk/debug/app-debug.apk`, applicationId `pl.psuda87.slm`, versionName 1.0 / versionCode 1. SHA256: **b0ad205c53b32ad40f7f0301004077962cca5b0de1ff0f126a1e7e089b6fd748**. API nadal `http://127.0.0.1:64321/functions/v1/accounts`. Logowanie mostu wyłączone, WebView debug wyłączony. Przy kontroli ADB brak map reverse; nie ustawiano połączenia z istniejącą bazą. To zweryfikowany build debug i test natywny, **nie działający kompletny backend LIVE**.

Po buildzie Stage3 i sync (`SLM_ANDROID_STAGE3=1`, `SLM_LOCAL_ANDROID=1`) można ponowić:

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\slm-v1-polish-stats'
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
.\app\android\gradlew.bat -p app/android :app:assembleDebug :app:assembleDebugAndroidTest --offline
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$testEmulator = 'emulator-5554' # sprawdzić adb devices; wyłącznie emulator
if ((& $adb -s $testEmulator shell getprop ro.kernel.qemu).Trim() -ne '1') { throw 'Not emulator' }
& $adb -s $testEmulator install -r app/android/app/build/outputs/apk/debug/app-debug.apk
& $adb -s $testEmulator install -r app/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
& $adb -s $testEmulator shell am instrument -w -e class pl.psuda87.slm.SlmWindowInsetsTest pl.psuda87.slm.test/androidx.test.runner.AndroidJUnitRunner
```

Przed odbiorem ręcznym: backend w NOWEJ fixture, login → Mecze/„Moje mecze” → gość/pusty i zły telefon → pokaż/ukryj klawiaturę → obrót/nawigacja gestami/przyciski → publiczne wyszukiwanie → wylogowanie/zmiana konta. Sprawdzić Android 12 i aktualny Android, przy różnych skalach tekstu. Nie uruchamiać migracji istniejącej bazy ani Cloud.

## Premium i przypięcia — blokada przed integracją

Dokładny diff dwóch zmienionych chronionych plików runtime: [polish-runtime-proposed.diff](review/polish-runtime-proposed.diff). `PremiumEvents.tsx` tylko importuje GuestForm, usuwa przeniesiony stan i zastępuje inline formularz; `premiumEvents.css` dodaje osiem linii zmian dotyczących wskazanych kontrolek. **Nie zaktualizowano żadnych hashy, manifestów, pinów ani guardów.** Backend 24a59e1, discovery ae2fd95, CI d7b36ee/cb63962 i ich ancestry pozostają.

Obecny ae2fd95 nie zatwierdza nowego formularza/CSS, a source kontrakt CI nie zatwierdza również natywnej zmiany ani nowych plików testowych. Przed integracją potrzebny osobny review i minimalna aktualizacja dokładnych źródeł w dwóch etapach implementacja → wskaźnik oraz powtórzenie testów negatywnych dla migracji43, wcześniejszych41, handlera, Auth, finansów, składów i 55 plików UI. Żadnych wildcardów, pomijania plików lub wyłączania gate. Ten Draft nie jest gotowy do scalenia.

Zrzuty [Light](ui/polish-stats/guest-form-light.png), [Dark](ui/polish-stats/guest-form-dark.png) oraz całego testowego widoku w tym samym katalogu przedstawiają wyłącznie fikcyjny test UI. Bez zmian boiska, kart, nawigacji, palet i 55 zamrożonych źródeł.

## Niewykonane / TODO następnego spójnego zakresu

1. **Telefon i prywatność profilu.** Numer jest odczytywany w `demo/Profile.tsx:50`, a zmiana aliasów z obecnym hasłem działa w istniejącym Accounts/handler `identifiers` (`handler.ts:494`). Premium nie udostępnia tej edycji. Nie dodano pola, które pozornie zapisuje numer. Trzeba zachować weryfikację hasła/rotację sesji/readback, kompatybilność niezmienionego historycznego E.164, osobny model email_account i czyszczenie przy logout. Przeniesienie zgód do profilu ma zachować osobne wartości dla każdej grupy, nie zamienić ich na jedną globalną zgodę; aktualne group_scope pochodzi z `handler.ts:126`.
2. **Edycja grupy i minimum.** Obecny schemat ma nazwę/opis, lecz brak modelu minimum. `20261019171024_slm_v2_rpc.sql:37` zwraca stałe 10, `20261019170806_slm_v2_events_finance.sql:7` wymaga capacity >=10; to dwie różne reguły. Nowa migracja i handler muszą rozdzielić domyślne minimum grupy (10, np. 8 dozwolone) od pojemności, zapisać snapshot minimum w NOWYM wydarzeniu z opcjonalnym override i zachować historyczne wartości. Admin-only, wersja/CAS, idempotencja i audyt. Nie zmieniono starego SQL ani wydarzeń.
3. **Gole/oceny/asysty.** Brak implementacji, migracji i aktywnego UI. Wymagany osobny bezpieczny kontrakt uczestnictwa (także gość jako entry bez konta), wersjonowanie/idempotencja/audyt, player self-only, admin dowolny uczestnik, pending/approved/rejected i tylko zatwierdzone gole w sumach. Asysty tylko w schemacie; bez wymyślonych zwycięstw lub obowiązkowego A–B.
4. **Prywatność ocen.** 1–10, unikalne (mecz, oceniający, oceniany), zakaz self, wyłącznie rzeczywiści uczestnicy po zakończeniu. Prywatna tabela bez client SELECT i bez autorów w API/błędach. Proponowane zabezpieczenie przed różnicowaniem agregatów: publikacja zamkniętej zbiorczej partii dopiero po końcu okna i minimum pięciu ocenach, bez liczników pojedynczych nowych głosów. To projekt do testów, nie wdrożona gwarancja anonimowości. Początkowe 7 i ranga po pięciu zgodnie z poleceniem; nie wdrożono historycznej niezatwierdzonej formuły stabilizacji.
5. **Decyzja z tego polecenia:** tymczasowe, konfigurowalne okno 48h od faktycznego końca meczu dla zgłoszeń goli/ocen, admin może zamknąć wcześniej; później zwykły gracz bez zmian, korekty admina audytowane. Zapisać konfigurację/snapshot na mecz, egzekwować czas serwera. Decyzja jest udokumentowana, **nie zaimplementowana**.

Przed tym backendem uruchomić świeżą izolowaną fixture, odtworzyć 42 historyczne migracje, a dopiero potem dodawać/testować kolejny etap. Potrzebne testy SQL/RLS/HTTP dla IDOR, obcej prywatnej grupy, nieaktywnego członka, rzeczywistego udziału/nieobecności, wyścigów, replay/konflikt request_id, zamknięcia okna i wycieku pojedynczych ocen. Nie zostawiono częściowej migracji ani niepodłączonego backendu.

Cloud i istniejące lokalne bazy nietknięte. Brak deployu, merge do main, płatnych usług i operacji na POCO. Odpowiedzi chronologiczne: `docs/ODPOWIEDZI_CODEX.txt`.

## Publikacja

Aktualizacja 31.10.2026 09:09: właściciel zgłosił brak połączenia APK. Docker był wyłączony, a ADB reverse nieobecny. Uruchomiono Docker Desktop i istniejące sześć usług przez zweryfikowany helper `backend:start` z worktree local-live-backend, bez prepare/resetu/migracji/Cloud. Helper potwierdził41 migracji. `android:connect -- --serial emulator-5554` sprawdził rzeczywisty zainstalowany APK i przywrócił64321→55321; HTTP przez emulator Auth200/accounts401. Cold start MainActivity PASS i wizualnie potwierdzony odczyt listy meczów z odtworzoną sesją. To późniejszy PASS podstawowego LIVE odczytu; nie zastępuje niewykonanych testów całego modułu ani backendu42. Zrzut z zastanymi danymi wyłącznie w ignorowanym cache, bez publikacji. Żadnego nowego APK ani operacji na POCO.

Wypchnięto gałąź i utworzono [Draft PR #31](https://github.com/psuda87/sunday-league-mates/pull/31) do RC. GitHub potwierdził bazę `1575bef77f0b24a8c74373018895b7b872ebc06a`, HEAD raportu `f27668c166c07c924f9eea43b645e4772f158eef`, draft=true, merged=false i mergeable=true. Mergeable oznacza tylko możliwość połączenia historii, **nie zaliczenie guardów ani zgodę na integrację**. API Actions dla tego SHA zwróciło zero przebiegów: hosted NOT RUN. Kolejny commit dopisuje wyłącznie to potwierdzenie publikacji.

# SLM — poprawki Androida i formularzy, bezpieczny punkt kontrolny

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

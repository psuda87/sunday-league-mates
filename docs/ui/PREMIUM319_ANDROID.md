# Premium 3.19 — lokalny Android

Data: 23.10.2026, Europe/Warsaw. Branch `feat/premium319-android`, worktree `.worktrees/premium318-live`. Źródło: baza `ac4954c41b876ae47055174176116a4877c952a5` plus lokalne zmiany Premium 3.19. Sam HEAD nie identyfikuje nowego APK. Zmiany pozostają lokalne, bez commit/push/merge; wcześniejsze zmiany root `feat/ui-beta` zachowane.

## Naprawione problemy i przyczyny

- Wstecz: aplikacja przełączała ekrany stanem React bez historii. Dodano kolejkę Ionic: modal > klawiatura > podstrona > historia zakładek. Listener Capacitor aktywuje natywne zdarzenie dokumentu bez jego dublowania. Zamknięcie formularza edycji zachowuje szczegóły meczu, ustawienia zamykają się przed opuszczeniem profilu. Na końcowe polecenie użytkownika Wstecz z głównego ekranu Mecze minimalizuje aplikację przez `App.minimizeApp()`.
- Formularze: szeroki selektor native input ingerował w wewnętrzne pola Ionic. Wykluczono je; etykiety mają odstęp 10 px, formularze 16 px, poprawiono przycisk podglądu hasła.
- Grupy: zwarte sekcje, zawijanie długich nazw, przyciski zaproszeń minimum 44 px i responsywne akcje administratora grupy.
- Mecze o ograniczonym dostępie: wspólna stadionowa karta zastępuje surowe sekcje, prezentując tylko dozwolone pola bez obcych liczników i fikcyjnych zer.
- Stopka: usunięto nadmiarowe odstępy, zachowano safe-area/warunkowy plus; klawiatura ukrywa stopkę, Android używa adjustResize.
- Zdjęcia: wcześniejsza funkcja była niedokończona. Dodano systemowy wybór pliku, walidację, podgląd/Anuluj, prywatny zapis, usuwanie i odczyt własnego zdjęcia. Input pozostaje zamontowany podczas wznowienia/weryfikacji sesji. Wynik galerii nie przechodzi między kontami. Obrazy nie są zapisywane w localStorage.

## Zatwierdzony lokalny backend zdjęć

Wyłącznie lokalny Docker: migracja `20261023200138_profile_photos_private.sql` (31. migracja), prywatny bucket `slm-profile-photos`, metadane właściciela z RLS i bez bezpośrednich grantów klienta, commit z kontrolą sesji i rewizji. Accounts udostępnia get/upload/delete własnego zdjęcia; właściciel pochodzi tylko z kontekstu serwerowego. Ograniczono body i liczbę żądań. Usuwanie poprzedniego pliku ma trwały znacznik ponowienia. Brak publicznych URL i bezpośredniego dostępu klientów do cudzych zdjęć.

Wejście klienta: JPEG/PNG/WebP do 2 MiB i 4096 px; normalizacja do JPEG maks. 1024 px na dłuższym boku, bez metadanych. API sprawdza JPEG, bajty i wymiary. HEIC/SVG mają komunikat odmowy. Nie zmieniano historycznych migracji, reguł finansowych, uprawnień ani SessionManager/tokenStore. Zdalny Supabase, migracje/Edge produkcyjne i Firebase bez zmian.

## PASS — automatyczne

- TypeScript, ESLint; Vitest **205/205**, 38 plików. Priorytety Wstecz, historia, minimalizowanie Androida, powrót z galerii po weryfikacji sesji i odrzucenie wyniku po wylogowaniu.
- Cypress **35/35**, następnie rozszerzone Premium319 **19/19**. Macierz 320/360/390/430 px × Light/Dark × pion/poziom obejmuje logowanie, listę/panele meczu, formularz organizatora, grupy/zaproszenia, profil/ustawienia i własne rozliczenia. Kontrola overflow, długich tekstów, odstępów i hit-area. Mock API tylko w testach; runtime korzysta z prawdziwego API.
- Real browser → lokalny Edge → Postgres **1/1**.
- SQL/RLS **58/58** w osobnej tymczasowej bazie; istniejące dane zachowane.
- Rzeczywiste HTTP **20/20**; zdjęcia **13/13**: zapis/odczyt/usunięcie, ponowne logowanie, konflikt wersji, odmowa podmienionego ownera, cudzych metadanych, bezpośredniego Storage i publicznego URL; brak osieroconych plików w sprawdzonych scenariuszach.
- Web build, Capacitor sync, assembleDebug/testDebugUnitTest, appId/podpis/43 zasoby APK i release guard PASS. JUnit 1/1, aktualny wynik Gradle UP-TO-DATE.
- ADB `install -r` Success, uruchomienie MainActivity, reverse 54321. Pakiet `pl.psuda87.slm`, Android versionName 1.0/code1. Końcowy APK: **8391046 bajtów**, SHA256 `cee903e385906d7fa13007005bfa71a56bf9aaa269d0b970b4db68ca67ca8950`, zgodna suma na telefonie.
- Pierwsza instalacja pozostała 23.10.2026 21:38:01 po aktualizacji Premium319. Bez uninstall/clear-data/resetu bazy; istniejące dane testowe zachowane.
- Proces działa; sprawdzone logi PID: 0 markerów FATAL EXCEPTION/Uncaught/net::ERR_/błędów ładowania WebView. Ostrzeżenia Firebase bez konfiguracji przy wyłączonym FCM, MIUI/Google flags i wielkości chunka nie blokowały testów.

## PASS — fizyczny telefon, potwierdzenie użytkownika

1. Zdjęcie profilowe działa.
2. Systemowe Wstecz działa na podstronach; pozostałe sprawdzone przez użytkownika elementy działają poprawnie.
3. Użytkownik zgłosił brak minimalizowania z ekranu głównego. Dodano poprawkę, ponownie zbudowano i zainstalowano APK.
4. Na końcowym APK użytkownik potwierdził: **minimalizuje i zachowuje logowanie po powrocie**.

## FAIL / ograniczenia narzędzi

Brak otwartego potwierdzonego błędu funkcjonalnego w sprawdzonym zakresie. Początkowy test wysyłał kolejne Wstecz zanim Ionic zakończył asynchroniczną obsługę poprzedniego; odstęp 50 ms między osobnymi symulowanymi naciśnięciami pozwolił zweryfikować rzeczywistą historię. Testy przeszły.

MIUI odrzuciło automatyczne KEYCODE_BACK przez INJECT_EVENTS; nie obchodzono zabezpieczenia. Odbiór wykonano ręcznie. Uiautomator nie zwrócił XML; usunięto wyłącznie własny plik tymczasowy. Zrzuty formularza w headless Cypress były przycinane przy przewijanym IonContent, więc usunięto wadliwe artefakty. Formularze sprawdzono asercjami DOM/geometrii. Zachowano i obejrzano zrzuty list Mecze/Grupy Light/Dark w `docs/ui/premium319-browser/premium319.cy.ts/`. Nie publikowano ich, ponieważ push jest zabroniony.

## NOT TESTED / dalsze testy ręczne

- Zdjęcie po reboocie telefonu, wszystkie źródła galerii, anulowanie zewnętrznego pickera i różne nieprawidłowe pliki nie mają pełnego ręcznego odbioru. Persistencja backendu/reload/ponowne logowanie sprawdzone automatycznie.
- Kompletny fizyczny audyt każdego ekranu/kontrastu we wszystkich orientacjach i globalne zarządzanie kontami na telefonie nie są zakończone. Nie nadawano tej roli kontu użytkownika.
- Rejestracja publiczna, odzyskiwanie e-mail, statystyki/numer koszulki i generowanie składów pozostają niedostępne/planowane. Brak atrap i nowych reguł biznesowych.
- Produkcja, FCM, publikacja i działanie poza lokalnym USB/Docker nie należą do tego etapu.

Do dalszego testowania: anuluj podgląd zdjęcia, sprawdź zmianę/usunięcie, klawiaturę, Light/Dark i obrót ekranu. Pozostaw Docker i USB dla lokalnego API. Historia odpowiedzi: `docs/ODPOWIEDZI_CODEX.txt`.

Manifest ?r?de?: `.cache/premium319-source.json`; SHA256 drzewa src/functions/migrations/AndroidManifest: `b5f153901237d826a8b4b1d69b9d831aa026da4c5e0580b84f6499f9681abc84`.

# Lokalny Android LIVE — 30.10.2026

Gałąź `chore/local-live-backend`, worktree `I:\slm\sunday-league-mates\.worktrees\local-live-backend`, baza `4503cb2` z backendem Stage 2B `58a9bab`. Premium 3.18, Auth, finanse, RLS i zabezpieczenia runtime pozostają źródłowo niezmienione.

## Działające środowisko

Ponownie wykorzystano istniejący `slm-main-stabilization`: API `http://127.0.0.1:55321`, PostgreSQL 55322; sześć istniejących usług db/auth/rest/storage/kong/edge_runtime. Nie utworzono nowego stosu. Stary katalog runtime pozostaje w `.worktrees/main-stabilization/.cache/stabilization-stack`; nie usuwać tego worktree ani jego cache.

Zastane 40 migracji były zgodne z kodem. Po prywatnym pełnym backupie i próbie BEGIN/ROLLBACK zastosowano wyłącznie istniejącą `20261029140000_match_lineups.sql`; DDL i wpis historii zapisano w jednej transakcji. Obecnie dokładnie 41 migracji. Hashe wszystkich zastanych wierszy public/auth przed i po migracji zgodne. Skopiowano kanoniczne Edge Functions do istniejącego lokalnego runtime; lokalny entrypoint dopuszcza wyłącznie Kong/loopback oraz jawne originy Android/przeglądarki. Nie zmieniano haseł, kluczy ani ustawień Auth. Supabase Cloud nietknięty.

Backup bazy i konfiguracji: ignorowany `.cache/live-backend/backup-*`, ACL właściciela. Pełne prywatne konfiguracje usuniętych kontenerów: `.cache/live-backend/retirement-private-*`. Nie publikować tych katalogów.

## Uruchomienie w PowerShell

```powershell
Set-Location 'I:\slm\sunday-league-mates\.worktrees\local-live-backend\app'
npm run backend:start
npm run backend:status
powershell.exe -NoProfile -File scripts/android-studio.ps1 -Mode live -Assemble -Open
# Po uruchomieniu jednego emulatora lub podłączeniu urządzenia:
npm run android:connect -- --serial emulator-5554
```

Otwierać projekt Android Studio z tego worktree: `app\android`. Wariant `android:ui` to odrębne demo; do backendu służy `android:live`. Aplikacja LIVE używa `127.0.0.1:64321`; ADB przekierowuje ten port do hosta55321. Helper sprawdza rzeczywisty zainstalowany APK, odrzuca Cloud/demo i konfliktujące przekierowanie; sam nie instaluje ani nie uruchamia aplikacji. `--check-only` pozostawia mapowania bez zmian. Bez `--serial` wymaga dokładnie jednego autoryzowanego urządzenia/emulatora. Instalacja/Run na fizycznym telefonie pozostaje osobnym etapem.

APK: `app\android\app\build\outputs\apk\debug\app-debug.apk`, pakiet `pl.psuda87.slm`, SHA256 `8742579e298e893b7d0abdc68b4e104e8b8cc87ed60267548e5665e556859c63`. Logging none i WebView debug false zachowane.

## Faktyczne testy lokalne Windows

- PASS: 19 testów HTTP przez rzeczywisty Kong → GoTrue → accounts Edge → PostgREST → PostgreSQL: sesje, grupy, zapisy/goście/rezerwa, trwałe składy, CAS/roster/request_id/no-op, prywatność, RLS/RPC, rozliczenie i odebranie dostępu. Utworzono wyłącznie cztery nowe fikcyjne konta; stare rekordy Auth/hasła niezmienione.
- PASS: 14 istniejących asercji browser/UI na tym samym backendzie, w tym dwa różne konta, konflikt409, utrata odpowiedzi po rzeczywistym zapisie i retry z tym samym UUID. Jeden klient jest administratorem grupy, drugi członkiem. Bez tworzenia kontenerów.
- PASS: zimny restart sześciu usług, zachowany ten sam token i ten sam zapisany skład. Poprawiono oczekiwanie helpera na HTTP gotowość usług zamiast samego stanu running. Przy końcowym wznowieniu zastano wyłączony Edge255; uruchomiono go ponownie, testy HTTP i aplikacja działały. Przyczyny wcześniejszego zatrzymania nie ustalono.
- PASS: 335 Vitest /53 pliki, lint, TypeScript aplikacji i strict Edge, 37 testów Premium policy, verify41 migracji/55 visual/10 import boundaries, domyślny build oraz LIVE web/Capacitor/Gradle assembleDebug offline; `android:check`.
- PASS: istniejący emulator `Medium_Phone_API_36.1`, Android16/API36.1, WHPX; instalacja APK i start wyłącznie na emulatorze. Rzeczywiste logowanie nowym kontem, odtworzenie sesji po force-stop/start, lista meczów, prywatny mecz, roster i zapisany skład6:6. ADB forwarding potwierdza Auth200/accounts401. [Zrzut](ui/local-live-android/emulator-lineups-live.png) zawiera wyłącznie fikcyjne dane. Nie jest pełnym odbiorem wizualnym Android12.

Nowe dane testowe pozostają w lokalnej bazie. Dane do logowania tylko w prywatnym, ignorowanym `.cache/live-backend/poco-fixture/account.private.json`; odczytać lokalnie, nie wklejać do raportów. `backend:test` tworzy kolejne cztery nowe konta; nie uruchamiać go bez potrzeby. `backend:test:browser` używa ostatniego fixture i tworzy kolejny mecz.

Niewykonane: fizyczny POCO/Android12, natywny zapis/konflikt/offline na emulatorze (pokryte browser/API, nie deklarujemy natywnego PASS), pełne Cypress w tym zadaniu, ponowne pełne SQL fixtures, hostowane CI, upload Storage, push i Cloud. Storage status200 jest wyłącznie kontrolą zdrowia. Android Studio otworzyło nowy projekt; potwierdzony import Gradle dotyczy wcześniejszego workflow, a dla nowego worktree dowodem kompilacji jest Gradle CLI. Brak podłączonego telefonu nie blokuje backendu ani buildu.

## Docker

162→48 kontenerów, 140→6 działających, 114 usuniętych odtwarzalnych usług testowych SLM. Zachowano wszystkie31 kontenerów PostgreSQL, 65 wolumenów, 14 obrazów i 15 nazw sieci; 42 historyczne kontenery danych/mail/log pozostają zatrzymane. Mounty plików Storage, cache Deno, kod i snippets zachowane. Bez prune, rm -v, kasowania baz lub resetu. Jeden pozbawiony etykiet GoTrue rozpoznano przez zgodność obrazu/DB/klucza z archiwalną konfiguracją PR16; bez ujawniania sekretów. Helper domyślnie tylko planuje i chroni projekt współdzielący sieć z nieznanym aktywnym kontenerem. Domyślny Docker bridge ma przy końcowym odczycie inny ID; źródło zmiany nieustalone, w tym zadaniu nie wydawano poleceń usuwania sieci. Wszystkie ID sieci SLM zachowane. [Pełne ID i uzasadnienia](docker/local-live-cleanup-2026-10-29.json).

Następne kroki: otworzyć ten projekt w Android Studio i używać LIVE; później osobny odbiór fizycznego Android12. Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

# Aktualny stan Sunday League Mates

19.10.2026 — `chore/android-phone-readiness`, `I:\slm\sunday-league-mates-integration`.
Main po PR [#2](https://github.com/psuda87/sunday-league-mates/pull/2) i [#3](https://github.com/psuda87/sunday-league-mates/pull/3): `1fadd977d9737f371b75a59eee63ce6c50e4cb3b`. Gałąź przygotowania Androida utworzona od aktualnego origin/main; kod aplikacji pozostaje bez zmian. Bieżący etap autoryzuje commit/push i PR do main, bez merge i wdrożeń. Wyniki builda poniżej pochodzą z zakończonego lokalnego przygotowania.

## Funkcje i infrastruktura

Zintegrowane: Auth legacy/potwierdzony e-mail, bezpieczna trwała sesja, profile, grupy i role, publiczne/prywatne mecze, zapisy/goście/rezerwa, obecność, grupowe finanse/FIFO/korekty/zwroty, dwie nadwyżki, globalna blokada płatnych zapisów po dwóch kwalifikujących długach, atomowy inbox/outbox. Demo buduje się osobno od rzeczywistego backendu.
Lokalnie działa 29 migracji (13 historycznych +16 nowych, ostatnia 20261019175940) oraz Edge accounts/push-worker. Brak nowych migracji lub wdrożeń w bieżącym zadaniu. Zdalnego Supabase, Firebase/SMTP i Vercel nie zmieniano.

## Android — bieżący etap

Przygotowano skrypty Backend/Check/Build/Install/Logs/Disconnect oraz interaktywne fikcyjne konta z ukrytym hasłem i lokalnym Admin API. Debug używa API localhost przez planowane adb reverse; APK zawiera realny live UI, nie demo. Konfiguracja HTTP tylko debug, Keystore/SecureStorage, loggingBehavior=none; release guard blokuje lokalne ustawienia.
Gotowy APK: app/android/app/build/outputs/apk/debug/app-debug.apk, 9 658 849 bajtów. Dokładna ścieżka i SHA256 w ANDROID_READINESS_REPORT.md.

## Wyniki faktycznie wykonane w tym zadaniu

- TypeScript, ESLint: PASS. Vitest190/190 (33 pliki).
- Web build, cap sync android, assembleDebug/testDebugUnitTest: PASS; jednostkowy task natywny UP-TO-DATE, nie test urządzenia.
- APK: 43 pliki zgodne z dist, debug manifest/appId/nazwa, podpis apksigner, plugin SecureStorage i lokalny endpoint: PASS kontroli statycznych.
- Release dry-run: prawidłowo odrzucony przez guard przed wykonaniem zadań.
- Lokalny PostgreSQL/zgodność29 migracji/Auth/CORS/ochrona Edge: PASS.
- Rzeczywiste HTTP Auth7 zestawów, smoke/worker9: PASS.
- Nowy fixture helper: utworzenie/logowanie/member i odrzucanie obcego adresu/krótkiego hasła: PASS; brak danych uwierzytelniających w output, własne konto usunięte.
- Parser PowerShell, Python/Node i preflight skryptów: PASS. Po testach0 kont/grup/meczów.
- ADB: brak podłączonego urządzenia. Instalacja, USB/Wi-Fi reverse, logcat i Keystore/lifecycle na fizycznym telefonie: NIE TESTOWANO.

Historyczne wyniki poprzedniego zadania: SQL31/55/replay9, Cypress13/13, scopedHTTP20, real browser1, bootstrap6 i Deno PASS. Nie ponawiano ich bez zmian odpowiednich modułów; nie są nowymi testami urządzenia.

## Otwarte i następny krok

Jutro: Docker → Backend/Check → fikcyjne konta → debug USB/RSA → Install → ręczna checklista. Instrukcja: [ANDROID_PHONE_TEST.md](ANDROID_PHONE_TEST.md), raport: [ANDROID_READINESS_REPORT.md](ANDROID_READINESS_REPORT.md).
Telefon/API24+, kabel i autoryzacja ADB pozostają do potwierdzenia; ewentualny konflikt podpisu istniejącej instalacji wymaga decyzji, bez automatycznego uninstall/clear-data. Zimnego startu całego środowiska nie testowano przez zatrzymanie istniejących usług; helper wyklucza opcjonalny Vector tylko przy starcie. Aktualny rdzeń backendu działa.
SMTP/domena/legal/callbacki i realne signup/verification/recovery zablokowane; FCM bez konfiguracji/dostawy, iOS niezweryfikowany, CAPTCHA odłożona. Vector nadal restartuje się; bez zmian socketów/Windows. Pozostały ostrzeżenia bundle/Gradle i historyczny audit6 moderate (3 produkcyjne).
Issues #4–#6 przeczytane, nie implementowane. Live ma3 zakładki i brak edycji nazwy grupy; docelowo Mecze | Grupy | + | Profil | Ustawienia, czerwono-bordowy plus lekko nad paskiem. Nie udajemy wdrożenia tego układu.
Przed zdalnym rolloutem wymagany przegląd trzech historycznych napraw migracji, właściciela dawnej grupy i backupu danych. Brak zgody na produkcyjne wdrożenie. SLM1.0 nie jest jeszcze gotowe do publikacji.

Końcowy przegląd przygotowania Androida: git diff --check PASS, 8 zmienionych/nowych plików bez sekretów/artefaktów; skompilowana konfiguracja sieci APK ograniczona do loopback. Podczas pierwotnego przygotowania nie wykonano commita/pusha/merge ani instalacji. Obecny etap zabezpiecza te pliki na osobnej gałęzi; bez merge i instalacji.

Publikacja narzędzi: nowa gałąź chore/android-phone-readiness, lokalne helpery dopuszczają tę gałąź i feat/integration. Bez zmian aplikacji, migracji, danych i produkcyjnej konfiguracji. Po przeglądzie PR następnym krokiem pozostaje fizyczny telefon i ręczna checklista; PR nie jest scalany automatycznie.

Kontrole przed PR Androida na chore/android-phone-readiness: TypeScript/ESLint, składnia skryptów, lokalny Backend i natywne CORS, fixture preflight, integralność/podpis APK i release guard PASS. APK9 658 849 bajtów nadal lokalnie, SHA256 bez zmian. Wyniki Vitest/build powyżej pochodzą z przygotowania, nie powtarzano ich bez zmian aplikacji. Commit obejmuje wyłącznie 11 plików narzędzi i dokumentacji; żadnych sekretów, APK, cache, danych testowych ani produkcyjnych zmian. PR przeznaczony do przeglądu, bez automatycznego merge.

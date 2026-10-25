> RAPORT HISTORYCZNY z 2026-10-23. Opisuje ówczesny stan, nie aktualny odbiór B1/B2.2. Bieżący stan Androida: gałąź feat/slm-v1-live; aktualne lokalne korekty wyglądu: feat/ui-beta. Nie scalać tych gałęzi automatycznie.

﻿# Audyt UI i APK — 2026-10-23 21:17:23 Europe/Warsaw

## Wynik
Nie istnieje gotowy wariant pełnej aplikacji z całym docelowym UI Premium3.18. Nie przebudowano tej samej wersji ani nie zainstalowano demo. Integracja wymaga decyzji użytkownika.

## Repo i gałęzie
- Repo origin: https://github.com/psuda87/sunday-league-mates.git. Fetch origin wykonany poprawnie (po przyznaniu dostępu poza sandbox).
- feat/ui-beta i origin/feat/ui-beta: d0f9fa9; implementacja Premium3.18 f6e5638. Najpełniejsza zatwierdzona prezentacja w demo. Lokalne niezacommitowane zmiany obejmują demo App/Groups -> GroupScreens/testy/vite.demo, dwa pliki Gradle, dokumenty, grafiki i pics; zachowane bez modyfikacji. Nie uznano tych zmian automatycznie za nowszy zatwierdzony UI.
- feat/integration/origin: 13cf1a8; implementacja integracji 0ec5200.
- main/origin/main: 1fadd97 po PR #3; app jest identyczne z feat/integration.
- chore/android-phone-readiness/origin: ae9fac7, istniejący czysty worktree I:\slm\sunday-league-mates-integration. Od main różni się helperami Android/local, nie ekranami aplikacji.
- UI_INTEGRATION_MAP.md i ANDROID_READINESS_REPORT.md opisują częściową integrację Premium i jawne braki. Data/nowość commita nie oznacza kompletu ekranów.

## Faktyczne źródło APK
Telefon: pakiet pl.psuda87.slm, versionCode1/versionName1.0, instalacja/aktualizacja 2026-10-23 19:56:22 według dumpsys urządzenia.
SHA256 base.apk na telefonie = lokalny app-debug.apk = 11f0352af21f6a1945ee29a620fce266b6ee0b3b0466f7780b731f5f590fde1c.
Metadane .cache/android-phone-build.json zapisane przy buildzie wskazują 13cf1a82e9e993cc9b4c4a53bc3e0aff9d9a307f (feat/integration), NIE ae9fac7. Bieżący helper drukuje aktualny HEAD ae9fac7; nie jest to dowód commita budowania. Kod aplikacji jest zgodny.
Ponowny verify-apk PASS: 43 pliki APK zgodne bajtowo z dist, podpis/debuggable/applicationId/SecureStorage, lokalne API http://127.0.0.1:54321, brak AccountDemo.
APK zawiera zasoby lokalne, nie live reload. Brak rejestracji service worker w przeszukanych src/public/vite.config.ts. Nie ma dowodu, że cache WebView odpowiada za wygląd; różnice są bezpośrednio w źródłach. Nie czyszczono danych/cache.
ADB device dostępne, mapowanie reverse tcp:54321 zachowane. Nie zmieniano backendu; jego gotowości ani sesji nie testowano ponownie w tym audycie.

## Przyczyna różnic
Wspólne app/src/theme i app/public/assets są zgodne między commitami ui-beta a readiness; w ui/ różni się BottomNav. Pełne układy demo nie zostały jednak podłączone do live.
- Live Accounts zachowuje dodatkowy górny pasek Rozliczenia/Powiadomienia/Mecze/Mój profil/Wyloguj i formularzowy profil. Demo używa DemoProfile i UltimatePlayerCard.
- Live BottomNav to Mecze/Grupy/Profil, bez oddzielnego plusa. Demo DemoBottomNav posiada plus dla uprawnionych.
- Live Groups/Matches/Finance to osobne, uproszczone komponenty z prawdziwym SessionManager, nie pełne prezentacje demo.
- Palety poza España opt-in tylko demo. Składy/statystyki/portret/numer i bogaty profil nie mają kompletu produkcyjnych kontraktów; nie wolno podstawiać fikcyjnych danych.
- App.tsx w integration importuje dark.always.css, ui-beta dark.class.css: rzeczywista różnica w bazowym motywie Ionic, wymaga przeglądu w integracji.

## Plan wymagający zgody
1. Osobna lokalna gałąź od readiness/main, bez merge/cherry-pick/push i bez zmiany istniejących worktree.
2. Ręcznie współdzielić warstwę prezentacji Premium3.18: ekran konta, nawigację i układy list/szczegółów grup, meczów oraz finansów. Zachować SessionManager, realne DTO/akcje i guardy. España jako domyślna; bez rozszerzania palet produkcji.
3. Profil opierać wyłącznie na istniejących danych serwera; brakujące dane/operacje pokazać jawnie jako niedostępne. Nie importować world/reducerów/fixture ani symulatora Auth. Rozbudowany profil/składy wymagające nowych kontraktów pozostawić do osobnej decyzji.
4. Sprawdzić motyw Ionic, usunąć dublowanie nawigacji w docelowym układzie; plus tworzenia meczu pokazywać wyłącznie na podstawie istniejących uprawnień grupowych. Osobna zakładka Ustawienia to dodatkowe docelowe ustalenie z readiness, do potwierdzenia w tym zakresie.
5. TypeScript/lint/testy jednostkowe i integracyjne UI, świeży lokalny web build, cap sync, debug APK/test Gradle, kontrola podpisu/pakietu/bundle/źródłowego SHA, aktualizacja adb install -r i smoke/logcat. Bez uninstall/clear-data/reset.

## Status tego zadania
PASS: fetch, audyt gałęzi i dokumentów, identyczność zainstalowanego APK, statyczna weryfikacja bundle i konfiguracji, zachowanie lokalnych zmian.
NOT TESTED: nowy build/TS/lint/testy/instalacja/renderowanie/logcat nowej wersji, ponieważ wymagana integracja nie jest jeszcze autoryzowana. Nie wykonano merge/cherry-pick/push ani zmian zdalnego Supabase/bazy.
Na telefonie nadal spodziewany dotychczasowy live: Mecze/Grupy/Profil, profil formularzowy, bez Ultimate i centralnego plusa. Sam rebuild tego nie zmieni.

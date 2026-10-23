# Premium 3.18 — integracja live i Android

Stan roboczy: 23.10.2026, Europe/Warsaw. Gałąź `feat/premium318-live`,
osobny worktree `I:\slm\sunday-league-mates\.worktrees\premium318-live`.
Baza: `feat/integration` / `13cf1a8`. Referencja prezentacji: `feat/ui-beta` /
`d0f9fa9`. Kod APK: `96755b894191559a71c3f35dc93422aeadb82d1b`.

## Ekrany i źródła danych

- Login: panel Premium i wspólne pola; istniejące `SessionManager.signIn`,
  odświeżanie sesji i SecureStorage. Bez symulatora kont.
- Profil: zatwierdzona UltimatePlayerCard (bajtowo bez zmian względem `d0f9fa9`),
  nazwa i inicjały z własnego profilu API. Statystyki mają `—`, opis niedostępności;
  nie podstawiono zer, fikcyjnego zdjęcia ani numeru. Istniejąca edycja profilu,
  kontaktu i hasła jest w rozwijanej sekcji; ustawienia zawierają motyw i akcje konta.
- Nawigacja: Mecze / Grupy / Profil, osobny plus 56 px z wysunięciem 20 px,
  dostępny po potwierdzeniu organizującego członkostwa w odpowiedzi `groups_list`.
  Tworzenie nadal sprawdza uprawnienia przez istniejący formularz i serwer.
  Rozliczenia, powiadomienia, legacy i administracja kontami pozostają dostępne
  przez ustawienia profilu; nie ma powielonego globalnego paska akcji.
- Grupy: rzeczywiste listy/członkowie/role/zaproszenia/wyszukiwanie/tworzenie;
  responsywne karty i formularze korzystają ze wspólnych tokenów Premium.
- Mecze: wspólne hero, datownik, fotografia, filtry, zakładki i roster;
  grupa nad kartą, badge Prywatne/Publiczne z ikoną Ionic w karcie.
  Formularz ma kontrolowane DD.MM.RRRR / HH:mm i klawiaturę numeryczną;
  do API nadal trafia data ISO i istniejący kontrakt czasu Europe/Warsaw.
  Nie zgaduje godziny ani limitu. Zapisy/goście/rezerwa/edycja działają przez API.
- Finanse: kafle prawdziwego własnego salda i pozostałych należności w wybranej
  grupie. Dotychczasowe wpłaty, decyzje i guardy bez zmian; brak kwot demo.
- España i Light/Dark/Auto; poprawiono import Ionic z dark.always na dark.class,
  zgodnie ze sterowaniem motywem przez istniejący `initializeTheme()`.

Niedostępne: backend statystyk, portretu i numeru, zapisu składów, ocen,
rejestracji/poczty/recovery oraz doręczenia FCM. Nie podłączono reducerów demo,
fixture ani AccountDemo do aplikacji. Brak nowych palet produkcyjnych.
Nie jest to deklaracja kompletności wszystkich operacji demonstracji ani gotowości release.

## Osobno zatwierdzona naprawa lokalnego backendu

Test HTTP z istniejącym meczem w bazie ujawnił brak filtra `p_event` w ostatniej
definicji `slm_private.match_summary`. Odpowiedź szczegółów miała ID/grupę innego
meczu. Test historyczny na pustej bazie z jednym meczem nie wykrywał tego błędu.
Po uzyskaniu jawnej zgody dodano nową migrację
`20261023193156_slm_match_summary_filter.sql` z `WHERE e.id=p_event`.
Historycznych migracji, projekcji dostępu, grantów i RLS nie zmieniono.

Zastosowano wyłącznie lokalnie `supabase migration up --local` (CLI 2.121.0).
Historia ma 30 migracji; bez resetu lub zmian zdalnych. Nieistniejący mecz zwraca
NULL, bezpośredni dostęp anon/authenticated do RPC pozostał zabroniony.
Frontend dodatkowo odrzuca szczegóły o innym ID niż żądane.

## Weryfikacja

| Kontrola wykonana w tej integracji | Wynik |
|---|---|
| Zależności z package-lock, npm ci --offline | PASS po dostępie poza sandbox; lockfile bez zmian |
| TypeScript | PASS |
| ESLint | PASS |
| Vitest | 196/196, 34 pliki |
| Cypress, kontrolowane API | 16/16; UI, sesja/offline/logout, legacy, role, finanse, nawigacja |
| Responsive Cypress | 320/390/768 px; profil i formularz bez poziomego overflow |
| Rzeczywisty browser → lokalne Edge → PostgreSQL | 1/1; login, grupa, dwa mecze o różnych ID, zapis, gość/rezerwa, finanse, logout |
| SQL/RLS/FIFO/współbieżność w osobnej scratch DB | 58/58; w tym trzy nowe asercje filtra ID |
| Rzeczywiste lokalne HTTP | 20/20 |
| Backend preflight po migracji | PASS: PostgreSQL, 30 migracji, Auth, native CORS, Edge/worker |
| Web build + Capacitor sync | PASS |
| assembleDebug + testDebugUnitTest (JDK21) | PASS; 192 zadania wykonane, 1 test JUnit, 0 błędów |
| APK/dist/podpis/appId/SecureStorage/lokalne API/brak AccountDemo | PASS; 43 pliki identyczne |
| Guard release z lokalnym HTTP | PASS: release odrzucony przed wykonaniem zadań |
| Instalacja i start nowego APK na telefonie | OCZEKUJE: ADB unauthorized po utracie USB |
| Nawigacja i sesja nowej wersji na fizycznym telefonie | NOT TESTED — wymaga instalacji |

Testy początkowo wykryły zależny od daty historyczny test demo: pierwszy mecz
fixture był już w przeszłości. Przypięto `Date.now` tylko w tym zestawie testów.
Pierwszy Cypress po zmianie nawigacji miał stare selektory; dostosowano ścieżki
do Profil → ustawienia i nowego formatu daty. Końcowe wyniki powyżej dotyczą poprawek.

Testy backendowe tworzyły własne losowe zasoby; sprzątanie obejmowało tylko te
zasoby. Istniejących kont, grup, meczów i danych telefonu nie usuwano.
Scratch DB została usunięta, oryginalna baza zachowana.

## Artefakt

`app/android/app/build/outputs/apk/debug/app-debug.apk` w nowym worktree.
8 360 052 bajty; SHA256:
`1d2ace5f5640c04b663f3896dda5123c5c53292fbd975c83612cc32fc52bc769`.
Pakiet `pl.psuda87.slm`, nazwa Sunday League Mates. Lokalny debug, nie release.
Metadane źródłowego SHA i hash APK w ignorowanym `.cache/android-phone-build.json`.
Poprzedni APK: build `13cf1a8`, SHA256
`11f0352af21f6a1945ee29a620fce266b6ee0b3b0466f7780b731f5f590fde1c`.

Zrzuty poniżej przedstawiają uruchomioną aplikację live z kontrolowanym API
Cypress i fikcyjnymi danymi testu, nie zrzuty prywatnych danych telefonu:

- [Profil Ultimate](premium318-live-browser/premium.cy.ts/premium318-live-profile.png)
- [Grupy](premium318-live-browser/premium.cy.ts/premium318-live-groups.png)
- [Formularz meczu](premium318-live-browser/premium.cy.ts/premium318-live-event-form.png)

Ostrzeżenia: duży chunk web, Gradle flatDir i biblioteka .so bez strip;
nie blokują debug builda. Bez nowych zależności.
Nie wykonano push, merge, zdalnych migracji, Firebase ani deploy.
Brak linków GitHub nowych plików, ponieważ push jest zabroniony przez użytkownika.

## Odbiór telefonu po aktualizacji

Profil powinien pokazać złoto-bordową tarczę Ultimate z własną nazwą i inicjałami,
statystyki `—`, rozwijane edycję i ustawienia. Organizator widzi osobny plus
nad zakładką Grupy. Zwykłe konto bez organizujących członkostw ma trzy zakładki.
W meczach widoczne są prawdziwe wydarzenia i etykiety prywatności; w formularzu
pola DD.MM.RRRR/HH:mm. Nie ma fikcyjnych osób/statystyk ani narzędzi demo.

Potrzebne ręcznie: profil → ustawienia, przejścia zakładek, klawiatura, plus przy
właściwej roli, Home/powrót, wylogowanie i ponowne logowanie. Nie podawaj hasła
w rozmowie. Pozostaw USB i Docker dla lokalnego API.

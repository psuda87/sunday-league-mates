# Premium España3.8 — kontrola demo

Stan jest deterministycznym snapshotem18.10.2026,20 osób i10 meczów. Jedyny moduł
danych: app/src/demo/data.ts. Brak nowych obrazów lub fotografii osób; oficjalny
herb/stadion i CSS Premium3.6/3.7 zachowane. Jedyny profil demo: demo/Profile.tsx,
jeden stos widoków w demo/App.tsx. Statystyki i kwoty pochodzą ze stanu, nie makiet.

## Scenariusz na telefonie

1. Otwórz kartę meczu i kliknij nazwę uczestnika. Powrót strzałką przywraca mecz,
   aktywną zakładkę, rozwiniętą listę i scroll. To samo działa ze Składów,
   Rozliczenia, Rezerwy, katalogu i zapraszającego. Gość bez profilu nie ma konta.
2. Zapisz się, dodaj gościa, wycofaj zapis. Licznik/listy/kwoty się aktualizują.
   Pełny mecz pozwala wejść na rezerwę. Zwolnij miejsce suwakiem w narzędziach:
   osoba z rezerwy może sama zająć miejsce, nikt nie jest awansowany automatycznie.
3. Narzędzia demo -> Mecz zakończony: zmień obecność w Uczestnikach. Profil i
   historia/statystyki są wyliczane ponownie. Historia profilu otwiera konkretny
   mecz i pozwala wrócić przez ten sam stos ekranów.
4. Przykładowe zaległości: Alex ma2 zakończone nieopłacone mecze. Wejdź przez
   Profil do jego historii, otwórz mecz i Rozliczenie, symuluj wpłatę przy Alexie.
   Po zmniejszeniu liczby zaległych meczów do1 zapis staje się dostępny.
5. Reset danych demo przywraca20/10 i początkowe listy/kwoty, nie zmienia motywu.
   Narzędzia są domyślnie zwinięte. Reload również resetuje dane; nie ma zapisu
   w backendzie ani trwałych deep linków profili/systemowego Back.

## Ogląd renderów i korekty

Pierwszy rzeczywisty render ujawnił zbyt duży odstęp przez przycisk gościa nad
zakładkami oraz nieczytelny podpis gościa na boisku. Przeniesiono akcję gościa
do panelu Uczestnicy, pokazano ją po zapisie; podpis gościa ma oddzielną linię.
Pierwsza implementacja tego przeniesienia zgubiła przekazanie props actions;
kontrola Chromium wykryła brak akcji. Poprawiono i ponowiono pełne scenariusze.
Ujednolicono koszulki IonIcon zamiast tymczasowego symbolu i przewinięto screenshoty
Składów/Rozliczenia/Narzędzi do właściwej zawartości. Końcowe zrzuty obejrzane.
Header/herb, hero, CTA34/44, filtry28px, zakładki i stopka nadal te same komponenty;
nie deklaruje się bajtowej zgodności screenshotów po rozbudowie danych/paneli.
Kod produkcyjnych stron, MatchHero/MatchHeader/MatchTabs, Auth/API i SQL nietknięty.

## Rzeczywiste zrzuty Chromium390x844

- [Uczestnicy](premium38-participants-clickable.png)
- [Profil](premium38-player-profile.png)
- [Składy](premium38-teams.png)
- [Rozliczenie](premium38-settlement.png)
- [Statystyki](premium38-statistics.png)
- [Narzędzia](premium38-demo-tools.png)
- [Uczestnicy Light](premium38-participants-light.png)
- [Profil Light](premium38-player-profile-light.png)
- [Składy Light](premium38-teams-light.png)

## Kontrole i ograniczenia

TypeScript/ESLint/oba buildy OK; Vitest98/98 w16 plikach. Chromium320x844/390x844/
768px: profile i powroty, zagnieżdżenie, query/scroll, linki niezależne od akcji,
wpłata/unlock, rezerwa/claim/guest/reset/motywy, CTA34/44, brak overflow i CSP OK.
14 plików statycznych demo bez Auth/Supabase/API/Edge i żądań zewnętrznych.
Cypress brak Xvfb; nie testowano realnego backendu/Androida/iOS. Duże chunki Ionic.
Podgląd boiska i składy są deterministyczną prezentacją, nie sportowym algorytmem.
Wpłaty/obecności/statystyki/blokady są wyłącznie symulacją w pamięci, nie produkcją.
Nie ma migracji, nowego kontraktu katalogu, wdrożenia ani merge. Vercel automatyczny
niezweryfikowany. Nie używać demo jako logiki serwerowej lub aplikacji z realnymi danymi.

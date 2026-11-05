# Fikcyjny mecz 6 na 6

2026-11-05 · `codex/demo-match-6v6` · baza ostatniego preview motywów
`19913381f0b61c0cc64e3f6e81d99e371d3baeb1` z `feat/premium-theme-refinement`.
Osobne prace `feat/premium-legal-pages` pozostają na swojej gałęzi.

## Zakres i pochodzenie

Uczestnicy: suda, adam p., sebastian s., ariel, marek, michał, tomek B,
Mateusz, dawid, kuba, krystian, kolega krystiana. Ostatnia osoba jest fikcyjnym
gościem krystiana bez konta. Pozostali mają wyłącznie lokalne identyfikatory
`demo-six-*`, bez powiązań z kontami. Brak opłat i danych kontaktowych.

Wykorzystano bez zmian istniejące `src/demo/Teams.tsx`, `src/demo/data.ts`
(`lineup_reset`, `lineup_swap`, `teamEntries`) i `src/ui/PremiumPitch.tsx`.
Pierwotny moduł boiska i zamian: `189896f`; późniejsza integracja wspólnej
geometrii Premium: `534986c`, konsolidacja: `e73d5fe`.
Podział jest deterministyczny, naprzemienny, 6 na 6; nie jest oceną umiejętności
ani nowym algorytmem balansowania. Zamiana zachowuje liczebność i obejmuje gościa.
Reset przywraca kolejność bazową. Odświeżenie tworzy świeże dane.

Osobny punkt wejścia `app/demo-six` wykorzystuje istniejące komponenty, kartę
profilu, CSS i motywy ostatniego preview. Nie zmieniono żadnego istniejącego
pliku `src/ui`, `src/demo`, Auth, backendu, migracji, strażników ani CI.
Domyślne buildy i routing LIVE/Premium pozostają bez zmian względem bazy.

## Izolacja

Stan meczu istnieje wyłącznie w pamięci komponentu React. Brak zapisu meczu
w localStorage, bazy, Storage, kont i API. Preferencje wyglądu korzystają
z istniejącego mechanizmu przeglądarki. Dedykowana konfiguracja Vite nie ładuje
`.env`, nie udostępnia prefiksów środowiska i nie kopiuje katalogu publicznego.
Jawna lista modułów dopuszcza prezentację demo, odrzuca Auth/API. Weryfikator
sprawdza artefakty pod kątem markerów backendu, sekretów i zgodności grafik.
CSP ma `connect-src 'none'`, `form-action 'none'`, `frame-ancestors 'none'`.

## Uruchomienie i preview

W `app/`: `npm run build:demo-six`, potem `npm run preview:demo-six` (port 5177).
Wynik: `app/dist-demo-six`, ignorowany przez Git.
Vercel: istniejący `slm-ui-demo`, zespół `team_Duwu4Lq3wtGIgFB6OxM0cB6Z`,
potwierdzony aktywny plan Hobby. Wyłącznie preview, bez produkcyjnego aliasu.
Root dla tego wdrożenia: `app/demo-six`, źródła spoza root włączone tylko
w parametrach tego wdrożenia; konfiguracja projektu nie jest aktualizowana.
Instalacja i build wykonują się w nadrzędnym `app/`, wynik `../dist-demo-six`.
Adres i faktyczny wynik zdalnego wdrożenia będą zapisane po weryfikacji.

## Kontrole

- PASS `npm run build:demo-six`: TypeScript, build i izolacja 16 plików statycznych.
- PASS `npm run build` i `npm run lint`.
- PASS `npm run test.unit -- --run`: 479 testów / 69 plików, w tym 3 nowe testy.
  Pierwszy bieg nie wykonał testów przez EPERM plików tymczasowych; poprawny
  wynik uzyskano z dostępem wymaganym przez lokalny runner.
- PASS Cypress Electron, 390×844: 1/1, wszystkie osoby, 6v6, zamiana gościa,
  reset, ponowna zamiana i odświeżenie, brak zapytań Supabase/Auth/Edge,
  brak poziomego przepełnienia dokumentu.
  Polecenie: `npm run test.e2e -- --config baseUrl=http://127.0.0.1:5177,specPattern=cypress/demo-six/match.cy.ts --spec cypress/demo-six/match.cy.ts --browser electron`.
  Pierwsze próby blokował dostęp sieciowy serwera oraz domyślny katalog speców;
  scenariusz wykonano po jawnej konfiguracji i uruchomieniu dostępnego serwera.
- FAIL `npm run test:premium-policy`: 82 przypadki zatrzymane przez istniejący
  na bazie motywów hash `app/src/demo/palettes.css` (`7fcaafb9…` zamiast
  `93293b4d…`). Plik identyczny z `1991338`; nie aktualizowano pinów ani kontraktu.
  Nie jest to zaliczenie kontraktu Premium ani zgoda na merge/produkcję.
- Ostrzeżenia buildu: duży wspólny chunk, historyczny import konfiguracji bez
  rozszerzenia i ścieżki teł emitowanych przez plugin. Build i walidacja grafik PASS.
- Bez testów SQL/integracji z bazą, zdalnych migracji, deployu Edge, CI GitHub,
  synchronizacji Androida i instalacji APK: to osobny statyczny wariant web.

Następny krok: odbiór preview przez właściciela. Merge do main i zmiany
strażników wymagają odrębnej wyraźnej zgody.

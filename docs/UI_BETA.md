# UI Beta — España Light & Dark

17.10.2026, feat/ui-beta z origin/feat/integration 2026754. Referencję trzech ekranów
dostarczoną przez użytkownika obejrzano w rozmowie. Zrealizowano układ Hiszpania;
nie kopiowano herbów ani znaków federacji. Oryginalna dekoracyjna ilustracja
stadionu w public/images/stadium.svg nie udaje zdjęcia rzeczywistej lokalizacji.
Pobranie fotografii stockowej było niedostępne (HTTP 403); ilustrację można później
zastąpić zaakceptowanym, licencjonowanym zdjęciem. Nie użyto portretu zawodnika.

## Architektura motywów

- theme/variables.css: centralne tokeny España, jasna baza i nadpisanie klasy
  ion-palette-dark. Kolory Ionic, powierzchnie, inputy, toolbar, footer, overlay,
  alert/toast dziedziczą motyw. Usunięto wymuszone dark.always.
- ui/theme.ts: auto/light/dark, prefers-color-scheme, reakcja live na zmianę systemu,
  ręczna preferencja ma pierwszeństwo; localStorage slm.appearance zawiera tylko wygląd.
  Odmowa dostępu do storage zachowuje wybór w pamięci bieżącej aplikacji.
- index.html: mały bootstrap przed renderowaniem ogranicza miganie błędnego motywu.
- ui/AppearanceSettings.tsx: natychmiastowa zmiana w profilu. Synchronizacja kart okna.
- data-theme=espana jest punktem rozszerzenia dla zatwierdzonych w przyszłości rodzin
  Lime/Barcelona/Deimos/Gold; nie wprowadzono ich ani wyboru nieistniejących motywów.
- Obsłużono focus, etykiety, reduced-motion i możliwość powiększania strony.

## Mecze i nawigacja

MatchHero pokazuje dzień, czas i datę Europe/Warsaw, lokalizację i dekorację stadionu.
MatchCapacityProgress korzysta wyłącznie z registered_count i capacity z RPC:
backend liczy członków i gości; rezerwa nie zwiększa zajętości. Pasek ma opis,
minimum 10, stan pusty/minimum/komplet i dostępny progressbar. Bez obliczeń finansów.

Events wyszukuje najbliższy przyszły scheduled mecz; w razie wielu przyszłych
wydarzeń czyta dalsze istniejące strony RPC, aż do przeszłości/końca listy. Szczegóły
ustalają własny zapis. CTA korzysta z istniejących events_join/reserve/withdraw;
po operacji odświeża serwer. Pełny mecz proponuje rezerwę, zadłużenie blokuje nowy
zapis, ale nie rezygnację. Przed potwierdzeniem stanu finansów zapis pozostaje
nieaktywny. Nie wprowadzono reguły zamykania o 17:00. Serwer nadal rozstrzyga
uprawnienia, miejsca, czas i konflikty; interfejs nie gwarantuje skuteczności zapisu.

Logo SLM i dzwonek prowadzący do istniejącego centrum powiadomień. Dolna nawigacja:
Mecze, Zawodnicy, Składy, Profil; safe areas. Nie ma API katalogu graczy na bazowej
gałęzi: zakładka wskazuje listy uczestników meczów. Składy jawnie niedostępne.
Zachowano menu konta z rozliczeniami, panelem administratora i logout, poniżej treści.
Nie zmieniano mechanizmów sesji ani zabezpieczeń. Start po loginie prowadzi do meczów.

## Bezpieczny podgląd

/ui-demo jest osobnym ekranem statycznym, bez SessionManager/API, prawdziwych kont,
telefonów, tokenów i panelu admina. Dane: demonstracyjna lokalizacja, 12/15, jawny
komunikat DEMO; CTA nieaktywne. Nie zapisuje żadnych operacji biznesowych.

Cloud nie udostępnia narzędzia publikacji portu ani publicznego tunelu. Vite działa
lokalnie na 5174, HTTP /ui-demo=200, ale localhost/prywatny adres kontenera NIE jest
adresem do otwarcia z telefonu użytkownika. Niczego nie opublikowano.
Zrzuty obu motywów zapisano w docs/ui/espana-dark.png i espana-light.png.
Na komputerze: w app npm ci --ignore-scripts, npm run dev -- --host 0.0.0.0;
otworzyć na telefonie w tej samej zaufanej sieci adres LAN komputera /ui-demo.
Nie wystawiać całego serwera developerskiego publicznie. Ewentualna publikacja demo
wymaga osobnej zgody i odseparowania od produkcyjnej konfiguracji.

## Weryfikacja i granice

Wyniki bieżącej sesji w STATUS.md. Testy RPC UI używają atrap, nie Supabase.
Chromium headless sprawdza 320/390/768 px bez poziomego przepełnienia, ręczne tryby,
zmianę prefers-color-scheme bez restartu, progressbar i brak wywołań backendu w demo.
To nie pełny audyt WCAG ani test Androida. Cypress przygotowany, uruchomienie
zablokowane brakiem Xvfb (binarium Cypress 16.1.1 pobrano poprawnie).

Wieczorem: uruchomić pełny Cypress z Xvfb lub na komputerze; sprawdzić profil,
logout, panel admina, powiadomienia i CTA na atrapach. Testy Auth dostosowano do startu na meczach i przejścia do Profilu;
Cypress nie potwierdził jeszcze tych scenariuszy. Następnie Android: build i cap sync na komputerze,
jasny/ciemny/auto także po powrocie z tła, klawiatura, safe areas, status/navigation
bar, powiększenie tekstu, modale/alerty/toasty, ostatnie miejsce i blokada. Realne
zapisy wyłącznie na izolowanym backendzie testowym po odbiorze migracji.

Nie zmieniono migracji, RPC, RLS, ledgera/FIFO, Edge, Firebase ani magazynu sesji.
Sześć migracji integracji pozostaje niezastosowanych; rzeczywiste SQL/RLS/wyścigi,
Android/iOS/FCM niepotwierdzone. Historyczna blokada silnika Docker na Windows
pozostaje w dokumentacji integracji. W tej sesji nie uruchamiano bazy ani wdrożeń.

Powtarzalny smoke Chromium (Node z WebSocket): uruchomić Vite na 5174 oraz Chromium
--headless --no-sandbox --disable-dev-shm-usage --remote-debugging-port=9222
--user-data-dir=/tmp/slm-ui-chromium about:blank; następnie z app
node scripts/test-ui-beta-browser.mjs. Wyłącznie izolowany Cloud/lokalny profil,
port debug na loopback; bez publikacji. Zrzuty domyślnie w /tmp/slm-ui-preview.

## Samodzielny build do Vercel — 17.10.2026

`/ui-demo` w pełnej aplikacji nie jest granicą publikacji. Osobny `npm run build:demo`
buduje odrębne `demo/main.tsx` do `dist-demo`, bez App/Auth/Edge/Supabase.
Demo ma teraz suwak zajętości 0–15. Konfiguracja i wyniki: [DEMO_VERCEL.md](DEMO_VERCEL.md).
Brak wdrożenia. Nie publikować pełnego `dist`.

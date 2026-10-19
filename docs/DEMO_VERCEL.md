## Premium3.15 — grupy wyłącznie demo

Jawna allowlista rozszerzona o src/demo/groups.ts i Groups.tsx. Nadal15 plików,
6 istniejących zasobów, bez nowych zdjęć/sekretów/dependencies. CSP/env/
app/vercel.json bez zmian. GroupState i kontakty tylko fikcyjne w RAM, reset
usuwa zmiany; przełącznik użytkownika nie jest Auth. Root app / npm run
build:demo / dist-demo / bez env. Bez ręcznego wdrożenia.

## Korekta menu po3.14

Demo ma tylko Mecze/Profil i osobny plus administratora; katalog Zawodnicy
usunięty z demo. Profile innych osób otwierane z meczu. Izolacja/build/CSP/
konfiguracja Vercel bez zmian. Starsze opisy3 zakładek poniżej są historyczne.

## Premium3.14 — wydarzenia w pamięci demo

Allowlista rozszerzona tylko o src/demo/DemoBottomNav.tsx, EventForm.tsx,
eventDraft.ts. Root app / npm run build:demo / dist-demo / bez env nadal.
Bez nowych zależności/zasobów i zmian app/vercel.json/CSP.15 statycznych plików,
6 dotychczasowych assetów; brak produkcji/Auth/API/Supabase/Edge w bundle demo.
Rola wydarzeń tylko symulowana w Narzędziach demo, domyślnie zawodnik; nie jest
zabezpieczeniem prawdziwych danych. Mecze wyłącznie RAM, reset/odświeżenie usuwa
utworzone rekordy.3 zakładki zgodnie z odpowiedzią użytkownika. Bez ręcznego deploy.

## Premium3.13 — pamięciowa edycja profilu

Jawnie dopuszczono src/demo/Identity.tsx i portraits.ts. Bez nowych zasobów/
zależności, nadal15 plików/6 istniejących assetów. Lokalne PNG/JPEG/WebP są
FileReader data URL w RAM; obecne img-src self data: wystarcza, nie dodano blob: ani
nowych wyjątków CSP. connect-src none nadal, zero uploadu/Storage/sekretów/Auth.
Nie utrwalamy obrazów/nazw w localStorage ani repo; jedynie stary motyw zapisuje
preferencję jak wcześniej. Root app / npm run build:demo / dist-demo / bez env,
app/vercel.json nietknięty. Żadnego ręcznego deploy.

## Premium3.12 — Premium Finance UI

Do jawnej allowlisty modułów dodano tylko src/demo/Finance.tsx. Bez nowych
zasobów/dependencies; output15 plików/6 dotychczasowych assetów. CSP/env/publicDir
i app/vercel.json bez zmian. Dane i role wyłącznie fikcyjne w pamięci, bez Auth/
API/Supabase/Edge. Przełącznik ról nie jest zabezpieczeniem; nie stosować go
do prawdziwych danych. Root app / npm run build:demo / dist-demo / bez env.
Bez ręcznego wdrożenia.

## Premium3.11 — boisko tylko demo

Jawna allowlista modułów rozszerzona o src/demo/Teams.tsx; kontrola nadal odrzuca
produkcję/Auth/Supabase/Edge. Boisko SVG/CSS bez nowych obrazów lub zależności,
output nadal15 statycznych plików,6 dotychczasowych zasobów. CSP/env/publicDir
i app/vercel.json bez zmian. Root app / npm run build:demo / dist-demo / bez env.
Podział i zamiany wyłącznie w pamięci demo, bez zapisu do API. Bez ręcznego deploy.

## Premium3.9 — fikcyjne portrety

Output15 plików,6 jawnych zasobów: dawnych5 branding + assets/demo/fictional-portraits.webp.
WebP~115KB jest generatywną macierzą4 fikcyjnych portretów, mapowaną deterministycznie.
Verifier porównuje bajty, RIFF/WEBP i limit500KB; pozostałe kontrole niepoluzowane.
Allowlista obejmuje nowy UltimatePlayerCard UI. Usuwanie gości i kredyt wpłat są
wyłącznie w pamięci demo. Nie dodano API/uploadu/sekretów ani nowych zależności.
Root/Build/Output/env/CSP/vercel.json bez zmian; brak ręcznego deploy.

## Premium3.8 — aktualny zakres demonstracji

Interaktywne fixture tylko src/demo/:20 fikcyjnych osób/10 meczów, reducer w pamięci,
globalne profile i historia, składy/statystyki/kwoty oraz operacje symulowane.
Starsze opisy braku aktywnych zapisów lub fikcyjnych kwot są historyczne: użytkownik
w3.8 autoryzował jawnie oznaczoną symulację, bez zmiany backendu i granicy builda.
Allowlista4 jawnych nowych modułów; env/publicDir false, emitowane5 zasobów,
14 plików wyjściowych i CSP connect-src none nadal sprawdzane. Brak Auth/Supabase/
API/Edge, sieci zewnętrznej, sekretów i rzeczywistych danych. Danych nie utrwalamy.
Root app / npm run build:demo / dist-demo / bez env i bez zmian vercel.json.
Brak ręcznego deploy; automatyczny Vercel niezweryfikowany.

## Premium3.4 — szczegóły i współdzielone grupy

Allowlista rozszerzona tylko o UI ParticipantGroup/RosterSummary. Output nadal14
statycznych plików, logo/zasoby/CSP/env/publicDir false bez zmian. Nie ma API,
Auth/Supabase/Edge ani operacji zapisujących. Zmiany fixture dotyczą wyłącznie
prezentacji osób, bez nowych rzeczywistych danych. Wszystkie4 zakładki i wejście/
powrót działają bez logowania. Składy/finanse jawnie planowane lub niedostępne.
Root app / npm run build:demo / dist-demo / brak env i app/vercel.json bez zmian.
Nie wykonywano ręcznego wdrożenia; status automatyczny niezweryfikowany.

## Premium3.3 — pełny herb w jednym tle

Demo nadal14 plików i5 jawnych zasobów. Emitowany slm-logo-primary-transparent.png
zamiast header-transparent, zgodność bajtów i rzeczywista alfa nadal obowiązkowe.
Konkretny zatwierdzony primary ma315574B, limit dla niego350KB; inne zasoby160KB.
Nie kopiować całego public/. Allowlista modułów/CSP/env/Root/Build/Output bez zmian.
Wrapper brandingu jest częścią IonContent, bez osobnego toolbaru i warstwy fixed.
Brak połączeń z backendem/sekretów/danych rzeczywistych. app/vercel.json bez zmian.
Bez ręcznego deploy; automatycznego podglądu nie zweryfikowano.

## UI Beta3.2 — rzeczywiste alfa logo

Demo nadal14 statycznych plików i5 jawnych zasobów branding. Zmieniono jedynie
emitowany header na slm-logo-header-transparent.png. Build verifier sprawdza zgodność
bajtów i rzeczywisty kanał alfa poprzez rozpakowanie PNG w Node; source primary
sprawdzany osobno poleceniem node scripts/verify-logo-alpha.mjs.
Allowlista modułów/CSP/env/publicDir/Root/Build/Output i app/vercel.json bez zmian.
Bez Auth/Supabase/API/Edge i prawdziwych danych. Skrypt maskowania to narzędzie
offline w docs/ui, nie moduł UI ani zależność builda. W produkcyjnej konfiguracji
nie wprowadzono zmian. Nie uruchamiano ręcznego deploymentu.

## UI Beta3.1 — zasoby oficjalne, granica separacji zachowana

Root app / npm run build:demo / dist-demo / brak env i app/vercel.json bez zmian.
Nowy moduł dozwolony wyłącznie UI: MatchFilters. publicDir nadal false.
Jawnie emitowane5 zatwierdzonych plików: slm-logo-header.png, slm-favicon-64.png,
stadium-bg-card.jpg, stadium-bg-main.jpg, espana-dark-texture.jpg. Weryfikacja
zgodności bajtów z oryginałami, rozmiaru i sygnatur PNG/JPEG. Nie kopiować całego public/.
Stary SVG i stare tła nie są emitowane; pozostają źródłami archiwalnymi w repo.
Demo14 plików, bez Auth/API/Supabase, źródeł App, prawdziwych kont i danych.
CSP/env/allowlista aplikacji bez poluzowania. Filtry korzystają wyłącznie z fixture.
Manifest PWA dotyczy właściwej aplikacji; nie dołączono go automatycznie do demo.
Bez ręcznej publikacji. Zwykły push autoryzowany, status automatyczny niepotwierdzony.

## Premium 3.0

Demo nadal samodzielne: te same Root app / npm run build:demo / dist-demo / brak env.
Żadnych zmian CSP, allowlisty modułów ani konfiguracji Vercel. Dodano wyłącznie UI
w istniejących modułach:3 jawnie fikcyjne wydarzenia, przykładowych uczestników
i dekorację planowanych składów. Nie ma App/Auth/API/Supabase ani prawdziwych osób.
Demo12 plików zweryfikowane podczas build; brak żądań zewnętrznych w Chromium.
Końcowe zrzuty: ui/premium-*.png. Nie uruchamiano ręcznego wdrożenia.
Odczyt GitHub deployment API zwrócił Forbidden; nie ma potwierdzonego URL/statusu.

## UI Beta 2.3 — wybrany B i oryginalny herb

Normalny przepływ: home -> #details-b (alias #details), domyślnie Uczestnicy.
A/B tylko archiwalnie przez Narzędzia demo. Narzędzia zawierają też motyw i suwak.
Nagłówek używa oryginalnego assets/branding/slm-crest-espana.svg. Ten dokładny plik
jest jawnie emitowany do dist-demo; verifier wymaga jego obecności i zgodności bajtów.
Output12 plików, bez ogólnego kopiowania public/. Dodano tylko MatchTabs do listy
modułów UI, bez App/Auth/Edge. Root/Build/Output/env/CSP bez zmian.
Dwie iteracje Chromium i finalne390x844 w docs/ui/beta23-*.png; testy w STATUS.md.
Automatyczny podgląd po zwykłym push; ręcznego wdrożenia nie uruchamiano.
Próba weryfikacji deploymentów API GitHub: Forbidden, brak potwierdzonego linku.

## UI Beta 2.2 — porównanie

Automatyczny podgląd po push jest skonfigurowany zgodnie z informacją użytkownika.
Nie uruchamiać ręcznych wdrożeń. Bieżący build nie zmienia Root/Build/Output/env/CSP.
Punkt wejścia nadal tylko demo; DemoMatchDetails to dodatkowy jawnie dozwolony moduł UI.
Fragmenty: /#compare, /#details-a, /#details-b. Wyłącznie statyczny index.html i lokalne
fragmenty, bez API lub nowych funkcji serwerowych. Nie wybrano wariantu docelowego.
84/84 Vitest, oba buildy i Chromium widoków320/390/768 OK, izolacja11 plików OK.
Sukces konkretnego wdrożenia nie był potwierdzany; sam push nie jest dowodem publikacji.

## UI Beta 2.1 — stan publikacji

Wspólne szczegóły meczu i trzy zakładki. Demo nie wywołuje API, nie ma prawdziwych
rozliczeń. Nowy MatchSections jest pojedynczym dozwolonym modułem UI; CSP, env,
statyczny output i granica separacji pozostają bez zmian. Wyniki w STATUS.md.
Nie wykonano ręcznej publikacji. Automatyczna publikacja po push nie została
potwierdzona: odczyt deploymentów GitHub API zwraca Forbidden. Brak zweryfikowanego
URL Vercel; dawne wpisy NIE OPUBLIKOWANO opisują stan poprzednich sesji.

# Samodzielna demonstracja UI España — przygotowanie Vercel

Gałąź feat/ui-beta. Wcześniejszy etap przygotowano bez publikacji.
Aktualnie użytkownik potwierdził automatyczny podgląd tej gałęzi po push (UI Beta 2.2).

| Ustawienie Vercel | Wartość |
|---|---|
| Root Directory | `app` |
| Framework Preset | `Other` |
| Build Command | `npm run build:demo` |
| Output Directory | `dist-demo` |
| Install Command | `npm ci --ignore-scripts --no-audit --no-fund` |
| Node.js | `22.x`, minimum 22.12 |
| Environment Variables | Żadne |

Konfiguracja `app/vercel.json` dotyczy osobnego projektu demonstracyjnego Vercel.
Nie podłączać go do projektu produkcyjnej aplikacji, nie kopiować env z innych
projektów, nie dodawać kluczy Supabase/Firebase, kont ani tokenów. Wybierać źródłową
gałąź feat/ui-beta; nie scalać jej w celu publikacji. Nie korzystać z `npm run build`
i `dist`: to pełna aplikacja. Istniejące vite.config.ts, build i Capacitor niezmienione.
Nie wykonano operacji na koncie Vercel ani zdalnej bazie.

## Granica separacji

- `demo/index.html` i `demo/main.tsx` renderują wyłącznie komponent Demo w IonApp.
  Brak App.tsx, routera aplikacji, SessionManager, API, administratora i FCM.
- `vite.demo.config.ts`: osobny root/output; allowlista rzeczywistych modułów
  źródłowych generowanego bundle. Niedozwolony kod aplikacji przerywa build.
  Wspólne komponenty UI, tokeny oraz Accounts.css są tylko warstwą wizualną.
  Importy `type Match` z modelu wydarzeń są usuwane przez TypeScript.
- `publicDir: false`: żadnego automatycznego kopiowania publicznych plików pełnej
  aplikacji. Dodatkowe zasoby to jawnie dołączone stadium.svg (fallback) i match-evening.jpg
  (zdjęcie użytkownika, 73 KB). JPG jest dopuszczony tylko pod konkretną ścieżką,
  z kontrolą nagłówka JPEG i rozmiaru poniżej 100 KB; bez ogólnego kopiowania public/.
  Brak source map, service workera, plików Edge czy funkcji serverless.
- `envDir: false`, `envPrefix: []`: pliki env i zmienne VITE nie wchodzą do demo.
  Budowanie z kontrolnymi zmiennymi VITE potwierdziło brak ich markerów w output.
- Automatyczna kontrola wszystkich plików `dist-demo` kończy build błędem, jeśli
  wykryje nieoczekiwany typ pliku, oznaczenia Auth/Supabase/Edge lub markery sekretów.
- Vercel serwuje wyłącznie statyczne dist-demo. Brak rewrites do pełnej aplikacji;
  nieznane ścieżki nie odsłonią logowania ani innych źródeł repozytorium.
- CSP: connect-src none, form-action none, skrypty self, brak ramek/obiektów;
  style unsafe-inline są wymagane przez Ionic i dynamiczny pasek.
  Dane fikcyjne; jedyny zapis w przeglądarce to lokalna preferencja wyglądu.

Separacja dotyczy gotowego artefaktu, a nie tylko ukrywania routingu. Repozytorium
nadal przechowuje źródła właściwej aplikacji, ale nie ma ich w output demo.
Skan znanych markerów nie zastępuje kontroli modułów i CSP; użyto wszystkich trzech.

## Lokalna weryfikacja

Z `app`: `npm ci --ignore-scripts`, `npm run lint`, `npm run build:demo`,
`npm run test.unit -- --run`, `npm run build` (ostatnie tylko regresja pełnej aplikacji).
`build:demo` sprawdza także TypeScript punktu demo przez tsconfig.demo.json.
`npm run preview:demo` uruchamia wyłącznie statyczne demo na 127.0.0.1:5175 z tymi
samymi nagłówkami CSP co konfiguracja Vercel. Nie jest publicznym podglądem.

Smoke Chromium opisany w UI_BETA.md: ustawić SLM_UI_URL=http://127.0.0.1:5175/
i uruchomić `node scripts/test-ui-beta-browser.mjs`. SLM_UI_ARTIFACTS to opcjonalny
lokalny katalog zrzutów, nie zmienna Vercel. Kontroluje układ, live system theme,
suwak 0/10/15, brak wywołań zewnętrznych i naruszeń CSP. Chromium/CDP tylko lokalnie.
Cypress w środowisku z Xvfb: z app `npx cypress run --spec cypress/e2e/ui-beta.cy.ts
--config baseUrl=http://127.0.0.1:5175 --env standaloneDemo=true --browser electron`
(jedno polecenie). Ten zestaw nie testuje Supabase.

Wykonane: lint i TypeScript OK, oba buildy OK, Vitest 81/81 w 14 plikach,
11 plików statycznego demo przeszło kontrolę. Chromium 320/390/768, trzy tryby,
suwak i izolacja sieci OK. CSP odczytano także z odpowiedzi HTTP. Ostrzeżenia
rozmiaru chunków Ionic pozostają. Cypress NIE WYKONANO — brak Xvfb; Android/iOS
NIE WYKONANO. Zrzuty: [Dark](ui/demo-dark.png), [Light](ui/demo-light.png).

Po osobno autoryzowanej publikacji sprawdzić na faktycznej domenie Vercel: nagłówki,
brak zewnętrznego ruchu, tryby i suwak, odpowiedzi 404 dla plików źródłowych i brak
logowania/administracji. Tego etapu nie wykonano. Backend i migracje bez zmian;
historyczne braki weryfikacji bazy, Dockera, FIFO i RLS nadal obowiązują.

Beta 2: bieżące podglądy [Dark](ui/beta2-dark.png) i [Light](ui/beta2-light.png),
wspólne komponenty i poprawione utrzymywanie subskrypcji Auto. Izolacja modułów,
CSP i wyłączenie env niezmienione. Wyniki i brak weryfikacji Androida w STATUS.md.

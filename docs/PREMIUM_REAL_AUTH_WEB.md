# Premium 3.18 — rzeczywiste konta i build web

2026-11-04. Baza: `main` / `1b6ee83356d53b7b34193af88802067dc9b2fede`.
Gałąź: `feat/premium-real-auth-web`. **Przygotowanie do wdrożenia, bez wdrożenia.**

## Implementacja

Istniejący `app/b1/main.tsx` nadal uruchamia `B1App`, rzeczywiste adaptery grup,
wydarzeń, finansów i profilu. `AccountScreens` pozostał wspólnym komponentem;
nie powstała nowa aplikacja, kopia ekranów ani klient Supabase Auth.
Domyślny LIVE, Android i izolowany `build:demo` pozostają osobnymi dotychczasowymi celami.

`b1Port` używa istniejącego `SessionManager`. Dodana metoda `emailAction` dopuszcza
wyłącznie pięć anonimowych operacji i ich potwierdzenia. Nie przyjmuje sesji z URL
ani z odpowiedzi operacji e-mail. Tylko dotychczasowe logowanie hasłem i zweryfikowany
refresh mogą przełączyć aplikację w stan `ready`. Refresh, magazyn natywny,
UUID, role, blokada hasła tymczasowego i kontrola dostępu do danych pozostają zachowane.

| Operacja `accounts` | Wejście | Wynik bez tokenów |
|---|---|---|
| `signup` | e-mail, hasło, profil, `accept_policies: true` | `verification_required: true` |
| `resend_verification` | e-mail | neutralne `verification_required: true` |
| `recover_email` | e-mail | neutralne `verification_required: true` |
| `verify_email` — nowa | `token_hash` | `email_verified: true` |
| `recover_password` — nowa | `token_hash`, `new_password` | `password_changed: true` |

Rejestracja nie loguje, nie dodaje do grupy i nie tworzy administratora. Konta legacy
nadal używają loginu/telefonu; nowe konta logują się potwierdzonym e-mailem. Nie
aktywowano eksperymentalnego modelu Auth18. Pseudonim nowego konta nie staje się
technicznym aliasem logowania. Po potwierdzeniu wymagane jest normalne logowanie.

Formularz ma istniejące blokady wielokrotnego wysłania i walidację. Port dodatkowo
serializuje operacje e-mail. Formularze czyszczą hasła po operacji. Anulowanie
recovery usuwa dowód z portu. Stare konto jest ukrywane i jego magazyn czyszczony
przed obsługą linku; spóźniona odpowiedź nie przywraca starej sesji.

## Linki i odzyskiwanie

Jedyny akceptowany format:

```text
APP_ORIGIN/auth/callback#type=signup&token_hash=JEDNORAZOWY_DOWOD
APP_ORIGIN/auth/callback#type=recovery&token_hash=JEDNORAZOWY_DOWOD
```

`APP_ORIGIN` oznacza **zweryfikowany adres HTTPS istniejącego projektu**. Nazwa
projektu Vercel nie jest dowodem konkretnej domeny. Nie wpisano wymyślonego adresu.
Dowód znajduje się we fragmencie, więc przeglądarka nie wysyła go w żądaniu HTTP.
Przed renderem i operacją sieciową `replaceState` usuwa fragment oraz query.
Query z tokenami, implicit-flow JWT, kod PKCE, dodatkowe parametry/redirecty,
nieznany cel oraz błędy linku są odrzucane i czyszczone. Nie ma open redirect.
Dowód pozostaje tylko w RAM do próby użycia/anulowania, bez localStorage/logów.

Serwer wywołuje GoTrue `/verify` z ustalonym typem. GoTrue odpowiada za ważność,
jednorazowość i powiązanie z użytkownikiem. Podpis JWT sprawdza istniejący `/user`.
`user_id`, rola i wersja podane przez klienta nie sterują operacją.

Recovery zachowuje dotychczasowy gate SQL: odczyt wersji → `accept_session` →
`begin(password)` → GoTrue aktualizacja hasła w zweryfikowanej sesji recovery →
`finish` → odwołanie sesji pomocniczej. Browser dostaje wyłącznie potwierdzenie i
wraca do logowania. Zwykła zmiana hasła nadal wymaga obecnego hasła.
Aktualny kod GoTrue rozróżnia sesję recovery w sprawdzeniu
`UpdatePasswordRequireCurrentPassword`; nie wyłączamy tej ochrony.

Nieaktywne konto, trwająca operacja i konflikt wersji blokują reset. Jednoznaczna
odmowa Auth może zwolnić tylko własną operację poprzez nowy helper; wersja nie
jest cofana i stare sesje nie wracają. Timeout/5xx/niepewny `finish` pozostawia
dotychczasową blokadę `operation_pending`. Nie wykonujemy automatycznego retry
zużytego dowodu. Taki przypadek wymaga sprawdzenia/naprawy administracyjnej zgodnie
z istniejącym procesem odzyskiwania operacji, nie ponownego otwierania uprawnień.

## Migracja przygotowana, niewykonana

`app/supabase/migrations/20261104090000_accounts_email_ui.sql` — **nr45**:

- rozszerza `slm_email_identity` o inicjalizację pseudonimu, opcjonalnego nazwiska,
  numeru i kontaktu z walidowanych metadanych rejestracji;
- zapisuje te dane tylko przy tworzeniu rekordu, bez nadpisywania kolejnych edycji;
- metadane nigdy nie nadają ról, członkostwa, zgód grupowych ani sesji;
- nie zgaduje imienia z pełnego nazwiska; tryb wyświetlania pozostaje `nickname`;
- kolizja opcjonalnego telefonu nie przejmuje cudzego numeru i nie blokuje konta
  e-mail — kontakt pozostaje pusty, można go później uzupełnić istniejącą operacją;
- dodaje `slm_account_email_recovery_abort`, dostępny tylko dla `service_role`,
  z kontrolą UUID operacji, wersji, aktywności i żywej sesji;
- nie dodaje tabel, nie rozszerza RLS/grantów klienta ani finansów.

Wszystkie poprzednie **44 migracje pozostały niezmienione**. Nie wykonano żadnej
migracji, również lokalnej. Stan Cloud 44/44 i accounts v7 pochodzi od właściciela;
nie był w tym zadaniu odczytywany. Nowe źródła wymagają osobnego wdrożenia nr45
oraz nowej wersji istniejącego `accounts` przed publikacją frontendu.

## Poczta bez wyłączenia ochrony legacy

Obecny PG Send Email hook `slm_account_block_email` blokuje całą pocztę. Samo jego
wyłączenie umożliwiłoby nieuzgodnione zmiany technicznych adresów. Zwrócenie `{}`
przez PG hook też nie wysyła wiadomości — hook zastępuje wysyłkę dostawcy.

Dlatego istniejący `accounts` obsługuje nową ścieżkę **`?hook=email`**:

- podpis Standard Webhooks HMAC-SHA256 obejmuje ID, timestamp i surowy payload;
  okno czasu wynosi 5 minut;
- błędny podpis oraz żądanie przeglądarkowe nie uruchamiają DB ani SMTP;
- dozwolone są tylko `signup` i `recovery` kont e-mail;
- alias legacy, domena `slm.invalid`, `email_change`, magic link, invite,
  reauthentication i powiadomienia pozostają odrzucone;
- adres callbacku pochodzi wyłącznie z konfiguracji serwera, nie z webhooka/klienta;
- realny transport używa SMTP **implicit TLS na465** z weryfikacją certyfikatu;
  brak plaintext/STARTTLS/fallback i brak nowych zależności;
- sukces jest zwracany dopiero po przyjęciu DATA przez SMTP; nie oznacza to
  jeszcze dostarczenia do skrzynki. Odpowiedzi SMTP i dane uwierzytelniające nie
  są logowane ani zwracane klientowi.

Wybrany istniejący dostawca musi obsługiwać TLS465 i AUTH PLAIN oraz uzgodniony
bezpłatny limit. Nie wybrano ani nie utworzono usługi SMTP. Porty25/587 i inne
mechanizmy nie są obsługiwane tym transportem. Brak zgodnego dostawcy jest blokadą,
nie powodem obniżenia zabezpieczeń. Ponowienie webhooka może ponowić wiadomość
z tym samym Message-ID i jednorazowym dowodem; nie tworzy nowej sesji ani konta.

## Dokładna konfiguracja do wykonania osobno

Nie wykonano poniższych operacji i nie wymagano tokenów Vercel/Supabase. Przed aktywacją trzeba potwierdzić dostępność HTTP hooka oraz limitów Edge/SMTP na uzgodnionym bezpłatnym planie; brak dostępności jest blokadą, nie zgodą na płatny plan.

### Istniejący projekt Vercel `slm-ui-demo`

| Ustawienie | Wartość |
|---|---|
| Root Directory | `app` |
| Framework | Other (`framework: null`) |
| Install Command | `npm ci --ignore-scripts --no-audit --no-fund` |
| Build Command | `npm run build:premium-web` |
| Output Directory | `dist-premium-web` |
| Node | 24 — faktycznie sprawdzony w tym środowisku |
| `VITE_SLM_FUNCTION_URL` | opcjonalne, tylko `https://hjtcyybkxebvdropchac.supabase.co/functions/v1/accounts` |
| `VITE_SLM_TERMS_URL` | rzeczywisty zatwierdzony publiczny adres HTTPS regulaminu |
| `VITE_SLM_PRIVACY_URL` | rzeczywisty zatwierdzony publiczny adres HTTPS polityki prywatności |

Brak dokumentów nie zatrzymuje kompilacji, ale **blokuje rejestrację w UI**.
Nie dostarczono zastępczych dokumentów ani fikcyjnej zgody. Zmiana wartości VITE
wymaga nowego builda. Żaden `service_role`, klucz SMTP, hook secret ani token
Management API nie należy do VITE ani frontendu. Anon key nie jest potrzebny
frontendowi korzystającemu z istniejącej funkcji `accounts`.

`app/vercel.json` zawiera SPA rewrite także dla `/auth/callback`, no-store po stronie
API, no-referrer, nosniff i CSP z dokładnym hostem Supabase. Script wyłącznie self,
bez unsafe-eval; style inline zachowane dla Ionic; obrazy self/data/blob oraz
ten sam projekt; frame-ancestors none. Git auto-deployment nadal wyłączony.
Build używa istniejącego entry Premium z publiczną allowlistą trzech zmiennych,
bez dziedziczenia `.env`, localhost, serverowych sekretów i sourcemap. Ostrzeżenie
Vite o dużym wspólnym chunku pozostaje, bez zmian architektury UI.

### Istniejący `accounts` — konfiguracja wyłącznie serwerowa

| Zmienna | Wartość/źródło |
|---|---|
| `ACCOUNTS_ALLOWED_ORIGINS` | zachowana istniejąca uzgodniona lista plus dokładny `APP_ORIGIN`, bez wildcardów; najpierw odczytać obecną wartość |
| `ACCOUNTS_EMAIL_REDIRECT_URL` | dokładnie `APP_ORIGIN/auth/callback`, HTTPS, bez query/fragmentu, origin na powyższej liście |
| `ACCOUNTS_EMAIL_HOOK_SECRET` | sekret Standard Webhooks wygenerowany dla Send Email hook, format `v1,whsec_…`, tylko backend |
| `ACCOUNTS_SMTP_HOST` | rzeczywisty host zatwierdzonego SMTP, TLS465 |
| `ACCOUNTS_SMTP_USER` | użytkownik istniejącego SMTP |
| `ACCOUNTS_SMTP_PASSWORD` | sekret SMTP, tylko backend |
| `ACCOUNTS_SMTP_FROM` | zatwierdzony adres nadawcy u tego dostawcy |
| `SLM_EMAIL_SIGNUP_ENABLED` | `true` dopiero po przygotowaniu i sprawdzeniu całej ścieżki |

Istniejące SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY pozostają po stronie Supabase;
nie kopiować ich do Vercel. Istniejące `verify_jwt=false` dla gateway accounts jest
zachowane: login nie ma jeszcze JWT, operacje danych sprawdzają własny Auth+SQL,
a webhook wymaga niezależnego podpisu. Nie wyłączamy weryfikacji wewnątrz handlera.

### Supabase Auth — do odczytu i kontrolowanej zmiany przez właściciela

1. Ustalić faktyczny `APP_ORIGIN`. Site URL = `APP_ORIGIN`, dozwolony redirect =
   dokładny `APP_ORIGIN/auth/callback`. Bez wildcardów i zgadywania domen.
2. Samodzielna rejestracja e-mail włączona (`disable_signup=false`,
   `external_email_enabled=true`), Confirm email włączone (`mailer_autoconfirm=false`).
3. Zachować minimum8, wymaganie obecnego hasła przy zwykłej zmianie hasła,
   secure email change, wyłączone phone/anonymous/manual linking oraz istniejące
   limity i ochronę przed nadużyciami. Nie uruchamiać historycznych skryptów,
   które przywracają legacy `disable_signup=true` i blokadę całej poczty.
4. Po wdrożeniu i skonfigurowaniu nowego accounts zastąpić Send Email PG hook
   **podpisanym HTTP hookiem**:
   `https://hjtcyybkxebvdropchac.supabase.co/functions/v1/accounts?hook=email`.
   Ten sam wygenerowany sekret musi być w konfiguracji hooka i Edge.
   **Nie wyłączać hooka globalnie.** Send SMS PG blocker pozostaje bez zmian.
5. W tej ścieżce SMTP obsługuje podpisany hook w Edge, nie wbudowane szablony/
   Custom SMTP Auth. Wiadomości i fragmentowe linki buduje `emailHook.ts`.
   Samo ustawienie Custom SMTP w panelu nie uruchamia tej ścieżki.
6. Dopiero wtedy aktywować flagę e-mail, wykonać kontrolowaną próbę rzeczywistej
   wiadomości, zweryfikować dostarczenie, wygaśnięcie i odmowę email_change/legacy.

To opis wymaganej konfiguracji, nie potwierdzenie obecnych wartości Cloud.
W razie wycofania najpierw wyłączyć flagę e-mail i przywrócić dotychczasowy blokujący
PG hook; nie usuwać danych ani nie cofać wersji sesji. Nie przygotowano destrukcyjnego
down/reset ani automatycznego deployu.

## Testy i blokady

- PASS: TypeScript frontend i strict Edge, pełny ESLint.
- PASS: pełny Vitest **476/476, 68 plików**; 395 dotychczasowych testów zachowanych,
  test oczekujący braku integracji zastąpiony testem nowych bezpiecznych ograniczeń.
- PASS: 3 testy konfiguracji produkcyjnego builda; build Premium web, LIVE i demo.
- PASS: izolacja builda demo — 16 plików bez Auth/Edge/Supabase.
- PASS: rzeczywisty render Chromium 320/390/768, formularze i wszystkie operacje
  e-mail przez **kontrolowany transport**, błędy logowania/linku/sieci, brak
  poziomego scrolla, brak nawigacji przed loginem i brak dowodów w URL/storage;
  12 kombinacji wyboru palety/trybu na ekranie kont.
- PASS: kontrola bundle — brak adresów HTTP/WS localhost/127.0.0.1, implementacji
  SMTP, nazw sekretów hooka/SMTP i sourcemap; tylko właściwy endpoint HTTPS.
- PASS: parser PostgreSQL/PLpgSQL (`pglast7.22`) nowej migracji — 8 instrukcji;
  jest to sprawdzenie składni bez uruchomienia SQL, nie test RLS ani transakcji.
- **FAIL / wymaga przeglądu przypięć**: aktywne strażniki źródeł opisane poniżej.
- **NOT RUN**: Cypress — uruchomienie próbowano, brak binarium16.1.1 w środowisku.
- **NOT RUN**: wykonanie migracji45, SQL/RLS nowego helpera, rzeczywisty GoTrue,
  podpisany webhook uruchomiony przez Supabase, TLS/SMTP i dostarczenie wiadomości,
  przeglądarka z rzeczywistym backendem, fizyczny telefon i hosted CI.

Mocki GoTrue/RPC i SMTP nie są testami Supabase Cloud ani prawdziwej poczty.
Niezbędny odbiór przed publikacją: izolowany backend z45, równoległy reset/
zmiana hasła/odwołanie sesji, potwierdzenie prawidłowego działania recovery w
faktycznej wersji GoTrue, test ACL helpera i zachowania danych legacy, podpisów
hooka i odmowy email_change. Następnie realna poczta oraz próba na telefonie.

## Zamrożone UI i przegląd kontraktów

Nie zmieniono CSS, grafik, geometrii kart Ultimate, BottomNav, meczów, składów,
finansów ani grup. **54 z55 chronionych plików są identyczne z bazą**.
Jedyny zmieniony plik manifestu to `AccountScreens.tsx`: podłączenie formattera
błędów, prawdziwe linki do dokumentów zamiast demonstracyjnej zgody, blokada bez
dokumentów i prawdziwy powrót do logowania po weryfikacji. Te same klasy, pola,
przyciski i układ pozostają. Nie zachowujemy fałszywego tekstu „demo” przy realnym
wysyłaniu danych.

Aktywne hashe, manifest55, CI i strażniki **nie zostały zmienione**. Dlatego:

- `verify:consolidation` odrzuca nowy `SessionManager`, a następnie wymagałby
  jawnego przyjęcia pozostałego Auth/backendu/builda i migracji45;
- `verify-frozen-ui` odrzuca funkcjonalną zmianę `AccountScreens`;
- `test:premium-policy` nie uzyskuje zatwierdzonego baseline, więc nie jest PASS.

`docs/review/premium-real-auth-web-manifest.json` wskazuje dokładne stare/nowe
SHA256 i zakres do niezależnej akceptacji. Nie jest aktywnym wyjątkiem. Zgodnie z
AGENTS.md właściciel musi osobno przejrzeć kontrakty; nie aktualizowano ich po to,
żeby uzyskać zielony wynik. **PR pozostaje kandydatem do review, nie zgodą na merge
ani deklaracją gotowości produkcyjnej.**

## Zrzuty

To rzeczywisty render React/Ionic istniejącego Premium. Dane i odpowiedzi HTTP są
kontrolowaną fikcyjną fixture, nie kontem w Supabase. Tymczasowego testowego builda
z adresem `legal.example.invalid` nie publikujemy; kanoniczny build nie zawiera tych URL.

- [Logowanie Dark](ui/auth-web/login-dark.png)
- [Logowanie Light](ui/auth-web/login-light.png)
- [Rejestracja](ui/auth-web/register.png)
- [Potwierdzony e-mail](ui/auth-web/verified.png)
- [Odzyskiwanie](ui/auth-web/forgot.png)
- [Nowe hasło](ui/auth-web/recovery.png)

## Źródła kontraktu Auth

Istniejące migracje i `AUTH_MODULE.md`, `AUTH_MODEL_SLM_1_0.md`, kod GoTrue
`internal/api/verify.go`, `user.go`, `mail.go` i `internal/models/factor.go` z oficjalnego
`https://github.com/supabase/auth` (odczyt2026-11-04). Kod pokazuje jednorazowe
`token_hash`, wyjątek recovery od current-password i zastąpienie wysyłki przez hook.
Nie odczytano ani nie zmieniono konfiguracji zdalnego projektu.

Odczytana referencja GoTrue: `d7955e9eb54003c4abbd7808e774c810d5d3e6cc`. W jej modelu `OTP`, `MagicLink` i `Recovery` spełniają `IsRecovery`; nasza operacja przyjmuje wyłącznie dowód zweryfikowany jako `type: recovery`. To weryfikacja źródeł, nie test zdalnego GoTrue.

## Publikacja Git — bez deployu

Implementacja: `ee72959755f4db926c83d2566dc76b5b5aa8c940`, wypchnięta zwykłym push
na `feat/premium-real-auth-web`. Dodatkowe sprawdzenie TypeScript testów backendu
wykryło dwa zbyt wąskie typy mocków; poprawiono wyłącznie ich typowanie i ponowiono
właściwe testy. Końcowy commit raportowy nie zmienia działania aplikacji.

Próba `gh pr create --draft --base main --head feat/premium-real-auth-web` została
odrzucona przez `https://api.github.com/graphql` komunikatem **Forbidden**.
Nie uzyskano numeru PR. Dostęp Git nie oznacza dostępnego GitHub API.
Nie wymagano nowych poświadczeń. Gotowy opis: [PREMIUM_REAL_AUTH_WEB_PR.md](review/PREMIUM_REAL_AUTH_WEB_PR.md).

[Porównanie i formularz utworzenia PR do main](https://github.com/psuda87/sunday-league-mates/compare/main...feat/premium-real-auth-web?expand=1).
Wymagane review przypięć oraz realnego backendu pozostaje blokadą integracji;
nie wykonano merge ani wdrożenia.

## Kontynuacja z niezmienionego main — 2026-11-04

Ponowny fetch potwierdził ten sam main1b6ee83 i czystą gałąź implementacyjną d5a52e3.
Nie powielano gałęzi ani dotychczasowej integracji. Dopracowano:

- instrukcję po potwierdzeniu: logowanie adresem e-mail, bez zmiany pól lub styli;
- odmowę lokalnego callbacku nawet wtedy, gdy localhost jest dopuszczony jako
  origin istniejącej aplikacji natywnej;
- wspólny limit4 sekund dla całego HTTP Send Email hooka (body/podpis/aliasy/SMTP).
  W oficjalnym GoTrue d7955e9 `internal/hooks/hookshttp/hookshttp.go` domyślny
  HTTP hook timeout wynosi5 sekund. Dawny limit SMTP12 sekund był zbyt długi.
  Anulowanie żądania/budżetu przerywa odczyt aliasów i zamyka SMTP; po wygaśnięciu
  nie otwieramy nowego połączenia ani nie rozpoczynamy kolejnej komendy.

Nowe testy obejmują5 wariantów lokalnego callbacku, deadline odczytu aliasów,
przekazanie tego samego sygnału do SMTP i odmowę rozpoczęcia SMTP po anulowaniu.
Ponownie PASS: TS frontend/strict Edge i testów backendu, lint,476 Vitest/68 plików,
3 testy konfiguracji, build Premium i demo/izolacja16, Chromium320/390/768 i12
trybów/palet. Zrzuty logowania Dark i Light są identyczne bajtowo z d5a52e3;
zmieniła się wyłącznie instrukcja na zrzucie potwierdzenia.

Aktualne strażniki nadal FAIL;71 testów policy nie uzyskuje zatwierdzonego baseline.
Nie aktualizowano aktywnych pinów, CI ani manifestu55. Cytat z AGENTS.md:
„Zmiana strażników i CI wymaga osobnego przeglądu właściciela.” Nowy manifest
pozostaje wyłącznie propozycją do tego przeglądu.

GitHub REST odczytu repozytorium nadal zwraca Forbidden. Pobranie Cypress z
`download.cypress.io` blokuje proxy403; CLI nie znajduje binarium. Cypress oraz
realny GoTrue/SQL/RLS/SMTP/telefon/Cloud pozostają NOT RUN. Nie wykonano wdrożenia,
zmian Cloud ani migracji. Konfiguracja do osobnego wdrożenia jest taka sama jak wyżej.

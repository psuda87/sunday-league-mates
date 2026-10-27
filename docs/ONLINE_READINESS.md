# SLM — przygotowanie kontrolowanego startu online

Stan: 2026-10-27, Europe/Warsaw. **NO-GO dla uruchomienia online.** Przygotowano i sprawdzono lokalny kod; nie utworzono kont dostawców, nie opublikowano hostingu, nie zmieniono DNS ani Supabase Cloud. Nowy model pozostaje wyłączony w używanej aplikacji. Punkt wyjścia: PR18 `5de91d3`, main `134c52b`; fundament Auth po zmianach: `845d35e`.

## Kryteria GO / blokery

| Obszar | Stan i warunek GO | Odpowiedzialność |
|---|---|---|
| Kod Auth, SMTP, proof/recovery | Lokalne testy wykonane; wspólne bramkowanie modelu, poczty i ochrony. Brak częściowej aktywacji | PR18 / review |
| Zaufane wejście i anti-bot | Podpisana bramka, Turnstile, przydział SQL gotowe; prawdziwy widget i bramka Cloudflare nieodebrane | Konfiguracja dostawcy, niezależny Draft PR infrastruktury |
| Poczta internetowa | Brak konta SMTP, zatwierdzonej domeny nadawcy i dowodu dostarczalności | Właściciel / dostawca |
| HTTPS i callback | Gotowe dwa statyczne dokumenty, allowlisty i nagłówki; brak opublikowanych originów | Właściciel, osobna zgoda na publikację/DNS |
| Nowy pusty Cloud | Plan i lokalne odtworzenie gotowe; nie sprawdzano prawdziwego Cloud | Osobna zgoda na nowy projekt i każdą operację Cloud |
| Android/PWA | Jawny kandydat i konfiguracja gotowe; bez nowego APK/sync/instalacji | Test POCO, WebView, HTTPS i rzeczywistego widgetu |
| Legal i prywatność | Brak zatwierdzonych dokumentów i wersjonowanego serwerowego dowodu akceptacji | Właściciel; odrębna implementacja po zatwierdzeniu treści |
| Zależności | 6 moderate, w tym 3 runtime; brak high/critical. Audit nadal niezerowy | Kompatybilna poprawka lub jawny odbiór ryzyka ograniczonego pilota |
| Zakres produktu | Kandydat: prawdziwy Auth/profil/grupy, pozostałe Premium nadal jawne demo | Decyzja o pilocie Auth, nie deklaracja pełnej wersji SLM1.0 |
| Operator i konta bez e-maila | Reset administracyjny sprawdzony lokalnie; potrzebny niezależnie zweryfikowany operator | Właściciel; brak obietnicy samodzielnego recovery bez e-maila |

## Rekomendowana bezpłatna poczta

Rekomendacja: **Brevo Free**, według dokumentacji sprawdzonej 27.10.2026: 300 wiadomości/dobę, bez karty i limitu czasu planu. Alternatywa Resend Free: 3000/miesiąc, 100/dobę, jedna domena. Nie zakładano kont ani nie wybierano płatnych dodatków. Free nie zapewnia SLA; kolejka po przekroczeniu limitu może dostarczyć proof już po wygaśnięciu.

Supabase Edge blokuje wychodzące porty 25/587. Przygotowany transport używa **smtp-relay.brevo.com:465, implicit TLS**, weryfikacji certyfikatu i TLS co najmniej 1.2. Konfiguracja w `app/supabase/email.smtp.env.example`, wyłącznie po stronie serwera:

1. Właściciel zakłada Free i potwierdza posiadanie domeny nadawcy. Jeśli nie ma domeny, pozostawić blocker; nie kupować jej automatycznie.
2. Z panelu SMTP przepisać prywatnie dokładny SMTP login i SMTP key; nie używać hasła konta lub klucza API. Host/port/from/callback sprawdza walidator. Nie dodawać sekretów do Git, klienta Vite lub APK.
3. Zastosować dokładne rekordy Brevo code/DKIM/DMARC z panelu, po przeglądzie obecnego DNS. Współdzielony Brevo nie wymaga dodania SPF/MX do uwierzytelnienia domeny nadawcy; SPF return-path należy do infrastruktury dostawcy. Nie wymyślać rekordów SPF ani nie zastępować istniejącego DMARC/SPF. Potwierdzić rzeczywiste alignment i podpisy na odebranej wiadomości.
4. Ustawić dokładny `SLM_EMAIL_CALLBACK_URL=https://<auth-origin>/email-callback.html`, bez parametrów, wildcardów i fragmentu. Wyłączyć śledzenie otwarć/linków, aby nie modyfikować jednorazowych proof.
5. Dopiero po pełnej konfiguracji i osobnej zgodzie na wdrożenie ustawić flagę poczty. Niekompletne ustawienia pozostawiają pocztę niedostępną, nie zatrzymują starych kont. `SLM_EMAIL_LOCAL_TEST` w Cloud zawsze false.

To własny transport wiadomości aliasów/recovery, nie automatyczne przejęcie konfiguracji SMTP z panelu Supabase. Techniczny primary e-mail GoTrue pozostaje wewnętrzny; nowe publiczne adresy aktywują się tylko po scoped proof. Natywne signup/zmiana primary/SMS nie mogą stać się alternatywnym obejściem kontraktu accounts.

### Odbiór prawdziwej dostarczalności — NOT TESTED

- Dwie niezależne skrzynki zewnętrzne: inbox/spam/czas dostawy, SPF/DKIM/DMARC i alignment w nagłówkach, poprawny nadawca. Nie wklejać treści linków, tokenów lub adresów do raportu.
- Dodanie/zmiana adresu, konflikt adresu, resend/cooldown, wygaśnięcie i jednokrotność linku, przerwanie operacji, recovery i odrzucenie starej sesji. Link nie zmienia hosta i nie jest przepisywany przez tracking.
- Identyczna odpowiedź recovery dla istniejącego i nieistniejącego konta, brak wycieku adresu technicznego, bezpieczny komunikat błędu SMTP i kwoty Free. Bez testowego wyłączenia limitów.
- SMTP Mailpit i sandbox Turnstile nie stanowią dowodu dostarczalności lub skuteczności produkcyjnego widgetu.

## Hosting callbacku, widgetu i kandydata

Przygotowano statyczny katalog `app/auth-host`: `email-callback.html` i `signup-challenge.html`. Polecany osobny projekt **Cloudflare Pages Free**, bez Functions, automatycznego deploy i bez zmiany istniejącego Vercel. `_headers`: no-store, no-referrer, nosniff, HSTS, CSP; callback nie może być osadzany, widget może być osadzany tylko przez podane originy. Fragment proof jest usuwany z URL przed renderem. Brak zewnętrznych obrazów/analityki/service workera. Powrót do aplikacji ma stały build-time URL; parametr użytkownika nie ustawia redirectu.

Publiczna, niesekretna konfiguracja: `app/online/auth-host.example.json`. Osobne exact HTTPS originy aplikacji, hosta Auth i API; w produkcji brak localhost/IP, wildcardów, userinfo, ścieżek, dummy keys i brakujących refów. Dopuszczone natywne originy rodziców są jawne. Plik nie przyjmuje obcych kluczy, np. SMTP_PASSWORD. Builder nie czyta `.env`.

Z katalogu `app/`:

```powershell
npm run build:auth-host:example
npm run build:online-candidate:example
node --test scripts/auth-host.node-tests.mjs
```

Przykłady są **nieaktywne i nieprzeznaczone do publikacji**. Po otrzymaniu zatwierdzonej konfiguracji publicznej osobne buildy: `node scripts/build-auth-host.mjs --config <plik.json>` i ten sam argument z `--candidate`. Nie jest to polecenie publikacji. Wynik: `dist-auth-host` albo `dist-online-candidate`, nigdy publiczna demonstracja `dist-demo`. Kandydat ma `containsDemo:true,publishApproved:false` i używa oryginalnego B1App, nie zastępuje domyślnego LIVE.

Docelowe originy app/auth/api właściciel wybiera w swoich kontrolowanych domenach lub subdomenach dostawcy. Najpierw budowa/odbiór, później osobna zgoda na hosting i ewentualny DNS. Nie skonfigurowano domen ani routingów. Supabase redirect allowlista powinna obejmować wyłącznie rzeczywiście potrzebne dokładne callbacki; nie dodawać `*`. Własne proof accounts nie są tokenami GoTrue i nie wolno ich zamieniać na dowolny redirect sesji.

### Bramka i ochrona rejestracji

`app/online/gateway.ts` to mały Worker Free; template ma wszystkie publikacje/aktywację wyłączone, brak account id i routes. Plan Free: 100 tys. requestów/dobę, 10ms CPU/request według aktualnej dokumentacji; rzeczywisty CPU i kwoty wymagają odbioru, to nie gwarancja DDoS.

Worker ufa `request.cf` i nagłówkowi ustawionemu przez własne Cloudflare, ignoruje XFF i podpis klienta. HMAC wiąże IP/czas/body/Authorization z kontem i trafia do accounts. Edge odrzuca direct API bez podpisu w trybie online; nie zgaduje zaufanego nagłówka Supabase. Klucz tylko w secret store obu usług. Inne własne Workery w tej samej strefie należą do granicy zaufania.

Turnstile Free wymaga server Siteverify: hostname/action/request id/czas, bezpośrednie API nie ufa samemu tokenowi. Rejestracja: 5/10min i 20/dobę na pseudonimizowany adres IPv4/podsieć IPv6 /64, transakcyjny przydział i idempotencja capability; nie jeden budżet30 dla całego świata. Osobne limity poczty/owner/ingress. Raw IP nie trafia do tabel; HMAC rotuje dziennie, agregaty7 dni/admissions48h. Nadal możliwy botnet, wyczerpanie kwot dostawcy i wspólne limity NAT. Publiczne testowe klucze nie aktywują konfiguracji online.

### Android/PWA

`SLM_ONLINE_ANDROID=1` wybiera wyłącznie `dist-online-candidate`, wymusza brak mixed content także przy omyłkowym `SLM_LOCAL_ANDROID=1`. `pl.psuda87.slm`, secure vault, wyłączone debug/logowanie mostu bez zmian. Nowy ref ma własne klucze sesji, nie czyta/usuwa starej sesji. Domyślny build nie jest przełączany. Nie wykonano Capacitor sync, kompilacji APK ani instalacji w tym zadaniu.

Potwierdzanie linku odbywa się na HTTPS w przeglądarce; powrót prowadzi do stałej aplikacji i normalnej sesji. Nie przesyłać bearerów przez deep link; App Links wymagają później rzeczywistej domeny/certyfikatu i osobnej konfiguracji. Nie dodano fikcyjnych assetlinks ani callbacków na niezarejestrowanej domenie. Kandydat web działa jako zwykła aplikacja bez nowego service workera/offline cache danych Auth; instalowalna PWA i wznowienie z linku wymagają odbioru.

Na POCO sprawdzić prawdziwy widget w HTTPS iframe: JavaScript/DOM storage/domowy User-Agent, parent origin, CSP, zamykanie okna, utratę sieci, powrót z tła i oba Wstecz. Nie osłabiać ustawień plików/WebView, TLS ani CSP dla pozytywnego testu. Potem signup bez e-maila, dodanie i potwierdzenie adresu, resend/expired/recovery/reset administratora, restart sesji i izolacja starego projektu. **Fizyczny Android i realny widget: NOT TESTED.**

## Dowody lokalne

| Kontrola | Faktycznie wykonany wynik |
|---|---|
| Sam commit Auth `845d35e`, bez infrastruktury | 309 Vitest /52 pliki; TypeScript, cały strict Edge, lint, build main/Premium/demo i source guards PASS |
| Łącznie z infrastrukturą | 312 Vitest /53 pliki; bramka +3 testy; strict/lint i buildy hosta/kandydata PASS |
| Replay / SQL-RLS | 44 migracje, 96 testów SQL-RLS; dodatkowo102 v2,31 legacy,11 historia PASS |
| Pusty projekt / backup-restore | 14 PASS; świeża izolacja przed fixture bez kont/danych, rzeczywisty dump/restore/RLS/ACL |
| Rzeczywisty lokalny Supabase | 49 core +21 dodatkowych Auth HTTP PASS |
| Mailpit / callback | 29 SMTP/HTTP +3 rzeczywiste callbacki Chrome;9 fault/race PASS |
| Chronione API | 29 PASS z realnym Auth/SQL/Storage i jawnym fixture odpowiedzi dostawcy CAPTCHA |
| Signed gateway → mail → browser → Auth | Ponowne29 SMTP/HTTP +3 callbacki PASS przez lokalny transport bramki (CF metadata to fixture) |
| Zewnętrzny Siteverify | 3 PASS z oficjalnymi publicznymi kluczami sandbox; bez prawdziwego widgetu |
| Przeglądarka / statyczne bezpieczeństwo | 18 scenariuszy UI +2 hosta;4 real Chrome CSP;12 testów konfiguracji PASS |
| Zależności / SQL lint | 6 moderate,0 high/critical, audit niezerowy;4 zastane SQL warnings bez nowych błędów |

Pełne granice audytu: [SECURITY_AUDIT.md](SECURITY_AUDIT.md). Plan migracji: [CLOUD_CUTOVER_PLAN.md](CLOUD_CUTOVER_PLAN.md). Testy bezpieczeństwa nie są formalnym dowodem braku podatności; katalogi/testy nie potwierdzają uprawnień w zarządzanym Cloud.

## Decyzje podjęte samodzielnie

| Problem | Wybrane rozwiązanie i uzasadnienie | Konsekwencje |
|---|---|---|
| Niepotwierdzone IP Supabase proxy | Własny podpisany Worker zamiast zgadywania nagłówka | Oddzielny komponent Free, sekret i odbiór; tryb online fail-closed |
| SMTP/porty i koszt | Brevo Free465/TLS, bez rejestracji konta | Właściciel musi zatwierdzić nadawcę i prawdziwą dostarczalność |
| Duży zakres infrastruktury | Oddzielna gałąź i zależny Draft PR do branchu PR18 | Nie miesza review Auth z hostingiem; osobna akceptacja i późniejsze retargetowanie po merge PR18 |
| Niepełny produkt / brak konfiguracji | Jawny kontrolowany kandydat, przykłady disabled | Brak publikacji fikcyjnego pełnego SLM i brak częściowej aktywacji |
| Istniejące sesje/dane | Osobny namespace tokenów oraz nowa lokalna izolacja | Stare bazy/sesje/POCO zachowane; nowy projekt wymaga świeżego logowania |
| Ostrzeżenia SQL i moderate dependencies | Typ WebP i bezpieczne patch updates, bez zmiany finansów/major routera | Cztery ostrzeżenia i sześć moderate nadal jawne; osobny odbiór ryzyka |

## Dokładny następny krok

Właściciel wybiera kontrolowany pilot Auth zamiast pełnego wydania, wskazuje posiadane originy app/auth/api, przygotowuje ręcznie bezpłatny SMTP i Turnstile, zatwierdza legal/retencję/operatora i rozstrzyga ryzyko zależności. Następnie osobno zatwierdza utworzenie/konfigurację **nowego pustego** projektu testowego Cloud i publikację hostingu według cutover. Dopiero po tych odbiorach przygotować APK na POCO; nie korzystać z obecnego Cloud ani nie czyścić starych projektów.

Źródła sprawdzone27.10.2026: [Brevo Free](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), [Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP), [Brevo465](https://help.brevo.com/hc/en-us/articles/10905415650322-Which-SMTP-port-should-I-use-Port-587-465-or-2525), [Resend](https://resend.com/pricing), [Supabase Edge limits](https://supabase.com/docs/guides/functions/limits), [Turnstile Free](https://developers.cloudflare.com/turnstile/plans/), [server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [WebView](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/), [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/), [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [redirects](https://supabase.com/docs/guides/auth/redirect-urls).

Raport chronologiczny: `docs/ODPOWIEDZI_CODEX.txt`.

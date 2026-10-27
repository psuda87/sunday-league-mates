# SLM — nowy pusty Supabase Cloud, plan bez wdrożenia

2026-10-27, Europe/Warsaw. **Plan, nie zgoda na wykonanie. NO-GO do czasu spełnienia ONLINE_READINESS.** W tym zadaniu nie połączono się z Cloud, nie uruchomiono migracji/deploy/DNS, nie resetowano istniejących projektów. Obecne konta i lokalne dane pozostają zachowane.

## 1. Preflight właściciela i operatora

- Potwierdzić nowy ref projektu testowego, inny niż istniejący produkcyjny/historyczny `hjtcyybkxebvdropchac`. Nie wnioskować pustki z nazwy projektu lub nieużywanego UI.
- Zweryfikować wolne miejsce w planie Supabase Free (dwa aktywne projekty według aktualnego cennika). Nie archiwizować/kasować innych projektów i nie włączać płatnego planu dla zwolnienia limitu. Free może pauzować po tygodniu bezczynności; uwzględnić restart i brak SLA.
- Właściciel osobno zatwierdza utworzenie projektu, odczyty preflight, kopię, migracje, konfigurację, Edge, DNS i hosting. Brak automatycznego `db push`, deploy lub skryptu usuwającego dane.
- Ustalić ograniczony pilot, administratora danych/legal, retencję, operatora resetu i odbiór moderate dependencies. Potwierdzić dostęp do kopii i bezpieczny magazyn sekretów. Żadne hasła/service keys/backupy nie trafiają do Git lub klienta.
- Wybrać zamrożone SHA obu PR i manifest sum SHA256 migracji; porównać z review, sprawdzić czyste drzewo. Źródło SQL to wyłącznie `app/supabase/migrations/`, nie `.cache`, lokalne ręczne SQL ani fixture testowe.

## 2. Kopia i sprawdzenie odtwarzania

Przed zmianami zatwierdzone odczyty muszą ustalić zawartość nowego i dotychczasowego projektu. Jeżeli docelowy projekt ma jakiekolwiek konta lub dane biznesowe: **STOP**, bez kasowania i bez automatycznej konwersji w pusty projekt. Istniejący projekt pozostaje osobnym systemem; jego dane nie są importowane w tym etapie.

Free nie zastępuje własnego planu kopii. Przechować szyfrowany, prywatny backup zatwierdzonego zakresu DB/ACL/konfiguracji i osobny eksport obiektów Storage z sumami. Backup DB nie zawiera plików Storage. Odtwarzanie wymaga osobnego świeżego celu i zgodnego zestawu ról, wersji PostgreSQL/rozszerzeń/RLS. Nie odtwarzać całego lokalnego Supabase, systemowych `auth`/`storage` ani kont lokalnych testów w zarządzanym Cloud.

Lokalny dowód:14 kontroli na nowej instancji `slm-online-readiness`, backup pustego stanu i restore do nowej scratch DB z właściwą rolą `supabase_admin`; identyczne liczniki, RLS, brak publicznego EXECUTE, model nieaktywny. To **nie** potwierdza uprawnień restore zarządzanego Cloud. Przed realnym GO operator ma wykonać osobno zatwierdzony drill Cloud na świeżym celu i porównać manifesty, ACL, funkcje, pliki i liczby; nie używać do tego aktualnej bazy aplikacji.

## 3. Schemat i konfiguracja — kolejność po przyszłej zgodzie

1. Sprawdzić wersje PostgreSQL/CLI, rozszerzenia, role dostępne w Cloud, SSL i ograniczenia `auth`/`storage`. Nie zakładać, że lokalny superuser odpowiada roli w Cloud.
2. Potwierdzić zero Auth users, profili, grup, członkostw, meczów, zapisów, gości, ocen, finansów, historii i obiektów Storage. Sprawdzić również brak seed/demo i operacji oczekujących. Raport zawiera tylko liczniki, nigdy dane wierszy/UUID/sekrety.
3. Zaaplikować zatwierdzony manifest **44 migracji w kolejności wersji**, bez zmiany historii i bez seedów. Ostatnia `20261027172523_online_auth_admission.sql` dodaje tylko prywatne przydziały/metryki. Zachowano32 starsze migracje main;44 to35 wcześniejszych +9 nieaktywnych etapów modelu/e-mail/online. Nie stosować SQL wygenerowanego w cache.
4. Po migracjach dopuścić wyłącznie techniczny singleton `slm_account_model_state`, active=false, oraz metadane prywatnego bucketu. Ponownie sprawdzić zero kont/biznesu/historii/storage objects. Nie tworzyć przykładowych użytkowników/grup w docelowym czystym projekcie.
5. Katalogami sprawdzić RLS każdej tabeli SLM, grants anon/authenticated/service_role, SECURITY DEFINER z jawnym search_path, brak niezatwierdzonego PUBLIC/anon EXECUTE, indeksy, prywatny bucket i brak bezpośredniego client write do tabel systemowych. Cztery zastane ostrzeżenia lint ocenić według SECURITY_AUDIT; nowy błąd blokuje dalszy etap.
6. Po osobnej zgodzie wdrożyć tylko funkcje z zamrożonego źródła, z właściwymi uprawnieniami. `accounts`: wymaga dokładnego `SLM_EXPECTED_PROJECT_REF` nowego projektu. Nie zmieniać starego projektu/sekretów. `service_role` tylko serwer. Nie wystawiać bootstrap/admin endpointu.
7. Skonfigurować GoTrue/hooki i ustawienia zgodnie z kontraktem: natywny signup, telefoniczne logowanie/SMS, publiczna zmiana technicznego primary i metadata escalation nie mogą ominąć accounts. Native Auth SMTP nie zastępuje własnej konfiguracji email alias proof. Zweryfikować te zakazy bezpośrednim HTTP, nie samym panelem.
8. Skonfigurować przyszłą bramkę (sekret HMAC po obu stronach), dokładne CORS/originy, Turnstile hostname/action, SMTP465/TLS i callback HTTPS. Statyczne artefakty mają zatwierdzoną publiczną konfigurację i CSP; template/example nie jest wydaniem. DNS/publikacja wymagają odrębnej zgody.
9. Do wspólnego odbioru utrzymać **SQL active=false, SLM_ACCOUNT_MODEL_ENABLED=false, SLM_ACCOUNT_EMAIL_ENABLED=false oraz bramkę wyłączoną**. Nie przełączać obecnego APK lub domyślnego LIVE na niepełny model. Po zgodzie na kontrolowaną aktywację sprawdzić wszystkie capabilities i bezpieczne wyłączenie; brak jednej konfiguracji = NO-GO.

## 4. Rzeczywiste testy w nowym zatwierdzonym celu

Do testów wymagających kont użyć osobnego celu/pilota lub jawnie zaakceptować utratę jego statusu „zero danych”. Nie kasować potem kont, aby udawać pusty odbiór. Właściwy czysty start musi mieć osobno zapisany raport0 przed pierwszą rejestracją.

- Bezpośredni REST/RPC/Edge: brak dostępu anon, izolacja dwóch grup/outsidera, brak podrobienia roli/zapłaty/zaproszenia/rezerwacji/finansów; testy FIFO i Storage. Nieistniejąca operacja ocen ma być odrzucona, nie uznana za gotowy moduł ocen.
- Signup bez e-maila, alias globalnie unikalny, wyścig o nazwę, bez częściowego konta, retry bez podwojenia, zajęty alias/nieprawidłowe hasło bez utraty sesji. Telefon wyłącznie kontaktowy; UUID/pseudonim prywatny Auth i profil zgodne z nowym kontraktem.
- Rzeczywista wiadomość na zewnętrzną skrzynkę, ownership proof/expiry/resend/przerwanie, recovery bez enumeracji, stare sesje odrzucone, operator resetu kont bez adresu. Własność adresu nie jest potwierdzona przez samo przechwycenie Mailpit.
- Brak podpisu bramki i fałszywe XFF/CF headers odrzucone. Server Siteverify odrzuca złe hostname/action/cdata/replay. Limity per sieć i konto oraz współbieżność działają bez testowego wyłączenia ochrony. Prawdziwe Cloudflare ingress, TLS i budżet CPU wymagają dowodu poza fixture.
- Android: zgodny build kandydata, nowy namespace vault, sesja/restart/Wstecz, prawdziwy iframe widget, callback w HTTPS, offline i brak sekretów w logcat. Bez uninstall/clear i bez automatycznej instalacji w tym zadaniu. PWA bez cache proof/tokenów.

## 5. Pierwsza rejestracja i administrator

Przed odblokowaniem publicznej ścieżki ostatni raport liczników ma potwierdzać zero wszystkich danych użytkowników/biznesu i active=false. Dopiero osobna zgoda pozwala wspólnie włączyć komplet konfiguracji i kontrolowaną rejestrację właściciela przez rzeczywisty widget/bramkę. Pierwsze konto jest zwykłym nowym UUID, bez grup, ocen i rozliczeń. Nie przyznawać admina automatycznie pierwszemu użytkownikowi ani przez metadata klienta.

Globalny administrator kont i administrator konkretnej grupy to odrębne role. Nadanie roli operatora wymaga osobno zatwierdzonej, uprzywilejowanej operacji po niezależnym potwierdzeniu osoby i właściwego UUID; nie publikować endpointu bootstrap ani instrukcji z konkretnym prywatnym UUID. Bez operatora resetu nie obiecywać odzyskania konta bez potwierdzonego adresu.

## 6. Rollback bez utraty danych

W razie błędu zamknąć tylko nowy routing/publikację i wyłączyć capabilities/model/pocztę nowego celu zgodnie z uprzednio zatwierdzonym planem. Zachować instancję, logi bez sekretów i dane do analizy. Wrócić do znanego artefaktu starej aplikacji i starego projektu; odrębne klucze tokenów nie usuwają starej sesji, choć jej aktualna ważność nadal musi być potwierdzona serwerem.

Nie wykonywać DROP/reset, automatycznego down-migration ani nadpisania backupem bazy, do której zdążyli dołączyć ludzie. Po utworzeniu pierwszego konta każdy restore/import/repair wymaga zachowania nowych danych i osobnej zgody. Konflikty istniejących pseudonimów/import legacy to inny etap z audytem mapowania; nie są powodem czyszczenia starych kont podczas nowego startu.

## Decyzje podjęte samodzielnie

- **Problem:** lokalny restore nie odwzorowuje uprawnień Cloud. **Wybór:** jawny osobny drill i preflight ról, bez eksportu systemowych schematów do Cloud. **Skutek:** lokalne14 PASS nie zamykają odbioru Cloud.
- **Problem:** żądanie pustego startu i ochrona istniejących kont. **Wybór:** nowy ref bez importu/seedów, zero przed pierwszą rejestracją. **Skutek:** stare projekty pozostają nietknięte, a późniejsze testowe konta nie są automatycznie kasowane.
- **Problem:** pierwszy administrator. **Wybór:** brak publicznego/automatycznego bootstrapu, osobna weryfikacja właściciela i uprzywilejowana zgoda. **Skutek:** bez tej decyzji recovery administracyjne pozostaje operacyjnym blockerem.

Źródła: [Supabase Free](https://supabase.com/pricing), [backups i Storage](https://supabase.com/docs/guides/platform/backups), [kontrola API](https://supabase.com/docs/guides/api/securing-your-api). Kryteria i dowody: [ONLINE_READINESS.md](ONLINE_READINESS.md), [SECURITY_AUDIT.md](SECURITY_AUDIT.md). Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

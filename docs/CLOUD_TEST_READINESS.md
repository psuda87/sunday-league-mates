# Cloud Test — etap 1: audyt i plan bezpiecznego wdrożenia

2026-10-25 21:55 Europe/Warsaw. Baza: `main edd2e924cc077c67ba804ed4acab6d3e159a15b1` (scalony PR #13). Gałąź `feat/cloud-test-preparation`, osobny worktree. Katalog IDE feat/ui-beta pozostaje czysty; lokalne raporty instalacji na gałęzi B3 i historyczne notatki w worktree main pozostawiono bez zmian. Nie wykonano etapu 2.

**Decyzja: NO-GO na wdrożenie teraz. Techniczna ścieżka migracji bez resetu jest potwierdzona lokalnie; wymaga spełnienia bramek i osobnej zgody.** W Cloud wykonano wyłącznie odczyty metadanych, agregatów, konfiguracji Auth/nazw sekretów i bezstanowe OPTIONS CORS. Bez logowania użytkowników, modyfikacji danych, migracji, resetu, ustawień, Storage, deploy lub zmiany planu.

## 1. Stan potwierdzony ponownie

| Obszar | Lokalny Docker / repo | Cloud SLM hjtcyybkxebvdropchac |
|---|---|---|
| Środowisko | działający istniejący sunday-league-mates, PostgreSQL17.11 | ACTIVE_HEALTHY, eu-west-1, PostgreSQL17.11.0.003, organizacja Free |
| Migracje / tabele slm_* | 34 / 46 | 7 / 13 |
| RLS | wszystkie46 włączone | wszystkie13 włączone |
| RPC/funkcje objęte inwentaryzacją |84 funkcje public.slm_*/prywatne,21 triggerów tabel |17 funkcji; brak triggerów tabel w badanym zakresie; oddzielne zarządzane event triggers istnieją |
| Grupy/profil B2.2/B3/finanse scoped | dostępne | brak |
| Zdjęcia | slm-profile-photos prywatny | brak bucketa,0 obiektów Storage |
| Edge accounts | aktualne źródła main | ACTIVE v6, verify_jwt=false, **kod rzeczywiście pobrano i porównano** |
| Dane istniejące Cloud | bez kopiowania rzeczywistych rekordów |2 konta Auth,2 profile/aliasy,1 administrator,1 stare wydarzenie,3 wpisy uczestników,4 rekordy historii |

Agregaty preflight: brak osieroconych aliasów, administrator ma alias, brak kosztów poza sprawdzonym zakresem. To nie jest pełny audyt treści danych ani kopia bezpieczeństwa. Niezwiązany projekt nie był używany.

## 2. Historia migracji, sumy i zależności

Cloud przechowuje `statements`, brak osobnego natywnego pola checksum. Poniżej repo SHA256 źródła UTF-8 po normalizacji CRLF→LF oraz Cloud MD5 dokładnego `array_to_string(statements,E'\n')`. To dwa różne algorytmy/zakresy, nie należy porównywać ich bezpośrednio. Numery14–34 są zależne od wcześniejszych etapów; **wszystkie27 oznaczone BRAK muszą wejść w tej kolejności**, bez pomijania finansów i powiadomień, których używają późniejsze wrappery B3.

| Lp. | Plik w app/supabase/migrations | Historia | Repo SHA256 LF | Cloud MD5 payloadu |
|---|---|---|---|---|
| 1 | `20261013185250_slm_auth_proof_setup.sql` | Cloud | `5472334fe4e837b955da09b616d71fd3c1ccb71838691275f3e380d94fbecaad` | `742f446e509fdccf039faec36e0e6561` |
| 2 | `20261013191910_accounts_module.sql` | Cloud | `f131207e87f054aea380cc7e4d82f17887e9eda65ab7092dff726bc27c1a11ff` | `2f973205455d5080900bda0720e7f573` |
| 3 | `20261013193036_accounts_session_hardening.sql` | Cloud | `1b400c78e445bf7d72982a1aeb6d728485143e44d34252aa2b9236d69709987c` | `cbe122306e0e2a653b79ec5b3be52c4d` |
| 4 | `20261013193844_accounts_recovery_and_permissions.sql` | Cloud | `3b513be45a1096ca7694f36e7b2ece9f0cb8754b1475dc2f674e9b63501817dd` | `8f3fedfec6bf3ffeefd89bc8cb243726` |
| 5 | `20261013212841_events_module.sql` | Cloud | `3c6ccffbf43c7352f63259acc143489fc475e56630bb06634d166bf26c78973c` | `b23cbb9cf3176391027493f207c72feb` |
| 6 | `20261013213423_events_edit_validation.sql` | Cloud | `1e4b058b8903f4224a0e23a73400a31ae48c82a5c379e75e7a7d64bc65b89f6d` | `046229e35b0936929b5cda1cfa0b1aea` |
| 7 | `20261013213917_events_finite_costs.sql` | Cloud | `44c917986260b13a6a26f3fe1d62822dc8590939ba05d731dc560e9dfd7ca838` | `e73439c84465238c56798a330bd01995` |
| 8 | `20261014100000_settlements_ledger.sql` | BRAK w Cloud | `99bcb469ffd451246eeef33010ae673ca01abd3aad9df0f78e608541bc063159` | `—` |
| 9 | `20261014101000_settlements_rpc.sql` | BRAK w Cloud | `0e5f245fd98b0d77375a1664c628fa10d7e2691edb9d17fd0cec42502368a34c` | `—` |
| 10 | `20261014102000_settlements_events_integration.sql` | BRAK w Cloud | `0dc0fbd3752337fda9e30c5e7e52fe186481a67d0cf319c06efb4d0639010e1a` | `—` |
| 11 | `20261014120000_notifications_core.sql` | BRAK w Cloud | `0a4dd659505e4e2184880d3e04c7a09097aace8bbdec2ed94f7aa941d9c40470` | `—` |
| 12 | `20261014121000_notifications_rpc_and_worker.sql` | BRAK w Cloud | `0341398d611209f870c0bd16067dc37e0972eee3d24a325966cdf3307fbe67ac` | `—` |
| 13 | `20261014122000_notifications_events_eligibility.sql` | BRAK w Cloud | `a1c8c84b4a31227d7681514370e718e634c8aa98f688f743da6f413a76145e93` | `—` |
| 14 | `20261019170413_slm_v2_groups.sql` | BRAK w Cloud | `f1fa2f4a398a1c76f09ca0ddfdd222c4453db86e897394e05365d689b85faccc` | `—` |
| 15 | `20261019170806_slm_v2_events_finance.sql` | BRAK w Cloud | `7e21621e4e1e893a54dd652eed6c66267f8f1b6e33035513ced4b45bfeffea3e` | `—` |
| 16 | `20261019171024_slm_v2_rpc.sql` | BRAK w Cloud | `194334b5f6ef92a7cbf396a67e21c4182fd58ad7f72bb19c9218176e0d284c5a` | `—` |
| 17 | `20261019171542_slm_v2_access_hardening.sql` | BRAK w Cloud | `73f1752fc7cf7d73b123972997c3327d3fe93c864ff8a961664191b30f658b56` | `—` |
| 18 | `20261019171627_slm_v2_inbox_alias.sql` | BRAK w Cloud | `95a4ff39b708dbbd1dd19fe47933d6b3e0f9080ed821c886abf4ca62d9af35ba` | `—` |
| 19 | `20261019171834_slm_v2_finance_notifications_guard.sql` | BRAK w Cloud | `ac371c846a2effea72a5553298bd68d7acb20d384196a3a79804af336ab1b288` | `—` |
| 20 | `20261019171938_slm_v2_email_accounts.sql` | BRAK w Cloud | `e23836662134377250004c394a6b5f905ceb13f3bd1ca26d58d418e479ab89c9` | `—` |
| 21 | `20261019172258_slm_v2_warsaw_forms.sql` | BRAK w Cloud | `b78d85e383645cfe8b2264dd0c4a355baf31a970c626a384e2ad0ca813fec7a2` | `—` |
| 22 | `20261019172724_slm_v2_profile_contacts.sql` | BRAK w Cloud | `d712217378c036743d9e938f81acc150e063acb7055f4b532c3d9c928ec8c921` | `—` |
| 23 | `20261019173216_slm_v2_match_notifications.sql` | BRAK w Cloud | `9b103462b2ee501b639da5ae7dd85684a6b5422538d099f800304c59612f6a7c` | `—` |
| 24 | `20261019173620_slm_v2_legacy_scope_guard.sql` | BRAK w Cloud | `ed48686642af302126853051471abe0395ecefcba554ccd3cfe0db036b980239` | `—` |
| 25 | `20261019173839_slm_v2_access_transitions.sql` | BRAK w Cloud | `3d6fd6829bf9e2bbb642590a84c4fb4e1471a6053b9f9495b0e1f569c94ce962` | `—` |
| 26 | `20261019174004_slm_v2_legacy_cost_column.sql` | BRAK w Cloud | `7b666a9a7af1a9d5762bc78382c2886fa1ae09dced35edfd2bf4f8efbdabb9c0` | `—` |
| 27 | `20261019175037_slm_v2_final_scope_hardening.sql` | BRAK w Cloud | `ffb35c12cc187c0a0ac03a24067b6418d6fac2837b9663bffd41ab517dea5e3f` | `—` |
| 28 | `20261019175309_slm_v2_own_event_filter.sql` | BRAK w Cloud | `4abdf21e34e11d15a86bc9d5376f4295c4c049bc0d9b93d517e5e9f3eb3c1abb` | `—` |
| 29 | `20261019175940_slm_v2_legacy_payment_dto.sql` | BRAK w Cloud | `4d061536b3c2868e3faf0aecef3e942767fd89f218c6c893900dcf9cb3b6a082` | `—` |
| 30 | `20261023193156_slm_match_summary_filter.sql` | BRAK w Cloud | `01d858851c603d1f7009b2f9677252dae04999ddc141dc8025871a5736185c1a` | `—` |
| 31 | `20261023200138_profile_photos_private.sql` | BRAK w Cloud | `e3c2799c9560254780c9478629b6d97216f4941b375ce500b18e9202fd360376` | `—` |
| 32 | `20261025160000_slm_v1_profile_b22.sql` | BRAK w Cloud | `ec598912adda44f0027b285ca2f0573e8587779d5717ea8015f37ac1711fcf80` | `—` |
| 33 | `20261025190022_premium_b3_groups_privacy.sql` | BRAK w Cloud | `b2e246b6eabbd57a903e8f51a56dd52de052d2ccc32de773e3fa5ebcb0d10dd6` | `—` |
| 34 | `20261025193229_premium_b3_phone_receipt_privacy.sql` | BRAK w Cloud | `af4beb5551a7b5e4242f93f51ac5a2fbc78d11728c63c996d469b82712551659` | `—` |

Wszystkie7 payloadów różni się tekstowo po normalizacji końców linii/trim: komentarze usunięte lub historycznie źle zakodowane. Diagnostyczne usunięcie komentarzy daje zgodność kodu6/7; nie jest to ogólny parser SQL ani kryptograficzny dowód semantyki.
Jedyna różnica wykonawcza w już zastosowanej historii: `20261013193844` w Cloud bezwarunkowo odbiera EXECUTE `public.rls_auto_enable()`, w repo robi to warunkowo, jeżeli zarządzana funkcja istnieje. Cloud ma tę funkcję, anon nie ma EXECUTE i event trigger ensure_rls ją wywołuje. Efekt tego REVOKE jest zachowany. Nie oznaczać starej migracji jako unapplied i nie odtwarzać jej na istniejących tabelach. Nie używać migration repair do ukrywania różnic.

Trzy historyczne poprawki z main względem d0f9fa9:
- `20261013193844`: opisany warunek zarządzanego helpera; już zastosowana w Cloud starsza forma.
- `20261014100000_settlements_ledger`: kwalifikacja aliasem r kolumn finance_preview, bez zmiany naliczania.
- `20261014122000_notifications_events_eligibility`: usunięcie ponownej próby tworzenia triggera niezmienności, który powstał w14102000.
Dwie ostatnie wersje **nie były zastosowane w Cloud**. Należy wdrażać sprawdzone pliki main; nie kopiować starych wersji z UI-beta.

Łańcuch zależności:
1. Wersje8–13: grosze/settlements/ledger/FIFO i kolejka powiadomień, integracja starej historii. Tworzą nowe dane pochodne; nie naliczają automatycznie zatwierdzonych opłat historycznych.
2. Wersja14: grupy, członkostwo, profile i mapowanie istniejących aliasów. Przy liczbie globalnych administratorów innej niż1 zgłasza legacy_group_owner_decision_required. Teraz count=1, ale właściciel musi zatwierdzić mapowanie do tego administratora; niczego nie zmieniać w roli rzeczywistego admina.
3. Wersje15–29: model scoped, RPC, dostępy, adaptery legacy i DTO. Końcowy stan wymaga całego łańcucha; zatrzymanie w połowie nie jest wspieraną wersją klienta.
4. Wersje30–32: poprawka match_summary, prywatne zdjęcia oraz numer/WebP B2.2. Bucket początkowo JPEG2MiB, finalnie WebP150000B. Nie tworzyć go ręcznie przed migracją30 (INSERT nie jest idempotentny).
5. Wersje33–34: zgoda na nazwisko i domknięcie kanału enumeracji telefonu. Odtwarzalne, ale nie idempotentne całe pliki; zastosować dokładnie raz z historią wersji.

Ryzyka danych: ALTER/nowe ograniczenia oraz backfill groszy, udziałów/FIFO ze starej historii i automatyczne utworzenie grupy mogą zatrzymać się na innych danych niż fixture. Nie znaleziono potrzeby resetu. Brak utraty danych w testach syntetycznych nie zastępuje odtworzenia **aktualnego** backupu Cloud przed zmianą.

## 3. Bezpieczeństwo — stan obecny i docelowy

- **Obecny problem Cloud:** members_read_profiles wymaga tylko ważnej sesji aplikacji (current_session_valid), więc nie ogranicza odczytu pełnych profili do zgód B3/wspólnej grupy. Samo RLS=true nie oznacza właściwej prywatności. Telefon pozostaje w serwerowych aliasach bez client SELECT; nie utożsamiać tego z ujawnieniem telefonów przez tę konkretną politykę. Nie naprawiano Cloud.
- Docelowo polityka shared_profile dopuszcza właściciela, administratora w dozwolonym kontekście oraz członków z udzieloną zgodą. Zgoda per grupa domyślnie false; projekcja RPC zawiera pełne nazwisko tylko właścicielowi/adminowi/po zgodzie. Telefon tylko zaakceptowanym członkom wspólnej grupy, adminowi także w dobrowolnej oczekującej prośbie. Odejście/cofnięcie zgody odbiera dostęp. Stabilny UUID, bez łączenia fikcyjnych profili po nazwie.
- Lokalne tabele: brak client write grants, brak publicznych SLM RPC dostępnych anon/authenticated; mutacje przez Edge/service_role i kontrolę sesji/uprawnień w dispatcherze. Prywatne SECURITY DEFINER udostępnione authenticated to wyłącznie helpery current_session_valid, finance_admin, own_finance_scope, own_group_member, shared_profile; sprawdzają auth.uid/sesję/scope, mają pusty search_path. Pozostałe serwerowe funkcje nie są API klienta.
- RPC i RLS/wielu użytkowników/dwie grupy/role/zgody/revocation/races/opaque telefon zostały ponownie sprawdzone istniejącym zestawem102. Prywatny fingerprint telefonu nie wraca do klienta, brak wyników wyszukiwania telefonu i identyczne pokwitowania/liczniki.
- RLS włączone na46 tabelach. Bezpośredni dostęp do slm_player_profiles i metadanych zdjęć nie jest przyznany klientowi. Publicznych widoków slm_* nie znaleziono; brak nowego ryzyka bypass RLS przez widok.
- Cloud Advisor:1 WARN wyłączona ochrona ujawnionych haseł i9 INFO RLS bez polityk na tabelach serwerowych (odmowa dostępu, nie należy dodawać szerokich polityk). Ochrona ujawnionych haseł wymaga Pro; nie włączać płatnego planu. Zachować istniejące limity/hasła i zaakceptować ograniczenie Free albo osobno zdecydować o innym bezpłatnym środku. [Objaśnienie haseł](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [objaśnienie INFO](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Cztery znane lokalne SQL warnings z poprzednich raportów nie są nowym dowodem błędu B3. Nie ponawiano lint/advisors lokalnie w tym audycie; wykonano realne RPC/RLS i przegląd katalogów. Brak dowodu dostawy FCM/iOS; nie jest wymagany do podstawowego testu przez internet.

## 4. Edge, Auth i Storage

Pobrano wszystkie3 pliki Cloud accounts v6. Wszystkie różnią się od repo (w tym deno.json); sam ACTIVE nie dowodzi zgodności. Handler Cloud ma314 linii, nie zna groups_*, zdjęć ani profilu kont e-mail; repo wymaga dodatkowych modułów accounts/profilePhotos.ts i _shared/phone.ts/profilePhoto.ts/webp.ts. Wdrożyć przyszłościowo pełny graf importów, nie sam handler.ts. SHA256 po normalizacji LF:

| Plik | Cloud v6 | Repo main |
|---|---|---|
| index.ts |83a5fdb022ada8edda69ce40cae5241ec413aa4e80c5a03e040bdad54441ef87|b29adcef44c6787dacc42efecb022e680cdfe027e5df6f6177362d8f5f1b0817|
| handler.ts |29833749de8b46ce404c249bbad9282918b9ccf7e4727495e03d21b1c0a1fc2b|8ffa2faf9282a7ff5f3341ac38ab431579e37287a533c6c548461e26c40cba2d|
| deno.json |2d4118be292729076973adce7fcb5a4146a19eeee46b64f0ed319b28ef53ae18|a7506b680cdc1eb81864d01d961b2eb49d7f9c88bed2a8ec8492c87843ff396c|

Wymagane środowisko accounts: automatyczne SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY (są na liście nazw; wartości nie odczytywano do raportu), ACCOUNTS_ALLOWED_ORIGINS opcjonalna jawna allowlista, SLM_EMAIL_SIGNUP_ENABLED pozostaje false/nieobecne. Nazwy dwóch ostatnich nie występują w Cloud, obowiązują defaulty. Nigdy nie ustawiać zarezerwowanych SUPABASE_* ręcznie ani nie wkładać service_role/PAT/DB URL/JWT secret do Vite/APK. SUPABASE_DB_URL/JWKS/PUBLISHABLE_KEYS/SECRET_KEYS są również nazwami środowiska platformy; ten handler ich nie potrzebuje.

verify_jwt=false jest tu świadomy: login/refresh nie mają jeszcze access JWT. **Nie przestawiać na true bez przebudowy kontraktu.** Operacje chronione sprawdzają Bearer przez Auth /user, session_id/sub oraz serwerowy context/security_version i wymuszone hasło; rola z DB, nie user_metadata. Rate limiting po stronie serwera. CORS nie zastępuje Auth. OPTIONS obecnego Cloud: https://localhost204 i capacitor://localhost204 z dokładnym allow-origin; obcy origin403. Defaulty dopuszczają też lokalny web5173; do release rozważyć osobną zatwierdzoną allowlistę, bez zmiany teraz.

GET /config/auth z istniejącym lokalnym poświadczeniem (bez ujawniania wartości) potwierdził istniejący guard PASS: disable_signup=true, external_email=true, external_phone=false, anonymous=false, linking=false, mailer_autoconfirm=false, min8, current_password=true, reauthentication_nonce=false, secure_email_change=true; zatwierdzone hooki blokujące mail i SMS włączone. Nie testowano wiadomości. Logowanie aliasem/telefonem i istniejące techniczne e-maile/UUID pozostają; nie importować lokalnych kont/refresh tokenów do Cloud. Tymczasowe hasło nadal wymaga zmiany. E-mail login istniejącego konta to osobny już obsługiwany kontrakt; samorejestracja, wysyłka potwierdzeń/recovery/SMTP nie są gotowe i pozostają wyłączone. Nie włączać OTP/SMS ani płatnej poczty.

Storage: migracja30 tworzy private bucket,32 ustawia image/webp i150000B. RLS bez bezpośrednich polityk klienta, metadane service-only. API sprawdza sesję, własny ctx.id, waliduje WebP/limity/wymiary, odrzuca cudzy user_id/path, używa wersji CAS, cleanup i limitów. Odczyt zwraca własny data URL po pobraniu przez serwer; nie dodaje publicznego URL ani podpisanego długotrwałego linku. Inne zdjęcia członków pozostają niedostępne. Client przygotowuje JPEG/PNG/WebP do formatu wynikowego, backend weryfikuje WebP; brak płatnej transformacji Storage.

push-worker nie jest wdrożony w Cloud. PUSH_WORKER_SECRET i FCM_SERVICE_ACCOUNT_JSON dotyczą odrębnego modułu FCM; nie są wymagane do logowania/grup/zdjęć. Nie wdrażać wszystkich funkcji jednym poleceniem ani nie aktywować schedulera w tej zmianie.

## 5. Android — konkretne blokery i decyzja wariantu

Obecny main nadal domyślnie uruchamia LIVE; zaakceptowany Premium ma osobny punkt b1/main.tsx. `vite.b1.config.ts` na sztywno ustawia127.0.0.1:54321 i ignoruje env. Zmiana .env **nie zmieni** backendu Premium. `npm run build` może użyć adresu Cloud, ale daje domyślny LIVE, nie jest zamiennikiem Premium Cloud Test. Obecny build-consolidation-android i verify-consolidation-apk celowo obsługują tylko LOCAL.

Drugi bloker: tokenStore ma stały WEB_TOKEN_KEY i natywny prefix slm.auth.hjtcyybkxebvdropchac. niezależnie od faktycznego endpointu. Zmiana URL i install-r mogłyby wysłać lokalny opaque refresh token do Cloud. Nie robić tego. W etapie2 przygotować jawną, walidowaną konfigurację LOCAL / CLOUD TEST / RELEASE oraz namespace środowisko+project identity, np. nowy cloud-test.v2 i osobny local.v2/release.v2. **Nowy Cloud Test nie czyta starego mieszanego klucza, nie migruje tokenu i nie ma fallbacku do Preferences/localStorage na Androidzie.** Pierwsze uruchomienie Cloud Test = świeże logowanie; stary klucz zostaje nietknięty na potrzeby kontrolowanego powrotu do starego lokalnego APK. Nie czyścić całych danych/Keystore i nie przesyłać refresh w celu sprawdzenia, do jakiego środowiska należy.

Docelowy nowy wariant powinien używać istniejącego b1/main.tsx i deterministycznego HTTPS endpointu dokładnie hjtcyybkxebvdropchac, envDir=false oraz guard błędnych project refs. Nazwa `build:cloud-test`/vite.cloud-test.config.ts to **propozycja do implementacji etapu2, nie istniejące polecenie teraz**. Zachować pl.psuda87.slm, Sunday League Mates, loggingBehavior=none, secure storage, wyłączone WebView debugging/mixed content. Debug obecnie dopuszcza HTTP tylko localhost/127.0.0.1 przez osobny manifest/XML; Cloud Test ma otrzymać sprawdzony manifest bez cleartext wyjątków. Release ma być oddzielnie chroniony i nie może przypadkiem użyć konfiguracji LOCAL lub demo.

Guard Cloud APK ma pozytywnie potwierdzić jedyny endpoint HTTPS, właściwy entrypoint/zasoby/CSP/CORS origin; odrzucić localhost API/10.0.2.2/LAN/private keys/service/PAT i demo-only entrypoint, sprawdzić końcowy merged manifest (nie tylko TS config), certyfikat podpisu i zgodność podpisu z dotychczasową instalacją. `https://localhost` jako origin Capacitor jest normalny i nie jest lokalnym backendem. Zachować repozytoryjne źródła platform, nie instalować niezależnych zależności.

## 6. Wykonywalna kolejność po osobnej zgodzie — NICZEGO PONIŻEJ NIE WYKONANO

Punkty1–11 są bramkami; błąd dowolnej blokuje dalszy krok. Ustalić właściciela operacji, okno serwisowe i zatrzymanie zapisów starej aplikacji/API na czas wieloetapowej zmiany; obecnie nie ma gotowego przełącznika maintenance, jego bezpieczny sposób wymaga przygotowania. Nie zostawiać accounts v6 i nowego klienta na częściowym schemacie.

### 1. Backup i próba odtworzenia

Warunek: zatwierdzona lokalizacja szyfrowanego backupu poza repo/limit dostępu, read-only połączenie SLM i zgodność narzędzi PG17. Operacje: eksport pełnego schematu+danych public/slm_private/auth/storage/supabase_migrations i istniejącego slm_auth_proof_private, konfiguracji Auth, kodu/konfiguracji Edge, nazw sekretów i bezpieczne zachowanie wymaganych poświadczeń w magazynie właściciela. Zweryfikować listę schematów zamiast zgadywać; schemat proof-private może nie istnieć. Osobno pobrać binaria Storage, jeśli po ponownym preflight już istnieją.
Przykład po konfiguracji prywatnego pg_service.conf/pgpass (bez hasła w argv/logach):

```powershell
# Dopiero po zatwierdzeniu; SLM_BACKUP_DIR poza repo, zaszyfrowany nośnik.
pg_dump --dbname="service=slm_cloud_backup" --format=custom --file="$env:SLM_BACKUP_DIR/slm.dump" --schema=public --schema=slm_private --schema=auth --schema=storage --schema=supabase_migrations
pg_restore --list "$env:SLM_BACKUP_DIR/slm.dump" > "$env:SLM_BACKUP_DIR/restore-list.txt"
Get-FileHash "$env:SLM_BACKUP_DIR/slm.dump" -Algorithm SHA256
```

Dodać istniejący proof-private do eksportu, zinwentaryzować role/GRANT/default privileges/event triggers oraz obiekty zarządzane niewchodzące do zwykłego dump. CLI db dump domyślnie pomija zarządzane auth/storage i dane; zwykły dump public NIE jest pełnym backupem kont. Odtworzyć pod superwizją wyłącznie do nowej izolowanej lokalnej bazy z infrastrukturą Supabase, zweryfikować konta/aliasy/hash hasła/uprawnienia/historię oraz FK/sekwencje. Nie wyświetlać tych danych. Oczekiwane: kompletność i próba odtworzenia PASS z manifestem SHA. Ryzyko: kopia danych osobowych/hashy/refresh; chronić, nie commitować. Wycofanie: zakończenie odczytów, Cloud bez zmian. Automatyczne backupy/PITR nie są gwarancją Free; nie kupować dodatku.

### 2. Kontrola zgodności migracji i przygotowanie klienta

Warunek: restore PASS i zatwierdzony SHA źródeł. Operacje: powtórzyć read-only SQL w scripts/cloud-readiness-metadata.sql, porównać historię/manifest poniżej i agregaty liczby adminów/sierot/kosztów. Lokalnie uruchomić skrypty testowe poniżej. Przygotować brakujący Cloud Test/namespace/guard bez łączenia APK z Cloud, przegląd osobnego PR. W odrębnym czystym katalogu, po zgodzie na operacje przygotowawcze CLI: `supabase link --project-ref hjtcyybkxebvdropchac` i `supabase migration list --linked`; nie używać --include-all/repair do wymuszania historii. Oczekiwane: dokładnie27 oczekujących wersji. Ryzyko: niewłaściwy link/zmieniona baza; zatrzymać przy każdej różnicy. Wycofanie: nie uruchamiać DDL, usunąć jedynie roboczy link (nie dane).

### 3. Aktualizacja schematu

Warunek: osobna zgoda na Cloud DDL/backfill, backup, kompletna checklista, potwierdzony projekt i okno bez zapisów. W tym dopiero etapie dopuszczalne `supabase db push --dry-run`, porównanie dokładnych27 plików, następnie po ostatnim GO `supabase db push --linked` w zweryfikowanym katalogu. Bez seed/reset/include-all. Nie wykonywano żadnej z tych komend w etapie1. Po każdej wersji sprawdzić historię; docelowo34/46, istniejące UUID/aliasy/role/wydarzenie/wpisy/historia zachowane, nowa grupa mapowana na istniejącego admina. Ryzyko: blokady/backfill/incomplete chain; wiele plików zawiera własne BEGIN/COMMIT, nie obiecywać jednej atomowej transakcji całego rollout. Brak automatycznej migracji down. Przy awarii utrzymać maintenance; preferować przeglądany roll-forward, a pełny restore wymaga osobnej zgody i rozliczenia utraconych późniejszych zapisów.

### 4. RLS i uprawnienia

Warunek: pełne34 wersje, klient nadal odłączony. Operacje: ponownie metadata/Advisor; potwierdzić nową members_read_profiles/shared_profile,46 RLS, brak client write/anon RPC, helpery/granty/trigger niezmienności, zgoda false. Dopiero krokiem8 wykonać próby z prawdziwymi testowymi sesjami. RLS jest częścią wersjonowanych migracji, nie ręcznych zmian Dashboard. Ryzyko: chwilowa szeroka polityka lub service bypass; brak publikacji do czasu testów. Wycofanie: blokada dostępu testowego i naprawa do przodu; nie przywracać szerokiej starej polityki jako sposobu uruchomienia nowego klienta.

### 5. Storage

Warunek: migracje30/32 już zastosowane. Operacje odczytu: sprawdzić private bucket, MIME WebP/150000B, metadane/service-only, brak public/client policies i nieoczekiwanych obiektów. Nie tworzyć drugiego bucketa ani nie nadpisywać istniejącego z nieznanym pochodzeniem; konflikt oznacza STOP. Wynik: tylko własne zdjęcie przez API po teście8. Ryzyko: upublicznienie lub usunięcie binariów; obiekty nie są zawarte w dumpie DB. Wycofanie: wyłączyć nowe uploady; nie usuwać istniejących zdjęć bez zgody/backupów.

### 6. Edge Functions accounts

Warunek: pełny schemat i Storage, zachowany kod v6 jako artefakt rollbacku, nowe źródła i graf importów zatwierdzone. Po zgodzie: z app wykonać `supabase functions deploy accounts --project-ref hjtcyybkxebvdropchac`; config.toml zachowuje verify_jwt=false. Nie wdrażać bez nazwy, nie wdrażać push-worker. Automatycznych SUPABASE_* nie zmieniać; opcjonalnie zatwierdzić allowlistę przez `supabase secrets set --project-ref hjtcyybkxebvdropchac --env-file <chroniony-plik-bez-SUPABASE_*>`. Obecny default CORS już obsługuje Android; signup pozostawić false. Wynik: nowy deployment + pobranie/porównanie źródeł, OPTIONS allowed/denied, health bez danych. Ryzyko: niezgodność handlera z DB lub ujawnienie sekretu; logi sanowane. Rollback: przywrócić zachowany kod funkcji TYLKO po sprawdzeniu jego zgodności z nowym schematem; sam powrót do v6 nie cofa migracji ani nie gwarantuje działania.

### 7. Auth

Warunek: nowa funkcja/Supabase Auth działają. Ponowić GET guard ustawień z punktu4; domyślny plan to **zero zmian Auth**. Zachować UUID/techniczne e-maile/hasła/role i hooki, brak SMS/SMTP/signup/recovery. Każda niezbędna zmiana konfiguracji wymaga osobnej zgody z przed/po i kopią ustawień. Wynik: dotychczasowy kontrakt i brak wiadomości. Ryzyko: utrata dostępu/niezamierzona wysyłka; rollback przywraca tylko faktycznie zmienione ustawienia, nie resetuje haseł/admina.

### 8. Testy Cloud na fikcyjnych kontach

Warunek: osobna zgoda na utworzenie fikcyjnych kont/danych w SLM Cloud (4 konta,2 grupy), instrukcja bezpiecznego tworzenia zgodna z obecnym Auth; nie używać lokalnego admin-local ani omijać jego guardów. Przygotować dedykowany Cloud harness ze stałym ref, bramką flagi i sanowaniem sekretów; nie zmieniać istniejących LOCAL testów na URL Cloud. Scenariusze: invalid/login/refresh/context/logout/password-required, profil/numer/WebP/CAS/usunięcie, członkostwo/invite/join/cancel/roles/succession, zgody per grupa/admin exception/outsider/phone receipts, RLS bezpośredni REST, brak uprawnień RPC i cross-user zdjęć. Wynik: udokumentowany PASS, oryginalne2 konta i historia niezmienione. Ryzyko: tworzenie trwałej historii/testowego ledger; bez prób na prawdziwym wydarzeniu. Usuwanie testowych kont/historii nie jest automatycznym rollbackiem: wymaga planu i zgody, append-only historię można pozostawić jawnie testową/archiwalną.

### 9. APK Cloud Test

Warunek: testy8 i lokalnie odebrany nowy namespace/konfiguracja PASS. Uruchomić nowy, wcześniej zaimplementowany build:cloud-test, cap sync z cloudowym webDir, Android assembleDebug i walidator końcowego artefaktu. Kontrole: jedyny właściwy endpoint, brak sekretów/HTTP API/debug logging/cleartext, właściwy entrypoint Premium, certyfikat zgodny z zainstalowanym APK, zapisany SHA/commit. Oczekiwany pierwszy ekran: wylogowany bez odczytu lokalnego tokenu. Ryzyko: pomylenie variant/namespace/klucza podpisu. Rollback: zachowane stare lokalne APK, bez uninstall/clear; nie obniżać podpisu/Android protections.

### 10. POCO przez internet

Warunek: zaakceptowany APK i zgoda na aktualizację. `adb -s c7a559b5 install -r <zweryfikowany-cloud-test.apk>`, bez uninstall/clear. Po instalacji `adb -s c7a559b5 reverse --remove tcp:54321` (tylko reguła backendu), odłączyć USB. Właściciel testuje najpierw Wi-Fi, potem wyłączone Wi-Fi/dane mobilne, przy wyłączonym komputerze/Dockerze. Świeże logowanie **kontem Cloud**, restart/Home/Wstecz/offline→online, profil/zdjęcia/numer/grupy/zgody. Błędy offline mają ukrywać dane chronione, nie podkładać demo. Premium mecze pozostają jawnie demo. Wynik: działanie bez hosta, zachowana sesja i brak użycia starego tokenu. Rollback: zainstalować zachowany zgodnie podpisany lokalny APK, odtworzyć reverse tylko na czas lokalnych testów; Cloud danych nie usuwać. Zmiana wersji nie może wymagać czyszczenia danych.

### 11. Regresje i końcowa decyzja

Warunek: ręczny odbiór10. Wykonać adekwatne Auth/B2/B3/native-back/visual tests, security advisors, inwentaryzację34/46, kontrolę uprawnień i zachowania istniejących rekordów względem backupu. Sprawdzić zużycie Free i brak aktywacji FCM/wiadomości. Zebrać PASS/FAIL/NOT TESTED, SHA APK/kodu/funkcji i link PR; zamknięcie okna serwisowego dopiero po decyzji GO. Merge PR/release nie jest automatycznie zatwierdzone. Zmiany schematu nie mają gotowego bezstratnego down; restore nadpisuje późniejsze dane i jest potencjalnie nieodwracalny dla tych zapisów. Usunięcie obiektów/historii/kont jest operacją wymagającą dodatkowej zgody, nie elementem normalnej próby.

## 7. Testy wykonane w etapie1 i odtwarzalność

| Kontrola | Faktyczny wynik |
|---|---|
| Oczekiwany main/clean nowy worktree | PASS edd2e92 |
| Cloud GET + catalog/history/Auth/CORS + source accounts | PASS, tylko SLM |
| Exact Cloud prefix +27 pending, fikcyjne dane przed settlements |11 PASS |
| Porównanie historycznego schematu |17 definicji funkcji,73 kolumny,57 constraints,31 indeksów,polityki i triggery zgodne |
| Istniejący SQL/RLS/scoped/B3 |102 PASS |
| Istniejący replay34 i niezmienność ledger/aliasów |11 PASS |
| Składnia3 zmienionych/dodanych Python | PASS |
| Źródła32 migracji i55 Premium | PASS; runtime/SQL/UI nie zmieniono |
| Istniejący lokalny APK ze źródeł c22d65b == app main edd2e92 | PASS identity/fresh assets/local-only/no service markers; SHA a28afb2f272a396b35aa5d5a276f1302b76835feaedb33d7b2c76077d2a628a5 |
| Pełny backup/restore prawdziwych danych Cloud | NOT TESTED, nie eksportowano danych osobowych |
| Rzeczywiste Auth/RPC/Storage Cloud i Cloud APK/POCO | NOT TESTED; brak wdrożenia, brak nowego APK |

Nie powtarzano Vitest/Cypress/build Androida: kod aplikacji bez zmian, nowy zakres to SQL audit/replay i dokumentacja. Przeczytano i sfingerprintowano41 skryptów (w tym nowy); istniejące narzędzia lokalne blokują niewłaściwą gałąź/host, narzędzia Auth-admin historycznie wymagają feat/auth. **Nie zdejmować tych guardów w celu wdrożenia.** Jedyna zmiana istniejących skryptów: dopuszczenie feat/cloud-test-preparation w dwóch scratch testach, bez zmiany zabezpieczeń hosta i sprzątania. Dodano test-cloud-prefix-local.py i read-only cloud-readiness-metadata.sql. Nie zmieniono historycznych migracji, Edge, Auth ani build configuration.

Przy ponowieniu odczytać w SLM:

```sql
select version,name,cardinality(statements) statement_count,
 md5(array_to_string(statements,E'\n')) joined_md5,statements
from supabase_migrations.schema_migrations order by version;
```

Zapisać wynik (schema-only, bez danych kont) jako listę JSON do ignorowanego `.cache/cloud-audit/cloud-history.json`; wynik pola audit z scripts/cloud-readiness-metadata.sql do cloud-metadata.json; tę samą kwerendę zapisać jako metadata.sql w tym katalogu. **Nie dodawać surowych eksportów .cache do Git**. Potem w katalogu repo:

```powershell
python app/scripts/test-cloud-prefix-local.py
python app/scripts/test-migrations-local.py
python app/scripts/test-v2-local.py
```

Testy tworzą nowe bazy o losowych nazwach w dokładnym lokalnym kontenerze, usuwają tylko własne. Po testach0 scratch DB; istniejąca lokalna baza pozostała34/46. Test prefix korzysta z lokalnej infrastruktury Auth/Storage17.11 i inertnego, odebranego klientom stubu zarządzanego rls_auto_enable tylko do historycznego REVOKE; **nie emuluje wszystkich platformowych event triggers/ustawień Auth Cloud i nie jest restore backupu Cloud**. Najpierw wykryto fałszywy FAIL pełnego porównania JSON po dodaniu kolumny total_cost_cents; poprawiono harness tak, aby sprawdzał wszystkie oryginalne kolumny/wiersze i dopuszczał dodane kolumny. Końcowy test i dodatkowa historia/pełne metadane PASS.

## 8. Zgody, limity i nakład następnego etapu

Wymagane decyzje przed etapem2:
- Zakres Cloud Test: istniejący Premium B1/B2/B3, pozostałe Premium ekrany nadal demo; domyślnego LIVE nie przełączać przypadkowym npm build.
- Zgoda na wdrożenie dokładnych27 migracji do SLM (bez resetu) i mapowanie istniejących kont do jednego istniejącego admina; zatwierdzony backup/restore oraz okno bez zapisów.
- Zgoda na wdrożenie wyłącznie accounts i ewentualną konkretną allowlistę; Auth/signup/wiadomości/FCM pozostają niezmienione.
- Zgoda na nowe namespace/config i świeże logowanie Cloud bez migracji lokalnego tokenu; bez usuwania danych urządzenia.
- Zgoda na fikcyjne konta/dane Cloud i sposób ich pozostawienia/archiwizacji oraz plan wycofania. Żadnych kont produkcyjnych do automatycznych prób.

Nakład: średni, kilka odrębnych bramek i2–3 sesje pracy z odbiorem właściciela; nie jest to jedno db push. Najwięcej pracy: backup/restore, bezpieczeństwo przełączenia sesji i testy Cloud/POCO; SQL27 etapów ma potwierdzony mechaniczny replay. Etap2 można rozpocząć po osobnym poleceniu, ale realny rollout dopiero po wszystkich bramkach. Audyt nie udziela zgody na mutacje.

Oficjalne źródła sprawdzone w etapie1:
- [Changelog](https://supabase.com/changelog): odczytano101933B markdown; istotne PG17.11 i TLS.
- [PG15.19/17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes): brak ltree/btree_gist i legacy PGP w badanym SLM; pgcrypto w extensions, kod używa kwalifikowanych/builtin ścieżek, replay17.11 PASS. Nie rekonfigurowano rozszerzeń.
- [TLS CBC deprecation](https://supabase.com/changelog/cbc-tls-ciphers-deprecated): od10.11.2026 najwcześniej; Android12 powinien obsłużyć współczesne TLS, ale handshake fizycznego Cloud Test pozostaje do sprawdzenia.
- [Backup](https://supabase.com/docs/guides/platform/backups), [CLI dump](https://supabase.com/docs/reference/cli/supabase-db-dump), [restore/history/Auth/Storage](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore): Free potrzebuje własnego eksportu; DB dump nie zawiera binariów Storage.
- [Edge Auth](https://supabase.com/docs/guides/functions/auth), [sekrety](https://supabase.com/docs/guides/functions/secrets), [deploy](https://supabase.com/docs/guides/functions/deploy), [sesje](https://supabase.com/docs/guides/auth/sessions): zachować własny sprawdzony kontrakt, nie przepisywać na nowy SDK na podstawie przykładu dokumentacji.
- [Prywatne buckety](https://supabase.com/docs/guides/storage/buckets/fundamentals), [limity Edge](https://supabase.com/docs/guides/functions/limits), [Free billing](https://supabase.com/docs/guides/platform/billing-on-supabase): m.in.1GB Storage,500000 wywołań Edge,256MB/2s CPU/150s Free; bez płatnych transformacji. Zdjęcia małe, lecz egress i czas konwersji walidować testami, nie zakładać nielimitowanej pracy.

CLI sprawdzone --help:2.121.0; dostępne2.122.0, nie aktualizowano narzędzi w ciemno. Przed wykonaniem planu ponownie sprawdzić wersję/pomoc i istotne zmiany. Konto Free potwierdzone przez odczyt organizacji, nie tylko założenie z opisu zadania.

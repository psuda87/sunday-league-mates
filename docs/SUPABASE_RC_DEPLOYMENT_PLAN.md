# Supabase — audyt RC i plan wdrożenia, NIE WYKONANO

30.10.2026, projekt `hjtcyybkxebvdropchac` / sunday-league-mates. **Cloud nie jest zgodny z pełnym kandydatem; wdrożenie BLOCK do osobnej zgody i próby na kopii danych.** W tej sesji wyłącznie odczyty projektu, katalogów SQL, historii, advisory i źródeł Edge. Bez deploy/apply_migration/db push/zmian Auth/RLS/sekretów lub odczytu wartości kont, haseł i tokenów.

## Faktyczny stan chmury

| Obszar | Odczyt Cloud | Wymaganie kandydata |
|---|---|---|
| PostgreSQL |17.11, projekt ACTIVE_HEALTHY|zgodny major17; wersja nie dowodzi zgodności aplikacji|
| Historia migracji |7, do `20261013213917_events_finite_costs`|42, ostatnia `20261030090000_public_match_discovery`|
| Tabele aplikacji |13 tabel public.slm_*, RLS włączone|47 w świeżej referencji42; brak m.in. groups/matches/lineups i ledgerów grup|
| Edge |tylko accounts v6, ACTIVE, verify_jwt=false|bieżące accounts/index+handler+całe zależności; osobno push-worker|
| Storage |brak bucketów|prywatny `slm-profile-photos`,2MiB,image/jpeg z migracji30|
| Legacy dane |aliasy, mecze i wpisy istnieją|backup i próba migracji na kopii; nie traktować bazy jako pustej|
| Właściciel grupy legacy |warunek jednego admina obecnie spełniony|migracja17 `20261019170413_slm_v2_groups` odmawia, gdy aliases istnieją i adminów nie ma dokładnie1|

Listy/hashe bez danych użytkowników: [katalog Cloud](review/rc-cloud-metadata.json), [Edge diff](review/rc-edge-compare.json), [bezpieczne booleany preflight](review/rc-cloud-preflight.json), [42 kroki i SHA256](review/rc-release-evidence.json).

Pierwsze7 wersji odpowiada kolejności lokalnej, ale SQL zapisany w historii ma inny MD5 dla `20261013193844_accounts_recovery_and_permissions`, `20261013212841_events_module`, `20261013213423_events_edit_validation`. Nie edytowano tych rekordów ani nie wykonano migration repair. W nowej referencji kanonicznej7 porównano z Cloud pełne definicje funkcji aplikacji (hash), sygnatury kolumn i wyrażenia polityk: **brak różnic w zbadanym podzbiorze**. Nie dowodzi to identyczności wszystkich triggerów/constraintów/ustawień Auth ani tego, że trzy historyczne różnice to wyłącznie komentarze. Przed wdrożeniem wymagany pełny kontrolowany diff.

Nowa referencja `slm-rc-reference-7ecd4b5224ce`: odtworzone42 SQL z dokładnych źródeł, najpierw7 i fikcyjny administrator/alias/mecz/wpis, następnie8–42. Zachowanie tych danych, mapowanie jednoznacznego właściciela, RLS47 tabel oraz brak bezpośredniego EXECUTE discovery dla anon/authenticated — **PASS**. To nie restore prawdziwych danych Cloud i nie GoTrue/Storage HTTP. Kontener zatrzymany/zachowany; [porównanie](review/rc-schema-comparison.json), [runner izolowany](review/rc-schema-reference.py).

## Bezpieczeństwo i zależności

Po42 API używa zweryfikowanego Auth + żywej sesji aplikacyjnej i identyfikatora aktora z handlera, a nie z body. Funkcje dispatchery i ACL są częścią niezmiennego źródła. service_role omija RLS: sprawdzenia sesji, członkostwa i ról wewnątrz SQL są równie istotne jak RLS. Nie dodawać grantów lub polityk do tabel prywatnych, aby „naprawić” test. Public discovery nie nadaje członkostwa ani uprawnień finansowych/profile/lineups.

Advisory Cloud:9 INFO `rls_enabled_no_policy` dotyczy tabel prywatnych z ACL głównie service_role — domyślna odmowa klientom jest zamierzona, nie należy otwierać ich politykami. [Opis lint0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Ostrzeżenie o wyłączonej ochronie przed ujawnionymi hasłami pozostawiono bez zmiany; dostępność i koszt opcji należy sprawdzić osobno, bez włączania płatnych funkcji. [Dokumentacja Auth](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

`accounts/index.ts` dopuszcza wyłącznie URL tego projektu. Nie deployować `local-entrypoint.example.ts` ani entrypointów z cache. Bieżący deployv6 ma inne index/handler od RC; deno.json jest zgodny. Należy dostarczyć cały graf: `handler.ts`, `profilePhotos.ts`, `_shared/phone.ts`, `_shared/profilePhoto.ts`, `_shared/webp.ts` oraz deno.json. Push-worker ma własne handler/fcm i obsługuje sekret workera, nie sesję użytkownika. Brak zewnętrznych importów npm w tym grafie; OAuth/FCM są wywołaniami Google wykonywanymi tylko przez worker.

| Konfiguracja | Wymaganie / status audytu |
|---|---|
| SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY |wartości runtime Supabase; nie kopiować do klienta, raportu lub Git. Nie pobierano ich wartości|
| ACCOUNTS_ALLOWED_ORIGINS |jawne zatwierdzone originy, w tym https://localhost/capacitor://localhost dla Androida; bez wildcardów|
| SLM_EMAIL_SIGNUP_ENABLED |pozostawić niewłączone; nie aktywować Auth18/signup/SMTP/recovery w tym wdrożeniu|
| PUSH_WORKER_SECRET, FCM_SERVICE_ACCOUNT_JSON |wymagane dla działającego push; obecność/wartości nieaudytowane, worker niewdrożony. Osobna konfiguracja Spark/FCM bez billing|
| Auth hooks/providers/redirects, token TTL i limity |potrzebny eksport ustawień i review zgodności z istniejącym modelem; nie zmieniano ich i nie odczytywano sekretów|
| accounts i push-worker verify_jwt=false |zamierzone: login/refresh bez JWT; pozostałe akcje sprawdza handler/SQL, worker swój sekret. Nie zmieniać tego w celu obejścia lub „wzmocnienia” bez review|

Supabase udostępnia domyślne zmienne Edge, ale kandydat nadal używa legacy nazw kluczy; nie przeprowadzono migracji do nowych API keys. [Dokumentacja zmiennych](https://supabase.com/docs/guides/functions/secrets). Brak odczytu wartości sekretów oznacza **NOT VERIFIED konfiguracji**, nie potwierdzenie ich obecności.

## Plan wykonania po osobnej zgodzie

1. **Zamrozić i zatwierdzić zakres.** Wybrać dokładny SHA RC, zachować historię/piny24a59e1/ae2fd95/d7b36ee/cb63962; potwierdzić brak Auth18. Uzgodnić okno utrzymaniowe, ograniczenie ruchu zapisów i wersje klientów. Nie obiecywać, że stary Edge będzie obsługiwał nowy schemat podczas całej operacji. Brak automatycznego rollbacku obejmującego jednocześnie Edge i DB.
2. **Backup przed jakąkolwiek zmianą.** Istniejącym klientem PostgreSQL17/Supabase CLI w kontrolowanym środowisku wykonać pełny logiczny dump oraz osobne potwierdzone zabezpieczenie auth/users/sessions, public/slm_private, Storage metadata i plików, historii migracji, ról/grantów, ustawień Auth/hooks i bieżącego Edgev6. Wartości sekretów zabezpieczyć poza repo w magazynie właściciela, bez ich wypisywania. Backup szyfrowany/prywatny, SHA256, `pg_restore --list` oraz **rzeczywisty restore do odizolowanej kopii**. Nie zakładać automatycznych backupów/PITR na Free; Supabase zaleca własne eksporty CLI. [Backups](https://supabase.com/docs/guides/platform/backups).
3. **Sprawdzić zakres dumpa.** Domyślne eksporty CLI mogą pomijać zarządzane schematy; nie nazywać samego public.sql pełnym backupem. Odtworzyć także historię migracji zgodnie z narzędziem, a pliki Storage i Edge/config zabezpieczyć osobno. W razie braku uprawnień lub klienta17 zatrzymać tę część — nie pomijać Auth ani nie instalować narzędzi na produkcji. [Backup/restore CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
4. **Detekcja różnic na kopii.** Ponownie odczytać rzeczywiste wersje/hash/stany; porównać cały katalog: definicje funkcji, constraints, indeksy, triggery, RLS/policies, ACL, ustawienia/extensions i dependencies. Rozstrzygnąć trzy historyczne różnice SQL bez przepisywania plików1–7 lub oznaczania ich arbitralnie jako applied. Przejrzeć role/admina legacy, historyczne E.164, osierocone rekordy, stare należności/udziały i powiązania Auth. Nie czytać danych do publicznych raportów.
5. **Próba35 brakujących migracji na przywróconych danych.** Kolejność dokładnie8–42 z manifestu; osobne transakcje i receipt dopiero po potwierdzonym commicie danego kroku. Nie obiecywać jednej atomowej transakcji dla35 plików z własnymi BEGIN/COMMIT. Warunki przerwania: niejednoznaczny admin, brak zależności, niezgodny dispatcher przy patchowaniu, błąd funkcji/grantów, rozjazd historii lub zmiana kwot/danych. W takim przypadku nie przechodzić do kolejnego pliku i nie publikować nowego Edge.
6. **Testy na kopii.** Porównać sumy/wiersze legacy i dokumenty finansowe przed/po, właściciela/członkostwa grupy legacy, profile/telefony, odmowy outsiderów, ACL/RLS, Auth/sesję/revoke, przepływy legacy i nowych grup, wpisy/gości/rezerwę, finance authority, składyCAS/roster/request_id/no-op, discovery100+5. Historyczne mecze zostają w tabelach legacy, nie zakładać automatycznego skopiowania do nowego feedu slm_matches. Odbiór ich prezentacji i zgodności klienta wymaga rzeczywistych danych testowych.
7. **Wdrożenie Cloud dopiero po ponownej decyzji.** Po odświeżeniu backupu i zatrzymaniu zapisów zastosować wyłącznie zatwierdzony plan8–42 oraz właściwy cały Edge; potwierdzić42 w historii i komplet definicji/ACL. Osobno prywatny bucket i konfiguracja usług. Nie dodawać nowych migracji43, nie aktywować signup, SMTP lub FCM automatycznie. Wartości env i provider config zatwierdza właściciel.
8. **Odbiór i wznowienie.** Użyć zatwierdzonego klienta HTTPS, nie obecnego lokalnego APK64321. Potwierdzić wersję discovery i readback zapisów, sesje i grupy; stopniowo wznowić ruch po zgodzie. Obserwować wyłącznie zredagowane metryki/kody błędów, nie payloady/sekrety. Rzeczywisty hosted CI i wyniki Cloud raportować osobno.

Powyższych kroków **nie wykonano**. W tym zadaniu powstał tylko nowy lokalny test ze sztucznymi danymi i odczyt audytowy Cloud. Nie wykonano nawet backupu danych chmurowych, bo zadanie nie upoważnia do wdrażania/odtwarzania bazy.

## Rollback — warunki, nie automatyczny down.sql

- Błąd przed commitem pojedynczego kroku: rollback tylko tej transakcji; sprawdzić historię i wcześniejsze zatwierdzone kroki. Nie deklarować powrotu całej bazy do7. Utrzymać okno utrzymaniowe.
- Błąd po części migracji: decyzja właściciela między zatwierdzonym forward-fix a odtworzeniem sprawdzonej kopii. Nie usuwać tabel grup/ledgerów, nie resetować public/auth i nie kasować historii. Stary Edgev6 nie jest automatycznie bezpieczny na pośrednim schemacie.
- Po wznowieniu zapisów: pełne odtworzenie starego backupu mogłoby utracić nowe mecze/wpłaty/sesje. Najpierw zatrzymać zapisy, zabezpieczyć nowy stan i uzgodnić rejestr zmian; restore tylko po odrębnej decyzji i zweryfikowanym planie uzgodnienia danych. Usunięcie42 ani samo cofnięcie Edge nie cofa zmian8–41.
- Rollback nie obejmuje automatycznie sekretów, Auth hooks/providerów, obiektów Storage, APK lub FCM. Ich wersje/kopie i procedury muszą być przetestowane przed wdrożeniem. Nie włączać płatnego PITR w ramach realizacji tego planu.

Gotowość dzisiaj: **kod i lokalny replay PASS; istniejący Cloud do pełnego RC BLOCK; backup/restore danych i wdrożenie NOT RUN**. Emulator: [instrukcja](ANDROID_STUDIO_RC.md). Raport: [SLM_V1_RELEASE_CANDIDATE.md](SLM_V1_RELEASE_CANDIDATE.md).

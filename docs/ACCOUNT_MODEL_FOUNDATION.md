# Model kont — etap 1: nieaktywny fundament

2026-10-26 19:35 Europe/Warsaw. `feat/account-model-foundation` z main134c52b1aee0d0804cc0cf71f151f95040e7a38f. PR17/plan przeczytano, pozostają bez zmian; nie scalano gałęzi. Nowe źródła bazują na bieżącym main, nie na innej wersji backendu z cache.

## Zrealizowane

- Trzy **nowe** migracje20261026182532 /182914 /183222: rejestr `slm_identity_registry`, normalizacja, jawne przygotowanie i transakcyjny rename; osobne poprawki guardu upsertów i odczytowego preflightu. Zachowano historię wcześniejszych35 migracji. Po pierwszym zastosowaniu nowych wersji lokalnie poprawki dopisywano jako kolejne migracje, bez zmieniania już zastosowanego SQL.
- Kanoniczny pseudonim pozostaje w istniejącym `slm_player_profiles.nickname`; rejestr przechowuje tylko pochodny globalnie unikalny klucz, UUID, prywatny adres Auth oraz opcjonalny już potwierdzony e-mail loginu. Nie dodano drugiego publicznego pola login/nickname, nie zmieniono UUID/Auth e-maila. Rejestr ma RLS i brak dostępu anon/authenticated.
- Normalizacja: trim, NFC, lower PostgreSQL, klucz z porównaniem bytewise COLLATE C; format istniejącego loginu3–32 znaków, pierwsza litera, dalej litery/cyfry/_.-. Testy obejmują Unicode (ŻÓŁĆ/żółć), dekompozycję NFC i konflikt wielkości liter. To fundament aktualnego kontraktu loginów; dawne nickname1–48 ze spacjami wymagają rozwiązania przed cutover, nie są automatycznie zmieniane.
- `slm_identity_prepare()` jest wyłącznie service_role, **nie wywołuje się z migracji**. Sprawdza wszystkie istniejące profile, stan kont/role/pending, zgodność adresu Auth i obu typów kont. Duplikat/brak/niezgodny format cofa całą transakcję; nie nadaje nazw zastępczych i nie provisionuje brakującego security. Odczyt Auth ma wąski helper definer z pustym search_path i grantem tylko service_role.
- `foundation_rename`: wyłącznie za bramką `SLM_ACCOUNT_FOUNDATION_ENABLED=true`, domyślnie brak dostępu. Istniejący verifyPassword ponownie uwierzytelnia do tego samego UUID. Edge odrzuca nieznane pola, w tym user_id/ustawienia prywatności; do SQL przesyła wyłącznie scalar allowlist p_user/p_session/p_request/p_expected/p_nickname. Hasło pozostaje w pamięci Edge, bez SQL/logów/ledgeru.
- Rename używa aktualnej sesji i jednej transakcji z blokadą konta, ponownym session_valid, kontrolą poprzedniej nazwy, UNIQUE oraz idempotencją. Bez begin/finish, operation_pending, zmiany security_version lub zapisu nowych tokenów. Pomyślna zmiana i konflikt zachowują istniejącą sesję; aktualizacja hasła/reset nadal mają odrębne stare zabezpieczenia. Równoległy rename tego samego ownera ma jeden sukces i stale_identity, dwóch ownerów jednego klucza — jeden sukces i nickname_taken.
- Guard chroni przygotowane pseudonimy przed starymi writerami profilu, a jersey-only upsert pozostawia sprawny. Próbę obejścia przez save_premium_profile odrzucono z rollbackiem imienia/display_as/numeru/zgód. Żadnych zmian frontendowego UI/CSS/Ultimate, Auth SessionManager, Storage, meczów ani rozliczeń.

## Co oznacza „nieaktywny”

Migracje tworzą pusty rejestr i nie zmieniają istniejących kont. Przy pustym rejestrze guard nie zmienia starych zapisów. Przygotowanie wykonano **tylko na nowych fikcyjnych kontach nowej testowej instancji**. Produkcyjny index ma bramkę false przy nieustawionej zmiennej; brak nowego przycisku/UI/resolvera. Flagę włączono wyłącznie w generowanym, ignorowanym lokalnym entrypoincie testowym.

Pochodny klucz jest globalnie unikalny dla przygotowanych rekordów; rename sprawdza również nieprzygotowane istniejące profile. Nie twierdzimy, że wszystkie historyczne duplikaty w nieprzygotowanym zbiorze stały się już globalnie unikalne. Nieprzygotowane przyszłe rejestracje i stare aliasy nie zostały jeszcze przełączone. **Nie stosować przygotowania rejestru ani flagi na działającym środowisku** przed skoordynowanym cutover: stary zapis nickname przygotowanego konta jest celowo blokowany, a stary legacy login może być jeszcze inny niż nowe nickname. To nie jest częściowe uruchomienie nowego logowania: login telefonem/legacy/e-mail pozostaje bez zmian w dotychczasowym resolverze, ponieważ cały nowy model pozostaje nieaktywny.

## Faktyczne testy

| Kontrola | Wynik |
|---|---|
| TypeScript / ESLint | PASS |
| Vitest |259 PASS /44 pliki, w tym5 nowych testów bramki/hasła/IDOR/sekretów/odmowy zmiany prywatności |
| SQL / RLS / migracje |47 PASS (28 regresji PR16+19 foundation),38 migracji replay w nowym jednorazowym PostgreSQL; Auth/Storage tego zestawu są fixture |
| Rzeczywisty Supabase |25 PASS HTTP/Auth/Edge/PostgREST na nowym projekcie slm-account-foundation/API57321/DB57322; obie odmiany kont, rzeczywiste równoległe żądania |
| Build aplikacji |PASS; ostrzeżenie o dużych chunkach, bez błędu kompilacji |
| Zachowanie głównej aplikacji/UI |source guards:32 chronione historyczne migracje/runtime,38 łącznych kroków;55 plików Premium PASS; automatyczne wdrożenie wyłączone |
| Telefon / APK / nowa rejestracja / recovery |NOT TESTED; nie są częścią tego fundamentu; brak nowego APK |

25 kontroli HTTP obejmuje: odrzucenie duplikatów preflight z rollbackiem; odmowę rename przed przygotowaniem; oddzielenie wewnętrznego adresu legacy od potwierdzonego e-maila; poprawne hasło legacy i e-mail; idempotencję/konflikt request_id; stale write; błędne hasło bez zmiany lub utraty sesji; dwie równoległe zmiany jednego użytkownika i dwóch różnych użytkowników na tę samą nazwę; niezmienione UUID, imię/nazwisko, display_as, numer, grupy i zgody; refresh zwycięzcy/przegrywającego; brak pending; zapis numeru po rename; rollback starego writera; IDOR/privileged RPC/private registry; rzeczywisty ledger bez haseł; stara zgodność logowania. Nie obiecujemy logowania NOWYM nickname przed przyszłym cutover.

Pierwszy SQL runner ujawnił brak kolumny auth.users.deleted_at w minimalnym fixture — uzupełniono wyłącznie nowy runner, bez zmian historii migracji. Przegląd wykrył, że slm_email_identity może provisionować stan; końcowa migracja zastępuje go czysto odczytowym helperem i dodaje test odmowy aktywacji konta z brakującym security. Wszystkie końcowe asercje bezpieczeństwa przeszły. To nie test zdjęć, odzyskiwania hasła ani pełnego nowego modelu logowania.

## Lokalne odtworzenie

Na tej gałęzi: `python app/scripts/prepare-account-foundation-local.py`, następnie `npx --yes --package=supabase@2.121.0 supabase start --workdir .cache/account-foundation-stack --exclude studio,imgproxy,logflare,vector,realtime,mailpit,postgres-meta,supavisor`. Start tworzy **nową** bazę slm-account-foundation, bez db reset. Klucze z wyniku zachować prywatnie, nie wklejać do raportu. Potem `python app/scripts/prepare-account-foundation-local.py --auth-baseline` oraz `supabase functions serve accounts --workdir .cache/account-foundation-stack`. Baseline helper sprawdza dokładną nazwę/projekt/socket i zachowuje poprzedni kontener Auth, nie usuwa bazy.

Z root: `node app/scripts/test-account-foundation-http-local.mjs`. Z app: `node scripts/test-account-foundation-sql-local.mjs`, `npm run test.unit -- --run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run verify:consolidation`. Runner HTTP wymusza localhost57321, projekt i blokujące hooki. Tworzy nowe fikcyjne konta/grupy i **pozostawia je**. Nie korzysta z hasła ani kont POCO PR16. Jednorazowy SQL to osobny fixture kontener, nie usunięcie rzeczywistych kont Auth. Istniejące sunday-league-mates i slm-pr16-review nie były resetowane/zmieniane. Bez zmian Cloud i bez nowych usług/płatności.

## Pozostałe blokery i następny etap

1. Uzyskać odczytowy raport realnych kolizji/formatów/brakujących profili i pending, uzgodnić mapowanie z właścicielem. Bez automatycznych rename, łączenia UUID lub aktywacji kont.
2. Przygotować spójny cutover: resolver jednego nickname i potwierdzonego opcjonalnego email_login, wyłączenie telefonu, zgodność starych APK i zapisu PR16. Scalony formularz zmiany nickname/imienia/zgód musi zachować atomowość PR16, również przy konflikcie nazwy; obecny foundation_rename zmienia wyłącznie nickname i odrzuca dodatkowe pola.
3. Dopiero wtedy kontaktowy telefon, nowa rejestracja/provisioning, opcjonalne dodawanie e-maila z rzeczywistym potwierdzeniem i bezpieczne recovery. W tym etapie nie wysyłano maili/SMS i nie udawano ich potwierdzenia; potwierdzone adresy fixture tworzy Admin API wyłącznie do testów.
4. Testy odłączenia sieci/utraty odpowiedzi end-to-end, przerwanego pełnego cutover, macierz resetu administratora i odbiór fizycznego Androida pozostają do wykonania. Idempotent retry w tej próbie jest ponowieniem tego samego żądania, nie symulacją fizycznej awarii sieci.

**Status: przetestowany, nieaktywny fundament; nie gotowy nowy Auth. Draft PR, bez merge/deploy/Cloud.** Raport docs/ODPOWIEDZI_CODEX.txt. PR17 pozostawiono jako wcześniejszy audyt i plan.


2026-10-26 19:36 Europe/Warsaw — fundament wypchnięty w2a6113b09e544666106af17051ac10ec90f92357. Utworzono Draft PR #18: https://github.com/psuda87/sunday-league-mates/pull/18. Nowy mechanizm pozostaje nieaktywny; brak merge/deploy. Raport docs/ODPOWIEDZI_CODEX.txt.

# Edycja identyfikatorów konta — audyt i blokada implementacji

2026-10-26 19:01 Europe/Warsaw. Gałąź `feat/premium-account-identifiers` z `origin/main` **134c52b1aee0d0804cc0cf71f151f95040e7a38f** (scalony PR16). Osobny worktree `account-identifiers`. Zgodnie z warunkiem właściciela zakończono na diagnostyce istotnego ryzyka; **nie dodano edycji w UI ani prowizorycznego backendu**. Draft PR dotyczy dowodów i planu naprawy, nie gotowej funkcji.

## Istniejące kontrakty

| Obszar | Legacy | Konto e-mail |
|---|---|---|
| Identyfikator Auth | stały `slm_aliases.technical_email` → Auth e-mail | potwierdzony `auth.users.email` |
| Login w DTO | `slm_aliases.login` | `slm_player_profiles.nickname` — NIE techniczny login |
| Telefon | unikalny `slm_aliases.phone`, logowanie i kontakt | `slm_player_profiles.contact_phone`, tylko kontakt |
| Edycja | Edge `identifiers` + obecne hasło + begin/finish | `identifiers` odrzuca `legacy_only`; `save_email_profile` zapisuje pseudonim i kontakt |
| Pseudonim publiczny PR16 | niezależny `slm_player_profiles.nickname` | to samo pole; nie zmieniać przy operacji identyfikatorów |

Źródła: `app/supabase/functions/accounts/handler.ts`, migracje accounts_module/session_hardening, email_accounts/profile_contacts i obowiązująca B2.2 `20261025160000` oraz PR16 `20261026120000`. Ostatnia definicja B2.2 **zachowuje numer koszulki** przy zmianie kontaktu; historyczna definicja resetująca numer nie jest obowiązującym stanem. Nie wprowadzono poprawki nieistniejącej regresji.

Login: trim + NFC, 3–32 znaków, pierwsza litera Unicode, potem litery/cyfry/_.-. `login_normalized=lower(login)` z UNIQUE w PostgreSQL. Telefon: dokładnie9 cyfr polskich, dopuszczone +48/0048/spacje/nawiasy/myślniki, zapis +48XXXXXXXXX; istniejący zagraniczny alias wolno zachować, nie tworzyć nowego. Triggery `contact_unique` serializują po numerze i sprawdzają konflikt alias/kontakt również między typami kont. Nie jest to potwierdzenie własności numeru.

`verifyPassword` ponownie loguje przez istniejący Auth e-mail i sprawdza UUID, a sesję dowodową odrzuca. Brak przechowywania hasła. Tożsamość operacji pochodzi z Auth/JWT i kontekstu SQL, nie z p_user/user_id formularza. Sensitive rate8/min. Powodzenie legacy wydaje nową sesję, wersjonowanie odbiera dostęp starym sesjom aplikacji, refresh nowej działa. Nie należy utożsamiać cofnięcia dostępu aplikacji z natychmiastowym unieważnieniem każdego JWT Auth.

## Blokery

**B1 — dostępność konta przy wyścigu.** Preflight konfliktu w Edge i dwa RPC `slm_account_begin` / `slm_account_finish` to osobne transakcje. Begin zapisuje operation_id, zwiększa security_version i kasuje zatwierdzone sesje. Jeśli inna zmiana zajmie login przed finish, UNIQUE odrzuca finish, lecz wcześniejszy begin pozostaje zatwierdzony. Konto przegrywające pozostaje operation_pending i nie może zalogować się ponownie. To nie przejęcie cudzej tożsamości: unikalność działa; problemem jest blokada poprawnie uwierzytelnionego konta. Ten sam typ przerwy możliwy między begin i finish przy awarii, bez niezależnego testu awarii sieci.

**B2 — różny model e-mail.** E-mail nie ma technicznego aliasu login/telefon do zmiany; użycie DTO login jako loginu technicznego zmieniałoby publiczny pseudonim. `save_email_profile` wymaga ponownego podania pseudonimu razem z telefonem — to nie izolowany kontrakt zmiany identyfikatora, grozi też nadpisaniem nowszego pseudonimu przez stary formularz. Nie omijano `legacy_only`, nie zmieniano Auth e-maila i nie nadawano fikcyjnych aliasów.

Dodatkowo statycznie: SessionManager.changeSession nie odrzuca drugiej równoległej mutacji; przed udostępnieniem nowego UI potrzebna blokada kontrolera i test retry/równoległości. Dla nieedytowanych legacy publiczny nickname może jeszcze korzystać z fallbacku login; niezależność należy zapewnić również tym kontom, a nie tylko profilom po zapisie PR16. Te dwa przypadki są wnioskami z kodu, bez osobnego pełnego E2E w tej próbie.

## Wykonane testy

- **PASS TypeScript, ESLint, 254 Vitest /43 pliki** — istniejące Auth/session/profile/PR16; żaden nie potwierdza nowej funkcji UI, której nie dodano.
- **PASS build aplikacji**, ostrzeżenie o dużych chunkach. Bez nowego APK/sync/instalacji, bo produkcyjny kod i UI nie zmieniły się.
- **PASS28 SQL/RLS**, replay35 migracji w osobnym tymczasowym PostgreSQL, trwałość po restarcie; Auth/Storage tego zestawu są fixture, nie pełne E2E.
- **20 PASS rzeczywistych kontroli lokalnych HTTP/RPC** + **4 odtworzone symptomy/braki**, `featureReady:false`. Pełny istniejący lokalny stack `slm-pr16-review`, API56321,35 migracji, zgodność źródła działającego Edge z handlerem gałęzi sprawdzona. Auth/Edge/PostgREST są rzeczywiste.
- PASS zmiana loginu i telefonu legacy, nowe logowanie, stare identyfikatory odrzucone, błędny format/hasło, zajęty login, zachowanie pseudonimu/numeru/UUID, odmowa dostępu starym sesjom, refresh nowej, RLS obcych aliasów, odmowa bezpośredniego privileged RPC, spoof p_user/user_id nie zmienia innego konta. E-mail: ponowne logowanie nadal e-mailem, kontakt nie działa jako login; istniejący endpoint zachowuje numer i jawnie przekazany pseudonim.
- Cztery diagnostyczne GAP: e-mail `legacy_only`; SQL23505 drugiego finish; pozostawiony operation_pending; odmowa ponownego loginu przegrywającego konta. To **dowody blokad, nie PASS gotowości funkcji**.

Wyścig odtworzono deterministycznym przeplotem rzeczywistych RPC używanych przez Edge (oba begin przed finish), z prawdziwymi sesjami Auth. Nie deklarujemy odtworzenia naturalnego wyścigu dwóch żądań HTTP na telefonie. Test nie modyfikuje schematu; nowe, wyłącznie fikcyjne konta diagnostyczne pozostawiono, także zablokowane przegrywające. Nie są to konta odbioru POCO z PR16. Nie resetowano żadnej istniejącej bazy, nie zmieniono wcześniejszych kont/notatek/worktree, nie użyto Cloud. Lokalne signup=false i hooki mail/SMS stanowią izolowany profil testowy; nie weryfikowano ani nie zmieniano wskazanej przez właściciela publicznej rejestracji Cloud.

Pierwszy Vitest był zablokowany sandboxowym spawn EPERM; po zezwolonej próbie poza sandboxem254/254 PASS. Pierwsza wersja diagnostyki zakładała historyczny reset numeru e-mail; asercja nie potwierdziła tej hipotezy. Po prześledzeniu nadpisania funkcji przez B2.2 poprawiono test na zachowanie numeru. Końcowy pełny przebieg20 PASS/4 GAP; nie ukryto niepotwierdzonej hipotezy w raporcie.

## Proponowana minimalna naprawa — do osobnego zatwierdzenia

1. Dla legacy ponownie użyć istniejącego verifyPassword, rate/normalizacji i SessionManager. Przygotować świeżą prawdziwą sesję Auth **przed** transakcją. Nowa wersjonowana procedura identyfikatorów musi w jednej transakcji ponownie zweryfikować aktualną sesję i ownera, zablokować konto, zmienić aliasy, zwiększyć wersję i przyjąć nową sesję. Konflikt/wyjątek ma cofać całość i zachowywać starą sesję. Nie zmieniać przepływu hasła przy okazji. Nie stosować begin/finish do lokalnej zmiany aliasów, skoro Auth e-mail pozostaje stały. Nie implementować automatycznego „odblokuj” obchodzącego pending po błędzie.
2. Obsłużyć request_id/idempotencję, konflikt drugiego żądania i utratę odpowiedzi bez przechowywania sekretów; kontroler blokuje równoległe mutacje i czyści hasło po operacji. Testy muszą objąć utratę odpowiedzi/refresh/storage/logout i konflikt kont między sobą, a nie sam disabled przycisku.
3. Dla e-mail decyzja kontraktowa: **najmniejszy zakres** to e-mail logowania tylko do odczytu oraz oddzielna zmiana kontaktu z hasłem, bez parametru nickname. Jeżeli wymagany jest login/telefon jako nowe aliasy logowania także dla e-mail, potrzebny jest osobno zatwierdzony model i migracja powiązań aliasów bez zmiany UUID/Auth e-maila i bez automatycznej konwersji kont na legacy. Obecne slm_email_identity traktuje samą obecność slm_aliases jako legacy, więc proste wstawienie wiersza nie jest bezpieczną integracją.
4. Zachować niezależny publiczny pseudonim, również dla kont z fallbackiem loginu; nie zmieniać członkostw/zgód/rozliczeń. Dopiero po tych kontrolach podłączyć dwa pola w istniejących ustawieniach Premium, bez CSS/Ultimate/pozostałych ekranów.

Nie wysyłać OTP/SMS/e-mail i nie zmieniać auth.phone. Oficjalne `reauthenticate()` wysyła OTP, więc nie zastępuje tu istniejącego potwierdzenia hasłem. Obecne hasło potwierdza kontrolę konta, nie własność nowego numeru. Nie deklarować zweryfikowanego telefonu. Źródła sprawdzone: [Supabase reauthenticate](https://supabase.com/docs/reference/javascript/auth-reauthenticate), [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser), [changelog](https://supabase.com/changelog.md).

## Powtórzenie diagnostyki / POCO

Z katalogu repo na tej gałęzi ustaw `SLM_IDENTIFIER_STACK` na bezwzględny katalog istniejącego przygotowanego `slm-pr16-review`, a następnie `node app/scripts/audit-account-identifiers-local.mjs`. Runner sprawdza localhost56321, projekt Docker,35 migracji, zgodność handlera i wyłączone signup/blokujące hooki; nie przygotowuje ani nie resetuje bazy. Tworzy nowe fikcyjne konta przy każdym przebiegu, bez odczytu hasła konta POCO i bez wypisywania tokenów. Oczekiwany wynik20 PASS/4 GAP oznacza potwierdzony problem, a nie gotowość. Po naprawie należy zastąpić asercje GAP wymaganiami poprawnego działania.

**Na POCO teraz niczego nie zmieniono.** Nie ma nowych pól ani nowego APK. Nie testować wyścigu istniejącym kontem. Po przyszłej naprawie: login/telefon legacy z obecnym hasłem → wylogowanie i logowanie nowymi identyfikatorami → odrzucenie starych → niezmieniony pseudonim/numer/zdjęcie/grupy; błędny format/hasło/zajęty identyfikator bez blokady konta; oba typy kont zgodnie z zatwierdzonym modelem. Wklejać wyłącznie PASS/FAIL, kroki i komunikaty, bez haseł/tokenów/danych osobowych.

**Status: BLOCKED dla implementacji, Draft PR audytowy; bez merge/deploy/migracji.**

# Premium B2/B3 — pseudonim i globalna nazwa konta

2026-10-25 22:25 Europe/Warsaw. Gałąź fix/premium-profile-display-name z aktualnego main edd2e924cc077c67ba804ed4acab6d3e159a15b1. Decyzja: **nie implementować pozornego przełącznika trzech trybów** — potrzebne rozszerzenie schematu/kontraktu, zabronione w tym zadaniu. Zmiany wyłącznie dokumentacyjne, bez kodu aplikacji. Gałąź/PR #14 audytu Cloud nietknięte.

## Co już działa i gdzie

| Mechanizm | Istniejący kontrakt i ograniczenia |
|---|---|
| Login/pseudonim legacy | identifiers + SessionManager.changeSession; obecne hasło, unikalne aliasy serwerowe, nowa potwierdzona sesja. Już podłączony w IdentityEditor, nie implementować ponownie. |
| Pseudonim konta e-mail | save_email_profile i slm_email_profile_save; zapis nickname w slm_player_profiles, nie zmienia technicznego e-maila/Auth. Identyczny dotychczasowy telefon pozwala zapisać sam pseudonim bez zmiany kontaktu. UI Premium pozostawia to pole readOnly, adapter changeAlias słusznie odmawia wysłania identifiers dla e-mail. Istniejący tekst UI sugerujący brak backendu jest zbyt ogólny: dla e-mail backend już istnieje, brakuje bindingu. |
| Unikalność | Legacy login unikalny przez login_normalized, publiczny nickname nie ma takiego ograniczenia i nie jest identyfikatorem logowania konta e-mail. Nie dodawać niezatwierdzonej reguły unikalności pseudonimów. |
| Preferencja konta | slm_profiles.display_as zapisuje globalnie tylko nickname albo full_name; CHECK w20261013191910 oraz save_profile handler odrzucają inny tryb. Brak first_name. |
| Własny profil | profile API zwraca display_as/display_name, adapter zachowuje wybór przy edycji imienia/numeru. Nie ma selektora trzech opcji. |
| Publiczne etykiety/lista B3 | public_player_name preferuje nickname, potem bezpieczny login/fallback. Nie honoruje display_as. useGroups mapuje etykietę z nickname. |
| Karta członka grupy | PremiumGroups renderuje full_name, jeżeli serwer je udostępnił, w przeciwnym razie nickname. To reguła dostępności danych, nie globalny wybór formatu nazwy. |

Źródła: app/src/demo/Identity.tsx, auth/profileAdapter.ts, auth/useOwnProfile.ts, ui/personalProfile.ts, groups/useGroups.ts i PremiumGroups.tsx; app/supabase/functions/accounts/handler.ts (profile/save_profile/save_email_profile/identifiers); migracje20261013191910,20261013193036,20261019171938,20261019172724,20261025160000 i20261025190022.

Dodatkowa niespójność źródeł legacy: identifiers aktualizuje slm_aliases.login, natomiast B3 najpierw bierze slm_player_profiles.nickname utworzony wcześniej z aliasu. Nie ma synchronizacji zmiany loginu do tego nickname. Nie utożsamiać dwóch pól ani nie naprawiać Auth przy okazji. Docelowy publiczny pseudonim powinien mieć jawny kontrakt niezależny od technicznego logowania.

## Minimalne potrzebne zmiany w kolejnym zatwierdzonym zakresie

1. **Nowa migracja**, bez przepisywania historii: rozszerzyć CHECK globalnego display_as do nickname/first_name/full_name; zachować wszystkie obecne wartości i domyślne nickname. Ustalić jawny kontrakt imienia: wyliczanie pierwszego członu istniejącego full_name jest propozycją, nie podstawą do usuwania reszty nazwiska; jeśli potrzebne osobne imię/wiele imion, wymaga ustalenia pola i migracji. Brak danych → pseudonim, bez pustej etykiety.
2. **Kontrakt API i DTO:** walidacja nowego trybu w save_profile/profile/displayName oraz typach/adapterach. Rozdzielić login techniczny i publiczny nickname dla obu rodzajów kont. Dla e-mail można wykorzystać istniejące save_email_profile; dla legacy ten endpoint obecnie odmawia, a identifiers zmienia login i sesję. Publiczny pseudonim legacy bez zmiany logowania wymaga rozszerzenia serwerowego kontraktu. Nie podkładać nickname jako full_name i nie modyfikować technicznego e-maila.
3. **Projekcje nazwy:** serwer ma wyliczać jednolite display_name dla dozwolonego kontekstu; rozszerzyć publiczne/grupowe DTO i selektory, aby karta i lista używały tej samej nazwy. To jest zmiana SQL/API, nie kosmetyczny select. Globalny jest format zapisany w jednym profilu konta; nie dodawać ustawień formatu per grupa.
4. **Zachować granice prywatności:** preferencja globalna nie nadaje prawa dostępu. Istniejąca zgoda per grupa i wyjątek administratora nadal wyznaczają, kto może dostać imię/nazwisko; bez uprawnień fallback do pseudonimu. Nie zerować ani nie włączać share_full_name przy zmianie formatu. Nie rozszerzać RLS ani przekazywać surowego full_name klientowi, żeby klient sam ukrywał nazwisko. Same polityki RLS mogą pozostać, jeśli nowe projekcje korzystają z dotychczasowych bramek; wymagany osobny przegląd i testy, nie automatyczna liberalizacja polityk.
5. **Dopiero wtedy UI:** w istniejącym formularzu trzy opcje Pseudonim/Imię/Imię i nazwisko. Przed przejściem ujawniającym dodatkowe dane (np. pseudonim→imię/full_name, imię→full_name albo nowa wartość już ujawnianego imienia) potwierdzenie „Akceptuję / Anuluj”. Pokazać zakres i informację, że nie zmienia to zgód grupowych. Wszystkie wartości pozostają draftem do akceptacji i Zapisz; Anuluj/przycisk Wstecz = zero wywołań zapisu i powrót do zapisanej preferencji. Potwierdzenie przed **jakąkolwiek** mutacją pól tego formularza. Po akceptacji serwerowy zapis i read-back, blokada wielokliku; błąd nie może pokazywać niepotwierdzonej nazwy jako zapisanej. Brak pozornego rollbacku kilku nieatomowych RPC.

Wymagane testy przyszłej zmiany:3 tryby/persistencja/restart, puste i wieloczłonowe dane, obie tożsamości (e-mail/legacy), prawdziwy save/read-back, brak zmiany telefonu/loginu/sesji przy zmianie publicznej nazwy, potwierdzenie zwiększenia ujawnienia i anulowanie0 mutations, dwie grupy z różnymi zgodami+admin/outsider, identyczny display_name karta/lista, zmiana użytkownika/późne odpowiedzi i błąd zapisu. Nie uruchomiono tych scenariuszy jako funkcji, której backend jeszcze nie zapewnia.

## Wynik tego zadania

- Nie dodano UI ani lokalnej namiastki globalnego wyboru. Wymagania trzech trybów, ich spójności oraz potwierdzenia nie są obecnie dostarczone. Zgodnie z punktem8 zadania przerwano implementację zależną od rozszerzenia backendu; pozostała część pracy to konkretny plan i weryfikacja istniejącego kodu.
- Nie zmieniono Auth, Edge, SQL/RLS, danych, APK/config, CSS/Ultimate/BottomNav ani żadnych plików gałęzi audytu Cloud. Nie wykonywano żadnych operacji Supabase Cloud ani lokalnych migracji. B1/B2/B3 pozostają w dotychczasowym stanie.
- **PASS:**21 istniejących testów w2 plikach (profileAdapter.test.tsx i groups/useGroups.test.tsx), TypeScript, source guards32/55, git diff --check. Testy w pamięci z kontrolowanym API, nie test rzeczywistego Supabase ani POCO. Nie powtarzano pełnych buildów/lint/Cypress/SQL, ponieważ aplikacja nie została zmieniona.
- PR dokumentacyjny do przeglądu potrzebnego kontraktu, bez merge. Dalsza implementacja wymaga osobnego polecenia dopuszczającego migrację/kontrakt; nie jest częścią tej poprawki.

Draft PR #15: https://github.com/psuda87/sunday-league-mates/pull/15; przegląd911c381, dokumentacja bez zmian aplikacji i bez merge.

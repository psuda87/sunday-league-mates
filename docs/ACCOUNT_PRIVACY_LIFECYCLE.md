# Telefon i usuwanie konta — kandydat do przeglądu

2026-11-04. Gałąź `feat/premium-legal-pages`, baza `5d39c00`.
Zmiany są lokalne i przygotowane do wdrożenia. Nie zmieniono produkcji,
konfiguracji Vercel/Supabase/Brevo, sekretów, CI ani aktywnych pinów.
Nie usuwano prawdziwych kont. Migracja nie wykonuje usuwania danych przy wdrożeniu.

## Zachowanie

- Telefon pozostaje opcjonalny w rejestracji e-mail; można go usunąć także
  z konta legacy. Login i techniczna tożsamość legacy pozostają bez zmian.
  Zachowany numer legacy nadal służy do logowania, usunięty przestaje być aliasem.
- `slm_profiles.share_phone` domyślnie `false`, również dla istniejących kont.
  Formularz telefonu ma świadome włączenie udostępniania i potwierdzenie hasłem.
- Serwer zwraca numer tylko właścicielowi albo aktualnemu członkowi wspólnej,
  niezamkniętej grupy, po włączeniu udostępniania przez właściciela. Administrator
  nie ma wyjątku. Zmiana/usunięcie telefonu resetuje zgodę; zapisana jawnie zgoda
  dla nowego numeru może ją ponownie włączyć w tej samej operacji.
- Migracja koryguje aktualne projekcje SQL (legacy, mecze, grupy, prośby), zamyka
  surowy odczyt tabel kontaktowych i historycznej tabeli proof. Wszystkie odpowiedzi
  `accounts` dodatkowo przechodzą przez bieżącą serwerową projekcję uprawnień,
  również odpowiedzi z cache. Celowo pominięty numer w kandydatach pozostaje pusty.
  Nie ma publicznego RPC pozwalającego podstawić innego odbiorcę numeru.
- Wyłączenie zgody, opuszczenie grupy lub usunięcie numeru blokuje kolejne odczyty
  API. Nie da się zdalnie usunąć kopii wcześniej zapisanej przez odbiorcę.

## Usuwanie

Ustawienia profilu → „Usuń konto” → obecne hasło i dokładna fraza `USUŃ KONTO`.
Backend ponownie uwierzytelnia bieżącego użytkownika; identyfikator konta z treści
żądania nie jest przyjmowany. Administrator grupy z innymi członkami musi wcześniej
użyć istniejącego przekazania administratora. Jednoosobowa grupa zostaje zamknięta.

Trwała kolejka w prywatnym schemacie przechowuje fazy `prepared → purged → complete`:

1. Transakcja sprawdza grupy, blokuje dostęp konta i unieważnia jego sesje.
2. Storage API usuwa bieżące zdjęcia oraz osierocone obiekty w katalogu konta.
3. Transakcja usuwa członkostwa, prośby i cache z danymi osoby, redaguje historię
   i odłącza jej klucze od zachowanych faktów finansowych. Kwoty i klucze pozycji
   pozostają. Zmiany omijające niezmienność księgowania są ograniczone do usuwania
   tożsamości przez właścicielski proces; zwykły service-role nie otrzymuje takiego
   uprawnienia w triggerze.
4. Admin API usuwa Auth, a ponowny odczyt musi potwierdzić brak użytkownika.
   Kaskady usuwają profil, aliasy, dane kontaktowe, metadane zdjęcia i dane własne.
5. SQL potwierdza brak konta i obiektów Storage oraz brak aktywnego wcześniejszego
   uploadu zdjęcia. Dopiero wtedy kasuje identyfikator osoby z kolejki i potwierdza
   zakończenie. Klient usuwa sesję i wraca do logowania.

Upload zdjęcia ma krótką dzierżawę w bazie. Nowa dzierżawa wymaga aktualnej sesji;
niepewny timeout uploadu utrzymuje ją do wygaśnięcia. Zapobiega to potwierdzeniu
usunięcia podczas wcześniejszego wysyłania pliku. Prywatne obiekty nadal podlegają
dotychczasowym zabezpieczeniom dostępu.

Ponowienia korzystają z identyfikatora operacji, losowego dowodu 256 bitów i
dzierżawy serwerowej. Dowód klienta jest tylko w pamięci formularza; nie trafia do
URL, lokalnego magazynu ani logów. Po utracie karty przeglądarki serwerowy worker
dokańcza operację. Częściowy błąd nie jest sukcesem ani cofnięciem wykonanych etapów.

Historia jest odłączana od konta i redagowana, a nie automatycznie uznawana za
całkowicie anonimową. Redakcja tekstu dotyczy rekordów powiązanych z identyfikatorem
osoby i całych tokenów; nie zmienia podobnych nazw ani historii innych osób.
Obiekty historii zawierające identyfikator osoby tracą również historyczne kontakty.

## Powiadomienie i ponowienia

Istniejący SMTP/Brevo wysyła po zakończeniu wiadomość na wskazaną przez właściciela
skrzynkę administracyjną z tematem „SLM — usunięto konto użytkownika”. Zawiera tylko
czas UTC, identyfikator operacji, potwierdzenie zakończenia i ogólną informację o
zachowanych faktach historycznych. Nie zawiera ID użytkownika, hasła ani kontaktów.

Awaria SMTP pozostawia zakończoną operację i oczekujące powiadomienie. Worker
przetwarza do 5 zadań, z dzierżawą i narastającym opóźnieniem do doby. SMTP ma stały
Message-ID dla operacji; przy utracie potwierdzenia dostarczenia możliwy jest
duplikat wiadomości. Nie deklarujemy gwarancji dokładnie jednej wysyłki.
Worker wymaga serwerowego service credential i odrzuca wywołania przeglądarkowe.

## Weryfikacja

- PASS TypeScript frontend (każdy build), strict Edge i ESLint.
- PASS Vitest: 503 testy w 71 plikach; obejmuje dotychczasowe Auth,
  rejestrację bez telefonu, profile, redakcję, awarie Storage/Auth/SMTP i ponowienia.
- PASS SQL: odtworzenie wszystkich 46 migracji z bieżących źródeł w świeżej bazie
  `slm_privacy_test_*` kontenera `slm-main-stabilization`, następnie istniejący
  `minimum_phone.sql` i nowy `account_privacy.sql`. Sprawdzone opt-in/out, wspólna
  grupa/obcy/anonim, wyjście z grupy, rzeczywiste role anon/authenticated, legacy,
  FK, przyjęte płatności obu modeli, historia, grupy, dzierżawa uploadu i kolejka.
  Baza scratch została usunięta; istniejąca baza `postgres` nie była migrowana.
- PASS Cypress: 2 scenariusze na produkcyjnym lokalnym buildzie Premium, wszystkie
  odpowiedzi API kontrolowane i fikcyjne. Usunięcie numeru, domyślne wyłączenie
  zgody, hasło/fraza, częściowa awaria, ten sam dowód przy ponowieniu i wylogowanie
  dopiero po potwierdzeniu. Nie jest to test prawdziwego GoTrue/Storage/Brevo.
- PASS build LIVE, demo (izolacja 16 plików), Premium web i 3 testy konfiguracji web.
- FAIL strażników zatwierdzonego źródła: nowa migracja46 poza listą45,
  `Profile.tsx` z minimalnym wejściem do żądanej funkcji i zmienione źródła Auth.
  82 testy polityki zatrzymują się na niezaakceptowanym pinie Profile. Nie jest to
  zaliczenie kontraktu Premium. CSS, karta, nawigacja i zatwierdzone zasoby bez zmian.
  Aktywne piny, manifest55 i CI wymagają osobnego przeglądu właściciela; nie zostały
  zmienione w celu uzyskania zielonego wyniku.

## Kolejność wdrożenia — jeszcze niewykonana

1. Osobny przegląd dokładnego diffu migracji, backendu i niewielkiego dodatku do
   ustawień Premium. Kandydat hashy jest w `review/account-privacy-manifest.json`;
   nie jest aktywnym zatwierdzeniem. Dopiero po odbiorze aktualizacja strażników.
2. Przed wdrożeniem porównać schemat Cloud ze źródłami. Wdrożyć wyłącznie nową
   migrację `20261104183413_account_privacy_lifecycle.sql`, bez resetu i bez zmiany
   danych produkcyjnych testami. Domyślna prywatność zaczyna działać w tym kroku.
3. Wdrożyć istniejącą Edge Function `accounts` wraz z jej helperami. Zachować
   działające CORS, SMTP, podpis hooka i konfigurację Supabase Auth. Nie tworzyć
   osobnego backendu. Obecne sekrety SMTP są wystarczające.
4. Sprawdzić dostępne na bezpłatnym projekcie pg_cron, pg_net i Vault. W Vault
   zapisać istniejące serwerowe poświadczenie pod nazwą `slm_accounts_worker_key`,
   bez zapisywania wartości w repo/logach. Zastosować przygotowany
   `app/supabase/account-privacy-worker.sql` (co 5 minut, HTTP tylko dla niepustej
   kolejki). Brak tych elementów blokuje publikację funkcji usuwania, nie upoważnia
   do płatnego planu. Sprawdzić działanie ponowienia i monitoring błędów kolejki.
5. Wdrożyć Premium web do istniejącego `slm-ui-demo`; zachować dotychczasowe
   wartości VITE, HTTPS dokumentów, root `app`, build `npm run build:premium-web`
   i output `dist-premium-web`.

## Odbiór i TODO

Na Vercel wyłącznie nowymi jednorazowymi kontami: rejestracja bez telefonu,
potwierdzenie e-mail, logowanie/recovery; dwa konta we wspólnej grupie i obcy,
opt-in/out/wyjście z grupy także przez bezpośrednie API; usunięcie konta ze zdjęciem,
ponowne logowanie niemożliwe, brak obiektów i danych osobowych, nienaruszone kwoty;
odmowa dla jedynego administratora, transfer, zamknięcie grupy jednoosobowej;
doręczenie minimalnego powiadomienia Brevo i ponowienie po kontrolowanej awarii.
Nie wykonywać tego na prawdziwych kontach właściciela lub graczy.

TODO przed publicznym odbiorem prawnym: administrator i dane kontaktowe, uzasadnione
okresy oraz podstawy retencji historii, harmonogram usuwania zakończonych zadań i
wiadomości administracyjnych, kopie zapasowe/logi dostawców, jednostki umowne i
transfery. Nie wprowadzono arbitralnej retencji ani deklaracji pełnej anonimowości.
Dowolny tekst wpisany przez innego użytkownika bez identyfikatora osoby oraz
zewnętrzne kopie wymagają indywidualnej oceny żądania; nie obiecujemy automatycznego
rozpoznawania każdej wzmianki o osobie. Szersza przebudowa historii/retencji poza
tym zakresem. Brak testu prawdziwego usunięcia przez GoTrue i fizycznego Storage
oraz dostarczenia powiadomienia Brevo — wymagany odbiór jednorazowymi kontami.

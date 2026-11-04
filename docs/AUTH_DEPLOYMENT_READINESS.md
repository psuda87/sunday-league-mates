# Auth — finalizacja strażników i przygotowanie wydania

2026-11-04. Gałąź `feat/premium-legal-pages`, wejściowy HEAD
`2416945ff5dc5994dce35877e52ec401aafc8550`; drzewo początkowo czyste.
Właściciel jawnie zatwierdził wyjątki prywatności/usuwania i poprawkę powrotu
do karty. Ten etap zmienia wyłącznie strażniki, ich testy i dokumentację.

## Przypięcia i zakres

- `bab1acc209438dca841cdce2795dd6e52dd93e81`: dokładne 21 plików z utrwalonego
  w tym commicie `docs/review/account-privacy-manifest.json`, w tym Profile,
  formularz telefonu/usuwania, adaptery, Edge, zdjęcia, SQL46 i worker oraz testy.
- `2416945ff5dc5994dce35877e52ec401aafc8550`: dokładnie sessionManager,
  useB1Lifecycle, B1App.test i sessionResume.test. Lista porównywana z niezmiennym
  obiektem commita; pozostałe źródła Auth zachowują poprzedni commit zatwierdzenia.
- Piny źródłowe mają pierwszeństwo tylko dla wyliczonych plików. Zmiana listy lub
  choćby bajtu źródła jest odrzucana. Dodano 9 negatywnych przypadków strażników.
- `premium318-contract.json` (55 plików) i `consolidation-sources.json` bez zmian.
  Historyczne hashe nie zostały przepisane. Profile ma dokładny wyjątek ze źródła
  bab1acc; karta, CSS, nawigacja, routing LIVE i inne elementy pozostają chronione.
- Poprzedni `account-privacy-guards-proposed.patch` zaktualizowano do faktycznie
  zastosowanego diffu względem 2416945. Jest archiwalnym zapisem tej aktualizacji,
  nie poleceniem ponownego stosowania na HEAD.

## Wyniki

Wstępnie PASS: strażniki źródeł, 82 dotychczasowe testy polityki, 9 nowych
negatywnych testów i 92 testy funkcji objętych zmianą. Następnie jeden pełny przebieg:

- PASS 91/91 testów polityki; kontrakt Premium55 i13 granic importów;
- PASS strict Edge, TypeScript frontend, ESLint;
- PASS 509/509 Vitest w72 plikach;
- PASS build LIVE, demo i Premium web; izolacja demo16; 3 testy konfiguracji web;
- PASS SQL: 46 migracji w świeżej bazie scratch lokalnego slm-main-stabilization,
  existing minimum_phone oraz account_privacy (RLS/FK/finanse/historia/upload).
  Baza testowa usunięta, istniejąca baza postgres nie była migrowana;
- PASS Cypress15/15: pięć istniejących plików LIVE13 scenariuszy oraz Premium2.
  Każdy plik wykonany raz w pełnym przebiegu, lokalne buildy, fikcyjne API;
- bez zmian źródeł CSS, nawigacji, kart i manifestów historycznych względem
  wejściowego HEAD. Wynik builda Premium zachowuje CSS `index-ChAQUkSI.css`.

Nie wykonywano testów prawdziwej wysyłki Brevo, fizycznego usuwania kont w Cloud,
instalacji Androida ani hosted CI. Ostrzeżenia o wielkości bundle, przestarzałych
danych Browserslist i Electron nie blokowały buildów/testów. Nie zmieniano zależności.

## Odczyt konfiguracji — bez sekretów i zmian zdalnych

Supabase: projekt `hjtcyybkxebvdropchac`. Odczytano wyłącznie metadane rozszerzeń,
funkcji, ograniczeń i historii migracji; w Vault policzono wpis po nazwie,
bez odczytu jego wartości i bez odczytu `vault.decrypted_secrets`.

- Vault0.3.1 zainstalowany; pg_cron i pg_net są dostępne, ale NIE zainstalowane.
  Sygnatury cron.schedule/net.http_post wymagane przez worker nie istnieją.
- Wpis Vault `slm_accounts_worker_key`:0. Nie pobierano żadnych istniejących kluczy.
- Cloud ma43 wpisy migracji. Brak wpisów `20261019171627_slm_v2_inbox_alias` oraz
  `20261019171834_slm_v2_finance_notifications_guard`. Migracja accounts_email_ui
  ma w Cloud wersję20261104131358, lokalnie20261104090000. Sama różnica historii
  nie dowodzi braku wszystkich efektów SQL ani nie upoważnia do powtórnego replay.
- Potwierdzony brak `slm_private.group_payment_identity_guard()` stanowi realną
  blokadę: migracja46 odwołuje się do tej funkcji przez regprocedure, więc obecnie
  zakończyłaby się błędem. slm_email_identity(text,uuid) i wymagane ograniczenia
  slm_payments_check/slm_settlements_check istnieją. Nie badano danych użytkowników.

Vercel: istnieje `slm-ui-demo`, projekt `prj_0WHMoDOj2JNVNanziuU4FfLPEhoI`,
Node22.x, bieżące wdrożenie produkcyjne READY. Domeną docelową pozostaje
`https://slm-ui-demo.vercel.app`. Projekt ma ochronę preview; odbiór preview musi
uwzględniać istniejący dostęp właściciela. Nie zmieniano ochrony ani domen.
Lokalny app/vercel.json: build:premium-web, output dist-premium-web, ścisły CSP,
automatyczny deployment Git wyłączony. Root app trzeba potwierdzić przy ręcznym
wydaniu; uproszczona odpowiedź get_project nie udostępniła root/build ustawień.
Nie odczytywano wartości zmiennych środowiskowych ani sekretów Vercel/Supabase.
accounts zachowuje verify_jwt=false, ponieważ signup/login nie mają jeszcze JWT;
handler nadal sam weryfikuje sesje, a worker wymaga serwerowego poświadczenia.

## Dokładna kolejność przyszłego wdrożenia

**Teraz NO-GO produkcji.** Poniższe kroki wymagają osobnego polecenia wdrożenia.

0. Uzgodnić schemat Cloud z wersjonowanymi źródłami: porównać definicje i skutki
   brakujących kroków, odtworzyć wykryte różnice na izolowanej bazie testowej,
   przygotować selektywne bezpieczne uzupełnienie brakującego guardu/triggera.
   Potwierdzić równoważność accounts_email_ui mimo innego timestampu. Nie uruchamiać
   zbiorczego db push, resetu ani oznaczania migracji jako wykonane bez dowodów.
   Ponowić lokalną próbę SQL46 z rzeczywistym zestawem zależności Cloud.
1. Po odbiorze powyższego sprawdzić plan Free i dostępność schedulerów; zaplanować
   aktywację pg_cron/pg_net oraz wpis Vault `slm_accounts_worker_key` bez ujawniania
   wartości w plikach/logach. Przed zmianą sprawdzić docelowy projekt, wersję Edge,
   root app, build/output i nazwy wymaganych konfiguracji. Zachować istniejącą
   konfigurację Brevo, hooka, signup, callbacku, CORS i potwierdzeń e-mail.
2. Zastosować wyłącznie odebraną migrację46
   `20261104183413_account_privacy_lifecycle.sql`. Nie usuwa ona kont przy wdrożeniu;
   ustawia istniejącym kontom prywatność telefonu. Zweryfikować schemat/uprawnienia.
3. Wdrożyć istniejącą `accounts` z helperami z zatwierdzonych źródeł, bez nowego
   backendu i bez nadpisywania sekretów. Sprawdzić login/profile, ograniczenia
   prywatności i odrzucanie klienta wywołującego worker. Nie uruchamiać usuwania
   na kontach rzeczywistych. W razie błędu zatrzymać wydanie przed frontendem.
4. Zastosować przygotowany `app/supabase/account-privacy-worker.sql` dopiero po
   spełnieniu jego warunków. Sprawdzić jedno zadanie slm-account-privacy co5min,
   brak żądań HTTP przy pustej kolejce i bezpieczny dostęp do poświadczenia Vault.
   Nie ujawniać go w treści zapytania ani wynikach. Nie włączać płatnych usług.
5. Zbudować i wdrożyć Premium web z ustalonego commita do istniejącego slm-ui-demo,
   root app, build npm run build:premium-web, output dist-premium-web. Zachować
   VITE_SLM_TERMS_URL/VITE_SLM_PRIVACY_URL wskazujące HTTPS docelowej domeny,
   callback auth/callback oraz dotychczasowy CSP. Sprawdzić publiczne strony200.
6. Odbiór WYŁĄCZNIE kontami jednorazowymi: signup bez telefonu, realny mail,
   weryfikacja/login/recovery; opt-in/out, wspólna/obca grupa i anonimowe API,
   wyjście z grupy, usunięcie numeru legacy; usunięcie konta ze zdjęciem i próbą
   równoczesnego uploadu, odmowa dla administratora/transfer/zamknięcie grupy,
   zachowanie kwot i brak PII, potwierdzony brak Auth i Storage, brak ponownego
   logowania. Sprawdzić minimalne powiadomienie Brevo i ponowienie po awarii.
   Sprawdzić szybkie zmiany kart Chrome, brak migania, blokadę offline i cofnięcia.
7. Dopiero po odbiorze zakończyć wydanie. Przy problemie zatrzymać frontend i
   sprawdzić stan etapów kolejki; nie resetować bazy, nie przywracać usuniętych
   tożsamości ani nie cofać zakończonego usuwania z powodu niedoręczonego maila.

Braki danych administratora, prawne podstawy/okresy retencji i kopii zapasowych
w dokumentach pozostają jawnie oznaczone; finalizacja strażników ich nie zastępuje.
GO dla odebranych źródeł i strażników; NO-GO dla wdrożenia do obecnego Cloud.

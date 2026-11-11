# PR #48 — kontrola przed wydaniem, 2026-11-11

Gałąź raportu `codex/pr-48-release-check`. [PR #48](https://github.com/psuda87/sunday-league-mates/pull/48) jest otwarty i bez konfliktów. Sprawdzono `fix/public-profile-photos` (`d888013`) po próbnym scaleniu `0104aa0` z `main` (`51211af`). Scalanie i publikacja są wstrzymane.

- Przeszły buildy LIVE i Premium web, lint, kontrola typów Edge oraz `git diff --check`. Vitest 526/527, w tym testy zdjęć grupowych. Test treści błędu logowania nie przechodzi również na `main`. Mobilny Cypress z kontrolowanym API zaliczył 2/4 testów na obu rewizjach. Te same dwa błędy dotyczą otwarcia grupy przez dzwonek i przycisku przejścia do grup.
- GitHub pominął obie kontrole CI. Kontrola konsolidacji przechodzi na `main`, a w PR odrzuca zmianę chronionego handlera `accounts`. Kontrola zamrożonego UI odrzuca już `app/src/account-ui/model.ts` na `main`. Testy `premium-policy` na wyniku próbnego scalenia również nie przeszły. PR nie zmienia arkuszy stylów ani routingu.
- [Główny adres](https://slm-soccer.vercel.app) zwraca HTTP 200 i wskazuje na istniejące wdrożenie Vercel READY `1baf893`. Supabase odrzuca z tej domeny sprawdzenie CORS i anonimowy odczyt sesji kodem 403. Z `slm-ui-demo.vercel.app` zwraca odpowiednio 204 i oczekiwane 401.
- W Supabase aktywna jest `accounts` v26. Jej kod obsługuje `profile_photo_group_list` po sprawdzeniu członkostwa i podpisuje adresy na 120 s. Wersja na GitHubie różni się m.in. akcjami usuwania konta. Nie wykonano zmian w Supabase, migracji ani wdrożenia Vercel. Nie testowano zalogowanej sesji i zdjęć na głównej domenie ani lokalnej integracji SQL.

Przed wydaniem wymagane są przegląd chronionych źródeł i aktualizacja listy dozwolonych domen Supabase o dokładny adres `https://slm-soccer.vercel.app`, a następnie ponowna kontrola i test zalogowanej sesji.

---

# Grupy — odbiór właściciela, 2026-11-07

Właściciel zaakceptował 7 poprawek i wyraził zgodę na scalenie `feat/groups-ux-acceptance` do `main` przez [PR #39](https://github.com/psuda87/sunday-league-mates/pull/39). Przed scaleniem ponownie przeszły oba strażniki. Wersja testowa na Vercel pozostaje na `3235037`; etap odbioru nie uruchamia kolejnego wdrożenia ani migracji. Następny moduł rozpoczynamy od zaktualizowanego `main` po potwierdzeniu scalenia.

---

# Grupy — pełny PASS i publikacja, 2026-11-06

`feat/groups-ux-acceptance`, wdrożony commit `3235037`.
Vercel production READY: https://slm-ui-demo.vercel.app,
deployment dpl_5Mk9J2YHJVSpAYRErqKuSZgCRUDE. PASS HTTPS200 strony/JS/dokumentów,
renderowanie logowania, poprawny endpoint i CORS oraz rzeczywiste logowanie po publikacji.
7/7 punktów GOTOWE. PASS: oba strażniki, 107 testów ich odporności,
524 Vitest, 4 mobilne Cypress, TypeScript/lint/build Premium/Edge, lokalne SQL/RLS48.
Cloud: tylko migracja nicków20261106223406 i accounts18; signup race200/409,
Gmail verify, login, edycja/case/rename i konflikty409, grupy/uprawnienia/liczniki PASS.
Zachowane CORS/SMTP/Brevo/Auth/sekrety. Bez migracji prywatności, workerów,
resetu i merge do main. Dwa fikcyjne konta i grupa pozostawione jako dane odbioru.
Brak otwartych blokad; następny krok: odbiór użytkownika, osobna decyzja o merge.
Pełna tabela, commity, manifest Cloud i zachowana historia wyników:
[raport](GROUPS_UX_ACCEPTANCE_REPORT.md).

---

# Grupy — PASS przed publikacją, 2026-11-06

`feat/groups-ux-acceptance`. Zgoda właściciela na przegląd strażników, Cloud i Vercel po PASS.
PASS: oba strażniki, 107 testów ich odporności, 524 Vitest, 4 mobilne Cypress,
TypeScript, lint, build Premium, Edge typecheck, lokalne SQL/RLS48 i test wyścigu.
Cloud: tylko migracja nicków 20261106223406 i accounts18 (patch2 plików);
CORS/SMTP/Brevo/Auth/sekrety zachowane. PASS signup race200/409, Gmail verify,
login, rename/case change/konflikt409 oraz grupy/uprawnienia/liczniki.
Vercel: publikacja przygotowana, wynik po kontroli. Bez merge do main.
Pełna tabela7 i zachowane wcześniejsze wyniki: [raport](GROUPS_UX_ACCEPTANCE_REPORT.md).

---

# Grupy — odbiór UX, 2026-11-06

`feat/groups-ux-acceptance`, implementacja `3596de1`, push wykonany.
Uzupełnione 7 punktów: popup, zgłoszenia, panele, przycisk grup, wyniki,
dzwonek administratora i licznik zarządzania; nicki z atomowym ograniczeniem SQL.
PASS: build LIVE/Premium, TypeScript, lint, Edge typecheck, 524 Vitest,
4 mobilne Cypress z fikcyjnym API, 48 lokalnych migracji i SQL/RLS/uprawnienia,
race rejestracji nicku, diff --check. Oględziny zrzutów mobilnych; bez telefonu/APK.
FAIL: verify:consolidation (lista migracji) i verify-frozen-ui (GroupScreens).
Strażników nie zmieniono: wymagany osobny przegląd właściciela. Brak pełnego PASS.
Cloud tylko odczyt schematu/RLS; zero wdrożonych migracji/Edge Functions,
bez resetu, Vercel i merge. Testy SQL w tymczasowej bazie slm-main-stabilization.
Następny krok: przegląd chronionych zmian i strażników, ponowny odbiór.
Pełna tabela 7 punktów, wyniki i ograniczenia: [raport](GROUPS_UX_ACCEPTANCE_REPORT.md).

---

# APK Premium odpowiadające Vercel62baac5

2026-11-05, `feat/premium-legal-pages`, wejściowy HEAD dokumentacyjny `b46fd11`;
kod aplikacji identyczny z wdrożonym `62baac5`. PASS build:premium-web, Capacitor
sync wariantu B1 z HTTPS i Gradle assembleDebug --offline na JBR Android Studio.
APK lokalne: `.cache/android-auth/slm-premium-62baac5-debug.apk`, 9629989 bajtów.
SHA256: `c9f330ec49ef4dee83ec87d4d1fc2926b33629652f0bd96a9e9fe46ed0effe08`.
PASS podpis APK v2/apksigner, aapt: pl.psuda87.slm / Sunday League Mates /1.0.
PASS kontrola ZIP: identyczny JS Premium, właściwy HTTPS Supabase i nowe płatności,
logging none, WebView debugging false, mixed content false, bez server override.
Artefakt debug do testów ręcznych, poza Git; nie instalowano ani nie uruchamiano
na urządzeniu. Nie zmieniano kodu, backendu, migracji lub Vercel; pełnej regresji
nie powtarzano. Dwa pliki wygenerowane przez sync przywrócono do treści HEAD.

---

# Vercel — aktualny frontend opublikowany

2026-11-05, `feat/premium-legal-pages`. Na wyraźne polecenie właściciela
wdrożono commit aplikacji `62baac5a1983b09b48c7b2ecbdaa3f005a6fc6dd` do istniejącego
`slm-ui-demo`, production, deployment `dpl_G6oR3jvvNW7CHNCqRkKRerXmWikT`.
Vercel READY; publiczny alias https://slm-ui-demo.vercel.app wskazuje ten deployment.
Root app, build npm run build:premium-web, output dist-premium-web; konfiguracja
repo/CSP, Auth, Supabase, migracje, sekrety i CI nie były zmieniane w tym zadaniu.
PASS zdalny build Premium. PASS rzeczywiste HTTPS200 dla strony głównej,
regulaminu, polityki i JS /assets/index-BDtDeAiT.js. W serwowanym JS potwierdzono
ostatnie kafelki/odświeżanie płatności i oba prawidłowe adresy HTTPS dokumentów.
To kontrola publikacji, nie nowy test rzeczywistego logowania lub płatności.
Git push i ls-remote potwierdziły62baac5 na origin; raport zapisany później jako
osobny commit dokumentacyjny. Pozostawiono zastany nieśledzony build dist-demo-six.
Nie powtarzano zaliczonych testów. Znane ograniczenia: strażniki wymagają przeglądu
pinów (bez wyłączania kontroli); backend prywatności/usuwania46 nadal niewdrożony.
Sam deploy frontendu nie oznacza aktywacji tych funkcji ani gotowości merge do main.

---

# Profil płatności — rozróżnienie zgłoszeń i odświeżanie

2026-11-05, `feat/premium-legal-pages`, baza `e560e01`.
Odczyt Cloud bez zmian danych potwierdził: u fikcyjnego administratora zaakceptowane
23zł dotyczy rozegranego meczu4.11, a osobne oczekujące23zł nadchodzącego6.11,
bez zatwierdzonego naliczenia składek. Nie był to duplikat dla tego samego meczu.
Stare zgłoszenie powstało przed blokadą47; nie akceptowano ani nie usuwano go.
Profil uzupełnia brakującą nazwę meczu wyłącznie przez autoryzowany matches_detail,
sprawdza identyfikator/grupę/dostęp i ignoruje nieaktualne odpowiedzi sesji.
Pokazuje odrębnie brak naliczenia i rzeczywiste oczekiwanie; pending dla faktycznie
opłaconego tego samego meczu ma opis nieaktualnego zgłoszenia, bez fałszywej
zmiany statusu na accepted. Odśwież płatności odczytuje też konto, nie tylko portfel.
PASS:17 testów finansów (w tym3 nowe regresje), TypeScript, lint, build Premium,
git diff --check. Podgląd5196 zaktualizowany. Bez migracji, zmian backendu/Auth,
Vercel, istniejących wpłat i pozostałych modułów. Pełnej regresji nie powtarzano.

---

# Kafelki płatności i odstępy szczegółów meczu

2026-11-05, `feat/premium-legal-pages`; wejściowy HEAD `6ef348f` (nie cofano do
historycznego281e4f1). Przeniesiono dokładnie77 dodanych linii premiumEvents.css
z `bdfeff24b6ed6b3695fc4fc833daf6e720d6f6cd`, bez innych plików z tej gałęzi.
Kafelek należności: zawodnik, mecz/kwota i3 przyciski w jednym rzędzie
Akceptuj/Odrzuć/Anuluj. Zgłoszenie wyróżnia zielona obwódka Akceptuj i tekst;
brak zgłoszenia czerwona obwódka. Pozostałe kolory z aktywnej palety Premium.
Akceptuj bez zgłoszenia używa istniejącej ręcznej wpłaty, po pełnym opłaceniu
pozycja znika z bieżących; anulowanie zatwierdzonej wpłaty dostępne w historii.
Przyciski niepasujące do stanu pozostają widoczne i nieaktywne. Częściowa wpłata
zachowuje rzeczywistą pozostałą należność, nie oznacza jej fałszywie jako opłaconej.
PASS:14 scoped Vitest, TypeScript, lint, składnia CSS/PostCSS, dokładna zgodność
event CSS z bdfeff24, produkcyjny build Premium i git diff --check.
Nie powtarzano pełnej regresji/strażników; wcześniejsza blokada pinów pozostaje.
Bez zmian backendu, Auth, migracji, CI i historycznych manifestów; bez deployu
Vercel, instalacji APK i merge do main. Lokalny podgląd5196 odświeżony nowym buildem.

Android Studio, istniejący lokalny build HTTPS w tej kopii: w katalogu `app`
skopiować `dist-premium-web/*` do `dist-b1` (rekurencyjnie), ustawić
`$env:SLM_B1_ANDROID='1'` oraz `$env:SLM_ANDROID_STAGE3='0'`, wykonać
`npx cap sync android`, otworzyć `app/android`, wybrać urządzenie i Run.
Nie używać build:demo ani starszego build:premium-local z lokalnym endpointem.
W tym zadaniu natywnego sync/build/uruchomienia nie wykonywano.

---

# Płatności — nowy podgląd i backend

2026-11-05, feat/premium-legal-pages. Kafelki decyzji administratora, ręczne wpłaty,
anulowanie z kompensacją, osobna historia i zgłoszenie z własnego profilu.
PASS: TypeScript, lint, Edge typecheck,518 Vitest,14 scoped po ostatniej poprawce,
SQL47 migracji w izolowanej bazie i wyścig dwóch transakcji, Cypress mobilny,
build Premium. FAIL: istniejący strażnik pinów Profile.tsx; kontroli nie zmieniono.
Za wyraźną zgodą wdrożono tylko migrację payment_workflow i accounts17
(trzy mapowania409 na bazie accounts16; wszystkie10 plików zweryfikowane).
Podgląd5196 zaktualizowany HTTP200; Vercel bez zmian do osobnego przeglądu pinów.
Bez zmian Auth i pozostałych modułów, bez migracji prywatności46 i kont realnych.
Następny krok: odbiór fikcyjnych wpłat przez właściciela i przegląd pinów.
Szczegóły: [PAYMENT_WORKFLOW.md](PAYMENT_WORKFLOW.md).

---

# Testowe mecze i składki — gotowe

2026-11-05, `feat/premium-legal-pages`. Na wyraźne polecenie właściciela powstał
odseparowany fikcyjny zestaw e55e1aef: nowa grupa,12 kont i2 mecze (nadchodzący
oraz rozegrany). Osobne konta admina grupy i gracza; żadne nie ma globalnej roli
admin. Oba mecze90min/270zł/12 zapisanych. Rozegrany zatwierdzono normalnym API:
12 należności po23zł, admin ma własne23zł do zapłaty, dokładnie2 zgłoszenia po23zł
pending i0 accepted. Konto gracza nie otrzymuje danych administracyjnych.

Konta utworzone oficjalnym Auth Admin API. Za dodatkową zgodą wykonano jednorazową
zabezpieczoną operację accounts15 i natychmiast przywrócono oryginalne accounts14
jako16; zgodność wszystkich10 plików oraz verify_jwt potwierdzona. Brak pozostawionego
bootstrapu. Bez modyfikacji istniejących danych, haseł, konfiguracji Auth, sekretów,
SQL DDL/migracji, Vercel i UI. Pierwsza transakcja danych cofnięta w całości po
błędzie aliasu; poprawiona przeszła. Nie wykonano pełnej regresji aplikacji.
PASS rzeczywiste API nowych kont i niezależne kontrole SQL stanów/uprawnień.
Sesje robocze wylogowano. Dane dostępowe poza repo i poza tym raportem.
Szczegóły i zakres sprzątania: [TEST_FINANCE_FIXTURE_E55E1AEF.md](TEST_FINANCE_FIXTURE_E55E1AEF.md).
Następny krok: właściciel loguje się nowym kontem admina i odbiera scenariusz.

---

# Lokalny podgląd Premium — CORS5196 dopuszczony

2026-11-05, `feat/premium-legal-pages`. Właściciel zezwolił na dopuszczenie
http://127.0.0.1:5196 do testów poprawionej wersji. Panel/edycja sekretów nie były
dostępne przez narzędzia, więc zmieniono wyłącznie projekcję listy CORS aktualnie
wdrożonego accounts13: dopisano dokładny origin po istniejącej liście z konfiguracji.
Wdrożony accounts14 zachowuje wszystkie10 plików poza jedną zmianą index.ts;
porównano je po wdrożeniu. Nie wdrażano źródeł nowego backendu z gałęzi ani SQL.
Nie zmieniano sekretów, listy istniejących originów, Auth, Brevo i Vercel.

Rzeczywisty PASS: OPTIONS lokalny5196/Vercel/Android https://localhost zwracają204
z dokładnym Allow-Origin; obcy origin403 bez Allow-Origin; POST status bez sesji
z lokalnego originu401 z poprawnym CORS. To potwierdza komunikację i ochronę,
nie jest testem poprawnego logowania użytkownika. Może być wymagane odświeżenie
lokalnego podglądu. Wartości sekretów i dane kont nie były odczytywane.
Wyjątek testowy opisuje docs/review/accounts-live-cors5196.patch; nie stosować go
zbiorczo do backendu tej gałęzi. Przy przyszłym wydaniu zachować lub świadomie
usunąć wyjątek testowy; następny deploy nie może niejawnie zmienić tej decyzji.

---

# SLM01 — odbiór właściciela i poprawka powrotu Androida

2026-11-05, `feat/premium-legal-pages`, baza660719c. RĘCZNY PASS według właściciela
na telefonie: rejestracja, logowanie, recovery, wylogowanie, trwałość sesji oraz
wszystkie ekrany poprzedniego APK. Agent nie powtarzał tych prób i nie pozyskiwał
danych konta. Właściciel zatwierdził usunięcie migania po minimalizacji/powrocie.

Zmieniono tylko useB1Lifecycle: Android nie ustawia checking po samym ukryciu,
powrót używa istniejącego współdzielonego resume i ograniczenia60s, okresowy
refresh ważnej sesji działa w tle. Pierwszy start, wygasła sesja, utrata sieci,
serwerowe uprawnienia, Keystore i blokada operacji do wyniku refresh bez zmian.
Zmieniono2 stare testy natywnej galerii i dodano5 przypadków appStateChange,
visibility/focus, równoległości, wygaśnięcia, cofnięcia oraz błędu sieci.

PASS37 testów Auth w5 plikach, TypeScript i lint; pojedynczy testowy błąd lint
naprawiono i sprawdzono ponownie. Build natywny B1 z istniejącą konfiguracją HTTPS,
cap sync i Gradle :app:assembleDebug PASS. CSS index-ChAQUkSI bez zmian. Emulator
Android16: install-r, cold start i powrót z Home PASS bez kasowania danych.
Nowy scenariusz zalogowany na fizycznym telefonie wymaga odbioru właściciela.
Bez pełnej regresji, SQL, zmian usług lub produkcji. Generowane pliki sync cofnięto.

Kontrakt55 plików UI PASS; kontrola runtime FAIL na dokładnym starym pinie
useB1Lifecycle — wymagany osobny przegląd pinów nowego źródła. Strażników nie
zmieniano automatycznie. Przygotowana propozycja w docs/review/android-resume-guards-proposed.patch.
APK: `.cache/android-auth/slm-auth-android-resume-debug.apk`.

---

# SLM01 — Android Auth, częściowy odbiór na emulatorze

2026-11-05, `feat/premium-legal-pages`, HEAD660719c. Początkowo czysta gałąź
codex/demo-match-6v6; przełączono na wskazaną gałąź bez nadpisania pracy. Widoczny
po przełączeniu artefakt app/dist-demo-six pozostawiono nietknięty. Bez zmian kodu,
commitów/push, usług zdalnych i migracji. Zmiana tego raportu wyłącznie lokalna.

PASS: istniejący build Premium B1 przez build:premium-web, jawne publiczne linki
HTTPS dokumentów, skopiowany do dist-b1 i cap sync z SLM_B1_ANDROID=1. Stage3
pozostaje wariantem lokalnego backendu; nie użyto go do Cloud Auth. Gradle8.14.3,
AGP8.13.0, Studio JBR21 (systemowy PATH ma JDK17), compile/target36, min24.
assembleDebug PASS. Archiwum APK zawiera właściwy endpoint hjtcyybkxebvdropchac,
brak localhost54321, logging none i zarejestrowany SecureStorage. Własne zmiany
generowane cap sync cofnięto; pliki implementacji identyczne z HEAD.

Na emulatorze Medium_Phone_API_36.1 / Android16 rzeczywiście: install-r zachował
dane wcześniejszej instalacji; cold start i ekran logowania PASS; rejestracja
pokazuje opcjonalny telefon; formularz recovery otwiera się; systemowe Wstecz
wraca z obu formularzy do logowania. Fikcyjne dane zostały odrzucone. Próba
logowania offline pokazała Brak połączenia i ukryła chronione widoki; Wi-Fi/dane
przywrócone. Powrót z tła sprawdzony wyłącznie w stanie wylogowanym.

BLOCKED: poprawne logowanie i wylogowanie, zapis/odtworzenie zalogowanej sesji,
rzeczywista rejestracja, poczta weryfikacyjna i reset — brak dostarczonego konta
testowego i ręcznej obsługi jego skrzynki. Nie zaliczono ich na podstawie weba.
Manifest nie deklaruje App Links/deep links Auth, a B1App nie odbiera appUrlOpen:
linki pocztowe kierują do dotychczasowego callbacku web. Potwierdzenie przez
przeglądarkę i późniejsze logowanie do APK wymaga ręcznego odbioru. Jeśli wymagany
jest automatyczny powrót z linku do aplikacji, minimalna przyszła zmiana obejmie
AndroidManifest.xml, obsługę callbacku w B1App/emailCallback i weryfikację domeny;
nie zaimplementowano jej bez zgody. Nie zmieniano UI ani konfiguracji callbacku.

APK: `.cache/android-auth/slm-auth-660719c-debug.apk` (także standardowy
app/android/app/build/outputs/apk/debug/app-debug.apk), SHA256
800030d767d42553ca07b2212779e7d2b1c91a802418d299575566c2d8221eb7.
Następny krok: ręczny odbiór poprawnego konta i jego poczty na Androidzie.

---

# Auth — strażniki zamknięte, wdrożenie zablokowane zależnościami Cloud

2026-11-04, `feat/premium-legal-pages`, baza2416945, czyste drzewo przed zmianami.
Właściciel zatwierdził wyjątki prywatności/usuwania i powrotu do karty. Zastosowano
aktualizację3 strażników i ich testów: dokładne21 źródeł bab1acc,4 źródła2416945,
listy weryfikowane względem niezmiennych obiektów Git. Manifest55, historyczne
hashe, CSS/karty/nawigacja/CI bez zmian. Zaktualizowany patch review dokumentuje
zastosowany diff. Bez zmian implementacji i bez nadpisania sekretów/cudzej pracy.

PASS: strażniki55/13,91policy; wstępne92 testy zmian; następnie jeden pełny przebieg:
509Vitest/72pliki, TypeScript/strictEdge/lint, build LIVE/demo/Premium, izolacja16,
3testy konfiguracji,46migracji scratch i SQL/RLS/FK, Cypress15/15 w6 plikach z
kontrolowanym API na lokalnych buildach. Bez prawdziwych kont i realnych wysyłek.

Read-only Cloud: Vault0.3.1, pg_cron/pg_net dostępne lecz niezainstalowane,
wpis worker w Vault nie istnieje (sprawdzono wyłącznie liczbę, bez wartości).
Cloud43 wpisy migracji: brakuje dwóch historycznych wpisów v2 i accounts_email_ui
ma inny timestamp. Potwierdzony brak group_payment_identity_guard() blokuje SQL46.
Vercel slm-ui-demo istnieje, produkcja READY, lokalny deploy Git nadal wyłączony.
NO-GO wdrożenia do czasu selektywnego uzgodnienia schematu i przygotowania workera.
Nie wykonano migracji, deployu, zmian kont ani konfiguracji. Następny krok i pełna
kolejność wydania: [AUTH_DEPLOYMENT_READINESS.md](AUTH_DEPLOYMENT_READINESS.md).

---

# Premium web — powrót do karty bez migania

2026-11-04, `feat/premium-legal-pages`. Przyczyna: visibility hidden wywoływało
suspend, a każde visible uruchamiało refresh ustawiający checking; B1App pokazywał
wtedy pełnoekranowy AccountScreens. FocusVisibility obsługuje tylko przewijanie
natywnych pól, nie odpowiada za ten objaw. Zmieniono sessionManager/useB1Lifecycle:
web nie zawiesza ważnej sesji przy ukryciu; resume współdzieli refresh i pomija
ponowienie przez60s od weryfikacji, o ile token ma ponad60s ważności. Weryfikacja
w tle nie zmienia ready; chronione wywołania czekają na wynik. Wygaśnięcie w trakcie
żądania blokuje widok timerem; nieważna sesja blokuje dostęp przed czyszczeniem
magazynu, błąd sieci usuwa dostęp i pozostawia bezpieczny stan unavailable.
Pierwsze uruchomienie i native suspend zachowane. Bez CSS/UI/backendu/migracji.

PASS:32 testy jednostkowe w4 plikach (6 nowych przypadków powrotu/równoległości,
ważna/wygasła sesja, błąd sieci/cofnięcie, termin ważności w trakcie żądania),
TypeScript i lint4 zmienionych plików. Dwa dotychczasowe testy galerii jawnie
testują natywny lifecycle. Początkowy runner miał ograniczenie katalogu temp;
ponowienie poza ograniczeniem wykonało testy. FAIL strażników: frozen UI nadal
blokuje wcześniejszy Profile, consolidation teraz również nowy sessionManager.
Piny Auth sessionManager/useB1Lifecycle/B1App.test wymagają niezależnego review;
nie aktualizowano ich automatycznie. Poprzedni patch przeglądowy dotyczy wyłącznie
bab1acc i nie zatwierdza tej poprawki. Bez pełnej regresji, deployu i Cloud.
Następny krok: odbiór pinów oraz pełna regresja przy osobno zatwierdzonym wdrożeniu.

---

# Przegląd strażników Premium — propozycja bez aktywacji

2026-11-04, `feat/premium-legal-pages`, przegląd `bab1acc`. Zapisano dokładny diff
chronionych źródeł względem ich indywidualnych zatwierdzonych baseline oraz
nieaktywny patch trzech strażników w docs/review/account-privacy-*. Historyczny
manifest55 pozostaje bez zmian. Przycisk w zamkniętych ustawieniach rozszerza
ich zawartość i jest wymaganym wyjątkiem funkcjonalnym od zamrożonego źródła;
karta, CSS i pozostały profil bez zmian. Rekomendacja: NO-GO publikacji do odbioru
wyjątku przez właściciela. Nie powtarzano testów, nie wdrażano, nie migrowano.
Sprawdzono wyłącznie stosowalność propozycji przez git apply --check.

---

# Automatyczny push — zasada pracy

2026-11-04, `feat/premium-legal-pages`. Na polecenie właściciela zapisano w AGENTS.md
obowiązek zwykłego push po każdej zakończonej zmianie i odpowiednich kontrolach.
Nie stanowi to zgody na merge, deploy ani zdalne migracje. Zmiana wyłącznie
dokumentacyjna: sprawdzono diff; testów aplikacji nie powtarzano. Przygotowano
wysłanie zaległego commita prywatności `bab1acc` oraz tej zasady; wynik push
potwierdzany bezpośrednio na GitHub w raporcie rozmowy.

---

# Prywatność telefonu i usuwanie konta — implementacja bez wdrożenia

2026-11-04, `feat/premium-legal-pages`, baza `5d39c00`. Przygotowano migrację46
`20261104183413_account_privacy_lifecycle.sql`, opcjonalny telefon z domyślną
prywatnością wszystkich kont, zgodę na udostępnianie aktualnym wspólnym członkom,
projekcje SQL i Edge obejmujące legacy/administratorów oraz blokadę surowych API.
Dodano usuwanie konta z hasłem/frazą, bezpiecznym przekazaniem administratora,
odłączeniem i redakcją historii, usuwaniem Auth/Storage i trwałymi ponowieniami.
Powiadomienie administracyjne korzysta z istniejącego Brevo i osobnej kolejki;
awaria poczty nie cofa usunięcia. Dodano ochronę równoczesnego uploadu zdjęcia,
zmiany formularzy i dokumentów prawnych. Bez przebudowy karty, CSS i nawigacji.

PASS automatyczne: TypeScript frontend/strict Edge, lint, **503 Vitest/71 plików**,
build LIVE/demo/Premium web, izolacja demo16 i3 testy konfiguracji. SQL/RLS/FK:
odtworzono46 migracji z wersjonowanych źródeł w świeżej scratch bazie lokalnego
slm-main-stabilization; existing minimum_phone + account_privacy PASS (również
anon/authenticated, opt-in/out/wyjście, legacy, historia płatności i upload lease).
Cypress2/2 PASS na lokalnym produkcyjnym Premium z fikcyjnym transportem API.
Nie oznacza to rzeczywistego usunięcia przez GoTrue/Storage ani doręczenia Brevo.

FAIL aktywnych strażników: lista45 nie obejmuje migracji46, `Profile.tsx` ma
minimalne wejście „Usuń konto”, źródła Auth wymagają nowych pinów. 82 testy policy
zatrzymują się na niezatwierdzonym źródle Profile; nie zaliczono kontraktu Premium.
Strażniki, manifest55 iCI bez zmian. Niezależny przegląd właściciela wymagany przed
aktualizacją pinów i publikacją. Brak deployu, migracji Cloud, merge i testów na
prawdziwych kontach. Produkcyjna rejestracja/recovery pozostają w odebranej wersji.

Następny krok: review, wdrożenie migracji46 i istniejącego accounts, konfiguracja
worker pg_cron/pg_net/Vault z przygotowanego SQL, potem Premium na slm-ui-demo.
Odbiór Vercel wyłącznie jednorazowymi kontami; dane administratora i prawne okresy
retencji nadal do ustalenia. Szczegóły, ograniczenia i kolejność wdrożenia:
[ACCOUNT_PRIVACY_LIFECYCLE.md](ACCOUNT_PRIVACY_LIFECYCLE.md).

---

# Brevo i rejestracja e-mail — działanie potwierdzone przez właściciela

2026-11-04, `feat/premium-legal-pages`. Po wyraźnym potwierdzeniu właściciela
włączono samorejestrację Supabase i `SLM_EMAIL_SIGNUP_ENABLED=true`. Zachowano
Confirm email, secure email change, wymaganie obecnego hasła, wyłączone konta
anonimowe/manual linking/telefon oraz blokadę SMS. Zapisano konfigurację Brevo
i dokładny callback `https://slm-ui-demo.vercel.app/auth/callback`; SMTP i sekret
podpisu hooka wprowadził właściciel bezpośrednio w panelu. Send Email hook HTTPS
jest włączony. W tym etapie bez zmian kodu, migracji, Edge Functions i Vercel.
PASS: UI potwierdza zapis; puste POST signup zwraca400`invalid_input` i dokładny
CORS zamiast wcześniejszego503`mail_unconfigured`. To nie dowodzi wysłania poczty.
RĘCZNY PASS według potwierdzenia właściciela w tej rozmowie: rzeczywista
rejestracja przez Vercel, dostarczenie wiadomości Brevo, kliknięcie linku,
potwierdzenie konta i skuteczne logowanie. Agent nie wykonywał tych kroków
samodzielnie; nie zapisano danych konta ani dowodów weryfikacyjnych.
RĘCZNY PASS według kolejnego potwierdzenia właściciela: reset hasła działa
prawidłowo. Podstawowe ścieżki konta (rejestracja, weryfikacja e-mail, logowanie,
odzyskiwanie hasła) odebrane ręcznie przez właściciela; nie jest to pełny audyt
wszystkich przypadków bezpieczeństwa. Następny krok: uzupełnić oznaczone dane
w nadal testowych dokumentach prawnych.

---

# Dokumenty testowe Premium — opublikowane

2026-11-04, `feat/premium-legal-pages`, baza faktycznie wdrożonego PR34 `2d568f3`.
Dodano statyczne `/regulamin/` i `/polityka-prywatnosci/` z oznaczeniem brakujących
danych administratora, dostawców, transferów i retencji. Bez zmian UI, Auth,
strażników, migracji i Edge Functions. Vercel istniejący `slm-ui-demo`, plan Hobby;
obie publiczne zmienne VITE ustawione na HTTPS tego projektu. PASS: buildPremium,
TS/lint/build,476Vitest/68plików,82policy,3testy konfiguracji,kontrakt55/13granic.
Cypress nie wykonał scenariuszy (brak serwera localhost5173). Backend accounts v8
odczytany; bezdane POST signup:503`mail_unconfigured`, poprawny CORS. Rejestracja
i rzeczywista wysyłka niezaliczone z powodu wyłączonego procesu poczty. Następny
krok: uzupełnić dane administratora i dostawców, skonfigurować pocztę zgodnie z
PREMIUM_REAL_AUTH_WEB.md i dopiero wtedy sprawdzić pełną rejestrację. Produkcja
Vercel READY: `023ebcd`, alias slm-ui-demo.vercel.app. Obie strony HTTP200,
formularz ma linki i nadal wymaga zgody oraz walidacji. PR35 pozostaje Draft.
Raport: [PREMIUM_LEGAL_PAGES.md](PREMIUM_LEGAL_PAGES.md). Bez merge do main.

---

# Uruchomienie Vercel — repozytorium gotowe, dostęp zdalny zablokowany

2026-11-04 13:06 UTC, `feat/premium-real-auth-web`, PR34 wg właściciela. Zatwierdzone Auth36ed569 przypięte w strażnikach: PASS45migracji/55plików/13granic i82policy (stare71+11),476Vitest,TS/strictEdge/lint,buildPremium i3testy konfiguracji. Manifest55 i aplikacja bez zmian. Lokalny produkcyjny preview: HTTP200, logowanie390px, SPA/czyszczeniecallbacku, bez JS/overflow. Vercel rootapp/build:premium-web/dist-premium-web przygotowany. Bez migracji45/deployaccounts/Cloud/merge. Dostęp Vercel/Supabase: proxy403, brak aktywnego dostępu. Jedyny krok zewnętrzny: ChatGPT ma ręcznie wdrożyć PR34 w istniejącym slm-ui-demo i ustawić CORS oraz backend hjtcyybkxebvdropchac według [instrukcji](PREMIUM_REAL_AUTH_WEB.md). Brak SMTP nie blokuje pierwszego testu istniejącego logowania. Cypress/realny backend/telefon/hostedCI niezaliczone; bez instalacji CLI i żądania tokenów. Osobny snapshot SQL/Edge CI nie był częścią frontendowego uruchomienia.

---

# Premium Auth web — ponowna weryfikacja

2026-11-04 12:09 UTC, ta sama gałąź `feat/premium-real-auth-web`, main nadal `1b6ee83`. Uzupełniono instrukcję logowania e-mailem, blokadę lokalnych callbacków i wspólny budżet4s HTTP hook/SMTP wobec domyślnego limitu5s GoTrue. PASS: TS/strictEdge/typy testów, lint,476Vitest/68plików,3 testy konfiguracji, build Premium/demo i izolacja16, Chromium320/390/768 oraz12 kombinacji palet/trybów. Logowanie Dark/Light na zrzutach bez zmian bajtowych. Aktywne source/UI/policy nadalFAIL do osobnego review; piny/manifest55/CI bez zmian. Cypress nadalNOTRUN (binarium/download403), realneSQL/RLS/GoTrue/SMTP/telefon/CloudNOTRUN. Migracja45 wyłącznie przygotowana; poprzednie44 nietknięte, bez deployu i merge. Kod kontynuacji `36ed569b62bb6861640d2f64c10ed12038c4b15a` wypchnięty; utworzenie Draft PR zablokowane przez REST i GraphQL Forbidden. [Gotowe porównanie do main](https://github.com/psuda87/sunday-league-mates/compare/main...feat/premium-real-auth-web?expand=1). Raport i dokładne ustawienia: [PREMIUM_REAL_AUTH_WEB.md](PREMIUM_REAL_AUTH_WEB.md).

---

# Premium Auth web — kandydat do review, bez wdrożenia

2026-11-04 10:32 UTC, `feat/premium-real-auth-web` z main`1b6ee83`. Istniejący Premium3.18/B1 i SessionManager: podłączone rejestracja, resend, potwierdzenie e-mail i recovery przez accounts; fragmentowe dowody czyszczone z URL, bez przyjmowania sesji z linku. Nowy podpisany Send Email hook w istniejącym accounts + SMTP/TLS465 zachowuje blokadę legacy i email_change. Build`build:premium-web`, Vercel root`app`, output`dist-premium-web`, SPA/CSP HTTPS. Brak dokumentów prawnych blokuje rejestrację.

Przygotowano migrację45`20261104090000_accounts_email_ui.sql`, **nie wykonano**; stare44 bez zmian. Cloud44/v7 wyłącznie wg informacji właściciela; nie odczytywano i nie zmieniano Supabase/Vercel, danych, domen, RLS, konfiguracji Auth w Cloud ani sekretów. Nie aktywowano Auth18, CI ani deployu.

PASS: TS frontend/strictEdge, lint,468Vitest/68plików,3 testy konfiguracji, build Premium/LIVE/demo i izolacja16, Chromium320/390/768 i12 wyborów palety/trybu (kontrolowany HTTP). NOT RUN: Cypress — brak binarium; SQL45/RLS/realny GoTrue/SMTP/Cloud/telefon/hosted CI. **FAIL aktywnych kontraktów**: nowe źródła Auth i funkcjonalna zmiana AccountScreens nie mają jeszcze niezależnie zaakceptowanych pinów. CSS/zasoby/karty/BottomNav bez zmian,54/55 plików identycznych z bazą; strażniki/manifest/CI nietknięte.

Przed integracją: review dokładnych źródeł i kontraktów; izolowany odbiór backendu45 i SMTP/hooka; zatwierdzone dokumenty; osobne wdrożenie accounts i konfiguracja Auth/Vercel przez właściciela. Implementacja `ee72959755f4db926c83d2566dc76b5b5aa8c940` wypchnięta. Draft PR zablokowany przez GitHub GraphQL Forbidden; [porównanie do main](https://github.com/psuda87/sunday-league-mates/compare/main...feat/premium-real-auth-web?expand=1), gotowy opis w `docs/review/PREMIUM_REAL_AUTH_WEB_PR.md`. Raport i dokładne ustawienia: [PREMIUM_REAL_AUTH_WEB.md](PREMIUM_REAL_AUTH_WEB.md). Manifest wyłącznie do przeglądu: [premium-real-auth-web-manifest.json](review/premium-real-auth-web-manifest.json). Brak deklaracji gotowości produkcyjnej i brak merge.

---

# Android/formularze — punkt kontrolny polish-stats

2026-10-31 — PR31 guard review: **PASS**, kontrakty odblokowane bez zmiany aplikacji. Policy704e4a8 (dokładne UI3f181e9/nativef2edf56), CI implementacja7c45656 i osobny wskaźnik6e9ce9d; wcześniejsze piny i42 migracje/frozen55 bez zmian. Faktycznie ponowione: policy53 (stare45+8), consolidation42/55/11, LinuxSourceTests29, source guard Linux i kanoniczny Windows PASS,60 Premium/consolidation i69 source mutacji odrzuconych, TS/lint/Edge/Vitest372/build/Chrome6 PASS. GitHub-hosted NOT RUN. Android/SQL/HTTP niepowtarzane (implementacja niezmieniona); Cloud/bazy/POCO nietknięte. PR31 gotowy do dalszej integracji po decyzji właściciela, nadal Draft, bez merge. Raport:docs/SLM_V1_POLISH_STATS_REPORT.md. Poniższe wcześniejsze BLOCK kontraktów zostało usunięte; TODO produktu nadal aktualne.

2026-10-31 09:09 Europe/Warsaw — po zgłoszeniu braku działania APK uruchomiono Docker Desktop i wznowiono wyłącznie sześć istniejących usług slm-main-stabilization. Backend nadal41 migracji, bez migracji/resetu/zmian źródeł/Cloud. Przywrócono ADB emulator-5554 tcp64321→host55321; faktyczne HTTP z emulatora: Auth200, accounts401 bez sesji. Ponowny cold start APK zakończony powodzeniem; wizualnie potwierdzono odtworzoną sesję i listę meczów z lokalnego API. Podstawowy LIVE odczyt działa. Pełne discovery42 i pozostałe niezaimplementowane funkcje nadal niegotowe. Bez instalacji APK i operacji na POCO; zrzut zawierający zastane dane pozostawiono wyłącznie w ignorowanym cache.

2026-10-31 Europe/Warsaw, `feat/slm-v1-polish-stats` od RC1575bef. Commity implementacji f2edf56 (native insets) i 3f181e9 (formularz gościa/selektor). PASS: build/TS, lint, strict Edge, Vitest372, Cypress/Chrome6 (fixture UI bez backendu), Gradle debug+test APK i AndroidJUnitRunner2 na emulatorze. Wszystkie55 zamrożonych plików bez zmian. APK SHA256 b0ad205c53b32ad40f7f0301004077962cca5b0de1ff0f126a1e7e089b6fd748, lokalne API64321, bez potwierdzonego LIVE.

Publikacja: Draft PR #31 do RC1575bef, raport f27668c wypchnięty. GitHub potwierdził draft/open/unmerged; zero workflow runs dla f27668c, hosted NOT RUN. Możliwość technicznego merge historii nie usuwa poniższej blokady kontraktów.

BLOCK integracji: istniejące przypięcia runtime i całego app w CI odrzucają zmiany; Premium policy45/45 FAIL, pełne verify:consolidation FAIL na runtime, source guard FAIL na MainActivity. Żadnych zmian guardów/hashów. Telefon/prywatność profilu, edycja grup/minimum, gole/oceny są TODO, nie gotową funkcją. Brak nowych migracji (nadal42), brak wdrożonych Edge/migracji/Cloud lub zmian istniejących baz. Docker nie odpowiadał; SQL/HTTP/LIVE i Android12/POCO NOT RUN. Następny krok: review dokładnego diffu i kontraktów, potem nowa fixture i osobny etap backendu. Raport:docs/SLM_V1_POLISH_STATS_REPORT.md. Chronologia:docs/ODPOWIEDZI_CODEX.txt.

---

# Najnowszy RC uruchomiony w emulatorze

2026-10-30 21:16 Europe/Warsaw — Android Studio otwarte z `.worktrees/slm-v1-release-candidate/app/android`; istniejący AVD Medium_Phone_API_36.1 uruchomiony z widocznym oknem, bez wipe danych. APK RC SHA256 ca6de17a63b6de01f461b49bde95c8b2403edc6c809115b3a369cf585f70e1fc zainstalowany przez install -r wyłącznie na emulator-5554 (ro.kernel.qemu=1), MainActivity uruchomiona i na pierwszym planie. Potwierdzono wizualnie ekran Mecze z fikcyjnymi lokalnymi danymi i odtworzoną sesją.

Przywrócono poprzednią mapę ADB tego emulatora64321→host55321. To istniejący backend41, użyty do podglądu podstawowych funkcji; nie deklarujemy pełnego discovery42 ani odbioru LIVE całego RC. Nie migrowano bazy, nie zmieniano Cloud ani fizycznego POCO. Kod/piny bez zmian. Zrzut:docs/ui/rc-launch/emulator-matches.png. Chronologia:docs/ODPOWIEDZI_CODEX.txt.

---
# SLM1.0 — zintegrowany kandydat do testów

Publikacja: [Draft PR #30](https://github.com/psuda87/sunday-league-mates/pull/30) do zweryfikowanego main134c52b, open/draft/mergeable, bez merge. Raport01538e3 wypchnięty. Dwa workflowy GitHub dla tego SHA:SKIPPED, więc hosted testy NOT RUN. PR27/28/29 nadal open/draft. Końcowy commit tylko potwierdza publikację.

2026-10-30 20:25 Europe/Warsaw — `feat/slm-v1-release-candidate` od dokładnego Stage2C/e246c514af0fbca79dee892d9aa0e31b937a83c3. Cały zatwierdzony stos już w historii: main134c52b→39ef2e3→Stage1/fix7ad5c75→lineups2A/2B→CI3A/3B→discovery→audit→2B→2C. App identyczny z2C, bez merge/rebase/squash i bez Auth18 (nie przodek,9 migracji nieobecnych). Zachowane piny24a59e1/ae2fd95/d7b36ee i osobnycb63962;55 plików/manifest/workflow bez zmian.

PASS tej sesji:361 Vitest/55 plików,lint,TypeScript/strictEdge,45policy,verify42/55/10,6buildów web,demo isolation16,Capacitor/Gradleoffline i inspekcja APK. Linux26+pełny sourcegate+10odmów, hosted NOT RUN do osobnego odczytu po publikacji. Nowa SQL referencja42 i syntetyczne dane7→42 PASS,47tabelRLS/ACL/legacy mapping i zachowanie danych;nieGoTrue ani kopia realnegoCloud. APK debug ca6de17a63b6de01f461b49bde95c8b2403edc6c809115b3a369cf585f70e1fc;local64321,loggingnone/WebViewdebugfalse,bez instalacji. EmulatorAVD/WHPXdostępny;LIVE/RunNOTRUN, wymaga pełnego backendu42.

Odczyt Cloud hjtcyybkxebvdropchac:tylko7/42 migracji,13tabel,accountsv6,brakbucketów i push-worker. Badane definicje/kolumny/polityki7 zgodne z referencją,ale3historyczneSQLmająinnehashe;wymaganypełnydiff i restorebackupu.35migracjipending. Obecnelegacydane istnieją,jedenadminspełniapreflight;nieodczytywanotożsamości/sekretów. Cloud pełnegoRC BLOCK. DomyślnyLIVE nadalHome,pełnyPremiumStage3jawnylokalny64321;produkt1.0 wymaga decyzjioodroczonychsignup/statystykach/ocenach/algorytmie/push iHTTPS. Bez aktywacjiAuth18 lubzmianUI/finansów/składów.

Raport:docs/SLM_V1_RELEASE_CANDI2026-10-30 20:25.md;planwdrożenia/backup/diff/rollbackbezwykonania:docs/SUPABASE_RC_DEPLOYMENT_PLAN.md;dokładneAndroidStudio:docs/ANDROID_STUDIO_RC.md;dowodywdocs/review/rc-*.json. Sześć zastanychusługbez zmian,nowa referencjazatrzymana/zachowana. Root6zmianwłaścicielazachowano. BezCloudwrites/migracjiistniejącychbaz/POCO/płatnychusług/mainmerge. Następne:reviewRC+zakres1.0/HTTPS, osobnybackuprestore i próba35migracji, nowybackend42+odbióremulatora. Chronologia:docs/ODPOWIEDZI_CODEX.txt.

---
# Public Match Discovery — Etap2C

Publikacja: [Draft PR #29](https://github.com/psuda87/sunday-league-mates/pull/29) do Stage2B/fd4fccd, open/draft/clean, bez merge. Raport3041da0 wypchnięty; GitHub API:0 workflow runs dla tego SHA, hosted NOT RUN. PR28 nadal Draft. Końcowe potwierdzenie publikacji osobnym commitem docs.

2026-10-30 19:48 Europe/Warsaw — `chore/public-discovery-stage2c` od dokładnego fd4fccdc1c22caa5f217625809689f336139a122. Aplikacja/backend/Premium3.18/Auth/finanse/składy/Android i dotychczasowe piny bez zmian. Niezależne porównanie potwierdziło backend24a59e1, runtimeae2fd95, zapisany diff2B oraz55 plików/manifest.

KontraktCI: dokładny overlay18 plików43f69a6 nad6d96391/45d9a4, SourceTests26, dwa oczekiwania42 wCI. Implementacja d7b36eee379acf5036f8ea8aaeeea5f7791c8a04; osobny pointer cb63962e0ff4ccfbc4fb7157e4627beeee5ae8d5. Workflow, repo/event/SHA/ancestry/hostedLinux/localDocker/opt-in i sekrety zachowane. Nie dispatchowano ani nie włączano Actions.

PASS faktycznie:361Vitest/55 plików,TS/strictEdge/lint,45policy,verify42/55/10;60 mutacji rzeczywistych guardów,6 kontroli liczby migracji AST. Izolowany offline Linux Python3.12.16/Git2.47.3:26/26 kontraktu, rzeczywisty verify_sources na kloniecb63962 oraz10 rzeczywistych odmów (w tym PR16/43/Auth/finance/lineups/CI). Windows25/26: dwa problemyCRLF rozwiązane wyłącznie w tempGit; symlink nadalFAIL-ENV1314, ta sama asercjaPASS Linux, bez skipów. GitHub-hosted:NOT RUN. SQL/Edge HTTP/build/Android w2C:NOT RUN, brak zmian funkcjonalnych; wcześniejszych wyników nie zaliczano ponownie.

WARN: sam runtime policy nie przypina treści migracjiPR16/20261028204500; consolidation oraz pełny sourceguardCI skutecznie odrzucają jej zmianę (zweryfikowano). Nie zastępować pełnych kontroli samym policyPASS. Raport:docs/PUBLIC_MATCH_DISCOVERY_STAGE2C.md; mapa wszystkich przodków od aktualnego origin/main134c52b:docs/PUBLIC_MATCH_DISCOVERY_INTEGRATION_MAP.md. Lokalny maina46f5e4 pozostawiony. Bez merge/rebase/deploy/Cloud, migracji istniejących baz, APK lub zmian właściciela w root. Następny krok:review DraftPR do Stage2B, zachowanie oryginalnych SHA/ancestry; ewentualny hosted run tylko osobno po potwierdzeniu darmowego limitu. Chronologia:docs/ODPOWIEDZI_CODEX.txt.

---
# Public Match Discovery — Etap 2B

Publikacja: [Draft PR #28](https://github.com/psuda87/sunday-league-mates/pull/28), base audit/public-match-discovery-backend/ddd3a3e, open/draft, mergeable clean, bez merge. Kod43f69a6, raport/dowody eeb6940; zwykły push potwierdzony. Końcowe potwierdzenie osobnym commitem dokumentacyjnym, CI nieaktywowane.

2026-10-30 19:26 Europe/Warsaw — `feat/public-match-discovery-stage2b` od aktualnego audytu `ddd3a3e` (zawieraa62e211). Kod/testy/przypięcia `43f69a62c85dd354695f6fcb4531c85fb03651cf`. PASS funkcjonalny i bezpieczeństwa; WARN ograniczeń; BLOCK aktywacji CI do osobnego review. Premium: zakresy all/groups/public, query tylko Publiczne, debounce300ms, generacje odpowiedzi, reset strony, marker1 i has_more/next_offset, stary backend bez nowych opcji. Bez lokalnego filtrowania stron wersji1. Zachowano kartę/style/55 plików/manifest, Auth, finanse i składy.

Aktywne piny wymagające końcowej akceptacji: backend42+handler dokładnie24a59e1, trzy runtime UI dokładnieae2fd95;41 wcześniejszych migracji i inne wyjątki bez zmian. Osobna NIEAKTYWNA propozycja CI przypina dokładnie18 źródeł do43f69a6, PASS32; aktywne CI/approval/workflow nietknięte, Actions nie uruchamiano.

Faktycznie lokalnie PASS:361 Vitest/55 plików, TS/strict Edge/lint,45 policy, verify42/55/10;52 discoverySQL/RLS +50 lineupsSQL/RLS/PostgREST/regresji;11 realGoTrue/Edge kontroli do restartu +8 HTTP discovery i końcowy SQL braku członkostwa;14 istniejących browserlineups +14 discovery;9 localpreflight. Wszystkie6 buildów web, Capacitor sync i natywny Gradle assembleDebug offline PASS. Testy launchCI:20/23 PASS,3 Windows env błędy (CRLF w dwóch temp repo, brak symlink privilege); nie osłabiono asercji. CI hostowane/Cypress/fizyczny Android/instalacja APK:NOT RUN. Końcowy stary runner GoTrue nie doszedł do dwóch asercji leave/revoke po wcześniejszym błędzie nowego callbacka; nie deklarujemy13PASS.

Testy tylko w nowych42-migracyjnych fixtures tego zadania, zatrzymane/zachowane. Nie używano ani nie migrowano bazy telefonu/Cloud; brak merge/deploy/resetów, ustawiania fikcyjnego CI i płatnych usług. Sześć zmian właściciela w root zachowano. Raport i dokładne diffy:docs/PUBLIC_MATCH_DISCOVERY_STAGE2B.md,docs/review. Następny krok:review DraftPR do audit/public-match-discovery-backend oraz osobna decyzja o przypięciach/CI. Zatrzymać się po etapie. Chronologia:docs/ODPOWIEDZI_CODEX.txt.

---
# Public Match Discovery — audyt backendu Etap 2A

2026-10-30 — `audit/public-match-discovery-backend`, baza `24a59e104bfe80b4d2f41cbd0ad02b58fc546040`.
**Backend PASS w badanym zakresie; integracja BLOCK do osobnej akceptacji kontraktów.**
Migracja 42 i handler są bajtowo niezmienione. Nie znaleziono nowej luki wymagającej poprawki.
Zachowano UI Premium 3.18, Auth, finanse, składy, CI i 41 historycznych migracji.

- PASS: 52 SQL/RLS na nowej izolowanej fixture; 352 Vitest /54 pliki; 8 nowych testów preflight; 23 istniejące testy CI; TypeScript, strict Edge, lint; 4 buildy i izolacja demo16; kontrola wyglądu55.
- FAIL/BLOCK aktywnych kontroli: consolidation42≠41, runtime, policy0/37 i Stage3B source gate. Nie zmieniono aktywnych strażników ani approval JSON.
- Nieaktywny patch w docs/review dopuszcza dokładnie migrację42 i handler z24a59e1. Test kopii w/tmp:42 PASS (stare37+5), odmowa zmiany obu backendów. To propozycja, nie zgoda właściciela ani PASS aktywnego CI.
- WARN: offset bez snapshotu przy zmianach danych; celowa zmiana kolejności READ; dziedziczona globalna blokada i brak testu obciążeniowego.
- NOT RUN: real GoTrue/Edge HTTP, hosted Actions, nowe UI/Chromium i POCO. UI wyszukiwania nadal niezaimplementowane.

[Raport audytu](PUBLIC_MATCH_DISCOVERY_BACKEND_AUDIT.md). Dwie nowe fixture zatrzymano i zachowano; istniejące bazy i Supabase Cloud nietknięte. Bez merge i deployu. Następny krok: osobna akceptacja dokładnego patcha i osobny przegląd aktualizacji CI do42; UI po odrębnej zgodzie.

---

# Public match discovery — backend Etapu1 lokalnie PASS, UI/kontrakty BLOCKED

2026-10-30 08:23 Europe/Warsaw — `feat/public-match-discovery`, baza dokładniee04d9a47560de36657da76f12ae63e20ef2299cb. Przygotowano nową migrację20261030090000_public_match_discovery.sql (42 po zachowanych41) i whitelistę query wyłącznie matches_list z fail-closed503 dla starego SQL bez markera wersji. Reuse istniejącego dispatcher/session/summary/RLS: all/grupy/public, szukanie tylko publicznych po nazwie meczu/grupy, literalnie/case-insensitive, limit100+has_more/next_offset, serwerowe predykaty przed paginacją. Prywatne obce mecze i dane grup/profili/finansów/składów nadal niedostępne; brak automatycznego członkostwa. Nie zmieniono Auth, finansów i mutacji zapisów/składów.

**UI zatrzymano zgodnie z poleceniem:** PremiumEvents jest dokładnie pinowany; app/src/CSS/karty/nawigacja/grafiki/native bez zmian. Minimalny projekt selektora Wszystkie/Moje grupy/Publiczne i search tylko Publiczne w [PUBLIC_MATCH_DISCOVERY_STAGE1.md](PUBLIC_MATCH_DISCOVERY_STAGE1.md), do zatwierdzenia. Nie tworzono kopii ekranów ani pozornego filtrowania klienta.

Faktyczne PASS:34realSQL/ACL/RLS na NOWEJnetworknonefixture (Auth/Storage schematy testowe,nieGoTrue);345Vitest/54pliki, w tym10EdgeMock;TS/strictEdge/lint;4buildyLIVE/Premiumfinance/Androidweb/demo+izolacja16;55visualsource. **FAIL/BLOCK:** verify_consolidation42≠41; pełny runtime Unexpected migration/model activation; policy0/37PASS przez preemptujący kontrakt; Stage3Bverify_sources odrzuca handler. Guardów/workflow/pinów/approvalJSON nie zmieniono. Nie deklarujemy gotowości do merge ani hostowanegoPASS.

Dwie nowe SQLfixture zatrzymane/zachowane, żadnych migracji istniejących baz/Cloud/deployu/telefonu/merge. NOT RUN: noweUI/Chromium/POCO/realGoTrueEdgeHTTP/hostowaneCI. Przed integracją wymagane zatwierdzenie minimalnegoUI i osobny review rozszerzenia kontraktu backendu41→42/handlera oraz snapshotuCI. Commit backendu/projektuUI `907336d839d742e1420eb68d8c69b202948037de` wypchnięty. POST DraftPR do bazyStage3B: **Forbidden**, PR nie powstał. [Porównanie](https://github.com/psuda87/sunday-league-mates/compare/chore/slm-v1-integration-ci-stage3b...feat/public-match-discovery?expand=1). Publikacja potwierdzona osobnym commitem docs.

---

# Etap 3B — izolowane CI przygotowane; pełny przebieg GitHub NOT RUN

2026-10-30 07:08 Europe/Warsaw — `chore/slm-v1-integration-ci-stage3b`, baza dokładnie45d9a4dfba838ebf9ed70f73a1b2044352df8ecd. Nowy workflow `lineup-integration.yml` rozdziela SQL/RLS oraz realne GoTrue/Edge/UI na dwa efemeryczne Ubuntu; frontendowy workflow3A niezmieniony. Opt-in wymaga obu repo variables SLM_FREE_CI_ENABLED i SLM_INTEGRATION_CI_ENABLED; manual dodatkowo dwóch potwierdzeń. Nie aktywowano CI ani płatnych zasobów.

Preflight przed DB sprawdza repo/PR→main/ref/pełneSHA i rodziców merge, hostedLinux, opt-in i brak zewnętrznych konfiguracji, immutable źródła całego app/backendu/41migracji/handlera, dokładny zestaw plików oraz pusty lokalny Docker i zasoby. Kod startowy przypięty do6d96391298bbe18c582dc5c6ffda74c7045cfba3 przez osobny approval JSON. Lokalne branch guardy zachowane; nie fałszowano zmiennych GitHub ani nazw gałęzi. Kontenery nowe/networknone/limity zasobów, obrazy po digestach, cleanup tylko własnych etykiet bez reset/prune/remove. UI/Auth/finanse/składy/backend, istniejące guardy i41migracji bez zmian.

Faktyczne PASS Cloud:23Python kontraktu startu;3 oczekiwane odmowy lokalnych runnerów bez nowych kontenerów; porównanie rzeczywistego checkoutu do przypiętych źródeł;335Vitest/53pliki;TS/strictEdge/lint;37policy;verify41migracji/55visual/10granic;4buildyLIVE/Premium-finance-local/Androidweb/demo+izolacja16; statycznyYAML/Bash/Python/JS. **SQL/RLS i rzeczywiste GoTrue/Edge/UI oraz hostowane Actions NOT RUN** — bez udawania środowiskaCI w Cloud. Żadna baza nie powstała i nie została zmieniona. actionlint niedostępny; realne czasy/obrazy/limity runnera pozostają do pierwszej zatwierdzonej próby.

Raport: [SLM_V1_INTEGRATION_CI_STAGE3B.md](SLM_V1_INTEGRATION_CI_STAGE3B.md). Gałąź wypchnięta; commit konfiguracji `dc44ccc21a7de25149dceca1976a83be4bbb7a4a`. API POST DraftPR do main oraz GET Actions/variables: **Forbidden**, PR nie powstał i brak hostowanego PASS. [Porównanie](https://github.com/psuda87/sunday-league-mates/compare/main...chore/slm-v1-integration-ci-stage3b?expand=1). Końcowy zapis publikacji osobnym commitem docs. Następny krok: review helpera/workflow/wskaźnika, limit/opt-in i rzeczywisty przebieg, osobne wyniki obu suite. Brak merge/deployu/Cloud/telefonu; STOP po3B.

---

# Etap 3A — integracja i frontendowe CI przygotowane, bez merge

2026-10-29 23:51 Europe/Warsaw — `chore/slm-v1-integration-ready` od dokładnego58a9babf257876e47cf6db269a0bf05d2e1db1f4. Dodano minimalny `.github/workflows/main-pr-checks.yml` dla PR do main i manual dispatch; korzysta z frontendowego zakresu PR26, bez starszego backendu40. Wymaga jawnego opt-in `SLM_FREE_CI_ENABLED=true` po potwierdzeniu bezpłatnego limitu; ręczne uruchomienie wymaga dodatkowego potwierdzenia. SKIPPED nie oznacza PASS. Nie zmieniono ustawień GitHub ani nie aktywowano płatnych usług.

Faktyczne lokalne PASS w Cloud: TS aplikacji/strictEdge, lint,335Vitest/53pliki,37policy,verify41migracji/55visual/10importów,5buildówLIVE/Premium-local/Premium-finance-local/Androidweb/demo i izolacja16; YAML i8blokówBash sprawdzone statycznie. Całe app/ i wszystkie istniejące guardy, zależności, UI/Backend/Auth/finanse niezmienione względem58a9bab. Brak migracji/resetu/budowyAPK/CapacitorSync/deploy/Cloud/merge.

SQL/RLS i rzeczywiste GoTrue/Edge/UI **NOT RUN**: nie zmieniono branch guardów i nie tworzono baz. Ich wymagania oraz bezpieczna propozycja dopuszczenia CI przez pełne SHA/źródła opisana w [SLM_V1_INTEGRATION_READY.md](SLM_V1_INTEGRATION_READY.md). GitHubAPI odmawia odczytu konfiguracji; hostowaneCI **NOT RUN/niepotwierdzone**. Commit workflow `8387f89adcecc64b0b2a777bb2cf97d044c1fc29` wypchnięty na origin. POST DraftPR do main i odczyt Actions runs: **Forbidden**; PR nie powstał. [Link porównania](https://github.com/psuda87/sunday-league-mates/compare/main...chore/slm-v1-integration-ready?expand=1). Potwierdzenie publikacji osobnym commitem docs. Następny krok: review workflow/przypięć, potwierdzenie limitu i rzeczywisty frontendowy przebieg; backendCI i zgodny POCO osobno. STOP po3A, bez Stage3B.

---

# Stage 2B — integracja edytora składów, gotowa do review

2026-10-29 18:33 Europe/Warsaw — zwykły push nowej gałęzi z 7 zrzutami potwierdzony. **Draft PR [#27](https://github.com/psuda87/sunday-league-mates/pull/27) utworzony**, base feat/premium-lineups-stage2a/3b00ec2, przy utworzeniu head 290996da4b0e9f1bf02e6e4f6945d388fca3f647, draft/open, bez merge. Końcowy Git-doc osobno; runtime/testy bez dalszych zmian.

2026-10-29 18:31 Europe/Warsaw — `feat/premium-lineups-stage2b` od dokładnego `3b00ec268a19f64516daebbf0b238d796e826cd1`. Runtime **f47cd80ad49aa6df0faf0dcb04093f2fa1adfbcd**, końcowy zakres weryfikacji **a75799f47a3e6636c2779622f70bc715adc1ab5a**; dokumentacja osobno. Istniejący PremiumTeams odczytuje i jawnie zapisuje lineups_get/save: baseline/draft, UUID uczestnictwa/gości, CAS/roster, stabilny request_id retry, GET po sukcesie/replay, autor wyłącznie z last_change, potwierdzane odświeżenie przy konflikcie. RAM per manager/użytkownik/grupa/mecz zachowuje szkic przez offline unmount; ponowna weryfikacja przed pokazaniem, logout/odmowa czyści zakres. Bez zmian Auth, finansów i backendu 2A.

Automatyczne PASS tej sesji Windows: **335 Vitest/53 pliki**, w tym **23 UI/API fixture**; **14 Chrome UI z rzeczywistym GoTrue/Edge/PostgREST/PostgreSQL +14 towarzyszących kontroli backendu**; **50 SQL/RLS/PostgREST** na bazowym worktree 2A o identycznym backendzie; **13 Cypress/5 plików z kontrolowanym API**; TS/strict Edge/lint, build LIVE/Premium/demo (izolacja16), Android web/Capacitor sync/assembleDebug offline. Guard **55 visual /10 import boundaries /41 migracji**, **37 policy PASS**. Siedem zrzutów w docs/ui/lineups-stage2b. Fizyczny POCO NOT TESTED, APK nie instalowano.

Migracje/Edge wdrożone do istniejących projektów/Cloud: **żadne**. Testy tworzą nowe network-none fixtures, 41 migracji od zera; końcowe `slm-lineups-edge-a10a01a6a920` i `slm-lineups-stage2a-a1ec4d83aabb` z kontenerami pomocniczymi zatrzymane/zachowane, brak publikacji portów. Most browsera wyłącznie loopback. Kong/Storage nie są dowiedzione przez ten test. Brak osobnego przebiegu Cloud Codex, hostowanego CI, merge, deployu lub zmiany telefonu. Główne worktree i niezapisane zmiany użytkownika nietknięte.

Otwarte/granice: wymagany osobny review właściciela dokładnego przypięcia czterech plików runtime do f47cd80 (manifest55 i stare warunki bez zmian, 8 nowych odmów). Brak realtime/trwałego szkicu offline; globalna blokada i limit12KB odziedziczone po2A. Istniejące ostrzeżenia build/Gradle. Naprawiono zakres zegara dwóch istniejących testów demo po odtworzeniu tego samego FAIL na bazie2A; bez zmiany asercji lub logiki demo. Runner browsera używa produkcyjnego bundle i profilu poza repo, nie zmieniano filtrów testów ani konfiguracji Windows.

**Technicznie gotowe do integracji po review; bez automatycznej zgody na merge.** Następny krok: review zależnego Draft PR do feat/premium-lineups-stage2a; osobno uzgodniony odbiór POCO i zgodny izolowany backend. Nie rozpoczynać kolejnego modułu. Kontrakt, polecenia PowerShell, ograniczenia, pliki i instrukcja POCO: [PREMIUM_LINEUPS_STAGE2B.md](PREMIUM_LINEUPS_STAGE2B.md). Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

---

# Historycznie: Stage 2A — domknięty i ponownie zweryfikowany lokalnie

2026-10-29 17:32 Europe/Warsaw — `feat/premium-lineups-stage2a`, kontynuacja istniejącego `c1cb2fd` od wskazanego Stage 1 `7ad5c75`. Nowy kod testów: `338db5af9ad06f12ba26e6f5df6e455aa12c2930`. Backend pozostaje dokładnie zatwierdzonym `b46b7b9`; brak ponownej implementacji, zmian migracji/handlera/Auth/finansów/UI/strażników. Dodano powtarzalny `app/scripts/test-lineups-edge-local.py`, zamykający brak rzeczywistego GoTrue → accounts Edge → PostgREST → PostgreSQL, także po restarcie i odebraniu dostępu.

Automatyczne PASS tej sesji Windows: 50 SQL/RLS/PostgREST/restart, 13 rzeczywistych GoTrue/Edge HTTP, 320 Vitest/52 pliki (23 Edge), 13 Cypress/5 plików z kontrolowanym API, TS aplikacji/strict Edge/lint, 29 testów strażników, konsolidacja 41 migracji / frozen UI 55 / runtime 8, build LIVE/Premium/demo + izolacja 16 plików. Istniejące ostrzeżenia rozmiaru chunków. Cloud Codex: brak osobnego przebiegu, nie przypisujemy mu lokalnych wyników. Ręczny odbiór POCO: NOT TESTED.

Migracje: wszystkie 41 odtworzono wyłącznie w NOWYCH odizolowanych fixtures; w istniejących projektach lokalnych i Cloud nie zastosowano żadnej. Edge uruchomiono tylko w nowej fixture. Końcowe `slm-lineups-stage2a-53bd33b37e1e` i `slm-lineups-edge-54d5c6c50f4c` z kontenerami pomocniczymi zatrzymane/zachowane, brak portów, sieć none/container. Wcześniejsze próby runnera zatrzymane/zachowane. Główne worktree `feat/ui-beta` z niezapisanymi zmianami nietknięte.

Brak obowiązkowych poleceń lokalnych pozostających dla Stage 2A; odtworzenie PowerShell i granice testów: [PREMIUM_LINEUPS_STAGE2A.md](PREMIUM_LINEUPS_STAGE2A.md). Niewykonane: Kong/Storage nowego stosu, fizyczny Android/APK, hostowane CI, Supabase Cloud, merge, podłączenie UI/Stage 2B. Nie zmieniano telefonu ani Windows. Następny krok: review istniejącego zakresu i odrębne zlecenie Stage 2B; nie podłączać Zapisz w ramach Stage 2A. Wcześniejszy Draft PR pozostaje nieutworzony po Forbidden; [porównanie gałęzi](https://github.com/psuda87/sunday-league-mates/compare/fix/premium-lineup-stage1-contract...feat/premium-lineups-stage2a). Pełna chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

---

# Historycznie: Stage 2A — zapis na GitHub, utworzenie Draft PR BLOCKED

2026-10-29 14:38 Europe/Warsaw — `f7c13bb3bc85a903c9840c9e47e08fcec0c4a887` wypchnięty na `feat/premium-lineups-stage2a`. API GitHuba odrzuciło POST DraftPR (`Forbidden`), numeruPR brak. [Porównanie do wskazanej bazy](https://github.com/psuda87/sunday-league-mates/compare/fix/premium-lineup-stage1-contract...feat/premium-lineups-stage2a?expand=1). Backend źródłowo zatwierdzony b46b7b9,50SQL/RLS/PostgRESTHTTP/restart,320Vitest,29policy,TS/lint/buildy/guard55/runtime8/konsolidacja41 PASS. PełnyGoTrueEdgeHTTP iAndroid NOT TESTED. Raport `docs/PREMIUM_LINEUPS_STAGE2A.md`; końcowe Git-doc osobnym commitem. SupabaseCloud/UI/Stage1/Save nietknięte; bezmerge/deploy/Stage2B.

---

# Stage 2A — końcowy przebieg50 PASS

2026-10-29 14:37 Europe/Warsaw — backend składu na `feat/premium-lineups-stage2a`; końcowa poprawka kodu b46b7b91796b96acfc809799e09a5a6898b99342 zachowuje replay potwierdzonego żądania także po późniejszym zmniejszeniu pojemności. Oczekiwania guardów przypięte do tego dokładnego źródła, bez osłabienia dawnych kontroli. Finalny pełny runner:50PASS SQL/RLS/PostgRESTHTTP/restart, fixture slm-lineups-stage2a-dbfaba8a9003 i-rest zatrzymane/zachowane. Poprzednie48+1 poniżej to wcześniejszy przebieg. Pozostałe wyniki:320Vitest,23Edge,29policy,TS/lint/buildy/izolacja16/guard55/runtime8/41migracji PASS. Bez GoTrueEdgeHTTP E2E, bez zmiany UI/Save, Cloud, merge lub Stage2B. Raport `docs/PREMIUM_LINEUPS_STAGE2A.md` uaktualniony; przygotowanie Draft PR do fix/premium-lineup-stage1-contract.

---

# Stage 2A — backend trwałych składów, bez podłączenia UI

2026-10-29 14:30 Europe/Warsaw — `feat/premium-lineups-stage2a` od7ad5c75414cf669d4471f3122e93073dab9aa8d7. Implementacja6f511f4: nowa migracja20261029140000, tabela slm_match_lineups, accounts lineups_get/save i usługowy dispatcher. Aktywni członkowie grupy, identyfikatory uczestnictwa/gości, oddzielna wersja składu i token rosteru, atomowy CAS oraz idempotencja na istniejącym rejestrze. No-op nie zmienia autora/czasu/wersji. Nazwa autora według aktualnych zgód PR16 także przy replay; brak nazwisk w cache. Bez eskalacji finansów/ról i bez Auth18.

PASS:48SQL/RLS/realPostgRESTHTTP na nowej odizolowanej fixture +1 osobna rzeczywista próba restartu PostgreSQL,320Vitest/52(w tym23Edge),TS/strictEdge/lint,buildLIVE/Premium/demo+izolacja16,guard55/runtime8/konsolidacja41 i29testów polityki. Guard rozszerzony wyłącznie o dokładnie1przypiętą migrację i pełny handler, stare zatwierdzenia/55plików UI bez zmian. SQL/JWT używa testowego bootstrapu i lokalnie podpisanych tokenów; pełny GoTrue→EdgeHTTP oraz Android NOT TESTED. UI/Stage1/przyciskZapisz niezmienione, Stage2B nie rozpoczęto.

Fixture slm-lineups-stage2a-e76f7f3b916b i-rest zatrzymane/zachowane, bez resetu/drop/usuwania. Cloud/POCO/istniejące bazy/produkcyjne konta nietknięte; bez merge/deploy/APK. Gotowe do rozpoczęcia lokalnego Stage2B po akceptacji, nie oznacza odbioru produkcji. Raport/kontrakt/ograniczenia: [PREMIUM_LINEUPS_STAGE2A.md](PREMIUM_LINEUPS_STAGE2A.md), chronologia ODPOWIEDZI_CODEX.txt. Przygotowanie Draft PR do fix/premium-lineup-stage1-contract.

---

# Kontrola Stage1 — końcowy zapis Git

2026-10-29 13:53 Europe/Warsaw — poprawka `b377174799723345c07647b32769d9319a89c507` wypchnięta na `fix/premium-lineup-stage1-contract`. PASS guard55/runtime8,23policy,297Vitest,TS/lint/buildy/demo; bez zmiany aplikacji. Draft PR nie utworzony: API `Forbidden`. [Porównanie względem Stage1](https://github.com/psuda87/sunday-league-mates/compare/feat/premium-lineup-editor-stage1...fix/premium-lineup-stage1-contract?expand=1). Raport `docs/PREMIUM_LINEUP_EDITOR_STAGE1.md` uzupełniony; rekomendacja dalszej integracji lokalnego Stage1 po review. Brak merge, backendu iStage2. Końcowy zapis dokumentacji w osobnym commicie.

---

# Stage1 — kontrola Premium uporządkowana, PASS

2026-10-29 13:51 Europe/Warsaw — `fix/premium-lineup-stage1-contract` od b30908e. FAIL wynikał wyłącznie z porównania PremiumEvents/PremiumTeams z poprzednim a82397b. Tylko te2 istniejące pliki i2 nowe zależności lineupEditor/LineupPlayerProfile przypięto teraz do niezmiennego b30908e. Bez zmiany runtime aplikacji, wyglądu, manifestu55 i wcześniejszych zatwierdzeń innych plików; strażnik nie jest wyłączony ani oparty na bieżących edytowalnych hashach.
PASS: frozen55/runtime8,23testy polityki (1graf+22odmowy),297Vitest/51,TS/lint,buildLIVE/Premium/demo+izolacja16,verify:consolidation. Chromium nie ponawiano: brak zmian UI/zachowania; poprzednie zrzuty pozostają historyczne. Bez operacji/zmian Supabase/Auth/RLS/migracji/Cloud, merge iStage2. Rekomendacja: Stage1 gotowy do dalszej integracji lokalnego edytora po review, nie produkcyjny zapis składów. Szczegóły/przyczyna/klasyfikacja/ryzyka: [PREMIUM_LINEUP_EDITOR_STAGE1.md](PREMIUM_LINEUP_EDITOR_STAGE1.md); chronologia `ODPOWIEDZI_CODEX.txt`. Przygotowanie zależnego Draft PR do feat/premium-lineup-editor-stage1.

---

# Edytor składów — zapis Git, Draft PR BLOCKED

2026-10-29 13:05 Europe/Warsaw — implementacja `6acde90598a7bd67ce97eb676089d5995bb8fe9e` wypchnięta na `origin/feat/premium-lineup-editor-stage1`. Utworzenie zależnego Draft PR przez API odrzucone (`Forbidden`), numeru PR nie ma. [Właściwe porównanie do chore/main-stabilization](https://github.com/psuda87/sunday-league-mates/compare/chore/main-stabilization...feat/premium-lineup-editor-stage1?expand=1). Szczegóły i wyniki, w tym niezmieniony guard runtime FAIL do przeglądu: [PREMIUM_LINEUP_EDITOR_STAGE1.md](PREMIUM_LINEUP_EDITOR_STAGE1.md). Dokumentacja końcowa ma oddzielny commit; bez merge/Cloud/deploy i bez rozpoczęcia etapu2.

---

# Edytor składów Premium — etap 1, lokalny podgląd

2026-10-29 13:03 Europe/Warsaw — `feat/premium-lineup-editor-stage1` od dokładnego PR24 `39ef2e3937b781439864029a92c12de315024263`; baza zdalna sprawdzona, początkowy worktree czysty. Zachowano oryginalny PremiumPitch, karty/Ultimate/BottomNav/CSS. Dodano odrębne baseline/draft, transfer jednej osoby A/B, poprawne przywracanie i wykrywanie zamiany powrotnej, stabilne ID uczestnictwa/gości. Profil z boiska używa istniejących groups_profile i UltimatePlayerCard, bez obchodzenia grupowych uprawnień; powrót zachowuje szkic. Zapis stale niedostępny, brak backendu składów i fikcyjnego autora.

PASS: TypeScript, pełny lint,297 Vitest/51 plików i końcowy zakres15/3, build LIVE/Premium/demo+izolacja16, Chromium320/390/768 Dark/Light z kontrolowanym adapterem (nie E2E Supabase). Kontrakt55 plików wyglądu PASS; **guard przypiętego runtime FAIL** na celowej zmianie PremiumEvents (również PremiumTeams jest przypięty do starego SHA). Nie zmieniano strażnika/hashów/CI: wymagany przegląd właściciela przed zmianą reguły zatwierdzeń/merge. Supabase/SQL/RLS/Auth/finanse/Android/produkcja niezmienione; brak migracji, resetów, APK/deploy/merge. Pełny Supabase/Cypress i fizyczny telefon NOT TESTED. Raport i4 rzeczywiste zrzuty fixture UI: [PREMIUM_LINEUP_EDITOR_STAGE1.md](PREMIUM_LINEUP_EDITOR_STAGE1.md). Etap2 wymaga osobnego backendu: trwałość, autor, CAS rosteru/składu i idempotencja; nie rozpoczęto.

---

# PR16 — poprawka etykiet odebrana na POCO

2026-10-26 18:51 Europe/Warsaw — PR16: ręczny odbiór poprawki etykiet na POCO
Właściciel po aktualizacji APK z kodu69f3aa6 potwierdził: „ok działa jest ok”. Zapisano pozytywny ręczny odbiór poprawki odstępów formularza profilu na POCO. Nie dopisujemy oddzielnych wyników każdego pola, motywu ani scenariusza klawiatury, ponieważ odpowiedź była ogólna. Bez nowych zmian aplikacji/backendu/APK i bez ponawiania testów. PR #16 bez merge; potwierdzenie działania nie jest poleceniem scalania. Raport docs/ODPOWIEDZI_CODEX.txt.

---

# PR16 — APK z poprawką etykiet na POCO

2026-10-26 18:50 Europe/Warsaw — feat/premium-profile-name-privacy; kod69f3aa6. Premium build/cap sync/assembleDebug i weryfikacja APK PASS. Za zleceniem właściciela install-r Success na c7a559b5 bez czyszczenia danych; start Status:ok, hash zainstalowanego APK155cf3d0…603f5c9 zgodny. Podpis/kopia starej wersji sprawdzone. Backend testowy HTTP200/reverse54321→56321; bez Cloud/migracji. Log:0 crash/JS/net::ERR_, jeden systemowy komunikat WebView variations „Seed missing signature”. Następny krok: ręczna ocena odstępów pól i fokus/przewijanie przy fizycznej klawiaturze, Light/Dark. PR16 bez merge; raport docs/ODPOWIEDZI_CODEX.txt i docs/PREMIUM_PROFILE_IMPLEMENTATION.md.

---

# PR16 — poprawka odstępów formularza Premium

2026-10-26 18:47 Europe/Warsaw — feat/premium-profile-name-privacy, baza 67b9e9c. CSS: pionowe etykiety z 7 px przerwą dla zagnieżdżonych pól; żadnych zmian logiki/backendu/kolorów/karty. PASS: TS/lint, 8 Vitest, 6 Chrome/Cypress (320/360/390 × Light/Dark, wysokości 844/380), main/Premium build, source contract55. Przed poprawką wszystkie6 konfiguracji wykazywały odstęp0 px. Nowe fikcyjne fixture/testy i zrzuty docs/ui/pr16/profile-labels-*.png. Fizyczna klawiatura i POCO z tą poprawką NOT TESTED; bez nowego APK/instalacji. Istniejące wyniki backendu pozostają historyczne. Migracje/Edge/Cloud/PR14/15 bez zmian. Aktualizacja istniejącego PR #16, bez merge. Następny krok: ręczny odbiór odstępów i fokus/przewijanie na POCO po osobno zleconej aktualizacji APK. Szczegóły docs/PREMIUM_PROFILE_IMPLEMENTATION.md i docs/ODPOWIEDZI_CODEX.txt.

---

# PR16 — ogólny wynik ręczny POCO pozytywny

2026-10-26 18:37 Europe/Warsaw — właściciel: „generalnie wygląda na to, że wszystko działa”. Nie zgłoszono usterki zainstalowanego APK6cf904ce. Zapisano pozytywną ogólną próbę ręczną; brak oddzielnych wyników pełnej checklisty, bez dopisywania indywidualnych PASS. Wcześniejsze testy techniczne pozostają zaliczone. PR #16 nadal bez merge; brak polecenia scalania. Tylko dokumentacja, bez ponawiania testów ani zmian aplikacji/Cloud/PR14/15. Szczegóły docs/ODPOWIEDZI_CODEX.txt i docs/PREMIUM_PROFILE_IMPLEMENTATION.md.

---

## Historia odbioru technicznego

# PR16 — odbiór techniczny lokalny, oczekuje odbioru ręcznego

PR #16: https://github.com/psuda87/sunday-league-mates/pull/16 — techniczny commit ed71f29 wypchnięty, draft bez konfliktów i merge.

2026-10-26 18:33 Europe/Warsaw — feat/premium-profile-name-privacy, baza76da23a, istniejący PR #16. Odizolowany pełny Supabase slm-pr16-review/API56321 z35 migracjami; oryginalny lokalny backend34/64 konta/33 grupy/13 meczów bez zmian, Cloud/PR14/15 nietknięte.
PASS: real Auth/Edge/PostgREST33 HTTP + real browser1, SQL fixture28/replay35,254 Vitest/43 pliki, TS/lint, main/Premium/demo isolation, guards32/35/55, cap sync/Android. Poprawki:409 consent_required zamiast503, wyścig dismiss Ionic, styl akcji ukrycia imienia, cross-platform allowlista demo z4 regresjami. Bez zmiany migracji i Auth aplikacji.
APK6cf904ce zainstalowano za osobną zgodą install-r na c7a559b5 bez czyszczenia danych, podpis zgodny; kopia poprzedniego APK zachowana. Reverse telefonu54321→komputer56321, start ok, brak znalezionego FATAL EXCEPTION/błędu WebView. Fikcyjne konta Zawodnik/Obserwator i2 grupy odbioru; poświadczenia tylko prywatnym TEMP poza Git. Ręczny odbiór A–G/Android nadal oczekuje, PR draft bez merge. Szczegóły/checklista/rollback: docs/PREMIUM_PROFILE_IMPLEMENTATION.md; odpowiedzi docs/ODPOWIEDZI_CODEX.txt.

---

# Premium profil B2/B3 — 2026-10-26 13:20:55 CET

Gałąź feat/premium-profile-name-privacy z main edd2e92.
Implementacja 1f9d460 wypchnięta; utworzenie Draft PR zablokowane przez
GitHub API403 Forbidden. Link formularza i pełny raport poniżej. Publiczny nickname
niezależny od loginu,3 globalne display_as, jawne first_name i share_first_name,
atomowe potwierdzone zgody w aktualnych grupach, read-back, fallback/RLS i spójne
nazwy grup/kart/zapisów. Nowa migracja20261026120000, historyczne bez zmian.
Supabase Cloud/sekrety/Auth sesje/APK/config nietknięte, bez merge/deploy.

PASS: TS/full lint,248 Vitest, build aplikacji,35 migracji PostgreSQL replay,
28 asercji SQL/RLS i persistence po restarcie PostgreSQL. Auth/Storage w tym
teście to fixture, nie pełny Supabase. NOT TESTED pełne HTTP/Auth/Edge i telefon;
CLI lokalny zablokowany EROFS. Build demo FAIL jak czysty main: frozenDemoAndroid
poza allowlistą. Bez obchodzenia izolacji. Szczegóły/ryzyka/odbiór przed merge:
[PREMIUM_PROFILE_IMPLEMENTATION.md](PREMIUM_PROFILE_IMPLEMENTATION.md).

# Aktualizacja UI B3 po POCO

2026-10-25 21:34 Europe/Warsaw — feat/premium-b3-groups, istniejący PR #13. Poprawiono wyłącznie kompaktowy przełącznik zgody per grupa i przycisk odświeżania (44px, ikona, stan ładowania, deduplikacja). Załadowane dane nie znikają podczas refresh, błąd zapisu zachowuje stan i kontrolkę. Backend/RLS/Auth/Ultimate/BottomNav bez zmian; brak operacji Cloud.
PASS: TS/lint,240 Vitest/41 plików, build Premium i demo/isolation, guards32/55, lokalny HTTP28 i real browser1 (4 szerokości ×2 motywy, zgoda po refresh/reload). Nowego testu POCO ani instalacji APK nie wykonywano. PR pozostaje do zatwierdzenia, bez merge. Szczegóły docs/PREMIUM_B3_GROUPS.md i docs/ODPOWIEDZI_CODEX.txt.

---

# Aktualny stan — Premium B3

2026-10-25 21:05 Europe/Warsaw — feat/premium-b3-groups z main a46f5e4. Premium ma rzeczywiste grupy/członkostwo/zgody przez istniejące RPC; domyślny LIVE zachowany, mecze/finanse Premium nadal demo. Auth/profil/numer/zdjęcia bez cofnięcia integracji; CSS/Ultimate/BottomNav bez zmian.
Lokalnie za zgodą zastosowano wersjonowane B2.2 i dwie migracje B3 (20261025190022/20261025193229), bez resetu. Lokalny Edge z bieżących źródeł. Cloud tylko odczyt: ACTIVE_HEALTHY, 7 migracji wobec34 lokalnie; wdrożenie B3 do Cloud wymaga osobnego przygotowania i zgody, niczego zdalnie nie zastosowano.
PASS: TS/lint,235 Vitest, SQL102+31, replay11/34 migracje, B3 HTTP28 i real browser1 (4 szerokości ×2 motywy), LIVE HTTP20/browser1, Cypress LIVE13 i B1/B2/B22 6, cztery buildy, guards32/55, sync/Android. Natywny unit:1 test szablonowy, nie test Keystore. Lokalne advisors0 WARN/ERROR; cztery znane SQL warnings. Cloud: istniejący Auth WARN i9 INFO, starsza polityka profili niezgodna z B3.
APK premium zainstalowano aktualizacją na POCO i uruchomiono; bez czyszczenia danych. Ręczny odbiór B3 NOT TESTED. Znane ograniczenia: cudze zdjęcia/statystyki niedostępne; Premium wydarzenia nadal demo; FCM/iOS/Cloud niezbadane end-to-end.
PR #13: https://github.com/psuda87/sunday-league-mates/pull/13 — draft, bez scalania; commit implementacji7a9f41f wypchnięty. Następny krok: lokalny odbiór grup na POCO i przegląd PR bez automatycznego merge. Raport/checklista: docs/PREMIUM_B3_GROUPS.md; odpowiedzi: docs/ODPOWIEDZI_CODEX.txt.

---

## Historia przed B3

# Aktualny stan Sunday League Mates

2026-10-25 17:35 Europe/Warsaw — fix/bottom-nav-highlight z main2c3e3f2. Naprawiono wyłącznie aktywny stan i obszar przycisków BottomNav, zachowując + oraz wygląd Premium/kartę Ultimate. TS/lint, 8 jednostkowych testów nawigacji, 8 konfiguracji Cypress (4 szerokości ×2 motywy ×3 warianty paska), build main/Premium, cap sync i source guards PASS. Android assembleDebug PASS. Backend/Auth/SQL/dane bez zmian. Poprawka zakończona; [PR #12](https://github.com/psuda87/sunday-league-mates/pull/12) zawiera wynik scalania i commit main (źródło aktualnego statusu). Użytkownik autoryzował squash merge po zielonych kontrolach, bez wdrożenia. Szczegóły: docs/ODPOWIEDZI_CODEX.txt; zrzuty: docs/ui/bottom-nav.

---

## Stan historyczny przed poprawką BottomNav

# Aktualny stan Sunday League Mates

2026-10-25 17:23 Europe/Warsaw — końcowy przegląd PR #11: sprawdzono ae397c4 względem main 1fadd977, brak konfliktów (main ancestor, GitHub mergeable=true). Brak błędów blokujących. PR oznaczono Ready for review zgodnie z wyraźnym poleceniem właściciela, bez merge.
Domyślny LIVE i 29 migracji main zachowane; Premium B1/B2 jawny wariant lokalny; karta/CSS30772de i55 plików Premium bez regresji. Uwzględniono7/7 ręcznych PASS właściciela. Nie wykryto utraty funkcji/danych w sprawdzonym zakresie.
Powtórzono: TS/lint/229 Vitest, source guards, diff check PASS; SQL9/9 i64/64 (w tym wcześniej pominięty późny cutoff i rzeczywisty push_claim). Security advisors0 problemów, scan367 ścieżek0 rozpoznanych sekretów. Cztery ostrzeżenia SQL nie blokują merge: push_claim ma poprawny wynik runtime; p_number jest zachowaną kompatybilną sygnaturą; v_before/v_rows to nieużywane deklaracje. Brak zmian kodu i nowych migracji. Testy tylko we własnych nowych lokalnych bazach, istniejąca baza bez zmian. Brak zdalnych migracji/deploy/Storage i brak merge. Oczekuje osobne potwierdzenie właściciela na scalenie; FCM/iOS/zdalny rollout niezweryfikowane. Szczegóły: docs/V1_CONSOLIDATION.md.

---

## Historia przed końcowym przeglądem

# Aktualny stan Sunday League Mates

2026-10-25 17:18 Europe/Warsaw — ODBIÓR RĘCZNY KONSOLIDACJI: właściciel potwierdził wszystkie siedem scenariuszy PASS (Premium Auth/sesja, profil/numer, zdjęcia, wygląd Ultimate/oba motywy, oznaczenie demo, funkcje LIVE, brak crashy/błędów uprawnień/utraty danych). Źródło: deklaracja właściciela po testach, nie nowe testy automatyczne agenta.
PR #11 nadal draft i bez scalania. Odbiór ręczny nie jest zgodą na merge ani zdalne wdrożenie. Pozostają wcześniej opisane ostrzeżenia SQL i pominięty test późnego cutoff; nie rozpoczęto kolejnego modułu.

---

## Historia konsolidacji i stan wcześniejszy

# Aktualny stan Sunday League Mates

2026-10-25 17:15 Europe/Warsaw — POCO ponownie widoczne przez ADB; reverse54321 przywrócone, backend HTTP204. Aplikacja ponownie uruchomiona bez czyszczenia danych/logout. Potwierdzenie sesji na ekranie oczekuje na użytkownika.

2026-10-25 17:14 Europe/Warsaw — backend lokalny odpowiada, ale ADB nie widzi POCO. Przywrócenie reverse i ponowienie sesji czeka na ponowne podłączenie USB; bez logout/resetu danych.

2026-10-25 17:10 Europe/Warsaw — Premium B1/B2 konsolidacji zainstalowane na POCO przez install -r i uruchomione. Lokalny API/reverse działają; brak sprawdzanych markerów crasha/transportu w logcat procesu. Bez czyszczenia danych. Odbiór ręczny wyglądu, sesji i profilu oczekuje na właściciela. PR #11 nadal draft, bez merge. Poniższy raport budowy jest historyczny względem tej instalacji.

2026-10-25 17:04 Europe/Warsaw — feat/v1-consolidation, baza main 1fadd977, izolowany worktree .worktrees/v1-consolidation.
Domyślny LIVE main zachowany. Premium B1/B2 to jawny wariant lokalny: realne Auth/własny profil, poza tym oznaczone demo. Karta/CSS z 30772de, wzorzec Premium d0f9fa9. 29 migracji main nienaruszone; 3 wcześniej zatwierdzone lokalne SQL przeniesione do historii (32), bez zależności od cudzej .cache. Lokalny Edge uruchomiony z kanonicznych źródeł; brak migracji/resetu istniejącej i zdalnej bazy, brak wdrożeń zdalnych.
PASS: TS/lint/diff, 229 Vitest, SQL9+63, HTTP B1 9/profil22/zdjęcia38/scoped20, realny browser LIVE1, Cypress B1/B2 6, kodek1, Premium smoke8 rozmiarów/motywów; build main/demo/oba lokalne APK, native unit i weryfikacja zasobów. Release local prawidłowo zablokowany. CORS na 5193 prawidłowo odrzucił test; 5174 PASS bez zmiany zabezpieczeń. Lint SQL kod0 z czterema istniejącymi ostrzeżeniami, jawnie w raporcie. Późny cutoff i fizyczny odbiór konsolidacji NOT TESTED. ADB device potwierdzone, nowego APK nie instalowano; instrukcja install -r w raporcie.
Skan wzorców sekretów bez potwierdzonego sekretu; marker PEM w niezmienionym parserze FCM nie jest kluczem. Brak zmian zdalnych Supabase/Storage, bez B3/B4, Maps i nowych metod Auth. AGENTS.md zawiera nową zasadę moduł→testy→akceptacja→PR→osobno potwierdzony merge main przed następnym modułem.
Szczegóły, SHA APK, pozostałe demo, rozstrzygnięcia i instrukcje odbioru: docs/V1_CONSOLIDATION.md. Zrzuty tylko fikcyjnych danych: docs/ui/v1-consolidation. Gałąź wypchnięta; [draft PR #11](https://github.com/psuda87/sunday-league-mates/pull/11) otwarty bez scalania, implementacja `f50484f`. Następny krok: odbiór POCO i review. Main nadal `1fadd977`.

---

## Stan historyczny przed konsolidacją

# Aktualny stan Sunday League Mates

19.10.2026 ? branch roboczy `feat/integration`, worktree `I:\slm\sunday-league-mates-integration`.
Rdze? integracji: `0ec5200`; dokumentacja i ?r?d?a grafik: `309d57c`. Oba commity wypushowano. [PR #2](https://github.com/psuda87/sunday-league-mates/pull/2) scalono standardowym merge `c28b09d77a6a203954c10060d1e87aa105cfeef2` do main. Lokalny main zsynchronizowano fast-forward bez prze??czania worktree. Bez wdro?enia aplikacji i zdalnej bazy.

## Wykonane funkcje

- Auth legacy i logowanie potwierdzonym e-mailem, profil, wymuszona zmiana has?a, reset oraz bezpieczna trwa?a sesja.
- Wiele grup, zgody/zaproszenia, role, sukcesja i zachowanie w?asnej historii.
- Mecze publiczne/prywatne, atomowe zapisy, go?cie, osobna rezerwa bez autoawansu, obecno?? i odwo?anie.
- Finanse oddzielone mi?dzy grupami: celowe wp?aty, FIFO, korekty, zwroty, audyt i osobne nadwy?ki naliczone/otrzymane.
- Globalna blokada nowych p?atnych zapis?w po dw?ch kwalifikuj?cych zaleg?o?ciach; brak wgl?du w cudze finanse.
- Transakcyjny inbox/outbox powiadomie? finansowych i wydarze?, worker i recheck odbiorc?w; FCM nieaktywne.
- Nowszy interfejs Premium z ui-beta po??czony z rzeczywistym backendem; demo buduje si? osobno.

## Migracje i Edge Functions

Lokalnie zastosowano 29 migracji: 13 historycznych i 16 nowych; ko?cowa `20261019175940_slm_v2_legacy_payment_dto.sql`.
Lokalnie dzia?aj? `accounts` i `push-worker`. W tym etapie nie wdra?ano niczego do chmury, nie zmieniano konfiguracji Supabase/Firebase/SMTP ani plan?w.
Przed przysz?ym rolloutem wymagany osobny przegl?d trzech napraw historycznych migracji i jednoznacznego mapowania dawnej grupy. Replay na fikcyjnych danych zachowa? histori? ledgeru 1:1.

## Wyniki ponowione w tym zadaniu

- TypeScript, ESLint i Deno: PASS. Vitest: 190/190; bootstrap: 6/6.
- SQL legacy: 31 PASS; SQL v2: 55 PASS; replay wszystkich migracji: 9 PASS.
- HTTP Auth: 7 zestaw?w PASS; scoped: 20 PASS; smoke/worker: 9 PASS.
- Rzeczywista przegl?darka ? lokalny Edge ? PostgreSQL: 1 PASS, bez mock?w.
- Cypress z kontrolowanym API: 13/13. To nie s? testy na telefonie.
- Web build, osobny demo build i izolacja 15 artefakt?w, cap sync android: PASS.
- Android assembleDebug + testDebugUnitTest: BUILD SUCCESSFUL; task jednostkowy UP-TO-DATE, nie nowy odbi?r urz?dzenia.
- SQL lint: exit 0, 3 ostrze?enia, brak b??d?w. Szczeg??y w raporcie audytu.
- npm audit: 6 moderate, w produkcji 3 moderate; 0 high/critical. Raport nie jest czysty.
- Skan stagingu i wychodz?cej historii: brak sekret?w; ?r?d?a Androida i package-lock zachowane. Formatowanie ko?c?w plik?w poprawiono po staged diff --check.
- Po testach: 0 kont/grup/mecz?w/scratch DB; 0 tabel SLM bez RLS; 0 RPC SLM dost?pnych anon.

## Git i zasoby

Auth/events/settlements/push zachowane w historii integracji; ui-beta zachowany na osobnej ga??zi i przeniesiony r?cznie.
Nowy dostarczony herb 1254?1254 zabezpieczono w `docs/branding/slm-crest-duo-source.png`; dwie grafiki ?r?d?owe w `pics/`. Nie podmieniano logo aplikacji 450?505.
Oryginalny worktree ui-beta i jego nie?ledzone pliki zachowano; identyczne kopie grafik s? cz??ci? integracji.
Automatyczne wdro?enia Git dla tej wersji wy??czaj? root i app/vercel.json. Nie wywo?ywano deploy ani produkcyjnych migracji.
Ga??zie ?r?d?owe pozostaj? zachowane. Po scaleniu #2 potwierdzono identyczno?? drzew origin/main i sprawdzonej integracji oraz niezmieniony ostatni deployment Vercel. Dodatkow? grafik?, kt?ra pojawi?a si? podczas audytu, zabezpieczono 1:1 jako `docs/branding/slm-gold-crest-comparison-source.png`; nie jest u?ywana przez aplikacj?. Ko?cowa aktualizacja dokumentacji i kopia tej grafiki stanowi? osobny commit zabezpieczaj?cy.

## Ograniczenia i nast?pny etap

SLM 1.0 NIE jest gotowe do publikacji. Osobnej weryfikacji wymagaj? fizyczny telefon, iOS, rzeczywista dostawa FCM oraz pe?ny email/SMTP/domena/legal/callbacki. Signup i poczta nadal zablokowane; istniej?ce konta dzia?aj?. CAPTCHA od?o?ona.
Vector nadal restartuje si?; nie zmieniano Docker socket ani ustawie? Windows. Testowany rdze? dzia?a bez niego.
Pozosta?y moderate zale?no?ci oraz ostrze?enia bundle/Browserslist/Gradle. Brak skonfigurowanych Actions CI i zabezpiecze? main w chwili audytu; nie zmieniano tych ustawie? i niczego nie omijano.
Nast?pny etap: r?czny odbi?r obecnej integracji na telefonie, przegl?d rollout danych i osobne uzgodnienie poczty oraz FCM. Merge kodu nie oznacza wdro?enia ani gotowo?ci do wydania.

Raport: [REPOSITORY_AUDIT.md](REPOSITORY_AUDIT.md). Szczeg??owa historia: [ODPOWIEDZI_CODEX.txt](ODPOWIEDZI_CODEX.txt).


## 2026-10-28 22:43:55 Europe/Warsaw — konsolidacja stabilnego main, Draft PR24
Branch chore/main-stabilization, baza origin/main134c52b niezmieniona. e73d5fe: selektywne PR20–23/Premium real data; cb13ee9: guards/CI/testy i zgodność PR16. Auth18/online19 wyłączone z konsolidacji. Domyślny LIVE zachowany.
Backend: 35 migracji main +4 PR23 +nowa20261028204500 restore_pr16_match_name_projection =40. Zastosowane tylko w nowym lokalnym slm-main-stabilization/55321. Edge lokalnie z tych samych źródeł. Bez migracji/deploy Cloud i bez zmian używanej bazy POCO64321.
Automatyczne PASS: TS aplikacji/strict Edge, lint,289 Vitest/50plików,13 guards,116HTTP (29mecze+48finanse+39profil/Auth/Storage),6SQL/RLS,3Chrome320/360/390Light/Dark,build LIVE/Premium/demo/Androidweb,Capacitor sync/assembleDebug exit0. Regresja PR16 nazwy uczestników wykryta i naprawiona nową migracją, bez zmiany wcześniejszych SQL/zgód.
Ręczne POCO: NOT TESTED; APK NIE instalowano. Hostowane CI NOT RUN, przygotowane ręczne z warunkiem bezpłatnego limitu; GitHub protection/rulesets bez zmian. Zachowane HEAD i niezacommitowane notatki pozostałych16worktree.
Otwarte:4zastane ostrzeżeniaSQL (push_claim wymaga osobnej kontroli delivery),6moderate npm,brak trwałych składów,Cloud/SMTP/FCM bez odbioru. APK Stage3 nadal celuje w64321, testy odbyły się na55321; przed instalacją osobno uzgodnić kompatybilny backend/endpoint.
Następny krok: odbiór Draft https://github.com/psuda87/sunday-league-mates/pull/24 i raportu docs/MAIN_CONSOLIDATION_REPORT.md; osobna zgoda na test telefonu/merge/Cloud/ochronę CI. Bez merge, deployu, resetów i usuwania gałęzi. Pełna odpowiedź docs/ODPOWIEDZI_CODEX.txt.

## 2026-11-02 17:56 Europe/Warsaw — odbiór Public Discovery backend42

Bieżąca gałąź test/public-discovery-backend42-acceptance z dokładnego Stage2C e246c514af0fbca79dee892d9aa0e31b937a83c3. Na polecenie właściciela uruchomiono Docker Desktop. Rzeczywiste automatyczne testy Windows + lokalne Linux containers: PASS52 SQL/RLS i PASS44 HTTP (31 discovery +13 core), pełne42 migracje, real GoTrue/Edge/PostgREST/PostgreSQL. Użyto istniejących niezmienionych runnerów z prawdziwego Stage2B fd4fccd, backend identyczny z2C. Dodatkowy callback testowy i bezpieczny wyciąg wyników w docs/review; bez zmian aplikacji/pinów/manifestu55/CI.
Wdrożenia istniejących baz i Cloud: brak. Wszystkie10 NOWYCH kontenerów prób zatrzymane/zachowane, network-none/wspólny namespace własnej fixture, brak publicznych portów. Zastane usługi, wolumeny, konta i worktree zachowane.
WARN/NOT RUN: Chromium/Android/POCO, naturalna godzinna expiry/refresh, obciążenie, pełna regresja finansów i bieżący Linux SourceTests/symlink. Podpisana negatywna fixture expiry odrzucona przez GoTrue403 i Edge401; logout/leave/revoke zaliczone. GitHub-hosted NOT RUN, Actions nie aktywowano. Ręcznych testów nie wykonywano. Raport docs/PUBLIC_MATCH_DISCOVERY_BACKEND42_ACCEPTANCE.md. Następny krok: decyzja właściciela o integracji z zachowaniem ancestry; bez squash/rebase/merge/deploy w tym zadaniu. Chronologia docs/ODPOWIEDZI_CODEX.txt.

## 2026-11-02 18:05 Europe/Warsaw — przygotowanie integracji historii v1.0

Gałąź raportu test/public-discovery-backend42-acceptance, źródło ae6bb4b zachowane. PASS14 krawędzi ancestry od aktualnego origin/main134c52b; PR24/28/29/30 nadal open/Draft bez merge. Docelowe przygotowanie przez istniejący feat/slm-v1-release-candidate/1575bef i PR30, bez ponownego scalania PR20–23/Auth18/PR31.
Automatyczne tej sesji: source gate PASS na acceptanceae6bb4b, RC1575bef i pobranym z GitHub testowym merge PR30e73041a; rzeczywisty offline Linux26/26 i10 odmów naruszenia źródeł na tym merge,45 policy, consolidation42/55/10. Wcześniejszy problem Windows symlink nie blokuje tego wykonanego uruchomienia Linux. Piny backend24a59e1/runtimeae2fd95/CId7b36ee/pointercb63962/manifest55 bez zmian.
WARN: potrzebny osobno zatwierdzony dokumentacyjny merge acceptance→RC z zachowaniem obu historii i ponowną kontrolą nowego SHA/merge ref, potem dopiero zgoda na merge PR30→main. Nie wykonano żadnego z tych kroków. PR31 poza zakresem, Cloud/Android/pełny produkt nadal mają osobne warunki. GitHub-hosted NOT RUN (dwa skipped na RC, zero runs na acceptance/testowym merge). Nowych SQL/HTTP fixture, TS/lint/Vitest/build nie powtarzano przy identycznych źródłach. Bez wdrożonych migracji lub Edge; Cloud i istniejące bazy nietknięte. Raport docs/SLM_V1_HISTORY_INTEGRATION_PLAN.md; chronologia docs/ODPOWIEDZI_CODEX.txt.

## 2026-11-02 18:27 Europe/Warsaw — działający SLM2.0RC

release/slm-2.0-rc: autoryzowane zwykłe merge RC1575bef +PR311b3aed6 +acceptanceba6ef30; kod merge a4ddd11. Pełne ancestry CI d7/cb oraz piny PR31 zachowane, app identyczne z PR31, backend identyczny z odebranym ae6bb4b. main/Cloud/istniejące bazy nietknięte. Nie dodano nowych funkcji.
Faktyczne automatyczne PASS: TS/lint/strictEdge,372Vitest,53policy,consolidation42/55/11,Linux29kontraktów+69odmówsourcegate,6Cypress,14lineupsChromium+14discoveryChromium na nowej fixture42,11coreHTTP przed callbackiem usługowym,9relay,web/AndroidStage3web,Capacitor sync,GradleassembleDebug/testDebugUnitTest,2nativeinsets przez adb instrument. FullAndroid3:2PASS/1FAIL stary test szablonowy oczekuje innego applicationId; źródeł/guardów nie zmieniano dla PASS. Gradle connected --offline dodatkowo blokuje brak cache UTP; bez nowej instalacji test APK wykonano rzeczywiście przez ADB.
Nowy testowy GoTrue/Edge/PostgREST/PG42 działa tylko we własnych4network-none kontenerach, loopbackrelay55421. Na emulatorze zainstalowano APK, reverse64321→55421, rzeczywisty login i testowe prywatne/publiczne karty PASS. POCO/pełna ręczna checklista NOT RUN. Lokalny APK .cache/slm2/slm-2.0-rc-debug.apk, hashbdffa9c03976472efd3dfdb1bd05e47526c71acb77ffeb75dfffb7dd8a8b5fc7. Loginy wyłącznie ignorowany .cache/slm2/TEST-LOGIN.txt. StorageAPI/FCM nie uruchomione w tej fixture. Wdrożenia istniejących baz/Cloud:brak;42 migracje odtworzono wyłącznie w NOWEJ fixture.
Instrukcja instalacji/uruchomienia i checklista docs/SLM_2_0_RC.md; bezpieczne zrzuty docs/ui/slm2-rc. Następny krok: ręczne testy POCO przez jawny serial i lokalne konta, bez zmiany starych danych. GitHub-hosted NOT RUN; Actions nie aktywowano. Chronologia docs/ODPOWIEDZI_CODEX.txt.

2026-11-02 18:30 Europe/Warsaw: opublikowano release/slm-2.0-rc/ecf37e6, Draft https://github.com/psuda87/sunday-league-mates/pull/32 →main134c52b, open/draft/clean bez merge. Hostowane2runs skipped, niePASS. Backend42 i APK dostępne lokalnie według raportu; finalnySHA toHEAD gałęzi po dopisaniu publikacji. Żadnych zmian app/guardów po testach. Chronologia docs/ODPOWIEDZI_CODEX.txt.

2026-11-02 18:42 Europe/Warsaw: na release/slm-2.0-rc utworzono w istniejącej WŁASNEJ fixture42 jeden prywatny mecz „SLM RC - 13 uczestnikow”, grupa „SLM 2.0 RC testy”,09.11.2026 18:00 Europe/Warsaw. Odczyt API PASS:13 różnych zapisanych zawodników,0gości,0rezerwy,limit15. Dwa istniejące fikcyjne konta +11 nowych fikcyjnych zawodników; członkostwa zaakceptowane przez ich własne sesje. Bez zmian kodu/Cloud/innych baz/APK; zachowano parametry daty/godziny/miejsca/kosztu/limitu istniejącego testowego meczu. Następny krok: odświeżyć Mecze w lokalnym RC. Chronologia docs/ODPOWIEDZI_CODEX.txt.


## 2026-11-03 18:53 Europe/Warsaw — fix/slm2-minimum-phone

Wykonano minimum/default10 i własny telefon PL/+48/hasło, migracja43tylko w nowejfixture; bezCloud/istniejącychbaz/merge/POCO. PASS387Vitest,61policy,consolidation43/55/13,Linux32+87source,SQL51,GoTrueEdge47,TS/lint/strictEdge/web/demo/AndroidAPK/JVM1/insets2. EmulatorLIVE:edycja minimum,zapis telefonu i niezależneAPIreadbackPASS. Backend43/55431wznowiony bezresetu; APK.cache/minimum-phone/slm2-minimum-phone-debug.apk. WindowsWinError1314symlink rozstrzygnięty pełnymLinux; hostedActions/POCONOTRUN. Piny51c980b/0d82b09/023dc9b/2de6e5e,Premium55manifestnietknięty. Raport docs/SLM_2_0_MINIMUM_PHONE.md,chronologia docs/ODPOWIEDZI_CODEX.txt. Następnykrok:DraftPRdoRC,odbiórścisłychpinówprzezwłaściciela,osobnytestPOCO; bezsquash/rebase.


2026-11-03 18:57 Europe/Warsaw: opublikowano fix/slm2-minimum-phone, Draft PR33 → release/slm-2.0-rc/fa6bc792, bez merge. Funkcje minimum i telefonu oraz emulator LIVE PASS. APK i backend43/55431 gotowe według docs/SLM_2_0_MINIMUM_PHONE.md. Przed integracją: odbiór ścisłych pinów; test POCO i GitHub-hosted NOT RUN. Pełna chronologia docs/ODPOWIEDZI_CODEX.txt.


## 2026-11-03 21:01 Europe/Warsaw — finalna stabilizacja fix/slm2-minimum-phone

Naprawy A–E oraz administratorzy składów/migracja44 wykonane. PASS395Vitest/71policy/Linux35+107/SQL52/HTTP27/Cypress6/JVM1/native5, TS/lint/strictEdge/buildy i rzeczywisty emulator. Premium55 niezmieniony w tej stabilizacji. Backend43 zachowany; nowa fixture44/55441 działa, bez migracji istniejących baz i Cloud. Następnie: sprawdzenie refów merge33→RC i32→main, zwykłe merge tylko poPASS, APK z finalnego main. POCO/hosted/Cloud/Storage/FCM NOTRUN. Szczegóły docs/SLM_2_0_RC.md; chronologia docs/ODPOWIEDZI_CODEX.txt.

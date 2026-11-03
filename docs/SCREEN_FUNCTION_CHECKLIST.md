# Mapa ekranów i checklista funkcji SLM

Inwentaryzacja źródeł `main` **1b6ee83356d53b7b34193af88802067dc9b2fede**, pobranych z origin 03.11.2026.
Gałąź dokumentacji: `docs/screen-function-acceptance`. Wyłącznie analiza kodu;
nie uruchamiano aplikacji, backendu, testów funkcjonalnych lub deployu.
**33 konteksty ekranowe, 162 funkcje; 161 DO WERYFIKACJI, 1 BŁĄD.**

## Jak czytać zakres

„Ekran” oznacza osiągalny widok/panel/formularz zadania, nie osobny URL ani liczbę
komponentów React. Liczymy 27 kontekstów rzeczywistego LIVE/Premium oraz 5 ekranów
przygotowanego/symulowanego procesu kont i 1 panel demo. Tryby tworzenia/edycji i
panele szczegółów są oddzielnymi kontekstami odbioru, choć współdzielą komponenty.
Nie mnożymy ekranów przez Light/Dark lub role. Grupy zapisów/błędy są funkcjami,
nie nowymi trasami. Tabela startów poniżej zapobiega myleniu wariantów.

Status odbioru nie oznacza dostępności implementacji. **DO WERYFIKACJI** może dotyczyć
aktywnej funkcji albo przygotowanego UI bez integracji; wskazuje to kolumna wariantu.
Nie znaleziono wystarczająco precyzyjnego odbioru właściciela dla poszczególnych
funkcji obecnego SHA, więc nie przeniesiono dawnych PASS lub statusów RC do ZATWIERDZONE.
Zgłoszenie BUG-SKL-001 jest jedynym początkowym BŁĄD. Rejestr aktualnych statusów,
wyników i decyzji: [FUNCTION_ACCEPTANCE_LOG.md](FUNCTION_ACCEPTANCE_LOG.md).
Opisy technicznych integracji pozostają w [UI_INTEGRATION_MAP.md](UI_INTEGRATION_MAP.md),
a istniejące zadania w [TODO.md](TODO.md); nie kopiujemy ich historycznych raportów.

## Rzeczywiste wejścia i routing

| Wariant | Start i osiągalność | Dane / granice |
|---|---|---|
| **L — domyślny LIVE** | `app/src/main.tsx` → `App` → `/` przekierowuje `/home` → Home eksportuje Accounts; `screen` przełącza moduły, nie ma osobnych URL każdego formularza | SessionManager, accounts Edge, rzeczywiste grupy/mecze/finanse; dodatkowo powiadomienia, admin kont i legacy |
| **P — Premium** | entry `app/b1/main.tsx`, `app/android-stage3/main.tsx` i Premium-finance Vite → `B1App` → `PremiumWorld` → wspólny shell `demo/App` z liveEvents/groupsView/personalProfile | Rzeczywiste adaptery; nazwa katalogu demo nie oznacza, że cały shell jest fikcyjny. Dolne Mecze/Grupy/Profil i plus; stany lokalne/hash `#groups`/`#group/id`, nie publiczne REST-routes |
| **D — izolowane demo** | `app/demo/main.tsx` → `ui/Demo` → `AccountDemo`/`demo/App`; osobny `npm run build:demo` | RAM/fixtures, symulator kont, brak prawdziwego Auth/API/finansów; stan nie jest dowodem działania produkcji |

Capacitor wybiera webDir przez istniejące zmienne wariantu; identyfikator
`pl.psuda87.slm`. Nie przełączamy domyślnego buildu ani środowiska. API ma domyślny
endpoint Cloud w źródle; **nie uruchamiać runnerów bez sprawdzenia celu**, sekretów,
branch guardu i nowej izolowanej bazy. Nie użyto tego endpointu w inwentaryzacji.
Brak globalnej zakładki Zawodnicy/Składy. `ui/Players.tsx` i stan players w Accounts
nie dowodzą osiągalnego globalnego katalogu; aktualne menu go nie oferuje.

## Zależności backendowe

| Kod | Kontrakt i warunek odbioru |
|---|---|
| B01 | Istniejący SessionManager/tokenStore → accounts: login/refresh/status/password/identifiers; Supabase Auth i storage sesji, role globalne oddzielne od grupowych |
| B02 | profile/save_premium_profile/save_jersey_number/save_email_profile i profile_photo_get/upload/delete; profile_display_name, zgody grupowe, prywatny Storage; legacy identifiers do telefonu |
| B03 | groups_* → slm_groups_dispatch: grupy, członkostwa, requests, zgody, admin/sukcesja; aktualne członkostwo sprawdzane na serwerze |
| B04 | matches_* → slm_matches_dispatch + discovery42 + minimum43; status/własność/capacity/czas/roster/history/request_id, filtrowanie serwerowe |
| B05 | lineups_get/save → slm_lineups_dispatch, migracje41 i44; active member read, **tylko aktualny admin grupy write**, version/roster token/CAS/idempotencja |
| B06 | finance_groups/group_finance_*: ledger/dues/payments/surplus grupy, admin authority, brak zmiany FIFO/17:00/blokady dwóch kwalifikujących zaległości |
| B07 | notifications_* + slm_notifications_dispatch/push urządzenia/kolejka i push-worker/FCM; dostarczenie/scheduler wymagają konfiguracji, nie wystarcza istnienie plików |
| B08 | events_* / settlements_* i zachowane mapowanie legacy; nie migrować/nie przeliczać historii podczas odbioru UI |
| B09 | AccountUiPort i wspólny symulator/reducer; produkcyjny b1Port celowo odmawia signup/verification/recovery/first-profile. Funkcje pocztowe Edge istnieją za flagą, brak czynnego portu UI nie jest produkcyjnym procesem |

Kanoniczne źródła: app/supabase, **44** migracje w badanym main. RLS/ACL oraz kontrola
sesji/aktora w RPC są częścią każdego odbioru; ukrycie przycisku nie jest autoryzacją.
Publiczny mecz nie udostępnia prywatnych grup/profili/składów/finansów i nie tworzy
członkostwa. Wymagany rzeczywisty test odmowy, nie samo renderowanie UI.

## Indeks ekranów

| ID | Ekran / kontekst | Wariant | Funkcje |
|---|---|---|---|
| S01 | Logowanie | P/L | 4 |
| S02 | Sesja, bramka dostępu i nawigacja | P/L | 6 |
| S03 | Zmiana hasła | P/L | 4 |
| S04 | Lista meczów i wyszukiwanie publicznych | P/L | 8 |
| S05 | Nowy mecz i podgląd | P/L | 7 |
| S06 | Edycja meczu | P/L | 5 |
| S07 | Szczegóły meczu — Informacje | P/L | 5 |
| S08 | Uczestnicy, zapisy, goście i rezerwa | P/L | 8 |
| S09 | Składy i boisko | P | 11 |
| S10 | Rozliczenie konkretnego meczu | P/L | 7 |
| S11 | Moje rozliczenia grupowe | P/L | 6 |
| S12 | Moje grupy i zaproszenia | P/L | 5 |
| S13 | Znajdź grupę i prośba o dołączenie | P/L | 3 |
| S14 | Utwórz grupę | P/L | 3 |
| S15 | Szczegóły grupy i członkowie | P/L | 4 |
| S16 | Zaproś lub zaproponuj osobę | P/L | 4 |
| S17 | Panel administratora grupy i opuszczenie | P/L | 6 |
| S18 | Karta innego zawodnika | P | 4 |
| S19 | Mój profil Ultimate | P | 4 |
| S20 | Edycja własnej tożsamości i telefonu | P | 6 |
| S21 | Zdjęcie własnego profilu | P | 5 |
| S22 | Ustawienia wyglądu i konta | P/L | 4 |
| S23 | Centrum powiadomień i push | L | 8 |
| S24 | Administracja kontami legacy | L | 5 |
| S25 | Mecze historyczne legacy | L | 4 |
| S26 | Rozliczenia historyczne legacy | L | 4 |
| S27 | Profil w domyślnym LIVE | L | 4 |
| S28 | Rejestracja — ekran przygotowany | P/D, nieczynny port LIVE | 3 |
| S29 | Potwierdzenie e-mail/link — ekran przygotowany | D / nieaktywny prawdziwy proces | 3 |
| S30 | Zapomniałem hasła — ekran przygotowany | P/D, brak prawdziwego portu | 2 |
| S31 | Nowe hasło z linku — ekran przygotowany | D / nieaktywny reset LIVE | 2 |
| S32 | Pierwsze uzupełnienie profilu — symulator | D / nieaktywny onboarding LIVE | 3 |
| S33 | Narzędzia izolowanego demo | D | 5 |

## Checklista funkcji

Stabilne ID nie są renumerowane po zmianie kolejności. Nowa funkcja dostaje nowe ID;
wycofana zostawia ślad. Przy każdej funkcji obowiązują: właściwa sesja/rola/grupa,
brak duplikacji, loading/error/empty/retry tam, gdzie są dane, i brak regresji Premium.
Zestaw Txx oznacza **powiązany materiał do regresji**, nie zapewnienie, że zawiera już
automatyczny test każdego zdania. Ewentualną lukę pokrywa plan ręczny i dopiero
celowany test dodany w osobnym zadaniu. Nie uruchamiano tych zestawów tutaj.

### S01 — Logowanie

Wariant: **P/L**. Wejście: P: B1App bez sesji; L: /home → Accounts. Zależności: **B01**.

Źródła: [app/src/auth/B1App.tsx](../app/src/auth/B1App.tsx), [app/src/pages/Accounts.tsx](../app/src/pages/Accounts.tsx), [app/src/account-ui/Fields.tsx](../app/src/account-ui/Fields.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S01-F01 — Uwierzytelnienie | E-mail istniejącego konta lub identyfikator legacy otwiera to samo konto; błędne dane nie ujawniają istnienia konta. | T01 + odbiór ręczny | DO WERYFIKACJI |
| S01-F02 — Widoczność hasła | Pokaż/ukryj nie zmienia wartości i nie utrwala hasła. | T01 + odbiór ręczny | DO WERYFIKACJI |
| S01-F03 — Walidacja i pojedyncza wysyłka | Puste wymagane pola są wskazane; podczas żądania nie powstaje drugie logowanie. | T01 + odbiór ręczny | DO WERYFIKACJI |
| S01-F04 — Błąd i ponowienie | Błąd danych/sieci daje czytelny komunikat bez wejścia do chronionych ekranów. | T01 + odbiór ręczny | DO WERYFIKACJI |

### S02 — Sesja, bramka dostępu i nawigacja

Wariant: **P/L**. Wejście: Start, powrót z tła, wygaśnięcie, wylogowanie. Zależności: **B01**.

Źródła: [app/src/auth/sessionManager.ts](../app/src/auth/sessionManager.ts), [app/src/auth/B1App.tsx](../app/src/auth/B1App.tsx), [app/src/auth/useB1Lifecycle.ts](../app/src/auth/useB1Lifecycle.ts), [app/src/native/frozenDemoAndroid.ts](../app/src/native/frozenDemoAndroid.ts), [app/src/ui/BottomNav.tsx](../app/src/ui/BottomNav.tsx), [app/src/demo/DemoBottomNav.tsx](../app/src/demo/DemoBottomNav.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S02-F01 — Odtworzenie sesji | Chronione dane pozostają ukryte do potwierdzenia sesji przez serwer. | T02 + odbiór ręczny | DO WERYFIKACJI |
| S02-F02 — Offline i uszkodzony magazyn | Brak potwierdzenia/odczytu tokenu pokazuje stan błędu i retry, nie stare prywatne dane. | T02 + odbiór ręczny | DO WERYFIKACJI |
| S02-F03 — Powrót z tła | Ponowna weryfikacja zachowuje dozwolony ekran/szkic, lecz odrzuca odebrane uprawnienia i stare odpowiedzi. | T02 + odbiór ręczny | DO WERYFIKACJI |
| S02-F04 — Wylogowanie | Czyści tokeny i widoki prywatne; powrót nie pokazuje poprzedniego konta. | T02 + odbiór ręczny | DO WERYFIKACJI |
| S02-F05 — Zmiana konta | Grupy, mecze, profil, zdjęcia i szkice poprzedniej osoby nie przechodzą do nowej sesji. | T02 + odbiór ręczny | DO WERYFIKACJI |
| S02-F06 — Nawigacja i telefon | Mecze/Grupy/Profil i systemowy Wstecz wracają do właściwego kontekstu; plus tylko gdy dostępne tworzenie. Safe area/IME nie zasłaniają akcji. | T02 + odbiór ręczny | DO WERYFIKACJI |

### S03 — Zmiana hasła

Wariant: **P/L**. Wejście: Hasło tymczasowe lub Profil → Konto. Zależności: **B01**.

Źródła: [app/src/account-ui/AccountScreens.tsx](../app/src/account-ui/AccountScreens.tsx), [app/src/auth/b1Port.ts](../app/src/auth/b1Port.ts), [app/src/pages/Accounts.tsx](../app/src/pages/Accounts.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S03-F01 — Wymuszona zmiana | Konto z hasłem tymczasowym nie korzysta z pozostałych modułów przed skuteczną zmianą. | T01 + odbiór ręczny | DO WERYFIKACJI |
| S03-F02 — Zmiana własnego hasła | Obecne hasło i zgodne nowe hasła są sprawdzane; minimum i limit bajtów zgodne z Auth. | T01 + odbiór ręczny | DO WERYFIKACJI |
| S03-F03 — Rotacja sesji | Po potwierdzonej operacji nowa sesja działa, stare tokeny tracą dostęp zgodnie z istniejącym kontraktem. | T01 + odbiór ręczny | DO WERYFIKACJI |
| S03-F04 — Anulowanie/błąd | Nieudana próba nie daje komunikatu sukcesu; wartości haseł są czyszczone, a busy blokuje duplikaty. | T01 + odbiór ręczny | DO WERYFIKACJI |

### S04 — Lista meczów i wyszukiwanie publicznych

Wariant: **P/L**. Wejście: Dolna nawigacja Mecze; P: PremiumEvents. Zależności: **B04**.

Źródła: [app/src/events/PremiumEvents.tsx](../app/src/events/PremiumEvents.tsx), [app/src/events/usePremiumEvents.ts](../app/src/events/usePremiumEvents.ts), [app/src/live/Matches.tsx](../app/src/live/Matches.tsx).

LIVE ma własny renderer i starszy zestaw filtrów; nie zakładamy obecności pola discovery Premium w /home. Offset nie jest snapshotem przy zmianach zbioru.

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S04-F01 — Domyślny feed | Własne grupy i dozwolone publiczne przyszłe mecze; brak prywatnych wydarzeń obcych grup, także w API. | T03 + odbiór ręczny | DO WERYFIKACJI |
| S04-F02 — Zakresy discovery | P: Wszystkie/Moje grupy/Publiczne oraz konkretna grupa i własny udział wywołują odpowiedni scope serwera. | T03 + odbiór ręczny | DO WERYFIKACJI |
| S04-F03 — Wyszukiwanie | P: tylko Publiczne, po nazwie meczu/grupy; debounce, literalne znaki i limit100 bez wyszukiwania w prywatnych wynikach. | T03 + odbiór ręczny | DO WERYFIKACJI |
| S04-F04 — Nadchodzące/Moje/Historia | Prawidłowy okres/udział i zachowana dozwolona historia po odejściu; zmiana filtra zeruje stronę. | T03 + odbiór ręczny | DO WERYFIKACJI |
| S04-F05 — Paginacja | Serwer filtruje przed limitem100, next_offset/has_more sterują stronami; stare odpowiedzi nie zastępują nowego query. | T03 + odbiór ręczny | DO WERYFIKACJI |
| S04-F06 — Karta meczu | Termin/grupa/miejsce/liczniki/status pochodzą z właściwego DTO; rezerwa nie zajmuje miejsc, kłódka wewnątrz karty. | T03 + odbiór ręczny | DO WERYFIKACJI |
| S04-F07 — Otwarcie meczu | Cały dozwolony kafelek jest klikalny klawiaturą i dotykiem, bez dodatkowego przycisku Szczegóły. | T03 + odbiór ręczny | DO WERYFIKACJI |
| S04-F08 — Odświeżenie/pusty/błąd | Loading, brak wyników, retry i brak grup są czytelne; po błędzie nie pojawiają się fikcyjne mecze. | T03 + odbiór ręczny | DO WERYFIKACJI |

### S05 — Nowy mecz i podgląd

Wariant: **P/L**. Wejście: P: centralny plus; L: Utwórz mecz. Zależności: **B03+B04**.

Źródła: [app/src/demo/EventForm.tsx](../app/src/demo/EventForm.tsx), [app/src/events/premiumForm.ts](../app/src/events/premiumForm.ts), [app/src/events/usePremiumEvents.ts](../app/src/events/usePremiumEvents.ts), [app/src/live/Matches.tsx](../app/src/live/Matches.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S05-F01 — Dostęp i wybór grupy | Tworzyć może aktywny członek właściwej grupy; wyświetlane grupy i serwer potwierdzają członkostwo, bez globalnego nadania finansów. | T04 + odbiór ręczny | DO WERYFIKACJI |
| S05-F02 — Termin i dane boiska | Nazwa, dzień, godzina, czas trwania, miejsce i adres są edytowalne; P pokazuje DD.MM.RRRR/HH:mm i Europe/Warsaw. | T04 + odbiór ręczny | DO WERYFIKACJI |
| S05-F03 — Minimum i limit | P: minimum i maksymalna liczba graczy są spójne; minimum1..capacity, bez wpisywania stałego10 w odczycie nowego kontraktu43. | T04 + odbiór ręczny | DO WERYFIKACJI |
| S05-F04 — Widoczność | Publiczny/prywatny jest jawnym wyborem, bez automatycznego członkostwa uczestnika w grupie. | T04 + odbiór ręczny | DO WERYFIKACJI |
| S05-F05 — Koszt | Kwota PLN jest prawidłowo przeliczona do groszy, zero dozwolone; ceny domyślne nie zastępują danych wydarzenia. | T04 + odbiór ręczny | DO WERYFIKACJI |
| S05-F06 — Podgląd/anulowanie | P: Podgląd pokazuje draft i jeszcze nie tworzy rekordu; powrót zachowuje formularz, anulowanie nie zapisuje. | T04 + odbiór ręczny | DO WERYFIKACJI |
| S05-F07 — Utworzenie i readback | Jedno zatwierdzenie tworzy jeden mecz z0 uczestników; ponowienie ma request_id, a lista i szczegóły odczytują wynik serwera. | T04 + odbiór ręczny | DO WERYFIKACJI |

### S06 — Edycja meczu

Wariant: **P/L**. Wejście: Szczegóły → Edytuj mecz. Zależności: **B04**.

Źródła: [app/src/events/PremiumEvents.tsx](../app/src/events/PremiumEvents.tsx), [app/src/events/usePremiumEvents.ts](../app/src/events/usePremiumEvents.ts), [app/src/demo/EventForm.tsx](../app/src/demo/EventForm.tsx), [app/src/live/Matches.tsx](../app/src/live/Matches.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S06-F01 — Własność i uprawnienie | Edytuje twórca będący uprawnionym członkiem; rola administratora grupy nie daje automatycznie edycji cudzego meczu. | T04 + odbiór ręczny | DO WERYFIKACJI |
| S06-F02 — Zmiana danych | Termin/czas/miejsce/adres/nazwa/minimum/limit/koszt zapisują się wyłącznie w zakresie pól udostępnionych przez dany renderer i kontrakt. | T04 + odbiór ręczny | DO WERYFIKACJI |
| S06-F03 — Limit i stan meczu | Brak limitu poniżej zajętych miejsc lub minimum; zakończone/anulowane wydarzenie nie daje pozornego zapisu. | T04 + odbiór ręczny | DO WERYFIKACJI |
| S06-F04 — Zmiana widoczności | Nie usuwa istniejących outsiderów/gości/finansów ani nie dodaje do grupy; outsider bez udziału traci prywatne szczegóły. | T04 + odbiór ręczny | DO WERYFIKACJI |
| S06-F05 — Konflikt i anulowanie | expected_version odrzuca nieaktualny zapis, draft zachowany do decyzji; anulowanie i powrót z tła nie zapisują nieświadomie. | T04 + odbiór ręczny | DO WERYFIKACJI |

### S07 — Szczegóły meczu — Informacje

Wariant: **P/L**. Wejście: Karta → szczegóły; panel Informacje. Zależności: **B04**.

Źródła: [app/src/events/PremiumEvents.tsx](../app/src/events/PremiumEvents.tsx), [app/src/ui/MatchTabs.tsx](../app/src/ui/MatchTabs.tsx), [app/src/live/Matches.tsx](../app/src/live/Matches.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S07-F01 — Informacje organizacyjne | Czytelna data/godzina/miejsce/adres/czas/koszt i rzeczywiste minimum z serwera, bez duplikowania paneli. | T05 + odbiór ręczny | DO WERYFIKACJI |
| S07-F02 — Pasek pojemności | Zapisani plus goście, limit i znacznik minimum; pusta lista, osiągnięte minimum i komplet liczone prawidłowo. | T05 + odbiór ręczny | DO WERYFIKACJI |
| S07-F03 — Zakładki i powrót | P: domyślnie Uczestnicy, jeden widoczny panel Informacje/Uczestnicy/Składy/Rozliczenie; powrót do właściwej listy. | T05 + odbiór ręczny | DO WERYFIKACJI |
| S07-F04 — Anulowanie meczu | Aktualny administrator grupy potwierdza odwołanie i wymagany powód; historia/zobowiązania pozostają zgodne z backendem. | T05 + odbiór ręczny | DO WERYFIKACJI |
| S07-F05 — Utrata dostępu | Recheck/błąd/odebranie członkostwa nie ujawnia zachowanego rosteru; publiczność nie nadaje finansów ani profili grupy. | T05 + odbiór ręczny | DO WERYFIKACJI |

### S08 — Uczestnicy, zapisy, goście i rezerwa

Wariant: **P/L**. Wejście: Szczegóły → Uczestnicy. Zależności: **B04+B06**.

Źródła: [app/src/events/PremiumEvents.tsx](../app/src/events/PremiumEvents.tsx), [app/src/events/GuestForm.tsx](../app/src/events/GuestForm.tsx), [app/src/live/Matches.tsx](../app/src/live/Matches.tsx).

P ma dodawanie i wycofanie gościa oraz potwierdzenie miejsca; pełna edycja gościa/obecności ma szerszą ekspozycję LIVE. Nie uznawać istniejącego endpointu za istniejący przycisk Premium.

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S08-F01 — Grupy i liczniki | Zapisani/goście/rezerwa/wycofani odzwierciedlają stable entry id oraz uprawnienia; gość bez konta nie staje się zawodnikiem z profilem. | T05 + odbiór ręczny | DO WERYFIKACJI |
| S08-F02 — Własny zapis | Zapis tylko przy dostępie, miejscach i braku blokady; równoczesne żądania nie przekraczają limitu i nie duplikują wpisu. | T05 + odbiór ręczny | DO WERYFIKACJI |
| S08-F03 — Wycofanie | Usuwa udział zgodnie z istniejącą granicą17:00 i odpowiedzialnością za późną rezygnację/zastępstwo; UI nie gwarantuje umorzenia długu. | T05 + odbiór ręczny | DO WERYFIKACJI |
| S08-F04 — Rezerwa i wolne miejsce | Dołączenie/opuszczenie oraz jawne potwierdzenie miejsca; bez automatycznej promocji, backend rozstrzyga wyścig. | T05 + odbiór ręczny | DO WERYFIKACJI |
| S08-F05 — Dodanie gościa | Nazwa i opcjonalny telefon, właściwa lista registered/reserve, odpowiedzialność finansowa zapraszającego, walidacja i brak podwójnej wysyłki. | T05 + odbiór ręczny | DO WERYFIKACJI |
| S08-F06 — Wycofanie/zarządzanie gościem | Własny gość lub dozwolona akcja administratora; licznik i roster/skład finansowy odczytane ponownie. Edycja/move tylko tam, gdzie UI/API je udostępnia. | T05 + odbiór ręczny | DO WERYFIKACJI |
| S08-F07 — Obecność | Odróżnia zapis od potwierdzonej obecności; administrator używa udostępnionej operacji attendance z wymaganym powodem, bez naliczania fikcyjnych statystyk. | T05 + odbiór ręczny | DO WERYFIKACJI |
| S08-F08 — Kontakt i prywatność | Telefon tylko gdy DTO na to pozwala; tel: nie rozszerza dostępu do konta. Imię w obecnym wierszu P nie jest globalnym przyciskiem profilu. | T05 + odbiór ręczny | DO WERYFIKACJI |

### S09 — Składy i boisko

Wariant: **P**. Wejście: Szczegóły → Składy. Zależności: **B05**.

Źródła: [app/src/events/PremiumTeams.tsx](../app/src/events/PremiumTeams.tsx), [app/src/events/usePremiumLineup.ts](../app/src/events/usePremiumLineup.ts), [app/src/events/lineupEditor.ts](../app/src/events/lineupEditor.ts), [app/src/ui/PremiumPitch.tsx](../app/src/ui/PremiumPitch.tsx).

ZGŁOSZONY BŁĄD BUG-SKL-001 dotyczy S09-F01. Kod zawiera preview naprzemienne przy version=0 i can_write oraz ręczne przypisanie unassigned. Zgłoszenie właściciela wymaga odtworzenia w działającej aplikacji; nie twierdzimy, że w źródłach nie istnieje żaden algorytm.

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S09-F01 — Automatyczny początkowy podział | Zapisani zawodnicy i zapisani goście trafiają do podglądu A/B bez ręcznego przypisywania każdej osoby;11→6:5, brak rezerwy, bez samoistnego trwałego zapisu. | T06 + odbiór ręczny | **BŁĄD — BUG-SKL-001** |
| S09-F02 — Odczyt wspólnego składu | Pobiera aktualne drużyny/roster/version/last_change; brak zapisu i pusta obsada dają prawdziwy stan pusty, nie fikcyjnego autora. | T06 + odbiór ręczny | DO WERYFIKACJI |
| S09-F03 — Zamiana dwóch osób | Osobny tryb i dwa kolejne kliknięcia z przeciwnych drużyn zmieniają tylko draft; ponowne kliknięcie odznacza. | T06 + odbiór ręczny | DO WERYFIKACJI |
| S09-F04 — Transfer A/B | Jednego gracza można przenieść bez zamiany, także przy układzie6:5; stable participation id obejmują gościa. | T06 + odbiór ręczny | DO WERYFIKACJI |
| S09-F05 — Nowi/nieprzypisani | Stan Poza podziałem nie gubi osoby; ręczne A/B jest świadomym fallbackiem, nie rozwiązaniem błędu automatycznego startu. | T06 + odbiór ręczny | DO WERYFIKACJI |
| S09-F06 — Przywróć skład | Przywraca punkt początku edycji, nie losuje na nowo; cofnięta zamiana nie pozostawia dirty. | T06 + odbiór ręczny | DO WERYFIKACJI |
| S09-F07 — Jawny zapis | Wyłącznie administrator bieżącej grupy wg can_write i migracji44; serwer waliduje roster/CAS, nie przyznaje tego prawa zwykłemu organizatorowi. | T06 + odbiór ręczny | DO WERYFIKACJI |
| S09-F08 — Konflikt/retry | 409 wersji/rosteru, odświeżenie po potwierdzeniu utraty draftu; ponowienie niepewnego zapisu zachowuje request_id i czyta wynik. | T06 + odbiór ręczny | DO WERYFIKACJI |
| S09-F09 — Autor i no-op | Ostatnia zmiana pochodzi z serwera; identyczny stan nie zmienia autora, czasu lub wersji. | T06 + odbiór ręczny | DO WERYFIKACJI |
| S09-F10 — Karta z boiska | Osoba z kontem prowadzi do dozwolonej karty i wraca do tego meczu/panelu; gość bez konta nie ma fikcyjnej karty. | T06 + odbiór ręczny | DO WERYFIKACJI |
| S09-F11 — Sesja i prywatność | Członek grupy odczytuje, admin zapisuje; outsider publicznego meczu nie dostaje składów grupy, logout/utrata dostępu ukrywają draft. | T06 + odbiór ręczny | DO WERYFIKACJI |

### S10 — Rozliczenie konkretnego meczu

Wariant: **P/L**. Wejście: Szczegóły → Rozliczenie / LIVE Finance(eventId). Zależności: **B06**.

Źródła: [app/src/finance/PremiumFinance.tsx](../app/src/finance/PremiumFinance.tsx), [app/src/finance/usePremiumFinance.ts](../app/src/finance/usePremiumFinance.ts), [app/src/live/Finance.tsx](../app/src/live/Finance.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S10-F01 — Własne kwoty | Saldo, należność, pokrycie i pozostało wyłącznie z konta właściwej grupy/meczu; bez demo fallback. | T07 + odbiór ręczny | DO WERYFIKACJI |
| S10-F02 — Goście i blokada | Goście obciążają zapraszającego; udział+goście to jeden mecz dla kwalifikacji blokady dwóch zaległości. | T07 + odbiór ręczny | DO WERYFIKACJI |
| S10-F03 — Zgłoszenie wpłaty | Kwota/powód i identyfikator żądania; zgłoszenie pending nie zmienia salda przed akceptacją. | T07 + odbiór ręczny | DO WERYFIKACJI |
| S10-F04 — Zatwierdzenie zakończonego meczu | Tylko aktualny admin grupy; wstępne i zatwierdzone należności są odróżnione, wymagane reason/version. | T07 + odbiór ręczny | DO WERYFIKACJI |
| S10-F05 — Korekty administracyjne | W LIVE: korekta kosztu/obciążenia i powodu wg istniejącego API. Nie zakładać obecności tych formularzy w PremiumFinance. | T07 + odbiór ręczny | DO WERYFIKACJI |
| S10-F06 — Potwierdzenie/odrzucenie wpłaty | Admin wybiera właściwego płatnika, akceptuje/odrzuca lub rejestruje otrzymaną kwotę; retry/race nie księgują podwójnie. | T07 + odbiór ręczny | DO WERYFIKACJI |
| S10-F07 — Odmowa i readback | Inna grupa/twórca bez roli finansowej nie zarządza wpłatą; po sukcesie odświeżają się kwoty i uprawnienia do zapisu. | T07 + odbiór ręczny | DO WERYFIKACJI |

### S11 — Moje rozliczenia grupowe

Wariant: **P/L**. Wejście: P: Mecze → Moje rozliczenia grupowe; L: Rozliczenia. Zależności: **B06**.

Źródła: [app/src/finance/PremiumGroupFinance.tsx](../app/src/finance/PremiumGroupFinance.tsx), [app/src/finance/PremiumFinance.tsx](../app/src/finance/PremiumFinance.tsx), [app/src/live/Finance.tsx](../app/src/live/Finance.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S11-F01 — Lista grup finansowych | Lista z finance_groups obejmuje uprawniony zakres, także dozwoloną własną historię po odejściu; brak pustego fikcyjnego salda. | T07 + odbiór ręczny | DO WERYFIKACJI |
| S11-F02 — Saldo i należności | Zmiana grupy odświeża kwoty i statusy tej grupy, nie miesza grup i kont. | T07 + odbiór ręczny | DO WERYFIKACJI |
| S11-F03 — Wpłata ogólna FIFO | Rozlicza najstarsze należności tylko w wybranej grupie, legacy zgodnie ze starymi kwotami. | T07 + odbiór ręczny | DO WERYFIKACJI |
| S11-F04 — Historia i status wpłat | Serwerowa historia ograniczona/paginowana zgodnie z kontraktem; pending/accepted/rejected i kwoty spójne. | T07 + odbiór ręczny | DO WERYFIKACJI |
| S11-F05 — Nadwyżki/administracja | Zwykły członek nie widzi cudzych sald lub admin-only surplus; uprawniony admin widzi rozróżnienie kwot naliczonych i otrzymanych. | T07 + odbiór ręczny | DO WERYFIKACJI |
| S11-F06 — Błędy i sesja | Loading/pusto/retry oraz zmiana konta nie pozostawiają danych poprzedniej grupy, błędna odpowiedź nie jest sukcesem. | T07 + odbiór ręczny | DO WERYFIKACJI |

### S12 — Moje grupy i zaproszenia

Wariant: **P/L**. Wejście: Dolna nawigacja Grupy → mine. Zależności: **B03**.

Źródła: [app/src/groups/PremiumGroups.tsx](../app/src/groups/PremiumGroups.tsx), [app/src/groups/useGroups.ts](../app/src/groups/useGroups.ts), [app/src/demo/GroupScreens.tsx](../app/src/demo/GroupScreens.tsx), [app/src/live/Groups.tsx](../app/src/live/Groups.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S12-F01 — Moje członkostwa | Rzeczywiste grupy, liczby osób i rola; wiele grup nie łączy uprawnień. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S12-F02 — Otrzymane zaproszenia | Odbiorca widzi wyłącznie własne oczekujące zaproszenia i właściwą grupę. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S12-F03 — Akceptacja/odrzucenie | Akceptacja dodaje członka raz, odrzucenie nie dodaje; nie można wymusić członkostwa. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S12-F04 — Brak grup | Czytelne wejście do tworzenia/wyszukiwania; nie powstaje grupa automatycznie. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S12-F05 — Odświeżenie i powrót | Właściwy widok po szczegółach/profilu oraz recheck po wznowieniu, bez starych list członków. | T08 + odbiór ręczny | DO WERYFIKACJI |

### S13 — Znajdź grupę i prośba o dołączenie

Wariant: **P/L**. Wejście: Grupy → Znajdź grupę. Zależności: **B03**.

Źródła: [app/src/demo/GroupScreens.tsx](../app/src/demo/GroupScreens.tsx), [app/src/groups/useGroups.ts](../app/src/groups/useGroups.ts), [app/src/live/Groups.tsx](../app/src/live/Groups.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S13-F01 — Wyszukiwanie grup | Minimum2 znaki, ograniczone wyniki; outsider widzi nazwę/opis/liczbę członków, nie katalog osób. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S13-F02 — Wniosek do administratora | Jedna aktywna prośba; UI ujawnia przewidziany zakres danych kontaktowych administratorowi, bez automatycznego wejścia do grupy. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S13-F03 — Anulowanie własnej prośby | Usuwa pending; nie można anulować cudzej ani zduplikować aktywnej prośby. | T08 + odbiór ręczny | DO WERYFIKACJI |

### S14 — Utwórz grupę

Wariant: **P/L**. Wejście: Grupy → Utwórz grupę. Zależności: **B03**.

Źródła: [app/src/demo/GroupScreens.tsx](../app/src/demo/GroupScreens.tsx), [app/src/groups/useGroups.ts](../app/src/groups/useGroups.ts), [app/src/live/Groups.tsx](../app/src/live/Groups.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S14-F01 — Formularz grupy | Nazwa1–64, opis do180, zakaz niewłaściwych znaków; nazwa nie musi być globalnie unikalna. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S14-F02 — Twórca i członkostwo | Twórca zostaje członkiem i administratorem tylko nowej grupy; lista pokazuje serwerowy wynik. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S14-F03 — Idempotencja/anulowanie | Podwójna wysyłka nie tworzy dwóch grup; anulowanie bez mutacji i błąd bez fałszywego sukcesu. | T08 + odbiór ręczny | DO WERYFIKACJI |

### S15 — Szczegóły grupy i członkowie

Wariant: **P/L**. Wejście: Moje grupy → #group/<id> w shellu P. Zależności: **B03+B02**.

Źródła: [app/src/demo/GroupScreens.tsx](../app/src/demo/GroupScreens.tsx), [app/src/groups/PremiumGroups.tsx](../app/src/groups/PremiumGroups.tsx), [app/src/groups/GroupControls.tsx](../app/src/groups/GroupControls.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S15-F01 — Informacje i lista | Nazwa/opis/członkowie/liczniki/role z serwera, tylko w dozwolonym członkostwie. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S15-F02 — Karta członka | Otwiera właściwą kartę z API grupy; powrót odtwarza kontekst i nie ujawnia prywatnych danych outsiderowi. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S15-F03 — Zgody grupowe | Udostępnienie danych samo nie zmienia trybu nazwy; ukrycie imienia/nazwiska wymaga potwierdzonego przejścia na pseudonim, admin zachowuje granice B3. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S15-F04 — Odebrany dostęp | Usunięcie/opuszczenie grupy i wznowienie natychmiast ukrywają dane zgodnie z sesją, bez fallbacku z demo. | T08 + odbiór ręczny | DO WERYFIKACJI |

### S16 — Zaproś lub zaproponuj osobę

Wariant: **P/L**. Wejście: Szczegóły grupy → Zaproś/Zaproponuj. Zależności: **B03**.

Źródła: [app/src/demo/GroupScreens.tsx](../app/src/demo/GroupScreens.tsx), [app/src/groups/useGroups.ts](../app/src/groups/useGroups.ts), [app/src/live/Groups.tsx](../app/src/live/Groups.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S16-F01 — Wyszukanie osoby | Dozwolony nick/telefon według kontraktu; numer normalizowany, bez publicznego ujawniania katalogu numerów. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S16-F02 — Zaproszenie administratora | Powstaje zaproszenie do akceptacji odbiorcy, nie natychmiastowe członkostwo. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S16-F03 — Propozycja członka | Najpierw decyzja admina, następnie zgoda odbiorcy; zgłoszenie nie nadaje uprawnień. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S16-F04 — Ochrona duplikatów | Aktualny członek i już oczekujące zgłoszenie nie generują kolejnych aktywnych zaproszeń. | T08 + odbiór ręczny | DO WERYFIKACJI |

### S17 — Panel administratora grupy i opuszczenie

Wariant: **P/L**. Wejście: Szczegóły grupy → zarządzanie. Zależności: **B03**.

Źródła: [app/src/demo/GroupScreens.tsx](../app/src/demo/GroupScreens.tsx), [app/src/groups/useGroups.ts](../app/src/groups/useGroups.ts), [app/src/live/Groups.tsx](../app/src/live/Groups.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S17-F01 — Wnioski o dołączenie | Admin właściwej grupy przyjmuje/odrzuca; zaakceptowany wnioskodawca pojawia się raz. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S17-F02 — Propozycje zaproszeń | Decyzja admina tworzy zaproszenie odbiorcy, nie omija jego zgody. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S17-F03 — Flaga organizatora | Nadaje/odbiera istniejącą flagę w tej grupie; nie daje finansów ani edycji cudzych meczów. Main pozwala tworzyć mecze każdemu aktywnemu członkowi, nie tylko tej fladze. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S17-F04 — Usunięcie członka | Potwierdzenie, utrata dostępu i roli w jednej grupie, bez kasowania historii finansów/meczów. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S17-F05 — Przekazanie administracji | Potwierdzenie zmienia jednego administratora i uprawnienia do finansów/składów; stara rola nie daje dalszego zapisu. | T08 + odbiór ręczny | DO WERYFIKACJI |
| S17-F06 — Odejście i sukcesja | Członek może odejść; admin przekazuje rolę wg stabilnej kolejności organizator/staż, ostatnia osoba archiwizuje grupę, nie usuwa historii. | T08 + odbiór ręczny | DO WERYFIKACJI |

### S18 — Karta innego zawodnika

Wariant: **P**. Wejście: Członek grupy lub znacznik na boisku. Zależności: **B02+B03**.

Źródła: [app/src/groups/PremiumGroups.tsx](../app/src/groups/PremiumGroups.tsx), [app/src/events/LineupPlayerProfile.tsx](../app/src/events/LineupPlayerProfile.tsx), [app/src/ui/UltimatePlayerCard.tsx](../app/src/ui/UltimatePlayerCard.tsx).

Brak globalnej zakładki Zawodnicy. Wiersze Uczestników w aktualnym Premium nie mają niezależnego globalnego odnośnika do profilu; goście bez konta nie mają karty.

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S18-F01 — Uprawniona nazwa | Nickname/imię/full_name zgodnie z globalnym trybem i zgodą w danej grupie; fallback bez wycieku nazwiska. | T09 + odbiór ręczny | DO WERYFIKACJI |
| S18-F02 — Karta i numer | Oficjalny herb, proporcje Ultimate i rzeczywisty numer; brak edycji cudzej osoby i technicznych identyfikatorów na karcie. | T09 + odbiór ręczny | DO WERYFIKACJI |
| S18-F03 — Kontakt i brakujące dane | Tylko DTO danego widoku; brak zdjęcia/statystyk innych osób jest uczciwie oznaczony, nie zastąpiony demo. | T09 + odbiór ręczny | DO WERYFIKACJI |
| S18-F04 — Powrót i zmiana sesji | Wraca do grupy/tego meczu i Składów; recheck i odmowa nie pozostawiają karty w RAM/na ekranie. | T09 + odbiór ręczny | DO WERYFIKACJI |

### S19 — Mój profil Ultimate

Wariant: **P**. Wejście: Dolna nawigacja Profil. Zależności: **B02**.

Źródła: [app/src/demo/Profile.tsx](../app/src/demo/Profile.tsx), [app/src/auth/useOwnProfile.ts](../app/src/auth/useOwnProfile.ts), [app/src/demo/UltimatePlayerCard.tsx](../app/src/demo/UltimatePlayerCard.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S19-F01 — Własna tożsamość | Karta pokazuje potwierdzoną nazwę/numer/zdjęcie własnego konta, bez mieszania danych fixture demo. | T09 + odbiór ręczny | DO WERYFIKACJI |
| S19-F02 — Statystyki niedostępne | Mecze/Bramki/Asysty/MVP w LIVE pokazują brak danych, nie fikcyjne liczby; gwiazdki są dekoracją, nie oceną. | T09 + odbiór ręczny | DO WERYFIKACJI |
| S19-F03 — Edycja i ustawienia | Przyciski prowadzą do wspólnych edytorów/zdjęcia/ustawień, bez duplikowania implementacji i nazwiska. | T09 + odbiór ręczny | DO WERYFIKACJI |
| S19-F04 — Loading i błąd profilu | Retry, brak starego zdjęcia po zmianie konta i brak pozornego zapisu niepotwierdzonych danych. | T09 + odbiór ręczny | DO WERYFIKACJI |

### S20 — Edycja własnej tożsamości i telefonu

Wariant: **P**. Wejście: Profil → Edytuj profil / numer. Zależności: **B02**.

Źródła: [app/src/profile/PremiumIdentityEditor.tsx](../app/src/profile/PremiumIdentityEditor.tsx), [app/src/profile/PhoneEditor.tsx](../app/src/profile/PhoneEditor.tsx), [app/src/auth/profileAdapter.ts](../app/src/auth/profileAdapter.ts), [app/src/auth/useOwnProfile.ts](../app/src/auth/useOwnProfile.ts).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S20-F01 — Pseudonim | Zapis publicznej nazwy nie zmienia technicznego loginu/hasła ani UUID; brak wymogu globalnej unikalności pseudonimu. | T10 + odbiór ręczny | DO WERYFIKACJI |
| S20-F02 — Trzy warianty nazwy | nickname/first_name/full_name z jawnym imieniem; wymagane potwierdzenie udostępnienia w obecnych grupach, bez zgody w obcych grupach. | T10 + odbiór ręczny | DO WERYFIKACJI |
| S20-F03 — Anulowanie i zakres zgód | Anuluj nie mutuje; powrót do pseudonimu sam nie cofa zgód; server scope/CAS zapobiega nieświadomemu ujawnieniu. | T10 + odbiór ręczny | DO WERYFIKACJI |
| S20-F04 — Numer koszulki | Puste lub integer0–99, duplikaty dozwolone; odczyt po zapisie potwierdza zmianę we własnej karcie. | T10 + odbiór ręczny | DO WERYFIKACJI |
| S20-F05 — Telefon legacy/e-mail | Polski format/unikalność i obecne hasło. Legacy rotuje sesję z zachowaniem loginu; e-mail zachowuje logowanie i opcjonalny kontakt. | T10 + odbiór ręczny | DO WERYFIKACJI |
| S20-F06 — Walidacja i trwałość | Powtórne wysłanie zablokowane, błędy czytelne, dane po readback/relogowaniu zgodne; telefon nie trafia do publicznej nazwy. | T10 + odbiór ręczny | DO WERYFIKACJI |

### S21 — Zdjęcie własnego profilu

Wariant: **P**. Wejście: Profil → Zmień zdjęcie. Zależności: **B02**.

Źródła: [app/src/demo/Identity.tsx](../app/src/demo/Identity.tsx), [app/src/auth/useOwnPhoto.ts](../app/src/auth/useOwnPhoto.ts), [app/src/profile/preparePhoto.ts](../app/src/profile/preparePhoto.ts), [app/supabase/functions/accounts/profilePhotos.ts](../app/supabase/functions/accounts/profilePhotos.ts).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S21-F01 — Wybór i podgląd | Lokalny JPEG/PNG/WebP jest przygotowany przed wysyłką; brak losowego portretu z internetu. | T11 + odbiór ręczny | DO WERYFIKACJI |
| S21-F02 — Kompresja i walidacja | Limity wejścia20MB/8192px/32MP, wynik WebP max150KB i do800px; błędny plik nie przechodzi jako zdjęcie. | T11 + odbiór ręczny | DO WERYFIKACJI |
| S21-F03 — Zapis prywatny | Własny profil/Storage, expected_revision, readback; oryginał i plik użytkownika nie trafiają do Git ani localStorage. | T11 + odbiór ręczny | DO WERYFIKACJI |
| S21-F04 — Usunięcie/konflikt | Jawna operacja usuwa zdjęcie według rewizji; konflikt lub cleanup_pending nie udaje zakończonego usunięcia. | T11 + odbiór ręczny | DO WERYFIKACJI |
| S21-F05 — Anulowanie galerii i sesja | Anulowanie nie zapisuje i wraca na ten sam ekran; ponowna autoryzacja nie gubi szkicu, zmiana konta czyści stare zdjęcie. | T11 + odbiór ręczny | DO WERYFIKACJI |

### S22 — Ustawienia wyglądu i konta

Wariant: **P/L**. Wejście: P: Profil → Ustawienia; L: Profil → Wygląd. Zależności: **B01**.

Źródła: [app/src/demo/Profile.tsx](../app/src/demo/Profile.tsx), [app/src/ui/AppearanceSettings.tsx](../app/src/ui/AppearanceSettings.tsx), [app/src/ui/theme.ts](../app/src/ui/theme.ts).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S22-F01 — Paleta | P/D: España domyślna, FCB/Lime/Deimos opcjonalne; zmieniają semantyczne tokeny bez modyfikacji danych. L udostępnia España i tryb jasności. | T12 + odbiór ręczny | DO WERYFIKACJI |
| S22-F02 — Jasny/Ciemny/Auto | Tryb niezależny od palety, Auto reaguje bez restartu; preferencje lokalne przetrwają logout, niedostępna pamięć nie blokuje aplikacji. | T12 + odbiór ręczny | DO WERYFIKACJI |
| S22-F03 — Pozycje konta | Zmiana hasła i logout są rzeczywiste tylko przez Auth; Powiadomienia w profilu Premium oznaczone W przygotowaniu, nie fikcyjnie działające. | T12 + odbiór ręczny | DO WERYFIKACJI |
| S22-F04 — Dostępność i Premium | Wygląd3.18 jako zaakceptowany wzorzec, bez zmiany kart/logo; focus/kontrast/320–768 i safe area/klawiatura wymagają ręcznego odbioru. | T12 + odbiór ręczny | DO WERYFIKACJI |

### S23 — Centrum powiadomień i push

Wariant: **L**. Wejście: Accounts → Powiadomienia / dzwonek. Zależności: **B07**.

Źródła: [app/src/pages/Notifications.tsx](../app/src/pages/Notifications.tsx), [app/src/notifications/nativePush.ts](../app/src/notifications/nativePush.ts), [app/src/notifications/model.ts](../app/src/notifications/model.ts), [app/supabase/functions/push-worker/handler.ts](../app/supabase/functions/push-worker/handler.ts).

Nie ma czynnego centrum powiadomień w Premium Profile; istniejący backend/worker nie dowodzi wdrożenia FCM lub harmonogramu.

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S23-F01 — Historia bez push | Własna lista i daty Europe/Warsaw działają niezależnie od zgody systemowej lub konfiguracji Firebase. | T13 + odbiór ręczny | DO WERYFIKACJI |
| S23-F02 — Licznik/przeczytane | Otwarcie/pojedyncze odczytanie i Oznacz wszystkie aktualizują unread, bez odczytania cudzych wpisów. | T13 + odbiór ręczny | DO WERYFIKACJI |
| S23-F03 — Przejście do meczu | Wskazany match_id/event_id jest ponownie autoryzowany, także po tapie z tła; stare ID nie omija uprawnień. | T13 + odbiór ręczny | DO WERYFIKACJI |
| S23-F04 — Strony/pusto/błędy | Limit50 i ograniczenie stron; loading/retry/pusta lista nie udają dostarczenia. | T13 + odbiór ręczny | DO WERYFIKACJI |
| S23-F05 — Kategorie | Nowe mecze/miejsce/przypomnienia/zmiana/finanse ustawiają wyłącznie preferencje push; historia nie znika. | T13 + odbiór ręczny | DO WERYFIKACJI |
| S23-F06 — Zgoda i urządzenie | Jawne Włącz/Wyłącz sprawdzają konfigurację i Android13+; token/wylogowanie nie pozostawiają powiązania z cudzym kontem. | T13 + odbiór ręczny | DO WERYFIKACJI |
| S23-F07 — Dostarczenie i iOS | Worker/FCM/konfiguracja są zależnością zewnętrzną; brak konfiguracji nie blokuje UI. APNs nie jest tokenem FCM; iOS nie jest uznany za odebrany. | T13 + odbiór ręczny | DO WERYFIKACJI |
| S23-F08 — Zdarzenia i harmonogram | Serwerowe nowe/zmiany/rezerwa/przypomnienia/decyzje finansowe mają idempotencję i retry; wymaga osobnego testu worker/scheduler na zgodnym backendzie, nie otwarcia aplikacji. | T13 + odbiór ręczny | DO WERYFIKACJI |

### S24 — Administracja kontami legacy

Wariant: **L**. Wejście: Accounts → Zarządzaj kontami, globalna rola admin. Zależności: **B01**.

Źródła: [app/src/pages/Accounts.tsx](../app/src/pages/Accounts.tsx), [app/supabase/functions/accounts/handler.ts](../app/supabase/functions/accounts/handler.ts).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S24-F01 — Lista kont | Wyłącznie admin aplikacji, dozwolone DTO i paginacja50; nie jest to publiczny katalog zawodników. | T14 + odbiór ręczny | DO WERYFIKACJI |
| S24-F02 — Utworzenie konta | Login/telefon walidowane, konto legacy ma hasło tymczasowe i obowiązek zmiany; zwykły członek/admin innej roli nie tworzy kont. | T14 + odbiór ręczny | DO WERYFIKACJI |
| S24-F03 — Jednorazowe hasło | Wyświetlane po operacji i chowane po opuszczeniu, nie można odczytać starego hasła ani zapisać go w dokumentach. | T14 + odbiór ręczny | DO WERYFIKACJI |
| S24-F04 — Reset hasła | Potwierdzenie dla dozwolonego konta, poprzednie sesje wycofane, wymagane ustawienie własnego hasła. | T14 + odbiór ręczny | DO WERYFIKACJI |
| S24-F05 — Operacja w toku/odmowa | operation_pending i zajęty identyfikator nie zostawiają pozornej gotowości; brak dostępu z samej roli administratora grupy. | T14 + odbiór ręczny | DO WERYFIKACJI |

### S25 — Mecze historyczne legacy

Wariant: **L**. Wejście: LIVE Mecze → historia legacy. Zależności: **B08**.

Źródła: [app/src/pages/Events.tsx](../app/src/pages/Events.tsx), [app/src/events/model.ts](../app/src/events/model.ts).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S25-F01 — Odczyt historii | Lista/szczegóły i stare uczestnictwo z events_*, bez przepisywania na matches_* i bez wymyślonych meczów. | T15 + odbiór ręczny | DO WERYFIKACJI |
| S25-F02 — Ograniczenie tworzenia | Accounts przekazuje allowCreate=false; obecność starego formularza w pliku nie oznacza dostępnego tworzenia nowego legacy meczu. | T15 + odbiór ręczny | DO WERYFIKACJI |
| S25-F03 — Dozwolone stare operacje | Edycja/gość/rezerwa/wycofanie/obecność tylko dla uprawnionych i przy stanie dopuszczonym przez stare API. | T15 + odbiór ręczny | DO WERYFIKACJI |
| S25-F04 — Powrót i finanse | Powiązany stary mecz prowadzi do własnego rozliczenia historycznego, nie do fikcyjnego finansowego DTO nowej grupy. | T15 + odbiór ręczny | DO WERYFIKACJI |

### S26 — Rozliczenia historyczne legacy

Wariant: **L**. Wejście: Rozliczenia → historyczne / szczegóły legacy meczu. Zależności: **B08+B06**.

Źródła: [app/src/pages/Settlements.tsx](../app/src/pages/Settlements.tsx), [app/src/pages/MatchSettlement.tsx](../app/src/pages/MatchSettlement.tsx), [app/src/settlements/useFinanceOperation.ts](../app/src/settlements/useFinanceOperation.ts).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S26-F01 — Własna historia legacy | Stare kwoty/statusy i dozwolony zakres pozostają czytelne po integracji, bez ponownego naliczania. | T15 + odbiór ręczny | DO WERYFIKACJI |
| S26-F02 — Wpłata i decyzja | Istniejące submit/record/accept/reject tylko według dawnego API i aktualnego scope finansowego, nie globalnego dostępu do cudzych grup. | T15 + odbiór ręczny | DO WERYFIKACJI |
| S26-F03 — Korekty i zastępstwa | Dozwolony koszt/obciążenie/zastępstwo/korekta wpłaty z powodem/version, jawnie w historycznym widoku. | T15 + odbiór ręczny | DO WERYFIKACJI |
| S26-F04 — Retry i prywatność | request_id, odczyt historii i błędy bez podwójnego księgowania; brak cudzych sald u zwykłego użytkownika. | T15 + odbiór ręczny | DO WERYFIKACJI |

### S27 — Profil w domyślnym LIVE

Wariant: **L**. Wejście: Accounts → Mój profil. Zależności: **B02+B01**.

Źródła: [app/src/pages/Accounts.tsx](../app/src/pages/Accounts.tsx), [app/src/auth/uiAdapter.ts](../app/src/auth/uiAdapter.ts).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S27-F01 — Odczyt własnych danych | Profil konta z serwera, stan loading/retry; nie jest to karta Ultimate Premium. | T10 + odbiór ręczny | DO WERYFIKACJI |
| S27-F02 — Publiczna nazwa w LIVE | Istniejący formularz ma nickname/full_name. Nie obiecywać w nim trzywariantowego edytora Premium, mimo kontraktu first_name w backendzie. | T10 + odbiór ręczny | DO WERYFIKACJI |
| S27-F03 — Login/telefon/kontakt | Legacy identifiers wymaga hasła i rotuje sesje; konto e-mail zapisuje pseudonim i opcjonalny kontakt, bez zmiany loginu e-mail. | T10 + odbiór ręczny | DO WERYFIKACJI |
| S27-F04 — Hasło/wygląd/wyjście | Rzeczywiste wejście do zmiany hasła, ustawień España i logout; wynik testu Premium nie zastępuje odbioru tego formularza. | T10 + odbiór ręczny | DO WERYFIKACJI |

### S28 — Rejestracja — ekran przygotowany

Wariant: **P/D, nieczynny port LIVE**. Wejście: AccountScreens register / symulator. Zależności: **B09**.

Źródła: [app/src/account-ui/AccountScreens.tsx](../app/src/account-ui/AccountScreens.tsx), [app/src/auth/b1Port.ts](../app/src/auth/b1Port.ts), [app/src/demo/AccountDemo.tsx](../app/src/demo/AccountDemo.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S28-F01 — Formularz i zgody | Pseudonim/e-mail/hasła i opcjonalne dane walidowane; wymagane regulamin/privacy mają jawnie demonstracyjny status. | T16 + odbiór ręczny | DO WERYFIKACJI |
| S28-F02 — Brak pozornego konta | b1Port.signUp zwraca integration failure; demo nie tworzy prawdziwego konta, backendowa flaga poczty nie aktywuje samoczynnie UI. | T16 + odbiór ręczny | DO WERYFIKACJI |
| S28-F03 — Dalszy proces | W demo przejście do oczekiwania na e-mail bez prawdziwej wysyłki; produkcyjne signup/legal/SMTP/callback wymagają osobnego etapu. | T16 + odbiór ręczny | DO WERYFIKACJI |

### S29 — Potwierdzenie e-mail/link — ekran przygotowany

Wariant: **D / nieaktywny prawdziwy proces**. Wejście: AccountScreens verify/confirmed/invalid-link. Zależności: **B09**.

Źródła: [app/src/account-ui/AccountScreens.tsx](../app/src/account-ui/AccountScreens.tsx), [app/src/account-ui/model.ts](../app/src/account-ui/model.ts), [app/src/demo/AccountDemo.tsx](../app/src/demo/AccountDemo.tsx).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S29-F01 — Oczekiwanie i ponowienie | Instrukcja sprawdzenia poczty/spamu i cooldown; demo nie twierdzi, że wysłało wiadomość. | T16 + odbiór ręczny | DO WERYFIKACJI |
| S29-F02 — Weryfikacja/nieprawidłowy link | Sam hash/adres nie tworzy sesji; zły/wygasły link daje czytelny błąd, nie dostęp. | T16 + odbiór ręczny | DO WERYFIKACJI |
| S29-F03 — Potwierdzenie i profil | Sukces symulatora jest podpisany i może przejść do pierwszego profilu; prawdziwy callback Auth nie jest tu aktywowany. | T16 + odbiór ręczny | DO WERYFIKACJI |

### S30 — Zapomniałem hasła — ekran przygotowany

Wariant: **P/D, brak prawdziwego portu**. Wejście: AccountScreens forgot. Zależności: **B09**.

Źródła: [app/src/account-ui/AccountScreens.tsx](../app/src/account-ui/AccountScreens.tsx), [app/src/auth/b1Port.ts](../app/src/auth/b1Port.ts).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S30-F01 — Wniosek odzyskania | Waliduje e-mail i nie ujawnia istnienia konta; rzeczywisty adapter nie udaje wysłania wiadomości. | T16 + odbiór ręczny | DO WERYFIKACJI |
| S30-F02 — Powrót i błędy | Możliwy powrót do loginu i błąd sieci/integracji; odzyskanie legacy prowadzi do administratora, nie do fałszywego e-maila. | T16 + odbiór ręczny | DO WERYFIKACJI |

### S31 — Nowe hasło z linku — ekran przygotowany

Wariant: **D / nieaktywny reset LIVE**. Wejście: AccountScreens reset/password-saved. Zależności: **B09**.

Źródła: [app/src/account-ui/AccountScreens.tsx](../app/src/account-ui/AccountScreens.tsx), [app/src/demo/accountState.ts](../app/src/demo/accountState.ts), [app/src/auth/b1Port.ts](../app/src/auth/b1Port.ts).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S31-F01 — Nowe hasła | Zgodność/minimum/limit/pokaż-ukryj/busy; bez przechowywania haseł w trwałym stanie. | T16 + odbiór ręczny | DO WERYFIKACJI |
| S31-F02 — Wynik i link | Wygasły link nie pozwala zmienić konta; symulacja i rzeczywista zmiana S03 są rozdzielone, sukces demo jest podpisany. | T16 + odbiór ręczny | DO WERYFIKACJI |

### S32 — Pierwsze uzupełnienie profilu — symulator

Wariant: **D / nieaktywny onboarding LIVE**. Wejście: AccountScreens first-profile. Zależności: **B09**.

Źródła: [app/src/account-ui/AccountScreens.tsx](../app/src/account-ui/AccountScreens.tsx), [app/src/demo/accountState.ts](../app/src/demo/accountState.ts).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S32-F01 — Pierwsza karta | Nick i opcjonalny numer/portret; brak wymogu telefonu/zdjęcia/grupy. | T16 + odbiór ręczny | DO WERYFIKACJI |
| S32-F02 — Nowy zawodnik | W symulatorze start0 meczów/goli/asyst/MVP, dekoracyjne gwiazdy, bez automatycznego członkostwa. | T16 + odbiór ręczny | DO WERYFIKACJI |
| S32-F03 — Zapis i przejście | Dane tylko w pamięci demo, przejście do shellu; prawdziwe saveProfile/onboarding pozostają do integracji, nie uznawać za działającą rejestrację. | T16 + odbiór ręczny | DO WERYFIKACJI |

### S33 — Narzędzia izolowanego demo

Wariant: **D**. Wejście: build:demo → zwijane Narzędzia demo. Zależności: **B09**.

Źródła: [app/src/demo/App.tsx](../app/src/demo/App.tsx), [app/src/demo/AccountDemo.tsx](../app/src/demo/AccountDemo.tsx), [app/src/demo/data.ts](../app/src/demo/data.ts), [app/vite.demo.config.ts](../app/vite.demo.config.ts).

| Funkcja | Co podlega odbiorowi / oczekiwane działanie | Regresja | Status początkowy |
|---|---|---|---|
| S33-F01 — Scenariusze i użytkownik | Deterministyczne fikcyjne spotkania/osoby, wybór stanu pełny/rezerwa/zakończony/anulowany/zaległości, wyłącznie RAM. | T17 + odbiór ręczny | DO WERYFIKACJI |
| S33-F02 — Interaktywne scenariusze | Zapisy/goście/składy/finanse/profil mogą być symulowane, ale każda kwota/zgoda/rola jest jawnie demonstracyjna. | T17 + odbiór ręczny | DO WERYFIKACJI |
| S33-F03 — Reset i spójność | Reset przywraca wspólny fixture, usuwa utworzone dane demo; nie resetuje preferencji wyglądu. | T17 + odbiór ręczny | DO WERYFIKACJI |
| S33-F04 — Symulator kont | Prezentuje stany login/rejestracja/expired, nie przyznaje dostępu do prawdziwej sesji lub API. | T17 + odbiór ręczny | DO WERYFIKACJI |
| S33-F05 — Izolacja | Bundle demo bez produkcyjnego Auth/Supabase/Edge, connect-src none, brak prawdziwych danych i uploadu na serwer. | T17 + odbiór ręczny | DO WERYFIKACJI |

## Powiązane testy — katalog istniejących źródeł

Testy demo/mocked API nie są testami RLS lub prawdziwego Supabase. Browser runner
z rzeczywistym backendem i test SQL również nie zastępują ręcznego odbioru telefonu.
Testy historycznych wariantów wymagają sprawdzenia konfiguracji i aktualności.

| Pakiet | Zakres / istniejące pliki |
|---|---|
| T01 — Logowanie i hasło | [app/src/auth/sessionManager.test.ts](../app/src/auth/sessionManager.test.ts)<br>[app/src/auth/uiAdapter.test.ts](../app/src/auth/uiAdapter.test.ts)<br>[app/src/auth/B1App.test.tsx](../app/src/auth/B1App.test.tsx)<br>[app/src/account-ui/AccountScreens.test.tsx](../app/src/account-ui/AccountScreens.test.tsx)<br>[app/supabase/functions/accounts/handler.test.ts](../app/supabase/functions/accounts/handler.test.ts)<br>[app/cypress/b1/auth.cy.ts](../app/cypress/b1/auth.cy.ts) |
| T02 — Sesja, powrót, prywatność i Android | [app/src/auth/B1App.test.tsx](../app/src/auth/B1App.test.tsx)<br>[app/src/auth/sessionManager.test.ts](../app/src/auth/sessionManager.test.ts)<br>[app/src/events/resume.test.tsx](../app/src/events/resume.test.tsx)<br>[app/src/groups/useGroups.test.tsx](../app/src/groups/useGroups.test.tsx)<br>[app/src/native/focusVisibility.test.ts](../app/src/native/focusVisibility.test.ts)<br>[app/src/native/frozenDemoAndroid.test.ts](../app/src/native/frozenDemoAndroid.test.ts)<br>[app/android/app/src/androidTest/java/pl/psuda87/slm/SlmWindowInsetsTest.java](../app/android/app/src/androidTest/java/pl/psuda87/slm/SlmWindowInsetsTest.java) |
| T03 — Discovery i lista | [app/src/events/discoveryUi.test.tsx](../app/src/events/discoveryUi.test.tsx)<br>[app/src/events/eventFilters.test.ts](../app/src/events/eventFilters.test.ts)<br>[app/supabase/functions/accounts/discovery.test.ts](../app/supabase/functions/accounts/discovery.test.ts)<br>[app/supabase/tests/public_match_discovery.sql](../app/supabase/tests/public_match_discovery.sql)<br>[app/scripts/test-public-discovery-local.py](../app/scripts/test-public-discovery-local.py)<br>[app/scripts/test-discovery-ui-local.py](../app/scripts/test-discovery-ui-local.py) |
| T04 — Formularz, minimum i edycja | [app/src/demo/EventForm.test.tsx](../app/src/demo/EventForm.test.tsx)<br>[app/src/demo/polishDate.test.tsx](../app/src/demo/polishDate.test.tsx)<br>[app/src/events/minimum.test.tsx](../app/src/events/minimum.test.tsx)<br>[app/src/events/editResume.test.tsx](../app/src/events/editResume.test.tsx)<br>[app/supabase/tests/minimum_phone.sql](../app/supabase/tests/minimum_phone.sql)<br>[docs/review/test-minimum-phone-local.py](../docs/review/test-minimum-phone-local.py) |
| T05 — Szczegóły i udział | [app/src/events/premium.test.tsx](../app/src/events/premium.test.tsx)<br>[app/src/events/premiumUi.test.tsx](../app/src/events/premiumUi.test.tsx)<br>[app/src/events/GuestForm.test.tsx](../app/src/events/GuestForm.test.tsx)<br>[app/src/events/resume.test.tsx](../app/src/events/resume.test.tsx)<br>[app/supabase/tests/premium_match_visibility.sql](../app/supabase/tests/premium_match_visibility.sql)<br>[app/cypress/live/scoped.cy.ts](../app/cypress/live/scoped.cy.ts)<br>[app/cypress/guest-layout.cy.ts](../app/cypress/guest-layout.cy.ts) |
| T06 — Składy i prawo zapisu44 | [app/src/events/lineupEditor.test.tsx](../app/src/events/lineupEditor.test.tsx)<br>[app/src/events/premiumLineupApi.test.tsx](../app/src/events/premiumLineupApi.test.tsx)<br>[app/supabase/functions/accounts/lineups.test.ts](../app/supabase/functions/accounts/lineups.test.ts)<br>[app/supabase/tests/match_lineups.sql](../app/supabase/tests/match_lineups.sql)<br>[app/supabase/tests/lineup_admin.sql](../app/supabase/tests/lineup_admin.sql)<br>[docs/review/test-admin-lineups-local.py](../docs/review/test-admin-lineups-local.py)<br>[app/scripts/test-lineups-ui-browser.mjs](../app/scripts/test-lineups-ui-browser.mjs) |
| T07 — Rzeczywiste finanse | [app/src/finance/finance.test.tsx](../app/src/finance/finance.test.tsx)<br>[app/src/settlements/useFinanceOperation.test.tsx](../app/src/settlements/useFinanceOperation.test.tsx)<br>[app/supabase/tests/premium_admin_finance.sql](../app/supabase/tests/premium_admin_finance.sql)<br>[app/supabase/tests/integration-contracts.sql](../app/supabase/tests/integration-contracts.sql)<br>[app/scripts/test-premium-finance-authority-http.mjs](../app/scripts/test-premium-finance-authority-http.mjs)<br>[app/cypress/live/scoped.cy.ts](../app/cypress/live/scoped.cy.ts) |
| T08 — Grupy i prywatnośćB3 | [app/src/groups/useGroups.test.tsx](../app/src/groups/useGroups.test.tsx)<br>[app/src/groups/GroupControls.test.tsx](../app/src/groups/GroupControls.test.tsx)<br>[app/src/demo/GroupScreens.test.tsx](../app/src/demo/GroupScreens.test.tsx)<br>[app/scripts/test-b3-local.mjs](../app/scripts/test-b3-local.mjs)<br>[app/cypress/b3/groups.cy.ts](../app/cypress/b3/groups.cy.ts)<br>[app/supabase/tests/premium_profile_name.sql](../app/supabase/tests/premium_profile_name.sql) |
| T09 — Karty i profile | [app/src/auth/profileAdapter.test.tsx](../app/src/auth/profileAdapter.test.tsx)<br>[app/src/auth/premiumRuntime.test.tsx](../app/src/auth/premiumRuntime.test.tsx)<br>[app/src/events/lineupEditor.test.tsx](../app/src/events/lineupEditor.test.tsx)<br>[app/src/events/premiumLineupApi.test.tsx](../app/src/events/premiumLineupApi.test.tsx)<br>[app/src/demo/UltimatePlayerCard.test.tsx](../app/src/demo/UltimatePlayerCard.test.tsx)<br>[app/cypress/pr16/profile.cy.ts](../app/cypress/pr16/profile.cy.ts) |
| T10 — Nazwa, numer i telefon | [app/src/profile/PremiumIdentityEditor.test.tsx](../app/src/profile/PremiumIdentityEditor.test.tsx)<br>[app/src/profile/PhoneEditor.test.tsx](../app/src/profile/PhoneEditor.test.tsx)<br>[app/src/auth/profileAdapter.test.tsx](../app/src/auth/profileAdapter.test.tsx)<br>[app/src/profile/phoneIsolation.test.ts](../app/src/profile/phoneIsolation.test.ts)<br>[app/supabase/tests/premium_profile_name.sql](../app/supabase/tests/premium_profile_name.sql)<br>[app/supabase/tests/minimum_phone.sql](../app/supabase/tests/minimum_phone.sql)<br>[docs/review/test-minimum-phone-local.py](../docs/review/test-minimum-phone-local.py) |
| T11 — Zdjęcia i Storage | [app/src/profile/preparePhoto.test.ts](../app/src/profile/preparePhoto.test.ts)<br>[app/supabase/functions/accounts/profilePhotos.test.ts](../app/supabase/functions/accounts/profilePhotos.test.ts)<br>[app/cypress/b22/profile-media.cy.ts](../app/cypress/b22/profile-media.cy.ts)<br>[app/cypress/b22/preparation.cy.ts](../app/cypress/b22/preparation.cy.ts)<br>[app/src/auth/B1App.test.tsx](../app/src/auth/B1App.test.tsx) |
| T12 — Motywy i Premium | [app/src/ui/palettes.test.tsx](../app/src/ui/palettes.test.tsx)<br>[app/src/ui/ui.test.tsx](../app/src/ui/ui.test.tsx)<br>[app/scripts/verify-frozen-ui.mjs](../app/scripts/verify-frozen-ui.mjs)<br>[app/scripts/verify-consolidation.mjs](../app/scripts/verify-consolidation.mjs)<br>[app/scripts/verify-premium-policy-cases.mjs](../app/scripts/verify-premium-policy-cases.mjs)<br>[app/scripts/premium318-contract.json](../app/scripts/premium318-contract.json) |
| T13 — Powiadomienia | [app/src/notifications/model.test.ts](../app/src/notifications/model.test.ts)<br>[app/supabase/functions/push-worker/handler.test.ts](../app/supabase/functions/push-worker/handler.test.ts)<br>[app/supabase/functions/push-worker/fcm.test.ts](../app/supabase/functions/push-worker/fcm.test.ts)<br>[app/supabase/tests/notifications.sql](../app/supabase/tests/notifications.sql)<br>[app/cypress/e2e/notifications.cy.ts](../app/cypress/e2e/notifications.cy.ts) |
| T14 — Konta administratora | [app/supabase/functions/accounts/handler.test.ts](../app/supabase/functions/accounts/handler.test.ts)<br>[app/scripts/test-accounts-local.mjs](../app/scripts/test-accounts-local.mjs)<br>[app/scripts/test-b1-local.mjs](../app/scripts/test-b1-local.mjs) |
| T15 — Legacy i ledger | [app/cypress/e2e/events.cy.ts](../app/cypress/e2e/events.cy.ts)<br>[app/cypress/e2e/settlements.cy.ts](../app/cypress/e2e/settlements.cy.ts)<br>[app/supabase/tests/settlements.sql](../app/supabase/tests/settlements.sql)<br>[app/supabase/tests/integration-contracts.sql](../app/supabase/tests/integration-contracts.sql)<br>[app/src/settlements/useFinanceOperation.test.tsx](../app/src/settlements/useFinanceOperation.test.tsx) |
| T16 — Ekrany kont i nieaktywne adaptery | [app/src/account-ui/AccountScreens.test.tsx](../app/src/account-ui/AccountScreens.test.tsx)<br>[app/src/demo/accountState.test.ts](../app/src/demo/accountState.test.ts)<br>[app/src/demo/AccountDemo.test.tsx](../app/src/demo/AccountDemo.test.tsx)<br>[app/src/auth/uiAdapter.test.ts](../app/src/auth/uiAdapter.test.ts) |
| T17 — Demo, bez dowodu backendu | [app/src/demo/data.test.ts](../app/src/demo/data.test.ts)<br>[app/src/demo/Teams.test.tsx](../app/src/demo/Teams.test.tsx)<br>[app/src/demo/Finance.test.tsx](../app/src/demo/Finance.test.tsx)<br>[app/src/demo/Identity.test.tsx](../app/src/demo/Identity.test.tsx)<br>[app/src/demo/Groups.test.tsx](../app/src/demo/Groups.test.tsx)<br>[app/scripts/verify-demo-build.mjs](../app/scripts/verify-demo-build.mjs)<br>[app/vite.demo.config.test.ts](../app/vite.demo.config.test.ts) |

## Zgłoszony błąd automatycznych składów

**BUG-SKL-001 — S09-F01 — ZGŁOSZONY BŁĄD.** Źródło: bieżące polecenie właściciela:
„aplikacja wymaga ręcznego przypisywania zawodników zamiast automatycznie rozdzielać
zapisanych zawodników na drużyny”. Status rejestru: **BŁĄD**, nie ZATWIERDZONE.
Nie odtwarzano zgłoszenia na telefonie i nie naprawiano kodu w tym zadaniu.

Istotna obserwacja źródeł: `usePremiumLineup.ts` przy `snapshot.can_write` i
`version===0` już tworzy proposal przez `editLineup(...preview...)`; `lineupEditor.ts`
naprzemiennie rozdziela identyfikatory A/B. `PremiumTeams.tsx` pokazuje też ręczne
przyciski A/B dla `unassigned`. Dlatego nie wpisujemy nieprawdziwej diagnozy „brak
jakiegokolwiek algorytmu”. Do odtworzenia: rola aktualnego admina i członkostwo,
wersja zapisanego składu, lista registered/guest/reserve, zgodność backendu44,
nowi uczestnicy w istniejącym składzie i powrót z tła. Podejrzenia nie są ustaloną przyczyną.

Kryteria ręcznego odbioru naprawy (w osobnym małym zadaniu):

1. Nowy mecz bez zapisanego składu, co najmniej2 aktualnie zapisanych: od razu
   kompletny **lokalny podgląd** dwóch drużyn, bez klikania A/B dla każdej osoby.
2. 10→5:5,11→6:5,12→6:6; każdy stable participation id dokładnie raz, zapisani
   goście uwzględnieni, rezerwa/wycofani pominięci. Nie wymuszać5:5 dla każdej liczby.
3. Ponowny render/wznowienie nie losuje na nowo ręcznie zmienionego lub zapisanego
   układu. Przy odświeżeniu nie tracić draftu bez decyzji użytkownika.
4. Jawny Zapisz i obecne uprawnienie administratora44/CAS/roster/request_id
   pozostają; nie wdrażać autosave, ocen/ważenia lub losowego algorytmu równoważenia.
5. Zamiana, transfer, przywrócenie i cofnięcie zamiany działają; no-op nie zmienia autora.
6. Osobno ustalić w karcie zadania zachowanie po zmianie rosteru **istniejącego**
   składu; obecny manualny unassigned nie jest powodem do nadpisania całego zapisu.
   Nie rozszerzać naprawy na nowy produkt bez decyzji właściciela.

Regresja: T06, prawdziwy lineups_get/save na nowej zgodnej fixture, test roli admin/
członek/outsider i ręczny odbiór właściciela na wskazanym SHA. Przechodzący test
preview w reducerze sam nie zamyka zgłoszenia zachowania całej aplikacji.

## Procedura odbioru — wspólny punkt wejścia

Pełna definicja statusów, dowodów, bramek merge i zamknięcia jest w
[FUNCTION_ACCEPTANCE_LOG.md](FUNCTION_ACCEPTANCE_LOG.md#procedura-jednej-funkcji).
Obowiązuje: **jedna funkcja lub mały powiązany zestaw → poprawka → testy → ręczny
odbiór właściciela → osobno autoryzowany merge → zamknięcie**. Ten dokument opisuje
zakres i oczekiwany wynik; bieżący stan i chronologia są wyłącznie w rejestrze.

## Walidacja tej dokumentacji

Sprawdzono istnienie wskazanych komponentów/testów, jednoznaczność ID i zgodność
liczby funkcji z rejestrem. Nie zmieniono app, migracji, CI lub zabezpieczeń.
Nie uruchamiano testów aplikacji ani backendu. Wszystkie plany Txx nadal wymagają
wykonania w właściwym środowisku; historyczny PASS nie jest odbiorem właściciela.

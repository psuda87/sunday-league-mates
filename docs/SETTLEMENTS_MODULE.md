# Rozliczenia — Sunday League Mates / Soccer Room 2.0

Stan 14.10.2026: **implementacja lokalna, nieweryfikowana, niewdrożona**.
Gałąź `feat/settlements` utworzona z `origin/feat/events`, commit
`6638e18b4ed763e5bdee45ea61416a576e00bbec`. `main` nie zawierał wydarzeń.
Przed zmianami checkout był czysty. Nie wykonano commita, pusha ani scalenia.
Nie uruchomiono testów, lintowania, kompilacji, buildów, emulatorów,
synchronizacji Capacitor ani migracji (lokalnych lub zdalnych).

## Zasady tego etapu

Polecenie implementacji rozliczeń z 14.10.2026 zastępuje historyczne zapisy
specyfikacji o automatycznym naliczaniu na początku, obowiązku każdej rezygnacji
po 17:00 i odłożonych częściowych wpłatach. Nowe zasady zapisano też w specyfikacji.

- Każdy zapisany uczestnik jest domyślnie obecny i płatny. `absent` pozostaje
  niezależne od `default_payable` i `charge_override`. Nieobecność sama nie zwalnia.
  Administrator może zmieniać obecność również po meczu; zmiana odświeża podział.
  Bez zmiany obowiązku opłaty kwoty pozostają takie same.
- Domyślny koszt pochodzi z wydarzenia. Administrator zmienia koszt i indywidualne
  obowiązki. Źródłem kwot jest `total_cost_cents bigint`. Historyczne `total_cost`
  numeric pozostaje zgodnym adapterem API wydarzeń, synchronizowanym triggerem.
  Ledger, wpłaty, rewizje i pozycje przechowują całe grosze.
- Podział jest równy; pozostałe grosze dostają płatne udziały według rosnącego,
  niezmiennego UUID uczestnictwa. Suma jest dokładnie kosztem do podziału.
  Dodatni koszt bez płatników może być roboczy, ale nie może zostać zatwierdzony.
  Po zatwierdzeniu nie można zwolnić ostatniego płatnika przy dodatnim koszcie;
  najpierw trzeba skorygować koszt do zera albo wskazać innego płatnika.
- Od 17:00 w lokalnej dacie wydarzenia wycofanie `registered` → `withdrawn` lub
  `reserve` nalicza domyślny obowiązek tylko wtedy, gdy pozostaje mniej niż 10
  zapisanych. Przed 17:00 lub przy pozostającym minimum 10 domyślnie nie nalicza.
  Liczba zapisanych nie jest liczbą osób fizycznie obecnych. Granica jest liczona
  na serwerze z `timezone` wydarzenia; obecny moduł obsługuje `Europe/Warsaw` z DST.
- Skuteczny nowy zapis z obowiązkiem opłaty przejmuje najstarsze domyślne
  zobowiązanie FIFO, według numeru historii rezygnacji. Nie zużywa dwa razy tego
  samego miejsca. Rezerwa sama nie jest zastępstwem. Powrót tej samej osoby
  zamyka jej własne zobowiązanie. Administrator może jawnie skorygować opłatę
  albo wskazać skutecznego zastępcę; sprawdzane są ten sam mecz, aktywny zapis,
  czas zapisu po zwolnieniu miejsca i brak wcześniejszego wykorzystania zastępcy.
  Jawna decyzja `charge_override` ma pierwszeństwo przed regułą automatyczną;
  ręcznie utrzymany obowiązek nie jest po cichu zdejmowany przez FIFO.
- Gość jest osobnym udziałem, którego kwota obciąża zapraszającego. Nie ma własnego
  konta finansowego. Historia zawodnika rozróżnia jego udział i każdego gościa.
- Rozliczenie wstępne jest projekcją aktualnych zapisów i decyzji. Saldo zmienia
  dopiero jawne zatwierdzenie administratora, możliwe po planowanym końcu meczu
  (`starts_at + duration_minutes`). Nie ma zadania automatycznie zatwierdzającego.
- Korekty zatwierdzonego kosztu/opłat przeliczają cały równy podział i dopisują
  wyłącznie różnice. Poprzednie rewizje i kwoty pozostają. Zmiana samej obecności
  tworzy audytowalną rewizję bez sztucznego obciążenia, jeśli kwoty się nie zmieniły.
  Odwołanie zatwierdzonego meczu wycofuje należności korektą; wpłat nie usuwa.
- Wpłata administratora jest od razu księgowana. Zgłoszenie zawodnika pozostaje
  `pending`, bez wpływu na saldo. Akceptacja księguje je raz, odrzucenie nic nie
  księguje. Korekta wskazuje poprawną kwotę całej wpłaty, a nie różnicę; wartość
  zero wycofuje ją przez przeciwny wpis. Każda decyzja administratora wymaga powodu.
- Wpłaty i ich korekty pokrywają najstarsze zakończone, zatwierdzone mecze według
  `(starts_at, event_id)`. Pokrycie jest odtwarzalną projekcją dziennika, nie zbiorem
  nadpisywanych ręcznych oznaczeń. Częściowe wpłaty oraz nadpłaty działają również
  po kolejnej korekcie/odwołaniu meczu. Dodatnie saldo to nadpłata, ujemne to dług.
- Blokada wymaga co najmniej dwóch **różnych** meczów z resztą do zapłaty po FIFO.
  Udział i dowolna liczba gości w jednym meczu to jeden zaległy mecz. Robocze i
  niezakończone rozliczenia nie tworzą blokady. Serwer sprawdza ją przy zapisie
  własnym, administracyjnym, nowym gościu (również na rezerwę) i awansie gościa
  z rezerwy. Nie blokuje przeglądania, rezygnacji, edycji istniejącego gościa ani
  przeniesienia aktywnego udziału na rezerwę. Po uregulowaniu odpowiedniego długu
  znika automatycznie; dotychczasowych zapisów nie usuwa.

## Model, uprawnienia i transakcje

`slm_settlements` przechowuje stan zatwierdzenia, wersję do kontroli równoczesnych
edycji oraz numer rewizji. `slm_settlement_shares` przechowuje domyślną i ręczną
decyzję oraz powiązanie zastępstwa. `slm_settlement_revisions` i
`slm_settlement_lines` zachowują pełne zatwierdzone snapshoty, nazwy i kwoty.
`slm_payments` przechowuje zgłoszenie/decyzję oraz aktualną poprawioną kwotę.
`slm_finance_ledger` jest nieusuwalnym dziennikiem kwot ze znakiem;
`slm_finance_audit` zachowuje wykonawcę, powód i stan decyzji. Nowe tabele
nie pozwalają usunąć wydarzeń/kont z historią przez kaskadę.

RLS udostępnia członkowi tylko jego ledger, wpłaty, decyzje wpłat i własne pozycje
rewizji; administratorowi odpowiednie pełne odczyty. Finansowe snapshoty decyzji
całego meczu są tylko dla administratora. Tabele stanu roboczego, idempotencji
i prywatne funkcje są niedostępne klientowi. Nie ma klientowych grantów write.
Nieusuwalne tabele blokują UPDATE/DELETE triggerem; service_role nie ma również
UPDATE/DELETE/TRUNCATE tych tabel. Wpłata zachowuje oryginalne dane; można
zmieniać tylko legalny stan zgłoszenia i kwotę skorygowaną zaakceptowanej wpłaty.
Historia wydarzeń również nie może być nadpisywana/usuwana.

Publiczne RPC `slm_settlements_dispatch` i istniejące `slm_events_dispatch` są
SECURITY INVOKER, mają pusty search_path i EXECUTE tylko dla service_role.
Kontekst JWT/sesji weryfikuje istniejąca Edge Function `accounts`; baza ponownie
sprawdza aktywność, żywą sesję, wersję bezpieczeństwa, hasło tymczasowe i rolę.
Tożsamość i rola z formularza nie są zaufane. Kontrola salda nie pochodzi z UI.

Wspólny transakcyjny advisory lock `(20261014, 1)` serializuje finanse i zapisy
jednej grupy przed blokadami rekordów i sesji. Finansowe wpisy, rewizje, decyzje,
historia i zapis idempotencji zatwierdzają się razem lub razem wycofują.
`expected_version` oraz `expected_amount_cents` odrzucają nieaktualne edycje.
Flaga zatwierdzenia i unikalne indeksy uniemożliwiają powtórne zatwierdzenie meczu
lub ponowne zaksięgowanie tej samej wpłaty.

`slm_finance_requests` wiąże UUID żądania z wykonawcą, akcją i pełnym body.
Ponowienie identycznego żądania zwraca poprzedni wynik. Inne body z tym UUID
jest konfliktem. Hook klienta zachowuje body tylko w pamięci; w lokalnym storage
zostawia wyłącznie UUID pod kluczem konta (bez kwoty, powodu, hasła lub tokenu).
Po restarcie akcja `resolve_request` potwierdza zapis albo atomowo zamyka UUID
bez księgowania. Takie zamknięcie blokuje także spóźnione pierwotne żądanie.
Uszkodzona/niedostępna pamięć blokuje wysłanie nowej operacji zamiast pomijać
zabezpieczenie. UUID jest usuwany po rozstrzygnięciu. Wylogowanie nie pozwala
ponowić żądania innego konta. Nie ma integracji bankowej, BLIK ani nowych sekretów.

## Ekrany i API

**Rozliczenia** w nawigacji konta: saldo, blokada, mecze z pokryciem FIFO,
historia własnych i gościnnych pozycji, zgłoszenia i formularz wpłaty. Administrator
wybiera konto, rejestruje wpłatę, poprawia zaakceptowaną kwotę i rozpatruje kolejkę.
**Mecze → Szczegóły → Rozliczenie meczu**: koszt, obecność, indywidualna opłata,
przywrócenie reguły domyślnej, zastępstwo, zatwierdzenie i historia decyzji.
Wersja rozliczenia zwracana przez API wydarzeń odświeża panel po każdej zmianie.
Finansowa obecność używa nowego RPC; stara akcja obecności po zatwierdzeniu
odmawia i kieruje do panelu korekt. Listy historii i wpłat stronicują po 50.

Akcje `accounts`: `settlements_account`, `settlements_pending`,
`settlements_detail`, `settlements_submit_payment`, `settlements_record_payment`,
`settlements_accept_payment`, `settlements_reject_payment`,
`settlements_correct_payment`, `settlements_cost`, `settlements_charge`,
`settlements_attendance`, `settlements_replacement`, `settlements_approve`,
`settlements_resolve_request`. Zapisy wymagają request_id; modyfikacje meczu
wymagają expected_version, a korekta wpłaty expected_amount_cents.
Kwoty pojedynczego kosztu/wpłaty mają ten sam praktyczny zakres co wcześniejszy
koszt numeric(12,2): 0–999 999 999 999 groszy (wpłata od 1 grosza).

## Migracje oczekujące i kolejność przyszłego wdrożenia

Nie zastosowano żadnego poniższego pliku:

1. `20261014100000_settlements_ledger.sql` — grosze, tabele, RLS, nieusuwalność,
   podział, projekcja FIFO, rewizje i odtworzenie roboczych obowiązków z historii.
2. `20261014101000_settlements_rpc.sql` — zweryfikowane RPC finansowe, idempotencja,
   bezpieczne rozstrzyganie po restarcie i odczyty.
3. `20261014102000_settlements_events_integration.sql` — integracja RPC wydarzeń,
   serwerowe blokady zapisów i nowy summary.

Wymagają wszystkich migracji Auth i wydarzeń z feat/events. Import istniejącej
historii nie zatwierdza starych meczów i nie tworzy automatycznie należności.
Historia pozostaje źródłem kolejności; brakujące zapisy historyczne nie mogą
odtworzyć nieznanego dawnego zastępstwa — administrator musi je rozstrzygnąć.
Późniejsze wdrożenie powinno przebiegać: najpierw migracje na upoważnionej bazie,
potem Edge `accounts`, na końcu klient. To opis przyszłej procedury, nie zgoda
na wykonanie migracji/deploy w tym zadaniu. Aktualny backend produkcyjny
nie obsługuje tego lokalnego klienta rozliczeń.

## Ryzyka i ograniczenia do sprawdzenia

- SQL, TypeScript, UI, uprawnienia i wyścigi **nie zostały wykonane ani zaliczone**.
  Odczyt kodu nie jest dowodem działania i nie daje gotowości produkcyjnej.
- Wspólny lock jest celowo prosty dla jednej grupy; przy dużej liczbie operacji
  serializuje również odczyty API. Trzeba zmierzyć czas odtwarzania starej historii
  i zapytań ledger/FIFO. Odtwarzanie historycznej liczby zapisanych korzysta ze
  snapshotów i może być kosztowne przy bardzo dużej historii.
- Ledger jest bigint, a klient używa JS number. Pojedyncze kwoty mieszczą się
  dokładnie; teoretyczne sumy ponad Number.MAX_SAFE_INTEGER wymagałyby osobnego
  kontraktu tekstowego/BigInt. Nie zakładać nieskończonego zakresu salda.
- Granica końca to planowany koniec wydarzenia, nie nowy automatyczny stan
  „zakończony”. Administrator potwierdza, że można rozliczyć. Brak Realtime;
  nieaktualny ekran trzeba odświeżyć, decyzję ostatecznie podejmuje serwer.
- Rozstrzygnięcie nieznanego wyniku może zakończyć niezaksięgowane żądanie, zamiast
  je odtworzyć, gdy po restarcie nie ma już danych formularza. Usunięcie wszystkich
  danych aplikacji usuwa również UUID; przed ponowną rejestracją trzeba sprawdzić
  historię. Nowa wpłata z nowym UUID jest odrębną operacją — bez bankowej referencji
  system nie rozpoznaje, czy administrator drugi raz opisuje ten sam przelew.
- Po zatwierdzeniu zmiana kosztu/zwolnienia redystrybuuje cały koszt; może zmienić
  salda innych osób oraz blokadę. UI o tym informuje, a rewizje zachowują różnice.
- Odwołanie zatwierdzonego meczu zostawia wpłatę jako kredyt, nie wykonuje zwrotu
  pieniędzy przez bank. Korektę otrzymanej wpłaty trzeba osobno udokumentować.
- Dotychczasowe skrypty zdalnych testów events usuwają fixture'y przez DELETE.
  Po wprowadzeniu nieusuwalnej historii nie należy uruchamiać ich bez adaptacji.
  Nowy skrypt SQL korzysta z lokalnej transakcji zakończonej ROLLBACK.

## Plan wieczornej weryfikacji na komputerze

Wszystkie poniższe kroki są **do wykonania później**, nie wynikami tego zadania.

1. Zachować stan pracy, wybrać `feat/settlements`, obejrzeć diff wobec
   `origin/feat/events` i potwierdzić trzy nowe migracje. Przygotować **jednorazowy
   lokalny Supabase** z wcześniejszymi migracjami i sztucznymi kontami. Nie używać
   zdalnego `db push`, rzeczywistego administratora ani prawdziwych danych wpłat.
2. Na komputerze uruchomić lokalne usługi Supabase, zastosować migracje wyłącznie
   do tej lokalnej instancji, skonfigurować istniejącą Edge `accounts` na lokalny
   Auth/PostgREST, a `VITE_SLM_FUNCTION_URL` na lokalną funkcję. Klucz service_role
   zostaje tylko po stronie funkcji, nigdy w VITE ani repozytorium.
3. W `app/` wykonać `npm ci`, `npm run lint`, `npm run build`,
   `npm run test.unit -- --run`. Nowe testy hooka sprawdzają nieznany wynik,
   ponowienie po restarcie, szybkie podwójne kliknięcie, błąd odczytu po zapisie
   i konflikt wersji. Testy handlera używają kontrolowanego RPC, nie prawdziwej bazy.
4. Uruchomić przygotowany `app/supabase/tests/settlements.sql` **tylko lokalnym
   psql**, z `ON_ERROR_STOP=1`, na powyższej jednorazowej bazie. Sprawdza podział
   groszy, udział gościa, rezygnacje 10→9 i 11→10, zastępstwo, brak zwolnienia przez
   nieobecność, korekty i nieusuwalność, FIFO, częściową wpłatę, odblokowanie,
   podwójny ledger wpłaty oraz granty. Kończy się ROLLBACK. Nie sprawdza żywych
   JWT, podpisu Auth, akceptacji przez RPC ani prawdziwej równoczesności.
5. Uruchomić lokalny klient Vite i `npm run test.e2e` przy działającym serwerze.
   Zaktualizowany test wydarzeń sprawdza nowy komunikat; nowe testy rozliczeń
   sprawdzają saldo/gościa, brak księgowania zgłoszenia i panel zatwierdzenia.
   To kontrolowane odpowiedzi API, nie dowód działania SQL. Poniższy odbiór UI i
   rzeczywiste RPC trzeba przeprowadzić na sztucznych lokalnych kontach.
6. Konto członka: sprawdzić tylko własne saldo/historię, osobne wpisy gości,
   zgłoszenie 0,01 zł, odrzucenie zera/ujemnej/3 miejsc po przecinku, brak zmiany
   salda przed akceptacją oraz odmowę akceptacji, zmiany kosztu i cudzych odczytów.
   Sprawdzić RLS również bezpośrednio tokenami anon i authenticated przez REST.
7. Administrator: koszt 270,01 zł na 10 udziałów, brak płatników, zwolnienie
   gościa, rezygnacje przed/od 17:00 przy 10/11 osobach, dwie rezygnacje i jeden
   zastępca FIFO, powrót rezygnującego i przejście registered→reserve→registered.
   Sprawdzić zimowy/letni offset Warszawy, brak autoawansu, jawne override i obecność
   przed/podczas/po meczu. Granicę czasu testować na lokalnych historycznych
   fixture'ach i pomocniczych funkcjach, bez endpointu manipulującego produkcją.
8. Dwa zakończone mecze: zatwierdzenie dopiero po końcu, odrzucenie powtórzenia,
   częściowa wpłata, nadpłata przed należnościami, akceptacja i odrzucenie zgłoszenia,
   korekta wpłaty do zera, korekta kosztu, zwolnienie po zatwierdzeniu i odwołanie.
   Suma najnowszych pozycji musi równać się kosztowi, ledger musi zgadzać się z
   różnicami rewizji; dwa udziały/goście w jednym meczu nadal liczą jeden mecz.
9. Dwa równoległe okna/żądania RPC: to samo zatwierdzenie, accept/accept,
   accept/reject, korekta starej kwoty, dwóch zastępców, wpłata kontra zapis oraz
   zapis na ostatnie miejsce. Wynik musi odpowiadać jednej kolejności transakcji,
   bez duplikatów i ominięcia blokady. Powtórzyć ten sam request_id/body i zmienione
   body z tym samym ID. Przerwać odpowiedź po zapisie, ponowić, potem zamknąć całą
   aplikację i rozstrzygnąć zapisany UUID. Rozstrzygnąć brak wpisu przed opóźnionym
   pierwotnym żądaniem: spóźnione musi dostać `request_closed` bez księgowania.
10. Android dopiero po pozytywnym odbiorze lokalnego backendu i web: build,
    synchronizacja Capacitor, kompilacja i ręczny odbiór na urządzeniu zgodnie
    z README. Sprawdzić storage UUID, offline/tło i brak chronionych danych bez
    weryfikacji sesji. Zapisać faktyczne wyniki w STATUS.md. Zdalne migracje,
    wdrożenie i scalenie wymagają osobnego zadania/decyzji po weryfikacji.

# Finanse SLM 1.0 — kontrakt i lokalna implementacja

19.10.2026, feat/integration. Zastępuje wcześniejszą koncepcję wspólnego salda.
Implementacja jest zastosowana i testowana WYŁĄCZNIE lokalnie. Nie jest wdrożeniem chmurowym.

## Zatwierdzone i zaimplementowane reguły

- Każda grupa ma niezależny ledger, saldo użytkownika, wpłaty, należności i nadwyżki.
- Główny administrator grupy zarządza jej finansami. Twórca meczu, pozostając członkiem,
  zarządza tylko swoim meczem. Prawo organizowania pozwala tworzyć kolejne mecze.
- Globalny administrator aplikacji nie otrzymuje dostępu finansowego do innych grup.
- Wpłata celowa rozlicza wskazany nowy mecz. Wpłata ogólna rozlicza najstarsze
  należności WYŁĄCZNIE w swojej grupie, według starts_at i UUID meczu.
- Opłata jednego płatnego udziału: U = 100 * ceil(C / (100*n)), kwoty bigint w groszach.
  Przykład 245 zł / 10 udziałów: po 25 zł, nadwyżka naliczona 5 zł.
- Gość jest osobnym udziałem obciążającym zapraszającego. W globalnej kwalifikacji
  mecz liczymy jeden raz dla odpowiedzialnego konta, niezależnie od liczby gości.
- Dwie zatwierdzone, zakończone i nadal nieopłacone należności meczowe ze wszystkich
  grup blokują nowe zapisy na płatne mecze. Bezpłatne pozostają dostępne.
  Inna grupa otrzymuje tylko wynik dopuszczenia, bez szczegółów cudzych długów.
- Zgłoszenie wpłaty jest pending i nie jest gotówką. Zatwierdzenie dodaje jeden wpis.
- Nadwyżka naliczona = max(0, suma należności - koszt).
  Otrzymana = max(0, suma pokrycia należności przypisana do meczu - koszt).
  Pokrycie jest ograniczone do należności; nadpłata nie zwiększa nadwyżki grupy.
  Jest to zastosowana definicja cost-first, wymagająca również odbioru biznesowego.
- Nadwyżki widzi wyłącznie główny administrator grupy. Nie są automatycznie wydawane.
- Korekty i zwroty tworzą delty oraz audyt z powodem. Oryginalnej kwoty wpłaty,
  grupy, meczu i odpowiedzialnego konta nie można przepisać. Anulowanie zatwierdzonego
  meczu odwraca należności i projekcje; nie udaje rzeczywistego zwrotu gotówki.
- Obecność i obowiązek finansowy pozostają odrębne. Korekta obecności po zatwierdzeniu
  wymaga powodu. FIFO późnych rezygnacji używa trwałej kolejności historii serwera.

## Rzeczywiste kontrakty

Wszystkie operacje przechodzą przez POST accounts, zweryfikowany Auth/session_id,
security_version i obowiązkową zmianę hasła. Role nigdy nie pochodzą z body/metadata.
Uprzywilejowane RPC mają EXECUTE tylko dla service_role.

| Action | RPC / zasób | Dostęp |
|---|---|---|
| finance_groups | slm_finance_groups | własne grupy i zachowana własna historia |
| group_finance_account | slm_group_finance_dispatch(account) | własne finanse grupy; admin grupy także wskazanego użytkownika |
| group_finance_detail / pending | ten sam dispatcher | admin grupy lub twórca wskazanego meczu; organizator bez danych innych meczów |
| group_finance_submit_payment | submit_payment | własne zgłoszenie, bez księgowania |
| group_finance_record_payment | record_payment | admin grupy lub twórca konkretnego meczu; bez ogólnych wpłat organizatora |
| group_finance_accept_payment / reject_payment | decyzja z rzeczywistego rekordu wpłaty | zgodność group_id/event_id i aktualny scope |
| group_finance_correct_payment | korekta z expected_amount_cents | uprawniony scope, powód i nowa delta |
| group_finance_approve / cost / charge / attendance | decyzje z expected_version | uprawniony mecz, audyt, kontrola końca meczu |
| matches_join / reserve / guest / move_guest | slm_matches_dispatch | atomowy limit i globalna kwalifikacja odpowiedzialnego konta |

Każdy zapis ma request_id UUID. Ten sam identyfikator i body zwracają ten sam wynik;
inny payload jest konfliktem. Edge przekazuje wyłącznie dozwolone pola, bez haseł
w tabelach żądań. Wspólna transakcyjna blokada advisory porządkuje zapisy i finanse.
RLS chroni tabele; DTO dodatkowo ogranicza kolumny. Historia, ledger i audyt są niezmienne.

## Zgodność historyczna i ograniczenia

Stare tabele i kwoty pozostają bez przeliczania. slm_legacy_scope przypisuje starą
jednogrupową historię do jednej grupy, jeśli istnieje dokładnie jeden dawny administrator.
Brak jednoznacznego właściciela powoduje przerwanie migracji z
legacy_group_owner_decision_required; nie zgadujemy przypisania.
Nowe projekcje uwzględniają historyczne zaległości bez ponownego księgowania.
Nowa ogólna wpłata do tej grupy pokrywa także stare zaległości przez FIFO.

Stare identyfikatory meczów NIE są nowymi slm_matches. Ich należności mają legacy=true.
Wpłata celowa v2 na taki stary identyfikator nie jest dostępna; UI jawnie kieruje do
ogólnej wpłaty FIFO. Nie wykonano konwersji starych wydarzeń ani zmiany ich polityki.
Widok historyczny zachowuje stare API; nie pozwala tworzyć kolejnych meczów bez grupy.
Historyczne uprawnienia i RLS finansów są ograniczone do przypisanej grupy, a zapis
historycznym API nie omija globalnej kwalifikacji.

Migracje lokalne nie są zgodą na rollout. Przed chmurą: kopia, inwentaryzacja kont,
jednoznaczny właściciel starej grupy, uzgodnienie starej historii migracji (trzy wcześniejsze
naprawy bootstrapu), porównanie każdej pozycji oraz plan wycofania odczytów bez kasowania
nowych wpisów. Nie wykonywano db push/link/deploy.

## Faktyczne testy

SQL v2: 55 PASS, w tym separacja grup, organizator, globalny admin bez uprawnień,
blokada dwóch grup i darmowy mecz, rounding, pending/cash, korekty/zwroty/anulowanie,
wyścigi decyzji i korekt, idempotencja, FIFO rezygnacji, ostatnie miejsce,
atomowa skrzynka i kolejka oraz rollback finansów przy awarii powiadomienia.
Replay 29 migracji z fikcyjną starą historią: 9 PASS, także spłata starego długu
nowym FIFO bez zmiany oryginalnego ledgera. Pełne wyniki: ODPOWIEDZI_CODEX.txt.

Ochrona przed nadużyciami: obustronna zgoda na członkostwo, brak przypisywania obcego
konta do publicznego meczu przez organizatora, rozpoczęcie/zakończenie według serwera,
audyt i wersjonowanie. Administrator zaakceptowanej grupy pozostaje zaufaną rolą do
korekt w tej grupie; audyt nie jest mechanizmem automatycznego rozstrzygania sporów.

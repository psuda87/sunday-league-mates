# Public Match Discovery — odbiór backendu42

2026-11-02, Europe/Warsaw. **PASS odbioru backendu w lokalnej izolowanej fixture; WARN poza tym zakresem.** Po poleceniu właściciela uruchomiono Docker Desktop i wznowiono wcześniej zablokowane testy. To rzeczywiste wyniki Windows + Docker Linux containers, nie Cloud Codex ani GitHub-hosted PASS. Nie wykonywano merge, deployu, migracji istniejących baz ani Supabase Cloud.

## Baza i powtarzalność

- Gałąź raportu `test/public-discovery-backend42-acceptance` pochodzi bezpośrednio z **e246c514af0fbca79dee892d9aa0e31b937a83c3**, HEAD Stage2C. Historia i wszystkie piny pozostają zachowane.
- Przeczytano lokalny `PUBLIC_MATCH_DISCOVERY_STAGE2C_FINAL_REVIEW.md` oraz istniejące raporty i testy discovery. Dawne wyniki nie są doliczane do tego odbioru.
- Istniejące lokalne runnery nie dopuszczają nazwy gałęzi2C. Wykorzystano rzeczywisty, czysty worktree `feat/public-match-discovery-stage2b` przy **fd4fccdc1c22caa5f217625809689f336139a122**, po potwierdzeniu `git diff --exit-code e246c514af0fbca79dee892d9aa0e31b937a83c3 -- app/supabase`. Cały kanoniczny backend jest identyczny. Nie zmieniano nazw gałęzi, guardów ani zmiennych GitHub.
- Backend/migracja42 pozostają przypięte do **24a59e104bfe80b4d2f41cbd0ad02b58fc546040**. Nie zmieniono runtime ae2fd95, implementacji CI d7b36ee, pointera cb63962 ani manifestu Premium55.
- Docker29.8.2, Windows/PowerShell, Python3.14 z `-X utf8 -B`. Wykorzystano istniejące cztery obrazy z dokładnymi digestami zapisanymi w runnerze; bez pobierania nowych obrazów i nowej infrastruktury/compose.

W istniejącym czystym worktree Stage2B:

```powershell
python -X utf8 -B app/scripts/test-public-discovery-local.py
```

W worktree gałęzi raportu, wskazując powyższy prawdziwy checkout Stage2B:

```powershell
python -X utf8 -B docs/review/backend42_http_acceptance.py --fixture-repo 'I:\slm\sunday-league-mates\.worktrees\public-match-discovery-stage2b'
```

Druga komenda dodaje callback HTTP do istniejącego, **niezmienionego** `test-lineups-edge-local.py`. Nie zastępuje jego Auth/API/fixture, nie podmienia katalogów źródeł i wykonuje również końcowe testy leave/revoke oryginalnego runnera. Dodatkowy plik jest sterownikiem testów w docs/review, nie modułem aplikacji lub alternatywną infrastrukturą. Przy odtwarzaniu tworzy kolejną nową fixture — nie uruchamiać wielokrotnie bez potrzeby.

## Faktycznie wykonane testy

| Zakres | Wynik tej sesji |
|---|---|
| SQL/RLS, odtworzenie dokładnie42 migracji, odmowa niezgodności i atomowość | **PASS52** istniejącego runnera; PostgreSQL rzeczywisty, Auth/Storage w tej warstwie to fixture SQL |
| Rzeczywisty GoTrue → accounts Edge → PostgREST → PostgreSQL | **PASS44**: 31 dodatkowych kontroli discovery/bezpieczeństwa +13 istniejących kontroli core |
| Canonical sources/42 migracje | **PASS**, dodatkowo42 odtworzone na rzeczywistym schemacie GoTrue w HTTP suite |
| Izolacja i zakończenie fixture | **PASS**, wszystkie10 nowych kontenerów obu prób SQL/HTTP zatrzymane i zachowane; brak opublikowanych portów |
| GitHub-hosted, aktywacja Actions, Cloud | **NOT RUN**, nie podejmowano tych operacji |

**52 i44 to liczniki asercji runnerów, nie liczba wszystkich wysłanych żądań HTTP.** Bezpieczny wyciąg rzeczywistych wyników zapisano w `docs/review/backend42_acceptance_results.txt`. Surowe lokalne logi pozostają ignorowane; nie publikowano tokenów, haseł, konfiguracji kontenerów ani odpowiedzi zawierających dane kont.

Potwierdzone zachowania:

- Prywatne UUID/nazwy obcych grup nie pojawiają się w wynikach ani wyszukiwaniu. Znajomość UUID nie otwiera szczegółów. Sprawdzono także bezpośredni PostgREST/RPC i istniejące ACL/RLS, nie tylko filtrowanie odpowiedzi Edge.
- Własne grupy, publiczne mecze, osoba bez grup oraz scope all/groups/public/mine/group; filtrowanie prywatności **przed** paginacją.120 wcześniejszych pasujących prywatnych rekordów nie wypiera105 publicznych: strony100+5, bez duplikatów, poprawne has_more/next_offset.
- Unicode/polskie znaki, dosłowne `%`/`_`/nawiasy, SQL-like tekst, pusty query, walidacja limitu długości, scope/type/offset. Klient nie zwiększa strony dodatkowym parametrem limit.
- Samo wyszukiwanie nie tworzy członkostwa ani dostępu do prywatnego meczu, cudzych finansów lub składów. SQL obejmuje też istniejącą izolację outsidera i zamknięcie publicznego meczu.
- Po dobrowolnym leave oraz odebraniu członkostwa przez admina prywatne wyniki i szczegóły znikają bez ponownego logowania. Osobno potwierdzono ważny token GoTrue po leave oraz odmowę aplikacji po usunięciu wyłącznie syntetycznej sesji aplikacyjnej w nowej fixture.
- Rzeczywisty logout blokuje ponowne wyszukiwanie starym tokenem; dodatkowe konto bez grup przechodzi rzeczywisty login i discovery.
- Negatywny token z podpisanymi, rzeczywistymi claimami GoTrue i przeszłym exp jest odrzucany: GoTrue **403 z przyczyną expiry**, accounts Edge **401**. Oryginalna ważna sesja nadal działa. To podpisana fixture wygasłego tokena, **nie oczekiwanie godziny na naturalne wygaśnięcie tokena wydanego w teście**.
- Core HTTP zachowuje zapis A/B i gości, uprawnienia członka, wersję/autora przy no-op, idempotencję retry, konflikt równoczesnego zapisu200/409, odmowę starego rosteru/obcych ID, trwałość po restarcie oraz końcowe leave/revoke. Nie jest to ponowienie całego modułu finansowego.

## Nieudane pierwsze próby i ich rozstrzygnięcie

1. Pierwszy SQL runner przerwał odczyt historycznego pliku na Windows `UnicodeDecodeError` przy domyślnym cp1252. Ponowienie z Python `-X utf8` dało52PASS. Nie zmieniono SQL/testów ani oczekiwań.
2. Pierwszy HTTP callback dał11 core +22 discovery PASS, potem zatrzymał się na zbyt wąskim oczekiwaniu **401** bezpośrednio z GoTrue. Faktyczny GoTrue zwraca **403** dla wygasłego tokena. Skorygowano wyłącznie nowy sterownik: wymaga401/403 **oraz jawnego powodu expiry**; Edge nadal musi zwrócić401. Całość ponowiono w nowej fixture:44PASS, wraz z końcowymi testami core. Pierwszej częściowej próby nie sumujemy do finalnego PASS.

## Izolacja i zasoby

Uruchomienie Docker Desktop na polecenie użytkownika wznowiło także zastane kontenery zgodnie z ich konfiguracją. Nie nazywamy ich nową fixture i nie zatrzymywano/usuwano ich w ramach tego zadania. Nie wysyłano do istniejących baz zapytań/migracji testowych; backend telefonu/slm-main-stabilization nie był celem testów.

Wyłącznie nowe zasoby tej sesji:

- SQL pierwsza próba: `slm-public-discovery-995901c822b6`.
- SQL PASS: `slm-public-discovery-589116290d1d`.
- HTTP częściowy: `slm-lineups-edge-78bc0c899932` oraz jego `-auth`, `-rest`, `-edge`.
- HTTP finalny PASS: `slm-lineups-edge-33add891f202` oraz jego `-auth`, `-rest`, `-edge`.

Potwierdzono `State.Status=exited` i `PortBindings={}` wszystkich10. PostgreSQL ma `NetworkMode=none`; trzy usługi HTTP współdzielą tylko namespace własnej fixture. Niczego nie usuwano, w szczególności wolumenów. Nowe syntetyczne konta/hasła powstawały wyłącznie w tych fixture; istniejące konta i sekrety pozostały nietknięte.

## NOT RUN, ryzyka i warunki integracji

- Chromium/UI: zmiana konta w kliencie, opóźnione odpowiedzi, zmiana scope/query, czyszczenie ekranu po logout, powrót z tła, stary backend bez markera — **NOT RUN w tym odbiorze backendu**. Testy HTTP nie dowodzą zachowania React ani akceptacji wyglądu Premium.
- Naturalne godzinne wygaśnięcie wydanego tokena i refresh lifecycle — **NOT RUN**; wykonany negatywny test expiry opisano wyżej.
- Kong/Storage/Android/POCO, pełna regresja finansów i zapisów, obciążenie/globalny advisory lock — **NOT RUN**. Offset nie daje snapshotu przy równoczesnych zmianach zbioru. Nie wykryto błędu wymagającego zmian backendu/pinów.
- Bieżący Linux test symlink SourceTests z poprzedniego review pozostaje osobną granicą środowiska; uruchomienie kontenerów Linux nie oznacza wykonania tego testu. Build/lint/TS/Vitest nie powtarzano bez zmian aplikacji.
- **Rekomendacja: odbiór backendu42 zaliczony w opisanej izolacji.** Właściciel nadal zatwierdza integrację i granice niewykonanych testów. Zachować oryginalne ancestry Stage2C i wymagane obiekty Git/piny; bez squash/rebase. Po zmianie bazy ponowić source gate. To nie zgoda na wdrożenie42 do istniejącej bazy/Cloud — wymaga odrębnej kontroli różnic, backupu i decyzji.

Zakres commita: raport, odtwarzalny callback testowy, bezpieczny wyciąg wyników i notatki STATUS/ODPOWIEDZI_CODEX. Brak zmian `app/`, workflowów lub zabezpieczeń. SHA finalnego commita należy odczytać z HEAD gałęzi raportu; nie osadzamy samoodnoszącego hasha w jego treści. Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

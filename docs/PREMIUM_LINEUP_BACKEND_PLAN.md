# Aktualizacja Stage 2A — 2026-10-29 14:30 Europe/Warsaw

Backend poniższego historycznego projektu został zaimplementowany w `feat/premium-lineups-stage2a` od7ad5c75. Nowa migracja `20261029140000_match_lineups.sql`, akcje accounts `lineups_get/lineups_save`, usługowy dispatcher, CAS/idempotencja, aktualna projekcja autora. Pełny bieżący kontrakt i testy: [PREMIUM_LINEUPS_STAGE2A.md](PREMIUM_LINEUPS_STAGE2A.md).

Doprecyzowania względem projektu: `roster_version` jest tokenem SHA256 z wersji wydarzenia i posortowanych registered IDs; arrays oznaczają zbiory, nie pozycje na boisku. GET jawnie raportuje stale_entry_ids; zapis przyjmuje tylko aktualne wpisy. Replay zwraca pierwotny receipt z nazwą autora wyliczoną na nowo, a nie aktualny skład — potem wymagany GET. Nowe zapisy odwołanego/zakończonego meczu są zamknięte, historia pozostaje do odczytu członkom. Stage1 niezmieniony, przycisk Zapisz nadal disabled; podłączenie do API należy wyłącznie do osobno zatwierdzonego Stage2B.

---

## Historyczny projekt sprzed Stage 2A

# Trwałe składy — projekt kolejnego etapu, NIE WDROŻONO

Obecny backend nie ma tabeli/RPC trwałych składów. Demo przechowuje `game.lineup` wyłącznie w World; kopiowanie tego reducera nie tworzy serwerowego zapisu. Zakres wymaga nowej tabeli, walidacji uczestników, CAS, projekcji autora, uprawnień i HTTP testów równoległości, dlatego zgodnie z poleceniem oddzielono go przed implementacją. Poniżej konkretny minimalny projekt; nie jest migracją wykonywaną w tym PR.

## Minimalna migracja — projekt

```sql
-- Projekt do osobnej wersjonowanej migracji, nie uruchamiać ręcznie.
create table public.slm_match_lineups (
 event_id uuid primary key references public.slm_matches(id),
 version bigint not null check(version >= 1),
 team_a uuid[] not null default '{}',
 team_b uuid[] not null default '{}',
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default clock_timestamp(),
 check (not (team_a && team_b))
);
alter table public.slm_match_lineups enable row level security;
revoke all on public.slm_match_lineups from public,anon,authenticated;
-- Brak bezpośrednich client INSERT/UPDATE/SELECT. Istniejący model API/RLS
-- używa serwerowego service_role z jawnie zweryfikowaną sesją i scope.
```

Bez nowych grantów klientom i bez SecurityDefiner w public. Serwerowy zapis przez prywatną funkcję SECURITY INVOKER, pusty search_path, pełne kwalifikacje. Publiczny dispatcher z EXECUTE wyłącznie service_role, zgodnie z obecną architekturą. RLS bez polityk klienckich pozostaje deny-by-default. Jeśli później potrzebny bezpośredni odczyt/Reatime, wymaga osobnej polityki i testów; nie zakładać, że aktualny publiczny roster upoważnia do dowolnych danych autora.

`team_a/team_b` zawierają **UUID wpisów uczestników**, nie user_id — uwzględniają gości bez kont. RPC sprawdza: brak null/duplikatów/wspólnych ID, każdy wpis z tego samego meczu, status registered; limit payloadu do rzeczywistego limitu wydarzenia. Rezerwa/wycofani nigdy nie są utrwalanym składem. Nie trzeba dodawać algorytmu losowania.

## RPC/DTO i kontrola wersji

- `lineups_get(event_id)` → `event_id`, `version` (0 bez rekordu), `roster_version` (wersja wydarzenia), `team_a/team_b`, `unassigned`, `last_change:null|{display_name,changed_at}`. Brak INSERT przy samym GET. Na początek odczyt i zapis tylko dla aktywnego członka grupy; poza grupą brak cudzych składów. Poszerzanie widoczności to osobna decyzja.
- `lineups_save(event_id,expected_version,expected_roster_version,team_a,team_b,request_id)` — UUID autora/sesji wyłącznie z weryfikowanego kontekstu Edge, nigdy z body. Aktywny członek może zapisać niezależnie od organizer/admin, bez nadawania mu uprawnień finansowych.
- Transakcja blokuje wiersz wydarzenia `FOR UPDATE` (ta sama kolejność co istniejące zapisy), ponownie sprawdza członkostwo/aktywną sesję i pobiera aktualny roster; następnie blokuje lineup. W przypadku braku wiersza serializuje utworzenie na zablokowanym wydarzeniu.
- Najpierw sprawdza zachowany idempotency request; zmieniony payload z tym samym request_id → konflikt. Hasła i tokeny nigdy nie trafiają do ledgera. Następnie porównuje expected_version/roster_version; konflikt →409 i aktualny bezpieczny snapshot, **bez nadpisania**.
- Porównanie z kanonicznym bieżącym podziałem: niezmieniony payload → zwrot istniejącej wersji i autora/czasu bez UPDATE. Brak wiersza + pusty podział → wersja0, autor null, bez INSERT. Dopiero faktyczna zmiana aktualizuje version+1/updated_by/updated_at (czas serwera).
- Zmiana rosteru w czasie edycji wymusza konflikt, a nie ciche usunięcie przypisań. GET może pokazać nieaktywny wpis jako nieaktualny szkic do poprawy, lecz UI nie umieszcza go na boisku; zapis wymaga aktualnych registered IDs.
- `updated_by` przechowuje UUID; nazwa autora jest wyliczana przy odczycie istniejącą projekcją grupy zgodną z PR16. Nie utrwalać nazwiska/telefonu w snapshotach. Po wyjściu autora z grupy stosować bezpieczny publiczny pseudonim, bez obchodzenia zgód.

## Frontend kolejnego etapu

Osobno `baseline` pobrany z API oraz `draft` i expected versions. Używać tego samego PremiumPitch i wyboru dwóch znaczników. „Cofnij zmiany” kopiuje baseline, czyści wybranego zawodnika i nie wywołuje RPC. „Zapisz” aktywny tylko dla dirty i aktualnego uprawnionego członka. Po poprawnym zapisie dopiero readback nowej wersji aktualizuje baseline i etykietę „Ostatnia zmiana: …”. Przy409 zachować szkic i wyświetlić wybór ponownego pobrania/ręcznego pogodzenia — brak automatycznego retry nadpisującego cudze dane.

Obecnie brak pobranego serwerowego baseline, więc lokalne cofnięcie przywraca brak zapisanego podziału. UI jawnie wyłącza zapis i nie podaje fikcyjnego autora/czasu. To nie jest implementacja opisanej wyżej trwałości.

## Testy następnego etapu — projekt, NOT RUN

1. Aktywny zwykły członek zapisuje; obcy, były członek, nieaktywny, publiczny outsider i sfałszowany owner odrzuceni. Brak nowych ról finansowych.
2. GET pustego meczu niczego nie tworzy; zapis pustego/niezmienionego/cofniętego szkicu nie zmienia wersji/autora/czasu.
3. Poprawny zapis A/B i gościa → restart/odczyt na drugim koncie potwierdza podział i autora.
4. Duplikat UUID, rezerwa/withdrawn, wpis z innego eventu, za duża paczka → rollback całości.
5. Dwa rzeczywiste równoległe HTTP zapisy tej samej wersji od dwóch osób: dokładnie1 sukces,1 konflikt, bez lost update; drugi autor nie nadpisuje pierwszego.
6. Przeniesienie/wycofanie uczestnika równolegle z zapisem →409 roster_version albo jednoznaczna serializacja, bez nieaktywnych znaczników.
7. Ten sam request_id/payload po utracie odpowiedzi zwraca ten sam wynik bez nowej wersji/czasu; inny payload z tym UUID odrzucony.
8. Ponowne sprawdzenie sesji/wyjście z grupy w trakcie edycji uniemożliwia zapis. Bezpośredni REST/RPC nie omija RLS/ACL.
9. PR16: autor/numery/zdjęcia/nazwiska nie ujawniają dodatkowych prywatnych danych; telefon nigdy w lineup DTO.
10. 320/360/390 ×Light/Dark, sticky/BottomNav, keyboard/back na fizycznym Androidzie oraz offline bez udawanego sukcesu.

Bez migracji do istniejącego lokalnego stacku i Cloud, bez resetów. Implementację tego etapu należy zatwierdzić i wykonać oddzielnie; aktualny PR zawiera wyłącznie ten projekt.

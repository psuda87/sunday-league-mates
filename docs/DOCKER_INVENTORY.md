# Bieżący stan po porządkach i uruchomieniu LIVE

30.10.2026: **162→48 kontenerów; 140→6 działających; usunięto114** wyłącznie rozpoznanych odtwarzalnych usług testowych SLM. Wszystkie31 kontenerów PostgreSQL,65 wolumenów,14 obrazów i15 nazw sieci zachowane.42 historyczne kontenery baz/mail/log pozostają zatrzymane. Nie usunięto plików bucketów Storage, cache, snippets, źródeł ani konfiguracji. Wszystkie ID sieci SLM bez zmian; ID systemowego bridge zmieniło się poza poleceniami tego zadania, przyczyna nieustalona.

Działa jeden istniejący stos `slm-main-stabilization`, sześć usług, API55321,41 migracji. Domyślny helper cleanup tylko planuje; rozpoznaje projekty przez allowlistę/etykiety/config/repo i blokuje współdzieloną sieć z nieznanym aktywnym kontenerem. Obecny plan:0 usuwań/42 zachowania/0 nieznanych. Bez prune, kasowania wolumenów/baz, nowych kontenerów ani zmian Cloud. Prywatne archiwa istnieją pod ignorowanym `.cache/live-backend`, ACL właściciela.

[Pełna lista ID, powodów i kontroli](docker/local-live-cleanup-2026-10-29.json), [uruchomienie backendu](LOCAL_LIVE_BACKEND.md). Poniżej historyczna inwentaryzacja wcześniejszego zadania; jej liczby nie opisują już aktualnego stanu.

---
# Docker — inwentaryzacja i ograniczone porządki SLM

2026-10-29, Europe/Warsaw. Lokalny Docker Desktop, odczyt wszystkich projektów widocznych w bieżącym silniku. Bez Cloud, uruchamiania backendów, resetu lub ingerencji w inne repozytoria. Gałąź `chore/android-studio-workflow` od Stage2B/58a9bab.

| Zasób | Przed | Po |
|---|---:|---:|
| Kontenery | **163** | **162** |
| Uruchomione | **140** | **140** |
| Zatrzymane | 23 | 22 |
| Obrazy | 14 | 14 |
| Wolumeny | **65** | **65** |
| Sieci | **15** | **15** |

Ponowne porównanie pełnych ID potwierdziło: zmienił się tylko zbiór kontenerów o jeden opisany niżej ID; zestawy obrazów, nazw wolumenów i sieci oraz zbiór uruchomionych kontenerów pozostały identyczne. Nie zatrzymano żadnego działającego kontenera. Stan bieżący różni się od wcześniejszego audytu, kiedy fixtures były zatrzymane — w tym zadaniu wiele z nich faktycznie już działało. Nie zakładano ich stanu na podstawie raportu.

## Zakres odczytu i kompletne dane

Wykonano odpowiedniki `docker ps -a` (wszystkie ID + inspect każdego), `docker images --no-trunc --digests`, `docker volume ls` + inspect wszystkich65, `docker network ls` + inspect wszystkich15 oraz **docker system df -v** przed i po. Rejestrowano obrazy, daty, stan, projekt z etykiet, porty, mounty/RW, zależności network namespace/volumes_from/links i użycie wolumenów/sieci. Nie odczytywano Env/Cmd, logów usług, zawartości baz lub kont użytkowników.

- [Pełna inwentaryzacja JSON](docker/inventory-2026-10-29.json): wszystkie163 pozycje przed, pełne ID, klasy, decyzje i obecność po operacji; obrazy i ich użytkownicy;65 wolumenów z mountpoint/użytkownikami;15 sieci z przyłączonymi kontenerami; zapis usunięcia i dowody.
- [docker system df -v przed](docker/system-df-before-2026-10-29.txt).
- [docker system df -v po](docker/system-df-after-2026-10-29.txt).
- Powtarzalny skrypt **tylko do odczytu**: `python -X utf8 app/scripts/docker-inventory.py --output .cache/docker-inventory/current.json`. Wymaga lokalnego socketu npipe/unix, odrzuca zdalny kontekst; nie ma opcji usuwania. Zapisuje JSON i sąsiedni plik .df.txt, nie uruchamia Docker Desktop. Brak działającego silnika to błąd odczytu, nie powód automatycznego startu.

## Klasyfikacja kontenerów

| Klasa | Przed | Po | Ocena |
|---|---:|---:|---|
| A — aktywne stosy do zachowania | 82 | 82 | Istniejące lokalne stosy SLM. Zachować ich dane i działające usługi. Nie stwierdzamy, że wszystkie są potrzebne teraz; ich wyłączenie lub redukcja wymaga decyzji właściciela. |
| B — zatrzymane do zachowania | 22 | 22 | Edge istniejących projektów i poprzednie konfiguracje GoTrue/baseline. Nie dowiedziono zbędności lub bezpiecznej odtwarzalności ich konfiguracji. Sam stan exited nie upoważnia do usunięcia. |
| C — fixtures/pozostałości testów SLM | 58 | 57 | Rozpoznane etykiety runnerów i sufiksy REST; tylko jeden zatrzymany sidecar spełnił wszystkie warunki. Pozostałe57 działało i pozostawiono je. Bazy oraz ich wolumeny zachowane. |
| D — niepewne/inne | 1 | 1 | `supabase_auth_slm-pr16-review_missing_metadata`, ID f4d9c81cbdbb93c0edc183ad38319552cd83c94f0f014763cf9a42804984e4f1, running, bez etykiet projektu. Nazwa sugeruje SLM, ale własność/konfiguracja niepotwierdzone. Bez zmian. |

Wszystkie zasoby są **niepotrzebne do samego przygotowania UI/Studio**. To nie jest równoznaczne z ich zbędnością dla LIVE, historii testów lub innych sesji właściciela. Nie wykonywano regresji backendu podczas tego zadania.

| Rozpoznany projekt/runner | Kontenery przed |
|---|---:|
| lineups-stage2a, w tym3 sidecary REST | 6 |
| lineups-edge-stage2a, także UI2B/audyt | 50 |
| premium-finance-stage2 SQL fixtures | 2 |
| slm-main-stabilization | 6 |
| slm-premium-behavior-review | 5 |
| slm-premium-real-finance | 13 |
| slm-premium-real-events | 13 |
| slm-online-readiness | 8 |
| slm-account-mail | 8 |
| slm-email-regression | 8 |
| slm-account-final | 7 |
| slm-account-candidate | 7 |
| slm-account-foundation | 7 |
| slm-pr16-review | 8 |
| sunday-league-mates, także historyczny http-edge | 14 |
| Niepotwierdzony missing_metadata | 1 |

Przejrzano też zasoby spoza etykiet obecnego projektu. Nie potwierdzono tu odrębnego niespokrewnionego projektu; pozycja D pozostaje niepewna. Nie podjęto działań na podstawie samej nazwy SLM. Sieci bridge/host/none są współdzieloną infrastrukturą silnika, nie śmieciami tego repozytorium.

## Usunięto dokładnie jeden kontener

```text
Nazwa: slm-lineups-stage2a-58f8de471a97-rest
ID: 20f425db10e25bd49ca559df527cbccdb3100a7da4a04b479528da0de409805a
Obraz: postgrest/postgrest@sha256:5f4ce744539bbba786b4e24dbbd95bdb2a956dcf568c5374995a0ff4a68f5bd2
Stan przed: exited
Utworzony: 2026-10-29T18:01:37.294289986Z
Mounty: brak
Porty publikowane: brak
docker diff: pusty
Zależne kontenery (network namespace/volumes_from/links): brak
SizeRw: 4096 B
Polecenie: docker rm FULL_ID — bez -f, bez -v
```

To stateless PostgREST z zakończonego audytowego runnera `app/scripts/test-lineups-local.py`. Źródło potwierdza nazwę rodzica z losowym ID, sufiks-rest, przypięty obraz i brak trwałych zapisów w kontenerze REST; dane fixture trafiają do **oddzielnego PostgreSQL**, który zachowano z całym wolumenem. Runner tworzy wyłącznie generowane testowe tożsamości. Sprawdzono brak mountów, zmian warstwy plikowej i użytkowników tego kontenera; sprawdzenia po pełnym ID powtórzono bezpośrednio przed usunięciem. ID i przyczynę zapisano lokalnie przed usunięciem, następnie w dołączonym raporcie. Docker potwierdził usunięcie. Nie używano force i nie odtwarzano/usuwano jego rodzica.

**Odzyskane miejsce:** nie przypisujemy sobie17MB współdzielonego obrazu — obraz pozostał. Zarejestrowane SizeRw wynosiło4096B; dokładnego odzysku fizycznego nie da się wiarygodnie wyliczyć z globalnego df przy140 aktywnych kontenerach. Oba pomiary df są załączone; nie deklarujemy odzyskania GB.

## Zachowane i wymagające decyzji właściciela

- **57 aktywnych fixtures C**, w tym PostgreSQL, GoTrue, Edge i REST po wcześniejszych testach2A/2B/audytu/finansów. Są odtwarzalne jako test, ale obecne polecenie zabrania usuwania aktywnych kontenerów. Nie ustalono, czy inna sesja nadal ich używa; nie zatrzymywano ich w celu obejścia zakazu.
- **82 aktywne usługi A i22 zatrzymane B**: istniejące projekty Supabase, ich bazy, mounty, Edge i poprzednie konfiguracje Auth. To nie automatyczne cele cleanup. Eksperymentalne Auth18 pozostają osobno, bez aktywacji lub przenoszenia do bieżącego modułu.
- **Kontener D**: właściciel musi wyjaśnić przeznaczenie missing_metadata przed ewentualną zmianą.
- **Wszystkie65 wolumenów**:54 mają referencje kontenerów;11 nie ma referencji w aktualnym snapshotcie. Te11 otrzymały D, nie ocenę „puste”. Mogą zawierać zachowane bazy/dane po wcześniejszych kontenerach. Nie odczytywano zawartości ani nie usuwano żadnego.
- **Wszystkie14 obrazów** są używane przez co najmniej jeden zachowany kontener; obrazy również służą odtwarzaniu testów offline. Nie usuwano ich warstw.
- **Wszystkie15 sieci**:12 sieci projektów Supabase i3 systemowe. Zachowane; nie usuwano sieci współdzielonych.

Nie wykonano system prune, image prune, volume prune, compose down -v, supabase db reset, usuwania baz lub zmian Cloud. Nie instalowano narzędzi i nie modyfikowano innych repozytoriów. Docker Desktop pozostawiono uruchomiony, bo140 kontenerów już pracowało; nie zweryfikowano wyłączności ich użycia przez to zadanie.

## Wniosek dla codziennej pracy

Test wyglądu: `npm run android:ui` → android:check → świadomy Run właściciela w Android Studio. **Nie uruchamiać backendu/Dockera do UI.** LIVE/backend to osobno wybrany i sprawdzony stos; obecne historyczne stosy nie stają się poprawne przez sam fakt działania. Dalsze sprzątanie aktywnych fixtures lub11 niepodpiętych wolumenów wymaga decyzji właściciela i identyfikacji danych. Instrukcja: [ANDROID_STUDIO_WORKFLOW.md](ANDROID_STUDIO_WORKFLOW.md). Chronologia: `docs/ODPOWIEDZI_CODEX.txt`.

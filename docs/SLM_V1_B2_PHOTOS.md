# SLM 1.0 — B2.2: przygotowanie i blokady

2026-10-24 · feat/slm-v1-live · baza 2d293c8; runtime nadal odebrane B2.1 (6dd7105).
**B2.2 NIE jest ukończone. Upload, usuwanie i zapis numeru NIE zostały aktywowane.**
Zastosowano końcową instrukcję zadania: gdy wymagane są zmiany backendu,
zakończyć bezpieczną część i zgłosić blokadę. Nie zastąpiono WebP starym uploadem JPEG.

## Audyt istniejącego rozwiązania

- slm_player_profiles.jersey_number istnieje, integer/null, CHECK 0–99, bez UNIQUE numeru.
  Obecne accounts/profile nie zwraca numeru; save_profile zapisuje full_name/display_as.
  Starszy save_email_profile podaje p_number:null, więc nie wolno użyć go jako zapisu numeru.
- Lokalny bucket slm-profile-photos: prywatny, limit 2097152 B, dozwolony tylko image/jpeg.
  storage.objects i slm_profile_photos mają aktywne RLS. Brak polityk bezpośredniego
  dostępu do objects. anon/authenticated nie mogą wywołać slm_profile_photo_commit.
- Istnieją metadane user_id/object_path/revision/cleanup_path/updated_at. Wcześniejsze
  profilePhotos.ts używa kontekstu sesji, UUID użytkownika w ścieżce, revision CAS,
  blokady SQL i retry sprzątania. Nie ma potrzeby tworzenia kolejnych tabel/bucketów.
- Aktualny handler akceptuje tylko JPEG, zapisuje .jpg; commit SQL dopuszcza wyłącznie .jpg.
  Wcześniejszy kompresor zapisuje JPEG1024px/.88, a nie wymagany WebP800px/150KB.
  Stary PhotoEditor ma inny modal/toolbar — nie przeniesiono jego UI do frozen3.18.
- Oryginalne formularze numeru i wyboru zdjęcia istnieją w demo. Picker ma wybór,
  podgląd, zatwierdzenie i anulowanie, ale nie ma usunięcia aktualnego zdjęcia.
  Przycisk Anuluj nie może zostać zamieniony w ukrytą operację destrukcyjną.

Audyt obejmował źródła wcześniejszej integracji i wyłącznie metadane istniejącego
lokalnego Dockera. Nie odczytywano prywatnych zdjęć ani rekordów kont.

## Bezpieczna część przygotowana

Nowe src/profile/preparePhoto.ts oraz imageDimensions.ts:
- ponowne wykorzystanie istniejących czytników nagłówków JPEG/PNG/WebP;
- faktyczne dekodowanie przez przeglądarkę, kompresja canvas do WebP;
- max800px, proporcje zachowane z zaokrągleniem do piksela, brak powiększania;
- jakość normalnie .80/.75, kolejne rozdzielczości max800/640/512/400;
  awaryjnie .70/.65 na ostatnim rozmiarze, potem jawny błąd zamiast dalszej degradacji;
- cel do100000B, twardy limit **150000B** (spełnia również limit150KiB).
  Złożone zdjęcie może pozostać między100–150KB dla zachowania jakości/rozdzielczości.
  Nie dopełniamy lekkich obrazów do40KB ani nie zwiększamy małych obrazów;
- sprawdzenie MIME i faktycznego nagłówka WebP oraz wymiarów wyniku;
  PNG fallback nieobsługiwanego encodera jest błędem, nie pozornym WebP;
- źródło tylko w pamięci/object URL, revocation w finally, canvas zwalniany,
  brak zapisu oryginału/localStorage i brak wywołań sieci;
- techniczny limit wejścia20MiB,8192px/32MP chroni dekodowanie dużych plików;
- parseJerseyNumber waliduje0–99, bez sprawdzania unikalności czy odpytywania grup.

**Moduł nie jest importowany przez entry aplikacji ani podłączony do UI/API.**
Jest gotowym przygotowaniem do integracji po uzgodnieniu backendu, nie funkcją uploadu.
Przyciski w odebranym B2.1 pozostają nieaktywne; nie pokazujemy fałszywego sukcesu.
Nie zmieniono CSS, układu, Ultimate, ikon, motywów, nawigacji i mignięcia B1.
Nie modyfikowano demonstracyjnych zawodników p01/p02 ani nie wiązano ich z Auth.

## Minimalny projekt do przeglądu — NIE zastosowany

- docs/proposals/B22_PROFILE_STORAGE_DRAFT.sql: konfiguracja istniejącego bucketu
  WebP/150000B, wąski service-only RPC zapisu numeru do istniejącej tabeli,
  zgodność ścieżki commit jpg|webp z zachowaniem CAS/session gate/cleanup.
  Brak nowych tabel i UNIQUE numeru. Projekt poza katalogiem migracji; nie uruchomiony
  ani niezaliczony jako przetestowana migracja.
- docs/proposals/B22_BACKEND_PLAN.md: skoordynowane zmiany istniejącego Edge,
  odczyt i zapis numeru, zachowanie numeru przy edycji kontaktu, rzeczywista walidacja
  kontenera WebP/800px/150KB, ograniczony body uploadu, stary JPEG tylko do odczytu,
  sesja/obcy UUID/stale revision, podmiana/usunięcie i sprzątanie po awarii.

Nie wolno zastosować samej konfiguracji bucketu: obecny handler JPEG stałby się niezgodny.
Obecny cleanup nie gwarantuje braku osieroconych plików po awarii procesu pomiędzy
Storage POST a commit. Przy timeout commit mógł się udać: przed usunięciem nowego
obiektu trzeba sprawdzić metadane. Projekt opisuje wymagane zabezpieczenia,
nie deklaruje ich wdrożenia lub zaliczenia.

**Decyzja UI wymagana zgodnie z pkt1 zadania:** proponowany jeden przycisk
„Usuń zdjęcie” w istniejącej sekcji akcji pickera, tylko przy własnym zapisanym zdjęciu.
Te same klasy, bez CSS/nowego modalu/ikon. To projekt wyjątku, nie zmiana UI.
Nie dodano go bez zgody. Pozostałe kontrolki numeru/wyboru mają być wykorzystane ponownie.

## Testy

PASS: TypeScript, lint, **204 Vitest w37plikach** (6 nowych testów przygotowania).
Testy obejmują0/99, wartości błędne i dozwolone duplikaty, proporcje/no-upscale,
normalną jakość, redukcję rozdzielczości, limit bajtów, błąd encodera i niewłaściwy format.
Cypress: prawdziwa kompresja proceduralnego testowego PNG w Chrome do poprawnie
ponownie dekodowanego WebP <=800px/150000B, zachowane4:3 — PASS.
Techniczna fixture HTML jest wyłącznie testem kodeka, nie ekranem aplikacji.
Regresja B1/B2.1 Cypress:12/12 PASS (Auth, profil,8 kombinacji szerokości/motywu).
Łącznie13/13 Cypress wraz z testem kodeka; testy kontraktu korzystają z kontrolowanych odpowiedzi.

PASS: standardowy build, build demo/izolacja16plików, lokalny live build,
cap sync Android, assembleDebug, JUnit1 (UP-TO-DATE), weryfikacja zasobów APK.
Guard UI:47 identycznych plików +8 wcześniej dozwolonych modułów B1/B2.1.
Nie rozszerzano allowlisty o jakiekolwiek nowe zmiany UI.

**NOT TESTED/nieaktywne:** trwały numer, upload/podmiana/usunięcie WebP przez API,
błędy Storage/commit/cleanup, uprawnienia nowego kontraktu i brak osieroconych plików,
odczyt zdjęcia/numeru po restarcie i na innym koncie. To wymaga uzgodnionego backendu.
Nie uznajemy testów kompresora za testy Supabase. Nie dodano service_role do klienta.
Nie tworzyliśmy nowych kont/grup/obiektów Storage i nie resetowaliśmy danych.

## Pliki i APK

Nowe: src/profile/imageDimensions.ts, preparePhoto.ts, preparePhoto.test.ts;
cypress/fixtures/photo-preparation.html, cypress/b22/preparation.cy.ts;
dwa projekty w docs/proposals. Dokumenty: ten raport, ODPOWIEDZI_CODEX, STATUS,
FRONTEND_HANDOFF (TODO B3: ostrzeżenie o powtórzonym numerze, bez blokady).
Żaden istniejący plik runtime/UI nie został zmodyfikowany.

Build Android wykonano, ale APK ma nadal hash odebranego B2.1:
`e422912c4d74b8524ebf5dbdb40ee31680c23c34adf440e8ecce8df703ff322f`.
Ścieżka: app/android/app/build/outputs/apk/debug/app-debug.apk
(w worktree I:\slm\sunday-league-mates\.worktrees\slm-v1-live).
Nie ponawiano instalacji identycznego APK na POCO. Nie ma nowego działającego APK B2.2.
UI/bundle urządzenia pozostaje identyczne, a znany hero A i mignięcie B1 nietknięte.

## Checklista POCO — dopiero po uzgodnionym wdrożeniu kontraktu

1. Ustaw0 i99, zapisz; po restarcie sprawdź kartę i formularz.100/-1/ułamki odrzucane.
2. Na drugim lokalnym koncie ustaw ten sam numer — ma być dozwolony.
3. Wybierz testowy JPEG/PNG/WebP; zobacz proporcje, potwierdź kompresję i zapis.
4. Zastąp i usuń zdjęcie; sprawdź restart, nieudaną sieć i ponowienie.
5. Wyloguj się/zaloguj na inne konto: bez poprzedniego zdjęcia/numeru.
6. Sprawdź B1/B2.1 i oba Wstecz; uczestnicy demo mają pozostać demonstracyjni.

Tej checklisty nie można dziś zaliczyć jako B2.2, ponieważ funkcje nie są aktywne.
Wymagana decyzja: lokalny, skoordynowany pakiet backendu oraz minimalny wyjątek
na przycisk usunięcia. Zdalne wdrożenie wymaga odrębnej wyraźnej zgody.
Nie rozpoczęto B3/B4. Bez push/merge i zmian Supabase/Edge/bucketów/RLS.

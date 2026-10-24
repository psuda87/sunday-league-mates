# ARCHIWUM projektu: pakiet zatwierdzony i wykonany WYŁĄCZNIE LOKALNIE; aktualny raport docs/SLM_V1_B2_PHOTOS.md, SQL app/local-backend/B22_LOCAL_ONLY.sql.

# B2.2 — projekt zmian, nie wdrożenie

Status: BLOKADA. Nie zastosowano SQL, konfiguracji ani Edge. Runtime B2.1 bez zmian.
Projekt `B22_PROFILE_STORAGE_DRAFT.sql` jest poza katalogiem migracji; nie może być
przypadkiem zastosowany przez zwykły pipeline. Nie testowano go na bazie.

## Minimalny pakiet backendu (do wspólnego przeglądu, nie częściowego wdrożenia)

1. Zachować istniejące tabele slm_player_profiles/slm_profile_photos i prywatny bucket.
   Projekt SQL zmienia dopuszczalny nowy upload na WebP/150000 B i ścieżkę commit na
   jpg|webp (jpg wyłącznie dla zgodności z wcześniejszymi referencjami).
   Żadnych publicznych polityk objects ani bezpośrednich grantów klienta.
2. Istniejący accounts/profile ma zwracać dodatkowo rzeczywisty jersey_number z
   slm_player_profiles (null gdy brak), także dla legacy. Nowa wąska akcja numeru
   ma przyjmować wyłącznie liczbę całkowitą 0–99, używać ctx.id/ctx.sid i projektu RPC.
   Nie ufać user_id/role z body. Dwa konta mogą mieć identyczny numer.
3. Istniejące save_email_profile nie może dalej zerować numeru przez p_number:null
   przy zmianie nazwy/kontaktu: zachować aktualny numer lub wydzielić zapis numeru.
   Zapis full_name z B2.1 nadal nie ma dotykać zdjęcia ani numeru.
4. Dostosować istniejący profilePhotos.ts: nowy upload tylko WebP, max800x800,
   max150000 B, ścieżka ctx.id/losowy-UUID.webp. Walidować rzeczywiste RIFF/WebP,
   granice/chunki i rozmiary klatki; odrzucać uszkodzone/animowane kontenery.
   Nie wystarczy Content-Type ani sam nagłówek z podanymi wymiarami.
   Zachować odczyt wcześniejszych własnych JPEG do czasu jawnej podmiany/usunięcia.
5. Zachować expected_revision, blokadę SQL, CAS, cleanup_path, odrzucanie cudzych
   ścieżek i cleanup starego obiektu. Nie usuwać aktualnego pliku przed commit nowego.
   W razie timeoutu commit najpierw sprawdzić metadane: commit mógł dojść do skutku;
   nie usuwać w ciemno obiektu, który mógł stać się aktualnym zdjęciem.
   Sprzątanie nieudanych uploadów wymaga powtarzalności; awarii procesu pomiędzy
   Storage POST a commit obecna architektura nie pokrywa w pełni. Zaprojektować
   bezpieczny przegląd osieroconych ścieżek po wieku, bez kasowania aktywnych/referencji.
6. Zachować osobną, ograniczoną ścieżkę body uploadu (`?photo=upload`), limit ciała
   dostosować do base64 150KB + niewielki narzut. Bazowy klient B2.1 nie ma jeszcze
   tej obsługi; przenieść wyłącznie właściwy fragment z poprzedniej integracji.
7. Zwykłe sesje nie dostają dostępu do prywatnych tabel/bucketów; service_role
   pozostaje tylko w istniejącym serwerowym API. Sprawdzić obcy JWT/UUID,
   brak sesji, wygasłą sesję, stare revision, błędy Storage/commit/cleanup i brak wycieków.

## Klient — bez aktywowania niezgodnego uploadu

Przygotowany moduł src/profile/preparePhoto.ts: kompresja lokalna WebP do800px,
normalnie75–80%, próba redukcji rozdzielczości, ostatecznie70/65% przy minimalnym
przyjętym rozmiarze; twarde150KB. Nie powiększa i nie dopełnia małych zdjęć do40KB.
Wykorzystuje czytniki JPEG/PNG/WebP ze starszej integracji i prawdziwy dekoder przeglądarki.
To przygotowanie, NIE działający upload. Nie jest importowane przez entry aplikacji.

Po uzgodnieniu backendu podłączyć istniejący formularz numeru i picker do portu
własnego profilu, bez world.players i bez mapowania p01/p02 na konto Auth.
Nie przenosić starego PhotoEditor: zawiera inny modal/toolbar i naruszyłby frozen UI.

## Niezbędna decyzja UI: usuwanie zdjęcia

Oryginalny AvatarPicker ma wybór/podgląd, zatwierdzenie i anulowanie, ale nie ma
przycisku usunięcia aktualnego zdjęcia. Nie wolno podmienić znaczenia „Anuluj” na
operację destrukcyjną. Propozycja minimalnego wyjątku: **jeden przycisk „Usuń zdjęcie”
w istniejącej sekcji akcji pickera, tylko przy zapisanym własnym zdjęciu**.
Te same istniejące klasy przycisków; bez nowego CSS, modalu, ikon ani projektu karty.
To propozycja wymagająca zgody zgodnie z pkt1 zadania B2.2. Nie dodano przycisku do UI.
Zastąpienie fikcyjnych portretów prawdziwą projekcją także musi zachować uzgodniony
zakres oryginalnych kontrolek; nie prezentować fikcyjnego zdjęcia jako zapisanego na serwerze.

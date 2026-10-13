# Instrukcje pracy nad Sunday League Mates

- Kod aplikacji znajduje się w `app/`, dokumentacja w `docs/`.
- Stos projektu: TypeScript, Ionic React i Capacitor. Zachowuj identyfikator aplikacji `pl.psuda87.slm` i nazwę wyświetlaną `Sunday League Mates`.
- Interfejs i komunikaty dla użytkowników pisz po polsku.
- Wymagania biznesowe muszą być zgodne z `docs/SPECYFIKACJA_SOCCER_APP.md`. Ustalenia oznaczone jako ustalone są obowiązujące.
- Propozycje wdrożeniowe i punkty otwarte nie są zatwierdzonymi wymaganiami. Nie wdrażaj ich bez decyzji użytkownika. Nazwa i stos aplikacji zostały potwierdzone poleceniem przygotowania projektu.
- Nie zapisuj sekretów w repozytorium ani w kodzie klienta. Lokalne pliki `.env` mają być ignorowane; `.env.example` może zawierać wyłącznie niesekretne przykłady.
- Po zmianach uruchamiaj w `app/` build i dostępne kontrole: `npm run build`, `npm run lint`, `npm run test.unit -- --run` i `npm run test.e2e` przy działającym serwerze. Po zmianach webowych przeznaczonych dla Androida wykonaj `npx cap sync android`; sprawdzaj kompilację natywną, gdy środowisko na to pozwala. Podawaj wyniki i dokładne przyczyny blokad.
- Zachowuj w repozytorium źródła platform natywnych i `package-lock.json`; ignoruj zależności, artefakty kompilacji i lokalną konfigurację IDE.
- Bieżący etap obejmuje szkielet i dokumentację. Nie implementuj kont, bazy danych, rozliczeń ani powiadomień. Nie wykonuj commita ani pusha bez polecenia użytkownika.

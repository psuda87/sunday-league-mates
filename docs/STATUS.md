# Aktualny stan Sunday League Mates

Aktualizacja: 17.10.2026. Branch feat/integration.
Worktree I:/slm/sunday-league-mates-integration.
Integracja 5d3048b i poprawki 13cfce4; obecny commit dokumentacyjny przygotowuje przekazanie
pracy do chmury. Autoryzowano zwykły push na origin/feat/integration, bez merge do main.
Oryginalny katalog nadal feat/events; pics/ nieśledzony, pozostaje wyłącznie lokalnie.

## Wykonane i wdrożenia

Auth/sesje, wydarzenia/goście/rezerwa, połączone rozliczenia i centrum powiadomień.
Adapter finansowy inbox/outbox przygotowany, atomowość SQL niepotwierdzona.
Polskie telefony: 9 cyfr, +48/0048/separatory, zapis kanoniczny, historyczne konta zachowane.
Przygotowano docs/KONTEKST_DLA_CODEX_I_CHATGPT.txt do kontynuacji w chmurze i na telefonie.
Sześć nowych migracji finansów/powiadomień NIE ZASTOSOWANO.
Zmiany accounts/push-worker NIE WDROŻONO; brak zmian zdalnego Supabase/Firebase.

## Kontrole ponowione 17.10.2026

- TypeScript klienta, Deno 2.9.6 check trzech wejść Edge, ESLint, build web: OK.
- Vitest 66/66, 11 plików; bootstrap Admin API mock 6/6; Cypress API mock 10/10, 4 pliki.
- git diff --check: OK. Przegląd śledzonych plików: brak sekretów/artefaktów.
- Build: duże chunki; Cypress: Electron deprecated/Browserslist.
- Audit 14.10: 6 moderate, produkcyjny 3 moderate, 0 high/critical; teraz nie ponawiano.
- SQL/migracje/RPC/RLS/FIFO/wyścigi/atomowość: NIEWYKONANE.
- Android/iOS/realny FCM integracji: NIEWYKONANE.

## Blokady i następny krok

Docker Desktop już zainstalowany, docker CLI 29.8.2 działa, ale silnik Linux niedostępny:
brak potoku //./pipe/dockerDesktopLinuxEngine. Nie zmieniano Windows ani nie uruchamiano
baz. Starsze informacje o braku instalacji Dockera są historyczne.
Uruchomić działający silnik Docker, potem świeży izolowany Supabase, 13 migracji,
przygotowane SQL oraz pełne testy równoległych RPC i adaptera/rollback. Nie resetować baz.
CAPTCHA odłożona, iOS i dodatkowe ręczne scenariusze sesji niezweryfikowane.

Szczegóły i bezpieczny start: [KONTEKST_DLA_CODEX_I_CHATGPT.txt](KONTEKST_DLA_CODEX_I_CHATGPT.txt),
[LOCAL_VERIFICATION.md](LOCAL_VERIFICATION.md).

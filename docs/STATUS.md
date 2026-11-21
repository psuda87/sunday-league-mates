# Potwierdzanie wpłat: brak wylogowania przy błędzie serwera, zgłoszenie znika od razu — 2026-11-21

Przyczyna wylogowań: każda odpowiedź 503 (Edge zamienia na 503 także kod 555 bramki Supabase na wywołaniu limitera `slm_account_rate`; 17 takich zdarzeń 20.11, serie przy próbach potwierdzania) przy zwykłej operacji zrzucała sesję do stanu „niedostępne” (`SessionManager.execute` → `problem`). Teraz tylko `session_invalid` i zgubiona odpowiedź (`network_error`) wymuszają weryfikację sesji; 5xx/limit kończą się błędem operacji, sesja zostaje. Akceptacja wpłaty na bazie działa (5 oczekujących zgłoszeń sprawdzone w transakcjach wycofanych, 30–120 ms).
`usePremiumFinance.mutate`: po potwierdzeniu przez serwer zgłoszenie znika z listy od razu (bez pustego ekranu), odczyt w tle (`reload(true)`); gdy odczyt zawiedzie, klucz idempotencji zostaje, a komunikat mówi, że operacja jest potwierdzona. Testy: sessionManager (3 kody + session_invalid), finance (zniknięcie zgłoszenia przy nieudanym odczycie). Nie sprawdzone na urządzeniu. Nie wyjaśniono, co powoduje same odpowiedzi 555 (do obserwacji).

---


Aktualizacja PR34: właściciel zatwierdził przypięcia Auth. Frontendowe strażniki są już PASS:45 migracji/55plików/13granic oraz82 testy policy (wszystkie stare71 zachowane). Build Premium,476Vitest,TS/lint i lokalny produkcyjny previewHTTP200 PASS. Bez zmian aplikacji i oryginalnego manifestu55. Starszy opis blokady pinów poniżej jest historyczny. Wdrożenie naVercel/zmianyCloud nie zostały wykonane z powodu braku dostępu API; jedno konkretne działanie dlaChatGPT podano na początku docs/PREMIUM_REAL_AUTH_WEB.md.

Premium używał rzeczywistego logowania, ale rejestracja, callback i recovery pozostawały niepodłączone, a Vercel budował demo. Ta zmiana podłącza istniejące ekrany do accounts i dodaje produkcyjny build tego samego entry Premium, bez kopii aplikacji.

- Zachowany SessionManager; dowody wyłącznie we fragmencie URL, natychmiast czyszczone. Weryfikacja/reset nie przekazują sesji przeglądarce; wymagane normalne logowanie.
- Minimalne rozszerzenie istniejącego accounts, podpisany Send Email hook i SMTP/TLS465 bez nowej usługi lub zależności. Zmiana adresów, legacy i nieuzgodnione wiadomości nadal blokowane.
- Przygotowana, NIEWYKONANA migracja45 dla inicjalizacji profilu i bezpiecznego odrzucenia recovery. Wszystkie stare44 bez zmian.
- npm run build:premium-web, root Vercel app, output dist-premium-web, SPA i dokładny CSP HTTPS. Demo nadal izolowane. Rejestracja bez zatwierdzonych dokumentów prawnych zablokowana.

Walidacja: TypeScript frontend/Edge, pełny lint,476 Vitest/68 plików,3 testy konfiguracji, buildy Premium/LIVE/demo i izolacja demo PASS. Chromium320/390/768,12 kombinacji palety/trybu i scenariusze kont PASS na kontrolowanym HTTP, NIE na prawdziwym Supabase. Parser SQL/PLpgSQL migracji PASS, bez wykonania SQL. Cypress NOT RUN — brak binarium. Realny GoTrue/SQL/RLS/SMTP, telefon i hosted CI NOT RUN.

**Blokada integracji:** aktywne strażniki FAIL (baseline niezatwierdzony). Nie zmieniono ich, CI ani manifestu55.54/55 plików identycznych; AccountScreens zmienia wyłącznie funkcjonalne props/treści rejestracji, bez CSS, kart i nawigacji. Dokładny nieaktywny manifest: docs/review/premium-real-auth-web-manifest.json. Wymagany osobny przegląd źródeł/przypięć zgodnie z AGENTS.md; nie traktować tego PR jako zgody na nowe hashe.

Raport, konfiguracja i kolejność wdrożenia: docs/PREMIUM_REAL_AUTH_WEB.md. Rzeczywiste zrzuty z kontrolowanym transportem: docs/ui/auth-web/.

Bez merge, deployu, migracji wykonanych w jakiejkolwiek bazie, zmian Cloud lub sekretów. Dokładne źródła: HEAD feat/premium-real-auth-web i manifest SHA256 w docs/review/premium-real-auth-web-manifest.json. PR pozostaje Draft do odbioru kontraktów i backendu.

Uzupełnienie: odrzucanie callbacków localhost i wspólny budżet4s dla hooka HTTP/SMTP, z propagacją anulowania. Odczytane źródła GoTrue mają limit5s; sprawdzone wyłącznie lokalnie na kontrolowanych transportach.

Kod kontynuacji: 36ed569b62bb6861640d2f64c10ed12038c4b15a. Bez deployu i merge; wymagany niezależny przegląd pinów i realnego backendu.

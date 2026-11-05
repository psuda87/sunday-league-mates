# Płatności — implementacja i podgląd

2026-11-05, `feat/premium-legal-pages`, baza `281e4f1`.

Przyczyna niedziałających decyzji: dotychczasowy przycisk wymagał niepustego
powodu wpisanego w innym formularzu. Decyzje mają teraz automatyczny opis
audytowy; użytkownik nie musi go wpisywać. Autoryzacja pozostaje serwerowa.

- Kafelek zawodnika: należności, zgłoszenie, akceptacja/odrzucenie, ręczne
  oznaczenie opłacenia i anulowanie zatwierdzonej wpłaty. Anulowanie tworzy
  kompensującą operację księgową, zachowuje historię i przywraca należność.
- Historia wpłat to osobna zakładka. Zgłaszanie przeniesiono do własnego profilu:
  kwota i opcjonalny nieopłacony mecz, z wyborem grupy przy kilku grupach.
- Backend blokuje powtórne zgłoszenie, opłacony mecz, zbyt dużą wpłatę na
  konkretny mecz i akceptację nieaktualnego zgłoszenia. Blokada transakcyjna
  oraz istniejąca idempotencja chronią równoległe żądania i ponowienia.
- Portfel zawiera również własną historię po odejściu i zakres legacy.
  Globalna rola ani autor meczu nie dają uprawnień administratora finansów.

Zakres poza katalogiem finance: wyłącznie slot prezentacyjny `payments` w
`personalProfile.ts`, utworzenie komponentu w `useOwnProfile.ts` i jedna linia
`{live?.payments}` w `Profile.tsx`; trzy mapowania błędów w accounts/handler.
Nie zmieniono Auth, kart, nawigacji, wyglądu pozostałych modułów ani historycznych
manifestów. Nowy CSS ma zakres `.slm-premium-finance`.

## Rzeczywista weryfikacja

- PASS TypeScript, lint bez ostrzeżeń, typecheck Edge Functions.
- PASS 518 testów Vitest / 74 pliki; po ostatniej poprawce wpłat ogólnych
  ponownie PASS 14 testów finansów / 2 pliki.
- PASS produkcyjny build Premium web po ostatniej poprawce.
- PASS PostgreSQL: odtworzenie47 kanonicznych migracji w nowej lokalnej
  jednorazowej bazie `slm-main-stabilization`; stare testy minimum/telefonu
  i prywatności oraz nowe testy uprawnień, wpłat, anulowania i ponowień.
- PASS dwie równoległe transakcje w osobnych połączeniach: jedna wpłata,
  drugie żądanie `already_paid`, brak zdublowanej wpłaty.
- PASS Cypress, rzeczywisty build, mobilny viewport390px, kontrolowany transport:
  własny profil → kwota/mecz → zgłoszenie → oczekiwanie → osobna historia.
  Bez rzeczywistych zapisów do kont podczas tego testu.
- FAIL istniejący `test:premium-policy`: zatrzymuje się na nowej linii slotu
  w Profile.tsx. Piny wymagają osobnego przeglądu właściciela. Kontroli nie
  zmieniono ani nie wyłączono; ten wynik nie jest PASS gotowości produkcyjnej.

## Wdrożenie po wyraźnej zgodzie z 2026-11-05

- Zastosowano wyłącznie nową migrację `payment_workflow` odpowiadającą plikowi
  `20261105220005_payment_workflow.sql` w projekcie `hjtcyybkxebvdropchac`.
  Bez modyfikacji danych istniejących kont, historii i starych migracji.
- accounts17: bieżące źródło accounts16 plus dokładnie trzy mapowania409:
  `already_paid`, `overpayment`, `pending_payment_exists`. Wszystkie10 plików
  po wdrożeniu porównano z oczekiwaną zawartością. Zachowano CORS, konfigurację
  i wewnętrzną weryfikację Auth. Nie wdrażano backendu prywatności46.
  Pierwsze wywołanie publikacji odrzucono z powodu starej absolutnej ścieżki
  importmap; ponowienie z względnym `accounts/deno.json` zakończone sukcesem.
- Lokalny podgląd5196 zaktualizowano do nowego builda, HTTP200.
- Produkcyjny Vercel pozostaje bez zmian do przeglądu dokładnych pinów.
  Nie publikować całej gałęzi: zawiera też niewdrożony moduł prywatności46.
  Wydanie wyłącznie płatności powinno użyć obecnej bazy Vercel `023ebcd` plus
  zatwierdzony patch finansów i trzy minimalne powiązania profilu.

Do odbioru ręcznego: istniejąca fikcyjna grupa e55e1aef, admin i gracz. Zapisane
dwa oczekujące zgłoszenia pozostawiono do sprawdzenia przez właściciela.
Nie wykonywano destrukcyjnych prób na prawdziwych kontach; bez płatnych usług.

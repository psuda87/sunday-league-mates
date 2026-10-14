# Kontrakt integracji finansów z powiadomieniami

Aktualizacja integracji 14.10.2026: na `feat/integration` połączono oba moduły.
TypeScript, lint i build: OK; SQL, migracje, RLS, FCM i testy urządzeń niewykonane.
Adapter finansowy podłączono w kodzie migracji, bez zastosowania do bazy.
Aktualny zakres i ograniczenia: [INTEGRATION_REPORT.md](INTEGRATION_REPORT.md).
Poniższy opis zachowuje historyczny stan gałęzi źródłowej oraz plan przyszłej weryfikacji.

Stan 14.10.2026: kontrakt lokalny, niewykonany. `feat/push-notifications` bazuje
na `origin/feat/events` (`6638e18`), nie zawiera tabel/RPC/UI rozliczeń.
`origin/feat/settlements` istnieje i wskazuje zapis `81d71c7fb24dc4b410f178c3fa4101a5fa2ce410`.
Nie kopiowano kodu rozliczeń, nie dodano sztucznych wpłat ani blokad.

## Zdarzenia

Po świadomym połączeniu modułów rzeczywista transakcja finansowa wywołuje
`public.slm_notifications_finance_emit(p_key,p_kind,p_user,p_event default null)`.
Funkcja jest dostępna wyłącznie dla service_role. Nie ma klientowego endpointu
emitującego zdarzenia finansowe. In-app działa bez tokenu FCM i bez zgody na push.

| kind | Warunek | Stabilny klucz źródła |
|---|---|---|
| payment_accepted | Faktyczne zatwierdzenie zgłoszenia i księgowanie | finance:payment:<payment_id>:<decision_id> |
| payment_rejected | Faktyczne odrzucenie zgłoszenia | finance:payment:<payment_id>:<decision_id> |
| registration_blocked | Przejście liczby zaległych meczów z <2 na >=2 | finance:block:<user_id>:<transition_id> |
| registration_unblocked | Przejście z >=2 na <2 po rzeczywistej operacji | finance:block:<user_id>:<transition_id> |

`decision_id` i `transition_id` muszą być zapisane trwale w rzeczywistej historii
finansowej. Nie generować nowego ID przy ponawianiu żądania. Następny cykl
blokada→odblokowanie wymaga nowych identyfikatorów przejść. Podanie tego samego
klucza z innym rodzajem zdarzenia jest konfliktem, a nie nowym powiadomieniem.
Pomocniczy kontrakt TypeScript: `app/src/notifications/financeAdapter.ts`.

## Przyszła integracja

1. Najpierw zweryfikować moduł rozliczeń. Połączyć migracje i RPC wydarzeń
   ręcznie w osobnym zadaniu: obie gałęzie modyfikują `slm_events_dispatch`.
   **Nie wolno** zastosować jednego CREATE OR REPLACE po drugim bez połączenia
   logiki: mogłoby to usunąć kontrolę finansową albo obsługę historii rozliczeń.
2. W obrębie rzeczywistej transakcji zachować wspólną kolejność blokad:
   advisory `(20261014,1)` → stan sesji → wydarzenie/finanse. Przed zmianą odczytać
   blokadę każdego dotkniętego konta; po naliczeniu, wpłacie, korekcie lub odwołaniu
   odczytać ją ponownie. Do wyliczenia używać serwerowej projekcji rozliczeń,
   nie sum z interfejsu ani liczby gości.
3. Emitować wyłącznie rzeczywiste zmiany stanu, w tej samej transakcji co
   księgowanie i audyt. Ponowienie zaakceptowanej operacji nie może utworzyć
   następnego zdarzenia. Powiadomienie odrzucenia nie może zmieniać salda.
4. Adapter `slm_private.notification_registration_allowed(uuid)` na bazie events
   sprawdza aktywność konta. Jeżeli zainstalowano uzgodniony kontrakt
   `slm_private.finance_dues(uuid)`, dodatkowo sprawdza liczbę różnych meczów
   z `outstanding_cents > 0`. Nie kopiuje wyliczeń FIFO. Bez tego modułu nie
   deklaruje kontroli zaległości. Zintegrowane zapisy muszą sprawdzać go atomowo
   pod tą samą blokadą co wpłaty. Kontrola wysyłki do rezerwy jest tylko filtrem,
   nigdy rezerwacją miejsca ani zamiennikiem kontroli przy zapisie.
5. Dopiero później dodać nawigację finansowego powiadomienia do rzeczywistego
   ekranu rozliczeń. Obecny klient pokazuje historię i informuje o braku tego ekranu.

Weryfikacja do wykonania później: approve/approve, accept/reject, częściowa wpłata,
nadpłata, korekta przywracająca blokadę, zwolnienie gościa, dwa udziały w jednym
meczu, dwa mecze i atomowy wyścig wpłata/zapis. Sprawdzić dokładnie jeden inbox
na konto/źródło oraz brak powiadomień o stanie, który został wycofany transakcją.

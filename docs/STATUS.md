# Nadpłata dla zawodnika bez zaległości — 2026-11-21

Problem: admin nie mógł wpisać wpłaty zawodnikowi bez długu (formularz ukryty, serwer zwracał `already_paid`). Migracja `20261121200000_advance_payment_without_debt.sql`: `payment_pending_guard_base` przyjmuje ogólną wpłatę admina (bez `event_id`) przy zerowej zaległości — całość zostaje jako nadpłata. Dalej blokowane: zgłoszenie wpłaty przez samego zawodnika bez długu oraz wpłata na konkretny mecz bez należności/ponad nią. Sprawdzone w wycofywanej transakcji pod `service_role` (100 zł dla zawodnika bez długu → saldo +100 zł; wpłata na mecz → `already_paid`).
Klient: formularz „Wpłata zawodnika (zł)” widoczny także bez zaległości, z podpowiedzią o nadpłacie.

---

# Profil zawodnika: kwota wpłaty wpisywana ręcznie — 2026-11-21

Przy każdej wpłacie w profilu admin ma pole „Kwota (zł)” (domyślnie kwota z serwera). Zgłoszenie: „Zatwierdź” zatwierdza z wpisaną kwotą (jeśli inna niż zgłoszona: `accept_payment`, potem `correct_payment`; przy błędzie korekty komunikat mówi, że zatwierdzono kwotę zgłoszoną). Zaksięgowana: „Popraw kwotę” (`correct_payment`) i „Cofnij”. Sprawdzone pod `service_role` w wycofywanej transakcji (accept + correct). Brak zmian w bazie.
Przycisk „Rozliczenie” w panelu otwiera okno (popup): zaległość, wpłaty z polem kwoty (Zatwierdź / Odrzuć / Popraw kwotę / Cofnij) i formularz nowej wpłaty; Esc, × lub kliknięcie tła zamyka. Dotychczasowy widok w panelu zostaje bez zmian.

---

# Akceptacja wpłat nic nie robiła + decyzje o wpłatach w profilu — 2026-11-21

Przyczyna: `service_role` nie miał EXECUTE na `slm_private.privacy_redaction_ok`, wołanym przez wyzwalacz `group_payment_identity` przy UPDATE wpłaty. Akceptacja/odrzucenie/cofnięcie kończyły się 42501 (PostgREST 403), Edge zwracał 503 i UI nie pokazywał efektu. Wcześniejsze testy w SQL przechodziły, bo biegły jako superużytkownik; błąd widać dopiero pod `set local role service_role`.
Naprawa: migracja `20261121190000_fix_payment_guard_service_role_execute.sql` (GRANT EXECUTE). Zweryfikowane w wycofywanej transakcji pod `service_role`: reject + accept + cancel dla wszystkich oczekujących zgłoszeń.
Klient: profil zawodnika (`MemberDebtPanel`) pokazuje wpłaty z przyciskami Zatwierdź / Odrzuć (zgłoszone) i Cofnij (zaksięgowane); stały identyfikator żądania przy ponowieniu, odświeżenie po decyzji, błąd nie wylogowuje.

---

# Nadpłata: admin wpisuje wpłatę większą niż dług — 2026-11-21
# Potwierdzanie wpłat: jeden kafelek zamiast dwóch, powód przy nieaktywnym przycisku — 2026-11-21

Zgłoszenie: „po kliknięciu Potwierdź nic się nie dzieje”, na liście dwa pola z zaległością. Przyczyna (dane organizatora: dług 46 zł za mecz + oczekująca wpłata ogólna 23 zł bez meczu): `PremiumFinance` robił dwa kafelki — kafelek zaległości z nieaktywnym przyciskiem „Oznacz jako opłacone” (`generalPending`, tekst „rozpatrz jej kafelek”) i osobny kafelek wpłaty ogólnej. Klik w nieaktywny przycisk nic nie robił. Baza akceptuje to zgłoszenie poprawnie (sprawdzone w transakcji wycofanej na wszystkich 5 oczekujących).
Teraz wpłata ogólna jest dołączona do pierwszej zaległości zawodnika (jeden kafelek, aktywne „Potwierdź zgłoszenie”); osobny kafelek tylko gdy zawodnik nie ma zaległości, z wyjaśnieniem, że nie da się jej zaksięgować (serwer: `already_paid`). Dodano też tekst przy zgłoszeniu przewyższającym należność za mecz. Testy: 2 nowe w payments.test. Nie sprawdzone na urządzeniu.

---


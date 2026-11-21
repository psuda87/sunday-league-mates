# Akceptacja wpłat nic nie robiła + decyzje o wpłatach w profilu — 2026-11-21

Przyczyna: `service_role` nie miał EXECUTE na `slm_private.privacy_redaction_ok`, wołanym przez wyzwalacz `group_payment_identity` przy UPDATE wpłaty. Akceptacja/odrzucenie/cofnięcie kończyły się 42501 (PostgREST 403), Edge zwracał 503 i UI nie pokazywał efektu. Wcześniejsze testy w SQL przechodziły, bo biegły jako superużytkownik; błąd widać dopiero pod `set local role service_role`.
Naprawa: migracja `20261121190000_fix_payment_guard_service_role_execute.sql` (GRANT EXECUTE). Zweryfikowane w wycofywanej transakcji pod `service_role`: reject + accept + cancel dla wszystkich oczekujących zgłoszeń.
Klient: profil zawodnika (`MemberDebtPanel`) pokazuje wpłaty z przyciskami Zatwierdź / Odrzuć (zgłoszone) i Cofnij (zaksięgowane); stały identyfikator żądania przy ponowieniu, odświeżenie po decyzji, błąd nie wylogowuje.

---

# Nadpłata: admin wpisuje wpłatę większą niż dług — 2026-11-21

Backend bez zmian: wpłata ogólna (`record_payment` bez `event_id`) może przekraczać zaległość; `group_dues` rozlicza ją po datach meczów, a saldo (`balance_cents`) robi się dodatnie (sprawdzone w transakcji wycofanej: dług 23 zł + wpłata 98 zł → zaległość 0, saldo +75 zł). Nadpłata przechodzi na kolejne zatwierdzone mecze. Ograniczenia serwera, bez zmian: wpłatę ogólną można zapisać tylko przy zaległości (`already_paid` bez długu) i nie przy oczekującym zgłoszeniu (`pending_payment_exists`); wpłata przypisana do meczu nadal nie może przekroczyć jego należności (`overpayment`).
Klient: `MemberDebtPanel` ma formularz „Wpłata zawodnika (zł)” dla admina (ten sam identyfikator żądania przy ponowieniu tej kwoty, walidacja kwoty, komunikaty po polsku); nadpłata widoczna w panelu admina oraz u zawodnika („Nadpłata: X — zostanie zaliczona na kolejne mecze” w Moich płatnościach i Bieżących płatnościach). Testy: 3 nowe w memberDebt. Nie sprawdzone na urządzeniu.

---


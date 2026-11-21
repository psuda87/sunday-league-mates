# Nadpłata: admin wpisuje wpłatę większą niż dług — 2026-11-21

Backend bez zmian: wpłata ogólna (`record_payment` bez `event_id`) może przekraczać zaległość; `group_dues` rozlicza ją po datach meczów, a saldo (`balance_cents`) robi się dodatnie (sprawdzone w transakcji wycofanej: dług 23 zł + wpłata 98 zł → zaległość 0, saldo +75 zł). Nadpłata przechodzi na kolejne zatwierdzone mecze. Ograniczenia serwera, bez zmian: wpłatę ogólną można zapisać tylko przy zaległości (`already_paid` bez długu) i nie przy oczekującym zgłoszeniu (`pending_payment_exists`); wpłata przypisana do meczu nadal nie może przekroczyć jego należności (`overpayment`).
Klient: `MemberDebtPanel` ma formularz „Wpłata zawodnika (zł)” dla admina (ten sam identyfikator żądania przy ponowieniu tej kwoty, walidacja kwoty, komunikaty po polsku); nadpłata widoczna w panelu admina oraz u zawodnika („Nadpłata: X — zostanie zaliczona na kolejne mecze” w Moich płatnościach i Bieżących płatnościach). Testy: 3 nowe w memberDebt. Nie sprawdzone na urządzeniu.

---


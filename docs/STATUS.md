# Potwierdzanie wpłat: jeden kafelek zamiast dwóch, powód przy nieaktywnym przycisku — 2026-11-21

Zgłoszenie: „po kliknięciu Potwierdź nic się nie dzieje”, na liście dwa pola z zaległością. Przyczyna (dane organizatora: dług 46 zł za mecz + oczekująca wpłata ogólna 23 zł bez meczu): `PremiumFinance` robił dwa kafelki — kafelek zaległości z nieaktywnym przyciskiem „Oznacz jako opłacone” (`generalPending`, tekst „rozpatrz jej kafelek”) i osobny kafelek wpłaty ogólnej. Klik w nieaktywny przycisk nic nie robił. Baza akceptuje to zgłoszenie poprawnie (sprawdzone w transakcji wycofanej na wszystkich 5 oczekujących).
Teraz wpłata ogólna jest dołączona do pierwszej zaległości zawodnika (jeden kafelek, aktywne „Potwierdź zgłoszenie”); osobny kafelek tylko gdy zawodnik nie ma zaległości, z wyjaśnieniem, że nie da się jej zaksięgować (serwer: `already_paid`). Dodano też tekst przy zgłoszeniu przewyższającym należność za mecz. Testy: 2 nowe w payments.test. Nie sprawdzone na urządzeniu.

---


# Trwałe fikcyjne dane telefonu — 23.10.2026

Gałąź narzędzia: `chore/local-phone-fixtures`, od `feat/premium318-live`.
Worktree: `I:\slm\sunday-league-mates\.worktrees\premium318-live`.
Zmiany dotyczą lokalnych danych i skryptu, nie APK ani schematu.

## Co przygotowano

- 14 nowych zawodników z nazwami `TEST …`, bez numerów telefonu, zdjęć i globalnej
  roli administratora. Hasła losowe tylko w pamięci procesu, bez zapisu/logowania.
  Do odbioru używaj swojego dotychczasowego konta telefonu; nie potrzebujesz
  logować się jako wygenerowani zawodnicy.
- `TEST · España — treningi`: duża grupa, organizator, wolne miejsca, pełny mecz,
  goście, osobna rezerwa, publiczny sparing, odwołany mecz, rozliczenia historyczne.
- `TEST · Liga — mecze i opłaty`: druga grupa z osobnymi finansami i wpłatami;
  po dobrowolnym dołączeniu konto telefonu pozostaje zwykłym członkiem.
- `TEST · Rywale — prywatność`: grupa bez zaproszenia telefonu, prywatny mecz
  z ograniczonym widokiem i publiczny mecz umożliwiający zapis outsidera.
- 8 przyszłych/odwołanych meczów i 4 nowe historyczne fixture — łącznie 12.
- 35 fikcyjnych wpłat: przyjęte, częściowe i 3 oczekujące. Historia obejmuje
  naliczone/otrzymane nadwyżki oraz zaległości wygenerowanych zawodników.

Po przyjęciu zaproszenia do Españi skrypt utworzył dodatkowy historyczny fixture
z udziałem konta telefonu: należność 27 zł, fikcyjna wpłata 10 zł, do zapłaty 17 zł.
To jeden zaległy mecz; nie przygotowujemy drugiej zaległości istniejącemu kontu.
Następnie przekazał mu administrację wyłącznie tej nowej grupy, przez istniejącą
operację transferu. Globalna rola konta pozostała `member`.

## Na telefonie

1. Grupy → Odśwież grupy → zaakceptuj zaproszenia do TEST España i TEST Liga.
2. Po transferze odśwież grupę España lub przejdź między zakładkami; powinny
   pojawić się rola administratora grupy i plus tworzenia meczu.
3. Mecze → Nadchodzące: wolne miejsca, pełny mecz/rezerwa, publiczne i prywatne.
4. Mecze → Historia: odwołany i historyczne fixture.
5. Profil → Ustawienia aplikacji i konta → Rozliczenia: wybierz grupę; w Españi
   sprawdź własne 17 zł pozostałe, w roli admina nadwyżki i wpłaty oczekujące.
6. W prywatnym meczu Rywali sprawdź ograniczony widok; w publicznym możliwość
   zapisania się bez automatycznego członkostwa w grupie.

Wszystkie nazwy `TEST` i kwoty są fikcyjne. Nie wykonuj prawdziwych przelewów ani
połączeń. Statystyki/numer/portret i składy nadal nie mają backendu — seed ich
nie symuluje. FCM/poczta nadal nieaktywne; inbox aplikacji korzysta z obecnego API.

## Narzędzie i ograniczenia

Z `app/`: `node scripts/seed-phone-world-local.mjs`.
Manifest `.cache/phone-test-world.json` zawiera wyłącznie identyfikatory, fikcyjne
nazwy i kwoty — nie hasła, klucze ani tokeny. Skrypt zapisuje postęp i przy
istniejącym manifeście odmawia ponownego seedowania; nie duplikuje wpłat.
W razie częściowego niepowodzenia zachowuje utworzone dane i zatrzymuje się.
Nie usuwać manifestu w celu ponowienia bez wcześniejszej analizy.

Nowe konta powstały przez lokalne Auth Admin API z `email_confirm=true` dla
fikcyjnej domeny, bez wysyłania wiadomości. Członkostwa fikcyjnych kont, przyszłe
mecze, zapisy, goście/rezerwa, odwołanie, zatwierdzenie i wpłaty przechodzą przez
istniejące API. Nowe historyczne mecze i ich początkowe wpisy to jawne snapshoty
fixture dodane do nowych grup; nie przesuwano dat istniejących wydarzeń i nie
zmieniano zegara. Rozliczenia zatwierdzono obecnym API. Taki seed nie jest
potwierdzeniem, że rzeczywisty mecz się odbył, ani odbiorem całego lifecycle finansów.

Brak zmian migracji, SQL/RLS/grantów/Auth policy, globalnych ról, istniejących
profili/haseł i sesji. Brak resetu/usuwania danych, zdalnych operacji, push i merge.
Skrypt nie zawiera automatycznego cleanupu — dane mają pozostać do ręcznego odbioru.

## Weryfikacja

- `node --check` i ESLint narzędzia: PASS.
- Utworzenie przez rzeczywisty lokalny backend: PASS, manifest `complete`.
- Ponowne uruchomienie przy istniejącym manifeście: PASS, brak duplikowania.
- Backend potwierdził dobrowolne przyjęcie obu zaproszeń; transfer Españi: PASS.
- Odczyt SQL: admin Españi, członek (bez admina) Ligi, globalna rola member: PASS.
- Odczyt SQL własnych finansów Españi: saldo -1700 groszy, pozostało 1700 groszy,
  dokładnie jeden zaległy mecz fixture: PASS. Odbiór wizualny kwoty pozostaje ręczny.
- Nie przebudowywano APK: runtime aplikacji niezmieniony; dane pobiera obecne API.

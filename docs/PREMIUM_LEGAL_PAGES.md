# Publiczne dokumenty testowe Premium web — 2026-11-04

## Zakres i wersja

Gałąź `feat/premium-legal-pages` bazuje na faktycznie wdrożonym Premium
`2d568f3c4abab83130583e7231d61779c236c1b3` z PR34, a nie na starszym domyślnym
LIVE main. Użytkownik jawnie zlecił przygotowanie i wdrożenie dokumentów do
istniejącego `slm-ui-demo`. Bez merge do main, zmiany Auth, bazy i zamrożonego UI.

Dodano wyłącznie statyczne dokumenty w `app/public/regulamin/index.html` i
`app/public/polityka-prywatnosci/index.html` oraz izolowany `app/public/legal.css`.
Istniejący build kopiuje `public`; katalogi mają własne index.html. Dokumenty
działają bez JavaScript, logowania, fontów zewnętrznych i narzędzi analitycznych,
mają język polski, noindex i styl wydruku. Linki powrotne prowadzą do aplikacji.
Nie zmieniono chronionego routingu, Vercel JSON, manifestów, hashy ani strażników.

Dokumenty obejmują: konta i potwierdzenie e-mail, role w grupach, widoczność
nazwiska i telefonu, mecze/zapisy/rezerwę/obecność, niezależne rozliczenia grup,
zgłoszenia wpłat, zdjęcia i wizerunek, zakazane treści, reklamacje, zakończenie
korzystania, prawa konsumenta i informację RODO. Pole akceptacji dokumentów nie
jest przedstawiane jako zbiorcza zgoda na marketing lub publikację wizerunku.

## Jawne braki do uzupełnienia przez właściciela

Nie wymyślono nazwy, adresu, e-maila ani danych rejestrowych usługodawcy.
Oznaczono `[DO UZUPEŁNIENIA]` także status IOD, dostawcę SMTP, umowy/dane
dostawców, region i transfery poza EOG oraz rzeczywisty harmonogram retencji.
Dokumenty wyraźnie mówią, że przy tych brakach nie stanowią pełnego wykonania
art.13–14 RODO ani potwierdzenia gotowości powszechnego uruchomienia. Test ma
używać fikcyjnych profili i rozliczeń, własnego e-maila i uprawnionych zdjęć;
przed podaniem rzeczywistych danych tester powinien uzyskać tożsamość i kontakt
administratora od osoby zapraszającej. Brak danych nie jest obchodzony przez
wyłączenie zgody lub walidacji.

Źródła sprawdzone 2026-11-04:

- [RODO — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=PL).
- [Prawa osób — UODO](https://uodo.gov.pl/pl/493/4098).
- [Ustawa o świadczeniu usług drogą elektroniczną](https://eli.gov.pl/api/acts/DU/2024/1513/text.html).
- [Ustawa o prawach konsumenta](https://eli.gov.pl/api/acts/DU/2024/1796/text.html).

## Istniejący projekt i konfiguracja

Vercel: zespół `peters-projects-97e42a0e`, plan Hobby, projekt `slm-ui-demo`
(`prj_0WHMoDOj2JNVNanziuU4FfLPEhoI`), połączony z
`psuda87/sunday-league-mates`. Przed zmianą produkcja była READY na powyższym SHA,
z publicznym aliasem `slm-ui-demo.vercel.app`. Nie utworzono nowej usługi ani planu.

Ustawiono jako publiczne wartości konfiguracji dla production/preview/development:

```text
VITE_SLM_TERMS_URL=https://slm-ui-demo.vercel.app/regulamin
VITE_SLM_PRIVACY_URL=https://slm-ui-demo.vercel.app/polityka-prywatnosci
```

Root `app`, build `npm run build:premium-web`, output `dist-premium-web`.
Automatyczne wdrożenia Git pozostają wyłączone. Nie zmieniono ochrony Vercel.
Produkcja: `023ebcd095545bf52b8e99fef155172f31700fe8`, deployment
`dpl_7eCU7sDWvKvwjycvFBu3BoLT9pZM` — READY; istniejący alias
`slm-ui-demo.vercel.app` wskazuje ten deployment. Oba URL (także warianty z
końcowym ukośnikiem), `/` i `/legal.css` odpowiadają HTTP200 z właściwym typem,
`noindex, nofollow` i `nosniff`. Przeglądarka pokazuje obie polskie strony
bez logowania. Formularz pokazuje linki, pole zgody jest aktywne i początkowo
odznaczone. Pusta próba zgłasza walidację e-maila, hasła, pseudonimu i wymaganej
akceptacji; nie wysyła żądania rejestracji. Konsola nie zgłosiła błędów.
Rzeczywistego utworzenia konta, dostarczenia wiadomości i potwierdzenia e-mail
nie zaliczono, ponieważ serwer zwraca `mail_unconfigured`.

## Faktyczne kontrole lokalne

- PASS: TypeScript i produkcyjny build Premium z powyższymi prawdziwymi URL;
  oba pliki dokumentów są w wynikowym katalogu.
- PASS: `verify:consolidation`, kontrakt55 chronionych plików i13 granic importów.
- PASS: wszystkie82 testy policy i3 testy konfiguracji builda Premium.
- PASS: ESLint oraz standardowy build aplikacji.
- PASS: pełny Vitest476/476 w68 plikach, bez zmiennych publikacji w środowisku
  testowym. Pierwszy przebieg z odziedziczonymi URL miał475 PASS i1 FAIL, bo test
  braku konfiguracji odziedziczył poprawne URL; po usunięciu tych dwóch zmiennych
  pełny przebieg przeszedł. Nie zmieniono testu ani kodu aplikacji.
- Cypress: próba uruchomienia nie wykonała scenariuszy, ponieważ brak serwera pod
  skonfigurowanym `localhost:5173`. Odbiór publikacji odbywa się w rzeczywistej
  przeglądarce na HTTPS; nie oznacza to PASS całego Cypress.
- `git diff` względem wdrożonej bazy: brak zmian w `app/src`, `app/supabase`,
  `app/scripts`, `app/vercel.json`, `app/package.json` i lockfile.

## Niezależna blokada poczty — potwierdzona

Odczytano istniejące `accounts` v8 (ACTIVE), bez wdrażania funkcji. Pojedyncza
próba POST `{ "action": "signup" }`, bez profilu, e-maila, hasła i zgody, z
Origin `https://slm-ui-demo.vercel.app`, zwróciła **HTTP503**:

```json
{"error":"Proces e-mail oczekuje na konfigurację poczty.","code":"mail_unconfigured"}
```

CORS dopuścił dokładny publiczny origin. W odczytanym kodzie ten komunikat
odpowiada wyłączonej fladze `SLM_EMAIL_SIGNUP_ENABLED`; nie odczytywano sekretów
ani nie włączano flagi. Próba nie mogła utworzyć konta ani wysłać wiadomości.
Nie jest to dowód braku konkretnego hasła SMTP, lecz potwierdzona blokada procesu
e-mail przed walidacją danych. Po publikacji dokumentów nadal nie można deklarować
udanego rzeczywistego signup/weryfikacji/recovery. Dalsza konfiguracja poczty
wymaga zgodnego dostawcy i podpisanego hooka według `PREMIUM_REAL_AUTH_WEB.md`,
z zachowaniem weryfikacji i ograniczeń Auth. Nie zakładano płatnej usługi.

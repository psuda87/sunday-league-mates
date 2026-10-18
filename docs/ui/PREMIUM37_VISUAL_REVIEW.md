# Premium España3.7 — przegląd wizualny

Obejrzano rzeczywiste premium35-home-dark, premium36-details-dark,
premium36-participants-dark oraz referencję slm-premium-three-phones.jpg.
Wzorzec3.6 ma pierwszeństwo: kompaktowy nagłówek, istniejący herb, bordo/gold,
ciemne powierzchnie i ciepły Light. Nowy katalog nie kopiuje fikcyjnych ocen/numerów.

1. Render Chromium390x844: lista66px, inicjały40px, profil100px. Ogląd ujawnił
   zbyt mocny focus na nieinteraktywnej nazwie i brak stadionowej głębi.
   Pierwszy przebieg automatyczny zatrzymał się na selektorze powrotu: Ionic
   przenosi aria-label na natywny przycisk w Shadow DOM. Test poprawiono bez
   zmiany działania przycisku. Artefakty premium37-cycle1/.
2. Render po korekcie: wiersze62px, subtelne zdjęcie istniejącego stadionu w tle
   profilu, fokus pozostaje na interaktywnych kontrolkach. Pełny scenariusz
   listy/profilu/powrotu/motywów działa. Ogląd Dark i Light; cycle2/.
3. Końcowy render: ciaśniejszy podpis demonstracji, mocniejsza hierarchia nazwiska.
   Ogląd listy Dark, profilu Light i wyszukiwania. Kontrole320/390/768,
   obszary dotykowe>=44, nazwy w jednym nagłówku z herbem, bez overflow.

Końcowe zrzuty premium37-players-dark/light.png,
premium37-player-profile-dark/light.png, premium37-players-search.png.
Pomiary porównawcze SHA w premium37-regression.json potwierdzają bajtową zgodność
home Dark/Light oraz details/participants/teams Dark z zatwierdzonymi3.5/3.6.

Ograniczenia: inicjały zamiast zdjęć (brak dostępnych, zatwierdzonych portretów),
brak numerów/ocen/statystyk, brak nowej funkcji biznesowej. Lista realnej grupy
niedostępna bez bezpiecznego kontraktu dla członka; aplikacja pokazuje ten stan,
demo osiem jawnie fikcyjnych osób. Własny Profil/edycja danych pozostają bez zmian.
Android/iOS, notche, skalowanie fontów i komfort klawiatury do weryfikacji urządzeń.

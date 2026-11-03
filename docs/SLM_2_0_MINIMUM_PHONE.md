# SLM 2.0 RC — minimum zawodników i własny telefon

2026-11-03 Europe/Warsaw. Gałąź `fix/slm2-minimum-phone`, baza RC `fa6bc7925a4939a8668ede4a619089b9e320a787` potwierdzona ponownym fetch. Bez merge, Cloud, migracji istniejących baz i zmian POCO.

## Wykonana implementacja

- Tworzenie i edycja meczu: osobne „Minimum zawodników”, domyślnie 10, minimum nie większe od limitu. Rzeczywisty odczyt po zapisie, istniejące CAS/version/request_id i uprawnienia twórcy zachowane. Liczniki, sygnał decyzji administratora i odpowiedzialność za rezygnację po 17:00 korzystają z zapisanego minimum. Zmiana minimum nie potwierdza ani nie odwołuje meczu automatycznie. Administrator grupy zachowuje dotychczasowe uprawnienia finansowe i odwołania.
- Nowa, transakcyjna migracja **43** `20261102180613_configurable_match_minimum.sql`. Dawne 42 migracje identyczne; nowa kolumna ma default 10. Podmiana fragmentów funkcji wymaga dokładnej zgodności źródła i przy rozbieżności wycofuje całą transakcję. Odtworzono zarówno świeże 43, jak i przejście 42→43 z zachowaniem danych wyłącznie NOWEJ fixture. Używana baza RC42 nie była migrowana.
- Profil → Edytuj profil → Numer telefonu: istniejący normalizer polski (9 cyfr, `+48`, `0048`, spacje), kanoniczny zapis `+48…`, potwierdzenie obecnym hasłem, odczyt potwierdzający zapis. Hasło znika z formularza po wysłaniu; nie trafia do logów ani trwałego magazynu.
- Konto legacy: zachowany login, istniejąca bezpieczna operacja `identifiers`, rotacja sesji, nowy numer loguje to samo konto, stary numer/token odrzucony. Konto e-mail: numer kontaktowy, logowanie e-mailem zachowane. Historyczne numery nie są przepisywane. Sprawdzanie kolizji z obiema tabelami PRZED rozpoczęciem zmiany legacy; istniejące ograniczenia/wyzwalacze nadal zabezpieczają wyścigi. Brak SMS, nowego dostawcy lub nowego mechanizmu Auth.
- `docs/TODO.md`: przesuwanie zawodników wewnątrz drużyny odłożone, bez implementacji.

## Ścisłe kontrakty — do odbioru właściciela przed integracją

1. Źródła runtime/backend: `51c980befd6a5f28c3471c89392a8a04672aaf0b`; podstawowy commit funkcji `25bd1e427d25d2b5f039c64b84e20257a90f39a0`.
2. Policy/consolidation/frozen UI: `0d82b09c8a9171bbe479bafc46cd775398208205`. Wyłącznie dokładne pliki i migracja43. Manifest Premium55 **niezmieniony**, 54 pliki bajtowo zachowane; w `EventForm.tsx` wyłącznie istniejące pole minimum zamiast stałego tekstu LIVE „Minimum 10”. Kontrola odwraca tę jedną zamianę i porównuje dawny hash. CSS, grafiki, układ karty i nawigacja niezmienione.
3. Nowy kontrakt CI `023dc9bfe5aef7f2ec2339495101870f4f364f6a`, osobny wskaźnik `2de6e5e8669dd9aa36ac980ba8ab2e86beb88349`. Dokładna nakładka 24 plików na `0d82b09`, bez wildcardów. Poprzednie implementacje PR31/Stage2C, ancestry `d7b36ee`/`cb63962`, repo/SHA/workflow/lokalność Dockera pozostają obowiązkowe. Bez przepisywania historii.
4. Demo dopuszcza tylko dwa konkretne, czyste pliki prezentacji/walidacji telefonu; produkcyjny Auth/API nadal zabroniony. Osobny test sprawdza tę izolację.

Dokładny diff: [review/minimum-phone-runtime.diff](review/minimum-phone-runtime.diff). Wyniki wykonanych prób: [review/minimum-phone-test-results.txt](review/minimum-phone-test-results.txt). Żaden guard nie został wyłączony. Aktualizacja kontraktów wymaga przeglądu właściciela; lokalny PASS nie zastępuje tej decyzji.

## Faktycznie wykonane testy

| Kontrola | Wynik |
|---|---|
| TypeScript, ESLint, strict Edge | PASS |
| Vitest | PASS 387/387, 59 plików |
| Premium policy, testy negatywne | PASS 61/61 |
| Consolidation / frozen UI | PASS 43 migracje / Premium55 / 13 granic importu |
| Linux SourceTests | PASS 32/32, dodatkowo 87 rzeczywistych odmów mutacji źródeł |
| Windows SourceTests | 31 PASS + błąd środowiska WinError1314 przy symlinku; test zachowany, pełny odpowiednik Linux PASS |
| SQL/RLS/PostgREST, współbieżność/restart | PASS 51 na nowej izolowanej fixture43 |
| Rzeczywisty GoTrue → Edge → PostgREST → PostgreSQL | PASS 47 (34 minimum/telefon + 13 dotychczasowych) |
| Migracja 42→43 i atomowy rollback błędnego kontraktu | PASS, wcześniejsza nowa fixture, bez dotykania używanej bazy |
| Web, Android Stage3 web, izolowany demo build | PASS; demo kontrola 16 artefaktów |
| Capacitor sync / Gradle offline assembleDebug, testDebugUnitTest, assembleDebugAndroidTest | PASS; JVM 1/1 |
| Emulator, natywny SlmWindowInsetsTest przez ADB | PASS 2/2 |
| Podpis i zawartość APK | PASS: właściwy appId, endpoint lokalny, brak logowania mostu i debugowania WebView |
| GitHub-hosted / POCO / Cloud / Storage / FCM | NOT RUN; nie aktywowano Actions ani usług |

SQL/API/Linux/policy/Vitest wykonano 02.11; TypeScript/lint/strict Edge/buildy/Gradle/natywne testy powtórzono 03.11 na tych samych źródłach. Nie powtarzano pełnych kosztownych fixture bez zmiany źródeł. Testy HTTP obejmują błędne hasło, kolizje między modelami, brak przejęcia konta, odrzucenie starej sesji/aliasu, logout, leave/revoke, odmowę RPC, prywatność bezpośredniego REST, CAS, idempotencję i prawdziwy próg po 17:00. Pełny historyczny pakiet instrumentacji ma znany szablonowy test oczekujący `com.getcapacitor.app`; nie zmieniano tej asercji i nie deklaruje się jego PASS. Cypress pełnej aplikacji i ręczny odbiór telefonu: NOT RUN w tej poprawce.

## APK i aktualizacja bez czyszczenia danych

Lokalny APK: `.cache/minimum-phone/slm2-minimum-phone-debug.apk` w tym worktree. SHA256 `2c7aa0f44802d1f2bb08525999041538e8b1c7eb30baf07da413592d9c887c4d`. Debug, `pl.psuda87.slm`, natywne versionName/code nadal `1.0/1`; dokładną poprawkę identyfikuje gałąź i SHA, nie numer wersji Androida. Podpis debug ma SHA256 `1324e26980d16dbdca3dac8830b752924960ab1bcd418f84083f549f00692457`.

APK celowo wskazuje `http://127.0.0.1:64321/functions/v1/accounts`. Backend43 jest odrębny od RC42/55421; relay43 działa na loopback **55431**. Zatrzymanie Dockera nie usuwa danych. Pomocnik najpierw sprawdza zapisane ID, obrazy, etykiety i lokalność czterech własnych kontenerów, uruchamia PostgreSQL i czeka na gotowość przed pozostałymi usługami. Nie migruje bazy przy wznowieniu. Istniejący runner nadaje technicznym JWT fixture ważność jednej godziny: wznowienie odświeża wyłącznie ten sam bezstanowy kontener Edge, zachowując bazę, klucz podpisu, konta i źródła. Nie przedłużano tokenów ani nie osłabiano uwierzytelniania. To sesyjna fixture odbiorowa, nie całodobowy Supabase Cloud. Po godzinie należy zakończyć pomocnika i wznowić go przed kolejną sesją:

```powershell
Set-Location I:\slm\sunday-league-mates\.worktrees\slm2-minimum-phone
# Gdy Docker Desktop już działa i port 55431 jest wolny:
python -X utf8 -B docs/review/test-minimum-phone-local.py --fixture-repo .cache/minimum-phone/canonical --resume
# Osobne okno; kontrola backendu:
Invoke-RestMethod http://127.0.0.1:55431/healthz
adb devices -l
# Podstaw właściwy serial POCO; nie używaj emulator-5554 dla telefonu.
$pocoSerial = 'SERIAL_POCO'
adb -s $pocoSerial reverse --list
adb -s $pocoSerial reverse tcp:64321 tcp:55431
adb -s $pocoSerial install -r .cache/minimum-phone/slm2-minimum-phone-debug.apk
adb -s $pocoSerial shell am start -n pl.psuda87.slm/.MainActivity
```

Jeśli instalator zgłosi różny podpis, **przerwij** — nie odinstalowuj i nie używaj `pm clear`. `install -r` zachowuje dane aplikacji. Nowy izolowany backend wymaga własnego logowania testowego; poprzednie konta/dane zostają w poprzedniej bazie RC42. Fikcyjne dane logowania są tylko w ignorowanym `.cache/minimum-phone/TEST-LOGIN.txt`; nie publikować. Przykładowy mecz fixture43 ma minimum13/limit15 i 13 zapisanych (2 konta + 11 gości); wcześniejszy mecz RC42 z 13 kontami pozostał bez zmian.

Odbiór: utwórz i edytuj minimum, sprawdź licznik po ponownym wejściu; odrzuć minimum ponad limit; sprawdź konflikt dwóch edycji; po 17:00 sprawdź wyłącznie sygnał decyzji administratora, bez automatycznego odwołania. Zmień własny telefon z `+48` i obecnym hasłem, wyloguj/zaloguj, odrzuć zły format/hasło/duplikat. Sprawdź prywatną grupę, gości, finanse i składy dotychczasowym przepływem. Bez Cloud i migracji używanej bazy.

## Końcowy odbiór 03.11

**PASS z ostrzeżeniami środowiskowymi.** Docker Desktop po ponownym uruchomieniu działa (29.8.2). Wznowienie własnej fixture43 przetestowano rzeczywiście: health, świeże logowanie, odczyt profilu i zapisy API PASS. Naprawiono kolejność startu PG/Auth i wygasłe techniczne JWT przy wznowieniu; bez resetu bazy i bez nowych równoległych środowisk.

Emulator API36.1: instalacja `-r` bez czyszczenia danych, starej sesji nie zaakceptowano w innej fixture; rzeczywiste logowanie e-mail, karta13/15, otwarcie edycji, podgląd minimum12, zapis i niezależny odczyt API minimum12 PASS. Minimum przykładowego meczu przywrócono do13 przez autoryzowane CAS API; liczba uczestników13 zachowana. Zmiana kontaktu `+48` z profilu i obecnym hasłem zapisała kanoniczny numer; edytor zamknął się po potwierdzeniu, ponowne logowanie e-mailem i niezależny odczyt API PASS. Użyto wyłącznie fikcyjnych kont; POCO bez zmian.

Zrzuty bez haseł: [minimum-field.png](ui/minimum-phone/minimum-field.png), [phone-form.png](ui/minimum-phone/phone-form.png). Na GitHub: `https://github.com/psuda87/sunday-league-mates/blob/fix/slm2-minimum-phone/docs/ui/minimum-phone/`.

Wypchnięto gałąź i utworzono [Draft PR #33](https://github.com/psuda87/sunday-league-mates/pull/33) do `release/slm-2.0-rc/fa6bc792`. GitHub potwierdził open/draft, merged=false, mergeable=true/clean. Dla opublikowanego kodu `1ec4e0ae42cb607845e933381e52d7ec90ba2ff0` brak workflow runs; GitHub-hosted **NOT RUN**, bez aktywowania Actions. Końcowe commity po kompilacji dotyczą wyłącznie dokumentacji/pomocnika fixture; źródła aplikacji identyczne z zestawem testowanym i APK. Końcowy source gate sprawdzany jest również w czystym klonie LF, bez fałszowania kontekstu GitHub.

Do integracji potrzebny jest odbiór dokładnych kontraktów przez właściciela i zwykły merge z zachowaniem historii, bez squash/rebase. Do POCO potrzebne są zgodny podpis dotychczasowego APK, fizyczne połączenie USB i reverse do backendu43; test telefonu pozostaje NOT RUN. Cloud nie jest celem tego APK i nie był modyfikowany. Finalny SHA to HEAD gałęzi poprawkowej/PR33 po zapisie publikacji; zwraca go `git rev-parse HEAD`.

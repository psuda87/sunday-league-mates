# Premium B3 — prawdziwe grupy w zatwierdzonym UI

Stan: 2026-10-25 21:05 Europe/Warsaw; gałąź `feat/premium-b3-groups`, baza `main a46f5e4`.
PR: [#13](https://github.com/psuda87/sunday-league-mates/pull/13), draft, bez scalania. Commit implementacji `7a9f41f`. B3 wymaga odbioru i osobnej zgody na merge. B4 nie rozpoczęto.

## Zakres i ponowne wykorzystanie

| Obszar | Stan i źródło |
|---|---|
| Domyślny LIVE | Zachowany routing i prawdziwe grupy/mecze/finanse z main |
| Premium Auth/profil/zdjęcie/numer | Istniejące B1/B2, prawdziwy backend, bez cofania integracji |
| Premium grupy | LIVE lokalnie: istniejące GroupScreens i selektory, adapter src/groups |
| Wyszukiwanie | Publiczne grupy i ograniczone kandydatury przez istniejące RPC |
| Członkostwo | Zaproszenia, propozycje, prośby, decyzje, anulowanie, role, sukcesja i odejście — istniejący dispatcher |
| Profil członka | Rzeczywisty UUID, prywatna projekcja grupowa, telefon w dozwolonym zakresie, numer; statystyki — |
| Cudze zdjęcia | Niedostępne; nie rozszerzono prywatnego Storage własnego zdjęcia |
| Premium mecze/uczestnicy meczu/składy/finanse | Nadal jednoznaczne demo, bez integracji B4 |

Nie utworzono nowego modelu członkostwa ani kopii biznesowego reducera demo. `useGroups` mapuje odpowiedzi istniejącego API do wąskiej prezentacji GroupWorld, bez początkowych fixture/statystyk. Stare mutacje, blokady i idempotencja pozostają w bazowym dispatcherze. Błąd/niezgodny starszy kontrakt usuwa dane z widoku i pokazuje ponowienie; nie uruchamia demo jako zastępstwa. Generacje żądań blokują późne wyniki po wylogowaniu/unmount. Poprawiono także montowanie niegotowej listy członków podczas ładowania.

## Prywatność i zabezpieczenia

- Pseudonim publiczny; fallback nie ujawnia nazwiska. Pełne imię i nazwisko: właściciel i administrator grupy, inni członkowie dopiero po dobrowolnej zgodzie dla konkretnej grupy. Potwierdzony wyjątek właściciela: administrator widzi nazwisko do zarządzania. Domyślna zgoda false, ponowne dołączenie nie przywraca starej zgody.
- Telefon: zaakceptowani członkowie wspólnej grupy; administrator także przy dobrowolnej oczekującej prośbie o dołączenie. Outsider nie uzyskuje profilu/telefonu. Formularze informują o zakresie ujawnienia.
- Projekcja profilu i RLS kontrolują relację i sesję serwerowo. Wstrzyknięcie cudzego user_id, utrata członkostwa, zmiana roli i cofnięcie zgody objęte testami.
- Wyszukiwanie po telefonie nie zdradza istnienia konta także przez liczniki/powtórzenia/niezależnych nadawców. Prywatny skrót normalizowanego telefonu służy deduplikacji i nigdy nie trafia do odpowiedzi klienta.
- Publiczne wrappery RPC: security invoker, pusty search_path, tylko service_role. Prywatne funkcje pomocnicze i wcześniejsze implementacje nie są API klienta. Brak uprawnień klienta do prywatnych danych przez nowe funkcje.
- Bez zmian Auth, Keystore/tokenStore, haseł, migracji historycznych, mechanizmów finansowych i prywatnego bucketa zdjęć. Lokalne testy mediów potwierdzają zapis/odczyt/usunięcie własnego WebP i zachowanie numeru.

## Migracje i odtwarzalność

Kanoniczne źródło: `app/supabase`, nie cudzy worktree ani ręczny SQL w .cache. Zachowano bajtowo po normalizacji LF wszystkie 32 migracje main (manifest z bazą a46f5e4).
Nowe wersje, utworzone przez CLI:

- `20261025190022_premium_b3_groups_privacy.sql`: zgoda per grupa, bezpieczne projekcje/RLS, wrapper istniejących operacji. Zastąpiono wyłącznie ujawniające nazwisko etykiety w starych odpowiedziach wydarzeń/finansów, z kontrolą oczekiwanego kontraktu; bez zmiany obliczeń i historii.
- `20261025193229_premium_b3_phone_receipt_privacy.sql`: zabezpieczenie bocznego kanału wyszukiwania telefonu i liczników.

Właściciel osobno zatwierdził zastosowanie tylko w istniejącym lokalnym Dockerze: wersjonowane B2.2 i B3. Lokalnie zastosowano brakujące B2.2 oraz obie migracje B3, bez resetu i bez usuwania danych. Pełny replay 34 migracji z historycznymi fikcyjnymi danymi przechodzi. Skrypty pilnują brancha, localhost/projektu/kontenera. `prepare-edge-local.py` kopiuje aktualne kanoniczne funkcje do ignorowanego katalogu roboczego; .cache nie jest źródłem schematu. Edge lokalnie obsługuje aktualny handler.

## Różnice lokalnie / chmura — odczyt, bez wdrożenia

| Kontrola | Lokalny Docker | Supabase Cloud hjtcyybkxebvdropchac |
|---|---|---|
| Status | Działa, API 127.0.0.1:54321 | Końcowy ACTIVE_HEALTHY, eu-west-1 |
| Historia migracji | 34 | 7, ostatnia 20261013213917 events_finite_costs |
| Tabele aplikacji slm_* | 46, RLS włączone | 13, RLS włączone |
| Grupy/B3/player_profiles/finanse/powiadomienia | Obecne | Brak odpowiednich tabel i kontraktów |
| Bucket slm-profile-photos | Prywatny | Brak |
| Edge accounts | Źródła B3 lokalnej gałęzi | ACTIVE, wersja 6; treść wdrożonego kodu niezweryfikowana |

Na początku projekt Cloud raportował INACTIVE, pod koniec ACTIVE_HEALTHY. Agent nie zmieniał jego stanu; ponowiono wyłącznie odczyty. Brakuje 27 wersji migracji i 33 tabel względem lokalnego schematu. Historyczne Cloud `members_read_profiles` dopuszcza odczyt profili na podstawie ważnej sesji (`current_session_valid()`), nie egzekwuje modelu B3. Nie należy podłączać tego wydania B3 do Cloud bez odrębnego audytu/zgody, kopii bezpieczeństwa, uporządkowania historii i zgodnego wdrożenia Edge. Nie wykonywać automatycznego db push.

Lokalne security advisors: 0 WARN/ERROR; SQL lint: cztery znane ostrzeżenia (runtime push_claim poprawny; kompatybilny p_number i nieużywane v_before/v_rows), brak nowego ostrzeżenia B3.
Cloud advisors: 1 istniejący WARN — wyłączona ochrona przed ujawnionymi hasłami; 9 INFO — RLS bez polityk na tabelach serwerowych (odmowa dostępu klienta). Nie zmieniano konfiguracji ani planu. Oficjalne objaśnienia: [hasła](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [RLS bez polityk](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
Nie wykonywano zdalnego logowania, testów danych użytkowników, migracji, zmian Storage ani wdrożenia Edge.

## Wyniki automatyczne

| Kontrola | Wynik |
|---|---|
| TypeScript / lint | PASS |
| Vitest | 235 PASS / 40 plików, w tym 6 testów adaptera B3 |
| SQL v2 + B3 | 102 PASS, uprawnienia/wielu użytkowników/dwie grupy/wyścigi/prywatność |
| Historyczne SQL | 31 PASS |
| Replay + historia | 11 PASS / 34 migracje, zachowane istniejące wiersze ledger i aliasy |
| B3 rzeczywisty Auth + HTTP + PostgreSQL | 28 PASS, cztery nowe fikcyjne konta lokalne i dwie grupy |
| B3 rzeczywista przeglądarka | 1 PASS: utworzenie/zgoda/profil/back/reselect/reload/szukaj; 320/360/390/430 px × Light/Dark |
| LIVE rzeczywisty HTTP / przeglądarka | 20 PASS / 1 PASS |
| Istniejący Cypress LIVE | 13 PASS / 5 spec |
| Cypress B1/B2/B2.2 | 6 PASS / 3 spec, kontrolowane odpowiedzi API |
| Build main/demo/Premium/LIVE local | PASS; demo isolation PASS |
| Source guards | 32 historyczne migracje i 55 kontrolowanych plików Premium PASS |
| Capacitor sync / Android assembleDebug | PASS |
| Android unit | 1 istniejący test szablonowy PASS; nie jest dowodem zabezpieczeń Keystore |

SQL używa własnych baz scratch, usuwa wyłącznie te bazy. Testy HTTP zachowują świeże fikcyjne konta/grupy, bez zmiany istniejących użytkowników. Nie użyto produkcyjnych danych. Obrazy w docs/ui/premium-b3 zawierają wyłącznie fikcyjne dane automatycznego testu.
CSS, UltimatePlayerCard, BottomNav, oryginalny domyślny App/routing i lockfile bez zmian. Zmodyfikowane pliki prezentacji: demo/App.tsx (slot), GroupScreens.tsx (istniejące kontrolki i binding), Identity.tsx (typ), Profile.tsx (oznaczenie demo), groups.ts (węższe typy selektorów); nowy groups/PremiumGroups.tsx. Manifest opisuje wyłącznie te wyjątki integracyjne, pozostałe hashe zachowane. Nie deklarujemy ponownego ręcznego odbioru wyglądu B3.

## APK i odbiór POCO

APK: `.cache/consolidation/premium-debug.apk`, świeży build wariantu premium z tej gałęzi, applicationId `pl.psuda87.slm`, nazwa Sunday League Mates.
SHA256: `1d6586284b7e4f095942d8d9e68a98b9b6cddf8fbdcebd249e4e11b612ad975a`.
Weryfikacja APK: dokładna zgodność zasobów z dist-b1, lokalny endpoint, brak markerów service key.
**Zainstalowano przez adb install -r i uruchomiono na c7a559b5**, bez uninstall/clear. Reverse 54321 zachowany. W logach raz MIUI PeriodicCleaner zakończył proces pod presją pamięci; ponowne otwarcie Status ok, bez znalezionego FATAL EXCEPTION. Nie mylić uruchomienia z odbiorem B3 na ekranie telefonu.

Ręczny odbiór B3: **NOT TESTED / oczekuje właściciela**. Wcześniejsze 7/7 konsolidacji i odbiór B2 nie zastępują B3.

1. Zaloguj się dotychczasowym lokalnym kontem. Grupy mają oznaczenie Supabase; Mecze pozostają Dane przykładowe.
2. Utwórz/wyszukaj grupę, sprawdź zaproszenie i prośbę na osobnych kontach testowych; przyjęcie, odrzucenie i anulowanie oraz odświeżenie.
3. Otwórz członka, sprawdź rzeczywisty pseudonim/numer i dozwolony telefon. W dwóch grupach sprawdź niezależną zgodę na nazwisko; administrator widzi nazwisko także bez niej, inny członek tylko po zgodzie.
4. Sprawdź role/zmianę administratora/wyjście bez utraty historii; outsider nie może otworzyć profilu. Testy bezpieczeństwa automatyczne są opisane powyżej.
5. Sprawdź oba Wstecz, wybór zakładki Grupy po otwarciu profilu, restart/sesję oraz dotychczasowy zapis imienia, numeru i dodanie/podmianę/usunięcie własnego zdjęcia.
6. Potwierdź Ultimate/BottomNav i oba motywy. Nie wysyłaj hasła, tokenów ani prywatnych zdjęć do raportu.

Następny krok: odbiór lokalnego B3, przegląd PR i osobna decyzja o merge do main. B4 oraz zdalny rollout wymagają kolejnych poleceń. Znane ograniczenia: cudze zdjęcia/statystyki niedostępne, brak testów FCM/iOS/Cloud; brak integracji wydarzeń Premium z prawdziwymi grupami.

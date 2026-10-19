# Aktualny stan Sunday League Mates

19.10.2026 ? branch roboczy `feat/integration`, worktree `I:\slm\sunday-league-mates-integration`.
Rdze? integracji zapisano w `0ec5200`; etap: audyt, zabezpieczenie na GitHubie i integracja przez PR. Bez wdro?enia aplikacji i zdalnej bazy.

## Wykonane funkcje

- Auth legacy i logowanie potwierdzonym e-mailem, profil, wymuszona zmiana has?a, reset oraz bezpieczna trwa?a sesja.
- Wiele grup, zgody/zaproszenia, role, sukcesja i zachowanie w?asnej historii.
- Mecze publiczne/prywatne, atomowe zapisy, go?cie, osobna rezerwa bez autoawansu, obecno?? i odwo?anie.
- Finanse oddzielone mi?dzy grupami: celowe wp?aty, FIFO, korekty, zwroty, audyt i osobne nadwy?ki naliczone/otrzymane.
- Globalna blokada nowych p?atnych zapis?w po dw?ch kwalifikuj?cych zaleg?o?ciach; brak wgl?du w cudze finanse.
- Transakcyjny inbox/outbox powiadomie? finansowych i wydarze?, worker i recheck odbiorc?w; FCM nieaktywne.
- Nowszy interfejs Premium z ui-beta po??czony z rzeczywistym backendem; demo buduje si? osobno.

## Migracje i Edge Functions

Lokalnie zastosowano 29 migracji: 13 historycznych i 16 nowych; ko?cowa `20261019175940_slm_v2_legacy_payment_dto.sql`.
Lokalnie dzia?aj? `accounts` i `push-worker`. W tym etapie nie wdra?ano niczego do chmury, nie zmieniano konfiguracji Supabase/Firebase/SMTP ani plan?w.
Przed przysz?ym rolloutem wymagany osobny przegl?d trzech napraw historycznych migracji i jednoznacznego mapowania dawnej grupy. Replay na fikcyjnych danych zachowa? histori? ledgeru 1:1.

## Wyniki ponowione w tym zadaniu

- TypeScript, ESLint i Deno: PASS. Vitest: 190/190; bootstrap: 6/6.
- SQL legacy: 31 PASS; SQL v2: 55 PASS; replay wszystkich migracji: 9 PASS.
- HTTP Auth: 7 zestaw?w PASS; scoped: 20 PASS; smoke/worker: 9 PASS.
- Rzeczywista przegl?darka ? lokalny Edge ? PostgreSQL: 1 PASS, bez mock?w.
- Cypress z kontrolowanym API: 13/13. To nie s? testy na telefonie.
- Web build, osobny demo build i izolacja 15 artefakt?w, cap sync android: PASS.
- Android assembleDebug + testDebugUnitTest: BUILD SUCCESSFUL; task jednostkowy UP-TO-DATE, nie nowy odbi?r urz?dzenia.
- SQL lint: exit 0, 3 ostrze?enia, brak b??d?w. Szczeg??y w raporcie audytu.
- npm audit: 6 moderate, w produkcji 3 moderate; 0 high/critical. Raport nie jest czysty.
- Skan stagingu i wychodz?cej historii: brak sekret?w; ?r?d?a Androida i package-lock zachowane. Formatowanie ko?c?w plik?w poprawiono po staged diff --check.
- Po testach: 0 kont/grup/mecz?w/scratch DB; 0 tabel SLM bez RLS; 0 RPC SLM dost?pnych anon.

## Git i zasoby

Auth/events/settlements/push zachowane w historii integracji; ui-beta zachowany na osobnej ga??zi i przeniesiony r?cznie.
Nowy dostarczony herb 1254?1254 zabezpieczono w `docs/branding/slm-crest-duo-source.png`; dwie grafiki ?r?d?owe w `pics/`. Nie podmieniano logo aplikacji 450?505.
Oryginalny worktree ui-beta i jego nie?ledzone pliki zachowano; identyczne kopie grafik s? cz??ci? integracji.
Automatyczne wdro?enia Git dla tej wersji wy??czaj? root i app/vercel.json. Nie wywo?ywano deploy ani produkcyjnych migracji.
Stan i rezultat scalenia nale?y odczyta? z PR `feat/integration` ? `main`; ga??zie ?r?d?owe pozostaj? zachowane.

## Ograniczenia i nast?pny etap

SLM 1.0 NIE jest gotowe do publikacji. Osobnej weryfikacji wymagaj? fizyczny telefon, iOS, rzeczywista dostawa FCM oraz pe?ny email/SMTP/domena/legal/callbacki. Signup i poczta nadal zablokowane; istniej?ce konta dzia?aj?. CAPTCHA od?o?ona.
Vector nadal restartuje si?; nie zmieniano Docker socket ani ustawie? Windows. Testowany rdze? dzia?a bez niego.
Pozosta?y moderate zale?no?ci oraz ostrze?enia bundle/Browserslist/Gradle. Brak skonfigurowanych Actions CI i zabezpiecze? main w chwili audytu; nie zmieniano tych ustawie? i niczego nie omijano.
Nast?pny etap: r?czny odbi?r obecnej integracji na telefonie, przegl?d rollout danych i osobne uzgodnienie poczty oraz FCM. Merge kodu nie oznacza wdro?enia ani gotowo?ci do wydania.

Raport: [REPOSITORY_AUDIT.md](REPOSITORY_AUDIT.md). Szczeg??owa historia: [ODPOWIEDZI_CODEX.txt](ODPOWIEDZI_CODEX.txt).

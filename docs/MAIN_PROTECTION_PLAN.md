# Plan ochrony main i automatycznego CI — 2026-10-28

**Plan, nie aktywacja.** Main134c52b i PR24/39ef2e3 pozostały bez zmian. Odczyty GitHub: `protected=false`, rulesets0. Nie zmieniono reguł, zmiennych repo, wymaganych checków, planu, płatności ani widoczności repo.

Zmiany do przeglądu: [Draft PR26](https://github.com/psuda87/sunday-league-mates/pull/26), baza chore/main-stabilization, nie main.

## Możliwości bezpłatne i nieustalone dane

Repo jest prywatne. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) opisuje bezpłatny przydział, a [aktualna tabela użycia](https://docs.github.com/en/billing/reference/product-usage-included) również przeliczenie przydziału na kwotę compute. Nie należy traktować limitu minut jako gwarancji braku kosztów po wyczerpaniu przydziału. Bez metody płatności GitHub blokuje przekroczenie limitu; przy metodzie płatności potrzebne jest potwierdzone zatrzymanie użycia/budżet. Nie uruchamiano płatnych usług.

API nie ujawniło planu konta; odczyt usage zwrócił404. **Nie potwierdzono pozostałego darmowego limitu ani ustawień nadwyżek.** Nie włączono CI. Właściciel musi sprawdzić Billing/Usage/Budgets w swoim koncie przed opt-in; nie wysyłać sekretów ani danych płatniczych.

[Ochrona prywatnych gałęzi](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) wymaga odpowiedniego już posiadanego planu Pro/Team/Enterprise; GitHub Free udostępnia tę ochronę dla repo publicznych. Jeśli konto ma Free i repo pozostaje prywatne, **nie można obiecać serwerowego wymuszenia tych zasad w bezpłatnym zakresie**. Nie zmieniaj widoczności ani nie kupuj planu automatycznie. Jest to ograniczenie wymagające decyzji właściciela, nie powód do obchodzenia kontroli.

## Przygotowany workflow

`.github/workflows/main-pr-checks.yml`:

- `pull_request` wyłącznie do main: opened/synchronize/reopened/ready_for_review, opcjonalne ręczne uruchomienie. Brak push, cron, pull_request_target i deployu.
- Bramka `vars.SLM_FREE_CI_ENABLED == 'true'`; brak wartości kończy job błędem przed checkout/npm, zamiast dawać pominięty zielony check. Wartości nie ustawiono. Po świadomej integracji workflow pierwszy krok również zużywa niewielki czas runnera, dlatego samo dodanie aktywnego workflow wymaga decyzji o limicie.
- Draft PR nie zużywa pełnego przebiegu; po ready_for_review ma nowy przebieg. Concurrency anuluje przestarzały przebieg tego samego PR. Brak filtrów paths: wymagany check nie utknie dla PR zmieniającego tylko dokumentację.
- Standardowy Ubuntu, Node24, maks20min na jeden job, contents:read, checkout bez pozostawienia credentials; oficjalne actions przypięte pełnym SHA. Brak produkcyjnych sekretów, uploadu artefaktów/cache, nowych bibliotek i usługi SMTP.
- `SLM PR checks`: `npm ci --ignore-scripts`, TypeScript aplikacji/Edge, ESLint, Vitest (w tym Auth/serwer i faktyczne renderowanie B1/Premium), weryfikacja kontraktu/importów/entrypointów/warunków renderowania, próby obejścia, testy kontekstu CLI/CI; build LIVE, Premium, Android web i izolowanego demo.
- Ten sam `SLM PR checks` obejmuje również SQL/HTTP: świeży lokalny Docker Supabase na efemerycznym runnerze, 40 migracji z checkoutu, testy HTTP i SQL/RLS. Bez Cloud/linku/secrets; syntetyczne konta i obrazy. Prywatne logi startu nie są publikowane. Nie korzysta z komputera właściciela ani bazy POCO. Nie proponujemy stałego self-hosted runnera na Windows z dostępem do danych właściciela.

Bramki kontekstu skryptów lokalnych zostały dostosowane do GitHub `refs/pull/N/merge`, właściwego repo i base main. Nadal odrzucają przypadkowe uruchomienie na lokalnym main i używają wyłącznie projektu55321/stałego kontenera. Przygotowanie odtwarza źródła, nie wykonuje resetu ani zdalnych migracji. Docker jest wymagany w zadaniu SQL; nie da się zastąpić jego wyników mockami Vitest.

Nie uruchomiono GitHub-hosted jobów. Lokalnie potwierdzono składnię YAML, 9 pozytywnych/negatywnych przypadków kontekstu (w tym manual main wyłącznie we właściwym CI), guard Premium, TypeScript/lint, 6 zestawów SQL/RLS oraz backend40/CORS i18HTTP przez origin Androida. Poprzednie pełne testy audytu są dostępne, lecz **nie są statusem checka GitHub dla nowego workflow**. Zgodność rzeczywistego runnera Linux/Docker pozostaje do potwierdzenia po zatwierdzonej aktywacji.

## Kolejność bezpiecznej aktywacji — wymaga zgody

1. Odbiór Draft PR przygotowania skierowanego do chore/main-stabilization. Sam push tego PR nie aktywuje workflow do main; nie aktualizowano PR24 ani25.
2. Potwierdź istniejący darmowy limit i blokadę płatnych nadwyżek. Potwierdź dostępność ochrony prywatnego main w posiadanym planie. Jeśli brak dowodów — pozostaw te operacje zablokowane.
3. Po zgodzie zintegruj przygotowanie z właściwą gałęzią. Ustaw niesekretną zmienną repo `SLM_FREE_CI_ENABLED=true` dopiero świadomie; jeden job obejmuje też SQL/HTTP. Pominięcie Draft PR nie jest PASS; brak opt-in po wyjściu z Draft daje czerwony job przed testami. Przy włączaniu do PR24 uwzględnij koszt całego przebiegu w bezpłatnym limicie.
4. Uruchom rzeczywisty przebieg dla aktualnego HEAD i PR do main. Napraw ewentualne błędy runnera. Odczytaj **rzeczywiste nazwy i dostawcę checków** na GitHub. Nie twórz required status z nazwy opisanej tylko w tym pliku.
5. Dopiero po zielonym rzeczywistym przebiegu, dodatkowej zgodzie właściciela i potwierdzonym planie włącz reguły niżej. Nie wymagaj starego ręcznego `SLM consolidation review`, którego nie uruchomiono.
6. Zweryfikuj negatywnie na nieszkodliwej gałęzi/PR: nieaktualna baza, czerwony check, próba bezpośredniego push do main i force/delete mają być odrzucone. Nie testuj destrukcyjnie prawdziwego main; weryfikacja ustawień i kontrolowany test wymagają osobnego planu.

## Rekomendowane reguły main

Nie zastosowano żadnego PUT/PATCH reguł.

| Ustawienie | Rekomendacja po akceptacji |
|---|---|
| Wymagany PR | Tak; blokuje bezpośredni push, z egzekwowaniem również dla administratorów i bez automatycznych bypassów |
| Required status checks | Tylko rzeczywiście działający `SLM PR checks` z GitHub Actions, obejmujący także SQL/HTTP |
| Aktualna baza | Require branches to be up to date / strict=true |
| Force push | Zablokowany dla main |
| Usuwanie main | Zablokowane |
| Rozmowy review | Wymagane rozwiązanie rozmów, jeśli obsługiwane |
| Review człowieka | Właściciel zawsze zatwierdza merge. Dla jedynego właściciela nie ustawiaj automatycznie1 wymaganej aprobaty ani code-owner review: autor nie zatwierdzi własnego PR. Liczbę1 włącz dopiero z niezależnym uprawnionym recenzentem |
| Historia/merge | Preferuj squash dla ukończonego modułu; nie zmieniano polityki repo. Nie usuwaj źródłowych checkpointów potrzebnych guardowi |

Równoważnie można użyć jednego rulesetu main zamiast nakładających się ochron. Nie dodawaj reguły typu „restrict updates” blokującej również dozwolone merge; preferuj wymagany PR/checki i brak bypassów, a dokładne opcje dopasuj do rzeczywiście dostępnego planu. CODEOWNERS samo nie wymusza ochrony. Proces „jedna funkcja → PR → testy → akceptacja → merge → następna funkcja” nie upoważnia agenta do automatycznego scalania.

## Status i blokery

Kod CI jest **przygotowany do przeglądu i kontrolowanej aktywacji**, nie jest jeszcze aktywną ani obowiązkową ochroną. Blokery aktywacji: niepotwierdzony darmowy limit/ustawienia nadwyżek, nieznany plan ochrony prywatnego repo, brak rzeczywistego zielonego przebiegu GitHub. Wymaganie nieistniejących/pomijanych checków byłoby błędem.

Audyt PR24 nie wykazał P0/P1, ale merge nadal wymaga odbioru właściciela, decyzji o pozostałych P2/P3, odbioru Androida oraz uzgodnienia powyższej polityki kontroli. Nie wykonano merge, zmian branch protection, Cloud ani instalacji telefonu. Android/checklista/artefakt: `docs/ANDROID_MAIN_ACCEPTANCE.md`. Chronologiczny zapis: `docs/ODPOWIEDZI_CODEX.txt`.

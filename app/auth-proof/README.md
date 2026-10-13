# Archiwalna infrastruktura próby Auth

`setup.sql` i `run.mjs` dokumentują historyczny proof opisany w `docs/AUTH_PROOF.md`.
Nie są backendem aplikacji. Po utworzeniu modułu `accounts` harness odmawia uruchomienia,
aby nie przywrócić starych hooków ani ponowić otwartego testu zmiany e-maila.

Wzorce kontroli sesji i hooków zastąpiono docelowymi migracjami w `../supabase/`.
Trzy puste tabele `slm_auth_proof_*`, ich prywatny schemat i stare hooki są oznaczone
do usunięcia po zamknięciu historycznego proof. Dostęp anon/authenticated odebrano;
testowy RPC `slm_auth_proof_is_admin` usunięto. Aktywna konfiguracja wskazuje nowe hooki.
Nie ma wdrożonej testowej Edge Function ani endpointu bootstrap.

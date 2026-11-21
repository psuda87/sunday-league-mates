-- Wyzwalacze wpłat (finance_immutable, finance_payment_guard, group_payment_identity_guard) wołają
-- slm_private.privacy_redaction_ok jako rola wywołująca, czyli service_role (Edge -> PostgREST).
-- Migracja prywatności zabrała tej roli EXECUTE, więc każda zmiana istniejącej wpłaty
-- (akceptacja, odrzucenie, cofnięcie) kończyła się 42501 -> PostgREST 403 -> Edge 503, bez widocznego efektu.
-- Funkcja zwraca false dla każdego, kto nie jest właścicielem slm_deletion_step w trakcie przygotowanego usuwania konta,
-- więc przyznanie EXECUTE nie osłabia reguł niezmienności wpłat.
grant execute on function slm_private.privacy_redaction_ok(text,jsonb,jsonb) to service_role;

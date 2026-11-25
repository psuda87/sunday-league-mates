-- Naprawa 2026-11-25: vote_reminders() nie miało grantu dla service_role, więc slm_notifications_prepare
-- (security invoker) kończyło się 42501/403 i push-worker nie wysyłał żadnych powiadomień od 23.11.
grant execute on function slm_private.vote_reminders() to service_role;

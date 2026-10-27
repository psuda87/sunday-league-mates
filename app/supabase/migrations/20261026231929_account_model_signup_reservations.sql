-- Completed registration history must not reserve an old nickname forever.
begin;
alter table public.slm_signup_jobs drop constraint slm_signup_jobs_nickname_key_key;
create unique index slm_signup_pending_nickname_key on public.slm_signup_jobs(nickname_key) where completed_user is null;
commit;

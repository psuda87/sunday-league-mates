-- Deployment step, NOT run by migrations or during implementation.
-- Requires already available pg_cron, pg_net and Supabase Vault; no paid service.
-- Owner stores the existing backend service-role credential directly in Vault
-- under slm_accounts_worker_key. Never paste a credential into this source file.
-- Fail closed if the required platform pieces or credential are absent.
begin;
do $$begin
 if to_regprocedure('cron.schedule(text,text,text)') is null
 or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null
 or not exists(select 1 from vault.decrypted_secrets where name='slm_accounts_worker_key')
 then raise exception 'privacy_worker_prerequisites_missing';end if;
end $$;
-- This SQL stores only the secret NAME in cron, never its value. No HTTP call
-- occurs while the queue is empty. Daily job records contain only request IDs.
select cron.schedule('slm-account-privacy','*/5 * * * *',$job$
 select net.http_post(
 url:='https://hjtcyybkxebvdropchac.supabase.co/functions/v1/accounts',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||
 (select decrypted_secret from vault.decrypted_secrets where name='slm_accounts_worker_key')),
 body:='{"action":"account_privacy_worker"}'::jsonb,timeout_milliseconds:=10000)
 where jsonb_array_length(public.slm_deletion_work())>0;
 $job$);
commit;

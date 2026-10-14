-- NIEURUCHOMIONY skrypt konfiguracji, nie migracja. Uruchomić później po przeglądzie.
-- W Supabase włączyć bezpłatne pg_cron i pg_net oraz dodać sekrety przez Vault UI:
-- slm_push_worker_url: https://<projekt>.supabase.co/functions/v1/push-worker
-- slm_push_worker_secret: ta sama wartość co PUSH_WORKER_SECRET w Edge.
-- Nigdy nie wpisywać wartości sekretów w tym pliku ani w repozytorium.
do $$ begin
 if not exists(select 1 from pg_extension where extname='pg_cron')
  or not exists(select 1 from pg_extension where extname='pg_net') then
  raise exception 'Włącz pg_cron i pg_net przed konfiguracją harmonogramu';
 end if;
end $$;
-- Ponowne wykonanie aktualizuje harmonogram o tej samej nazwie, nie mnoży zadań.
select cron.schedule('slm-notification-reminders','* * * * *',
 'select public.slm_notifications_prepare();');
select cron.schedule('slm-push-dispatch','* * * * *', $job$
 select net.http_post(url:=config.url,
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||config.secret),
  body:='{}'::jsonb,timeout_milliseconds:=60000)
 from (select
  (select decrypted_secret from vault.decrypted_secrets where name='slm_push_worker_url' limit 1) url,
  (select decrypted_secret from vault.decrypted_secrets where name='slm_push_worker_secret' limit 1) secret) config
 where config.url is not null and config.secret is not null;
$job$);

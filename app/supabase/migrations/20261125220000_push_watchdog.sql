-- Strażnik wysyłki pushy (decyzja właściciela 2026-11-25): awaria z 23–25.11 (403 w push-workerze) przeszła niezauważona.
-- Co 2 godziny (o :17) sprawdzamy, czy powiadomienia nie utknęły w kolejce (>15 min) albo worker nie zwraca serii błędów.
-- Jeśli tak — administratorzy główni aktywnych grup dostają powiadomienie w aplikacji (najwyżej raz dziennie).
create or replace function slm_private.push_watchdog() returns integer
language plpgsql security invoker set search_path='' as $$
declare stuck integer; failing integer; admins uuid[];
begin
 select count(*) into stuck from public.slm_push_queue q join public.slm_notifications n on n.id=q.notification_id
  where q.state in ('pending','leased') and n.created_at<clock_timestamp()-interval '15 minutes';
 select count(*) into failing from net._http_response r
  where r.created>clock_timestamp()-interval '2 hours' and coalesce(r.status_code,0) not between 200 and 299;
 if stuck=0 and failing<3 then return 0; end if;
 select array_agg(distinct g.admin_id) into admins from public.slm_groups g where not g.archived and g.admin_id is not null;
 if admins is null then return 0; end if;
 perform slm_private.notification_emit('pushalarm:'||to_char(clock_timestamp() at time zone 'Europe/Warsaw','YYYY-MM-DD'),
  'push_alarm','reminder',null,'Powiadomienia push nie działają',
  'Wysyłka powiadomień na telefony jest zatrzymana (zaległe w kolejce lub błędy serwera). Powiadomienia w aplikacji działają normalnie. Zgłoś to do naprawy.',
  clock_timestamp()+interval '2 days',admins);
 return 1;
end $$;
revoke all on function slm_private.push_watchdog() from public,anon,authenticated;
grant execute on function slm_private.push_watchdog() to service_role;
select cron.unschedule(jobid) from cron.job where jobname='slm-push-watchdog';
select cron.schedule('slm-push-watchdog','17 */2 * * *','select slm_private.push_watchdog();');

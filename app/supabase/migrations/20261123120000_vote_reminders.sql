-- Przypomnienia o ocenie i głosowaniu na MVP (decyzja właściciela 2026-11-23): push 12 h i 24 h po zakończeniu meczu
-- do zawodników, którzy zagrali i nie oddali jeszcze głosu. Okno oceny (48 h od końca meczu) bez zmian.
-- Okna 12-24 h i 24-48 h (nie "od 12 h"), żeby po wdrożeniu stare mecze nie wywołały lawiny.
-- Idempotencja: klucz źródła (przypomnienie, mecz, użytkownik). Kategoria "reminder" (ta sama co przypomnienie o meczu).
create or replace function slm_private.vote_reminders() returns integer
language plpgsql set search_path='' as $$
declare m record; u record; n integer:=0; v_now timestamptz:=clock_timestamp(); v_hours integer; v_left integer; v_before integer;
begin
 for m in select mm.id,mm.name,mm.starts_at+make_interval(mins=>mm.duration_minutes) ends from public.slm_matches mm
   where mm.status<>'cancelled'
    and mm.starts_at+make_interval(mins=>mm.duration_minutes)+interval '12 hours'<=v_now
    and mm.starts_at+make_interval(mins=>mm.duration_minutes)+interval '48 hours'>v_now
    and not exists(select 1 from public.slm_match_rating_state s where s.event_id=mm.id and s.finalized_at is not null) loop
  v_hours:=case when v_now>=m.ends+interval '24 hours' then 24 else 12 end;
  v_left:=48-v_hours;
  for u in select distinct x.user_id from slm_private.rating_participants(m.id) x
    where not exists(select 1 from public.slm_match_votes v where v.event_id=m.id and v.voter_id=x.user_id)
     and exists(select 1 from public.slm_account_security a where a.user_id=x.user_id and a.active) loop
   select count(*) into v_before from public.slm_notification_sources where source_key='votereminder:'||v_hours||':'||m.id||':'||u.user_id;
   perform slm_private.notification_emit('votereminder:'||v_hours||':'||m.id||':'||u.user_id,'vote_reminder','reminder',null,
    'Oceń graczy i zagłosuj na MVP','Mecz „'||m.name||'”: zostało '||v_left||' godz. na ocenę i głosowanie.',m.ends+interval '48 hours',array[u.user_id]);
   if v_before=0 then n:=n+1; end if;
  end loop;
 end loop;
 return n;
end $$;
revoke all on function slm_private.vote_reminders() from public,anon,authenticated;
grant execute on function slm_private.vote_reminders() to service_role;

-- Wywołanie z cyklicznego przygotowania powiadomień (jak przypomnienia o płatności).
create or replace function public.slm_notifications_prepare() returns integer
language plpgsql set search_path='' as $$
declare e public.slm_matches;r public.slm_match_reminders;recipients uuid[];n integer;
begin
 n:=slm_private.legacy_notifications_prepare();
 for e in select * from public.slm_matches where id in(select match_id from public.slm_match_reminders where state='pending' and due_at<=clock_timestamp()) order by starts_at,id limit 100 for update skip locked loop
  for r in select * from public.slm_match_reminders where match_id=e.id and state='pending' and due_at<=clock_timestamp() for update loop
   if e.status='cancelled' or e.starts_at<>r.starts_at then update public.slm_match_reminders set state='cancelled' where id=r.id;
   elsif clock_timestamp()>=e.starts_at or(r.hours_before=24 and clock_timestamp()>=e.starts_at-interval '2 hours') then update public.slm_match_reminders set state='skipped' where id=r.id;
   else
    select array_agg(distinct responsible_user_id) into recipients from public.slm_match_entries where event_id=e.id and status='registered';
    perform slm_private.match_notification_emit('v2:reminder:'||r.id,'reminder','reminder',e.id,recipients);
    update public.slm_match_reminders set state='emitted' where id=r.id;n:=n+1;
   end if;
  end loop;
 end loop;
 n:=n+slm_private.payment_reminders();
 n:=n+slm_private.vote_reminders();
 return n;
end $$;

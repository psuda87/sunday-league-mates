-- Przypomnienia o płatności (push, kategoria finance): 24 h po zakończeniu meczu oraz 24 h przed kolejnym meczem, na który użytkownik jest zapisany.
-- Zaległość liczy ta sama funkcja co ekran „Zaległe płatności” (slm_private.group_dues). Idempotencja: klucz źródła (mecz, użytkownik).
create or replace function slm_private.payment_reminders() returns integer
language plpgsql set search_path='' as $$
declare u uuid; d record; m record; n integer:=0; v_now timestamptz:=clock_timestamp(); v_ends timestamptz; v_name text; v_total bigint; v_before integer;
 v_amount text;
begin
 for u in select user_id from (select user_id from public.slm_group_ledger union select user_id from public.slm_finance_ledger) l
   where exists(select 1 from public.slm_account_security where user_id=l.user_id and active) loop
  select coalesce(sum(outstanding_cents),0) into v_total from slm_private.group_dues(u) where outstanding_cents>0;
  continue when v_total<=0;
  -- 24 h po zakończeniu meczu (okno 24-72 h, żeby stare zaległości nie wywołały lawiny po wdrożeniu).
  for d in select * from slm_private.group_dues(u) where outstanding_cents>0 loop
   v_ends:=null; v_name:=null;
   select mm.starts_at+make_interval(mins=>mm.duration_minutes),mm.name into v_ends,v_name from public.slm_matches mm where mm.id=d.event_id;
   if not found then
    select ee.starts_at+make_interval(mins=>ee.duration_minutes) into v_ends from public.slm_events ee where ee.id=d.event_id;
   end if;
   continue when v_ends is null or v_now<v_ends+interval '24 hours' or v_now>=v_ends+interval '72 hours';
   v_amount:=replace(to_char(d.outstanding_cents/100.0,'FM999999990.00'),'.',',');
   select count(*) into v_before from public.slm_notification_sources where source_key='payreminder:post:'||d.event_id||':'||u;
   perform slm_private.notification_emit('payreminder:post:'||d.event_id||':'||u,'payment_reminder','finance',null,
    'Przypomnienie o płatności','Zaległa wpłata '||v_amount||' zł'||coalesce(' za mecz „'||v_name||'”','')||'. Zgłoś wpłatę w profilu.',v_now+interval '1 day',array[u]);
   if v_before=0 then n:=n+1; end if;
  end loop;
  -- 24 h przed kolejnym meczem, na który użytkownik jest zapisany, jeśli zaległość nadal istnieje.
  v_amount:=replace(to_char(v_total/100.0,'FM999999990.00'),'.',',');
  for m in select mm.id,mm.name from public.slm_matches mm where mm.status='scheduled'
    and mm.starts_at>v_now+interval '30 minutes' and mm.starts_at<=v_now+interval '24 hours'
    and exists(select 1 from public.slm_match_entries x where x.event_id=mm.id and x.responsible_user_id=u and x.status='registered') loop
   select count(*) into v_before from public.slm_notification_sources where source_key='payreminder:pre:'||m.id||':'||u;
   perform slm_private.notification_emit('payreminder:pre:'||m.id||':'||u,'payment_reminder','finance',null,
    'Przypomnienie o płatności','Masz zaległą wpłatę '||v_amount||' zł. Rozlicz się przed meczem „'||m.name||'”.',v_now+interval '1 day',array[u]);
   if v_before=0 then n:=n+1; end if;
  end loop;
 end loop;
 return n;
end $$;
revoke all on function slm_private.payment_reminders() from public,anon,authenticated;

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
 return n;
end $$;

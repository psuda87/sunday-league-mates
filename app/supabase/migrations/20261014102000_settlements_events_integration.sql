-- Integracja istniejącego RPC wydarzeń z serwerowym dziennikiem rozliczeń.
-- Zachowuje kontrolę sesji, limitów i historii z feat/events.
revoke update,delete,truncate on public.slm_event_history from service_role;
create trigger settlement_event_history_immutable before update or delete on public.slm_event_history
 for each row execute function slm_private.finance_immutable();
create or replace function public.slm_events_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 e public.slm_events; person public.slm_event_participants; v_id uuid; v_target uuid;
 v_admin boolean; v_now timestamptz; v_cutoff timestamptz; v_start timestamptz;
 v_capacity integer; v_count integer; v_status text; v_name text; v_phone text; v_action text;
 v_rows jsonb; v_date date; v_time time; v_duration integer; v_rate numeric; v_total numeric;
 v_previous text; v_previous_event jsonb;
begin
 perform pg_advisory_xact_lock(20261014,1);
 -- Ta sama blokada co finanse, przed blokadą rekordu meczu i sesji.
 -- Blokada SHARE zatrzymuje reset do commit; rola pochodzi z tabeli serwera.
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid'; end if;
 select role='admin' into v_admin from public.slm_roles where user_id=p_user for share;
 v_now:=clock_timestamp();
 if p_action='list' then
  select coalesce(jsonb_agg(s.item order by s.starts_at,s.id),'[]') into v_rows from (
   select x.id,x.starts_at,slm_private.event_summary(x,v_now) item from public.slm_events x
   order by x.starts_at desc,x.id limit 50 offset greatest(0,coalesce((p_body->>'offset')::integer,0))) s;
  return jsonb_build_object('events',v_rows,'server_now',v_now);
 end if;
 if p_action in ('create','edit') then
  if not v_admin then raise exception 'forbidden'; end if;
  if coalesce(p_body->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_body->>'time','') !~ '^\d{2}:\d{2}$'
    then raise exception 'invalid_event'; end if;
  v_date:=(p_body->>'date')::date; v_time:=(p_body->>'time')::time;
  if v_time>=time '24:00' then raise exception 'invalid_event'; end if;
  v_start:=(v_date+v_time) at time zone 'Europe/Warsaw';
  if (v_start at time zone 'Europe/Warsaw')<>v_date+v_time then raise exception 'invalid_event'; end if;
  v_capacity:=(p_body->>'capacity')::integer; v_duration:=(p_body->>'duration_minutes')::integer;
  v_rate:=(p_body->>'hourly_rate')::numeric; v_total:=(p_body->>'total_cost')::numeric;
  if v_capacity is null or v_capacity<10 or v_duration is null or v_duration<=0
   or v_rate is null or v_rate<0 or v_rate='NaN'::numeric or v_total is null or v_total<0 or v_total='NaN'::numeric
   or coalesce(length(trim(p_body->>'location')),0) not between 1 and 200 then raise exception 'invalid_event'; end if;
  if v_start<=v_now then raise exception 'registration_closed'; end if;
  if p_action='create' then
   insert into public.slm_events(starts_at,location,duration_minutes,hourly_rate,total_cost,capacity,created_by)
   values(v_start,trim(p_body->>'location'),v_duration,v_rate,v_total,v_capacity,p_user) returning * into e;
   v_action:='created';
  else
   select * into e from public.slm_events where id=(p_body->>'event_id')::uuid for update;
   if not found then raise exception 'not_found'; end if;
   v_previous_event:=to_jsonb(e);
   v_now:=clock_timestamp();
   if e.status='cancelled' then raise exception 'event_cancelled'; end if;
   if v_now>=e.starts_at or v_now>=v_start then raise exception 'registration_closed'; end if;
   select count(*) into v_count from public.slm_event_participants where event_id=e.id and status='registered';
   if v_capacity<v_count then raise exception 'capacity_too_small'; end if;
   update public.slm_events set starts_at=v_start,location=trim(p_body->>'location'),duration_minutes=v_duration,
    hourly_rate=v_rate,total_cost=v_total,capacity=v_capacity,updated_at=v_now where id=e.id returning * into e;
   v_action:='edited';
  end if;
 else
  select * into e from public.slm_events where id=(p_body->>'event_id')::uuid for update;
  if not found then raise exception 'not_found'; end if;
  v_now:=clock_timestamp(); -- Po oczekiwaniu na blokadę sprawdź rzeczywisty czas początku.
  if p_action='detail' then
   select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'member_id',p.member_id,'responsible_user_id',p.responsible_user_id,
    'status',p.status,'absent',p.absent,'guest_name',p.guest_name,'guest_phone',p.guest_phone,'joined_at',p.joined_at,
    'display_name',case when p.member_id is null then p.guest_name else case when pr.display_as='full_name'
     and length(trim(pr.full_name))>0 then pr.full_name else a.login end end,
    'responsible_name',case when pr.display_as='full_name' and length(trim(pr.full_name))>0 then pr.full_name else a.login end,
    'contact_phone',coalesce(p.guest_phone,a.phone)) order by p.joined_at,p.id),'[]') into v_rows
   from public.slm_event_participants p join public.slm_aliases a on a.user_id=p.responsible_user_id
   join public.slm_profiles pr on pr.user_id=a.user_id where p.event_id=e.id and p.status<>'withdrawn';
   return jsonb_build_object('event',slm_private.event_summary(e,v_now),'participants',v_rows,'server_now',v_now);
  end if;
  if p_action='cancel' then
   if not v_admin then raise exception 'forbidden'; end if;
   if e.status='cancelled' then raise exception 'event_cancelled'; end if;
   if exists(select 1 from public.slm_settlements where event_id=e.id and approved_at is not null)
    and coalesce(length(trim(p_body->>'reason')),0) not between 1 and 500 then raise exception 'reason_required'; end if;
   update public.slm_events set status='cancelled',updated_at=v_now where id=e.id returning * into e;
   v_action:='cancelled';
  else
   if e.status='cancelled' then raise exception 'event_cancelled'; end if;
   if p_action<>'attendance' and v_now>=e.starts_at then raise exception 'registration_closed'; end if;
   if p_action in ('join','reserve','guest') then
    v_target:=coalesce(nullif(p_body->>'user_id','')::uuid,p_user);
    if v_target<>p_user and not v_admin then raise exception 'forbidden'; end if;
    if (select count(*) from slm_private.finance_dues(v_target) where outstanding_cents>0)>=2
     and not (p_action='reserve' and exists(select 1 from public.slm_event_participants
      where event_id=e.id and member_id=v_target and status='registered')) then raise exception 'settlement_blocked'; end if;
    if not exists(select 1 from public.slm_account_security where user_id=v_target and active and operation_id is null)
      then raise exception 'invalid_participant'; end if;
    v_status:=case when p_action='reserve' or (p_action='guest' and p_body->>'list'='reserve') then 'reserve' else 'registered' end;
    select count(*) into v_count from public.slm_event_participants where event_id=e.id and status='registered';
    if v_status='registered' and v_count>=e.capacity then raise exception 'event_full'; end if;
    if p_action='guest' then
     v_name:=trim(p_body->>'guest_name'); v_phone:=nullif(regexp_replace(coalesce(p_body->>'guest_phone',''),'[\s()-]','','g'),'');
     if v_name is null or length(v_name) not between 1 and 100 or
      (v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$') then raise exception 'invalid_guest'; end if;
     v_id:=(p_body->>'request_id')::uuid;
     if v_id is null then raise exception 'invalid_guest'; end if;
     if exists(select 1 from public.slm_event_participants where id=v_id) then raise exception 'duplicate_signup'; end if;
     insert into public.slm_event_participants(id,event_id,responsible_user_id,guest_name,guest_phone,status)
      values(v_id,e.id,v_target,v_name,v_phone,v_status) returning * into person;
    else
     select * into person from public.slm_event_participants where event_id=e.id and member_id=v_target and status<>'withdrawn';
     if found then
      v_previous:=person.status;
      if person.status=v_status then raise exception 'duplicate_signup'; end if;
      update public.slm_event_participants set status=v_status,absent=false,joined_at=v_now where id=person.id returning * into person;
     else
      insert into public.slm_event_participants(event_id,member_id,responsible_user_id,status)
       values(e.id,v_target,v_target,v_status) returning * into person;
     end if;
    end if;
    v_action:=case when v_status='reserve' then 'reserved' else 'joined' end;
   elsif p_action in ('withdraw','attendance','edit_guest','move_guest') then
    select * into person from public.slm_event_participants where id=(p_body->>'participant_id')::uuid and event_id=e.id and status<>'withdrawn';
    if not found then raise exception 'not_found'; end if;
    v_previous:=person.status;
    if not v_admin and person.responsible_user_id<>p_user then raise exception 'forbidden'; end if;
    if p_action='attendance' then
     if exists(select 1 from public.slm_settlements where event_id=e.id and approved_at is not null) then raise exception 'use_settlements'; end if;
     if not v_admin then raise exception 'forbidden'; end if;
     if person.status<>'registered' or jsonb_typeof(p_body->'absent') is distinct from 'boolean' then raise exception 'invalid_participant'; end if;
     update public.slm_event_participants set absent=(p_body->>'absent')::boolean where id=person.id returning * into person;
     v_action:='attendance';
    elsif p_action='withdraw' then
     update public.slm_event_participants set status='withdrawn',withdrawn_at=v_now where id=person.id returning * into person;
     v_action:='withdrawn';
    else
     if person.member_id is not null then raise exception 'invalid_guest'; end if;
     if p_action='move_guest' then
      v_status:=case when p_body->>'list'='reserve' then 'reserve' else 'registered' end;
      if person.status=v_status then raise exception 'duplicate_signup'; end if;
      select count(*) into v_count from public.slm_event_participants where event_id=e.id and status='registered';
      if v_status='registered' and v_count>=e.capacity then raise exception 'event_full'; end if;
      if v_status='registered' and (select count(*) from slm_private.finance_dues(person.responsible_user_id) where outstanding_cents>0)>=2 then raise exception 'settlement_blocked'; end if;
      update public.slm_event_participants set status=v_status,absent=false,joined_at=v_now where id=person.id returning * into person;
      v_action:=case when v_status='reserve' then 'reserved' else 'joined' end;
     else
      v_name:=trim(p_body->>'guest_name'); v_phone:=nullif(regexp_replace(coalesce(p_body->>'guest_phone',''),'[\s()-]','','g'),'');
      if v_name is null or length(v_name) not between 1 and 100 or (v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$') then raise exception 'invalid_guest'; end if;
      update public.slm_event_participants set guest_name=v_name,guest_phone=v_phone where id=person.id returning * into person;
      v_action:='guest_edited';
     end if;
    end if;
   else raise exception 'invalid_action'; end if;
  end if;
 end if;
 v_cutoff:=((e.starts_at at time zone e.timezone)::date+time '17:00') at time zone e.timezone;
 insert into public.slm_event_history(event_id,participant_id,actor_id,responsible_user_id,action,server_time,cutoff_at,after_cutoff,snapshot)
 values(e.id,person.id,p_user,person.responsible_user_id,v_action,v_now,v_cutoff,v_now>=v_cutoff,
  jsonb_build_object('event',to_jsonb(e),'previous_event',v_previous_event,'participant',to_jsonb(person),'previous_status',v_previous,'reason',p_body->>'reason'));
 return jsonb_build_object('event_id',e.id,'participant_id',person.id,'server_now',v_now,'settlements_active',true);
end $$;

create or replace function slm_private.event_summary(p_event public.slm_events,p_now timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 select to_jsonb(p_event) || jsonb_build_object(
  'registered_count',c.n,'reserve_count',c.r,
  'cutoff_at',((p_event.starts_at at time zone p_event.timezone)::date+time '17:00') at time zone p_event.timezone,
  'registration_open',p_event.status='scheduled' and p_now<p_event.starts_at,
  'decision_required',p_event.status='scheduled' and c.n<10 and p_now<p_event.starts_at
   and p_now>=(((p_event.starts_at at time zone p_event.timezone)::date+time '17:00') at time zone p_event.timezone),
  'estimated_per_person',null,
  'settlements_active',true,
  'settlement_version',(select version from public.slm_settlements where event_id=p_event.id))
 from (select count(*) filter(where status='registered') n,count(*) filter(where status='reserve') r
 from public.slm_event_participants where event_id=p_event.id) c;
$$;

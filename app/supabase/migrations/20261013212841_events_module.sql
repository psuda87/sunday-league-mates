-- Zapisy i historia są niezależne od przyszłego naliczania należności.
create table public.slm_events (
 id uuid primary key default gen_random_uuid(),
 starts_at timestamptz not null,
 location text not null check(length(trim(location)) between 1 and 200),
 duration_minutes integer not null default 90 check(duration_minutes>0),
 hourly_rate numeric(12,2) not null default 180 check(hourly_rate>=0),
 total_cost numeric(12,2) not null default 270 check(total_cost>=0),
 capacity integer not null check(capacity>=10),
 minimum_players integer not null default 10 check(minimum_players=10),
 status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create index slm_events_starts on public.slm_events(starts_at,id);
create index slm_events_creator on public.slm_events(created_by);
create table public.slm_event_participants (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.slm_events(id) on delete cascade,
 member_id uuid references auth.users(id),
 responsible_user_id uuid not null references auth.users(id),
 guest_name text, guest_phone text,
 status text not null check(status in ('registered','reserve','withdrawn')),
 absent boolean not null default false,
 joined_at timestamptz not null default clock_timestamp(),
 withdrawn_at timestamptz,
 check((member_id is not null and guest_name is null and guest_phone is null and responsible_user_id=member_id)
    or (member_id is null and guest_name is not null and length(trim(guest_name)) between 1 and 100)),
 check(guest_phone is null or guest_phone ~ '^\+[1-9][0-9]{7,14}$')
);
create unique index slm_events_one_member on public.slm_event_participants(event_id,member_id)
 where member_id is not null and status<>'withdrawn';
create index slm_participants_event_status on public.slm_event_participants(event_id,status);
create index slm_participants_member on public.slm_event_participants(member_id);
create index slm_participants_responsible on public.slm_event_participants(responsible_user_id);
create table public.slm_event_history (
 sequence bigint generated always as identity primary key,
 event_id uuid not null references public.slm_events(id) on delete cascade,
 participant_id uuid references public.slm_event_participants(id),
 actor_id uuid not null references auth.users(id),
 responsible_user_id uuid references auth.users(id),
 action text not null,
 server_time timestamptz not null,
 cutoff_at timestamptz not null,
 after_cutoff boolean not null,
 snapshot jsonb not null
);
create index slm_history_event_order on public.slm_event_history(event_id,sequence);
create index slm_history_participant on public.slm_event_history(participant_id);
create index slm_history_actor on public.slm_event_history(actor_id);
create index slm_history_responsible on public.slm_event_history(responsible_user_id);

do $$ declare t text; begin
 foreach t in array array['slm_events','slm_event_participants','slm_event_history'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.slm_event_history_sequence_seq to service_role;
grant select on public.slm_events,public.slm_event_participants to authenticated;
create policy events_member_read on public.slm_events for select to authenticated
 using ((select slm_private.current_session_valid()));
create policy participants_member_read on public.slm_event_participants for select to authenticated
 using (status<>'withdrawn' and (select slm_private.current_session_valid()));
-- Historia nie jest dostępna klientowi; brak grantów write, również dla administratora UI.

create function slm_private.event_summary(p_event public.slm_events,p_now timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 select to_jsonb(p_event) || jsonb_build_object(
  'registered_count',c.n,'reserve_count',c.r,
  'cutoff_at',((p_event.starts_at at time zone 'Europe/Warsaw')::date+time '17:00') at time zone 'Europe/Warsaw',
  'registration_open',p_event.status='scheduled' and p_now<p_event.starts_at,
  'decision_required',p_event.status='scheduled' and c.n<10 and p_now<p_event.starts_at
   and p_now>=(((p_event.starts_at at time zone 'Europe/Warsaw')::date+time '17:00') at time zone 'Europe/Warsaw'),
  'estimated_per_person',case when c.n>0 then round(p_event.total_cost/c.n,2) else null end,
  'settlements_active',false)
 from (select count(*) filter(where status='registered') n,count(*) filter(where status='reserve') r
 from public.slm_event_participants where event_id=p_event.id) c;
$$;
revoke all on function slm_private.event_summary(public.slm_events,timestamptz) from public,anon,authenticated;
grant execute on function slm_private.event_summary(public.slm_events,timestamptz) to service_role;

create function public.slm_events_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 e public.slm_events; person public.slm_event_participants; v_id uuid; v_target uuid;
 v_admin boolean; v_now timestamptz; v_cutoff timestamptz; v_start timestamptz;
 v_capacity integer; v_count integer; v_status text; v_name text; v_phone text; v_action text;
 v_rows jsonb; v_date date; v_time time; v_duration integer; v_rate numeric; v_total numeric;
 v_previous text; v_previous_event jsonb;
begin
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
  v_start:=(v_date+v_time) at time zone 'Europe/Warsaw';
  if (v_start at time zone 'Europe/Warsaw')<>v_date+v_time then raise exception 'invalid_event'; end if;
  v_capacity:=(p_body->>'capacity')::integer; v_duration:=(p_body->>'duration_minutes')::integer;
  v_rate:=(p_body->>'hourly_rate')::numeric; v_total:=(p_body->>'total_cost')::numeric;
  if v_capacity is null or v_capacity<10 or v_duration is null or v_duration<=0
   or v_rate is null or v_rate<0 or v_total is null or v_total<0
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
   -- Nie przesuwamy historycznej granicy 17:00 po jej osiągnięciu.
   v_cutoff:=((e.starts_at at time zone 'Europe/Warsaw')::date+time '17:00') at time zone 'Europe/Warsaw';
   if v_now>=v_cutoff and (v_start at time zone 'Europe/Warsaw')::date<>(e.starts_at at time zone 'Europe/Warsaw')::date
     then raise exception 'date_locked'; end if;
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
   update public.slm_events set status='cancelled',updated_at=v_now where id=e.id returning * into e;
   v_action:='cancelled';
  else
   if e.status='cancelled' then raise exception 'event_cancelled'; end if;
   if p_action<>'attendance' and v_now>=e.starts_at then raise exception 'registration_closed'; end if;
   if p_action in ('join','reserve','guest') then
    v_target:=coalesce(nullif(p_body->>'user_id','')::uuid,p_user);
    if v_target<>p_user and not v_admin then raise exception 'forbidden'; end if;
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
 v_cutoff:=((e.starts_at at time zone 'Europe/Warsaw')::date+time '17:00') at time zone 'Europe/Warsaw';
 insert into public.slm_event_history(event_id,participant_id,actor_id,responsible_user_id,action,server_time,cutoff_at,after_cutoff,snapshot)
 values(e.id,person.id,p_user,person.responsible_user_id,v_action,v_now,v_cutoff,v_now>=v_cutoff,
  jsonb_build_object('event',to_jsonb(e),'previous_event',v_previous_event,'participant',to_jsonb(person),'previous_status',v_previous));
 return jsonb_build_object('event_id',e.id,'participant_id',person.id,'server_now',v_now,'settlements_active',false);
end $$;
revoke all on function public.slm_events_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_events_dispatch(uuid,uuid,text,jsonb) to service_role;
grant usage on schema slm_private to service_role;

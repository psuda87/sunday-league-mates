-- Lokalna migracja, niewykonana. Baza: feat/events; bez tabel rozliczeń.
create table public.slm_notification_preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('new_match','vacancy','reminder','match_changed','finance')),
 push_enabled boolean not null default true,
 primary key(user_id,category)
);
create table public.slm_push_devices (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null references public.slm_account_sessions(session_id) on delete cascade,
 secret_hash text not null,
 binding_id uuid not null,
 binding_version bigint not null check(binding_version>0),
 token text not null unique check(length(token) between 20 and 4096),
 platform text not null check(platform in ('android','ios')),
 enabled boolean not null default true,
 updated_at timestamptz not null default clock_timestamp()
);
create index slm_devices_user on public.slm_push_devices(user_id);
create table public.slm_push_device_watermarks (
 device_id uuid primary key,secret_hash text not null,max_version bigint not null check(max_version>=0)
);
-- Chroni również logout, który wyprzedził spóźnione żądanie rejestracji urządzenia.
create table public.slm_push_revocations (
 device_id uuid not null,binding_id uuid not null,secret_hash text not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(device_id,binding_id,secret_hash)
);
create table public.slm_notification_sources (
 id uuid primary key default gen_random_uuid(),
 source_key text not null unique check(length(source_key) between 1 and 240),
 kind text not null,
 category text not null check(category in ('new_match','vacancy','reminder','match_changed','finance')),
 event_id uuid references public.slm_events(id),
 event_starts_at timestamptz,
 title text not null,
 body text not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp()
);
create table public.slm_notifications (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.slm_notification_sources(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null,
 kind text not null,
 event_id uuid references public.slm_events(id),
 title text not null,
 body text not null,
 created_at timestamptz not null default clock_timestamp(),
 read_at timestamptz,
 unique(source_id,user_id)
);
create index slm_notifications_user on public.slm_notifications(user_id,created_at desc,id);
create index slm_notifications_unread on public.slm_notifications(user_id) where read_at is null;
create table public.slm_push_queue (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references public.slm_notifications(id) on delete cascade,
 device_id uuid references public.slm_push_devices(id) on delete set null,
 state text not null default 'pending' check(state in ('pending','leased','sent','cancelled','dead')),
 attempts integer not null default 0 check(attempts between 0 and 6),
 next_attempt_at timestamptz not null default clock_timestamp(),
 lease_id uuid,
 lease_until timestamptz,
 last_error text,
 sent_at timestamptz,
 unique(notification_id,device_id)
);
create index slm_push_queue_ready on public.slm_push_queue(next_attempt_at,id) where state in ('pending','leased');
create table public.slm_push_reminders (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.slm_events(id),
 starts_at timestamptz not null,
 hours_before integer not null check(hours_before in (24,2)),
 due_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','emitted','cancelled','skipped')),
 unique(event_id,starts_at,hours_before)
);
create index slm_reminders_due on public.slm_push_reminders(due_at,event_id) where state='pending';
do $$ declare t text; begin
 foreach t in array array['slm_notification_preferences','slm_push_devices','slm_push_revocations','slm_push_device_watermarks','slm_notification_sources',
  'slm_notifications','slm_push_queue','slm_push_reminders'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant select on public.slm_notifications,public.slm_notification_preferences to authenticated;
-- Token i hash nie są udostępniane nawet w bezpośrednim odczycie własnego urządzenia.
grant select(id,user_id,platform,enabled,updated_at) on public.slm_push_devices to authenticated;
create policy notifications_own on public.slm_notifications for select to authenticated
 using(user_id=(select auth.uid()) and (select slm_private.current_session_valid()));
create policy notification_preferences_own on public.slm_notification_preferences for select to authenticated
 using(user_id=(select auth.uid()) and (select slm_private.current_session_valid()));
create policy push_devices_own on public.slm_push_devices for select to authenticated
 using(user_id=(select auth.uid()) and (select slm_private.current_session_valid()));

-- Adapter uprawnień. Na bazie events brak finansów; po integracji używa ich RPC
-- projekcji, bez kopiowania logiki i bez generowania fikcyjnych zdarzeń finansowych.
create function slm_private.notification_registration_allowed(p_user uuid) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare n bigint;
begin
 if not exists(select 1 from public.slm_account_security where user_id=p_user and active and operation_id is null) then return false; end if;
 if to_regprocedure('slm_private.finance_dues(uuid)') is not null then
  execute 'select count(*) from slm_private.finance_dues($1) where outstanding_cents>0' into n using p_user;
  return n<2;
 end if;
 return true;
end $$;

create function slm_private.notification_emit(p_key text,p_kind text,p_category text,p_event uuid,
 p_title text,p_body text,p_expires timestamptz,p_users uuid[]) returns uuid
language plpgsql security invoker set search_path='' as $$
declare source public.slm_notification_sources;
begin
 insert into public.slm_notification_sources(source_key,kind,category,event_id,event_starts_at,title,body,expires_at)
  values(p_key,p_kind,p_category,p_event,(select starts_at from public.slm_events where id=p_event),p_title,p_body,p_expires) on conflict(source_key) do nothing;
 select * into source from public.slm_notification_sources where source_key=p_key;
 if source.kind<>p_kind or source.category<>p_category or source.event_id is distinct from p_event
  or source.title<>p_title or source.body<>p_body then raise exception 'notification_source_conflict'; end if;
 with inserted as (
  insert into public.slm_notifications(source_id,user_id,category,kind,event_id,title,body)
   select source.id,u,p_category,p_kind,p_event,p_title,p_body from unnest(p_users) u
    where exists(select 1 from public.slm_account_security where user_id=u and active)
   on conflict(source_id,user_id) do nothing returning *
 ) insert into public.slm_push_queue(notification_id,device_id)
   select i.id,d.id from inserted i join public.slm_push_devices d on d.user_id=i.user_id and d.enabled
   where slm_private.session_valid(d.user_id,d.session_id,false)
    and coalesce((select push_enabled from public.slm_notification_preferences
     where user_id=i.user_id and category=p_category),true)
   on conflict(notification_id,device_id) do nothing;
 return source.id;
end $$;

create function slm_private.notification_schedule(p_event public.slm_events,p_now timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
begin
 update public.slm_push_reminders set state='cancelled' where event_id=p_event.id and state='pending'
  and (starts_at<>p_event.starts_at or p_event.status='cancelled');
 if p_event.status='scheduled' then
  insert into public.slm_push_reminders(event_id,starts_at,hours_before,due_at)
   select p_event.id,p_event.starts_at,h,p_event.starts_at-make_interval(hours=>h) from unnest(array[24,2]) h
   where p_event.starts_at-make_interval(hours=>h)>=p_now
   on conflict(event_id,starts_at,hours_before) do update set state='pending',due_at=excluded.due_at
    where public.slm_push_reminders.state='cancelled';
 end if;
end $$;

create function slm_private.notification_event_history() returns trigger
language plpgsql security invoker set search_path='' as $$
declare e public.slm_events; users uuid[]; v_previous jsonb; kind text; title text; category text;
begin
 select * into e from public.slm_events where id=new.event_id;
 if new.action in ('created','edited','cancelled') then perform slm_private.notification_schedule(e,new.server_time); end if;
 if new.action='created' then
  select array_agg(user_id) into users from public.slm_account_security where active and user_id<>new.actor_id;
  kind:='new_match'; category:='new_match'; title:='Nowy mecz';
 elsif new.action='cancelled' then
  select array_agg(distinct responsible_user_id) into users from public.slm_event_participants where event_id=e.id and status='registered';
  kind:='match_cancelled'; category:='match_changed'; title:='Mecz odwołany';
 elsif new.action='edited' then
  v_previous:=new.snapshot->'previous_event';
  if (v_previous->>'starts_at')::timestamptz is not distinct from e.starts_at
   and v_previous->>'location'=e.location
   and (v_previous->>'duration_minutes')::integer=e.duration_minutes then return new; end if;
  select array_agg(distinct responsible_user_id) into users from public.slm_event_participants where event_id=e.id and status='registered';
  kind:='match_changed'; category:='match_changed'; title:='Zmiana meczu';
 elsif new.action in ('withdrawn','reserved') and new.snapshot->>'previous_status'='registered'
  and e.status='scheduled' and new.server_time<e.starts_at
  and (select count(*) from public.slm_event_participants where event_id=e.id and status='registered')<e.capacity then
  select array_agg(distinct responsible_user_id) into users from public.slm_event_participants
   where event_id=e.id and status='reserve' and responsible_user_id<>new.responsible_user_id
    and slm_private.notification_registration_allowed(responsible_user_id);
  kind:='vacancy'; category:='vacancy'; title:='Zwolniło się miejsce';
 else return new; end if;
 perform slm_private.notification_emit('events:'||new.sequence,kind,category,e.id,title,
  case kind when 'new_match' then 'Administrator utworzył mecz. Sprawdź termin i zapisz się.'
   when 'vacancy' then 'Sprawdź wolne miejsce. Zapis potwierdza serwer; rezerwa nie awansuje automatycznie.'
   when 'match_cancelled' then 'Administrator odwołał mecz. Sprawdź szczegóły wydarzenia.'
   else 'Zmieniono termin, miejsce lub czas meczu. Sprawdź aktualne szczegóły.' end,
  case when kind='match_cancelled' then new.server_time+interval '1 day' else e.starts_at end,coalesce(users,array[]::uuid[]));
 return new;
end $$;
create trigger slm_notification_events after insert on public.slm_event_history
 for each row execute function slm_private.notification_event_history();
-- Bez historycznego rozsyłania: dla istniejących meczów tylko przyszłe przypomnienia.
do $$ declare e public.slm_events; begin
 for e in select * from public.slm_events where status='scheduled' and starts_at>clock_timestamp() loop
  perform slm_private.notification_schedule(e,clock_timestamp());
 end loop;
end $$;

create function public.slm_notifications_prepare() returns integer
language plpgsql security invoker set search_path='' as $$
declare e public.slm_events; r public.slm_push_reminders; users uuid[]; n integer:=0; v_now timestamptz;
begin
 delete from public.slm_push_revocations where created_at<clock_timestamp()-interval '30 days';
 -- Kolejność blokad: wydarzenie, potem przypomnienie, tak samo jak trigger historii.
 for e in select * from public.slm_events where id in (
  select event_id from public.slm_push_reminders where state='pending' and due_at<=clock_timestamp())
  order by starts_at,id limit 100 for update skip locked loop
  v_now:=clock_timestamp();
  for r in select * from public.slm_push_reminders where event_id=e.id and state='pending' and due_at<=v_now for update loop
   if e.status='cancelled' or e.starts_at<>r.starts_at then
    update public.slm_push_reminders set state='cancelled' where id=r.id;
   elsif v_now>=e.starts_at or (r.hours_before=24 and v_now>=e.starts_at-interval '2 hours') then
    update public.slm_push_reminders set state='skipped' where id=r.id;
   else
    select array_agg(distinct responsible_user_id) into users from public.slm_event_participants where event_id=e.id and status='registered';
    perform slm_private.notification_emit('reminder:'||r.id,'reminder','reminder',e.id,'Przypomnienie o meczu',
     'Zbliża się termin meczu. Sprawdź aktualną godzinę i miejsce.',e.starts_at,coalesce(users,array[]::uuid[]));
    update public.slm_push_reminders set state='emitted' where id=r.id; n:=n+1;
   end if;
  end loop;
 end loop;
 return n;
end $$;
-- Kontrakt finansowy. Wywołuje go przyszły adapter w tej samej transakcji co decyzję.
-- Nie ma triggerów na nieistniejących tabelach ani sztucznych wpłat/blokad.
create function public.slm_notifications_finance_emit(p_key text,p_kind text,p_user uuid,p_event uuid default null) returns uuid
language plpgsql security invoker set search_path='' as $$
begin
 if p_kind not in ('payment_accepted','payment_rejected','registration_blocked','registration_unblocked')
  or p_key !~ '^finance:' then raise exception 'invalid_notification_event'; end if;
 return slm_private.notification_emit(p_key,p_kind,'finance',p_event,
  case p_kind when 'payment_accepted' then 'Wpłata zatwierdzona' when 'payment_rejected' then 'Zgłoszenie wpłaty odrzucone'
   when 'registration_blocked' then 'Blokada zapisów' else 'Zapisy odblokowane' end,
  'Sprawdź swoje rozliczenia i decyzję administratora.',clock_timestamp()+interval '1 day',array[p_user]);
end $$;
do $$ declare f text; begin
 foreach f in array array['notification_registration_allowed(uuid)',
  'notification_emit(text,text,text,uuid,text,text,timestamptz,uuid[])','notification_schedule(public.slm_events,timestamptz)',
  'notification_event_history()'] loop
  execute 'revoke all on function slm_private.'||f||' from public,anon,authenticated';
  execute 'grant execute on function slm_private.'||f||' to service_role';
 end loop;
end $$;
revoke all on function public.slm_notifications_prepare(),public.slm_notifications_finance_emit(text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.slm_notifications_prepare(),public.slm_notifications_finance_emit(text,text,uuid,uuid) to service_role;

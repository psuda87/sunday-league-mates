alter table public.slm_notification_sources add column match_id uuid references public.slm_matches(id);
alter table public.slm_notifications add column match_id uuid references public.slm_matches(id);
create table public.slm_match_reminders (
 id uuid primary key default gen_random_uuid(),match_id uuid not null references public.slm_matches(id),
 starts_at timestamptz not null,hours_before integer not null check(hours_before in (24,2)),due_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','emitted','cancelled','skipped')),unique(match_id,starts_at,hours_before)
);
alter table public.slm_match_reminders enable row level security;
revoke all on public.slm_match_reminders from public,anon,authenticated;
grant all on public.slm_match_reminders to service_role;
create index slm_match_reminders_due on public.slm_match_reminders(due_at,match_id) where state='pending';
create function slm_private.match_notification_emit(p_key text,p_kind text,p_category text,p_match uuid,p_users uuid[]) returns uuid
language plpgsql security invoker set search_path='' as $$
declare source public.slm_notification_sources;e public.slm_matches;
begin
 select * into e from public.slm_matches where id=p_match;
 if not found then raise exception 'not_found';end if;
 insert into public.slm_notification_sources(source_key,kind,category,match_id,event_starts_at,title,body,expires_at)
 values(p_key,p_kind,p_category,e.id,e.starts_at,case when p_kind='vacancy' then 'Zwolniło się miejsce' when p_kind='match_cancelled' then 'Mecz odwołany' when p_kind='reminder' then 'Przypomnienie o meczu' when p_kind='new_match' then 'Nowy mecz' else 'Zmiana meczu' end,
 'Sprawdź aktualne informacje w aplikacji.',case when p_kind='match_cancelled' then clock_timestamp()+interval '7 days' else e.starts_at end)
 on conflict(source_key) do nothing;
 select * into source from public.slm_notification_sources where source_key=p_key;
 if source.match_id is distinct from e.id or source.kind<>p_kind then raise exception 'notification_source_conflict';end if;
 with inserted as (
  insert into public.slm_notifications(source_id,user_id,category,kind,match_id,title,body)
  select source.id,u,p_category,p_kind,e.id,source.title,source.body from unnest(coalesce(p_users,array[]::uuid[]))u
  where exists(select 1 from public.slm_account_security where user_id=u and active)
  on conflict(source_id,user_id) do nothing returning *
 )insert into public.slm_push_queue(notification_id,device_id)
 select i.id,d.id from inserted i join public.slm_push_devices d on d.user_id=i.user_id and d.enabled
 where slm_private.session_valid(d.user_id,d.session_id,false)
 and coalesce((select push_enabled from public.slm_notification_preferences where user_id=i.user_id and category=p_category),true)
 on conflict(notification_id,device_id) do nothing;
 return source.id;
end $$;
create function slm_private.match_notification_history() returns trigger
language plpgsql security invoker set search_path='' as $$
declare e public.slm_matches; recipients uuid[]; kind text; category text;
begin
 select * into e from public.slm_matches where id=new.event_id;
 if new.action='created' then
  kind:='new_match';category:='new_match';select array_agg(user_id) into recipients from public.slm_group_members where group_id=e.group_id and user_id<>new.actor_id;
 elsif new.action in ('edited','cancelled') then
  kind:=case when new.action='cancelled' then 'match_cancelled' else 'match_changed' end;category:='match_changed';
  select array_agg(distinct responsible_user_id) into recipients from public.slm_match_entries where event_id=e.id and status in ('registered','reserve');
 elsif new.action in ('withdrawn','reserved') and new.snapshot->'before'->>'status'='registered'
  and e.status='scheduled' and e.starts_at>clock_timestamp()
  and(select count(*) from public.slm_match_entries where event_id=e.id and status='registered')<e.capacity then
  kind:='vacancy';category:='vacancy';
  select array_agg(distinct responsible_user_id) into recipients from public.slm_match_entries p where p.event_id=e.id and p.status='reserve'
   and responsible_user_id<>new.actor_id and slm_private.match_access(e.id,responsible_user_id)='full'
   and slm_private.registration_allowed(responsible_user_id,e.cost_cents);
 end if;
 if kind is not null then perform slm_private.match_notification_emit('v2:history:'||new.sequence,kind,category,e.id,recipients);end if;
 return new;
end $$;
create trigger match_notification_history after insert on public.slm_match_history for each row execute function slm_private.match_notification_history();
create function slm_private.match_reminders_schedule() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
 update public.slm_match_reminders set state='cancelled' where match_id=new.id and state='pending' and(starts_at<>new.starts_at or new.status='cancelled');
 if new.status='scheduled' then
 insert into public.slm_match_reminders(match_id,starts_at,hours_before,due_at)
 select new.id,new.starts_at,h,new.starts_at-make_interval(hours=>h) from unnest(array[24,2])h
 where new.starts_at-make_interval(hours=>h)>=clock_timestamp()
 on conflict(match_id,starts_at,hours_before) do update set state='pending' where public.slm_match_reminders.state='cancelled';
 end if;return new;
end $$;
create trigger match_reminders_schedule after insert or update of starts_at,status on public.slm_matches for each row execute function slm_private.match_reminders_schedule();
-- Keep every legacy delivery check; add a separate branch only for new match IDs.
alter function slm_private.push_deliverable(public.slm_notifications,public.slm_push_devices) rename to legacy_push_deliverable;
create function slm_private.push_deliverable(n public.slm_notifications,d public.slm_push_devices) returns boolean
language sql stable security invoker set search_path='' as $$
 select case when n.match_id is null then slm_private.legacy_push_deliverable(n,d) else
 d.id is not null and d.enabled and d.user_id=n.user_id and slm_private.session_valid(d.user_id,d.session_id,false)
 and coalesce((select push_enabled from public.slm_notification_preferences where user_id=n.user_id and category=n.category),true)
 and exists(select 1 from public.slm_notification_sources s join public.slm_matches e on e.id=n.match_id where s.id=n.source_id and s.expires_at>clock_timestamp()
 and slm_private.match_access(e.id,n.user_id)<>'none'
 and((n.kind='match_cancelled' and e.status='cancelled')or(n.kind<>'match_cancelled' and e.status='scheduled' and e.starts_at>clock_timestamp()))
 and(n.kind<>'new_match' or slm_private.group_member(e.group_id,n.user_id))
 and(n.kind<>'reminder' or(e.starts_at=s.event_starts_at and exists(select 1 from public.slm_match_entries where event_id=e.id and responsible_user_id=n.user_id and status='registered')))
 and(n.kind<>'vacancy' or(slm_private.match_access(e.id,n.user_id)='full' and(select count(*) from public.slm_match_entries where event_id=e.id and status='registered')<e.capacity
 and exists(select 1 from public.slm_match_entries where event_id=e.id and responsible_user_id=n.user_id and status='reserve') and slm_private.registration_allowed(n.user_id,e.cost_cents)))) end;
$$;
alter function public.slm_notifications_prepare() set schema slm_private;
alter function slm_private.slm_notifications_prepare() rename to legacy_notifications_prepare;
create function public.slm_notifications_prepare() returns integer
language plpgsql security invoker set search_path='' as $$
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
 end loop;return n;
end $$;
revoke all on function slm_private.match_notification_emit(text,text,text,uuid,uuid[]),slm_private.match_notification_history(),slm_private.match_reminders_schedule(),slm_private.push_deliverable(public.slm_notifications,public.slm_push_devices),public.slm_notifications_prepare() from public,anon,authenticated;
grant execute on function slm_private.match_notification_emit(text,text,text,uuid,uuid[]),slm_private.match_notification_history(),slm_private.match_reminders_schedule(),slm_private.push_deliverable(public.slm_notifications,public.slm_push_devices),public.slm_notifications_prepare() to service_role;

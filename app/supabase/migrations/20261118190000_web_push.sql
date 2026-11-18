-- Web Push (VAPID) dla PWA: nowa platforma "web" obok android/ios. Zmiana addytywna, bez usuwania danych.
-- Klucze subskrypcji są sekretne dla klienta: klient ma SELECT wyłącznie na kolumnach id,user_id,platform,enabled,updated_at.
alter table public.slm_push_devices add column web_p256dh text, add column web_auth text;
alter table public.slm_push_devices drop constraint slm_push_devices_platform_check;
alter table public.slm_push_devices add constraint slm_push_devices_platform_check check (platform in ('android','ios','web'));
alter table public.slm_push_devices add constraint slm_push_devices_web_keys check (
 (platform='web' and web_p256dh is not null and web_auth is not null and token like 'https://%')
 or (platform<>'web' and web_p256dh is null and web_auth is null));

create or replace function public.slm_notifications_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare rows jsonb; preferences jsonb; device public.slm_push_devices; v_id uuid; v_hash text; v_version bigint;
 watermark public.slm_push_device_watermarks;
begin
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid'; end if;
 if p_action in ('list','count') then
  select coalesce(jsonb_object_agg(c.category,coalesce(p.push_enabled,true)),'{}') into preferences
   from unnest(array['new_match','vacancy','reminder','match_changed','finance']) c(category)
   left join public.slm_notification_preferences p on p.user_id=p_user and p.category=c.category;
  if p_action='list' then
   select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id),'[]') into rows from (
    select * from public.slm_notifications where user_id=p_user order by created_at desc,id limit 50
     offset greatest(0,least(10000,coalesce((p_body->>'offset')::integer,0)))) n;
  end if;
  return jsonb_build_object('notifications',coalesce(rows,'[]'), 'unread',
   (select count(*) from public.slm_notifications where user_id=p_user and read_at is null),'preferences',preferences);
 elsif p_action='open' then
  select to_jsonb(n) into rows from public.slm_notifications n where user_id=p_user and id=(p_body->>'notification_id')::uuid;
  if rows is null then raise exception 'not_found'; end if;
  update public.slm_notifications set read_at=coalesce(read_at,clock_timestamp()) where user_id=p_user and id=(p_body->>'notification_id')::uuid;
  return rows;
 elsif p_action='read' then
  update public.slm_notifications set read_at=coalesce(read_at,clock_timestamp()) where user_id=p_user and id=(p_body->>'notification_id')::uuid;
  if not found then raise exception 'not_found'; end if;
 elsif p_action='read_all' then
  update public.slm_notifications set read_at=clock_timestamp() where user_id=p_user and read_at is null;
 elsif p_action='preferences' then
  if p_body->>'category' not in ('new_match','vacancy','reminder','match_changed','finance')
   or jsonb_typeof(p_body->'push_enabled') is distinct from 'boolean' then raise exception 'invalid_input'; end if;
  insert into public.slm_notification_preferences(user_id,category,push_enabled)
   values(p_user,p_body->>'category',(p_body->>'push_enabled')::boolean)
   on conflict(user_id,category) do update set push_enabled=excluded.push_enabled;
 elsif p_action='prepare_device' then
  v_id:=nullif(p_body->>'device_id','')::uuid;
  if v_id is null or coalesce(length(p_body->>'device_secret'),0)<>72 then raise exception 'invalid_device'; end if;
  v_hash:=encode(sha256(convert_to(p_body->>'device_secret','UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(v_id::text,8101));
  insert into public.slm_push_device_watermarks(device_id,secret_hash,max_version) values(v_id,v_hash,0) on conflict do nothing;
  if not exists(select 1 from public.slm_push_device_watermarks where device_id=v_id and secret_hash=v_hash)
   then raise exception 'device_mismatch'; end if;
 elsif p_action='register' then
  v_id:=nullif(p_body->>'device_id','')::uuid;
  if v_id is null or coalesce(length(p_body->>'device_secret'),0)<>72
   or coalesce(length(p_body->>'token'),0) not between 20 and 4096
   or p_body->>'platform' not in ('android','ios','web') then raise exception 'invalid_device'; end if;
  -- Web Push: endpoint musi być adresem https, a klucze subskrypcji mają format base64url (p256dh 65 B, auth 16 B).
  if p_body->>'platform'='web' and (p_body->>'token' !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/[^[:space:]]*$'
   or coalesce(p_body->>'p256dh','') !~ '^[A-Za-z0-9_-]{80,100}$'
   or coalesce(p_body->>'auth','') !~ '^[A-Za-z0-9_-]{20,30}$') then raise exception 'invalid_device'; end if;
  v_hash:=encode(sha256(convert_to(p_body->>'device_secret','UTF8')),'hex');
  if coalesce(p_body->>'binding_version','') !~ '^[0-9]{1,15}$' then raise exception 'invalid_device'; end if;
  v_version:=(p_body->>'binding_version')::bigint;
  if v_version<=0 then raise exception 'invalid_device'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_id::text,8101));
  if exists(select 1 from public.slm_push_revocations where device_id=v_id and binding_id=(p_body->>'binding_id')::uuid
   and secret_hash=v_hash) then raise exception 'device_revoked'; end if;
  select * into device from public.slm_push_devices where id=v_id for update;
  if found and device.secret_hash<>v_hash then raise exception 'device_mismatch'; end if;
  select * into watermark from public.slm_push_device_watermarks where device_id=v_id;
  if not found then raise exception 'device_unprepared'; else
   if watermark.secret_hash<>v_hash then raise exception 'device_mismatch'; end if;
   if v_version<watermark.max_version or (v_version=watermark.max_version and
    (device.id is null or device.binding_id<>(p_body->>'binding_id')::uuid or device.user_id<>p_user
     or device.session_id<>p_session or device.token<>p_body->>'token')) then raise exception 'stale_device_binding'; end if;
  end if;
  if nullif(p_body->>'binding_id','')::uuid is null then raise exception 'invalid_device'; end if;
  insert into public.slm_push_device_watermarks(device_id,secret_hash,max_version) values(v_id,v_hash,v_version)
   on conflict(device_id) do update set max_version=greatest(public.slm_push_device_watermarks.max_version,excluded.max_version);
  insert into public.slm_push_devices(id,user_id,session_id,secret_hash,binding_id,binding_version,token,platform,web_p256dh,web_auth)
   values(v_id,p_user,p_session,v_hash,(p_body->>'binding_id')::uuid,v_version,p_body->>'token',p_body->>'platform',
    case when p_body->>'platform'='web' then p_body->>'p256dh' end,case when p_body->>'platform'='web' then p_body->>'auth' end)
   on conflict(id) do update set user_id=excluded.user_id,session_id=excluded.session_id,web_p256dh=excluded.web_p256dh,web_auth=excluded.web_auth,
    token=excluded.token,binding_id=excluded.binding_id,binding_version=excluded.binding_version,platform=excluded.platform,enabled=true,updated_at=clock_timestamp();
  return jsonb_build_object('device_id',v_id);
 else raise exception 'invalid_action'; end if;
 return jsonb_build_object('ok',true);
end $$;

-- Worker rezerwuje tylko platformy, które potrafi obsłużyć (brak Firebase nie blokuje Web Push i odwrotnie).
drop function public.slm_push_claim(integer);
create function public.slm_push_claim(p_limit integer default 20,p_platforms text[] default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare q public.slm_push_queue; n public.slm_notifications; d public.slm_push_devices;
 result jsonb:='[]'; v_lease uuid;
begin
 for q in select qq.* from public.slm_push_queue qq join public.slm_push_devices dd on dd.id=qq.device_id
  where qq.state in ('pending','leased') and qq.next_attempt_at<=clock_timestamp()
  and (qq.state='pending' or qq.lease_until<clock_timestamp())
  and (p_platforms is null or dd.platform=any(p_platforms)) order by qq.next_attempt_at,qq.id
  limit greatest(1,least(p_limit,20)) for update of qq skip locked loop
  select * into n from public.slm_notifications where id=q.notification_id;
  select * into d from public.slm_push_devices where id=q.device_id;
  if q.attempts>=6 then update public.slm_push_queue set state='dead',last_error='attempts_exhausted' where id=q.id;
  elsif not coalesce(slm_private.push_deliverable(n,d),false) then
   update public.slm_push_queue set state='cancelled',last_error='not_eligible' where id=q.id;
  else
   v_lease:=gen_random_uuid();
   update public.slm_push_queue set state='leased',attempts=attempts+1,lease_id=v_lease,lease_until=clock_timestamp()+interval '2 minutes' where id=q.id;
   result:=result||jsonb_build_array(jsonb_build_object('queue_id',q.id,'lease_id',v_lease,'notification_id',n.id,
    'event_id',n.event_id,'kind',n.kind,'platform',d.platform,'token',d.token,'p256dh',d.web_p256dh,'auth',d.web_auth,
    'expires_at',(select expires_at from public.slm_notification_sources where id=n.source_id)));
  end if;
 end loop;
 return result;
end $$;
revoke all on function public.slm_push_claim(integer,text[]) from public,anon,authenticated;
grant execute on function public.slm_push_claim(integer,text[]) to service_role;

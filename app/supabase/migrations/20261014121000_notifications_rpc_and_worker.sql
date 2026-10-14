create function public.slm_push_detach(p_device uuid,p_secret text,p_binding uuid,p_version bigint) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if length(p_secret)<>72 or p_version is null or p_version<=0 then raise exception 'invalid_device'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_device::text,8101));
 -- Nie zapisujemy anonimowych, nieznanych capabilities ani nie ujawniamy ich stanu.
 if not exists(select 1 from public.slm_push_device_watermarks where device_id=p_device
  and secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex')) then return; end if;
 insert into public.slm_push_revocations(device_id,binding_id,secret_hash)
  values(p_device,p_binding,encode(sha256(convert_to(p_secret,'UTF8')),'hex')) on conflict do nothing;
 insert into public.slm_push_device_watermarks(device_id,secret_hash,max_version)
  values(p_device,encode(sha256(convert_to(p_secret,'UTF8')),'hex'),p_version)
  on conflict(device_id) do update set max_version=greatest(public.slm_push_device_watermarks.max_version,excluded.max_version)
   where public.slm_push_device_watermarks.secret_hash=excluded.secret_hash;
 delete from public.slm_push_devices where id=p_device and binding_version<=p_version
  and secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex');
 -- Brak potwierdzenia istnienia urządzenia lub poprawności sekretu.
end $$;
create function public.slm_notifications_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
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
   or p_body->>'platform' not in ('android','ios') then raise exception 'invalid_device'; end if;
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
  insert into public.slm_push_devices(id,user_id,session_id,secret_hash,binding_id,binding_version,token,platform)
   values(v_id,p_user,p_session,v_hash,(p_body->>'binding_id')::uuid,v_version,p_body->>'token',p_body->>'platform')
   on conflict(id) do update set user_id=excluded.user_id,session_id=excluded.session_id,
    token=excluded.token,binding_id=excluded.binding_id,binding_version=excluded.binding_version,platform=excluded.platform,enabled=true,updated_at=clock_timestamp();
  return jsonb_build_object('device_id',v_id);
 else raise exception 'invalid_action'; end if;
 return jsonb_build_object('ok',true);
end $$;

create function slm_private.push_deliverable(n public.slm_notifications,d public.slm_push_devices) returns boolean
language sql stable security invoker set search_path='' as $$
 select d.id is not null and d.enabled and d.user_id=n.user_id
  and slm_private.session_valid(d.user_id,d.session_id,false)
  and coalesce((select push_enabled from public.slm_notification_preferences where user_id=n.user_id and category=n.category),true)
  and exists(select 1 from public.slm_notification_sources s where s.id=n.source_id and s.expires_at>clock_timestamp()
   and (n.category='finance' or exists(select 1 from public.slm_events e where e.id=n.event_id
    and ((n.kind='match_cancelled' and e.status='cancelled') or (n.kind<>'match_cancelled' and e.status='scheduled' and e.starts_at>clock_timestamp()))
    and (n.kind<>'reminder' or (e.starts_at=s.event_starts_at and exists(select 1 from public.slm_event_participants
     where event_id=e.id and responsible_user_id=n.user_id and status='registered')))
    and (n.kind<>'match_changed' or exists(select 1 from public.slm_event_participants where event_id=e.id and responsible_user_id=n.user_id and status='registered'))
    and (n.kind<>'vacancy' or ((select count(*) from public.slm_event_participants where event_id=e.id and status='registered')<e.capacity
     and exists(select 1 from public.slm_event_participants where event_id=e.id and responsible_user_id=n.user_id and status='reserve')
     and slm_private.notification_registration_allowed(n.user_id))))));
$$;
create function public.slm_push_claim(p_limit integer default 20) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare q public.slm_push_queue; n public.slm_notifications; d public.slm_push_devices;
 result jsonb:='[]'; v_lease uuid;
begin
 for q in select * from public.slm_push_queue where state in ('pending','leased') and next_attempt_at<=clock_timestamp()
  and (state='pending' or lease_until<clock_timestamp()) order by next_attempt_at,id
  limit greatest(1,least(p_limit,20)) for update skip locked loop
  select * into n from public.slm_notifications where id=q.notification_id;
  select * into d from public.slm_push_devices where id=q.device_id;
  if q.attempts>=6 then update public.slm_push_queue set state='dead',last_error='attempts_exhausted' where id=q.id;
  elsif not coalesce(slm_private.push_deliverable(n,d),false) then
   update public.slm_push_queue set state='cancelled',last_error='not_eligible' where id=q.id;
  else
   v_lease:=gen_random_uuid();
   update public.slm_push_queue set state='leased',attempts=attempts+1,lease_id=v_lease,lease_until=clock_timestamp()+interval '2 minutes' where id=q.id;
   result:=result||jsonb_build_array(jsonb_build_object('queue_id',q.id,'lease_id',v_lease,'notification_id',n.id,
    'event_id',n.event_id,'kind',n.kind,'platform',d.platform,'token',d.token,
    'expires_at',(select expires_at from public.slm_notification_sources where id=n.source_id)));
  end if;
 end loop;
 return result;
end $$;
create function public.slm_push_check(p_queue uuid,p_lease uuid,p_token_hash text) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.slm_push_queue q join public.slm_notifications n on n.id=q.notification_id
  join public.slm_push_devices d on d.id=q.device_id where q.id=p_queue and q.lease_id=p_lease and q.state='leased'
  and q.lease_until>clock_timestamp() and encode(sha256(convert_to(d.token,'UTF8')),'hex')=p_token_hash
  and slm_private.push_deliverable(n,d));
$$;
create function public.slm_push_finish(p_queue uuid,p_lease uuid,p_result text,p_code text,p_token_hash text,p_retry_after integer default 0) returns void
language plpgsql security invoker set search_path='' as $$
declare q public.slm_push_queue;
begin
 if p_result not in ('sent','retry','dead','cancelled','invalid_token') then raise exception 'invalid_input'; end if;
 select * into q from public.slm_push_queue where id=p_queue and state='leased' and lease_id=p_lease for update;
 if not found then return; end if; -- Spóźniony worker nie zmienia nowszej rezerwacji.
 if p_result='invalid_token' then
  update public.slm_push_devices set enabled=false where id=q.device_id
   and encode(sha256(convert_to(token,'UTF8')),'hex')=p_token_hash;
 end if;
 update public.slm_push_queue set state=case when p_result='retry' and q.attempts<6 then 'pending'
  when p_result='sent' then 'sent' when p_result='cancelled' then 'cancelled' else 'dead' end,
  next_attempt_at=clock_timestamp()+make_interval(secs=>greatest(least(coalesce(p_retry_after,0),3600),least(3600,30*power(2,q.attempts)::integer))),
  last_error=left(p_code,80),sent_at=case when p_result='sent' then clock_timestamp() end,
  lease_id=null,lease_until=null where id=q.id;
end $$;
revoke all on function slm_private.push_deliverable(public.slm_notifications,public.slm_push_devices) from public,anon,authenticated;
grant execute on function slm_private.push_deliverable(public.slm_notifications,public.slm_push_devices) to service_role;
do $$ declare f text; begin
 foreach f in array array['slm_push_detach(uuid,text,uuid,bigint)','slm_notifications_dispatch(uuid,uuid,text,jsonb)',
  'slm_push_claim(integer)','slm_push_check(uuid,uuid,text)','slm_push_finish(uuid,uuid,text,text,text,integer)'] loop
  execute 'revoke all on function public.'||f||' from public,anon,authenticated';
  execute 'grant execute on function public.'||f||' to service_role';
 end loop;
end $$;

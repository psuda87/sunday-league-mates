-- Approved rule: current memberships/public upcoming; history only own/current groups.
-- No account, finance, group-role or RLS grant changes. Existing private helpers remain private.
create function slm_private.match_feed_visible(p_event uuid,p_user uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.slm_matches e where e.id=p_event and (
  slm_private.group_member(e.group_id,p_user)
  or (e.visibility='public' and e.status='scheduled' and e.starts_at>clock_timestamp())
  or ((e.status='cancelled' or e.starts_at<=clock_timestamp()) and exists(
   select 1 from public.slm_match_entries p where p.event_id=e.id and p.responsible_user_id=p_user))));
$$;
revoke all on function slm_private.match_feed_visible(uuid,uuid) from public,anon,authenticated;
grant execute on function slm_private.match_feed_visible(uuid,uuid) to service_role;


-- Prevent unsolicited public-match debt for an unrelated account.
create or replace function slm_private.matches_dispatch_core(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.slm_matches;person public.slm_match_entries;old_person public.slm_match_entries;
 q public.slm_v2_requests;v_group uuid;v_request uuid;v_target uuid;v_access text;v_response jsonb;v_rows jsonb;
 v_admin boolean;v_now timestamptz;v_cutoff timestamptz;v_status text;v_action text;v_sequence bigint;v_released uuid;
 v_count integer;v_name text;v_phone text;v_start timestamptz;v_cost bigint;
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 v_now:=clock_timestamp();
 if p_action='list' then
  return jsonb_build_object('events',(select coalesce(jsonb_agg(slm_private.match_summary(x.id,p_user) order by x.starts_at,x.id),'[]')
   from(select id,starts_at from public.slm_matches where slm_private.match_feed_visible(id,p_user) order by starts_at desc,id limit 100 offset greatest(0,coalesce((p_body->>'offset')::integer,0)))x),'server_now',v_now,'member_creation_enabled',true);
 end if;
 if p_action<>'create' then
  select * into e from public.slm_matches where id=(p_body->>'event_id')::uuid for update;
  if not found then raise exception 'not_found';end if;
  v_group:=e.group_id;v_access:=slm_private.match_access(e.id,p_user);v_now:=clock_timestamp();
  if p_action='detail' and not slm_private.match_feed_visible(e.id,p_user) then raise exception 'not_found';end if;
  if p_action='detail' then
   if v_access='none' then return jsonb_build_object('event',slm_private.match_summary(e.id,p_user),'participants','[]'::jsonb,'server_now',v_now);end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'member_id',p.member_id,'responsible_user_id',p.responsible_user_id,
    'display_name',case when p.member_id is null then p.guest_name else slm_private.player_name(p.member_id) end,
    'responsible_name',slm_private.player_name(p.responsible_user_id),'guest_name',p.guest_name,
    'contact_phone',case when slm_private.group_member(e.group_id,p_user) or p.responsible_user_id=p_user then
      coalesce(p.guest_phone,pp.contact_phone,a.phone) else null end,
    'guest_phone',case when slm_private.group_member(e.group_id,p_user) or p.responsible_user_id=p_user then p.guest_phone else null end,
    'status',p.status,'absent',p.absent,'joined_at',p.joined_at) order by p.joined_at,p.id),'[]') into v_rows
   from public.slm_match_entries p left join public.slm_player_profiles pp on pp.user_id=p.responsible_user_id
   left join public.slm_aliases a on a.user_id=p.responsible_user_id
   where p.event_id=e.id and(v_access='full' or p.responsible_user_id=p_user)
    and(p.status<>'withdrawn' or p.responsible_user_id=p_user or slm_private.match_finance(e.id,p_user));
   return jsonb_build_object('event',slm_private.match_summary(e.id,p_user),'participants',v_rows,'server_now',v_now,
    'can_register_paid',slm_private.registration_allowed(p_user,e.cost_cents));
  end if;
 else v_group:=(p_body->>'group_id')::uuid;end if;
 v_request:=nullif(p_body->>'request_id','')::uuid;
 if v_request is null then raise exception 'request_required';end if;
 select * into q from public.slm_v2_requests where actor_id=p_user and request_id=v_request;
 if found then
  if q.action<>'match:'||p_action or q.body<>p_body then raise exception 'idempotency_conflict';end if;
  return q.response;
 end if;
 v_admin:=slm_private.match_finance(e.id,p_user);
 if p_action in ('create','edit') then
  if p_action='create' and not slm_private.group_member(v_group,p_user) then raise exception 'forbidden';end if;
  if p_action='edit' and(e.created_by<>p_user or not slm_private.group_member(v_group,p_user)) then raise exception 'forbidden';end if;
  if not exists(select 1 from public.slm_groups where id=v_group and not archived) then raise exception 'group_archived';end if;
  v_start:=case when p_body?'starts_at' then (p_body->>'starts_at')::timestamptz else ((p_body->>'date')::date+(p_body->>'time')::time) at time zone 'Europe/Warsaw' end;v_cost:=(p_body->>'cost_cents')::bigint;
  if v_start is null or v_start<=v_now then raise exception 'registration_closed';end if;
  if p_body->>'visibility' not in ('public','private') or p_body->>'visibility' is null then raise exception 'invalid_event';end if;
  if p_action='create' then
   insert into public.slm_matches(group_id,created_by,name,visibility,starts_at,location,address,duration_minutes,capacity,cost_cents)
   values(v_group,p_user,trim(p_body->>'name'),p_body->>'visibility',v_start,trim(p_body->>'location'),trim(coalesce(p_body->>'address','')),
    (p_body->>'duration_minutes')::integer,(p_body->>'capacity')::integer,v_cost) returning * into e;v_action:='created';
  else
   if e.status='cancelled' or e.starts_at<=v_now then raise exception 'registration_closed';end if;
   if e.version is distinct from (p_body->>'expected_version')::bigint then raise exception 'stale_version';end if;
   if (p_body->>'group_id')::uuid is distinct from e.group_id then raise exception 'group_mismatch';end if;
   select count(*) into v_count from public.slm_match_entries where event_id=e.id and status='registered';
   if v_count>(p_body->>'capacity')::integer then raise exception 'capacity_too_small';end if;
   update public.slm_matches set name=trim(p_body->>'name'),visibility=p_body->>'visibility',starts_at=v_start,
    location=trim(p_body->>'location'),address=trim(coalesce(p_body->>'address','')),duration_minutes=(p_body->>'duration_minutes')::integer,
    capacity=(p_body->>'capacity')::integer,cost_cents=v_cost where id=e.id returning * into e;v_action:='edited';
  end if;
 elsif p_action='cancel' then
  if not v_admin then raise exception 'forbidden';end if;
  if e.status='cancelled' then raise exception 'event_cancelled';end if;
  if e.approved_at is not null and length(trim(coalesce(p_body->>'reason','')))=0 then raise exception 'reason_required';end if;
  update public.slm_matches set status='cancelled' where id=e.id returning * into e;v_action:='cancelled';
 else
  if e.status='cancelled' then raise exception 'event_cancelled';end if;
  if v_now>=e.starts_at and p_action<>'attendance' then raise exception 'registration_closed';end if;
  if p_action in ('join','reserve','guest') then
   if v_access<>'full' then raise exception 'forbidden';end if;
   v_target:=coalesce(nullif(p_body->>'user_id','')::uuid,p_user);
   if v_target<>p_user and(not v_admin or not slm_private.group_member(e.group_id,v_target)) then raise exception 'forbidden';end if;
   if not exists(select 1 from public.slm_account_security where user_id=v_target and active and operation_id is null)
    or(e.visibility='private' and not slm_private.group_member(e.group_id,v_target)) then raise exception 'invalid_participant';end if;
   if not slm_private.registration_allowed(v_target,e.cost_cents) then raise exception 'registration_blocked';end if;
   v_status:=case when p_action='reserve' or p_body->>'list'='reserve' then 'reserve' else 'registered' end;
   select count(*) into v_count from public.slm_match_entries where event_id=e.id and status='registered';
   if v_status='registered' and v_count>=e.capacity then raise exception 'event_full';end if;
   if p_action='guest' then
    v_name:=trim(p_body->>'guest_name');v_phone:=nullif(p_body->>'guest_phone','');
    insert into public.slm_match_entries(event_id,responsible_user_id,guest_name,guest_phone,status,payable)
     values(e.id,v_target,v_name,v_phone,v_status,v_status='registered') returning * into person;
   else
    select * into person from public.slm_match_entries where event_id=e.id and member_id=v_target and status<>'withdrawn';
    if found then
     if person.status=v_status then raise exception 'duplicate_signup';end if;
     old_person:=person;
     update public.slm_match_entries set status=v_status,joined_at=v_now,absent=false where id=person.id returning * into person;
    else
     insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status,payable)
      values(e.id,v_target,v_target,v_status,v_status='registered') returning * into person;
    end if;
   end if;
   v_action:=case when v_status='registered' then 'joined' else 'reserved' end;
  elsif p_action in ('withdraw','edit_guest','move_guest','attendance') then
   select * into person from public.slm_match_entries where id=(p_body->>'participant_id')::uuid and event_id=e.id for update;
   if not found then raise exception 'not_found';end if;
   if person.responsible_user_id<>p_user and not v_admin then raise exception 'forbidden';end if;
   old_person:=person;
   if p_action='attendance' then
    if e.approved_at is not null and length(trim(coalesce(p_body->>'reason','')))=0 then raise exception 'reason_required';end if;
    if not v_admin then raise exception 'forbidden';end if;
    if jsonb_typeof(p_body->'absent') is distinct from 'boolean' then raise exception 'invalid_input';end if;
    update public.slm_match_entries set absent=(p_body->>'absent')::boolean where id=person.id returning * into person;v_action:='attendance';
   elsif p_action='withdraw' then
    if person.status='withdrawn' then raise exception 'duplicate_signup';end if;
    update public.slm_match_entries set status='withdrawn',withdrawn_at=v_now where id=person.id returning * into person;v_action:='withdrawn';
   else
    if person.member_id is not null then raise exception 'invalid_guest';end if;
    if p_action='edit_guest' then
     update public.slm_match_entries set guest_name=trim(p_body->>'guest_name'),guest_phone=nullif(p_body->>'guest_phone','') where id=person.id returning * into person;v_action:='guest_edited';
    else
     v_status:=case when p_body->>'list'='reserve' then 'reserve' else 'registered' end;
     if v_status=person.status then raise exception 'duplicate_signup';end if;
     if v_status='registered' then
      if v_access<>'full' then raise exception 'forbidden';end if;
      if not slm_private.registration_allowed(person.responsible_user_id,e.cost_cents) then raise exception 'registration_blocked';end if;
      if(select count(*) from public.slm_match_entries where event_id=e.id and status='registered')>=e.capacity then raise exception 'event_full';end if;
     end if;
     update public.slm_match_entries set status=v_status,joined_at=v_now where id=person.id returning * into person;
     v_action:=case when v_status='registered' then 'joined' else 'reserved' end;
    end if;
   end if;
  else raise exception 'invalid_action';end if;
 end if;
 v_cutoff:=((e.starts_at at time zone 'Europe/Warsaw')::date+time '17:00') at time zone 'Europe/Warsaw';
 insert into public.slm_match_history(event_id,entry_id,actor_id,action,server_time,snapshot)
  values(e.id,person.id,p_user,v_action,v_now,jsonb_build_object('before',to_jsonb(old_person),'after',to_jsonb(person),'request',p_body)) returning sequence into v_sequence;
 if person.id is not null and v_action='joined' then
  if person.release_sequence is null then
   select id into v_released from public.slm_match_entries where event_id=e.id and release_sequence is not null and replacement_id is null
    and id<>person.id and coalesce(charge_override,payable) order by release_sequence,id limit 1 for update;
   if v_released is not null then
    update public.slm_match_entries set payable=false,charge_override=false,replacement_id=person.id where id=v_released;
   end if;
  end if;
  update public.slm_match_entries set payable=true,release_sequence=null,replacement_id=null where id=person.id;
 elsif person.id is not null and v_action in ('withdrawn','reserved') and old_person.status='registered' then
  select count(*) into v_count from public.slm_match_entries where event_id=e.id and status='registered';
  update public.slm_match_entries set payable=v_now>=v_cutoff and v_count<10,release_sequence=case when v_now>=v_cutoff and v_count<10 then v_sequence end where id=person.id;
 end if;
 update public.slm_matches set version=version+1 where id=e.id returning * into e;
 perform slm_private.group_revise(e.id,p_user,coalesce(nullif(trim(p_body->>'reason'),''),'Zmiana udziału'));
 perform slm_private.group_surplus_sync(e.group_id,p_user);
 v_response:=jsonb_build_object('event_id',e.id,'participant_id',person.id,'version',e.version);
 insert into public.slm_v2_requests values(p_user,v_request,'match:'||p_action,p_body,v_response,clock_timestamp());
 return v_response;
end $$;

create or replace function slm_private.match_summary(p_event uuid,p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',e.id,'group_id',e.group_id,'group_name',g.name,'created_by',e.created_by,
 'name',e.name,'visibility',e.visibility,'starts_at',e.starts_at,'location',e.location,'status',e.status,
 'access',slm_private.match_access(e.id,p_user))||case when slm_private.match_access(e.id,p_user)='none' then '{}'::jsonb else
 jsonb_build_object('duration_minutes',e.duration_minutes,'capacity',e.capacity,'cost_cents',e.cost_cents,
 'total_cost',e.cost_cents/100.0,'hourly_rate',e.cost_cents*60.0/(100*e.duration_minutes),
 'minimum_players',10,'registered_count',case when slm_private.match_access(e.id,p_user)='full' then (select count(*) from public.slm_match_entries where event_id=e.id and status='registered') else null end,
 'reserve_count',case when slm_private.match_access(e.id,p_user)='full' then (select count(*) from public.slm_match_entries where event_id=e.id and status='reserve') else null end,
 'registration_open',e.status='scheduled' and clock_timestamp()<e.starts_at,
 'decision_required',slm_private.match_access(e.id,p_user)='full' and e.status='scheduled' and clock_timestamp()>=((e.starts_at at time zone 'Europe/Warsaw')::date+time '17:00') at time zone 'Europe/Warsaw'
 and (select count(*) from public.slm_match_entries where event_id=e.id and status='registered')<10,
 'approved_at',e.approved_at,'version',e.version,'settlements_active',true,
 'can_manage',slm_private.match_finance(e.id,p_user),'can_edit',e.created_by=p_user and slm_private.group_member(e.group_id,p_user)) end||jsonb_build_object('current_group_member',slm_private.group_member(e.group_id,p_user),'own_history',exists(select 1 from public.slm_match_entries h where h.event_id=e.id and h.responsible_user_id=p_user),'own_participation',exists(select 1 from public.slm_match_entries p where p.event_id=e.id and p.responsible_user_id=p_user and p.status in ('registered','reserve')))
 from public.slm_matches e join public.slm_groups g on g.id=e.group_id where e.id=p_event;
$$;

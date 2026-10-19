-- Additive fixes; preserve applied migration history.
create or replace function public.slm_groups_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.slm_groups; r public.slm_group_requests; q public.slm_v2_requests;
 v_group uuid; v_target uuid; v_request uuid; v_response jsonb; v_name text; v_desc text;
 v_kind text; v_next uuid; v_actor_admin boolean; v_accept boolean; v_private boolean:=false;
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_action='inbox' then
  return jsonb_build_object('requests',(select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'group_id',r.group_id,'group_name',a.name,'kind',r.kind,'state',r.state) order by r.created_at),'[]')
   from public.slm_group_requests r join public.slm_groups a on a.id=r.group_id
   where r.target_id=p_user and r.kind='invite' and r.state='pending' and not a.archived));
 end if;
 if p_action='list' then
  return jsonb_build_object('groups',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]') from (
   select a.*,m.organizer from public.slm_groups a join public.slm_group_members m on m.group_id=a.id
   where m.user_id=p_user and not a.archived) x));
 end if;
 if p_action='search' then
  v_name:=trim(p_body->>'query');
  if length(v_name)<2 then return jsonb_build_object('groups','[]'::jsonb);end if;
  return jsonb_build_object('groups',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
   select id,name,description from public.slm_groups where not archived and name ilike '%'||left(v_name,64)||'%' order by name,id limit 30)x));
 end if;
 v_group:=nullif(p_body->>'group_id','')::uuid;
 if p_action='detail' then
  if not slm_private.group_member(v_group,p_user) then raise exception 'not_found';end if;
  select * into g from public.slm_groups where id=v_group;
  return jsonb_build_object('group',to_jsonb(g),'members',(select coalesce(jsonb_agg(jsonb_build_object(
   'user_id',m.user_id,'nickname',coalesce(pp.nickname,a.login),'organizer',m.organizer,'joined_at',m.joined_at) order by m.sequence),'[]')
   from public.slm_group_members m left join public.slm_player_profiles pp on pp.user_id=m.user_id
   left join public.slm_aliases a on a.user_id=m.user_id where m.group_id=g.id),
   'requests',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select rr.id,rr.group_id,rr.kind,rr.state,rr.actor_id,case when not rr.private or rr.target_id=p_user then rr.target_id end as target_id from public.slm_group_requests rr
     where rr.group_id=g.id and (rr.target_id=p_user or rr.actor_id=p_user or slm_private.group_admin(g.id,p_user)))x));
 end if;
 v_request:=nullif(p_body->>'request_id','')::uuid;
 if v_request is null then raise exception 'request_required';end if;
 select * into q from public.slm_v2_requests where actor_id=p_user and request_id=v_request;
 if found then
  if q.action<>p_action or q.body<>p_body then raise exception 'idempotency_conflict';end if;
  return q.response;
 end if;
 if p_action='create' then
  v_name:=trim(p_body->>'name');v_desc:=trim(coalesce(p_body->>'description',''));
  if v_name is null or length(v_name) not between 1 and 64 or length(v_desc)>180 then raise exception 'invalid_group';end if;
  insert into public.slm_groups(name,description,admin_id) values(v_name,v_desc,p_user) returning * into g;
  insert into public.slm_group_members(group_id,user_id,organizer) values(g.id,p_user,true);
 else
  if p_action in ('decide','cancel_request') then
   select * into r from public.slm_group_requests where id=(p_body->>'id')::uuid for update;
   if not found then raise exception 'not_found';end if;
   v_group:=r.group_id;
  end if;
  select * into g from public.slm_groups where id=v_group and not archived for update;
  if not found then raise exception 'not_found';end if;
  v_actor_admin:=slm_private.group_admin(g.id,p_user);
  v_target:=nullif(p_body->>'user_id','')::uuid;
  if p_action in ('join','invite','proposal','phone') then
   if p_action='join' then v_target:=p_user;v_kind:='join';
   else
    if not slm_private.group_member(g.id,p_user) then raise exception 'forbidden';end if;
    v_kind:=case when v_actor_admin then 'invite' else 'proposal' end;
    if p_action='phone' then
     v_private:=true;
     if coalesce(p_body->>'phone','') !~ '^\+48[0-9]{9}$' then raise exception 'invalid_phone';end if;
     select user_id into v_target from public.slm_player_profiles where contact_phone=p_body->>'phone';
     if v_target is null then select user_id into v_target from public.slm_aliases where phone=p_body->>'phone';end if;
    elsif v_target is null or not exists(select 1 from public.slm_account_security where user_id=v_target and active) then raise exception 'not_found';end if;
   end if;
   if v_target is not null and slm_private.group_member(g.id,v_target) then
    if not v_private then raise exception 'already_member';end if;
    v_target:=null;
   end if;
   insert into public.slm_group_requests(group_id,actor_id,target_id,kind,private)
    values(g.id,p_user,v_target,v_kind,v_private) on conflict do nothing;
  elsif p_action='decide' then
   if r.state<>'pending' or jsonb_typeof(p_body->'accept') is distinct from 'boolean' then raise exception 'request_processed';end if;
   v_accept:=(p_body->>'accept')::boolean;
   if r.kind='invite' then
    if r.target_id is distinct from p_user then raise exception 'forbidden';end if;
   elsif not v_actor_admin then raise exception 'forbidden';end if;
   if v_accept and r.kind='proposal' then
    update public.slm_group_requests set state='accepted',decided_at=clock_timestamp() where id=r.id;
    insert into public.slm_group_requests(group_id,actor_id,target_id,kind,private)
      values(g.id,p_user,r.target_id,'invite',r.private) on conflict do nothing;
   else
    update public.slm_group_requests set state=case when v_accept then 'accepted' else 'rejected' end,decided_at=clock_timestamp() where id=r.id;
    if v_accept and r.target_id is not null then
     insert into public.slm_group_members(group_id,user_id) values(g.id,r.target_id) on conflict do nothing;
    end if;
   end if;
  elsif p_action='cancel_request' then
   if r.actor_id<>p_user or r.state<>'pending' then raise exception 'forbidden';end if;
   update public.slm_group_requests set state='cancelled',decided_at=clock_timestamp() where id=r.id;
  elsif p_action in ('permission','transfer','remove') then
   if not v_actor_admin or v_target=g.admin_id or not slm_private.group_member(g.id,v_target) then raise exception 'forbidden';end if;
   if p_action='permission' then
    if jsonb_typeof(p_body->'organizer') is distinct from 'boolean' then raise exception 'invalid_input';end if;
    update public.slm_group_members set organizer=(p_body->>'organizer')::boolean where group_id=g.id and user_id=v_target;
   elsif p_action='transfer' then update public.slm_groups set admin_id=v_target where id=g.id;
   else delete from public.slm_group_members where group_id=g.id and user_id=v_target;
   end if;
  elsif p_action='leave' then
   if not slm_private.group_member(g.id,p_user) then raise exception 'forbidden';end if;
   if g.admin_id=p_user then
    select user_id into v_next from public.slm_group_members where group_id=g.id and user_id<>p_user order by organizer desc,sequence,user_id limit 1;
    if v_next is null then update public.slm_groups set archived=true where id=g.id;
    else update public.slm_groups set admin_id=v_next where id=g.id;end if;
   end if;
   delete from public.slm_group_members where group_id=g.id and user_id=p_user;
  else raise exception 'invalid_action';end if;
  update public.slm_groups set version=version+1 where id=g.id;
 end if;
 -- Phone lookups have the exact same acknowledgement regardless of target existence.
 v_response:=case when p_action='phone' then jsonb_build_object('accepted',true)
  else jsonb_build_object('group_id',g.id,'ok',true) end;
 insert into public.slm_group_audit(group_id,actor_id,action,snapshot)
  values(g.id,p_user,p_action,case when v_private then '{}'::jsonb else jsonb_build_object('target_id',v_target,'request_id',v_request) end);
 insert into public.slm_v2_requests values(p_user,v_request,p_action,p_body,v_response,clock_timestamp());
 return v_response;
end $$;
revoke all on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) to service_role;

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
 'can_manage',slm_private.match_finance(e.id,p_user),'can_edit',e.created_by=p_user and slm_private.group_member(e.group_id,p_user)) end
 from public.slm_matches e join public.slm_groups g on g.id=e.group_id;
$$;

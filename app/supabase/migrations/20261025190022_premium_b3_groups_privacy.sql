-- B3: additive, group-scoped consent. No data reset and no Cloud rollout.
begin;
alter table public.slm_group_members add column share_full_name boolean not null default false;

create function slm_private.public_player_name(p_target uuid) returns text
language sql stable security invoker set search_path='' as $$
 select coalesce(nullif(trim(n.nickname),''),case when a.login not like '%@%' then nullif(trim(a.login),'') end,
 nullif(split_part(regexp_replace(trim(p.full_name),'\s+',' ','g'),' ',1),''),'Zawodnik')
 from public.slm_profiles p left join public.slm_player_profiles n on n.user_id=p.user_id
 left join public.slm_aliases a on a.user_id=p.user_id where p.user_id=p_target;
$$;
revoke all on function slm_private.public_player_name(uuid) from public,anon,authenticated;
grant execute on function slm_private.public_player_name(uuid) to service_role;
-- Unscoped labels (including public match participants) must never reveal a private surname.
create or replace function slm_private.player_name(p_user uuid) returns text
language sql stable security invoker set search_path='' as $$ select slm_private.public_player_name(p_user); $$;

-- Historical endpoints must not bypass the new surname projection. Only label
-- expressions change: financial calculations, history and event rules stay intact.
do $$ declare definition text; f regprocedure; pattern text :=
 'case when pr.display_as=''full_name''\s+and length\(trim\(pr.full_name\)\)>0 then pr.full_name else a.login end';
begin
 foreach f in array array['slm_private.events_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure,
 'slm_private.finance_preview(uuid)'::regprocedure] loop
  definition:=pg_get_functiondef(f);
  if definition !~ pattern then raise exception 'legacy_profile_projection_contract_changed';end if;
  execute regexp_replace(definition,pattern,'slm_private.player_name(pr.user_id)','g');
 end loop;
 definition:=pg_get_functiondef('slm_private.finance_account(uuid,integer)'::regprocedure);
 if position('coalesce(actor_profile.full_name,actor_alias.login)' in definition)=0 then raise exception 'legacy_actor_projection_contract_changed';end if;
 execute replace(definition,'coalesce(actor_profile.full_name,actor_alias.login)','slm_private.player_name(ledger.actor_id)');
end $$;

create function slm_private.group_profile(p_viewer uuid,p_target uuid,p_group uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('user_id',m.user_id,'nickname',slm_private.public_player_name(m.user_id),
 'full_name',case when m.user_id=p_viewer or m.share_full_name or slm_private.group_admin(p_group,p_viewer) then p.full_name end,
 'contact_phone',coalesce(n.contact_phone,a.phone),'jersey_number',n.jersey_number,
 'organizer',m.organizer,'joined_at',m.joined_at,'share_full_name',m.share_full_name)
 from public.slm_group_members m join public.slm_profiles p on p.user_id=m.user_id
 left join public.slm_player_profiles n on n.user_id=m.user_id left join public.slm_aliases a on a.user_id=m.user_id
 where m.group_id=p_group and m.user_id=p_target and slm_private.group_member(p_group,p_viewer);
$$;
revoke all on function slm_private.group_profile(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function slm_private.group_profile(uuid,uuid,uuid) to service_role;
-- Raw rows contain full_name: members without consent must use the safe RPC projection.
create or replace function slm_private.shared_profile(p_target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select slm_private.current_session_valid() and(auth.uid()=p_target or exists(
 select 1 from public.slm_group_members viewer join public.slm_groups g on g.id=viewer.group_id
 join public.slm_group_members target on target.group_id=g.id
 where viewer.user_id=auth.uid() and target.user_id=p_target and not g.archived
 and(target.share_full_name or g.admin_id=auth.uid())) or exists(
 select 1 from public.slm_group_requests r join public.slm_groups g on g.id=r.group_id
 where r.target_id=p_target and r.kind='join' and r.state='pending' and g.admin_id=auth.uid()
 and slm_private.group_member(g.id,auth.uid())));
$$;
-- Keep the existing session-checked policy and its narrowly scoped helper grants.

-- Keep all existing transactional membership and succession logic in one implementation.
alter function public.slm_groups_dispatch(uuid,uuid,text,jsonb) rename to groups_dispatch_b3_base;
alter function public.groups_dispatch_b3_base(uuid,uuid,text,jsonb) set schema slm_private;
revoke all on function slm_private.groups_dispatch_b3_base(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function slm_private.groups_dispatch_b3_base(uuid,uuid,text,jsonb) to service_role;
create function public.slm_groups_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.slm_groups; result jsonb; request_key uuid; cached public.slm_v2_requests; target uuid;
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_action='list' then
  return jsonb_build_object('groups',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]') from (
   select a.*,m.organizer,(select count(*) from public.slm_group_members mm where mm.group_id=a.id) as member_count,
   (select count(*) from public.slm_group_requests r where r.group_id=a.id and r.state='pending' and r.kind<>'invite'
   and(a.admin_id=p_user or r.actor_id=p_user)) as pending_count
   from public.slm_groups a join public.slm_group_members m on m.group_id=a.id where m.user_id=p_user and not a.archived)x));
 elsif p_action='search' then
  if length(trim(coalesce(p_body->>'query','')))<2 then return jsonb_build_object('groups','[]'::jsonb);end if;
  return jsonb_build_object('groups',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
   select a.id,a.name,a.description,(select count(*) from public.slm_group_members m where m.group_id=a.id) as member_count
   from public.slm_groups a where not a.archived and a.name ilike '%'||left(trim(p_body->>'query'),64)||'%' order by a.name,a.id limit 30)x));
 elsif p_action='inbox' then
  result:=slm_private.groups_dispatch_b3_base(p_user,p_session,p_action,p_body);
  return result||jsonb_build_object('outgoing',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
   select r.id,r.group_id,gr.name as group_name,r.kind,r.state from public.slm_group_requests r join public.slm_groups gr on gr.id=r.group_id
   where r.actor_id=p_user and r.kind='join' and not gr.archived order by r.created_at desc limit 50)x));
 end if;
 select * into g from public.slm_groups where id=nullif(p_body->>'group_id','')::uuid and not archived;
 if p_action in ('detail','profile','candidates','consent') then
  if g.id is null or not slm_private.group_member(g.id,p_user) then raise exception 'not_found';end if;
  if p_action='profile' then
   target:=nullif(p_body->>'user_id','')::uuid; result:=slm_private.group_profile(p_user,target,g.id);
   if result is null then raise exception 'not_found';end if;return result;
  elsif p_action='candidates' then
   if length(trim(coalesce(p_body->>'query','')))<2 then return jsonb_build_object('players','[]'::jsonb);end if;
   return jsonb_build_object('players',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select p.user_id as id,slm_private.public_player_name(p.user_id) as name
    from public.slm_profiles p join public.slm_account_security s on s.user_id=p.user_id
    where s.active and s.operation_id is null and not slm_private.group_member(g.id,p.user_id)
    and slm_private.public_player_name(p.user_id) ilike '%'||left(trim(p_body->>'query'),64)||'%'
    order by name,p.user_id limit 5)x));
  elsif p_action='detail' then
   return jsonb_build_object('group',to_jsonb(g),'members',(select coalesce(jsonb_agg(
    slm_private.group_profile(p_user,m.user_id,g.id) order by m.sequence),'[]') from public.slm_group_members m where m.group_id=g.id),
    'requests',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
     select r.id,r.group_id,r.kind,r.state,r.actor_id,slm_private.public_player_name(r.actor_id) as actor_name,
     case when not r.private or r.target_id=p_user then r.target_id end as target_id,
     case when not r.private or r.target_id=p_user then slm_private.public_player_name(r.target_id) end as target_name,
     case when g.admin_id=p_user and r.kind='join' and r.state='pending' then coalesce(pp.contact_phone,a.phone) end as contact_phone
     from public.slm_group_requests r left join public.slm_player_profiles pp on pp.user_id=r.target_id
     left join public.slm_aliases a on a.user_id=r.target_id where r.group_id=g.id
     and(r.actor_id=p_user or r.target_id=p_user or g.admin_id=p_user))x));
  else
   if jsonb_typeof(p_body->'share_full_name') is distinct from 'boolean' or p_body ? 'user_id' then raise exception 'invalid_input';end if;
   request_key:=nullif(p_body->>'request_id','')::uuid;if request_key is null then raise exception 'request_required';end if;
   select * into cached from public.slm_v2_requests where actor_id=p_user and request_id=request_key;
   if found then
    if cached.action<>'consent' or cached.body<>p_body then raise exception 'idempotency_conflict';end if;return cached.response;
   end if;
   update public.slm_group_members set share_full_name=(p_body->>'share_full_name')::boolean where group_id=g.id and user_id=p_user;
   result:=jsonb_build_object('ok',true,'group_id',g.id);
   insert into public.slm_v2_requests values(p_user,request_key,'consent',p_body,result,clock_timestamp());return result;
  end if;
 end if;
 -- Validation supplements existing length checks; mutations still use the approved implementation.
 if p_action='create' and ((coalesce(p_body->>'name','')||coalesce(p_body->>'description','')) ~ '[[:cntrl:]<>]') then raise exception 'invalid_group';end if;
 return slm_private.groups_dispatch_b3_base(p_user,p_session,p_action,p_body);
end $$;
revoke all on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) to service_role;
commit;

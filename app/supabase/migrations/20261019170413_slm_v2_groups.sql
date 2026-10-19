-- New model is additive: legacy accounts and immutable finance history are untouched.
create table public.slm_groups (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 64),
 description text not null default '' check(length(description)<=180),
 admin_id uuid not null references auth.users(id), archived boolean not null default false,
 version bigint not null default 1, created_at timestamptz not null default clock_timestamp()
);
create table public.slm_group_members (
 group_id uuid not null references public.slm_groups(id),user_id uuid not null references auth.users(id),
 organizer boolean not null default false, joined_at timestamptz not null default clock_timestamp(),
 sequence bigint generated always as identity,primary key(group_id,user_id)
);
create index slm_group_member_user on public.slm_group_members(user_id,group_id);
create table public.slm_group_requests (
 id uuid primary key default gen_random_uuid(),group_id uuid not null references public.slm_groups(id),
 actor_id uuid not null references auth.users(id),target_id uuid references auth.users(id),
 kind text not null check(kind in ('join','invite','proposal')),state text not null default 'pending'
 check(state in ('pending','accepted','rejected','cancelled')),private boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),decided_at timestamptz
);
create unique index slm_group_request_pending on public.slm_group_requests(group_id,target_id,kind) where state='pending' and target_id is not null;
create table public.slm_group_audit (
 id bigint generated always as identity primary key,group_id uuid not null references public.slm_groups(id),
 actor_id uuid not null references auth.users(id),action text not null,snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create table public.slm_v2_requests (
 actor_id uuid not null references auth.users(id),request_id uuid not null,action text not null,
 body jsonb not null,response jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,request_id)
);
create table public.slm_player_profiles (
 user_id uuid primary key references auth.users(id),nickname text not null check(length(trim(nickname)) between 1 and 48),
 contact_phone text unique check(contact_phone is null or contact_phone ~ '^\+48[0-9]{9}$'),
 jersey_number integer check(jersey_number between 0 and 99),email_account boolean not null default false
);
create table public.slm_legacy_scope (
 singleton boolean primary key default true check(singleton),group_id uuid not null unique references public.slm_groups(id)
);
-- Only map the historical single group if its owner is unambiguous. No amount updates.
do $$ declare owner_id uuid; g uuid; n integer; begin
 if exists(select 1 from public.slm_aliases) then
  select count(*),min(user_id::text)::uuid into n,owner_id from public.slm_roles where role='admin';
  if n<>1 then raise exception 'legacy_group_owner_decision_required'; end if;
  insert into public.slm_groups(name,admin_id) values('Sunday League Mates',owner_id) returning id into g;
  insert into public.slm_legacy_scope(group_id) values(g);
  insert into public.slm_group_members(group_id,user_id,organizer)
   select g,user_id,user_id=owner_id from public.slm_aliases;
 end if;
 insert into public.slm_player_profiles(user_id,nickname)
  select user_id,login from public.slm_aliases;
end $$;
create function slm_private.group_member(p_group uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.slm_group_members where group_id=p_group and user_id=p_user);
$$;
create function slm_private.group_admin(p_group uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.slm_groups where id=p_group and admin_id=p_user and not archived)
 and slm_private.group_member(p_group,p_user);
$$;
create function slm_private.group_organizer(p_group uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select slm_private.group_admin(p_group,p_user) or exists(select 1 from public.slm_group_members
 where group_id=p_group and user_id=p_user and organizer);
$$;
revoke all on function slm_private.group_member(uuid,uuid),slm_private.group_admin(uuid,uuid),slm_private.group_organizer(uuid,uuid) from public,anon,authenticated;
grant execute on function slm_private.group_member(uuid,uuid),slm_private.group_admin(uuid,uuid),slm_private.group_organizer(uuid,uuid) to service_role;
-- The only client-callable helper fixes the identity to the caller, never arbitrary users.
create function slm_private.own_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select slm_private.current_session_valid() and slm_private.group_member(p_group,auth.uid());
$$;
revoke all on function slm_private.own_group_member(uuid) from public,anon;
grant execute on function slm_private.own_group_member(uuid) to authenticated,service_role;
do $$ declare t text;begin
 foreach t in array array['slm_groups','slm_group_members','slm_group_requests','slm_group_audit','slm_v2_requests','slm_player_profiles','slm_legacy_scope'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.slm_group_members_sequence_seq,public.slm_group_audit_id_seq to service_role;
grant select on public.slm_groups,public.slm_group_members to authenticated;
create policy own_groups on public.slm_groups for select to authenticated using(slm_private.own_group_member(id));
create policy own_memberships on public.slm_group_members for select to authenticated using(slm_private.own_group_member(group_id));
create trigger slm_group_audit_immutable before update or delete on public.slm_group_audit for each row execute function slm_private.finance_immutable();
create trigger slm_v2_requests_immutable before update or delete on public.slm_v2_requests for each row execute function slm_private.finance_immutable();
revoke update,delete,truncate on public.slm_group_audit,public.slm_v2_requests from service_role;

create function public.slm_groups_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.slm_groups; r public.slm_group_requests; q public.slm_v2_requests;
 v_group uuid; v_target uuid; v_request uuid; v_response jsonb; v_name text; v_desc text;
 v_kind text; v_next uuid; v_actor_admin boolean; v_accept boolean; v_private boolean:=false;
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
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
    select rr.id,rr.group_id,rr.kind,rr.state,rr.actor_id,rr.target_id from public.slm_group_requests rr
     where rr.group_id=g.id and not rr.private and (rr.target_id=p_user or rr.actor_id=p_user or slm_private.group_admin(g.id,p_user)))x));
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
   if r.state<>'pending' or jsonb_typeof(p_body->'accept')<>'boolean' then raise exception 'request_processed';end if;
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
    if jsonb_typeof(p_body->'organizer')<>'boolean' then raise exception 'invalid_input';end if;
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

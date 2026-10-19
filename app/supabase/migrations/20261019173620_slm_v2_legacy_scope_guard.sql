-- Historical API remains available, but it cannot create new unscoped matches.
create function slm_private.legacy_finance_manager(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.slm_legacy_scope) then exists(
 select 1 from public.slm_legacy_scope s where slm_private.group_finance_admin(s.group_id,p_user))
 else exists(select 1 from public.slm_roles where user_id=p_user and role='admin') end;
$$;
revoke all on function slm_private.legacy_finance_manager(uuid) from public,anon,authenticated;
grant execute on function slm_private.legacy_finance_manager(uuid) to service_role;
create or replace function slm_private.finance_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select slm_private.current_session_valid() and slm_private.legacy_finance_manager(auth.uid());
$$;
-- Keep the established bodies, replacing only their old application-role authorization.
do $$ declare definition text;old_check text:='select role=''admin'' into v_admin from public.slm_roles where user_id=p_user for share;';f regprocedure;
begin
 foreach f in array array['slm_private.settlements_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure,'slm_private.events_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure] loop
 definition:=pg_get_functiondef(f);
 if position(old_check in definition)=0 then raise exception 'legacy_authorization_contract_changed';end if;
 execute replace(definition,old_check,'select slm_private.legacy_finance_manager(p_user) into v_admin;');
 end loop;
end $$;
alter function public.slm_events_dispatch(uuid,uuid,text,jsonb) set schema slm_private;
alter function slm_private.slm_events_dispatch(uuid,uuid,text,jsonb) rename to legacy_events_dispatch;
create function public.slm_events_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g uuid;cost bigint;target uuid;
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_action='create' then raise exception 'legacy_read_only';end if;
 select group_id into g from public.slm_legacy_scope;
 if (g is not null and not slm_private.group_member(g,p_user)) or(g is null and not exists(select 1 from public.slm_aliases where user_id=p_user)) then
  if p_action='list' then return jsonb_build_object('events','[]'::jsonb,'server_now',clock_timestamp());end if;
  raise exception 'not_found';
 end if;
 if p_action in ('join','guest','reserve','move_guest') then
  select cost_cents into cost from public.slm_events where id=(p_body->>'event_id')::uuid;
  target:=coalesce(nullif(p_body->>'user_id','')::uuid,p_user);
  if p_action='move_guest' then select responsible_user_id into target from public.slm_event_participants where id=(p_body->>'participant_id')::uuid;end if;
  if not slm_private.registration_allowed(target,cost) then raise exception 'settlement_blocked';end if;
 end if;
 return slm_private.legacy_events_dispatch(p_user,p_session,p_action,p_body);
end $$;
-- Raw profile projection is restricted to the caller or a shared group.
create function slm_private.shared_profile(p_target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select slm_private.current_session_valid() and(auth.uid()=p_target or exists(
 select 1 from public.slm_group_members a join public.slm_group_members b using(group_id) where a.user_id=auth.uid() and b.user_id=p_target));
$$;
revoke all on function slm_private.shared_profile(uuid) from public,anon;
grant execute on function slm_private.shared_profile(uuid) to authenticated,service_role;
alter policy members_read_profiles on public.slm_profiles using(slm_private.shared_profile(user_id));
revoke all on function public.slm_events_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_events_dispatch(uuid,uuid,text,jsonb) to service_role;

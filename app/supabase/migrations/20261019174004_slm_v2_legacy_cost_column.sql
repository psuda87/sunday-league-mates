create or replace function public.slm_events_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
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
  select total_cost_cents into cost from public.slm_events where id=(p_body->>'event_id')::uuid;
  target:=coalesce(nullif(p_body->>'user_id','')::uuid,p_user);
  if p_action='move_guest' then select responsible_user_id into target from public.slm_event_participants where id=(p_body->>'participant_id')::uuid;end if;
  if not slm_private.registration_allowed(target,cost) then raise exception 'settlement_blocked';end if;
 end if;
 return slm_private.legacy_events_dispatch(p_user,p_session,p_action,p_body);
end $$;

do $$ declare definition text;begin
 definition:=pg_get_functiondef('slm_private.events_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure);
 definition:=replace(definition,'slm_private.notification_registration_allowed(v_target)','(e.total_cost_cents=0 or slm_private.notification_registration_allowed(v_target))');
 definition:=replace(definition,'slm_private.notification_registration_allowed(person.responsible_user_id)','(e.total_cost_cents=0 or slm_private.notification_registration_allowed(person.responsible_user_id))');
 execute definition;
end $$;

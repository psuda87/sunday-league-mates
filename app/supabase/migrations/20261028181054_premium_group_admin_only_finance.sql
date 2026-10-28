-- Owner decision: only the current active group administrator manages finance.
-- No UUID/role/ledger/data rewrite; existing EXECUTE grants remain restricted.
create or replace function slm_private.group_finance_admin(p_group uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select slm_private.group_admin(p_group,p_user)
 and exists(select 1 from public.slm_account_security where user_id=p_user and active and operation_id is null);
$$;
create or replace function slm_private.match_finance(p_event uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.slm_matches e where e.id=p_event
 and slm_private.group_finance_admin(e.group_id,p_user));
$$;
create or replace function slm_private.own_finance_scope(p_group uuid,p_event uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select slm_private.current_session_valid()
 and slm_private.group_finance_admin(p_group,auth.uid())
 and (p_event is null or exists(select 1 from public.slm_matches where id=p_event and group_id=p_group));
$$;
create or replace function slm_private.legacy_finance_manager(p_user uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.slm_legacy_scope s where slm_private.group_finance_admin(s.group_id,p_user));
$$;

-- Serialize administrator manual payment with a player's pending submission.
-- The previous dispatcher still validates session, permissions, amounts and idempotency.
begin;
alter function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) rename to payment_pending_guard_base;
alter function public.payment_pending_guard_base(uuid,uuid,text,jsonb) set schema slm_private;
revoke all on function slm_private.payment_pending_guard_base(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function slm_private.payment_pending_guard_base(uuid,uuid,text,jsonb) to service_role;

create function public.slm_group_finance_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare gid uuid; eid uuid; target uuid; request uuid;
begin
 -- Same transaction-level lock as the existing payment workflow.
 perform pg_advisory_xact_lock(20261014,1);
 if p_action='record_payment' then
  -- Do not bypass existing dispatcher checks for invalid/expired sessions.
  if not slm_private.session_valid(p_user,p_session,false) then
   raise exception 'session_invalid';
  end if;
  gid:=nullif(p_body->>'group_id','')::uuid;
  eid:=nullif(p_body->>'event_id','')::uuid;
  target:=nullif(p_body->>'user_id','')::uuid;
  request:=nullif(p_body->>'request_id','')::uuid;
  -- Let the base dispatcher replay previously completed requests unchanged.
  if not exists(select 1 from public.slm_v2_requests where actor_id=p_user and request_id=request) then
   if exists (
    select 1 from public.slm_group_payments p
    where p.group_id=gid and p.user_id=target and p.status='pending'
      and (p.event_id is null or eid is null or p.event_id=eid)
   ) then
    raise exception 'pending_payment_exists';
   end if;
  end if;
 end if;
 return slm_private.payment_pending_guard_base(p_user,p_session,p_action,p_body);
end $$;
revoke all on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) to service_role;
commit;

-- Payment-only API extension. No existing data, Auth or historical SQL rewrite.
begin;
alter function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) rename to payment_workflow_base;
alter function public.payment_workflow_base(uuid,uuid,text,jsonb) set schema slm_private;
revoke all on function slm_private.payment_workflow_base(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function slm_private.payment_workflow_base(uuid,uuid,text,jsonb) to service_role;

create function public.slm_group_finance_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g record; person record; gid uuid; eid uuid; target uuid; pay public.slm_group_payments;
 body jsonb:=p_body; action text:=p_action; accounts jsonb:='[]'; players jsonb:='[]'; info jsonb;
 events jsonb; remaining bigint; amount bigint; request uuid;
begin
 perform pg_advisory_xact_lock(20261014,1);
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 gid:=nullif(body->>'group_id','')::uuid;eid:=nullif(body->>'event_id','')::uuid;
 if action='wallet' then
  for g in select x.id,x.name from public.slm_groups x where
   exists(select 1 from public.slm_group_members m where m.group_id=x.id and m.user_id=p_user)
   or exists(select 1 from public.slm_group_ledger l where l.group_id=x.id and l.user_id=p_user)
   or exists(select 1 from public.slm_legacy_scope s join public.slm_finance_ledger l on l.user_id=p_user where s.group_id=x.id)
   or exists(select 1 from public.slm_matches e join public.slm_match_entries p on p.event_id=e.id where e.group_id=x.id and p.responsible_user_id=p_user)
   order by x.name,x.id loop
   info:=slm_private.payment_workflow_base(p_user,p_session,'account',jsonb_build_object('group_id',g.id));
   select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'starts_at',e.starts_at)),'[]') into events
   from public.slm_matches e where e.group_id=g.id and exists(select 1 from slm_private.group_dues(p_user) d where d.event_id=e.id and d.group_id=g.id);
   accounts:=accounts||jsonb_build_array(jsonb_build_object('group_id',g.id,'group_name',g.name,'account',info,'events',events));
  end loop;
  return jsonb_build_object('accounts',accounts);
 end if;
 if action='roster' then
  if not slm_private.group_finance_admin(gid,p_user) then raise exception 'forbidden';end if;
  if eid is not null and not exists(select 1 from public.slm_matches where id=eid and group_id=gid) then raise exception 'group_mismatch';end if;
  for person in select distinct ids.user_id from (
   select user_id from public.slm_group_members where group_id=gid
   union select user_id from public.slm_group_ledger where group_id=gid
   union select user_id from public.slm_group_payments where group_id=gid) ids where ids.user_id is not null loop
   info:=slm_private.payment_workflow_base(p_user,p_session,'account',jsonb_build_object('group_id',gid,'user_id',person.user_id));
   players:=players||jsonb_build_array(jsonb_build_object('user_id',person.user_id,'name',slm_private.public_player_name(person.user_id),'account',info));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'starts_at',starts_at) order by starts_at desc),'[]') into events from public.slm_matches where group_id=gid;
  return jsonb_build_object('group_id',gid,'players',players,'events',events);
 end if;
 if action in ('submit_payment','record_payment','accept_payment','reject_payment','cancel_payment') then
  if action in ('accept_payment','reject_payment','cancel_payment') then
   select * into pay from public.slm_group_payments where id=nullif(body->>'payment_id','')::uuid for update;
   if pay.id is null then raise exception 'not_found';end if;
   if gid is not null and gid<>pay.group_id or eid is not null and eid is distinct from pay.event_id then raise exception 'group_mismatch';end if;
   gid:=pay.group_id;eid:=pay.event_id;target:=pay.user_id;amount:=pay.amount_cents;
  else
   target:=case when action='submit_payment' then p_user else nullif(body->>'user_id','')::uuid end;
   amount:=(body->>'amount_cents')::bigint;
  end if;
  if action<>'submit_payment' and not slm_private.group_finance_admin(gid,p_user) then raise exception 'forbidden';end if;
  if action='cancel_payment' then
   action:='correct_payment';body:=body||jsonb_build_object('amount_cents',0,'reason','Anulowanie zatwierdzonej wpłaty');
  elsif length(trim(coalesce(body->>'reason','')))=0 then
   body:=body||jsonb_build_object('reason',case action when 'submit_payment' then 'Zgłoszenie wpłaty przez zawodnika' when 'record_payment' then 'Wpłata oznaczona przez administratora' when 'accept_payment' then 'Akceptacja zgłoszonej wpłaty' else 'Odrzucenie zgłoszonej wpłaty' end);
  end if;
  request:=nullif(body->>'request_id','')::uuid;
  -- Existing dispatcher validates the scope and exact cached body on every retry.
  if exists(select 1 from public.slm_v2_requests where actor_id=p_user and request_id=request) then
   return slm_private.payment_workflow_base(p_user,p_session,action,body);
  end if;
  if action in ('submit_payment','record_payment','accept_payment') then
   select coalesce(sum(outstanding_cents),0) into remaining from slm_private.group_dues(target) where group_id=gid and (eid is null or event_id=eid);
   if remaining<=0 then raise exception 'already_paid';end if;
   if eid is not null and amount>remaining then raise exception 'overpayment';end if;
   if action='submit_payment' and exists(select 1 from public.slm_group_payments where group_id=gid and user_id=target and status='pending' and (event_id is null or eid is null or event_id=eid)) then raise exception 'pending_payment_exists';end if;
  end if;
  return slm_private.payment_workflow_base(p_user,p_session,action,body);
 end if;
 return slm_private.payment_workflow_base(p_user,p_session,action,body);
end $$;
revoke all on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) to service_role;
commit;

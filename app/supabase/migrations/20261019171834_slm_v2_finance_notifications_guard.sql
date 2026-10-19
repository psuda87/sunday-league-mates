create or replace function public.slm_group_finance_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.slm_matches;pay public.slm_group_payments;q public.slm_v2_requests;
 v_group uuid;v_event uuid;v_target uuid;v_request uuid;v_amount bigint;v_reason text;v_old jsonb;v_response jsonb;
 v_admin boolean;v_before boolean;v_after boolean;v_eligibility jsonb;v_eligibility_row jsonb;v_audit bigint;v_rows jsonb;
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 v_group:=nullif(p_body->>'group_id','')::uuid;v_event:=nullif(p_body->>'event_id','')::uuid;
 if p_action in ('accept_payment','reject_payment','correct_payment') then
  select * into pay from public.slm_group_payments where id=(p_body->>'payment_id')::uuid for update;
  if not found then raise exception 'not_found';end if;
  if v_group is not null and v_group<>pay.group_id then raise exception 'group_mismatch';end if;
  v_group:=pay.group_id;v_event:=pay.event_id;v_target:=pay.user_id;
 end if;
 if v_event is not null then
  select * into e from public.slm_matches where id=v_event for update;
  if not found then raise exception 'not_found';end if;
  if v_group is not null and v_group<>e.group_id then raise exception 'group_mismatch';end if;
  v_group:=e.group_id;
 end if;
 if v_group is null then raise exception 'group_required';end if;
 v_admin:=slm_private.group_finance_admin(v_group,p_user);
 if p_action='account' then
  v_target:=coalesce(nullif(p_body->>'user_id','')::uuid,p_user);
  if v_target<>p_user and not v_admin then raise exception 'forbidden';end if;
  if not slm_private.group_member(v_group,p_user) and not exists(select 1 from public.slm_group_ledger where group_id=v_group and user_id=p_user)
   and not v_admin then raise exception 'not_found';end if;
  return jsonb_build_object('group_id',v_group,'user_id',v_target,
   'balance_cents',(select coalesce(sum(amount_cents),0) from public.slm_group_ledger where group_id=v_group and user_id=v_target)
    +case when exists(select 1 from public.slm_legacy_scope where group_id=v_group) then (select coalesce(sum(amount_cents),0) from public.slm_finance_ledger where user_id=v_target) else 0 end,
   'dues',(select coalesce(jsonb_agg(to_jsonb(d) order by d.starts_at,d.event_id),'[]') from slm_private.group_dues(v_target)d where d.group_id=v_group),
   'registration_allowed',slm_private.registration_allowed(v_target,1),
   'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id),'[]') from public.slm_group_payments p where p.group_id=v_group and p.user_id=v_target),
   'history',(select coalesce(jsonb_agg(to_jsonb(l) order by l.id desc),'[]') from(select * from public.slm_group_ledger where group_id=v_group and user_id=v_target order by id desc limit 100)l),
   'surplus',case when v_admin then (select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.slm_group_surplus s where s.group_id=v_group) else null end);
 end if;
 if p_action in ('detail','pending') then
  if not v_admin and not slm_private.match_finance(v_event,p_user) then raise exception 'forbidden';end if;
  return jsonb_build_object('event',to_jsonb(e),'participants',case when v_event is null then '[]'::jsonb else
   (select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('name',case when a.member_id is null then a.guest_name else slm_private.player_name(a.member_id) end)),'[]')
    from slm_private.group_preview(v_event)p join public.slm_match_entries a on a.id=p.entry_id) end,
   'payments',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.slm_group_payments p where p.group_id=v_group
    and(v_admin or p.event_id=v_event) and(p_action<>'pending' or p.status='pending')),
   'surplus',case when v_admin then (select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.slm_group_surplus s where s.group_id=v_group) else null end);
 end if;
 if p_action<>'submit_payment' and not v_admin and not slm_private.match_finance(v_event,p_user) then raise exception 'forbidden';end if;
 v_request:=nullif(p_body->>'request_id','')::uuid;
 if v_request is null then raise exception 'request_required';end if;
 select * into q from public.slm_v2_requests where actor_id=p_user and request_id=v_request;
 if found then
  if q.action<>'finance:'||p_action or q.body<>p_body then raise exception 'idempotency_conflict';end if;
  return q.response;
 end if;
 v_target:=coalesce(v_target,case when p_action='submit_payment' then p_user else nullif(p_body->>'user_id','')::uuid end,p_user);
 select coalesce(jsonb_agg(jsonb_build_object('user_id',u.user_id,'allowed',slm_private.registration_allowed(u.user_id,1))),'[]')
 into v_eligibility from(select v_target user_id union select responsible_user_id from public.slm_match_entries where event_id=v_event)u;
 v_reason:=trim(coalesce(p_body->>'reason',''));
 if length(v_reason)>500 or(p_action<>'submit_payment' and length(v_reason)=0) then raise exception 'reason_required';end if;
 if p_action in ('submit_payment','record_payment') then
  if v_event is null and not slm_private.group_member(v_group,v_target) and not exists(select 1 from public.slm_group_ledger where group_id=v_group and user_id=v_target)
   then raise exception 'forbidden';end if;
  if v_event is not null and not exists(select 1 from public.slm_match_entries where event_id=v_event and responsible_user_id=v_target)
   then raise exception 'invalid_participant';end if;
  if not v_admin and p_action='record_payment' and not slm_private.match_finance(v_event,p_user) then raise exception 'forbidden';end if;
  v_amount:=(p_body->>'amount_cents')::bigint;
  insert into public.slm_group_payments(id,group_id,event_id,user_id,amount_cents,corrected_amount_cents,status,submitted_by,note,decided_by,decided_at)
   values(v_request,v_group,v_event,v_target,v_amount,v_amount,case when p_action='submit_payment' then 'pending' else 'accepted' end,
   p_user,v_reason,case when p_action='record_payment' then p_user end,case when p_action='record_payment' then clock_timestamp() end) returning * into pay;
  if pay.status='accepted' then
   insert into public.slm_group_ledger(group_id,event_id,user_id,payment_id,amount_cents,kind,actor_id,reason)
    values(v_group,v_event,v_target,pay.id,v_amount,'payment',p_user,v_reason);
  end if;
 elsif p_action in ('accept_payment','reject_payment','correct_payment') then
  v_old:=to_jsonb(pay);
  if p_action='correct_payment' then
   if pay.status<>'accepted' then raise exception 'payment_not_accepted';end if;
   if pay.corrected_amount_cents is distinct from (p_body->>'expected_amount_cents')::bigint then raise exception 'stale_version';end if;
   v_amount:=(p_body->>'amount_cents')::bigint;
   if v_amount=pay.corrected_amount_cents then raise exception 'no_change';end if;
   insert into public.slm_group_ledger(group_id,event_id,user_id,payment_id,amount_cents,kind,actor_id,reason)
    values(v_group,v_event,v_target,pay.id,v_amount-pay.corrected_amount_cents,'payment_correction',p_user,v_reason);
   update public.slm_group_payments set corrected_amount_cents=v_amount where id=pay.id returning * into pay;
  else
   if pay.status<>'pending' then raise exception 'payment_processed';end if;
   update public.slm_group_payments set status=case when p_action='accept_payment' then 'accepted' else 'rejected' end,
    decided_by=p_user,decided_at=clock_timestamp() where id=pay.id returning * into pay;
   if pay.status='accepted' then insert into public.slm_group_ledger(group_id,event_id,user_id,payment_id,amount_cents,kind,actor_id,reason)
    values(v_group,v_event,v_target,pay.id,pay.amount_cents,'payment',p_user,v_reason);end if;
  end if;
 else
  if e.id is null then raise exception 'event_required';end if;
  if e.version is distinct from (p_body->>'expected_version')::bigint then raise exception 'stale_version';end if;
  v_old:=to_jsonb(e);
  if p_action='approve' then
   if e.approved_at is not null then raise exception 'already_approved';end if;
   if e.status='cancelled' then raise exception 'event_cancelled';end if;
   if clock_timestamp()<e.starts_at+make_interval(mins=>e.duration_minutes) then raise exception 'match_not_finished';end if;
   update public.slm_matches set approved_at=clock_timestamp() where id=e.id;
  elsif p_action='cost' then
   if e.status='cancelled' then raise exception 'event_cancelled';end if;
   update public.slm_matches set cost_cents=(p_body->>'amount_cents')::bigint where id=e.id;
  elsif p_action='charge' then
   if jsonb_typeof(p_body->'payable') not in ('null','boolean') or not(p_body?'payable') then raise exception 'invalid_input';end if;
   update public.slm_match_entries set charge_override=(p_body->>'payable')::boolean where id=(p_body->>'participant_id')::uuid and event_id=e.id;
   if not found then raise exception 'not_found';end if;
  elsif p_action='attendance' then
   if jsonb_typeof(p_body->'absent') is distinct from 'boolean' then raise exception 'invalid_input';end if;
   update public.slm_match_entries set absent=(p_body->>'absent')::boolean where id=(p_body->>'participant_id')::uuid and event_id=e.id;
   if not found then raise exception 'not_found';end if;
  else raise exception 'invalid_action';end if;
  update public.slm_matches set version=version+1 where id=e.id returning * into e;
  perform slm_private.group_revise(e.id,p_user,v_reason);
 end if;
 perform slm_private.group_surplus_sync(v_group,p_user);
 insert into public.slm_group_finance_audit(group_id,event_id,user_id,actor_id,action,reason,snapshot)
  values(v_group,v_event,v_target,p_user,p_action,v_reason,jsonb_build_object('before',v_old,'after',case when pay.id is not null then to_jsonb(pay) else to_jsonb(e) end)) returning id into v_audit;
 if p_action in ('accept_payment','reject_payment') then
  perform public.slm_notifications_finance_emit('finance:v2:payment:'||v_audit,case when pay.status='accepted' then 'payment_accepted' else 'payment_rejected' end,v_target);
 end if;
 for v_eligibility_row in select value from jsonb_array_elements(v_eligibility) loop
  v_after:=slm_private.registration_allowed((v_eligibility_row->>'user_id')::uuid,1);
  if (v_eligibility_row->>'allowed')::boolean<>v_after then
   perform public.slm_notifications_finance_emit('finance:v2:block:'||v_audit||':'||(v_eligibility_row->>'user_id'),
    case when v_after then 'registration_unblocked' else 'registration_blocked' end,(v_eligibility_row->>'user_id')::uuid);
  end if;
 end loop;
 v_response:=jsonb_build_object('group_id',v_group,'event_id',v_event,'payment_id',pay.id,'version',e.version,'ok',true);
 insert into public.slm_v2_requests values(p_user,v_request,'finance:'||p_action,p_body,v_response,clock_timestamp());
 return v_response;
end $$;
revoke all on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) to service_role;

-- Accepted receipt identity and original amount cannot be reassigned by any service path.
create function slm_private.group_payment_identity_guard() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
 if tg_op<>'UPDATE' then raise exception 'payment_immutable';end if;
 if row(new.id,new.group_id,new.event_id,new.user_id,new.amount_cents,new.submitted_by,new.created_at)
 is distinct from row(old.id,old.group_id,old.event_id,old.user_id,old.amount_cents,old.submitted_by,old.created_at)
 then raise exception 'payment_immutable';end if;
 if old.status<>'pending' and new.status<>old.status then raise exception 'payment_processed';end if;
 return new;
end $$;
revoke all on function slm_private.group_payment_identity_guard() from public,anon,authenticated;
create trigger group_payment_identity before update or delete on public.slm_group_payments
 for each row execute function slm_private.group_payment_identity_guard();
revoke delete,truncate on public.slm_group_payments from service_role;

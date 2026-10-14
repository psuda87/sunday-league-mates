-- API finansowe wyłącznie przez zweryfikowany kontekst Edge Function accounts.
create function slm_private.finance_account(p_user uuid,p_offset integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'user_id',p_user,'balance_cents',(select coalesce(sum(amount_cents),0) from public.slm_finance_ledger where user_id=p_user),
  'unpaid_matches',(select count(*) from slm_private.finance_dues(p_user) where outstanding_cents>0),
  'blocked',(select count(*)>=2 from slm_private.finance_dues(p_user) where outstanding_cents>0),
  'dues',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from slm_private.finance_dues(p_user) d),
  'history',(select coalesce(jsonb_agg(to_jsonb(l) order by l.id desc),'[]') from (
   select ledger.*,line.name participant_name,event.starts_at,
    coalesce(actor_profile.full_name,actor_alias.login) actor_name,
    participant.member_id is null and ledger.participant_id is not null is_guest
   from public.slm_finance_ledger ledger
   left join public.slm_settlement_lines line on line.revision_id=ledger.revision_id and line.participant_id=ledger.participant_id
   left join public.slm_events event on event.id=ledger.event_id
   left join public.slm_event_participants participant on participant.id=ledger.participant_id
   left join public.slm_aliases actor_alias on actor_alias.user_id=ledger.actor_id
   left join public.slm_profiles actor_profile on actor_profile.user_id=ledger.actor_id and actor_profile.display_as='full_name' and length(trim(actor_profile.full_name))>0
   where ledger.user_id=p_user order by ledger.id desc limit 50 offset p_offset) l),
  'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id),'[]') from (
   select * from public.slm_payments where user_id=p_user order by created_at desc,id limit 50 offset p_offset) p),
  'decisions',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc),'[]') from (
   select * from public.slm_finance_audit where user_id=p_user and event_id is null order by id desc limit 50 offset p_offset) a));
$$;
create function slm_private.finance_detail(p_event uuid,p_offset integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('event_id',e.id,'cost_cents',e.total_cost_cents,'status',e.status,
  'starts_at',e.starts_at,'timezone',e.timezone,'version',s.version,'revision',s.revision,'approved_at',s.approved_at,
  'can_approve',e.status='scheduled' and clock_timestamp()>=e.starts_at+make_interval(mins=>e.duration_minutes),
  'participants',(select coalesce(jsonb_agg(to_jsonb(p) order by p.participant_id),'[]') from slm_private.finance_preview(e.id) p),
  'revisions',(select coalesce(jsonb_agg(to_jsonb(r) order by r.revision desc),'[]') from (
   select * from public.slm_settlement_revisions where event_id=e.id order by revision desc limit 50 offset p_offset) r),
  'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc),'[]') from (
   select * from public.slm_finance_audit where event_id=e.id order by id desc limit 50 offset p_offset) a))
 from public.slm_events e join public.slm_settlements s on s.event_id=e.id where e.id=p_event;
$$;
revoke all on function slm_private.finance_account(uuid,integer),slm_private.finance_detail(uuid,integer) from public,anon,authenticated;
grant execute on function slm_private.finance_account(uuid,integer),slm_private.finance_detail(uuid,integer) to service_role;

create function public.slm_settlements_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_admin boolean; v_target uuid; v_request uuid; v_event uuid; v_amount bigint; v_offset integer;
 v_reason text; v_response jsonb; v_previous jsonb; v_delta bigint; v_revision_before bigint;
 s public.slm_settlements; e public.slm_events; person public.slm_event_participants;
 payment public.slm_payments; previous_request public.slm_finance_requests; source public.slm_settlement_shares;
begin
 -- Wspólny z events_dispatch. Płatności nie mogą minąć kontroli blokady zapisów.
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid'; end if;
 select role='admin' into v_admin from public.slm_roles where user_id=p_user for share;
 v_offset:=greatest(0,coalesce((p_body->>'offset')::integer,0));
 if p_action='account' then
  v_target:=coalesce(nullif(p_body->>'user_id','')::uuid,p_user);
  if v_target<>p_user and not v_admin then raise exception 'forbidden'; end if;
  return slm_private.finance_account(v_target,v_offset);
 end if;
 -- Po restarcie klient zachowuje wyłącznie UUID (bez kwoty i danych formularza).
 -- Rozstrzygnięcie nieznanego wyniku zamyka UUID atomowo. Spóźnione żądanie
 -- nie może zaksięgować operacji po odpowiedzi „nie zaksięgowano”.
 if p_action='resolve_request' then
  v_request:=nullif(p_body->>'request_id','')::uuid;
  if v_request is null then raise exception 'request_required'; end if;
  select * into previous_request from public.slm_finance_requests where actor_id=p_user and request_id=v_request;
  if found then
   return jsonb_build_object('state',case when previous_request.action='abandoned' then 'abandoned' else 'committed' end);
  end if;
  insert into public.slm_finance_requests(actor_id,request_id,action,body,response)
   values(p_user,v_request,'abandoned','{}',jsonb_build_object('state','abandoned'));
  insert into public.slm_finance_audit(actor_id,user_id,action,reason,snapshot)
   values(p_user,p_user,'request_abandoned','Rozstrzygnięto żądanie bez zaksięgowania',jsonb_build_object('request_id',v_request));
  return jsonb_build_object('state','abandoned');
 end if;
 if p_action<>'submit_payment' and not v_admin then raise exception 'forbidden'; end if;
 if p_action='pending' then
  return jsonb_build_object('payments',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]') from (
   select p.*,a.login display_name from public.slm_payments p join public.slm_aliases a on a.user_id=p.user_id
    where p.status='pending' order by p.created_at,p.id limit 50 offset v_offset) x));
 end if;
 if p_action='detail' then
  v_response:=slm_private.finance_detail((p_body->>'event_id')::uuid,v_offset);
  if v_response is null then raise exception 'not_found'; end if;
  return v_response;
 end if;
 if p_action not in ('submit_payment','record_payment','accept_payment','reject_payment','correct_payment',
  'cost','charge','attendance','replacement','approve') then raise exception 'invalid_action'; end if;
 v_request:=nullif(p_body->>'request_id','')::uuid;
 if v_request is null then raise exception 'request_required'; end if;
 select * into previous_request from public.slm_finance_requests where actor_id=p_user and request_id=v_request;
 if found then
  if previous_request.action='abandoned' then raise exception 'request_closed'; end if;
  if previous_request.action<>p_action or previous_request.body<>p_body then raise exception 'idempotency_conflict'; end if;
  return previous_request.response;
 end if;
 v_reason:=trim(coalesce(p_body->>'reason',''));
 if length(v_reason)>500 or (p_action<>'submit_payment' and length(v_reason)=0) then raise exception 'reason_required'; end if;

 if p_action in ('submit_payment','record_payment') then
  if coalesce(p_body->>'amount_cents','') !~ '^[0-9]{1,12}$' then raise exception 'invalid_amount'; end if;
  v_amount:=(p_body->>'amount_cents')::bigint;
  if v_amount<=0 then raise exception 'invalid_amount'; end if;
  v_target:=case when p_action='submit_payment' then p_user else nullif(p_body->>'user_id','')::uuid end;
  if v_target is null or not exists(select 1 from public.slm_aliases where user_id=v_target) then raise exception 'invalid_participant'; end if;
  insert into public.slm_payments(id,user_id,amount_cents,corrected_amount_cents,status,submitted_by,note,decided_by,decided_at)
   values(v_request,v_target,v_amount,v_amount,case when p_action='submit_payment' then 'pending' else 'accepted' end,
    p_user,v_reason,case when p_action='record_payment' then p_user end,
    case when p_action='record_payment' then clock_timestamp() end) returning * into payment;
  if p_action='record_payment' then
   insert into public.slm_finance_ledger(user_id,payment_id,amount_cents,kind,actor_id,reason)
    values(v_target,payment.id,v_amount,'payment',p_user,v_reason);
  end if;
  insert into public.slm_finance_audit(actor_id,user_id,action,reason,snapshot)
   values(p_user,v_target,p_action,v_reason,to_jsonb(payment));
  v_response:=jsonb_build_object('payment_id',payment.id,'status',payment.status);
 elsif p_action in ('accept_payment','reject_payment','correct_payment') then
  select * into payment from public.slm_payments where id=(p_body->>'payment_id')::uuid for update;
  if not found then raise exception 'not_found'; end if;
  v_previous:=to_jsonb(payment);
  if p_action='correct_payment' then
   if payment.status<>'accepted' then raise exception 'payment_not_accepted'; end if;
   if coalesce(p_body->>'amount_cents','') !~ '^[0-9]{1,12}$' then raise exception 'invalid_amount'; end if;
   v_amount:=(p_body->>'amount_cents')::bigint;
   if nullif(p_body->>'expected_amount_cents','')::bigint is distinct from payment.corrected_amount_cents then raise exception 'stale_version'; end if;
   v_delta:=v_amount-payment.corrected_amount_cents;
   if v_delta=0 then raise exception 'no_change'; end if;
   update public.slm_payments set corrected_amount_cents=v_amount where id=payment.id returning * into payment;
   insert into public.slm_finance_ledger(user_id,payment_id,amount_cents,kind,actor_id,reason)
    values(payment.user_id,payment.id,v_delta,'payment_correction',p_user,v_reason);
  else
   if payment.status<>'pending' then raise exception 'payment_processed'; end if;
   update public.slm_payments set status=case when p_action='accept_payment' then 'accepted' else 'rejected' end,
    decided_at=clock_timestamp(),decided_by=p_user where id=payment.id returning * into payment;
   if p_action='accept_payment' then
    insert into public.slm_finance_ledger(user_id,payment_id,amount_cents,kind,actor_id,reason)
     values(payment.user_id,payment.id,payment.amount_cents,'payment',p_user,v_reason);
   end if;
  end if;
  insert into public.slm_finance_audit(actor_id,user_id,action,reason,snapshot)
   values(p_user,payment.user_id,p_action,v_reason,jsonb_build_object('before',v_previous,'after',to_jsonb(payment)));
  v_response:=jsonb_build_object('payment_id',payment.id,'status',payment.status);
 else
  v_event:=nullif(p_body->>'event_id','')::uuid;
  select * into e from public.slm_events where id=v_event for update;
  if not found then raise exception 'not_found'; end if;
  select * into s from public.slm_settlements where event_id=v_event for update;
  if not found then raise exception 'not_found'; end if;
  if nullif(p_body->>'expected_version','')::bigint is distinct from s.version then raise exception 'stale_version'; end if;
  v_revision_before:=s.revision;
  v_previous:=slm_private.finance_detail(v_event);
  if p_action='approve' then
   if s.approved_at is not null then raise exception 'already_approved'; end if;
   if e.status='cancelled' then raise exception 'event_cancelled'; end if;
   if clock_timestamp()<e.starts_at+make_interval(mins=>e.duration_minutes) then raise exception 'match_not_finished'; end if;
   update public.slm_settlements set approved_at=clock_timestamp(),approved_by=p_user where event_id=v_event;
  elsif p_action='cost' then
   if e.status='cancelled' then raise exception 'event_cancelled'; end if;
   if coalesce(p_body->>'amount_cents','') !~ '^[0-9]{1,12}$' then raise exception 'invalid_amount'; end if;
   update public.slm_events set total_cost_cents=(p_body->>'amount_cents')::bigint,updated_at=clock_timestamp() where id=v_event;
  elsif p_action='replacement' then
   if e.status='cancelled' then raise exception 'event_cancelled'; end if;
   select * into source from public.slm_settlement_shares where participant_id=(p_body->>'participant_id')::uuid and event_id=v_event;
   select * into person from public.slm_event_participants where id=(p_body->>'replacement_id')::uuid and event_id=v_event;
   if source.participant_id is null or person.id is null or source.participant_id=person.id or person.status<>'registered'
    or source.release_sequence is null or source.replacement_id is not null
    or not coalesce(source.charge_override,source.default_payable)
    or person.joined_at<(select server_time from public.slm_event_history where sequence=source.release_sequence)
    or exists(select 1 from public.slm_settlement_shares where replacement_id=person.id)
    then raise exception 'invalid_replacement'; end if;
   update public.slm_settlement_shares set default_payable=false,charge_override=false,replacement_id=person.id where participant_id=source.participant_id;
   update public.slm_settlement_shares set default_payable=true,charge_override=true where participant_id=person.id;
  else
   select * into person from public.slm_event_participants where id=(p_body->>'participant_id')::uuid and event_id=v_event;
   if not found then raise exception 'not_found'; end if;
   if p_action='attendance' then
    if jsonb_typeof(p_body->'absent') is distinct from 'boolean' then raise exception 'invalid_participant'; end if;
    update public.slm_event_participants set absent=(p_body->>'absent')::boolean where id=person.id;
   else
    if e.status='cancelled' then raise exception 'event_cancelled'; end if;
    if not (p_body ? 'payable') or jsonb_typeof(p_body->'payable') not in ('boolean','null') then raise exception 'invalid_participant'; end if;
    update public.slm_settlement_shares set charge_override=(p_body->>'payable')::boolean where participant_id=person.id;
   end if;
  end if;
  update public.slm_settlements set version=version+1 where event_id=v_event;
  perform slm_private.finance_revise(v_event,p_user,v_reason);
  -- Pełny snapshot rewizji znajduje się w lines; audit nie duplikuje całej historii.
  insert into public.slm_finance_audit(actor_id,event_id,action,reason,snapshot)
   values(p_user,v_event,p_action,v_reason,jsonb_build_object('before_version',s.version,
    'before_revision',v_revision_before,'request',p_body,
    'before_participants',v_previous->'participants','after_participants',
     (select coalesce(jsonb_agg(to_jsonb(p)),'[]') from slm_private.finance_preview(v_event) p)));
  v_response:=jsonb_build_object('event_id',v_event,'version',
   (select version from public.slm_settlements where event_id=v_event));
 end if;
 insert into public.slm_finance_requests(actor_id,request_id,action,body,response)
  values(p_user,v_request,p_action,p_body,v_response);
 return v_response;
end $$;
revoke all on function public.slm_settlements_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_settlements_dispatch(uuid,uuid,text,jsonb) to service_role;

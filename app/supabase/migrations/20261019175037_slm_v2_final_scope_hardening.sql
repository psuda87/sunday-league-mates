-- Prevent unsolicited public-match debt for an unrelated account.
create or replace function slm_private.matches_dispatch_core(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.slm_matches;person public.slm_match_entries;old_person public.slm_match_entries;
 q public.slm_v2_requests;v_group uuid;v_request uuid;v_target uuid;v_access text;v_response jsonb;v_rows jsonb;
 v_admin boolean;v_now timestamptz;v_cutoff timestamptz;v_status text;v_action text;v_sequence bigint;v_released uuid;
 v_count integer;v_name text;v_phone text;v_start timestamptz;v_cost bigint;
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 v_now:=clock_timestamp();
 if p_action='list' then
  return jsonb_build_object('events',(select coalesce(jsonb_agg(slm_private.match_summary(x.id,p_user) order by x.starts_at,x.id),'[]')
   from(select id,starts_at from public.slm_matches order by starts_at desc,id limit 100 offset greatest(0,coalesce((p_body->>'offset')::integer,0)))x),'server_now',v_now);
 end if;
 if p_action<>'create' then
  select * into e from public.slm_matches where id=(p_body->>'event_id')::uuid for update;
  if not found then raise exception 'not_found';end if;
  v_group:=e.group_id;v_access:=slm_private.match_access(e.id,p_user);v_now:=clock_timestamp();
  if p_action='detail' then
   if v_access='none' then return jsonb_build_object('event',slm_private.match_summary(e.id,p_user),'participants','[]'::jsonb,'server_now',v_now);end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'member_id',p.member_id,'responsible_user_id',p.responsible_user_id,
    'display_name',case when p.member_id is null then p.guest_name else slm_private.player_name(p.member_id) end,
    'responsible_name',slm_private.player_name(p.responsible_user_id),'guest_name',p.guest_name,
    'contact_phone',case when slm_private.group_member(e.group_id,p_user) or p.responsible_user_id=p_user then
      coalesce(p.guest_phone,pp.contact_phone,a.phone) else null end,
    'guest_phone',case when slm_private.group_member(e.group_id,p_user) or p.responsible_user_id=p_user then p.guest_phone else null end,
    'status',p.status,'absent',p.absent,'joined_at',p.joined_at) order by p.joined_at,p.id),'[]') into v_rows
   from public.slm_match_entries p left join public.slm_player_profiles pp on pp.user_id=p.responsible_user_id
   left join public.slm_aliases a on a.user_id=p.responsible_user_id
   where p.event_id=e.id and(v_access='full' or p.responsible_user_id=p_user)
    and(p.status<>'withdrawn' or p.responsible_user_id=p_user or slm_private.match_finance(e.id,p_user));
   return jsonb_build_object('event',slm_private.match_summary(e.id,p_user),'participants',v_rows,'server_now',v_now,
    'can_register_paid',slm_private.registration_allowed(p_user,e.cost_cents));
  end if;
 else v_group:=(p_body->>'group_id')::uuid;end if;
 v_request:=nullif(p_body->>'request_id','')::uuid;
 if v_request is null then raise exception 'request_required';end if;
 select * into q from public.slm_v2_requests where actor_id=p_user and request_id=v_request;
 if found then
  if q.action<>'match:'||p_action or q.body<>p_body then raise exception 'idempotency_conflict';end if;
  return q.response;
 end if;
 v_admin:=slm_private.match_finance(e.id,p_user);
 if p_action in ('create','edit') then
  if p_action='create' and not slm_private.group_organizer(v_group,p_user) then raise exception 'forbidden';end if;
  if p_action='edit' and(e.created_by<>p_user or not slm_private.group_member(v_group,p_user)) then raise exception 'forbidden';end if;
  if not exists(select 1 from public.slm_groups where id=v_group and not archived) then raise exception 'group_archived';end if;
  v_start:=case when p_body?'starts_at' then (p_body->>'starts_at')::timestamptz else ((p_body->>'date')::date+(p_body->>'time')::time) at time zone 'Europe/Warsaw' end;v_cost:=(p_body->>'cost_cents')::bigint;
  if v_start is null or v_start<=v_now then raise exception 'registration_closed';end if;
  if p_body->>'visibility' not in ('public','private') or p_body->>'visibility' is null then raise exception 'invalid_event';end if;
  if p_action='create' then
   insert into public.slm_matches(group_id,created_by,name,visibility,starts_at,location,address,duration_minutes,capacity,cost_cents)
   values(v_group,p_user,trim(p_body->>'name'),p_body->>'visibility',v_start,trim(p_body->>'location'),trim(coalesce(p_body->>'address','')),
    (p_body->>'duration_minutes')::integer,(p_body->>'capacity')::integer,v_cost) returning * into e;v_action:='created';
  else
   if e.status='cancelled' or e.starts_at<=v_now then raise exception 'registration_closed';end if;
   if e.version is distinct from (p_body->>'expected_version')::bigint then raise exception 'stale_version';end if;
   if (p_body->>'group_id')::uuid is distinct from e.group_id then raise exception 'group_mismatch';end if;
   select count(*) into v_count from public.slm_match_entries where event_id=e.id and status='registered';
   if v_count>(p_body->>'capacity')::integer then raise exception 'capacity_too_small';end if;
   update public.slm_matches set name=trim(p_body->>'name'),visibility=p_body->>'visibility',starts_at=v_start,
    location=trim(p_body->>'location'),address=trim(coalesce(p_body->>'address','')),duration_minutes=(p_body->>'duration_minutes')::integer,
    capacity=(p_body->>'capacity')::integer,cost_cents=v_cost where id=e.id returning * into e;v_action:='edited';
  end if;
 elsif p_action='cancel' then
  if not v_admin then raise exception 'forbidden';end if;
  if e.status='cancelled' then raise exception 'event_cancelled';end if;
  if e.approved_at is not null and length(trim(coalesce(p_body->>'reason','')))=0 then raise exception 'reason_required';end if;
  update public.slm_matches set status='cancelled' where id=e.id returning * into e;v_action:='cancelled';
 else
  if e.status='cancelled' then raise exception 'event_cancelled';end if;
  if v_now>=e.starts_at and p_action<>'attendance' then raise exception 'registration_closed';end if;
  if p_action in ('join','reserve','guest') then
   if v_access<>'full' then raise exception 'forbidden';end if;
   v_target:=coalesce(nullif(p_body->>'user_id','')::uuid,p_user);
   if v_target<>p_user and(not v_admin or not slm_private.group_member(e.group_id,v_target)) then raise exception 'forbidden';end if;
   if not exists(select 1 from public.slm_account_security where user_id=v_target and active and operation_id is null)
    or(e.visibility='private' and not slm_private.group_member(e.group_id,v_target)) then raise exception 'invalid_participant';end if;
   if not slm_private.registration_allowed(v_target,e.cost_cents) then raise exception 'registration_blocked';end if;
   v_status:=case when p_action='reserve' or p_body->>'list'='reserve' then 'reserve' else 'registered' end;
   select count(*) into v_count from public.slm_match_entries where event_id=e.id and status='registered';
   if v_status='registered' and v_count>=e.capacity then raise exception 'event_full';end if;
   if p_action='guest' then
    v_name:=trim(p_body->>'guest_name');v_phone:=nullif(p_body->>'guest_phone','');
    insert into public.slm_match_entries(event_id,responsible_user_id,guest_name,guest_phone,status,payable)
     values(e.id,v_target,v_name,v_phone,v_status,v_status='registered') returning * into person;
   else
    select * into person from public.slm_match_entries where event_id=e.id and member_id=v_target and status<>'withdrawn';
    if found then
     if person.status=v_status then raise exception 'duplicate_signup';end if;
     old_person:=person;
     update public.slm_match_entries set status=v_status,joined_at=v_now,absent=false where id=person.id returning * into person;
    else
     insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status,payable)
      values(e.id,v_target,v_target,v_status,v_status='registered') returning * into person;
    end if;
   end if;
   v_action:=case when v_status='registered' then 'joined' else 'reserved' end;
  elsif p_action in ('withdraw','edit_guest','move_guest','attendance') then
   select * into person from public.slm_match_entries where id=(p_body->>'participant_id')::uuid and event_id=e.id for update;
   if not found then raise exception 'not_found';end if;
   if person.responsible_user_id<>p_user and not v_admin then raise exception 'forbidden';end if;
   old_person:=person;
   if p_action='attendance' then
    if e.approved_at is not null and length(trim(coalesce(p_body->>'reason','')))=0 then raise exception 'reason_required';end if;
    if not v_admin then raise exception 'forbidden';end if;
    if jsonb_typeof(p_body->'absent') is distinct from 'boolean' then raise exception 'invalid_input';end if;
    update public.slm_match_entries set absent=(p_body->>'absent')::boolean where id=person.id returning * into person;v_action:='attendance';
   elsif p_action='withdraw' then
    if person.status='withdrawn' then raise exception 'duplicate_signup';end if;
    update public.slm_match_entries set status='withdrawn',withdrawn_at=v_now where id=person.id returning * into person;v_action:='withdrawn';
   else
    if person.member_id is not null then raise exception 'invalid_guest';end if;
    if p_action='edit_guest' then
     update public.slm_match_entries set guest_name=trim(p_body->>'guest_name'),guest_phone=nullif(p_body->>'guest_phone','') where id=person.id returning * into person;v_action:='guest_edited';
    else
     v_status:=case when p_body->>'list'='reserve' then 'reserve' else 'registered' end;
     if v_status=person.status then raise exception 'duplicate_signup';end if;
     if v_status='registered' then
      if v_access<>'full' then raise exception 'forbidden';end if;
      if not slm_private.registration_allowed(person.responsible_user_id,e.cost_cents) then raise exception 'registration_blocked';end if;
      if(select count(*) from public.slm_match_entries where event_id=e.id and status='registered')>=e.capacity then raise exception 'event_full';end if;
     end if;
     update public.slm_match_entries set status=v_status,joined_at=v_now where id=person.id returning * into person;
     v_action:=case when v_status='registered' then 'joined' else 'reserved' end;
    end if;
   end if;
  else raise exception 'invalid_action';end if;
 end if;
 v_cutoff:=((e.starts_at at time zone 'Europe/Warsaw')::date+time '17:00') at time zone 'Europe/Warsaw';
 insert into public.slm_match_history(event_id,entry_id,actor_id,action,server_time,snapshot)
  values(e.id,person.id,p_user,v_action,v_now,jsonb_build_object('before',to_jsonb(old_person),'after',to_jsonb(person),'request',p_body)) returning sequence into v_sequence;
 if person.id is not null and v_action='joined' then
  if person.release_sequence is null then
   select id into v_released from public.slm_match_entries where event_id=e.id and release_sequence is not null and replacement_id is null
    and id<>person.id and coalesce(charge_override,payable) order by release_sequence,id limit 1 for update;
   if v_released is not null then
    update public.slm_match_entries set payable=false,charge_override=false,replacement_id=person.id where id=v_released;
   end if;
  end if;
  update public.slm_match_entries set payable=true,release_sequence=null,replacement_id=null where id=person.id;
 elsif person.id is not null and v_action in ('withdrawn','reserved') and old_person.status='registered' then
  select count(*) into v_count from public.slm_match_entries where event_id=e.id and status='registered';
  update public.slm_match_entries set payable=v_now>=v_cutoff and v_count<10,release_sequence=case when v_now>=v_cutoff and v_count<10 then v_sequence end where id=person.id;
 end if;
 update public.slm_matches set version=version+1 where id=e.id returning * into e;
 perform slm_private.group_revise(e.id,p_user,coalesce(nullif(trim(p_body->>'reason'),''),'Zmiana udziału'));
 perform slm_private.group_surplus_sync(e.group_id,p_user);
 v_response:=jsonb_build_object('event_id',e.id,'participant_id',person.id,'version',e.version);
 insert into public.slm_v2_requests values(p_user,v_request,'match:'||p_action,p_body,v_response,clock_timestamp());
 return v_response;
end $$;

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
   and not exists(select 1 from public.slm_matches me join public.slm_match_entries mp on mp.event_id=me.id where me.group_id=v_group and mp.responsible_user_id=p_user)
   and not exists(select 1 from public.slm_legacy_scope ls join public.slm_finance_ledger ll on ll.user_id=p_user where ls.group_id=v_group)
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
    and((v_event is null and v_admin) or p.event_id=v_event) and(p_action<>'pending' or p.status='pending')),
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
   'id',inbox_request.id,'group_id',inbox_request.group_id,'group_name',a.name,'kind',inbox_request.kind,'state',inbox_request.state) order by inbox_request.created_at),'[]')
   from public.slm_group_requests inbox_request join public.slm_groups a on a.id=inbox_request.group_id
   where inbox_request.target_id=p_user and inbox_request.kind='invite' and inbox_request.state='pending' and not a.archived));
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
   'user_id',m.user_id,'nickname',slm_private.player_name(m.user_id),'contact_phone',coalesce(pp.contact_phone,a.phone),'organizer',m.organizer,'joined_at',m.joined_at) order by m.sequence),'[]')
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

-- Disposable database only: normal service RPC and actual SQL accounting/ACL.
begin;
create function pg_temp.verify(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label;end if;end $$;
do $$declare i integer;uid uuid;sid uuid;begin
 for i in 1..4 loop
 uid:=('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;sid:=('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
 insert into auth.users(id,aud,role,email) values(uid,'authenticated','authenticated','payment'||i||'@fixture.invalid');
 perform public.slm_account_provision(uid,'Payment_'||i,'+48000000'||lpad(i::text,3,'0'),'payment'||i||'@fixture.invalid',null,null,false);
 update public.slm_account_security set must_change_password=false where user_id=uid;
 insert into auth.sessions(id,user_id) values(sid,uid);perform public.slm_account_accept_session(uid,sid,1);
 insert into public.slm_player_profiles(user_id,nickname,email_account) values(uid,'Fixture '||i,false);
 end loop;
end $$;
insert into public.slm_groups(id,name,admin_id) values('20000000-0000-4000-8000-000000000001','Fixture','00000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002','Foreign','00000000-0000-4000-8000-000000000004');
insert into public.slm_group_members(group_id,user_id) select '20000000-0000-4000-8000-000000000001',user_id from public.slm_profiles where user_id<>'00000000-0000-4000-8000-000000000004';
insert into public.slm_group_members(group_id,user_id) values('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004');
insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents)
 values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Fixture','private',now()-interval '2 days','Fixture',90,12,6900);
insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status,payable) select '30000000-0000-4000-8000-000000000001',user_id,user_id,'registered',true from public.slm_group_members where group_id='20000000-0000-4000-8000-000000000001';
-- The fixture helper does not impersonate server sessions: real fixture sessions above.
create function pg_temp.pay(actor integer,action text,body jsonb) returns jsonb language sql as $$
 select public.slm_group_finance_dispatch(('00000000-0000-4000-8000-'||lpad(actor::text,12,'0'))::uuid,('10000000-0000-4000-8000-'||lpad(actor::text,12,'0'))::uuid,action,
 jsonb_build_object('group_id','20000000-0000-4000-8000-000000000001','event_id','30000000-0000-4000-8000-000000000001')||body);
$$;
create function pg_temp.denied(actor integer,action text,body jsonb,code text) returns void language plpgsql as $$begin
 begin perform pg_temp.pay(actor,action,body);raise exception 'unexpected success';exception when others then if sqlerrm<>code then raise;end if;end;
end $$;
set local role service_role;
select public.slm_group_finance_dispatch('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','approve','{"group_id":"20000000-0000-4000-8000-000000000001","event_id":"30000000-0000-4000-8000-000000000001","expected_version":1,"request_id":"40000000-0000-4000-8000-000000000001","reason":"Fixture approval"}');
reset role;
select pg_temp.verify((select count(*)=3 and min(-amount_cents)=2300 from public.slm_group_ledger where kind='charge'),'approved amounts');
select pg_temp.verify(jsonb_array_length(pg_temp.pay(1,'roster','{}')->'players')=3,'admin cards');
select pg_temp.verify(jsonb_array_length(pg_temp.pay(2,'wallet','{}')->'accounts')=1,'own wallet');
select pg_temp.denied(2,'roster','{}','forbidden');select pg_temp.denied(4,'roster','{}','forbidden');
select pg_temp.denied(2,'record_payment','{"user_id":"00000000-0000-4000-8000-000000000001","amount_cents":2300,"request_id":"40000000-0000-4000-8000-000000000002"}','forbidden');
select pg_temp.pay(2,'submit_payment','{"amount_cents":2300,"request_id":"40000000-0000-4000-8000-000000000003"}');
select pg_temp.pay(2,'submit_payment','{"amount_cents":2300,"request_id":"40000000-0000-4000-8000-000000000003"}');
select pg_temp.verify((select count(*)=1 from public.slm_group_payments),'idempotent submission');
select pg_temp.denied(2,'submit_payment','{"amount_cents":2300,"request_id":"40000000-0000-4000-8000-000000000004"}','pending_payment_exists');
select pg_temp.denied(2,'submit_payment','{"amount_cents":2400,"request_id":"40000000-0000-4000-8000-000000000005"}','overpayment');
select pg_temp.denied(3,'accept_payment','{"payment_id":"40000000-0000-4000-8000-000000000003","request_id":"40000000-0000-4000-8000-000000000006"}','forbidden');
select pg_temp.pay(1,'accept_payment','{"payment_id":"40000000-0000-4000-8000-000000000003","request_id":"40000000-0000-4000-8000-000000000007"}');
select pg_temp.pay(1,'accept_payment','{"payment_id":"40000000-0000-4000-8000-000000000003","request_id":"40000000-0000-4000-8000-000000000007"}');
select pg_temp.verify((select outstanding_cents=0 from slm_private.group_dues('00000000-0000-4000-8000-000000000002')),'accepted paid');
select pg_temp.denied(2,'submit_payment','{"amount_cents":2300,"request_id":"40000000-0000-4000-8000-000000000008"}','already_paid');
select pg_temp.denied(1,'record_payment','{"user_id":"00000000-0000-4000-8000-000000000002","amount_cents":2300,"request_id":"40000000-0000-4000-8000-000000000009"}','already_paid');
select pg_temp.pay(1,'cancel_payment','{"payment_id":"40000000-0000-4000-8000-000000000003","expected_amount_cents":2300,"request_id":"40000000-0000-4000-8000-000000000010"}');
select pg_temp.pay(1,'cancel_payment','{"payment_id":"40000000-0000-4000-8000-000000000003","expected_amount_cents":2300,"request_id":"40000000-0000-4000-8000-000000000010"}');
select pg_temp.verify((select outstanding_cents=2300 from slm_private.group_dues('00000000-0000-4000-8000-000000000002')),'cancel restores due');
select pg_temp.verify((select amount_cents=2300 and corrected_amount_cents=0 from public.slm_group_payments where id='40000000-0000-4000-8000-000000000003'),'cancel preserves original');
select pg_temp.verify((select count(*)=1 from public.slm_group_ledger where kind='payment_correction'),'single cancellation delta');
select pg_temp.pay(2,'submit_payment','{"amount_cents":1000,"request_id":"40000000-0000-4000-8000-000000000011"}');
select pg_temp.pay(1,'reject_payment','{"payment_id":"40000000-0000-4000-8000-000000000011","request_id":"40000000-0000-4000-8000-000000000012"}');
select pg_temp.verify((select outstanding_cents=2300 from slm_private.group_dues('00000000-0000-4000-8000-000000000002')),'rejection never pays');
select pg_temp.pay(2,'submit_payment','{"amount_cents":2300,"request_id":"40000000-0000-4000-8000-000000000013"}');
-- A manual payment must not be recorded while the same player's submission is still pending (guard_pending_manual_payment).
select pg_temp.denied(1,'record_payment','{"user_id":"00000000-0000-4000-8000-000000000002","amount_cents":2300,"request_id":"40000000-0000-4000-8000-000000000014"}','pending_payment_exists');
select pg_temp.pay(1,'reject_payment','{"payment_id":"40000000-0000-4000-8000-000000000013","request_id":"40000000-0000-4000-8000-000000000016"}');
select pg_temp.pay(1,'record_payment','{"user_id":"00000000-0000-4000-8000-000000000002","amount_cents":2300,"request_id":"40000000-0000-4000-8000-000000000014"}');
select pg_temp.verify((select outstanding_cents=0 from slm_private.group_dues('00000000-0000-4000-8000-000000000002')),'manual payment recorded after the pending submission was rejected');
select pg_temp.verify(not has_function_privilege('authenticated','public.slm_group_finance_dispatch(uuid,uuid,text,jsonb)','EXECUTE') and not has_function_privilege('anon','slm_private.payment_workflow_base(uuid,uuid,text,jsonb)','EXECUTE'),'RPC ACL preserved');
set local role authenticated;
do $$begin begin perform public.slm_group_finance_dispatch(null,null,'wallet','{}');raise exception 'client RPC exposed';exception when insufficient_privilege then null;end;end $$;
reset role;
select 'PASS payment workflow SQL: scopes, duplicate payments, acceptance, rejection, manual payment, cancellation and retry';
rollback;

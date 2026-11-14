-- Disposable scratch database only. Regression: erasure must succeed for a user holding idempotency receipts.
begin;
do $$ declare u uuid:='00000000-0000-4000-8000-0000000000aa';s uuid:='10000000-0000-4000-8000-0000000000aa';begin
 insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','receipts@fixture.invalid');
 perform public.slm_account_provision(u,'Receipts_1','+48000000112','receipts@fixture.invalid',null,null,false);
 update public.slm_account_security set must_change_password=false where user_id=u;
 insert into auth.sessions(id,user_id) values(s,u);
 perform public.slm_account_accept_session(u,s,1);
end $$;
insert into public.slm_v2_requests(actor_id,request_id,action,body,response) values
 ('00000000-0000-4000-8000-0000000000aa','20000000-0000-4000-8000-0000000000aa','match:join','{}','{}');
select public.slm_deletion_begin('00000000-0000-4000-8000-0000000000aa','10000000-0000-4000-8000-0000000000aa','30000000-0000-4000-8000-0000000000aa',repeat('b',64));
select public.slm_deletion_step('30000000-0000-4000-8000-0000000000aa',repeat('b',64),'claim','60000000-0000-4000-8000-0000000000aa');
select public.slm_deletion_step('30000000-0000-4000-8000-0000000000aa',repeat('b',64),'purge','60000000-0000-4000-8000-0000000000aa');
do $$begin
 if exists(select 1 from public.slm_v2_requests where actor_id='00000000-0000-4000-8000-0000000000aa') then raise exception 'FAIL: receipts survived purge';end if;
 -- The relaxation is scoped: outside a prepared deletion the history stays immutable.
 perform set_config('slm.deletion_operation','',true);
 insert into public.slm_v2_requests(actor_id,request_id,action,body,response) values('00000000-0000-4000-8000-0000000000aa','20000000-0000-4000-8000-0000000000bb','match:join','{}','{}') on conflict do nothing;
 begin delete from public.slm_v2_requests;raise exception 'FAIL: receipt delete allowed outside deletion';exception when raise_exception then if sqlerrm<>'immutable_finance_history' then raise;end if;end;
end $$;
select 'PASS account deletion removes idempotency receipts and keeps history immutable elsewhere';
rollback;

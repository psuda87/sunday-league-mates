begin;
create function pg_temp.online_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL %',label;end if;raise notice 'PASS %',label;end$$;
do $$declare id uuid:=gen_random_uuid();n int;begin
 perform public.slm_model_prepare();
 perform pg_temp.online_assert(public.slm_signup_admit(id,repeat('1',64),repeat('2',64)),'verified admission accepted');
 perform pg_temp.online_assert(public.slm_signup_admit(id,repeat('1',64),repeat('2',64)) and (select count(*)=1 from public.slm_signup_admissions),'same capability admission idempotent');
 begin perform public.slm_signup_admit(id,repeat('3',64),repeat('2',64));raise exception 'bad_capability_accepted';exception when others then if sqlerrm<>'signup_conflict' then raise;end if;end;
 perform pg_temp.online_assert((select count(*)=1 from public.slm_signup_admissions),'wrong capability does not create another admission');
 for n in 1..4 loop perform public.slm_signup_admit(gen_random_uuid(),repeat('1',64),repeat('2',64));end loop;
 perform pg_temp.online_assert(not public.slm_signup_admit(gen_random_uuid(),repeat('1',64),repeat('2',64)),'one subject cannot exceed5 registrations per10min');
 perform pg_temp.online_assert(public.slm_signup_admit(gen_random_uuid(),repeat('1',64),repeat('4',64)),'exhausted attacker subject does not block another subject');
 perform pg_temp.online_assert(not has_function_privilege('authenticated','public.slm_signup_admit(uuid,text,text)','execute') and not has_table_privilege('anon','public.slm_signup_admissions','select'),'admission proofs private to service role');
 perform pg_temp.online_assert((select attempts=6 from public.slm_auth_metrics where metric='signup_admitted'),'aggregate monitor counts admissions without account/IP payloads');
 perform pg_temp.online_assert((select attempts=1 from public.slm_auth_metrics where metric='signup_limited'),'aggregate monitor counts denials');
end$$;
rollback;

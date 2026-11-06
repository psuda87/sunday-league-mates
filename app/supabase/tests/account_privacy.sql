-- Disposable scratch database only. All people and contacts below are fixtures.
begin;
create function pg_temp.check_that(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
do $$ declare i integer;u uuid;s uuid;begin
 for i in 1..4 loop
 u:=('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
 s:=('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
 insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','privacy'||i||'@fixture.invalid');
 perform public.slm_account_provision(u,'Privacy_'||i,'+48000000'||lpad(i::text,3,'0'),'privacy'||i||'@fixture.invalid',null,null,false);
 update public.slm_account_security set must_change_password=false where user_id=u;
 insert into auth.sessions(id,user_id) values(s,u);
 perform public.slm_account_accept_session(u,s,1);
 end loop;
end $$;
insert into public.slm_player_profiles(user_id,nickname,contact_phone,email_account)
 select user_id,login,phone,false from public.slm_aliases;
insert into public.slm_groups(id,name,admin_id) values
 ('20000000-0000-4000-8000-000000000001','Fixture group','00000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','Fixture sole group','00000000-0000-4000-8000-000000000002');
insert into public.slm_group_members(group_id,user_id) values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'),
 ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002');
select pg_temp.check_that(not exists(select 1 from public.slm_profiles where share_phone),'existing and new accounts default private');
select pg_temp.check_that(slm_private.phone_for('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002') is null,'same-group admin has no default exception');
set local role service_role;
select public.slm_phone_save('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','+48000000002',true);
reset role;
select pg_temp.check_that(slm_private.phone_for('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')='+48000000002','opt-in current shared member sees number');
select pg_temp.check_that(slm_private.phone_for('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002') is null,'outside group cannot see number');
select pg_temp.check_that(slm_private.phone_for(null,'00000000-0000-4000-8000-000000000002') is null,'anonymous cannot see number');
select pg_temp.check_that((slm_private.group_profile('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001')->>'contact_phone')='+48000000002','group RPC projection uses current opt-in');
delete from public.slm_group_members where user_id='00000000-0000-4000-8000-000000000001';
select pg_temp.check_that(slm_private.phone_for('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002') is null,'leaving revokes immediately');
insert into public.slm_group_members(group_id,user_id) values('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
set local role service_role;
select public.slm_phone_save('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','+48000000002',false);
reset role;
select pg_temp.check_that(slm_private.phone_for('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002') is null,'opt-out revokes immediately');
set local role service_role;
select public.slm_phone_save('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','',false);
reset role;
select pg_temp.check_that((select phone is null from public.slm_aliases where user_id='00000000-0000-4000-8000-000000000002'),'legacy phone removable');
select pg_temp.check_that((select login='Privacy_2' and technical_email='privacy2@fixture.invalid' from public.slm_aliases where user_id='00000000-0000-4000-8000-000000000002'),'legacy login and technical identity unchanged');
select pg_temp.check_that(not has_table_privilege('authenticated','public.slm_aliases','SELECT') and not has_table_privilege('authenticated','public.slm_player_profiles','SELECT'),'direct raw contact reads denied');
select pg_temp.check_that(not has_table_privilege('authenticated','public.slm_auth_proof_accounts','SELECT'),'historical proof directory cannot bypass consent');
select pg_temp.check_that(not has_function_privilege('anon','public.slm_phone_visibility(uuid,uuid[])','EXECUTE') and not has_function_privilege('authenticated','public.slm_deletion_begin(uuid,uuid,uuid,text)','EXECUTE'),'anonymous and client RPC access denied');
set local role authenticated;
do $$begin
 begin perform phone from public.slm_aliases;raise exception 'raw phone leak';exception when insufficient_privilege then null;end;
 begin perform contact_phone from public.slm_player_profiles;raise exception 'raw contact leak';exception when insufficient_privilege then null;end;
 begin perform public.slm_phone_visibility('00000000-0000-4000-8000-000000000001',array['00000000-0000-4000-8000-000000000002']::uuid[]);raise exception 'RPC leak';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform phone from public.slm_aliases;raise exception 'anonymous leak';exception when insufficient_privilege then null;end;
 begin perform public.slm_deletion_step('30000000-0000-4000-8000-000000000002',null,'purge');raise exception 'delete RPC exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Owner with other members must transfer; the rejected transaction revokes nothing.
do $$begin
 begin perform public.slm_deletion_begin('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',repeat('a',64));raise exception 'expected refusal';
 exception when others then if sqlerrm<>'group_transfer_required' then raise;end if;end;
end $$;
select pg_temp.check_that((select active from public.slm_account_security where user_id='00000000-0000-4000-8000-000000000001'),'admin refusal leaves session active');
select pg_temp.check_that(slm_private.erase_json('"Adam administrator ab a"'::jsonb,array['fixture-id','a'])='"Adam administrator ab [usunięto]"'::jsonb,'short names never replace substrings');
insert into public.slm_group_audit(group_id,actor_id,action,snapshot)
 values('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','unrelated',jsonb_build_object('name','Privacy_2','amount',123));
-- Financial facts retain amounts and entry IDs, never Auth identity.
insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents)
 values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Fixture','private',now()-interval '2 days','Fixture',90,10,27000);
insert into public.slm_match_entries(id,event_id,member_id,responsible_user_id,status)
 values('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','registered');
insert into public.slm_group_ledger(group_id,event_id,user_id,entry_id,amount_cents,kind,actor_id,reason)
 values('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001',2700,'charge','00000000-0000-4000-8000-000000000001','Fixture charge');
insert into public.slm_payments(id,user_id,amount_cents,corrected_amount_cents,status,submitted_by,decided_by,decided_at,note)
 values('70000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',2700,2700,'accepted','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',now(),'Privacy_2 privacy2@fixture.invalid');
insert into public.slm_group_payments(id,group_id,user_id,amount_cents,corrected_amount_cents,status,submitted_by,decided_by,note)
 values('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',2700,2700,'accepted','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','Privacy_2');
insert into public.slm_group_audit(group_id,actor_id,action,snapshot)
 values('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','fixture',jsonb_build_object('user_id','00000000-0000-4000-8000-000000000002','phone','+48000000002','name','Privacy_2'));
insert into public.slm_profile_photos(user_id,object_path,cleanup_path)
 values('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002/fixture.webp','00000000-0000-4000-8000-000000000002/orphan.webp');
select public.slm_deletion_begin('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',repeat('b',64));
insert into slm_private.photo_upload_leases values('00000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000001',now()+interval '2 minutes');
select pg_temp.check_that(not slm_private.session_valid('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',false),'all sessions immediately invalidated');
select public.slm_deletion_step('30000000-0000-4000-8000-000000000002',repeat('b',64),'claim','60000000-0000-4000-8000-000000000001');
select public.slm_deletion_step('30000000-0000-4000-8000-000000000002',repeat('b',64),'purge','60000000-0000-4000-8000-000000000001');
select pg_temp.check_that((select amount_cents=2700 and user_id is null from public.slm_group_ledger limit 1),'ledger amount preserved and subject detached');
select pg_temp.check_that((select archived and admin_id is null from public.slm_groups where id='20000000-0000-4000-8000-000000000002'),'sole-member group closed safely');
select pg_temp.check_that((select amount_cents=2700 and decided_by is null and decided_by_erased and user_id is null and note not like '%Privacy_2%' from public.slm_payments limit 1),'legacy accepted payment retains accounting facts without identity');
select pg_temp.check_that(not exists(select 1 from public.slm_group_audit where action='fixture' and (snapshot::text like '%Privacy_2%' or snapshot::text like '%00000000-0000-4000-8000-000000000002%' or snapshot->>'phone' is not null)),'embedded history identities and former phone scrubbed');
select pg_temp.check_that((select snapshot->>'name'='Privacy_2' and snapshot->>'amount'='123' from public.slm_group_audit where action='unrelated'),'same name in unrelated history remains untouched');
delete from auth.users where id='00000000-0000-4000-8000-000000000002';
do $$begin
 begin perform public.slm_deletion_step('30000000-0000-4000-8000-000000000002',repeat('b',64),'complete','60000000-0000-4000-8000-000000000001');raise exception 'in-flight upload ignored';
 exception when others then if sqlerrm<>'deletion_pending' then raise;end if;end;
end $$;
update slm_private.photo_upload_leases set expires_at=now()-interval '1 second';
select public.slm_deletion_step('30000000-0000-4000-8000-000000000002',repeat('b',64),'complete','60000000-0000-4000-8000-000000000001');
select pg_temp.check_that(not exists(select 1 from public.slm_profiles where user_id='00000000-0000-4000-8000-000000000002') and not exists(select 1 from public.slm_aliases where user_id='00000000-0000-4000-8000-000000000002'),'Auth cascade removes profile and aliases');
select pg_temp.check_that(not exists(select 1 from public.slm_profile_photos where user_id='00000000-0000-4000-8000-000000000002'),'photo metadata and cleanup references removed');
select pg_temp.check_that((select subject_id is null and phase='complete' and notice_sent_at is null from slm_private.account_deletions limit 1),'no subject in completed notification job');
select 'PASS account privacy SQL/RLS/FK and history integration';
rollback;

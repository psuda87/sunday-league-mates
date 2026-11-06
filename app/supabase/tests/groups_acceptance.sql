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

set role service_role;
do $$ declare
 u1 uuid:='00000000-0000-4000-8000-000000000001';s1 uuid:='10000000-0000-4000-8000-000000000001';
 u2 uuid:='00000000-0000-4000-8000-000000000002';s2 uuid:='10000000-0000-4000-8000-000000000002';
 u3 uuid:='00000000-0000-4000-8000-000000000003';s3 uuid:='10000000-0000-4000-8000-000000000003';
 g uuid:='20000000-0000-4000-8000-000000000001';r uuid;
begin
 perform public.slm_groups_dispatch(u3,s3,'join',jsonb_build_object('group_id',g,'request_id',gen_random_uuid()));
 select id into r from public.slm_group_requests where group_id=g and actor_id=u3 and state='pending';
 if r is null then raise exception 'join request missing';end if;
 begin
  perform public.slm_groups_dispatch(u2,s2,'decide',jsonb_build_object('id',r,'accept',true,'request_id',gen_random_uuid()));
  raise exception 'foreign administrator accepted request';
 exception when raise_exception then if sqlerrm not in ('forbidden','not_found') then raise;end if;end;
 perform public.slm_groups_dispatch(u1,s1,'decide',jsonb_build_object('id',r,'accept',true,'request_id',gen_random_uuid()));
 if not exists(select 1 from public.slm_group_members where group_id=g and user_id=u3) then raise exception 'accepted membership missing';end if;
 if not exists(select 1 from public.slm_group_requests where id=r and state='accepted') then raise exception 'request history lost';end if;
 raise notice 'PASS only current group administrator decides, accepted history retained';
end $$;
reset role;
rollback;

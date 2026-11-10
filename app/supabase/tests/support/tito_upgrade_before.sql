-- Run ONLY in a NEW approved isolated stack after main's 48 migrations, BEFORE
-- the completion migration. This commits synthetic pre-change state, no copies.
begin;
do $$begin
 if exists(select 1 from auth.users) or exists(select 1 from public.slm_matches) then raise exception 'fresh_fixture_required';end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='slm_match_entries' and column_name='lineup_last_team') then raise exception 'pre_change_schema_required';end if;
end $$;
insert into auth.users(id,email) values('f0000000-0000-4000-8000-000000000001','tito-upgrade@fixture.invalid');
select public.slm_account_provision('f0000000-0000-4000-8000-000000000001','TitoUpgrade',null,'tito-upgrade@fixture.invalid',null,null,false);
update public.slm_account_security set must_change_password=false where user_id='f0000000-0000-4000-8000-000000000001';
insert into auth.sessions(id,user_id) values('f0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000001');
select public.slm_account_accept_session('f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002',1);
insert into public.slm_groups(id,name,admin_id) values('f0000000-0000-4000-8000-000000000003','Tito upgrade fixture','f0000000-0000-4000-8000-000000000001');
insert into public.slm_group_members(group_id,user_id) values('f0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000001');
insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents)
 values('f0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000001','Upgrade','private',clock_timestamp()+interval '10 days','Fixture',90,15,0);
insert into public.slm_match_entries(id,event_id,responsible_user_id,guest_name,status) values
 ('f0000000-0000-4000-8000-000000000005','f0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000001','Guest one','registered'),
 ('f0000000-0000-4000-8000-000000000006','f0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000001','Guest two','registered'),
 ('f0000000-0000-4000-8000-000000000007','f0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000001','Not assigned before upgrade','registered');
insert into public.slm_match_lineups(event_id,version,team_a,team_b,roster_version,updated_by)
 values('f0000000-0000-4000-8000-000000000004',7,array['f0000000-0000-4000-8000-000000000005'::uuid,'f0000000-0000-4000-8000-000000000006'::uuid],'{}',
 slm_private.lineup_state('f0000000-0000-4000-8000-000000000004')->>'roster_version','f0000000-0000-4000-8000-000000000001');
insert into public.slm_v2_requests(actor_id,request_id,action,body,response)
 select 'f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000008','lineup:save',
 jsonb_build_object('event_id',l.event_id,'expected_version',6,'expected_roster_version',l.roster_version,'team_a',l.team_a,'team_b',l.team_b),
 slm_private.lineup_state(l.event_id)||jsonb_build_object('changed',true)
 from public.slm_match_lineups l where l.event_id='f0000000-0000-4000-8000-000000000004';
commit;

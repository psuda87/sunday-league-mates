-- Disposable scratch database only. Rating 0.2: window, ballots, lazy settlement, MVP Gold, monthly bonus.
begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
create temp table rid(k text primary key,id uuid not null default gen_random_uuid());
insert into rid(k) select unnest(array['u1','u2','u3','u4','u5','u6','s1','s2','s3','s4','s5','s6','group','other','future','m1','m2','m3','old']);
create function pg_temp.tid(key text) returns uuid language sql as $$select id from rid where k=key$$;
create function pg_temp.verify(ok boolean,label text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'FAIL %',label;end if;
end $$;
-- Matches live in the previous calendar month so the monthly bonus can settle.
create function pg_temp.base() returns timestamptz language sql as $$select date_trunc('month',clock_timestamp())-interval '20 days'$$;
do $$declare i integer;u uuid;s uuid;g uuid:=pg_temp.tid('group');begin
 for i in 1..6 loop
  u:=pg_temp.tid('u'||i);s:=pg_temp.tid('s'||i);
  insert into auth.users(id,email) values(u,u::text||'@fixture.invalid');
  perform public.slm_account_provision(u,'Rate_'||substr(replace(u::text,'-',''),1,12),null,u::text||'@fixture.invalid',null,null,false);
  update public.slm_account_security set must_change_password=false where user_id=u;
  insert into auth.sessions(id,user_id) values(s,u);perform public.slm_account_accept_session(u,s,1);
  insert into public.slm_player_profiles(user_id,nickname) values(u,'Rater '||i);
 end loop;
 insert into public.slm_groups(id,name,admin_id) values(g,'Rating synthetic',pg_temp.tid('u1')),(pg_temp.tid('other'),'Rating other',pg_temp.tid('u6'));
 insert into public.slm_group_members(group_id,user_id) select g,id from rid where k in ('u1','u2','u3','u4','u5');
 insert into public.slm_group_members(group_id,user_id) values(pg_temp.tid('other'),pg_temp.tid('u6'));
 update public.slm_rating_config set enabled_from=pg_temp.base()-interval '1 day';
end $$;
create function pg_temp.mk(key text,starts timestamptz,team_a text[],team_b text[]) returns void language plpgsql as $$
declare ids_a uuid[];ids_b uuid[];begin
 insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents,minimum_players)
  values(pg_temp.tid(key),pg_temp.tid('group'),pg_temp.tid('u1'),'Rating '||key,'private',starts,'Fixture',90,15,0,1);
 with ins as (insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status)
   select pg_temp.tid(key),pg_temp.tid(x),pg_temp.tid(x),'registered' from unnest(team_a) x returning id) select array_agg(id) into ids_a from ins;
 with ins as (insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status)
   select pg_temp.tid(key),pg_temp.tid(x),pg_temp.tid(x),'registered' from unnest(team_b) x returning id) select array_agg(id) into ids_b from ins;
 insert into public.slm_match_lineups(event_id,version,team_a,team_b,roster_version,updated_by) values(pg_temp.tid(key),1,ids_a,ids_b,'fixture',pg_temp.tid('u1'));
end $$;
create function pg_temp.call(actor integer,action text,body jsonb default '{}') returns jsonb language sql as $$
 select public.slm_ratings_dispatch(pg_temp.tid('u'||actor),pg_temp.tid('s'||actor),action,body);
$$;
create function pg_temp.ev(key text,extra jsonb default '{}') returns jsonb language sql as $$select jsonb_build_object('event_id',pg_temp.tid(key))||extra$$;
create function pg_temp.fails(actor integer,action text,body jsonb,expected text) returns boolean language plpgsql as $$begin
 perform pg_temp.call(actor,action,body);return false;exception when others then return sqlerrm=expected;
end $$;
grant select on rid to service_role;
grant select,update on public.slm_rating_config to service_role;

set local role service_role;
do $$declare s jsonb;r jsonb;u1 uuid:=pg_temp.tid('u1');u2 uuid:=pg_temp.tid('u2');u3 uuid:=pg_temp.tid('u3');u4 uuid:=pg_temp.tid('u4');v numeric;
begin
 -- Window: nothing before the final whistle; open for 48 hours afterwards.
 perform pg_temp.mk('future',clock_timestamp()+interval '2 days',array['u1','u2'],array['u3','u4']);
 perform pg_temp.verify(pg_temp.call(1,'get',pg_temp.ev('future'))->>'phase'='before','phase before');
 perform pg_temp.verify(pg_temp.fails(1,'rate',pg_temp.ev('future',jsonb_build_object('ratings',jsonb_build_object(u2,8))),'rating_closed'),'no rating before the end');
 perform pg_temp.mk('m1',clock_timestamp()-interval '3 hours',array['u1','u2'],array['u3','u4']);
 s:=pg_temp.call(1,'get',pg_temp.ev('m1'));
 perform pg_temp.verify(s->>'phase'='open' and (s->>'can_rate')::boolean and jsonb_array_length(s->'participants')=4,'open window lists four participants');
 -- Matches from before the module was enabled are never rated.
 perform pg_temp.mk('old',pg_temp.base()-interval '5 days',array['u1','u2'],array['u3','u4']);
 perform pg_temp.verify(pg_temp.call(1,'get',pg_temp.ev('old'))->>'phase'='disabled','pre-launch match disabled');

 -- Permissions and validation.
 perform pg_temp.verify(pg_temp.fails(6,'get',pg_temp.ev('m1'),'not_found'),'outsider cannot see the ballot');
 perform pg_temp.verify(pg_temp.call(5,'get',pg_temp.ev('m1'))->>'can_rate'='false','group member who did not play cannot rate');
 perform pg_temp.verify(pg_temp.fails(5,'rate',pg_temp.ev('m1',jsonb_build_object('ratings',jsonb_build_object(u1,9))),'forbidden'),'non-participant rating forbidden');
 perform pg_temp.verify(pg_temp.fails(1,'rate',pg_temp.ev('m1',jsonb_build_object('ratings',jsonb_build_object(u1,9))),'invalid_input'),'self rating rejected');
 perform pg_temp.verify(pg_temp.fails(1,'rate',pg_temp.ev('m1',jsonb_build_object('ratings',jsonb_build_object(u2,11))),'invalid_input'),'score above 10 rejected');
 perform pg_temp.verify(pg_temp.fails(1,'rate',pg_temp.ev('m1',jsonb_build_object('ratings',jsonb_build_object(u2,7.5))),'invalid_input'),'fractional score rejected');
 perform pg_temp.verify(pg_temp.fails(1,'rate',pg_temp.ev('m1',jsonb_build_object('ratings',jsonb_build_object(pg_temp.tid('u5'),7))),'invalid_input'),'target outside the match rejected');
 perform pg_temp.verify(pg_temp.fails(1,'rate',pg_temp.ev('m1',jsonb_build_object('ratings','{}'::jsonb,'mvp_user',u1)),'invalid_input'),'self MVP vote rejected');
 perform pg_temp.verify(pg_temp.fails(1,'stats',pg_temp.ev('m1',jsonb_build_object('goals',51,'assists',0)),'invalid_input'),'absurd goals rejected');
 perform pg_temp.verify(pg_temp.fails(1,'overview',jsonb_build_object('x',1),'invalid_input'),'unknown overview field rejected');

 -- Ballots: everyone gives u1 a nine; u1 gives the others a five. Editable until the window closes.
 perform pg_temp.call(2,'rate',pg_temp.ev('m1',jsonb_build_object('ratings',jsonb_build_object(u1,3),'mvp_user',u3,'action_team','b')));
 perform pg_temp.call(2,'rate',pg_temp.ev('m1',jsonb_build_object('ratings',jsonb_build_object(u1,9,u3,6,u4,6),'mvp_user',u1,'action_team','a')));
 perform pg_temp.call(3,'rate',pg_temp.ev('m1',jsonb_build_object('ratings',jsonb_build_object(u1,9,u2,6,u4,6),'mvp_user',u1,'action_team','a')));
 perform pg_temp.call(4,'rate',pg_temp.ev('m1',jsonb_build_object('ratings',jsonb_build_object(u1,9),'mvp_user',u1,'action_team','a')));
 s:=pg_temp.call(1,'rate',pg_temp.ev('m1',jsonb_build_object('ratings',jsonb_build_object(u2,5,u3,5,u4,5),'mvp_user',u2,'action_team','b')));
 perform pg_temp.verify((s->'my'->'ratings'->>u2::text)::int=5 and s->'my'->>'mvp_user'=u2::text,'own ballot is returned');
 perform pg_temp.verify((pg_temp.call(2,'get',pg_temp.ev('m1'))->'my'->'ratings'->>u1::text)::int=9,'ballot was replaced, not appended');
 perform pg_temp.verify(not(pg_temp.call(2,'get',pg_temp.ev('m1'))::text like '%'||u3::text||'":5%'),'other ballots stay private');
 -- Goals, assists and the final score.
 perform pg_temp.call(1,'stats',pg_temp.ev('m1',jsonb_build_object('goals',2,'assists',1)));
 perform pg_temp.call(2,'stats',pg_temp.ev('m1',jsonb_build_object('goals',3,'assists',0)));
 s:=pg_temp.call(3,'score',pg_temp.ev('m1',jsonb_build_object('score_a',4,'score_b',2)));
 perform pg_temp.verify((s->'score'->>'a')::int=4 and (s->'reported'->>'goals_a')::int=5 and (s->'reported'->>'goals_b')::int=0 and s->'result'='null'::jsonb,'score saved; reported goals expose the discrepancy');
 perform pg_temp.verify((select value from public.slm_player_ratings where user_id=u1) is null,'nothing settles while the window is open');

 -- Close the window (move the match into the previous month) and let the next call settle it.
 reset role;
 update public.slm_matches set starts_at=pg_temp.base() where id=pg_temp.tid('m1');
 set local role service_role;
 r:=pg_temp.call(1,'overview');
 perform pg_temp.verify(pg_temp.fails(2,'rate',pg_temp.ev('m1',jsonb_build_object('ratings','{}'::jsonb)),'rating_closed'),'closed window rejects ballots');
 s:=pg_temp.call(1,'get',pg_temp.ev('m1'));
 perform pg_temp.verify(s->>'phase'='closed' and s->'result'->>'mvp_outcome'='gold' and s->'result'->>'mvp_user'=u1::text and s->'result'->>'action_team'='a','result: Gold for u1, action of the match for team a');
 -- Rolling rating: 7 + 10% * (9 - 7) = 7.2, then the monthly bonus on top.
 perform pg_temp.verify((select delta from public.slm_rating_history where user_id=u1 and kind='match')=0.200,'rolling step is 10% toward the match average');
 perform pg_temp.verify((select rated_matches from public.slm_player_ratings where user_id=u1)=1,'one rated match');
 perform pg_temp.verify((select count(*) from public.slm_rating_history where user_id=u4 and kind='match')=1 and (select value_after from public.slm_rating_history where user_id=u4 and kind='match')=6.867,'u4: average 5.67 from three ballots moves 7 to 6.867');
 -- Monthly bonus for u1: MVP 0.30 + goals/assists 0.12*(1-e^(-3/4)) + action 0.10; attendance needs two sign-ups.
 select bonus into v from public.slm_rating_months where user_id=u1;
 perform pg_temp.verify(v=round(0.30+0.12*(1-exp(-0.75))+0.10,3),'monthly bonus matches the formula: '||v);
 perform pg_temp.verify((select value from public.slm_player_ratings where user_id=u1)=7.200+v,'bonus is added on top and stays');
 perform pg_temp.verify((select bonus from public.slm_rating_months where user_id=u3)=0,'no bonus without MVP, goals or a winning action');
 perform pg_temp.verify((r->'me'->>'rating')::numeric=7.00 and not (r->'me'->>'final')::boolean,'still 7.00 before five rated matches');
 perform pg_temp.verify((pg_temp.call(3,'overview')->'gold')@>to_jsonb(u1),'u1 is the visible Gold holder');
 perform pg_temp.verify(pg_temp.call(6,'overview')->'gold'='[]'::jsonb,'Gold is not exposed outside shared groups');
 perform pg_temp.verify(pg_temp.fails(6,'player',jsonb_build_object('user_id',u1),'not_found'),'rating of a stranger is hidden');
 perform pg_temp.verify((pg_temp.call(2,'player',jsonb_build_object('user_id',u1))->>'gold')::boolean,'group mate sees the Gold flag');
 -- Settlement is idempotent.
 perform pg_temp.call(1,'overview');
 perform pg_temp.verify((select count(*) from public.slm_rating_history where user_id=u1)=2 and (select count(*) from public.slm_mvp_gold)=1,'second settle changes nothing');

 -- A later match the holder played crowns u2: u1 loses Gold at once.
 perform pg_temp.mk('m2',clock_timestamp()-interval '3 hours',array['u1','u2'],array['u3','u4']);
 perform pg_temp.call(1,'rate',pg_temp.ev('m2',jsonb_build_object('ratings','{}'::jsonb,'mvp_user',u2)));
 perform pg_temp.call(3,'rate',pg_temp.ev('m2',jsonb_build_object('ratings','{}'::jsonb,'mvp_user',u2)));
 reset role;
 update public.slm_matches set starts_at=clock_timestamp()-interval '3 days' where id=pg_temp.tid('m2');
 set local role service_role;
 r:=pg_temp.call(3,'overview');
 perform pg_temp.verify(r->'gold'=jsonb_build_array(u2),'new Gold replaces the previous holder');
 perform pg_temp.verify((select count(*) from public.slm_rating_history where event_id=pg_temp.tid('m2'))=0,'no rating change without at least two ballots');

 -- Tie: 0.25 MVP each and no Gold; no quorum when fewer than half voted.
 perform pg_temp.mk('m3',clock_timestamp()-interval '3 hours',array['u1','u2'],array['u3','u4']);
 perform pg_temp.call(1,'rate',pg_temp.ev('m3',jsonb_build_object('ratings','{}'::jsonb,'mvp_user',u3)));
 perform pg_temp.call(2,'rate',pg_temp.ev('m3',jsonb_build_object('ratings','{}'::jsonb,'mvp_user',u4)));
 reset role;
 update public.slm_matches set starts_at=clock_timestamp()-interval '2 days 3 hours' where id=pg_temp.tid('m3');
 update public.slm_match_entries set absent=true where event_id=pg_temp.tid('future');
 set local role service_role;
 s:=pg_temp.call(1,'get',pg_temp.ev('m3'));
 perform pg_temp.verify(s->'result'->>'mvp_outcome'='tie' and s->'result'->'mvp_user'='null'::jsonb,'tie has no Gold');
 perform pg_temp.verify((select sum(mvp_units) from public.slm_rating_months where user_id in (u3,u4) and settled_at is null)=0.50,'tie gives 0.25 MVP to each');
 perform pg_temp.verify(pg_temp.call(3,'overview')->'gold'=jsonb_build_array(u2),'tie does not take Gold away');
 -- The public value appears after five rated matches.
 reset role;
 update public.slm_player_ratings set rated_matches=5 where user_id=u1;
 set local role service_role;
 r:=pg_temp.call(1,'overview');
 perform pg_temp.verify((r->'me'->>'final')::boolean and (r->'me'->>'rating')::numeric=round((select value from public.slm_player_ratings where user_id=u1),2),'real rating shown after five rated matches');
end $$;
select 'PASS rating module';
rollback;

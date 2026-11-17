-- Run only inside a disposable scratch database or a rolled-back dry run, never committed on Cloud.
-- Odznaki: liczenie od zera (enabled_from), rozegrane mecze, serie, gole zgodne z wynikiem, Król strzelców, widoczność, seen.
begin;
do $$
declare a uuid:='95000000-0000-4000-8000-00000000000a'; b uuid:='95000000-0000-4000-8000-00000000000b';
 c uuid:='95000000-0000-4000-8000-00000000000c'; d uuid:='95000000-0000-4000-8000-00000000000d';
 sa uuid:='96000000-0000-4000-8000-00000000000a'; sb uuid:='96000000-0000-4000-8000-00000000000b';
 sc uuid:='96000000-0000-4000-8000-00000000000c'; sd uuid:='96000000-0000-4000-8000-00000000000d';
 g1 uuid:='97000000-0000-4000-8000-000000000001'; g2 uuid:='97000000-0000-4000-8000-000000000002'; g3 uuid:='97000000-0000-4000-8000-000000000003';
 who uuid; ses uuid; k integer:=0; i integer; ev uuid; ea uuid; eb uuid; st timestamptz; mon date; yr integer;
 r jsonb; n1 integer; n2 integer;
begin
 foreach who in array array[a,b,c,d] loop
  k:=k+1; ses:=(array[sa,sb,sc,sd])[k];
  insert into auth.users(id,email) values(who,'badge-'||k||'@fixture.invalid');
  insert into auth.sessions(id,user_id) values(ses,who);
  insert into public.slm_account_security(user_id,must_change_password,security_version,active) values(who,false,1,true)
   on conflict(user_id) do update set must_change_password=false,security_version=1,active=true,operation_id=null;
  insert into public.slm_account_sessions(session_id,user_id,security_version) values(ses,who,1);
  insert into public.slm_roles(user_id,role) values(who,'member') on conflict do nothing;
  insert into public.slm_profiles(user_id,full_name) values(who,'') on conflict do nothing;
 end loop;
 insert into public.slm_groups(id,name,admin_id) values(g1,'Badge G1',a),(g2,'Badge G2',d),(g3,'Badge G3',c);
 insert into public.slm_group_members(group_id,user_id) values(g1,a),(g1,b),(g2,d),(g2,b),(g3,c);
 yr:=extract(year from clock_timestamp() at time zone 'Europe/Warsaw')::integer;
 update public.slm_badge_config set enabled_from=make_timestamptz(yr-2,1,1,0,0,0,'Europe/Warsaw');
 -- Produkcja liczy od 2026 (season >= 2026); fixture zamyka sezon yr-1, więc tylko w tej (wycofywanej) transakcji poszerzamy zakres.
 alter table public.slm_badges drop constraint slm_badges_season_check;
 alter table public.slm_badges add constraint slm_badges_season_check check(season between 2000 and 2100);

 -- G1: 12 counted matches, 2 per month over the 6 previous months. A always team a, B team b.
 -- A: 5 wins, 5 losses, win (Feniks), draw. B withdraws after 17:00 on match day of match 9.
 mon:=(date_trunc('month',clock_timestamp() at time zone 'Europe/Warsaw')-interval '6 months')::date;
 for i in 0..11 loop
  st:=((mon+make_interval(months=>i/2))::date+(4+(i%2)*10)+time '19:00') at time zone 'Europe/Warsaw';
  ev:=gen_random_uuid();
  insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents,minimum_players)
   values(ev,g1,a,'Badge '||i,'private',st,'Fixture',90,15,0,1);
  insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status) values(ev,a,a,'registered') returning id into ea;
  if i=9 then
   insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status,withdrawn_at)
    values(ev,b,b,'withdrawn',((st at time zone 'Europe/Warsaw')::date+time '18:00') at time zone 'Europe/Warsaw') returning id into eb;
   insert into public.slm_match_lineups(event_id,version,team_a,team_b,roster_version,updated_by) values(ev,1,array[ea],'{}',  'fixture',a);
  else
   insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status) values(ev,b,b,'registered') returning id into eb;
   insert into public.slm_match_lineups(event_id,version,team_a,team_b,roster_version,updated_by) values(ev,1,array[ea],array[eb],'fixture',a);
  end if;
  insert into public.slm_match_rating_state(event_id,score_a,score_b,finalized_at) values(ev,
   case when i<5 then 2 when i<10 then 0 else 1 end,case when i<5 then 1 when i=10 then 0 else 1 end,clock_timestamp());
  if i=0 then
   -- Valid: A 2 goals + 1 assist (team a scored 2), B 1 goal (team b scored 1). A guest of A played.
   insert into public.slm_match_stats(event_id,user_id,goals,assists) values(ev,a,2,1),(ev,b,1,0);
   insert into public.slm_match_entries(event_id,responsible_user_id,guest_name,status) values(ev,a,'Gość A','registered');
  elsif i=1 then
   -- Invalid: A claims 3 goals, team a scored 2.
   insert into public.slm_match_stats(event_id,user_id,goals,assists) values(ev,a,3,0);
  elsif i=10 then
   insert into public.slm_match_stats(event_id,user_id,goals,assists) values(ev,a,1,0);
  elsif i=11 then
   -- A signed up on match day after 17:00 (also once on the reserve list).
   insert into public.slm_match_history(event_id,entry_id,actor_id,action,server_time,snapshot) values
    (ev,ea,a,'reserved',((st at time zone 'Europe/Warsaw')::date+time '12:00') at time zone 'Europe/Warsaw','{}'::jsonb),
    (ev,ea,a,'joined',((st at time zone 'Europe/Warsaw')::date+time '18:00') at time zone 'Europe/Warsaw','{}'::jsonb);
  end if;
 end loop;
 -- Not counted: cancelled, not yet finalized, and before enabled_from.
 ev:=gen_random_uuid();
 insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents,minimum_players,status)
  values(ev,g1,a,'Badge cancelled','private',clock_timestamp()-interval '20 days','Fixture',90,15,0,1,'cancelled');
 insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status) values(ev,a,a,'registered');
 ev:=gen_random_uuid();
 insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents,minimum_players)
  values(ev,g1,a,'Badge open','private',clock_timestamp()-interval '3 hours','Fixture',90,15,0,1);
 insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status) values(ev,a,a,'registered');
 ev:=gen_random_uuid();
 insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents,minimum_players)
  values(ev,g1,a,'Badge old','private',make_timestamptz(yr-2,1,1,0,0,0,'Europe/Warsaw')-interval '1 day','Fixture',90,15,0,1);
 insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status) values(ev,a,a,'registered');
 insert into public.slm_match_rating_state(event_id,score_a,score_b,finalized_at) values(ev,1,0,clock_timestamp());

 -- G2 in the previous calendar year: D 3 valid goals, B 1 valid + 4 claimed in a mismatched match.
 for i in 0..1 loop
  ev:=gen_random_uuid();
  insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents,minimum_players)
   values(ev,g2,d,'Badge G2 '||i,'private',make_timestamptz(yr-1,6,10+i,19,0,0,'Europe/Warsaw'),'Fixture',90,15,0,1);
  insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status) values(ev,d,d,'registered') returning id into ea;
  insert into public.slm_match_entries(event_id,member_id,responsible_user_id,status) values(ev,b,b,'registered') returning id into eb;
  insert into public.slm_match_lineups(event_id,version,team_a,team_b,roster_version,updated_by) values(ev,1,array[ea],array[eb],'fixture',d);
  if i=0 then
   insert into public.slm_match_rating_state(event_id,score_a,score_b,finalized_at) values(ev,3,1,clock_timestamp());
   insert into public.slm_match_stats(event_id,user_id,goals,assists) values(ev,d,3,0),(ev,b,1,0);
  else
   insert into public.slm_match_rating_state(event_id,score_a,score_b,finalized_at) values(ev,0,1,clock_timestamp());
   insert into public.slm_match_stats(event_id,user_id,goals,assists) values(ev,b,4,0);
  end if;
 end loop;

 -- Uprawnienia: tylko service_role.
 if has_table_privilege('authenticated','public.slm_badges','select') or has_table_privilege('anon','public.slm_badges','select')
  or has_function_privilege('authenticated','public.slm_badges_dispatch(uuid,uuid,text,jsonb)','execute')
  or has_function_privilege('anon','slm_private.badge_progress(uuid)','execute') then raise exception 'badges exposed';end if;
 if not exists(select 1 from pg_class where oid='public.slm_badges'::regclass and relrowsecurity) then raise exception 'rls off';end if;

 -- Dalej jak Edge: funkcje są security invoker, więc brak uprawnień service_role (np. do auth.users) musi wywrócić test.
 execute 'set local role service_role';

 r:=public.slm_badges_dispatch(a,sa,'player',jsonb_build_object('user_id',a));
 if not (r->>'own')::boolean then raise exception 'own flag';end if;
 if (select array_agg(x->>'code' order by x->>'code') from jsonb_array_elements(r->'earned') x)
  <>array['SLM-MAT-001','SLM-MAT-010','SLM-MON-003','SLM-MON-006','SLM-PHX-005','SLM-STR-010','SLM-WIN-005'] then
  raise exception 'A earned wrong: %',r->'earned';end if;
 if not exists(select 1 from jsonb_array_elements(r->'earned') x where x->>'code'='SLM-STR-010' and x->>'group_id'=g1::text
  and x->>'group_name'='Badge G1' and (x->>'new')::boolean) then raise exception 'STR group/new wrong: %',r->'earned';end if;
 if (select jsonb_object_agg(x->>'code',(x->>'progress')::integer) from jsonb_array_elements(r->'progress') x
   where x->>'code' in ('SLM-ATT-020','SLM-GOL-100','SLM-AST-100','SLM-MON-012','SLM-REL-020','SLM-GST-010','SLM-LST-005','SLM-BEN-010','SLM-COM-001'))
  <>'{"SLM-ATT-020":12,"SLM-GOL-100":3,"SLM-AST-100":1,"SLM-MON-012":6,"SLM-REL-020":12,"SLM-GST-010":1,"SLM-LST-005":1,"SLM-BEN-010":1,"SLM-COM-001":0}'::jsonb then
  raise exception 'A progress wrong: %',r->'progress';end if;

 -- Idempotentnie: kolejny odczyt nie dubluje.
 select count(*) into n1 from public.slm_badges where user_id in (a,b,c,d);
 perform public.slm_badges_dispatch(a,sa,'player',jsonb_build_object('user_id',a));
 perform slm_private.badges_settle();
 select count(*) into n2 from public.slm_badges where user_id in (a,b,c,d);
 if n1<>n2 then raise exception 'not idempotent % %',n1,n2;end if;

 -- B: late withdrawal resets Niezawodny and the group streak.
 r:=public.slm_badges_dispatch(b,sb,'player',jsonb_build_object('user_id',b));
 if (select jsonb_object_agg(x->>'code',(x->>'progress')::integer) from jsonb_array_elements(r->'progress') x where x->>'code' in ('SLM-REL-020','SLM-MAT-010'))
  <>'{"SLM-REL-020":2,"SLM-MAT-010":10}'::jsonb then raise exception 'B progress wrong: %',r->'progress';end if;
 if exists(select 1 from public.slm_badges where user_id=b and code in ('SLM-STR-010','SLM-TOP-001')) then raise exception 'B wrong badge';end if;

 -- Król strzelców G2 za poprzedni rok: tylko D (niezgodne gole B pominięte).
 if not exists(select 1 from public.slm_badges where user_id=d and code='SLM-TOP-001' and group_id=g2 and season=yr-1) then raise exception 'D not top scorer';end if;
 if not exists(select 1 from public.slm_badge_seasons where group_id=g2 and season=yr-1) then raise exception 'season not closed';end if;

 -- Widoczność jak karta: wspólna grupa tak, obcy nie; obcy nie widzi flagi new.
 r:=public.slm_badges_dispatch(b,sb,'player',jsonb_build_object('user_id',a));
 if (r->>'own')::boolean or exists(select 1 from jsonb_array_elements(r->'earned') x where (x->>'new')::boolean) then raise exception 'peer sees new';end if;
 begin perform public.slm_badges_dispatch(c,sc,'player',jsonb_build_object('user_id',a));
  raise exception 'stranger saw badges';exception when raise_exception then if sqlerrm<>'not_found' then raise;end if;end;
 begin perform public.slm_badges_dispatch(c,sc,'player',jsonb_build_object('user_id',d));
  raise exception 'stranger read d';exception when raise_exception then if sqlerrm<>'not_found' then raise;end if;end;
 -- seen: okienko i dzwonek osobno, tylko własne.
 r:=public.slm_badges_dispatch(a,sa,'seen',jsonb_build_object('scope','dialog'));
 if (r->>'seen')::integer<>7 then raise exception 'dialog seen count %',r;end if;
 r:=public.slm_badges_dispatch(a,sa,'player',jsonb_build_object('user_id',a));
 if exists(select 1 from jsonb_array_elements(r->'earned') x where (x->>'celebrate')::boolean)
  or not exists(select 1 from jsonb_array_elements(r->'earned') x where (x->>'new')::boolean) then raise exception 'dialog seen cleared bell: %',r->'earned';end if;
 r:=public.slm_badges_dispatch(a,sa,'seen',jsonb_build_object('scope','bell'));
 if (r->>'seen')::integer<>7 then raise exception 'bell seen count %',r;end if;
 if exists(select 1 from public.slm_badges where user_id=a and seen_at is null)
  or not exists(select 1 from public.slm_badges where user_id=d and seen_at is null and dialog_seen_at is null) then raise exception 'seen scope wrong';end if;
 begin perform public.slm_badges_dispatch(a,sa,'seen',jsonb_build_object('user_id',d));
  raise exception 'seen accepted body';exception when raise_exception then if sqlerrm<>'invalid_input' then raise;end if;end;
 begin perform public.slm_badges_dispatch(a,sa,'seen','{}'::jsonb);
  raise exception 'seen accepted empty';exception when raise_exception then if sqlerrm<>'invalid_input' then raise;end if;end;
 begin perform public.slm_badges_dispatch(a,sb,'player',jsonb_build_object('user_id',a));
  raise exception 'foreign session accepted';exception when raise_exception then if sqlerrm<>'session_invalid' then raise;end if;end;
 begin perform public.slm_badges_dispatch(a,sa,'player',jsonb_build_object('user_id','nope'));
  raise exception 'bad uuid accepted';exception when raise_exception then if sqlerrm<>'invalid_input' then raise;end if;end;
 raise notice 'PASS badges';
end $$;
rollback;

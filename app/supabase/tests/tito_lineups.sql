-- Run only after all migrations in a disposable isolated test database.
-- No production data: the fixture and every backfill change are rolled back.
begin;
do $test$
declare u uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); past uuid:=gen_random_uuid();
 ids uuid[]:='{}'; i integer; l public.slm_match_lineups; v bigint; result jsonb;
begin
 insert into auth.users(id,email) values(u,u::text||'@example.invalid');
 insert into public.slm_groups(id,name,admin_id) values(g,'Tito fixture',u);
 insert into public.slm_group_members(group_id,user_id) values(g,u);
 insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents,minimum_players)
 values(e,g,u,'Tito fixture','private',clock_timestamp()+interval '2 days','Fixture',90,15,0,1);
 insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents,minimum_players)
 values(past,g,u,'Mecz historyczny','private',clock_timestamp()-interval '3 days','Fixture',90,15,0,1);
 insert into public.slm_match_entries(event_id,responsible_user_id,guest_name,status) values(past,u,'Historyczny gość','registered');
 for i in 1..12 loop
  ids:=array_append(ids,gen_random_uuid());
  insert into public.slm_match_entries(id,event_id,responsible_user_id,guest_name,status)
  values(ids[i],e,u,'Guest '||i,'registered');
 end loop;
 insert into public.slm_match_lineups(event_id,version,team_a,team_b,roster_version,updated_by)
 values(e,1,ids[1:2],'{}',slm_private.lineup_state(e)->>'roster_version',u);
 -- 2:0 plus a new entry must select B, without modifying A.
 perform slm_private.tito_lineup_transition(e,ids[3],'joined',null);
 select * into l from public.slm_match_lineups where event_id=e;
 if cardinality(l.team_a)<>2 or not(l.team_a @> ids[1:2]) or l.team_b<>array[ids[3]] or l.updated_by is not null then raise exception '2:0 or Tito author';end if;
 result:=slm_private.lineup_present(slm_private.lineup_state(e),u);
 if result#>>'{last_change,display_name}'<>'Tito' or result#>>'{last_change,actor_type}'<>'automatic' then raise exception 'Tito projection';end if;
 -- Five versus five: reserve records the exact prior side, then returns to it.
 update public.slm_match_lineups set team_a=ids[1:5],team_b=ids[6:10],updated_by=u where event_id=e;
 update public.slm_match_entries set status='reserve' where id=ids[1];
 perform slm_private.tito_lineup_transition(e,ids[1],'reserved','registered');
 if (select lineup_last_team from public.slm_match_entries where id=ids[1])<>'a' then raise exception 'reserve memory';end if;
 update public.slm_match_entries set status='registered' where id=ids[1];
 perform slm_private.tito_lineup_transition(e,ids[1],'joined','reserve');
 select * into l from public.slm_match_lineups where event_id=e;
 if not(ids[1]=any(l.team_a)) or cardinality(l.team_a)<>5 or cardinality(l.team_b)<>5 then raise exception '5:5 return';end if;
 -- 6:5, then 5:5 and a return to A => 6:5.
 update public.slm_match_lineups set team_a=ids[1:6],team_b=ids[7:11] where event_id=e;
 update public.slm_match_entries set status='reserve' where id=ids[1];
 perform slm_private.tito_lineup_transition(e,ids[1],'reserved','registered');
 update public.slm_match_entries set status='registered' where id=ids[1];
 perform slm_private.tito_lineup_transition(e,ids[1],'joined','reserve');
 select * into l from public.slm_match_lineups where event_id=e;
 if cardinality(l.team_a)<>6 or cardinality(l.team_b)<>5 or not(ids[1]=any(l.team_a)) then raise exception '6:5 return';end if;
 -- 5:5, A enters reserve, a replacement fills A, then A returns: 6:5.
 update public.slm_match_lineups set team_a=ids[1:5],team_b=ids[6:10] where event_id=e;
 update public.slm_match_entries set status='reserve' where id=ids[1];
 perform slm_private.tito_lineup_transition(e,ids[1],'reserved','registered');
 perform slm_private.tito_lineup_transition(e,ids[11],'joined',null);
 update public.slm_match_entries set status='registered' where id=ids[1];
 perform slm_private.tito_lineup_transition(e,ids[1],'joined','reserve');
 select * into l from public.slm_match_lineups where event_id=e;
 if cardinality(l.team_a)<>6 or cardinality(l.team_b)<>5 or not(ids[1]=any(l.team_a)) then raise exception 'replacement then return';end if;
 -- Previous A would make 7:5: return to smaller B instead.
 update public.slm_match_lineups set team_a=ids[2:7],team_b=ids[8:12] where event_id=e;
 update public.slm_match_entries set lineup_last_team='a',status='registered' where id=ids[1];
 perform slm_private.tito_lineup_transition(e,ids[1],'joined','reserve');
 select * into l from public.slm_match_lineups where event_id=e;
 if not(ids[1]=any(l.team_b)) then raise exception 'return to smaller team';end if;
 -- Withdrawal only removes that participation and replay does not increment version.
 v:=l.version;
 update public.slm_match_entries set status='withdrawn' where id=ids[1];
 perform slm_private.tito_lineup_transition(e,ids[1],'withdrawn','registered');
 select * into l from public.slm_match_lineups where event_id=e;
 if ids[1]=any(l.team_a||l.team_b) or l.version<>v+1 then raise exception 'withdrawal';end if;
 perform slm_private.tito_lineup_transition(e,ids[1],'withdrawn','registered');
 if (select version from public.slm_match_lineups where event_id=e)<>v+1 then raise exception 'transition replay';end if;
 -- Diagnostic must not change data; apply only fills a missing registered entry.
 update public.slm_match_lineups set team_a=array_remove(team_a,ids[2]) where event_id=e;
 v:=(select version from public.slm_match_lineups where event_id=e);
 if not exists(select 1 from slm_private.tito_backfill(false) x where x.event_id=e and x.missing_count=1 and x.applied_count=0) then raise exception 'backfill diagnostic';end if;
 if (select version from public.slm_match_lineups where event_id=e)<>v then raise exception 'diagnostic wrote';end if;
 if not exists(select 1 from slm_private.tito_backfill(true) x where x.event_id=e and x.applied_count=1) then raise exception 'backfill apply';end if;
 if exists(select 1 from public.slm_match_lineups where event_id=past) then raise exception 'historical match modified';end if;
 if has_function_privilege('authenticated','slm_private.tito_lineup_transition(uuid,uuid,text,text)','execute') or
    has_function_privilege('service_role','slm_private.tito_backfill(boolean)','execute') then raise exception 'Tito access';end if;
end $test$;
rollback;

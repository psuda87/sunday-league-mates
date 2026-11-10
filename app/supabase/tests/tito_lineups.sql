-- Disposable slm-main-stabilization ONLY. Real dispatchers; no persistent fixture.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
create temp table tito_ids(k text primary key,id uuid not null default gen_random_uuid());
insert into tito_ids(k) select unnest(array['u1','u2','u3','u4','s1','s2','s3','s4','group','event','backfill','past','cancelled','unselected','operation','lease']);
create function pg_temp.tid(key text) returns uuid language sql as $$select id from tito_ids where k=key$$;
create function pg_temp.verify(ok boolean,label text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'FAIL %',label;end if;
end $$;
do $$declare i integer;u uuid;s uuid;g uuid:=pg_temp.tid('group');begin
 for i in 1..4 loop
  u:=pg_temp.tid('u'||i);s:=pg_temp.tid('s'||i);
  insert into auth.users(id,email) values(u,u::text||'@fixture.invalid');
  perform public.slm_account_provision(u,'Tito_'||substr(replace(u::text,'-',''),1,12),null,u::text||'@fixture.invalid',null,null,false);
  update public.slm_account_security set must_change_password=false where user_id=u;
  insert into auth.sessions(id,user_id) values(s,u);perform public.slm_account_accept_session(u,s,1);
  insert into public.slm_player_profiles(user_id,nickname,jersey_number) values(u,'Fixture '||i,case when i=1 then 0 when i=2 then 99 end);
 end loop;
 insert into public.slm_groups(id,name,admin_id) values(g,'Tito synthetic',pg_temp.tid('u1'));
 insert into public.slm_group_members(group_id,user_id) select g,id from tito_ids where k like 'u_';
 insert into public.slm_matches(id,group_id,created_by,name,visibility,starts_at,location,duration_minutes,capacity,cost_cents,minimum_players)
 select id,g,pg_temp.tid('u1'),'Tito '||k,'private',clock_timestamp()+case when k='past' then interval '-2 days' else interval '2 days' end,'Fixture',90,15,0,1
 from tito_ids where k in ('event','backfill','past','cancelled','unselected');
 update public.slm_matches set status='cancelled' where id=pg_temp.tid('cancelled');
end $$;
create function pg_temp.match(actor integer,action text,body jsonb default '{}') returns jsonb language sql as $$
 select public.slm_matches_dispatch(pg_temp.tid('u'||actor),pg_temp.tid('s'||actor),action,
 jsonb_build_object('event_id',pg_temp.tid('event'),'request_id',gen_random_uuid())||body);
$$;
create function pg_temp.lineup(action text,body jsonb default '{}') returns jsonb language sql as $$
 select public.slm_lineups_dispatch(pg_temp.tid('u1'),pg_temp.tid('s1'),action,jsonb_build_object('event_id',pg_temp.tid('event'))||body);
$$;
grant select on tito_ids to service_role;
-- Failure deliberately occurs AFTER lineup/history/finance, before receipt success.
create function pg_temp.tito_fail() returns trigger language plpgsql as $$begin
 if new.action='match:guest' and new.body->>'guest_name'='Tito rollback sentinel' then raise exception 'tito_test_rollback';end if;
 return new;
end $$;
create trigger tito_failure before insert on public.slm_v2_requests for each row execute function pg_temp.tito_fail();

set local role service_role;
do $$declare e uuid:=pg_temp.tid('event');a uuid;b uuid;c uuid;guest1 uuid;guest2 uuid;again uuid;
 r jsonb;s jsonb;body jsonb;receipt jsonb;v bigint;ev bigint;hist bigint;ledger bigint;side text;legacy uuid:=gen_random_uuid();original uuid;
begin
 a:=(pg_temp.match(1,'join')->>'participant_id')::uuid;
 b:=(pg_temp.match(2,'join')->>'participant_id')::uuid;
 s:=pg_temp.lineup('get');
 perform pg_temp.verify(jsonb_array_length(s->'team_a')=1 and jsonb_array_length(s->'team_b')=1,'first two joins balanced');
 perform pg_temp.verify(s#>>'{last_change,actor_type}'='automatic' and s#>>'{last_change,display_name}'='Tito','explicit automatic actor');
 -- Manual 2:0 must survive the next automatic addition, which goes only to B.
 body:=jsonb_build_object('expected_version',s->'version','expected_roster_version',s->'roster_version','team_a',jsonb_build_array(a,b),'team_b','[]'::jsonb,'request_id',gen_random_uuid());
 receipt:=pg_temp.lineup('save',body);
 perform pg_temp.verify(receipt#>>'{last_change,actor_type}'='manual','manual after Tito');
 -- Synthetic pre-change receipt: insert a separate row, respect immutable history.
 original:=(body->>'request_id')::uuid;
 insert into public.slm_v2_requests(actor_id,request_id,action,body,response)
 select actor_id,legacy,action,q.body,response-'actor_type' from public.slm_v2_requests q
 where actor_id=pg_temp.tid('u1') and request_id=original;
 body:=jsonb_set(body,'{request_id}',to_jsonb(legacy));
 c:=(pg_temp.match(3,'join')->>'participant_id')::uuid;s:=pg_temp.lineup('get');
 perform pg_temp.verify(s->'team_a'=jsonb_build_array(least(a,b),greatest(a,b)) and s->'team_b'=jsonb_build_array(c),'only new entry assigned to smaller B');
 r:=pg_temp.lineup('save',body);
 perform pg_temp.verify(r->'version'=receipt->'version' and r->>'replayed'='true' and r#>>'{last_change,actor_type}'='manual','historical receipt remains manual');
 -- Member withdrawal keeps its old row and remembered B; a new ID returns to B.
 perform pg_temp.match(3,'withdraw',jsonb_build_object('participant_id',c));
 perform pg_temp.verify((select status='withdrawn' and lineup_last_team='b' from public.slm_match_entries where id=c),'withdrawal history and side retained');
 again:=(pg_temp.match(3,'join')->>'participant_id')::uuid;s:=pg_temp.lineup('get');
 perform pg_temp.verify(again<>c and s->'team_b'=jsonb_build_array(again),'member returns with new participation ID and old side');
 -- Reserve keeps the same participation; no automatic promotion by another join.
 perform pg_temp.match(3,'reserve');s:=pg_temp.lineup('get');
 perform pg_temp.verify(not(s->'team_b' @> jsonb_build_array(again)),'reserve removed from active lineup');
 begin perform pg_temp.match(1,'join',jsonb_build_object('user_id',pg_temp.tid('u3')));raise exception 'expected refusal';
 exception when others then if sqlerrm<>'forbidden' then raise;end if;end;
 perform pg_temp.match(3,'join');s:=pg_temp.lineup('get');
 perform pg_temp.verify(s->'team_b'=jsonb_build_array(again),'reserve confirms self and retains ID/side');
 perform pg_temp.match(3,'reserve');perform pg_temp.match(3,'withdraw',jsonb_build_object('participant_id',again));
 r:=pg_temp.match(3,'join');
 perform pg_temp.verify((r->>'participant_id')::uuid<>again and (select lineup_last_team='b' from public.slm_match_entries where id=again),'full withdrawal from reserve retains last side with a new return ID');
 again:=(r->>'participant_id')::uuid;
 perform pg_temp.match(3,'reserve');s:=pg_temp.lineup('get');
 perform pg_temp.lineup('save',jsonb_build_object('expected_version',s->'version','expected_roster_version',s->'roster_version',
  'team_a','[]'::jsonb,'team_b',jsonb_build_array(a,b),'request_id',gen_random_uuid()));
 perform pg_temp.match(3,'join');s:=pg_temp.lineup('get');
 perform pg_temp.verify(s->'team_a'=jsonb_build_array(again) and jsonb_array_length(s->'team_b')=2,'reject previous side when imbalance would exceed one');
 -- Same name and inviter: distinct guest participation IDs, never merged.
 guest1:=(pg_temp.match(1,'guest','{"guest_name":"Ten sam gość"}')->>'participant_id')::uuid;
 guest2:=(pg_temp.match(1,'guest','{"guest_name":"Ten sam gość"}')->>'participant_id')::uuid;
 perform pg_temp.verify(guest1<>guest2,'duplicate guest names have distinct IDs');
 s:=pg_temp.lineup('get');side:=case when s->'team_a' @> jsonb_build_array(guest1) then 'a' else 'b' end;
 perform pg_temp.match(1,'move_guest',jsonb_build_object('participant_id',guest1,'list','reserve'));
 perform pg_temp.verify((select lineup_last_team=side from public.slm_match_entries where id=guest1),'guest reserve remembers its own entry side');
 perform pg_temp.match(1,'move_guest',jsonb_build_object('participant_id',guest1,'list','registered'));
 s:=pg_temp.lineup('get');perform pg_temp.verify(s->('team_'||side) @> jsonb_build_array(guest1),'guest reserve returns to its own side');
 -- Retry a successful match request never runs Tito twice.
 body:=jsonb_build_object('guest_name','Retry','request_id',gen_random_uuid());r:=pg_temp.match(1,'guest',body);s:=pg_temp.lineup('get');
 perform pg_temp.verify(pg_temp.match(1,'guest',body)=r and (pg_temp.lineup('get')->'version')=s->'version','match receipt replay does not increment lineup');
 -- Rollback after Tito must also roll back match version, history and accounting.
 v:=(s->>'version')::bigint;select version into ev from public.slm_matches where id=e;
 select count(*) into hist from public.slm_match_history where event_id=e;
 select count(*) into ledger from public.slm_group_ledger where event_id=e;
 begin perform pg_temp.match(1,'guest','{"guest_name":"Tito rollback sentinel"}');raise exception 'expected failure';
 exception when others then if sqlerrm<>'tito_test_rollback' then raise;end if;end;
 perform pg_temp.verify((pg_temp.lineup('get')->>'version')::bigint=v and (select version=ev from public.slm_matches where id=e),'late failure rolls back both versions');
 perform pg_temp.verify((select count(*)=hist from public.slm_match_history where event_id=e) and (select count(*)=ledger from public.slm_group_ledger where event_id=e),'late failure rolls back history/ledger');
 perform pg_temp.verify(not exists(select 1 from public.slm_match_entries where event_id=e and guest_name='Tito rollback sentinel'),'late failure rolls back participation');
 -- Jersey is in the authorized detail, including zero, with no extra RPC.
 r:=pg_temp.match(1,'detail');
 perform pg_temp.verify(exists(select 1 from jsonb_array_elements(r->'participants') p where p->>'member_id'=pg_temp.tid('u1')::text and p->>'jersey_number'='0'),'jersey zero');
 perform pg_temp.verify(exists(select 1 from jsonb_array_elements(r->'participants') p where p->>'member_id'=pg_temp.tid('u2')::text and p->>'jersey_number'='99'),'jersey 99');
end $$;
reset role;
-- Selected backfill, preserved manual assignment, dry run and second apply.
insert into public.slm_match_entries(event_id,responsible_user_id,guest_name,status)
 select id,pg_temp.tid('u1'),'Synthetic backfill '||n,'registered' from tito_ids cross join generate_series(1,3) n
 where k in ('backfill','past','cancelled','unselected');
insert into public.slm_match_lineups(event_id,version,team_a,team_b,roster_version,updated_by)
 select pg_temp.tid('backfill'),1,array[(select id from public.slm_match_entries where event_id=pg_temp.tid('backfill') order by id limit 1)],'{}',
 slm_private.lineup_state(pg_temp.tid('backfill'))->>'roster_version',pg_temp.tid('u1');
do $$declare selected uuid[]:=array[pg_temp.tid('backfill'),pg_temp.tid('past'),pg_temp.tid('cancelled')];manual uuid;v bigint;begin
 select team_a[1],version into manual,v from public.slm_match_lineups where event_id=pg_temp.tid('backfill');
 perform pg_temp.verify((select sum(missing_count)=2 and sum(applied_count)=0 from slm_private.tito_backfill(selected,false)),'selected dry-run count');
 perform pg_temp.verify((select version=v from public.slm_match_lineups where event_id=pg_temp.tid('backfill')),'dry run never writes');
 perform pg_temp.verify((select sum(applied_count)=2 from slm_private.tito_backfill(selected,true)),'first backfill fills only gaps');
 perform pg_temp.verify((select sum(missing_count)=0 and sum(applied_count)=0 from slm_private.tito_backfill(selected,true)),'second backfill idempotent');
 perform pg_temp.verify((select manual=any(team_a) and version=v+2 from public.slm_match_lineups where event_id=pg_temp.tid('backfill')),'manual side preserved by backfill');
 perform pg_temp.verify(not exists(select 1 from public.slm_match_lineups where event_id in (pg_temp.tid('past'),pg_temp.tid('cancelled'),pg_temp.tid('unselected'))),'past/cancelled/unselected skipped');
end $$;
-- Actual erasure worker leaves manual and automatic types distinct after Auth deletion.
insert into public.slm_match_lineups(event_id,version,team_a,team_b,roster_version,updated_by)
 values(pg_temp.tid('unselected'),1,'{}','{}',slm_private.lineup_state(pg_temp.tid('unselected'))->>'roster_version',pg_temp.tid('u1'));
update public.slm_groups set admin_id=pg_temp.tid('u2') where id=pg_temp.tid('group');
select public.slm_deletion_begin(pg_temp.tid('u1'),pg_temp.tid('s1'),pg_temp.tid('operation'),repeat('b',64));
select public.slm_deletion_step(pg_temp.tid('operation'),repeat('b',64),'claim',pg_temp.tid('lease'));
select public.slm_deletion_step(pg_temp.tid('operation'),repeat('b',64),'purge',pg_temp.tid('lease'));
delete from auth.users where id=pg_temp.tid('u1');
select pg_temp.verify((select actor_type='automatic' and updated_by is null from public.slm_match_lineups where event_id=pg_temp.tid('event')),'erased initiator remains automatic');
select pg_temp.verify((select actor_type='manual' and updated_by is null from public.slm_match_lineups where event_id=pg_temp.tid('unselected')),'erased manual author remains manual');
-- Existing manual lineups with NULL authors must never become Tito.
select pg_temp.verify(slm_private.lineup_present(jsonb_build_object('event_id',pg_temp.tid('event'),'updated_by',null,'updated_at',clock_timestamp()),pg_temp.tid('u2'))#>>'{last_change,actor_type}'='manual','historical receipt with erased manual author');

do $$declare f regprocedure;d text;begin
 foreach f in array array['public.slm_lineups_dispatch(uuid,uuid,text,jsonb)'::regprocedure,
  'slm_private.lineup_state(uuid)'::regprocedure,'slm_private.lineup_present(jsonb,uuid)'::regprocedure,
  'slm_private.tito_lineup_transition(uuid,uuid,text,text,uuid)'::regprocedure,'slm_private.tito_backfill(uuid[],boolean)'::regprocedure] loop
  perform pg_temp.verify(not has_function_privilege('anon',f,'EXECUTE') and not has_function_privilege('authenticated',f,'EXECUTE'),'no client RPC grant '||f);
  perform pg_temp.verify((select not prosecdef and proconfig@>array['search_path=""'] from pg_proc where oid=f),'invoker/empty path '||f);
 end loop;
 perform pg_temp.verify(not has_function_privilege('service_role','slm_private.tito_backfill(uuid[],boolean)','EXECUTE'),'backfill owner only');
 d:=pg_get_functiondef('slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure);
 perform pg_temp.verify(position('tito_lineup_transition(e.id,person.id,v_action,old_person.status,p_user)' in d)>position('version=version+1' in d),'final dispatcher hook after version increment');
 perform pg_temp.verify(position('profile_display_name(p_user,p.member_id,e.group_id)' in d)>0 and position('slm_private.phone_for(p_user,p.member_id)' in d)>0,'main privacy projections preserved');
end $$;
select 'PASS Tito real dispatcher regression';
rollback;

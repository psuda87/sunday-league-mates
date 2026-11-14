-- Disposable scratch database only. Manager restore of withdrawn entries goes through the existing join/guest actions.
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
do $$declare e uuid:=pg_temp.tid('event');a uuid;b uuid;a2 uuid;g uuid;g2 uuid;s jsonb;side_before text;side_after text;denied boolean:=false;
begin
 a:=(pg_temp.match(2,'join')->>'participant_id')::uuid;
 b:=(pg_temp.match(3,'join')->>'participant_id')::uuid;
 s:=pg_temp.lineup('get');
 side_before:=case when s->'team_a' @> to_jsonb(a::text) then 'a' else 'b' end;
 perform pg_temp.match(2,'withdraw',jsonb_build_object('participant_id',a));
 perform pg_temp.verify(not exists(select 1 from public.slm_match_entries where id=a and status<>'withdrawn'),'member withdrawn');
 -- A non-admin cannot restore someone else.
 begin perform pg_temp.match(3,'join',jsonb_build_object('user_id',pg_temp.tid('u2')));exception when others then denied:=sqlerrm='forbidden';end;
 perform pg_temp.verify(denied,'non-admin restore forbidden');
 -- The group administrator restores the withdrawn member through the existing join action.
 a2:=(pg_temp.match(1,'join',jsonb_build_object('user_id',pg_temp.tid('u2')))->>'participant_id')::uuid;
 perform pg_temp.verify(a2<>a and exists(select 1 from public.slm_match_entries where id=a2 and member_id=pg_temp.tid('u2') and status='registered'),'admin restore creates an active participation');
 s:=pg_temp.lineup('get');
 side_after:=case when s->'team_a' @> to_jsonb(a2::text) then 'a' when s->'team_b' @> to_jsonb(a2::text) then 'b' else null end;
 perform pg_temp.verify(side_after is not null and side_after=side_before,'restored member returns to the previous side');
 -- Guests: withdraw then restore by the administrator with the same name and the original responsible user.
 g:=(pg_temp.match(2,'guest',jsonb_build_object('guest_name','Restore Guest','guest_phone','','list','registered'))->>'participant_id')::uuid;
 perform pg_temp.match(2,'withdraw',jsonb_build_object('participant_id',g));
 g2:=(pg_temp.match(1,'guest',jsonb_build_object('guest_name','Restore Guest','guest_phone','','list','registered','user_id',pg_temp.tid('u2')))->>'participant_id')::uuid;
 perform pg_temp.verify(g2<>g and exists(select 1 from public.slm_match_entries where id=g2 and guest_name='Restore Guest' and responsible_user_id=pg_temp.tid('u2') and status='registered'),'admin restores a withdrawn guest for the original responsible player');
end $$;
select 'PASS manager restore of withdrawn members and guests';
rollback;

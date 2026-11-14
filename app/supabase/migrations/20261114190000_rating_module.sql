-- Rating 0.2 / MVP Gold: storage, lazy settlement and one dispatcher.
-- Additive only. Nothing is rated before slm_rating_config.enabled_from (set at migration time).
begin;

create table public.slm_rating_config (
 singleton boolean primary key default true check(singleton),
 enabled_from timestamptz not null default clock_timestamp()
);
insert into public.slm_rating_config default values;

create table public.slm_player_ratings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 value numeric(5,3) not null default 7 check(value between 1 and 10),
 rated_matches integer not null default 0 check(rated_matches>=0),
 updated_at timestamptz not null default clock_timestamp()
);
create table public.slm_match_rating_state (
 event_id uuid primary key references public.slm_matches(id) on delete cascade,
 score_a smallint check(score_a between 0 and 99), score_b smallint check(score_b between 0 and 99),
 score_by uuid references auth.users(id) on delete set null, score_at timestamptz,
 finalized_at timestamptz,
 mvp_outcome text check(mvp_outcome in ('no_quorum','no_votes','gold','tie')),
 mvp_user uuid references auth.users(id) on delete set null,
 action_team text check(action_team in ('a','b')),
 check((score_a is null)=(score_b is null))
);
create table public.slm_match_ratings (
 event_id uuid not null references public.slm_matches(id) on delete cascade,
 rater_id uuid not null references auth.users(id) on delete cascade,
 target_id uuid not null references auth.users(id) on delete cascade,
 score smallint not null check(score between 1 and 10),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(event_id,rater_id,target_id), check(rater_id<>target_id)
);
create index slm_match_ratings_target on public.slm_match_ratings(event_id,target_id);
create table public.slm_match_votes (
 event_id uuid not null references public.slm_matches(id) on delete cascade,
 voter_id uuid not null references auth.users(id) on delete cascade,
 mvp_user uuid references auth.users(id) on delete cascade,
 action_team text check(action_team in ('a','b')),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(event_id,voter_id), check(mvp_user is null or mvp_user<>voter_id)
);
create table public.slm_match_stats (
 event_id uuid not null references public.slm_matches(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 goals smallint not null default 0 check(goals between 0 and 50),
 assists smallint not null default 0 check(assists between 0 and 50),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(event_id,user_id)
);
create table public.slm_rating_months (
 user_id uuid not null references auth.users(id) on delete cascade,
 month date not null check(extract(day from month)=1),
 played integer not null default 0, signed integer not null default 0, reserve integer not null default 0,
 goals integer not null default 0, assists integer not null default 0,
 mvp_units numeric(6,2) not null default 0, action_wins integer not null default 0,
 bonus numeric(4,3) check(bonus between 0 and 0.6), settled_at timestamptz,
 primary key(user_id,month)
);
create table public.slm_rating_history (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('match','bonus')),
 event_id uuid references public.slm_matches(id) on delete set null,
 month date not null,
 delta numeric(6,3) not null, value_after numeric(5,3) not null,
 created_at timestamptz not null default clock_timestamp()
);
create index slm_rating_history_user on public.slm_rating_history(user_id,created_at desc);
create table public.slm_mvp_gold (
 event_id uuid primary key references public.slm_matches(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 awarded_at timestamptz not null default clock_timestamp(),
 valid_until timestamptz not null
);
create index slm_mvp_gold_user on public.slm_mvp_gold(user_id,valid_until desc);

alter table public.slm_rating_config enable row level security;
alter table public.slm_player_ratings enable row level security;
alter table public.slm_match_rating_state enable row level security;
alter table public.slm_match_ratings enable row level security;
alter table public.slm_match_votes enable row level security;
alter table public.slm_match_stats enable row level security;
alter table public.slm_rating_months enable row level security;
alter table public.slm_rating_history enable row level security;
alter table public.slm_mvp_gold enable row level security;
revoke all on public.slm_rating_config,public.slm_player_ratings,public.slm_match_rating_state,public.slm_match_ratings,
 public.slm_match_votes,public.slm_match_stats,public.slm_rating_months,public.slm_rating_history,public.slm_mvp_gold
 from public,anon,authenticated;
grant select,insert,update,delete on public.slm_rating_config,public.slm_player_ratings,public.slm_match_rating_state,
 public.slm_match_ratings,public.slm_match_votes,public.slm_match_stats,public.slm_rating_months,public.slm_rating_history,
 public.slm_mvp_gold to service_role;

-- Members who actually played: registered, not marked absent. Guests have no account and are not rated.
create function slm_private.rating_participants(p_event uuid) returns table(user_id uuid,team text)
language sql stable security invoker set search_path='' as $$
 select p.member_id,
  case when p.id=any(coalesce(l.team_a,'{}'::uuid[])) then 'a' when p.id=any(coalesce(l.team_b,'{}'::uuid[])) then 'b' end
 from public.slm_match_entries p left join public.slm_match_lineups l on l.event_id=p.event_id
 where p.event_id=p_event and p.member_id is not null and p.status='registered' and not p.absent;
$$;

-- Current MVP Gold: at most 7 days, and lost as soon as a later match the holder played crowns someone else.
create function slm_private.rating_gold_holders() returns setof uuid
language sql stable security invoker set search_path='' as $$
 select distinct g.user_id from public.slm_mvp_gold g join public.slm_matches gm on gm.id=g.event_id
 where g.valid_until>clock_timestamp() and not exists(
  select 1 from public.slm_mvp_gold n join public.slm_matches nm on nm.id=n.event_id
  where nm.starts_at>gm.starts_at and n.user_id<>g.user_id
   and exists(select 1 from slm_private.rating_participants(n.event_id) x where x.user_id=g.user_id));
$$;

create function slm_private.rating_public(p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('user_id',p_user,
  'rating',case when coalesce(r.rated_matches,0)>=5 then round(r.value,2) else 7.00 end,
  'final',coalesce(r.rated_matches,0)>=5,'rated_matches',coalesce(r.rated_matches,0))
 from (select 1) one left join public.slm_player_ratings r on r.user_id=p_user;
$$;

create function slm_private.rating_finalize(p_event uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare e public.slm_matches; m date; n integer; voters integer; winners uuid[]; outcome text; champion uuid;
 ca integer; cb integer; act text; r record; before numeric; after numeric;
begin
 select * into e from public.slm_matches where id=p_event for update;
 if not found then return;end if;
 insert into public.slm_match_rating_state(event_id) values(p_event) on conflict(event_id) do nothing;
 perform 1 from public.slm_match_rating_state where event_id=p_event and finalized_at is null for update;
 if not found then return;end if;
 m:=date_trunc('month',e.starts_at at time zone 'Europe/Warsaw')::date;
 select count(*) into n from slm_private.rating_participants(p_event);

 -- Monthly counters. A reserve entry counts toward attendance like a presence.
 insert into public.slm_rating_months as t(user_id,month,played,signed,reserve,goals,assists)
 select p.member_id,m,
  count(*) filter(where p.status='registered' and not p.absent),count(*) filter(where p.status='registered'),
  count(*) filter(where p.status='reserve'),
  coalesce(max(s.goals) filter(where p.status='registered' and not p.absent),0),
  coalesce(max(s.assists) filter(where p.status='registered' and not p.absent),0)
 from public.slm_match_entries p left join public.slm_match_stats s on s.event_id=p.event_id and s.user_id=p.member_id
 where p.event_id=p_event and p.member_id is not null and p.status in ('registered','reserve') group by p.member_id
 on conflict(user_id,month) do update set played=t.played+excluded.played,signed=t.signed+excluded.signed,
  reserve=t.reserve+excluded.reserve,goals=t.goals+excluded.goals,assists=t.assists+excluded.assists;

 -- Rolling rating: 10% of the way toward the average received in this match (needs at least two raters).
 for r in select x.user_id,avg(s.score)::numeric average from slm_private.rating_participants(p_event) x
   join public.slm_match_ratings s on s.event_id=p_event and s.target_id=x.user_id
   where exists(select 1 from slm_private.rating_participants(p_event) y where y.user_id=s.rater_id)
   group by x.user_id having count(*)>=2 order by x.user_id loop
  insert into public.slm_player_ratings(user_id) values(r.user_id) on conflict(user_id) do nothing;
  select value into before from public.slm_player_ratings where user_id=r.user_id for update;
  after:=round(least(10,greatest(1,before+0.1*(r.average-before))),3);
  update public.slm_player_ratings set value=after,rated_matches=rated_matches+1,updated_at=clock_timestamp() where user_id=r.user_id;
  insert into public.slm_rating_history(user_id,kind,event_id,month,delta,value_after) values(r.user_id,'match',p_event,m,after-before,after);
 end loop;

 -- MVP: quorum is at least half of the participants; a sole winner is Gold, a tie gives 0.25 each.
 select count(*) into voters from public.slm_match_votes v where v.event_id=p_event and v.mvp_user is not null
  and exists(select 1 from slm_private.rating_participants(p_event) x where x.user_id=v.voter_id)
  and exists(select 1 from slm_private.rating_participants(p_event) x where x.user_id=v.mvp_user);
 if voters=0 then outcome:='no_votes';
 elsif voters*2<n then outcome:='no_quorum';
 else
  with tally as (select v.mvp_user u,count(*) c from public.slm_match_votes v where v.event_id=p_event and v.mvp_user is not null
    and exists(select 1 from slm_private.rating_participants(p_event) x where x.user_id=v.voter_id)
    and exists(select 1 from slm_private.rating_participants(p_event) x where x.user_id=v.mvp_user) group by v.mvp_user)
  select array_agg(u order by u) into winners from tally where c=(select max(c) from tally);
  if cardinality(winners)=1 then
   outcome:='gold';champion:=winners[1];
   insert into public.slm_mvp_gold(event_id,user_id,valid_until) values(p_event,champion,clock_timestamp()+interval '7 days');
   update public.slm_rating_months set mvp_units=mvp_units+1 where user_id=champion and month=m;
  else
   outcome:='tie';
   update public.slm_rating_months set mvp_units=mvp_units+0.25 where user_id=any(winners) and month=m;
  end if;
 end if;

 -- Action of the match: the team with more votes; every player of that team gets the credit.
 select count(*) filter(where v.action_team='a'),count(*) filter(where v.action_team='b') into ca,cb
 from public.slm_match_votes v where v.event_id=p_event
  and exists(select 1 from slm_private.rating_participants(p_event) x where x.user_id=v.voter_id);
 act:=case when ca>cb then 'a' when cb>ca then 'b' end;
 if act is not null then
  update public.slm_rating_months set action_wins=action_wins+1 where month=m
   and user_id in (select x.user_id from slm_private.rating_participants(p_event) x where x.team=act);
 end if;
 update public.slm_match_rating_state set finalized_at=clock_timestamp(),mvp_outcome=outcome,mvp_user=champion,action_team=act where event_id=p_event;
end $$;

-- Lazy settlement, called by the dispatcher under the global gate: close finished rating windows, then finished months.
create function slm_private.rating_settle() returns void
language plpgsql security invoker set search_path='' as $$
declare since timestamptz; r record; this_month date; before numeric; after numeric; extra numeric;
begin
 select enabled_from into since from public.slm_rating_config;
 for r in select e.id from public.slm_matches e
   where e.status<>'cancelled' and e.starts_at>=since
    and e.starts_at+make_interval(mins=>e.duration_minutes)+interval '48 hours'<=clock_timestamp()
    and not exists(select 1 from public.slm_match_rating_state s where s.event_id=e.id and s.finalized_at is not null)
   order by e.starts_at,e.id loop
  perform slm_private.rating_finalize(r.id);
 end loop;
 this_month:=date_trunc('month',clock_timestamp() at time zone 'Europe/Warsaw')::date;
 for r in select t.* from public.slm_rating_months t where t.settled_at is null and t.month<this_month
   and not exists(select 1 from public.slm_matches e where e.status<>'cancelled' and e.starts_at>=since
    and date_trunc('month',e.starts_at at time zone 'Europe/Warsaw')::date=t.month
    and not exists(select 1 from public.slm_match_rating_state s where s.event_id=e.id and s.finalized_at is not null))
   order by t.month,t.user_id loop
  -- Monthly bonus, at most +0.6: MVP 0.30, goals and assists 0.12, action of the match 0.10, attendance 0.08.
  extra:=case when r.played<1 then 0 else round(
   0.30*least(1,r.mvp_units/(r.played*0.5))
   +0.12*(1-exp(-((r.goals+r.assists)::numeric/r.played)/4))
   +0.10*least(1,r.action_wins::numeric/r.played)
   +case when r.signed+r.reserve>=2 then 0.08*least(1,(r.played+r.reserve)::numeric/(r.signed+r.reserve)) else 0 end,3) end;
  extra:=least(0.6,greatest(0,extra));
  if extra>0 then
   insert into public.slm_player_ratings(user_id) values(r.user_id) on conflict(user_id) do nothing;
   select value into before from public.slm_player_ratings where user_id=r.user_id for update;
   after:=least(10,before+extra);
   update public.slm_player_ratings set value=after,updated_at=clock_timestamp() where user_id=r.user_id;
   insert into public.slm_rating_history(user_id,kind,month,delta,value_after) values(r.user_id,'bonus',r.month,after-before,after);
  end if;
  update public.slm_rating_months set bonus=extra,settled_at=clock_timestamp() where user_id=r.user_id and month=r.month;
 end loop;
end $$;

create function slm_private.rating_match_state(p_event uuid,p_viewer uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with e as (select m.*,m.starts_at+make_interval(mins=>m.duration_minutes) ends from public.slm_matches m where m.id=p_event),
 st as (select s.* from public.slm_match_rating_state s where s.event_id=p_event),
 ph as (select case when e.status='cancelled' or e.starts_at<(select enabled_from from public.slm_rating_config) then 'disabled'
   when clock_timestamp()<e.ends then 'before'
   when (select finalized_at from st) is not null or clock_timestamp()>=e.ends+interval '48 hours' then 'closed' else 'open' end phase from e)
 select jsonb_build_object('event_id',e.id,'phase',ph.phase,'closes_at',e.ends+interval '48 hours',
  'can_rate',ph.phase='open' and exists(select 1 from slm_private.rating_participants(p_event) x where x.user_id=p_viewer),
  'participants',(select coalesce(jsonb_agg(jsonb_build_object('user_id',x.user_id,'team',x.team,
     'display_name',coalesce(slm_private.profile_display_name(p_viewer,x.user_id,e.group_id),slm_private.public_player_name(x.user_id),'Zawodnik'))
     order by x.team nulls last,x.user_id),'[]'::jsonb) from slm_private.rating_participants(p_event) x),
  'my',jsonb_build_object(
   'ratings',(select coalesce(jsonb_object_agg(s.target_id,s.score),'{}'::jsonb) from public.slm_match_ratings s where s.event_id=p_event and s.rater_id=p_viewer),
   'mvp_user',(select v.mvp_user from public.slm_match_votes v where v.event_id=p_event and v.voter_id=p_viewer),
   'action_team',(select v.action_team from public.slm_match_votes v where v.event_id=p_event and v.voter_id=p_viewer),
   'goals',coalesce((select s.goals from public.slm_match_stats s where s.event_id=p_event and s.user_id=p_viewer),0),
   'assists',coalesce((select s.assists from public.slm_match_stats s where s.event_id=p_event and s.user_id=p_viewer),0)),
  'score',case when (select score_a from st) is null then null else jsonb_build_object('a',(select score_a from st),'b',(select score_b from st),
   'changed_at',(select score_at from st),
   'changed_by',coalesce(slm_private.profile_display_name(p_viewer,(select score_by from st),e.group_id),slm_private.public_player_name((select score_by from st)),'Zawodnik')) end,
  'reported',(select jsonb_build_object(
    'goals_a',coalesce(sum(s.goals) filter(where x.team='a'),0),'goals_b',coalesce(sum(s.goals) filter(where x.team='b'),0),
    'assists_a',coalesce(sum(s.assists) filter(where x.team='a'),0),'assists_b',coalesce(sum(s.assists) filter(where x.team='b'),0))
   from slm_private.rating_participants(p_event) x left join public.slm_match_stats s on s.event_id=p_event and s.user_id=x.user_id),
  'result',case when (select finalized_at from st) is null then null else jsonb_build_object(
   'mvp_outcome',(select mvp_outcome from st),'mvp_user',(select mvp_user from st),'action_team',(select action_team from st)) end)
 from e cross join ph;
$$;

create function public.slm_ratings_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.slm_matches; phase text; target uuid; k text; v jsonb; team text; mvp uuid; a integer; b integer;
begin
 -- Same lock order as the other dispatchers: global gate, actor, event.
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_action is null or p_action not in ('overview','player','get','rate','stats','score') then raise exception 'invalid_action';end if;
 if jsonb_typeof(p_body) is distinct from 'object' then raise exception 'invalid_input';end if;
 perform slm_private.rating_settle();

 if p_action='overview' then
  if p_body<>'{}'::jsonb then raise exception 'invalid_input';end if;
  return jsonb_build_object('me',slm_private.rating_public(p_user),
   'gold',(select coalesce(jsonb_agg(h order by h),'[]'::jsonb) from slm_private.rating_gold_holders() h
    where h=p_user or exists(select 1 from public.slm_group_members mine join public.slm_group_members theirs on theirs.group_id=mine.group_id
     join public.slm_groups g on g.id=mine.group_id and not g.archived where mine.user_id=p_user and theirs.user_id=h)));
 end if;
 if p_action='player' then
  if jsonb_typeof(p_body->'user_id') is distinct from 'string' or exists(select 1 from jsonb_object_keys(p_body) x where x<>'user_id') then raise exception 'invalid_input';end if;
  target:=(p_body->>'user_id')::uuid;
  if target<>p_user and not exists(select 1 from public.slm_group_members mine join public.slm_group_members theirs on theirs.group_id=mine.group_id
    join public.slm_groups g on g.id=mine.group_id and not g.archived where mine.user_id=p_user and theirs.user_id=target) then raise exception 'not_found';end if;
  return slm_private.rating_public(target)||jsonb_build_object('gold',exists(select 1 from slm_private.rating_gold_holders() h where h=target));
 end if;

 if jsonb_typeof(p_body->'event_id') is distinct from 'string' then raise exception 'invalid_input';end if;
 if exists(select 1 from jsonb_object_keys(p_body) x where x<>all(case p_action when 'get' then array['event_id']
   when 'rate' then array['event_id','ratings','mvp_user','action_team'] when 'stats' then array['event_id','goals','assists']
   else array['event_id','score_a','score_b'] end)) then raise exception 'invalid_input';end if;
 select * into e from public.slm_matches where id=(p_body->>'event_id')::uuid for update;
 if not found then raise exception 'not_found';end if;
 perform 1 from public.slm_group_members where group_id=e.group_id and user_id=p_user for share;
 if not found then raise exception 'not_found';end if;
 if p_action='get' then return slm_private.rating_match_state(e.id,p_user);end if;

 phase:=slm_private.rating_match_state(e.id,p_user)->>'phase';
 if phase<>'open' then raise exception 'rating_closed';end if;
 if not exists(select 1 from slm_private.rating_participants(e.id) x where x.user_id=p_user) then raise exception 'forbidden';end if;
 insert into public.slm_match_rating_state(event_id) values(e.id) on conflict(event_id) do nothing;

 if p_action='rate' then
  if jsonb_typeof(p_body->'ratings') is distinct from 'object' then raise exception 'invalid_input';end if;
  delete from public.slm_match_ratings where event_id=e.id and rater_id=p_user;
  for k,v in select * from jsonb_each(p_body->'ratings') loop
   if jsonb_typeof(v) is distinct from 'number' or v::text!~'^([1-9]|10)$' then raise exception 'invalid_input';end if;
   target:=k::uuid;
   if target=p_user or not exists(select 1 from slm_private.rating_participants(e.id) x where x.user_id=target) then raise exception 'invalid_input';end if;
   insert into public.slm_match_ratings(event_id,rater_id,target_id,score) values(e.id,p_user,target,v::text::smallint);
  end loop;
  if jsonb_typeof(coalesce(p_body->'mvp_user','null'::jsonb)) not in ('string','null')
   or jsonb_typeof(coalesce(p_body->'action_team','null'::jsonb)) not in ('string','null') then raise exception 'invalid_input';end if;
  mvp:=nullif(p_body->>'mvp_user','')::uuid;team:=p_body->>'action_team';
  if team is not null and team not in ('a','b') then raise exception 'invalid_input';end if;
  if mvp is not null and (mvp=p_user or not exists(select 1 from slm_private.rating_participants(e.id) x where x.user_id=mvp)) then raise exception 'invalid_input';end if;
  insert into public.slm_match_votes(event_id,voter_id,mvp_user,action_team) values(e.id,p_user,mvp,team)
   on conflict(event_id,voter_id) do update set mvp_user=excluded.mvp_user,action_team=excluded.action_team,updated_at=clock_timestamp();
 elsif p_action='stats' then
  if jsonb_typeof(p_body->'goals') is distinct from 'number' or jsonb_typeof(p_body->'assists') is distinct from 'number'
   or (p_body->>'goals')!~'^[0-9]{1,2}$' or (p_body->>'assists')!~'^[0-9]{1,2}$' then raise exception 'invalid_input';end if;
  a:=(p_body->>'goals')::integer;b:=(p_body->>'assists')::integer;
  if a>50 or b>50 then raise exception 'invalid_input';end if;
  insert into public.slm_match_stats(event_id,user_id,goals,assists) values(e.id,p_user,a,b)
   on conflict(event_id,user_id) do update set goals=excluded.goals,assists=excluded.assists,updated_at=clock_timestamp();
 else
  if jsonb_typeof(p_body->'score_a') is distinct from 'number' or jsonb_typeof(p_body->'score_b') is distinct from 'number'
   or (p_body->>'score_a')!~'^[0-9]{1,2}$' or (p_body->>'score_b')!~'^[0-9]{1,2}$' then raise exception 'invalid_input';end if;
  update public.slm_match_rating_state set score_a=(p_body->>'score_a')::smallint,score_b=(p_body->>'score_b')::smallint,
   score_by=p_user,score_at=clock_timestamp() where event_id=e.id;
 end if;
 return slm_private.rating_match_state(e.id,p_user);
end $$;

revoke all on function slm_private.rating_participants(uuid),slm_private.rating_gold_holders(),slm_private.rating_public(uuid),
 slm_private.rating_finalize(uuid),slm_private.rating_settle(),slm_private.rating_match_state(uuid,uuid),
 public.slm_ratings_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function slm_private.rating_participants(uuid),slm_private.rating_gold_holders(),slm_private.rating_public(uuid),
 slm_private.rating_finalize(uuid),slm_private.rating_settle(),slm_private.rating_match_state(uuid,uuid),
 public.slm_ratings_dispatch(uuid,uuid,text,jsonb) to service_role;
commit;

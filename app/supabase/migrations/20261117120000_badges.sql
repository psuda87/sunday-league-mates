-- Odznaki SLM (docs/BADGES_PLAN.md). Additive only, no backfill.
-- Counted from zero: only matches with starts_at >= slm_badge_config.enabled_from (set at migration time) count (D9).
-- A match counts once its rating window is finalized (lazy settlement, same gate as ratings), so scores and stats are stable.
begin;

create table public.slm_badge_config (
 singleton boolean primary key default true check(singleton),
 enabled_from timestamptz not null default clock_timestamp()
);
insert into public.slm_badge_config default values;

create table public.slm_badges (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 code text not null check(code ~ '^SLM-[A-Z]{3}-[0-9]{3,4}$'),
 group_id uuid references public.slm_groups(id) on delete cascade,
 season integer check(season between 2026 and 2100),
 earned_at timestamptz not null default clock_timestamp(),
 source_event_id uuid references public.slm_matches(id) on delete set null,
 seen_at timestamptz,
 constraint slm_badges_once unique nulls not distinct (user_id,code,group_id,season)
);
create index slm_badges_group_id_idx on public.slm_badges(group_id);
create index slm_badges_source_event_id_idx on public.slm_badges(source_event_id);
-- Matches already evaluated and closed seasons (group, calendar year) already awarded.
create table public.slm_badge_processed (
 event_id uuid primary key references public.slm_matches(id) on delete cascade,
 processed_at timestamptz not null default clock_timestamp()
);
create table public.slm_badge_seasons (
 group_id uuid not null references public.slm_groups(id) on delete cascade,
 season integer not null,
 processed_at timestamptz not null default clock_timestamp(),
 primary key(group_id,season)
);

alter table public.slm_badge_config enable row level security;
alter table public.slm_badges enable row level security;
alter table public.slm_badge_processed enable row level security;
alter table public.slm_badge_seasons enable row level security;
revoke all on public.slm_badge_config,public.slm_badges,public.slm_badge_processed,public.slm_badge_seasons from public,anon,authenticated;
grant select,insert,update,delete on public.slm_badge_config,public.slm_badges,public.slm_badge_processed,public.slm_badge_seasons to service_role;

-- Counted matches: not cancelled, after launch, rating window finalized.
create function slm_private.badge_events() returns table(id uuid,group_id uuid,starts_at timestamptz,score_a smallint,score_b smallint)
language sql stable security invoker set search_path='' as $$
 select e.id,e.group_id,e.starts_at,s.score_a,s.score_b from public.slm_matches e
 join public.slm_match_rating_state s on s.event_id=e.id and s.finalized_at is not null
 where e.status<>'cancelled' and e.starts_at>=(select c.enabled_from from public.slm_badge_config c);
$$;

-- Appearances: member registered and not absent. Team from the lineup, else the remembered side (lineup_last_team).
-- Goals/assists are valid only when the team's reported goals equal the team's score (D7).
create function slm_private.badge_appearances() returns table(event_id uuid,group_id uuid,starts_at timestamptz,user_id uuid,team text,
 goals integer,assists integer,team_score integer,opp_score integer,valid boolean)
language sql stable security invoker set search_path='' as $$
 select x.event_id,x.group_id,x.starts_at,x.user_id,x.team,x.goals,x.assists,x.team_score,x.opp_score,
  x.team is not null and x.team_score is not null and x.team_score=sum(x.goals) over(partition by x.event_id,x.team)
 from (select e.id event_id,e.group_id,e.starts_at,p.member_id user_id,t.team,
   coalesce(st.goals,0)::integer goals,coalesce(st.assists,0)::integer assists,
   case t.team when 'a' then e.score_a when 'b' then e.score_b end::integer team_score,
   case t.team when 'a' then e.score_b when 'b' then e.score_a end::integer opp_score
  from slm_private.badge_events() e
  join public.slm_match_entries p on p.event_id=e.id and p.member_id is not null and p.status='registered' and not p.absent
  left join public.slm_match_lineups l on l.event_id=e.id
  cross join lateral (select case when p.id=any(coalesce(l.team_a,'{}'::uuid[])) then 'a'
   when p.id=any(coalesce(l.team_b,'{}'::uuid[])) then 'b' else p.lineup_last_team end team) t
  left join public.slm_match_stats st on st.event_id=e.id and st.user_id=p.member_id) x;
$$;

-- Progress is computed on read from source tables. Streak badges report the threshold once reached, else the current run.
-- b_event = match in which the threshold was first reached. Yearly badges (TOP, YRS) are awarded per closed season.
create function slm_private.badge_progress(p_user uuid) returns table(b_code text,b_group uuid,b_progress integer,b_threshold integer,b_event uuid)
language plpgsql stable security invoker set search_path='' as $$
declare since timestamptz; r record; grp uuid; n integer:=0; e1 uuid; e10 uuid; e20 uuid; e50 uuid; e100 uuid;
 g integer:=0; a integer:=0; g_ev uuid; a_ev uuid; win integer:=0; win_ev uuid; loss integer:=0; phx_ev uuid;
 prev timestamptz; com_ev uuid; rel integer:=0; rel_ev uuid; run integer; run_ev uuid;
 m date; this_month date; cnt integer; last_ev uuid; m3 uuid; m6 uuid; m12 uuid; ids uuid[]; played integer; total integer;
begin
 select c.enabled_from into since from public.slm_badge_config c;

 for r in select x.* from slm_private.badge_appearances() x where x.user_id=p_user order by x.starts_at,x.event_id loop
  n:=n+1;
  if n=1 then e1:=r.event_id;elsif n=10 then e10:=r.event_id;elsif n=20 then e20:=r.event_id;
  elsif n=50 then e50:=r.event_id;elsif n=100 then e100:=r.event_id;end if;
  if r.valid then
   g:=g+r.goals;a:=a+r.assists;
   if g>=100 and g_ev is null then g_ev:=r.event_id;end if;
   if a>=100 and a_ev is null then a_ev:=r.event_id;end if;
  end if;
  -- Only matches with a score and a known side affect win/loss runs.
  if r.team is not null and r.team_score is not null then
   if r.team_score>r.opp_score then
    win:=win+1;
    if loss>=5 and phx_ev is null then phx_ev:=r.event_id;end if;
    loss:=0;
    if win>=5 and win_ev is null then win_ev:=r.event_id;end if;
   elsif r.team_score<r.opp_score then loss:=loss+1;win:=0;
   else win:=0;loss:=0;end if;
  end if;
  if prev is not null and r.starts_at-prev>=interval '60 days' and com_ev is null then com_ev:=r.event_id;end if;
  prev:=r.starts_at;
 end loop;
 b_group:=null;
 b_code:='SLM-MAT-001';b_threshold:=1;b_progress:=least(n,1);b_event:=e1;return next;
 b_code:='SLM-MAT-010';b_threshold:=10;b_progress:=least(n,10);b_event:=e10;return next;
 b_code:='SLM-MAT-050';b_threshold:=50;b_progress:=least(n,50);b_event:=e50;return next;
 b_code:='SLM-MAT-100';b_threshold:=100;b_progress:=least(n,100);b_event:=e100;return next;
 b_code:='SLM-ATT-020';b_threshold:=20;b_progress:=least(n,20);b_event:=e20;return next;
 b_code:='SLM-GOL-100';b_threshold:=100;b_progress:=least(g,100);b_event:=g_ev;return next;
 b_code:='SLM-AST-100';b_threshold:=100;b_progress:=least(a,100);b_event:=a_ev;return next;
 b_code:='SLM-WIN-005';b_threshold:=5;b_progress:=case when win_ev is null then win else 5 end;b_event:=win_ev;return next;
 b_code:='SLM-PHX-005';b_threshold:=1;b_progress:=case when phx_ev is null then 0 else 1 end;b_event:=phx_ev;return next;
 b_code:='SLM-COM-001';b_threshold:=1;b_progress:=case when com_ev is null then 0 else 1 end;b_event:=com_ev;return next;

 -- Niezawodny: played matches in a row; absence despite registration or withdrawal after 17:00 on match day resets.
 for r in select e.id,
   bool_or(p.status='registered' and not p.absent) played_flag,
   bool_or(p.status='registered' and p.absent) absent_flag,
   bool_or(p.status='withdrawn' and p.withdrawn_at>=((e.starts_at at time zone 'Europe/Warsaw')::date+time '17:00') at time zone 'Europe/Warsaw') late_flag
  from slm_private.badge_events() e join public.slm_match_entries p on p.event_id=e.id and p.member_id=p_user
  group by e.id,e.starts_at order by e.starts_at,e.id loop
  if r.played_flag then rel:=rel+1;if rel>=20 and rel_ev is null then rel_ev:=r.id;end if;
  elsif r.absent_flag or r.late_flag then rel:=0;end if;
 end loop;
 b_code:='SLM-REL-020';b_threshold:=20;b_progress:=case when rel_ev is null then rel else 20 end;b_event:=rel_ev;return next;

 -- Rekruter: every guest of this player who played counts separately (D6).
 select count(*)::integer,(array_agg(e.id order by e.starts_at,e.id,p.id))[10] into cnt,last_ev
 from slm_private.badge_events() e join public.slm_match_entries p on p.event_id=e.id
 where p.member_id is null and p.responsible_user_id=p_user and p.status='registered' and not p.absent;
 b_code:='SLM-GST-010';b_threshold:=10;b_progress:=least(cnt,10);b_event:=last_ev;return next;

 -- Wieczny rezerwowy: matches with a reserve sign-up, whether or not promoted later (D4).
 select array_agg(e.id order by e.starts_at,e.id) into ids from slm_private.badge_events() e
 where exists(select 1 from public.slm_match_entries p where p.event_id=e.id and p.member_id=p_user and (p.status='reserve'
  or exists(select 1 from public.slm_match_history h where h.entry_id=p.id and h.action='reserved')));
 b_code:='SLM-BEN-010';b_threshold:=10;b_progress:=least(coalesce(cardinality(ids),0),10);b_event:=ids[10];return next;

 -- Ostatnia chwila: sign-up on match day after 17:00 Europe/Warsaw, before kick-off (D2).
 select array_agg(e.id order by e.starts_at,e.id) into ids from slm_private.badge_events() e
 where exists(select 1 from public.slm_match_entries p join public.slm_match_history h on h.entry_id=p.id
  where p.event_id=e.id and p.member_id=p_user and h.action in ('joined','reserved')
   and h.server_time>=((e.starts_at at time zone 'Europe/Warsaw')::date+time '17:00') at time zone 'Europe/Warsaw'
   and h.server_time<e.starts_at);
 b_code:='SLM-LST-005';b_threshold:=5;b_progress:=least(coalesce(cardinality(ids),0),5);b_event:=ids[5];return next;

 -- Miesiące z rzędu: at least 2 played matches per Warsaw calendar month. A month without any match of the player's
 -- groups does not break the run; a month still being settled does not break it either.
 this_month:=date_trunc('month',clock_timestamp() at time zone 'Europe/Warsaw')::date;
 m:=date_trunc('month',since at time zone 'Europe/Warsaw')::date;run:=0;
 while m<=this_month loop
  select count(*)::integer,(array_agg(x.event_id order by x.starts_at desc,x.event_id desc))[1] into cnt,last_ev
  from slm_private.badge_appearances() x where x.user_id=p_user and date_trunc('month',x.starts_at at time zone 'Europe/Warsaw')::date=m;
  if cnt>=2 then
   run:=run+1;
   if run>=3 and m3 is null then m3:=last_ev;end if;
   if run>=6 and m6 is null then m6:=last_ev;end if;
   if run>=12 and m12 is null then m12:=last_ev;end if;
  elsif m<this_month and exists(select 1 from slm_private.badge_events() e where date_trunc('month',e.starts_at at time zone 'Europe/Warsaw')::date=m
    and (e.group_id in (select gm.group_id from public.slm_group_members gm where gm.user_id=p_user)
     or exists(select 1 from public.slm_match_entries p join public.slm_matches pm on pm.id=p.event_id where p.member_id=p_user and pm.group_id=e.group_id)))
   and not exists(select 1 from public.slm_matches e where e.status<>'cancelled' and e.starts_at>=since
    and date_trunc('month',e.starts_at at time zone 'Europe/Warsaw')::date=m
    and e.group_id in (select gm.group_id from public.slm_group_members gm where gm.user_id=p_user)
    and not exists(select 1 from public.slm_match_rating_state s where s.event_id=e.id and s.finalized_at is not null)) then
   run:=0;
  end if;
  m:=(m+interval '1 month')::date;
 end loop;
 b_code:='SLM-MON-003';b_threshold:=3;b_progress:=case when m3 is null then least(run,3) else 3 end;b_event:=m3;return next;
 b_code:='SLM-MON-006';b_threshold:=6;b_progress:=case when m6 is null then least(run,6) else 6 end;b_event:=m6;return next;
 b_code:='SLM-MON-012';b_threshold:=12;b_progress:=case when m12 is null then least(run,12) else 12 end;b_event:=m12;return next;

 -- Per group: Żelazne płuca (consecutive group matches; every counted group match without play resets, D3)
 -- and Regularny 2027 (% of counted group matches in 2027).
 for grp in select distinct x.group_id from slm_private.badge_appearances() x where x.user_id=p_user loop
  run:=0;run_ev:=null;
  for r in select e.id,exists(select 1 from public.slm_match_entries p where p.event_id=e.id and p.member_id=p_user
    and p.status='registered' and not p.absent) played_flag
   from slm_private.badge_events() e where e.group_id=grp order by e.starts_at,e.id loop
   if r.played_flag then run:=run+1;if run>=10 and run_ev is null then run_ev:=r.id;end if;else run:=0;end if;
  end loop;
  b_group:=grp;b_code:='SLM-STR-010';b_threshold:=10;b_progress:=case when run_ev is null then run else 10 end;b_event:=run_ev;return next;
  select count(*)::integer,count(*) filter(where exists(select 1 from slm_private.badge_appearances() x where x.event_id=e.id and x.user_id=p_user))::integer
   into total,played from slm_private.badge_events() e
  where e.group_id=grp and extract(year from e.starts_at at time zone 'Europe/Warsaw')=2027;
  if total>0 then
   b_code:='SLM-YRS-2027';b_threshold:=80;b_progress:=(100*played)/total;b_event:=null;return next;
  end if;
 end loop;
end $$;

create function slm_private.badges_award(p_user uuid) returns integer
language plpgsql security invoker set search_path='' as $$
declare k integer;
begin
 insert into public.slm_badges(user_id,code,group_id,season,source_event_id)
 select p_user,x.b_code,x.b_group,null,x.b_event from slm_private.badge_progress(p_user) x
 where x.b_progress>=x.b_threshold and x.b_code not in ('SLM-TOP-001','SLM-YRS-2027')
 on conflict on constraint slm_badges_once do nothing;
 get diagnostics k=row_count;
 return k;
end $$;

-- Lazy settlement (called under the global gate after rating_settle): evaluate players of newly finalized matches,
-- then award closed seasons (calendar year, per group): Król strzelców (D5) and Regularny 2027.
create function slm_private.badges_settle() returns void
language plpgsql security invoker set search_path='' as $$
declare since timestamptz; users uuid[]; u uuid; r record; this_year integer;
begin
 select c.enabled_from into since from public.slm_badge_config c;
 select coalesce(array_agg(distinct x.uid),'{}'::uuid[]) into users from (
  select p.member_id uid from slm_private.badge_events() e join public.slm_match_entries p on p.event_id=e.id
   where p.member_id is not null and not exists(select 1 from public.slm_badge_processed d where d.event_id=e.id)
  union all
  select p.responsible_user_id from slm_private.badge_events() e join public.slm_match_entries p on p.event_id=e.id
   where p.member_id is null and p.responsible_user_id is not null and not exists(select 1 from public.slm_badge_processed d where d.event_id=e.id)) x
 where exists(select 1 from auth.users au where au.id=x.uid);
 insert into public.slm_badge_processed(event_id)
  select e.id from slm_private.badge_events() e on conflict(event_id) do nothing;
 foreach u in array users loop perform slm_private.badges_award(u);end loop;

 this_year:=extract(year from clock_timestamp() at time zone 'Europe/Warsaw')::integer;
 for r in select e.group_id,extract(year from e.starts_at at time zone 'Europe/Warsaw')::integer y
  from slm_private.badge_events() e group by 1,2 order by 2,1 loop
  if r.y>=this_year or exists(select 1 from public.slm_badge_seasons s where s.group_id=r.group_id and s.season=r.y) then continue;end if;
  if exists(select 1 from public.slm_matches e where e.group_id=r.group_id and e.status<>'cancelled' and e.starts_at>=since
   and extract(year from e.starts_at at time zone 'Europe/Warsaw')=r.y
   and not exists(select 1 from public.slm_match_rating_state s where s.event_id=e.id and s.finalized_at is not null)) then continue;end if;
  insert into public.slm_badges(user_id,code,group_id,season)
  select t.user_id,'SLM-TOP-001',r.group_id,r.y from (
   select x.user_id,sum(x.goals) gs,max(sum(x.goals)) over() top from slm_private.badge_appearances() x
   where x.group_id=r.group_id and x.valid and extract(year from x.starts_at at time zone 'Europe/Warsaw')=r.y group by x.user_id) t
  where t.gs>0 and t.gs=t.top and exists(select 1 from auth.users au where au.id=t.user_id)
  on conflict on constraint slm_badges_once do nothing;
  if r.y=2027 then
   insert into public.slm_badges(user_id,code,group_id,season)
   select x.user_id,'SLM-YRS-2027',r.group_id,2027 from slm_private.badge_appearances() x
   where x.group_id=r.group_id and extract(year from x.starts_at at time zone 'Europe/Warsaw')=2027
    and exists(select 1 from auth.users au where au.id=x.user_id)
   group by x.user_id
   having 100*count(distinct x.event_id)>=80*(select count(*) from slm_private.badge_events() e
    where e.group_id=r.group_id and extract(year from e.starts_at at time zone 'Europe/Warsaw')=2027)
   on conflict on constraint slm_badges_once do nothing;
  end if;
  insert into public.slm_badge_seasons(group_id,season) values(r.group_id,r.y) on conflict do nothing;
 end loop;
end $$;

-- Dispatcher: player (badges + progress, visibility like the player card: self or a shared active group) and seen.
create function public.slm_badges_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target uuid; k integer;
begin
 -- Same lock order as the other dispatchers: global gate, actor.
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_action is null or p_action not in ('player','seen') then raise exception 'invalid_action';end if;
 if jsonb_typeof(p_body) is distinct from 'object' then raise exception 'invalid_input';end if;
 perform slm_private.rating_settle();
 perform slm_private.badges_settle();

 if p_action='seen' then
  if p_body<>'{}'::jsonb then raise exception 'invalid_input';end if;
  update public.slm_badges set seen_at=clock_timestamp() where user_id=p_user and seen_at is null;
  get diagnostics k=row_count;
  return jsonb_build_object('seen',k);
 end if;

 if jsonb_typeof(p_body->'user_id') is distinct from 'string' or exists(select 1 from jsonb_object_keys(p_body) x where x<>'user_id') then raise exception 'invalid_input';end if;
 if (p_body->>'user_id')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'invalid_input';end if;
 target:=(p_body->>'user_id')::uuid;
 if target<>p_user and not exists(select 1 from public.slm_group_members mine join public.slm_group_members theirs on theirs.group_id=mine.group_id
   join public.slm_groups g on g.id=mine.group_id and not g.archived where mine.user_id=p_user and theirs.user_id=target) then raise exception 'not_found';end if;
 if exists(select 1 from auth.users au where au.id=target) then perform slm_private.badges_award(target);end if;
 return jsonb_build_object('user_id',target,'own',target=p_user,
  'earned',(select coalesce(jsonb_agg(jsonb_build_object('code',b.code,'group_id',b.group_id,
     'group_name',case when b.group_id is not null and exists(select 1 from public.slm_group_members m where m.group_id=b.group_id and m.user_id=p_user)
      then (select gg.name from public.slm_groups gg where gg.id=b.group_id) end,
     'season',b.season,'earned_at',b.earned_at,'new',target=p_user and b.seen_at is null) order by b.earned_at,b.id),'[]'::jsonb)
   from public.slm_badges b where b.user_id=target),
  'progress',(select coalesce(jsonb_agg(jsonb_build_object('code',x.code,'progress',x.progress,'threshold',x.threshold) order by x.code),'[]'::jsonb)
   from (select y.b_code code,max(y.b_progress) progress,max(y.b_threshold) threshold from slm_private.badge_progress(target) y group by y.b_code) x));
end $$;

revoke all on function slm_private.badge_events(),slm_private.badge_appearances(),slm_private.badge_progress(uuid),
 slm_private.badges_award(uuid),slm_private.badges_settle(),public.slm_badges_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function slm_private.badge_events(),slm_private.badge_appearances(),slm_private.badge_progress(uuid),
 slm_private.badges_award(uuid),slm_private.badges_settle(),public.slm_badges_dispatch(uuid,uuid,text,jsonb) to service_role;
commit;

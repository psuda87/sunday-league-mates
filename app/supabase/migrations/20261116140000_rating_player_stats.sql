-- Player stats (Mecze, Gole, Asysty, MVP) for another group member.
-- Previously only the caller's own stats were returned (action 'overview');
-- 'player' now returns the same stats object, behind the same shared-active-group check.
create or replace function public.slm_ratings_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
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
  return jsonb_build_object('me',slm_private.rating_public(p_user)||jsonb_build_object('stats',(select jsonb_build_object(
     'played',coalesce(sum(t.played),0),'goals',coalesce(sum(t.goals),0),'assists',coalesce(sum(t.assists),0),
     'mvp',(select count(*) from public.slm_mvp_gold g where g.user_id=p_user)) from public.slm_rating_months t where t.user_id=p_user)),
   'gold',(select coalesce(jsonb_agg(h order by h),'[]'::jsonb) from slm_private.rating_gold_holders() h
    where h=p_user or exists(select 1 from public.slm_group_members mine join public.slm_group_members theirs on theirs.group_id=mine.group_id
     join public.slm_groups g on g.id=mine.group_id and not g.archived where mine.user_id=p_user and theirs.user_id=h)));
 end if;
 if p_action='player' then
  if jsonb_typeof(p_body->'user_id') is distinct from 'string' or exists(select 1 from jsonb_object_keys(p_body) x where x<>'user_id') then raise exception 'invalid_input';end if;
  target:=(p_body->>'user_id')::uuid;
  if target<>p_user and not exists(select 1 from public.slm_group_members mine join public.slm_group_members theirs on theirs.group_id=mine.group_id
    join public.slm_groups g on g.id=mine.group_id and not g.archived where mine.user_id=p_user and theirs.user_id=target) then raise exception 'not_found';end if;
  return slm_private.rating_public(target)||jsonb_build_object('gold',exists(select 1 from slm_private.rating_gold_holders() h where h=target),
   'stats',(select jsonb_build_object(
     'played',coalesce(sum(t.played),0),'goals',coalesce(sum(t.goals),0),'assists',coalesce(sum(t.assists),0),
     'mvp',(select count(*) from public.slm_mvp_gold g where g.user_id=target)) from public.slm_rating_months t where t.user_id=target));
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
  -- One ballot per player, final once sent.
  if exists(select 1 from public.slm_match_votes where event_id=e.id and voter_id=p_user) then raise exception 'ballot_final';end if;
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
  insert into public.slm_match_votes(event_id,voter_id,mvp_user,action_team) values(e.id,p_user,mvp,team);
  perform slm_private.rating_try_early_gold(e.id);
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

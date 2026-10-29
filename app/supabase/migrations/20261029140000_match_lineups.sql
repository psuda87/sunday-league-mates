-- Stage 2A only: shared persistent lineups. No Auth/finance/event role changes.
begin;
create table public.slm_match_lineups (
 event_id uuid primary key references public.slm_matches(id),
 version bigint not null check(version>=1),
 team_a uuid[] not null default '{}', team_b uuid[] not null default '{}',
 roster_version text not null,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default clock_timestamp(),
 check(not(team_a && team_b)),
 check(array_position(team_a,null) is null and array_position(team_b,null) is null)
);
alter table public.slm_match_lineups enable row level security;
revoke all on public.slm_match_lineups from public,anon,authenticated;
grant select,insert,update on public.slm_match_lineups to service_role;

-- No personal name in the idempotency registry. Reproject using CURRENT consent.
create function slm_private.lineup_present(p_state jsonb,p_viewer uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select (p_state-'updated_by'-'updated_at')||jsonb_build_object('last_change',
 case when p_state->>'updated_by' is null then null else jsonb_build_object(
  'user_id',p_state->>'updated_by',
  'display_name',coalesce(slm_private.profile_display_name(p_viewer,(p_state->>'updated_by')::uuid,e.group_id),
   slm_private.public_player_name((p_state->>'updated_by')::uuid),'Zawodnik'),
  'changed_at',p_state->'updated_at') end)
 from public.slm_matches e where e.id=(p_state->>'event_id')::uuid;
$$;
create function slm_private.lineup_state(p_event uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with roster as (select coalesce(array_agg(id order by id),'{}'::uuid[]) ids
  from public.slm_match_entries where event_id=p_event and status='registered')
 select jsonb_build_object('event_id',e.id,'version',coalesce(l.version,0),'event_version',e.version,
  'roster_version',encode(sha256(convert_to(e.version::text||':'||array_to_string(r.ids,','),'UTF8')),'hex'),
  'saved_roster_version',l.roster_version,'team_a',coalesce(l.team_a,'{}'::uuid[]),'team_b',coalesce(l.team_b,'{}'::uuid[]),
  'unassigned',(select coalesce(jsonb_agg(x order by x),'[]') from unnest(r.ids) x where not(x=any(coalesce(l.team_a,'{}'::uuid[])||coalesce(l.team_b,'{}'::uuid[])))),
  'stale_entry_ids',(select coalesce(jsonb_agg(x order by x),'[]') from unnest(coalesce(l.team_a,'{}'::uuid[])||coalesce(l.team_b,'{}'::uuid[])) x where not(x=any(r.ids))),
  'updated_by',l.updated_by,'updated_at',l.updated_at)
 from public.slm_matches e cross join roster r left join public.slm_match_lineups l on l.event_id=e.id where e.id=p_event;
$$;
create function public.slm_lineups_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.slm_matches; q public.slm_v2_requests; current_state jsonb; canonical jsonb;
 a uuid[];b uuid[];all_ids uuid[];request uuid;expected bigint;changed boolean;
begin
 -- Same lock order as PR24 groups/matches: global gate, actor, event, lineup.
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_action not in ('get','save') or p_action is null then raise exception 'invalid_action';end if;
 if jsonb_typeof(p_body) is distinct from 'object' or jsonb_typeof(p_body->'event_id') is distinct from 'string' then raise exception 'invalid_input';end if;
 if exists(select 1 from jsonb_object_keys(p_body) k where k<>all(case when p_action='get' then array['event_id'] else array['event_id','expected_version','expected_roster_version','team_a','team_b','request_id'] end)) then raise exception 'invalid_input';end if;
 select * into e from public.slm_matches where id=(p_body->>'event_id')::uuid for update;
 if not found then raise exception 'not_found';end if;
 perform 1 from public.slm_group_members where group_id=e.group_id and user_id=p_user for share;
 if not found then raise exception 'not_found';end if;
 perform 1 from public.slm_groups where id=e.group_id and not archived for share;
 if not found then raise exception 'group_archived';end if;
 perform 1 from public.slm_match_lineups where event_id=e.id for update;
 current_state:=slm_private.lineup_state(e.id);
 if p_action='get' then return slm_private.lineup_present(current_state,p_user);end if;
 if jsonb_typeof(p_body->'request_id') is distinct from 'string' then raise exception 'request_required';end if;
 request:=nullif(p_body->>'request_id','')::uuid;
 if request is null then raise exception 'request_required';end if;
 if jsonb_typeof(p_body->'expected_version') is distinct from 'number' or (p_body->>'expected_version')!~'^[0-9]{1,18}$'
  or jsonb_typeof(p_body->'expected_roster_version') is distinct from 'string' or (p_body->>'expected_roster_version')!~'^[0-9a-f]{64}$'
  or jsonb_typeof(p_body->'team_a') is distinct from 'array' or jsonb_typeof(p_body->'team_b') is distinct from 'array' then raise exception 'invalid_input';end if;
 expected:=(p_body->>'expected_version')::bigint;
 if jsonb_array_length(p_body->'team_a')+jsonb_array_length(p_body->'team_b')>e.capacity then raise exception 'lineup_invalid_assignment';end if;
 if exists(select 1 from jsonb_array_elements((p_body->'team_a')||(p_body->'team_b')) x where jsonb_typeof(x) is distinct from 'string') then raise exception 'lineup_invalid_assignment';end if;
 select coalesce(array_agg(x::uuid order by x::uuid),'{}'::uuid[]) into a from jsonb_array_elements_text(p_body->'team_a') x;
 select coalesce(array_agg(x::uuid order by x::uuid),'{}'::uuid[]) into b from jsonb_array_elements_text(p_body->'team_b') x;
 all_ids:=a||b;
 if cardinality(all_ids)<>(select count(distinct x) from unnest(all_ids) x) then raise exception 'lineup_invalid_assignment';end if;
 canonical:=jsonb_build_object('event_id',e.id,'expected_version',expected,'expected_roster_version',p_body->>'expected_roster_version','team_a',a,'team_b',b);
 select * into q from public.slm_v2_requests where actor_id=p_user and request_id=request;
 if found then
  if q.action<>'lineup:save' or q.body<>canonical then raise exception 'idempotency_conflict';end if;
  return slm_private.lineup_present(q.response,p_user)||jsonb_build_object('replayed',true);
 end if;
 if e.status='cancelled' then raise exception 'event_cancelled';end if;
 if clock_timestamp()>=e.starts_at+make_interval(mins=>e.duration_minutes) then raise exception 'lineup_closed';end if;
 if expected<>(current_state->>'version')::bigint then raise exception 'lineup_version_conflict';end if;
 if p_body->>'expected_roster_version'<>current_state->>'roster_version' then raise exception 'lineup_roster_conflict';end if;
 if exists(select 1 from unnest(all_ids) x where not exists(select 1 from public.slm_match_entries p where p.id=x and p.event_id=e.id and p.status='registered')) then raise exception 'lineup_invalid_assignment';end if;
 changed:=to_jsonb(a)<>current_state->'team_a' or to_jsonb(b)<>current_state->'team_b';
 if changed then
  insert into public.slm_match_lineups(event_id,version,team_a,team_b,roster_version,updated_by,updated_at)
   values(e.id,expected+1,a,b,current_state->>'roster_version',p_user,clock_timestamp())
   on conflict(event_id) do update set version=excluded.version,team_a=excluded.team_a,team_b=excluded.team_b,
    roster_version=excluded.roster_version,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 end if;
 current_state:=slm_private.lineup_state(e.id)||jsonb_build_object('changed',changed);
 insert into public.slm_v2_requests(actor_id,request_id,action,body,response) values(p_user,request,'lineup:save',canonical,current_state);
 return slm_private.lineup_present(current_state,p_user)||jsonb_build_object('replayed',false);
end $$;
revoke all on function slm_private.lineup_present(jsonb,uuid),slm_private.lineup_state(uuid),public.slm_lineups_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function slm_private.lineup_present(jsonb,uuid),slm_private.lineup_state(uuid),public.slm_lineups_dispatch(uuid,uuid,text,jsonb) to service_role;
commit;

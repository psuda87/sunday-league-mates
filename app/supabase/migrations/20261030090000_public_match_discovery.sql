-- Public match discovery: extend ONLY the existing read/list path.
-- No table, RLS policy, Auth, membership, signup, finance or lineup changes.
begin;
create function slm_private.match_discovery_list(p_user uuid,p_session uuid,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_scope text;v_period text;v_query text;v_offset integer:=0;v_group uuid;v_now timestamptz;
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if jsonb_typeof(p_body) is distinct from 'object' then raise exception 'invalid_input';end if;
 if exists(select 1 from jsonb_object_keys(p_body) k where k not in ('scope','period','query','offset','group_id','request_id')) then
  raise exception 'invalid_input';end if;
 if (p_body?'scope' and jsonb_typeof(p_body->'scope') is distinct from 'string')
  or (p_body?'period' and jsonb_typeof(p_body->'period') is distinct from 'string')
  or (p_body?'query' and jsonb_typeof(p_body->'query') is distinct from 'string') then raise exception 'invalid_input';end if;
 v_scope:=coalesce(p_body->>'scope','all');v_period:=coalesce(p_body->>'period','all');
 v_query:=trim(coalesce(p_body->>'query',''));
 if v_scope not in ('all','groups','public','mine','group') or v_period not in ('all','upcoming','history')
  or length(coalesce(p_body->>'query',''))>100 or (v_query<>'' and v_scope<>'public') then raise exception 'invalid_input';end if;
 if p_body?'offset' then
  if jsonb_typeof(p_body->'offset') is distinct from 'number' or (p_body->>'offset')!~'^[0-9]{1,10}$' then raise exception 'invalid_input';end if;
  if (p_body->>'offset')::numeric>2147483547 then raise exception 'invalid_input';end if;
  v_offset:=(p_body->>'offset')::integer;
 end if;
 if v_scope='group' then
  if jsonb_typeof(p_body->'group_id') is distinct from 'string' or nullif(p_body->>'group_id','') is null then raise exception 'invalid_input';end if;
  v_group:=(p_body->>'group_id')::uuid;
 end if;
 v_now:=clock_timestamp();
 -- All privacy, membership, scope, period and literal search predicates precede
 -- LIMIT/OFFSET. Aggregate summaries only for the returned 100 rows.
 return (with candidates as materialized (
  select e.id,e.starts_at,row_number() over(order by
   case when v_period='upcoming' then e.starts_at end asc,
   case when v_period<>'upcoming' then e.starts_at end desc,e.id) ordinal
  from public.slm_matches e join public.slm_groups g on g.id=e.group_id
  where slm_private.match_feed_visible(e.id,p_user)
   and (v_scope<>'public' or e.visibility='public')
   and (v_scope<>'groups' or slm_private.group_member(e.group_id,p_user))
   and (v_scope<>'group' or e.group_id=v_group)
   and (v_scope<>'mine' or exists(select 1 from public.slm_match_entries p where p.event_id=e.id and p.responsible_user_id=p_user))
   and (v_period<>'history' or e.status='cancelled' or e.starts_at<=v_now)
   and (v_period<>'upcoming' or e.status='scheduled' and e.starts_at>v_now)
   and (v_query='' or (e.visibility='public' and
    (position(lower(v_query) in lower(e.name))>0 or position(lower(v_query) in lower(g.name))>0)))
  order by case when v_period='upcoming' then e.starts_at end asc,
   case when v_period<>'upcoming' then e.starts_at end desc,e.id
  limit 101 offset v_offset
 ), page as (select id,ordinal from candidates order by ordinal limit 100)
 select jsonb_build_object(
  'events',(select coalesce(jsonb_agg(slm_private.match_summary(p.id,p_user) order by p.ordinal),'[]'::jsonb) from page p),
  'server_now',v_now,'member_creation_enabled',true,'public_discovery_version',1,
  'offset',v_offset,'limit',100,'has_more',(select count(*)>100 from candidates),
  'next_offset',case when (select count(*)>100 from candidates) then v_offset+100 end));
end $$;
revoke all on function slm_private.match_discovery_list(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function slm_private.match_discovery_list(uuid,uuid,jsonb) to service_role;

-- Fail closed if the historical list contract is not exactly the expected one.
-- Replace that branch only, retaining every non-list byte (including PR16 name
-- projection, financial authority and the existing public dispatcher wrapper).
do $patch$
declare definition text;old_branch text:=$old$
 if p_action='list' then
  if coalesce(p_body->>'scope','all') not in ('all','public','mine','group') or coalesce(p_body->>'period','all') not in ('all','upcoming','history') then raise exception 'invalid_input';end if;
  if p_body->>'scope'='group' and nullif(p_body->>'group_id','') is null then raise exception 'invalid_input';end if;
  return jsonb_build_object('events',(select coalesce(jsonb_agg(slm_private.match_summary(x.id,p_user) order by x.starts_at,x.id),'[]')
   from(select id,starts_at from public.slm_matches where slm_private.match_feed_visible(id,p_user)
    and (coalesce(p_body->>'scope','all')<>'public' or visibility='public')
    and (coalesce(p_body->>'scope','all')<>'group' or group_id=(p_body->>'group_id')::uuid)
    and (coalesce(p_body->>'scope','all')<>'mine' or exists(select 1 from public.slm_match_entries p where p.event_id=public.slm_matches.id and p.responsible_user_id=p_user))
    and (coalesce(p_body->>'period','all')<>'history' or status='cancelled' or starts_at<=v_now)
    and (coalesce(p_body->>'period','all')<>'upcoming' or status='scheduled' and starts_at>v_now)
    order by starts_at desc,id limit 100 offset greatest(0,coalesce((p_body->>'offset')::integer,0)))x),'server_now',v_now,'member_creation_enabled',true);
 end if;
$old$;new_branch text:=$new$
 if p_action='list' then
  return slm_private.match_discovery_list(p_user,p_session,p_body);
 end if;
$new$;
begin
 select pg_get_functiondef('slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 -- Dollar-quoted literals include one leading newline for readability.
 old_branch:=substr(old_branch,2);new_branch:=substr(new_branch,2);
 if position(old_branch in definition)=0 or position('slm_private.match_discovery_list(' in definition)>0 then
  raise exception 'match_list_contract_changed';end if;
 execute replace(definition,old_branch,new_branch);
end $patch$;
commit;

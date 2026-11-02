-- Configurable minimum; preserve historical rows, decisions and all other rules.
begin;
alter table public.slm_matches add column minimum_players integer not null default 10;
alter table public.slm_matches drop constraint slm_matches_capacity_check;
alter table public.slm_matches add constraint slm_matches_capacity_check check(capacity between 1 and 1000);
alter table public.slm_matches add constraint slm_matches_minimum_players_check check(minimum_players between 1 and capacity);
-- Exact substitutions keep discovery/PR16/session/CAS/FIFO/ACL untouched.
do $patch$
declare definition text;old text[];replacement text[];occurrences integer[];i integer;
begin
 select pg_get_functiondef('slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 old:=array['v_cost bigint;','  v_start:=case when p_body?','duration_minutes,capacity,cost_cents)',
  '(p_body->>''duration_minutes'')::integer,(p_body->>''capacity'')::integer,v_cost)',
  'capacity=(p_body->>''capacity'')::integer,cost_cents=v_cost','v_count<10'];
 replacement:=array['v_cost bigint;v_minimum integer;',
  $new$  if p_body?'minimum_players' and (jsonb_typeof(p_body->'minimum_players') is distinct from 'number' or (p_body->>'minimum_players')!~'^[0-9]{1,4}$') then raise exception 'invalid_minimum';end if;
  v_minimum:=case when p_body?'minimum_players' then (p_body->>'minimum_players')::integer when p_action='create' then 10 else e.minimum_players end;
  if v_minimum<1 or v_minimum>(p_body->>'capacity')::integer then raise exception 'invalid_minimum';end if;
  v_start:=case when p_body?$new$,
  'duration_minutes,capacity,cost_cents,minimum_players)',
  '(p_body->>''duration_minutes'')::integer,(p_body->>''capacity'')::integer,v_cost,v_minimum)',
  'capacity=(p_body->>''capacity'')::integer,cost_cents=v_cost,minimum_players=v_minimum','v_count<e.minimum_players'];
 occurrences:=array[1,1,1,1,1,2];
 for i in 1..array_length(old,1) loop
  if (length(definition)-length(replace(definition,old[i],'')))/length(old[i])<>occurrences[i] then raise exception 'match_minimum_core_contract_changed';end if;
  definition:=replace(definition,old[i],replacement[i]);
 end loop;
 execute definition;
 select pg_get_functiondef('slm_private.match_summary(uuid,uuid)'::regprocedure) into definition;
 old:=array['''minimum_players'',10','where event_id=e.id and status=''registered'')<10','jsonb_build_object(''duration_minutes'',e.duration_minutes,'];
 replacement:=array['''minimum_players'',e.minimum_players,''match_minimum_version'',1','where event_id=e.id and status=''registered'')<e.minimum_players','jsonb_build_object(''duration_minutes'',e.duration_minutes,''address'',case when slm_private.match_access(e.id,p_user)=''full'' then e.address else '''' end,'];
 for i in 1..array_length(old,1) loop
  if (length(definition)-length(replace(definition,old[i],'')))/length(old[i])<>1 then raise exception 'match_minimum_summary_contract_changed';end if;
  definition:=replace(definition,old[i],replacement[i]);
 end loop;
 execute definition;
 select pg_get_functiondef('slm_private.match_discovery_list(uuid,uuid,jsonb)'::regprocedure) into definition;
 if (length(definition)-length(replace(definition,'''public_discovery_version'',1','')))/length('''public_discovery_version'',1')<>1 then raise exception 'match_minimum_discovery_contract_changed';end if;
 execute replace(definition,'''public_discovery_version'',1','''public_discovery_version'',1,''match_minimum_version'',1');
end $patch$;
commit;

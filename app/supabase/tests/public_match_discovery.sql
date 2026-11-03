-- Rollback-only ACL/RLS contract. Execute ONLY in a new isolated fixture.
begin;
do $$ begin
 if has_function_privilege('anon','slm_private.match_discovery_list(uuid,uuid,jsonb)','execute')
  or has_function_privilege('authenticated','slm_private.match_discovery_list(uuid,uuid,jsonb)','execute')
  or has_function_privilege('authenticated','public.slm_matches_dispatch(uuid,uuid,text,jsonb)','execute') then
  raise exception 'Direct discovery dispatcher exposed';end if;
 if not has_function_privilege('service_role','slm_private.match_discovery_list(uuid,uuid,jsonb)','execute') then
  raise exception 'Missing scoped server capability';end if;
 if (select prosecdef from pg_proc where oid='slm_private.match_discovery_list(uuid,uuid,jsonb)'::regprocedure)
  or (select prosecdef from pg_proc where oid='public.slm_matches_dispatch(uuid,uuid,text,jsonb)'::regprocedure) then
  raise exception 'Invoker contract changed';end if;
 if not exists(select 1 from pg_proc where oid='slm_private.match_discovery_list(uuid,uuid,jsonb)'::regprocedure
  and proconfig @> array['search_path=""']) then raise exception 'Unsafe search_path';end if;
 if exists(select 1 from unnest(array['slm_matches','slm_match_entries','slm_groups','slm_group_members','slm_group_ledger']) t
  join pg_class c on c.oid=('public.'||t)::regclass where not c.relrowsecurity) then raise exception 'RLS disabled';end if;
 if to_regclass('public.slm_account_model_state') is not null then raise exception 'Unexpected Auth18';end if;
end $$;
select 'PASS discovery service-only/invoker/search_path, RLS retained, no Auth18';
rollback;

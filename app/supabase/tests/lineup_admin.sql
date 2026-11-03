do $$
declare definition text;
begin
 if not (select relrowsecurity from pg_class where oid='public.slm_match_lineups'::regclass) then raise exception 'lineup_rls_disabled';end if;
 if has_table_privilege('authenticated','public.slm_match_lineups','UPDATE') or has_table_privilege('anon','public.slm_match_lineups','SELECT') then raise exception 'lineup_acl_open';end if;
 if has_function_privilege('authenticated','public.slm_lineups_dispatch(uuid,uuid,text,jsonb)','EXECUTE') then raise exception 'lineup_rpc_open';end if;
 if (select prosecdef from pg_proc where oid='public.slm_lineups_dispatch(uuid,uuid,text,jsonb)'::regprocedure) then raise exception 'lineup_definer';end if;
 select pg_get_functiondef('public.slm_lineups_dispatch(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 if position('admin_id=p_user' in definition)=0 or position('expected_roster_version' in definition)=0 or position('lineup_version_conflict' in definition)=0 then raise exception 'lineup_admin_cas_missing';end if;
end $$;

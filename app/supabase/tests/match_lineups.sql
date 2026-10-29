-- SQL/ACL contract, only isolated local test databases. No persistent changes.
begin;
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.slm_match_lineups'::regclass) then raise exception 'Lineup RLS disabled';end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='slm_match_lineups') then raise exception 'Unexpected client lineup policy';end if;
 if has_table_privilege('authenticated','public.slm_match_lineups','SELECT,INSERT,UPDATE,DELETE')
  or has_table_privilege('anon','public.slm_match_lineups','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Client table privilege';end if;
 if has_function_privilege('authenticated','public.slm_lineups_dispatch(uuid,uuid,text,jsonb)','execute')
  or has_function_privilege('anon','public.slm_lineups_dispatch(uuid,uuid,text,jsonb)','execute')
  or has_function_privilege('authenticated','slm_private.lineup_state(uuid)','execute')
  or has_function_privilege('authenticated','slm_private.lineup_present(jsonb,uuid)','execute') then raise exception 'Client RPC privilege';end if;
 if exists(select 1 from pg_proc where oid in ('public.slm_lineups_dispatch(uuid,uuid,text,jsonb)'::regprocedure,
  'slm_private.lineup_state(uuid)'::regprocedure,'slm_private.lineup_present(jsonb,uuid)'::regprocedure) and (prosecdef or not proconfig@>array['search_path=""'])) then raise exception 'Unsafe function context';end if;
 if to_regclass('public.slm_account_model_state') is not null then raise exception 'Auth18 present';end if;
end $$;
rollback;

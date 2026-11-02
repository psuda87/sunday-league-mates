-- Schema/security contract only; no account, membership or match mutation.
do $$
begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='slm_matches' and column_name='minimum_players' and is_nullable='NO' and column_default='10') then raise exception 'minimum_schema_invalid';end if;
 if not exists(select 1 from pg_constraint where conrelid='public.slm_matches'::regclass and conname='slm_matches_minimum_players_check') then raise exception 'minimum_constraint_missing';end if;
 if exists(select 1 from pg_class where oid in ('public.slm_matches'::regclass,'public.slm_match_entries'::regclass,'public.slm_aliases'::regclass,'public.slm_player_profiles'::regclass) and not relrowsecurity) then raise exception 'rls_disabled';end if;
 if has_table_privilege('authenticated','public.slm_matches','INSERT') or has_table_privilege('authenticated','public.slm_matches','UPDATE') or has_table_privilege('anon','public.slm_matches','SELECT') then raise exception 'match_acl_expanded';end if;
 if has_function_privilege('authenticated','public.slm_email_profile_save(uuid,uuid,text,text,integer)','EXECUTE') or has_function_privilege('anon','public.slm_account_finish(uuid,uuid,uuid,text,text,uuid)','EXECUTE') then raise exception 'phone_rpc_exposed';end if;
 if (select count(*) from pg_trigger where tgname in ('alias_contact_unique','profile_contact_unique') and not tgisinternal)<>2 then raise exception 'cross_model_uniqueness_missing';end if;
end $$;

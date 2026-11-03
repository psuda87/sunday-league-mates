-- Security/ACL regression, run only on the isolated behavior-review database.
begin;
do $$ begin
 if exists(select 1 from unnest(array['slm_matches','slm_match_entries','slm_group_ledger','slm_group_payments']) t
  join pg_class c on c.oid=('public.'||t)::regclass where not c.relrowsecurity) then raise exception 'RLS disabled';end if;
 if has_function_privilege('anon','public.slm_matches_dispatch(uuid,uuid,text,jsonb)','execute')
  or has_function_privilege('authenticated','public.slm_matches_dispatch(uuid,uuid,text,jsonb)','execute') then raise exception 'Direct dispatcher exposed';end if;
 if has_function_privilege('anon','slm_private.match_feed_visible(uuid,uuid)','execute')
  or has_function_privilege('authenticated','slm_private.match_feed_visible(uuid,uuid)','execute') then raise exception 'Helper exposed';end if;
 if has_table_privilege('authenticated','public.slm_matches','insert')
  or has_table_privilege('authenticated','public.slm_group_members','update') then raise exception 'Role bypass granted';end if;
 if (select prosecdef from pg_proc where oid='public.slm_matches_dispatch(uuid,uuid,text,jsonb)'::regprocedure)
  or (select prosecdef from pg_proc where oid='slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure) then raise exception 'Dispatcher privilege escalated';end if;
 if to_regclass('public.slm_account_model_state') is not null then raise exception 'New Auth unexpectedly active';end if;
end $$;
select 'PASS RLS, service-only dispatcher/helper, no direct writes/role escalation, invoker dispatch, inactive Auth';
rollback;

-- Opcjonalna funkcja środowiska zarządzanego, nie jest zależnością SLM.
-- Zachowaj trigger/funkcję, jeśli istnieją; lokalna baza nie musi ich zawierać.
do $$
begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  execute 'revoke execute on function public.rls_auto_enable() from public,anon,authenticated';
 end if;
end $$;

create index slm_account_rate_limits_bucket_idx on public.slm_account_rate_limits(bucket);

-- Wyłącznie narzędzie właściciela; brak endpointu publicznego/administratora aplikacji.
-- 10 min przekracza maksymalny czas wykonania Edge Function w Free (150 s).
create function public.slm_account_prepare_recovery(p_user uuid,p_expected_operation uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare s public.slm_account_security; op uuid := gen_random_uuid();
begin
 select * into s from public.slm_account_security where user_id=p_user for update;
 if not found or s.operation_id is distinct from p_expected_operation or s.operation_id is null
 or s.operation_started_at > now()-interval '10 minutes' then raise exception 'recovery_not_allowed'; end if;
 update public.slm_account_security set must_change_password=true,security_version=security_version+1,
 operation_id=op,operation_kind='reset',operation_started_at=now() where user_id=p_user;
 delete from public.slm_account_sessions where user_id=p_user;
 return op;
end $$;
revoke all on function public.slm_account_prepare_recovery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.slm_account_prepare_recovery(uuid,uuid) to service_role;

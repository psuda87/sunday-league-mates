-- Odzwierciedla migrację zastosowaną na Cloud (wersja 20261117065016, poza repozytorium).
-- service_role nie ma SELECT na auth.users: kontrola istnienia konta przez public.slm_account_security.
begin;
do $$
declare d text; f regprocedure;
begin
 foreach f in array array['slm_private.badges_settle()'::regprocedure,'public.slm_badges_dispatch(uuid,uuid,text,jsonb)'::regprocedure] loop
  d:=pg_get_functiondef(f);
  d:=replace(d,'auth.users au where au.id=','public.slm_account_security au where au.user_id=');
  if d like '%auth.users%' then raise exception 'auth.users still referenced in %',f; end if;
  execute d;
 end loop;
end $$;
commit;

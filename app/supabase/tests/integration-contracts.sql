-- PRZYGOTOWANE, NIEURUCHOMIONE. Tylko izolowana lokalna baza; bez JWT/wyścigów.
begin;
do $$
declare signature text; before_state jsonb;
begin
 foreach signature in array array[
  'public.slm_events_dispatch(uuid,uuid,text,jsonb)',
  'public.slm_settlements_dispatch(uuid,uuid,text,jsonb)',
  'slm_private.events_dispatch_core(uuid,uuid,text,jsonb)',
  'slm_private.settlements_dispatch_core(uuid,uuid,text,jsonb)'
 ] loop
  if to_regprocedure(signature) is null then raise exception 'Brak funkcji %',signature; end if;
  if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE') then
   raise exception 'Publiczny dostęp do %',signature; end if;
  if not has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'Brak grantu service_role %',signature; end if;
 end loop;
 if position('finance_notification_changes' in pg_get_functiondef('public.slm_events_dispatch(uuid,uuid,text,jsonb)'::regprocedure))=0
  or position('finance_notification_changes' in pg_get_functiondef('public.slm_settlements_dispatch(uuid,uuid,text,jsonb)'::regprocedure))=0 then
  raise exception 'Brak adaptera w wrapperach'; end if;
 before_state:=slm_private.finance_notification_snapshot();
 if before_state is null then raise exception 'Brak snapshotu finansowego'; end if;
 raise notice 'Kontrakty integracji sprawdzone; scenariusze transakcyjne wymagają osobnego wykonania';
end $$;
rollback;

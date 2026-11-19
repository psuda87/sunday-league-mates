-- Fix: badges_debut() must not read auth.users as SECURITY INVOKER.
-- Use the application's account registry instead, without elevating privileges.
DO $fix$
DECLARE
  definition text;
  needle text := 'exists(select 1 from auth.users au where au.id=p.member_id)';
  replacement text := 'exists(select 1 from public.slm_account_security au where au.user_id=p.member_id)';
BEGIN
  definition := pg_get_functiondef('slm_private.badges_debut()'::regprocedure);
  IF (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 THEN
    -- Already applied on production: accept the exact expected patched form.
    IF position(replacement IN definition) > 0 AND position(needle IN definition) = 0 THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'badges_debut_contract_changed';
  END IF;
  EXECUTE replace(definition,needle,replacement);
END $fix$;

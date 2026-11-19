-- Zaległości sprawdzamy przy zdarzeniach finansowych, a nie co minutę.
-- Zapis na mecz jest blokowany przez registration_allowed (bez zmian). Tu: po zatwierdzeniu
-- rozliczenia, korekcie lub zaksięgowaniu wpłaty wypisujemy z przyszłych płatnych meczów
-- tych, którzy właśnie przekroczyli limit zaległości.
do $m$
declare d text; r text;
begin
  d:=pg_get_functiondef('public.slm_notifications_prepare()'::regprocedure);
  r:=replace(d,E'n:=n+slm_private.debt_enforce_registrations();','');
  if r=d then raise exception 'prepare patch: pattern not found';end if;
  execute r;

  if to_regprocedure('public.slm_settlements_dispatch_base(uuid,uuid,text,jsonb)') is null then
    alter function public.slm_settlements_dispatch(uuid,uuid,text,jsonb) rename to slm_settlements_dispatch_base;
  end if;
  if to_regprocedure('public.slm_group_finance_dispatch_base(uuid,uuid,text,jsonb)') is null then
    alter function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) rename to slm_group_finance_dispatch_base;
  end if;
end $m$;

create or replace function public.slm_settlements_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb)
returns jsonb language plpgsql set search_path='' as $f$
declare v jsonb;
begin
 v:=public.slm_settlements_dispatch_base(p_user,p_session,p_action,p_body);
 if p_action not in ('account','pending','detail','resolve_request') then
  begin perform slm_private.debt_enforce_registrations();
  exception when others then null; end;
 end if;
 return v;
end $f$;

create or replace function public.slm_group_finance_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb)
returns jsonb language plpgsql set search_path='' as $f$
declare v jsonb;
begin
 v:=public.slm_group_finance_dispatch_base(p_user,p_session,p_action,p_body);
 if p_action in ('accept_payment','correct_payment') then
  begin perform slm_private.debt_enforce_registrations();
  exception when others then null; end;
 end if;
 return v;
end $f$;

revoke all on function public.slm_settlements_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_settlements_dispatch(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) to service_role;

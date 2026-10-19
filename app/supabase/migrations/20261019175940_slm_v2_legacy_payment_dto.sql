-- Expose historical liability source without changing its amount or policy.
alter function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) set schema slm_private;
alter function slm_private.slm_group_finance_dispatch(uuid,uuid,text,jsonb) rename to group_finance_dispatch_core;
create function public.slm_group_finance_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;dues jsonb;
begin
 result:=slm_private.group_finance_dispatch_core(p_user,p_session,p_action,p_body);
 if p_action='account' then
  select coalesce(jsonb_agg(d||jsonb_build_object('legacy',exists(select 1 from public.slm_events where id=(d->>'event_id')::uuid)) order by d->>'starts_at',d->>'event_id'),'[]')
  into dues from jsonb_array_elements(result->'dues')d;
  result:=jsonb_set(result,'{dues}',dues);
 end if;return result;
end $$;
revoke all on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) to service_role;

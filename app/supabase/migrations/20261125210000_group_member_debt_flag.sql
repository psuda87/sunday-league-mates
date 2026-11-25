-- Wskaźnik zaległości na liście członków grupy (decyzja właściciela 2026-11-25).
-- Liczymy nieopłacone mecze członka w TEJ grupie (group_dues, ta sama logika co blokada zapisów).
-- 1–2 zaległe mecze widzi wyłącznie administrator grupy (główny lub współadministrator);
-- od 3 zaległych meczów wskaźnik widzą wszyscy członkowie. Kwoty nie są ujawniane, tylko liczba meczów.
do $m$
begin
  if to_regprocedure('slm_private.groups_dispatch_debt_base(uuid,uuid,text,jsonb)') is null then
    alter function public.slm_groups_dispatch(uuid,uuid,text,jsonb) rename to groups_dispatch_debt_base;
    alter function public.groups_dispatch_debt_base(uuid,uuid,text,jsonb) set schema slm_private;
  end if;
end $m$;
revoke all on function slm_private.groups_dispatch_debt_base(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function slm_private.groups_dispatch_debt_base(uuid,uuid,text,jsonb) to service_role;

create or replace function public.slm_groups_dispatch(p_user uuid, p_session uuid, p_action text, p_body jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path='' as $f$
declare v jsonb; gid uuid; viewer_admin boolean; members jsonb;
begin
 v:=slm_private.groups_dispatch_debt_base(p_user,p_session,p_action,p_body);
 if p_action<>'detail' or jsonb_typeof(v->'members')<>'array' then return v; end if;
 begin
  gid:=coalesce(nullif(v#>>'{group,id}',''),nullif(p_body->>'group_id',''))::uuid;
  viewer_admin:=slm_private.group_admin(gid,p_user);
  select coalesce(jsonb_agg(case when x.n>=3 or (viewer_admin and x.n>=1) then x.m||jsonb_build_object('overdue_matches',x.n) else x.m end order by x.ord),'[]'::jsonb)
   into members
   from (select e.m,e.ord,(select count(distinct d.event_id)::int from slm_private.group_dues((e.m->>'user_id')::uuid) d
          where d.group_id=gid and d.outstanding_cents>0) n
         from jsonb_array_elements(v->'members') with ordinality e(m,ord)) x;
  return jsonb_set(v,'{members}',members);
 exception when others then
  -- Wskaźnik jest dodatkiem: błąd nie może zablokować widoku grupy.
  return v;
 end;
end $f$;
revoke all on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) to service_role;

-- Współadministratorzy grupy (decyzja właściciela 2026-11-16).
-- slm_groups.admin_id pozostaje administratorem głównym. Członek z flagą admin ma te same
-- uprawnienia administracyjne (zgłoszenia, zaproszenia, nazwa, uprawnienia organizatora, usuwanie
-- zwykłych członków, finanse grupy, składy), ale WYŁĄCZNIE administrator główny może:
-- nadawać/odbierać uprawnienia administratora, przekazać rolę głównego i usuwać/zmieniać innych administratorów.
-- Gdy administrator główny odchodzi, rolę przejmuje najstarszy współadministrator.
begin;

alter table public.slm_group_members add column if not exists admin boolean not null default false;

-- Jedno źródło prawdy: wszystkie dotychczasowe wywołania group_admin (oraz finanse przez
-- group_finance_admin i RLS przez own_finance_scope) obejmują teraz współadministratorów.
create or replace function slm_private.group_admin(p_group uuid, p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.slm_groups g where g.id=p_group and not g.archived
  and (g.admin_id=p_user or exists(select 1 from public.slm_group_members m where m.group_id=g.id and m.user_id=p_user and m.admin)))
 and slm_private.group_member(p_group,p_user);
$$;
revoke all on function slm_private.group_admin(uuid,uuid) from public,anon,authenticated;

create or replace function slm_private.group_owner(p_group uuid, p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.slm_groups where id=p_group and admin_id=p_user and not archived)
 and slm_private.group_member(p_group,p_user);
$$;
revoke all on function slm_private.group_owner(uuid,uuid) from public,anon,authenticated;
grant execute on function slm_private.group_owner(uuid,uuid) to service_role;

-- Dokładne podmiany w istniejących funkcjach (bez przepisywania ich treści ręcznie).
create function slm_private.coadmin_patch(p_sig text, p_find text, p_repl text, p_expected int) returns void
language plpgsql set search_path='' as $$
declare d text; n int;
begin
 d:=pg_get_functiondef(p_sig::regprocedure);
 n:=(length(d)-length(replace(d,p_find,'')))/length(p_find);
 if n<>p_expected then raise exception 'coadmin patch %: expected % occurrence(s) of [%], found %',p_sig,p_expected,p_find,n;end if;
 execute replace(d,p_find,p_repl);
end $$;

select slm_private.coadmin_patch('slm_private.shared_profile(uuid)','g.admin_id=auth.uid()','slm_private.group_admin(g.id,auth.uid())',2);
select slm_private.coadmin_patch('slm_private.groups_dispatch_b3_projection(uuid,uuid,text,jsonb)','a.admin_id=p_user','slm_private.group_admin(a.id,p_user)',1);
select slm_private.coadmin_patch('slm_private.groups_dispatch_b3_projection(uuid,uuid,text,jsonb)','g.admin_id=p_user','slm_private.group_admin(g.id,p_user)',1);
select slm_private.coadmin_patch('slm_private.groups_dispatch_b3_projection(uuid,uuid,text,jsonb)','select a.*,m.organizer,(','select a.*,m.organizer,m.admin,(',1);
select slm_private.coadmin_patch('slm_private.lineup_present(jsonb,uuid)','g.admin_id=p_viewer','slm_private.group_admin(g.id,p_viewer)',1);
select slm_private.coadmin_patch('public.slm_lineups_dispatch(uuid,uuid,text,jsonb)',
 'select 1 from public.slm_groups where id=e.group_id and admin_id=p_user and not archived','select 1 where slm_private.group_admin(e.group_id,p_user)',1);
select slm_private.coadmin_patch('slm_private.group_profile(uuid,uuid,uuid)',$f$'organizer',m.organizer,$f$,
 $f$'organizer',m.organizer,'admin',(m.admin or exists(select 1 from public.slm_groups og where og.id=p_group and og.admin_id=m.user_id)),'owner',exists(select 1 from public.slm_groups og where og.id=p_group and og.admin_id=m.user_id),$f$,1);
-- Następca odchodzącego administratora głównego: najpierw współadministratorzy.
select slm_private.coadmin_patch('slm_private.groups_dispatch_b3_base(uuid,uuid,text,jsonb)',
 'order by organizer desc,sequence,user_id limit 1','order by admin desc,organizer desc,sequence,user_id limit 1',1);
-- Dotychczasowy dispatcher staje się bazą nowej warstwy.
select slm_private.coadmin_patch('public.slm_groups_dispatch(uuid,uuid,text,jsonb)',
 'FUNCTION public.slm_groups_dispatch(','FUNCTION slm_private.groups_dispatch_coadmin_base(',1);
drop function slm_private.coadmin_patch(text,text,text,int);
revoke all on function slm_private.groups_dispatch_coadmin_base(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function slm_private.groups_dispatch_coadmin_base(uuid,uuid,text,jsonb) to service_role;

create or replace function public.slm_groups_dispatch(p_user uuid, p_session uuid, p_action text, p_body jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare g public.slm_groups; q public.slm_v2_requests; v_request uuid; v_target uuid; v_target_admin boolean; v_response jsonb; v_group uuid;
begin
 if p_action not in ('admin_grant','admin_revoke','transfer','remove','permission','leave') then
  return slm_private.groups_dispatch_coadmin_base(p_user,p_session,p_action,p_body);
 end if;
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 v_request:=nullif(p_body->>'request_id','')::uuid;
 -- Powtórzenie zakończonej operacji zwraca zapisaną odpowiedź, zanim zmienione role ją zablokują.
 if v_request is not null and exists(select 1 from public.slm_v2_requests where actor_id=p_user and request_id=v_request) then
  if p_action in ('admin_grant','admin_revoke') then
   select * into q from public.slm_v2_requests where actor_id=p_user and request_id=v_request;
   if q.action<>p_action or q.body<>p_body then raise exception 'idempotency_conflict';end if;
   return q.response;
  end if;
  return slm_private.groups_dispatch_coadmin_base(p_user,p_session,p_action,p_body);
 end if;
 v_group:=nullif(p_body->>'group_id','')::uuid;
 select * into g from public.slm_groups where id=v_group and not archived for update;
 if not found then raise exception 'not_found';end if;
 v_target:=nullif(p_body->>'user_id','')::uuid;
 if p_action in ('admin_grant','admin_revoke') then
  if v_request is null then raise exception 'request_required';end if;
  if g.admin_id<>p_user or not slm_private.group_member(g.id,p_user) then raise exception 'forbidden';end if;
  if v_target is null or v_target=g.admin_id or not slm_private.group_member(g.id,v_target) then raise exception 'forbidden';end if;
  update public.slm_group_members set admin=(p_action='admin_grant') where group_id=g.id and user_id=v_target;
  update public.slm_groups set version=version+1 where id=g.id;
  v_response:=jsonb_build_object('group_id',g.id,'ok',true);
  insert into public.slm_group_audit(group_id,actor_id,action,snapshot) values(g.id,p_user,p_action,jsonb_build_object('target_id',v_target,'request_id',v_request));
  insert into public.slm_v2_requests values(p_user,v_request,p_action,p_body,v_response,clock_timestamp());
  return v_response;
 end if;
 if p_action='transfer' and g.admin_id<>p_user then raise exception 'forbidden';end if;
 if p_action in ('remove','permission') and v_target is not null and g.admin_id<>p_user then
  select m.admin into v_target_admin from public.slm_group_members m where m.group_id=g.id and m.user_id=v_target;
  if coalesce(v_target_admin,false) then raise exception 'forbidden';end if;
 end if;
 v_response:=slm_private.groups_dispatch_coadmin_base(p_user,p_session,p_action,p_body);
 -- Nowy administrator główny nie jest jednocześnie oznaczony jako współadministrator.
 update public.slm_group_members m set admin=false from public.slm_groups gg
  where gg.id=g.id and m.group_id=gg.id and m.user_id=gg.admin_id and m.admin;
 return v_response;
end $$;

commit;

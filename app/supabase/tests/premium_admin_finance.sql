-- Run only in slm-premium-behavior-review after authority HTTP fixtures.
-- All temporary legacy mapping/global-role changes roll back.
begin;
do $$
declare g uuid;current_admin uuid;former_admin uuid;
begin
 select id,admin_id into g,current_admin from public.slm_groups where name like 'Admin authority A %' order by created_at desc limit 1;
 if g is null then raise exception 'Missing owned authority fixture';end if;
 select created_by into former_admin from public.slm_matches where group_id=g and name like 'Former-admin-created %' limit 1;
 if former_admin is null or former_admin=current_admin then raise exception 'Role transfer fixture required';end if;
 if not slm_private.group_finance_admin(g,current_admin) or slm_private.group_finance_admin(g,former_admin) then raise exception 'Admin-only rule failed';end if;
 if exists(select 1 from public.slm_legacy_scope) then raise exception 'Isolated fixture requires no existing legacy mapping';end if;
 insert into public.slm_legacy_scope(group_id) values(g);
 update public.slm_roles set role='admin' where user_id=former_admin;
 if not slm_private.legacy_finance_manager(current_admin) then raise exception 'Mapped current admin must retain legacy finance';end if;
 if slm_private.legacy_finance_manager(former_admin) then raise exception 'Global role or creator must not grant legacy finance';end if;
 if has_function_privilege('authenticated','public.slm_settlements_dispatch(uuid,uuid,text,jsonb)','execute') then raise exception 'Legacy dispatcher exposed';end if;
 if has_function_privilege('authenticated','slm_private.match_finance(uuid,uuid)','execute') or has_function_privilege('anon','slm_private.own_finance_scope(uuid,uuid)','execute') then raise exception 'Privilege helper exposed';end if;
end $$;
select 'PASS current-role authority, mapped legacy admin, former/global admin denial and restricted legacy/helper grants';
rollback;

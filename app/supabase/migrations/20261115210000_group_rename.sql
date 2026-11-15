-- Group admin renames the group (owner request 2026-11-15, MASTER TODO #4).
-- Only the name changes: id, members, matches, finances and history stay as they are.
-- Same wrapping pattern as 20261026120000_premium_profile_name: the current dispatcher becomes a private base.
begin;
alter function public.slm_groups_dispatch(uuid,uuid,text,jsonb) rename to groups_dispatch_rename_base;
alter function public.groups_dispatch_rename_base(uuid,uuid,text,jsonb) set schema slm_private;
revoke all on function slm_private.groups_dispatch_rename_base(uuid,uuid,text,jsonb) from public,anon,authenticated;
create function public.slm_groups_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g public.slm_groups; v_name text; v_group text;
begin
 if p_action is distinct from 'rename' then return slm_private.groups_dispatch_rename_base(p_user,p_session,p_action,p_body);end if;
 perform pg_advisory_xact_lock(20261014,1);
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 v_group:=p_body->>'group_id';
 if v_group is null or v_group !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid_input';end if;
 -- Same limit as group creation.
 v_name:=btrim(coalesce(p_body->>'name',''));
 if length(v_name) not between 1 and 64 then raise exception 'invalid_group';end if;
 select * into g from public.slm_groups where id=v_group::uuid and not archived for update;
 if not found then raise exception 'not_found';end if;
 if not slm_private.group_admin(g.id,p_user) then raise exception 'forbidden';end if;
 if g.name is distinct from v_name then update public.slm_groups set name=v_name,version=version+1 where id=g.id;end if;
 return jsonb_build_object('group_id',g.id,'ok',true,'name',v_name);
end $$;
revoke all on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) to service_role;
commit;

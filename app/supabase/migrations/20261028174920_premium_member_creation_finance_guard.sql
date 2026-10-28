-- Creating a match must not confer finance privileges on an ordinary member.
-- Preserve existing admin/appointed-organizer privileges; no group role mutation.
create or replace function slm_private.match_finance(p_event uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.slm_matches e where e.id=p_event and
 (slm_private.group_admin(e.group_id,p_user) or (e.created_by=p_user and slm_private.group_organizer(e.group_id,p_user))));
$$;

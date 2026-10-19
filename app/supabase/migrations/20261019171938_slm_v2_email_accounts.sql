-- Only a confirmed Supabase Auth identity can acquire a player profile.
-- This function cannot confirm email, set passwords, grant administrator, or join groups.
create function public.slm_email_identity(p_email text default null,p_user uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u auth.users; a public.slm_aliases;
begin
 if p_user is not null then select * into u from auth.users where id=p_user;
 else select * into u from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;end if;
 if u.id is null or u.email_confirmed_at is null or u.deleted_at is not null then return null;end if;
 select * into a from public.slm_aliases where user_id=u.id;
 if a.user_id is not null then return jsonb_build_object('user_id',u.id,'technical_email',a.technical_email,'login',a.login,'phone',a.phone,'email_account',false);end if;
 perform pg_advisory_xact_lock(hashtextextended(u.id::text,20261019));
 insert into public.slm_profiles(user_id) values(u.id) on conflict do nothing;
 insert into public.slm_roles(user_id,role) values(u.id,'member') on conflict do nothing;
 insert into public.slm_account_security(user_id,must_change_password) values(u.id,false) on conflict do nothing;
 insert into public.slm_player_profiles(user_id,nickname,email_account) values(u.id,'Zawodnik',true) on conflict do nothing;
 return (select jsonb_build_object('user_id',u.id,'technical_email',u.email,'login',p.nickname,'phone',coalesce(p.contact_phone,''),'email_account',true)
 from public.slm_player_profiles p where p.user_id=u.id);
end $$;
revoke all on function public.slm_email_identity(text,uuid) from public,anon,authenticated;
grant execute on function public.slm_email_identity(text,uuid) to service_role;

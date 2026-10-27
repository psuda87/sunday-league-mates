-- Read-only Auth projection. Never provision/activate an existing account in preflight.
begin;
create function slm_private.identity_auth(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('technical_email',u.email,'confirmed',u.email_confirmed_at is not null and u.deleted_at is null)
 from auth.users u where u.id=p_user;
$$;
revoke all on function slm_private.identity_auth(uuid) from public,anon,authenticated;
grant execute on function slm_private.identity_auth(uuid) to service_role;
create or replace function public.slm_identity_prepare() returns integer
language plpgsql security invoker set search_path='' as $$
declare p record; i jsonb; legacy_email text; total integer:=0;
begin
 perform pg_advisory_xact_lock(20261014,1);
 lock table public.slm_player_profiles in share row exclusive mode;
 if exists(select 1 from public.slm_profiles a left join public.slm_player_profiles n using(user_id) where n.user_id is null)
 or exists(select 1 from public.slm_profiles p left join public.slm_roles r using(user_id) left join public.slm_account_security s using(user_id) where r.user_id is null or s.user_id is null)
 or exists(select 1 from public.slm_account_security where operation_id is not null) then raise exception 'identity_preflight_required';end if;
 for p in select * from public.slm_player_profiles order by user_id loop
  i:=slm_private.identity_auth(p.user_id);
  select technical_email into legacy_email from public.slm_aliases where user_id=p.user_id;
  if i is null or not (i->>'confirmed')::boolean or
    (p.email_account and legacy_email is not null) or
    (not p.email_account and legacy_email is distinct from i->>'technical_email') then raise exception 'identity_preflight_required';end if;
  if exists(select 1 from public.slm_identity_registry r where r.user_id=p.user_id and
    (r.nickname_key<>slm_private.identity_key(p.nickname) or r.auth_email<>i->>'technical_email')) then raise exception 'identity_preflight_required';end if;
  insert into public.slm_identity_registry(user_id,nickname_key,auth_email,email_login)
   values(p.user_id,slm_private.identity_key(p.nickname),i->>'technical_email',case when p.email_account then lower(i->>'technical_email') end)
   on conflict(user_id) do nothing;
  total:=total+1;
 end loop;
 return total;
end $$;
commit;

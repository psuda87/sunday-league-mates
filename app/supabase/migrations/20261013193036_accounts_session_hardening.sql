-- Wąski helper zamiast przyznawania service_role SELECT całego auth.sessions.
create function slm_private.auth_session_exists(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions where id=p_session and user_id=p_user);
$$;
revoke all on function slm_private.auth_session_exists(uuid,uuid) from public,anon,authenticated;
grant execute on function slm_private.auth_session_exists(uuid,uuid) to service_role;

create or replace function public.slm_account_accept_session(p_user uuid,p_session uuid,p_version bigint)
returns boolean language plpgsql security invoker set search_path='' as $$
declare s public.slm_account_security;
begin
 select * into s from public.slm_account_security where user_id=p_user for update;
 if not found or not s.active or s.operation_id is not null or s.security_version<>p_version then return false; end if;
 if not slm_private.auth_session_exists(p_user,p_session) then return false; end if;
 insert into public.slm_account_sessions(session_id,user_id,security_version)
 values(p_session,p_user,p_version) on conflict(session_id) do update set security_version=excluded.security_version;
 return true;
end $$;

create or replace function public.slm_account_finish(p_user uuid,p_operation uuid,p_session uuid default null,
 p_login text default null,p_phone text default null,p_actor uuid default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare s public.slm_account_security;
begin
 select * into s from public.slm_account_security where user_id=p_user for update;
 if not found or s.operation_id is distinct from p_operation then return false; end if;
 -- Weryfikacja przed zmianą aliasów: odmowa nie może częściowo zmieniać danych.
 if s.operation_kind<>'reset' and not slm_private.auth_session_exists(p_user,p_session) then return false; end if;
 if s.operation_kind='identifiers' then
  update public.slm_aliases set login=p_login,login_normalized=lower(p_login),phone=p_phone where user_id=p_user;
 end if;
 insert into public.slm_account_audit(actor_id,target_id,action) values(p_actor,p_user,s.operation_kind);
 update public.slm_account_security set operation_id=null,operation_kind=null,operation_started_at=null,
 must_change_password=(s.operation_kind='reset') where user_id=p_user;
 if s.operation_kind<>'reset' then
  insert into public.slm_account_sessions(session_id,user_id,security_version) values(p_session,p_user,s.security_version);
 end if;
 return true;
end $$;

create or replace function public.slm_account_provision(p_user uuid,p_login text,p_phone text,p_email text,
 p_actor uuid default null,p_actor_session uuid default null,p_admin boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_actor is not null and (not slm_private.session_valid(p_actor,p_actor_session,false)
 or not exists(select 1 from public.slm_roles where user_id=p_actor and role='admin')) then raise exception 'forbidden'; end if;
 if p_admin then
  if p_actor is not null then raise exception 'bootstrap_only'; end if;
  perform pg_advisory_xact_lock(87327491);
  if exists(select 1 from public.slm_roles where role='admin') then raise exception 'admin_exists'; end if;
 end if;
 insert into public.slm_aliases values(p_user,p_login,lower(p_login),p_phone,p_email);
 insert into public.slm_profiles(user_id) values(p_user);
 insert into public.slm_roles values(p_user,case when p_admin then 'admin' else 'member' end);
 insert into public.slm_account_security(user_id) values(p_user);
 insert into public.slm_account_audit(actor_id,target_id,action) values(p_actor,p_user,'create');
end $$;

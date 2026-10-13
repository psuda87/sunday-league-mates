-- Moduł kont; nie przechowuje haseł ani ich skrótów.
create schema slm_private;
revoke all on schema slm_private from public, anon, authenticated;
grant usage on schema slm_private to authenticated;

create table public.slm_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '' check (length(full_name) <= 100),
 display_as text not null default 'nickname' check (display_as in ('nickname','full_name'))
);
create table public.slm_aliases (
 user_id uuid primary key references auth.users(id) on delete cascade,
 login text not null check (length(login) between 3 and 32),
 login_normalized text not null unique check (login_normalized = lower(login)),
 phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
 technical_email text not null unique
);
create table public.slm_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('member','admin'))
);
create table public.slm_account_security (
 user_id uuid primary key references auth.users(id) on delete cascade,
 must_change_password boolean not null default true,
 security_version bigint not null default 1,
 active boolean not null default true,
 operation_id uuid, operation_kind text, operation_started_at timestamptz
);
create table public.slm_account_sessions (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 security_version bigint not null,
 created_at timestamptz not null default now()
);
create index on public.slm_account_sessions(user_id);
create table public.slm_account_audit (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 target_id uuid references auth.users(id) on delete set null,
 action text not null check (action in ('create','reset','password','identifiers','profile','logout')),
 created_at timestamptz not null default now()
);
create table public.slm_account_rate_limits (
 key text primary key, bucket timestamptz not null, attempts integer not null
);
do $$
declare t text;
begin
 foreach t in array array['slm_profiles','slm_aliases','slm_roles','slm_account_security',
 'slm_account_sessions','slm_account_audit','slm_account_rate_limits'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage, select on sequence public.slm_account_audit_id_seq to service_role;

create function slm_private.session_valid(p_user uuid, p_session uuid, p_allow_temporary boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
 select 1 from public.slm_account_security s
 join public.slm_account_sessions a on a.user_id=s.user_id and a.security_version=s.security_version
 join auth.sessions live on live.id=a.session_id and live.user_id=s.user_id
 join public.slm_roles r on r.user_id=s.user_id
 where s.user_id=p_user and a.session_id=p_session and s.active and s.operation_id is null
 and (p_allow_temporary or not s.must_change_password));
$$;
revoke all on function slm_private.session_valid(uuid,uuid,boolean) from public,anon,authenticated;
-- Tylko wrapper własnej sesji jest dostępny dla authenticated.
create function slm_private.current_session_valid() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and slm_private.session_valid(auth.uid(), (auth.jwt()->>'session_id')::uuid, false);
$$;
revoke all on function slm_private.current_session_valid() from public,anon;
grant execute on function slm_private.current_session_valid() to authenticated;
grant select on public.slm_profiles to authenticated;
create policy members_read_profiles on public.slm_profiles for select to authenticated
 using ((select slm_private.current_session_valid()));

create function public.slm_account_context(p_user uuid,p_session uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('user_id',s.user_id,'role',r.role,'must_change_password',s.must_change_password,
 'security_version',s.security_version)
 from public.slm_account_security s join public.slm_roles r using(user_id)
 where s.user_id=p_user and slm_private.session_valid(p_user,p_session,true);
$$;

create function public.slm_account_accept_session(p_user uuid,p_session uuid,p_version bigint)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare s public.slm_account_security;
begin
 select * into s from public.slm_account_security where user_id=p_user for update;
 if not found or not s.active or s.operation_id is not null or s.security_version<>p_version then return false; end if;
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then return false; end if;
 insert into public.slm_account_sessions(session_id,user_id,security_version)
 values(p_session,p_user,p_version) on conflict(session_id) do update set security_version=excluded.security_version;
 return true;
end $$;

create function public.slm_account_provision(p_user uuid,p_login text,p_phone text,p_email text,
 p_actor uuid default null,p_actor_session uuid default null,p_admin boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
begin
 if p_actor is not null and (not slm_private.session_valid(p_actor,p_actor_session,false)
 or not exists(select 1 from public.slm_roles where user_id=p_actor and role='admin')) then
 raise exception 'forbidden'; end if;
 if p_admin and p_actor is not null then raise exception 'bootstrap_only'; end if;
 insert into public.slm_aliases values(p_user,p_login,lower(p_login),p_phone,p_email);
 insert into public.slm_profiles(user_id) values(p_user);
 insert into public.slm_roles values(p_user,case when p_admin then 'admin' else 'member' end);
 insert into public.slm_account_security(user_id) values(p_user);
 insert into public.slm_account_audit(actor_id,target_id,action) values(p_actor,p_user,'create');
end $$;

create function public.slm_account_begin(p_actor uuid,p_session uuid,p_target uuid,p_kind text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.slm_account_security; op uuid := gen_random_uuid();
begin
 if p_kind not in ('password','identifiers','reset') then raise exception 'invalid_operation'; end if;
 if not slm_private.session_valid(p_actor,p_session,p_kind='password') then raise exception 'forbidden'; end if;
 if p_kind='reset' then
  if not exists(select 1 from public.slm_roles where user_id=p_actor and role='admin') then raise exception 'forbidden'; end if;
 elsif p_actor<>p_target then raise exception 'forbidden'; end if;
 select * into s from public.slm_account_security where user_id=p_target for update;
 if not found or not s.active or s.operation_id is not null then raise exception 'operation_pending'; end if;
 -- Sprawdzenie po blokadzie chroni przed jednoczesnym resetem wykonawcy.
 if not slm_private.session_valid(p_actor,p_session,p_kind='password') then raise exception 'forbidden'; end if;
 update public.slm_account_security set operation_id=op,operation_kind=p_kind,operation_started_at=now(),
 security_version=security_version+1,
 must_change_password=case when p_kind='identifiers' then must_change_password else true end
 where user_id=p_target returning * into s;
 delete from public.slm_account_sessions where user_id=p_target;
 return jsonb_build_object('operation_id',op,'security_version',s.security_version);
end $$;

create function public.slm_account_finish(p_user uuid,p_operation uuid,p_session uuid default null,
 p_login text default null,p_phone text default null,p_actor uuid default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare s public.slm_account_security;
begin
 select * into s from public.slm_account_security where user_id=p_user for update;
 if not found or s.operation_id is distinct from p_operation then return false; end if;
 if s.operation_kind='identifiers' then
  update public.slm_aliases set login=p_login,login_normalized=lower(p_login),phone=p_phone where user_id=p_user;
 end if;
 if s.operation_kind<>'reset' and not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then return false; end if;
 insert into public.slm_account_audit(actor_id,target_id,action) values(p_actor,p_user,s.operation_kind);
 update public.slm_account_security set operation_id=null,operation_kind=null,operation_started_at=null,
 must_change_password=(s.operation_kind='reset') where user_id=p_user;
 if s.operation_kind<>'reset' then
  insert into public.slm_account_sessions(session_id,user_id,security_version) values(p_session,p_user,s.security_version);
 end if;
 return true;
end $$;

create function public.slm_account_revoke_session(p_user uuid,p_session uuid) returns void
language sql security invoker set search_path = '' as $$
 delete from public.slm_account_sessions where user_id=p_user and session_id=p_session;
$$;
create function public.slm_account_rate(p_key text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare n integer; b timestamptz;
begin
 b := to_timestamp(floor(extract(epoch from now())/p_seconds)*p_seconds);
 -- Usuwanie starych liczników ogranicza retencję i zużycie Free.
 delete from public.slm_account_rate_limits where bucket < now()-interval '1 day';
 insert into public.slm_account_rate_limits(key,bucket,attempts) values(p_key,b,1)
 on conflict(key) do update set bucket=excluded.bucket,
 attempts=case when slm_account_rate_limits.bucket=excluded.bucket then slm_account_rate_limits.attempts+1 else 1 end
 returning attempts into n;
 return n<=p_limit;
end $$;

create function public.slm_account_block_email(event jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
 select '{"error":{"http_code":403,"message":"SLM_EMAIL_DISABLED"}}'::jsonb;
$$;
create function public.slm_account_block_sms(event jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
 select '{"error":{"http_code":403,"message":"SLM_SMS_DISABLED"}}'::jsonb;
$$;
revoke all on function public.slm_account_block_email(jsonb),public.slm_account_block_sms(jsonb) from public,anon,authenticated;
grant execute on function public.slm_account_block_email(jsonb),public.slm_account_block_sms(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;

-- Uprzywilejowane RPC nie są dostępne klientowi, w tym bootstrap/provision.
do $$
declare f record;
begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace
 and proname like 'slm_account_%' and proname not in ('slm_account_block_email','slm_account_block_sms') loop
  execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  execute format('grant execute on function %s to service_role', f.signature);
 end loop;
end $$;
grant usage on schema slm_private to service_role;
grant execute on function slm_private.session_valid(uuid,uuid,boolean) to service_role;

-- Zamykanie wcześniejszej infrastruktury testowej; hooki pozostają do przełączenia konfiguracji.
drop function if exists public.slm_auth_proof_is_admin();
revoke all on public.slm_auth_proof_accounts,public.slm_auth_proof_sessions,public.slm_auth_proof_protected from authenticated,anon;
revoke all on schema slm_auth_proof_private from authenticated,anon;

-- Izolowany test Auth. Uruchamiać tylko w hjtcyybkxebvdropchac.
create schema slm_auth_proof_private;
revoke all on schema slm_auth_proof_private from public, anon, authenticated;
grant usage on schema slm_auth_proof_private to authenticated;
create table public.slm_auth_proof_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 login text unique not null, phone text unique not null, technical_email text unique not null,
 must_change_password boolean not null default true,
 security_version integer not null default 1, is_admin boolean not null default false
);
create table public.slm_auth_proof_sessions (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references public.slm_auth_proof_accounts(user_id) on delete cascade,
 security_version integer not null
);
create table public.slm_auth_proof_protected (
 user_id uuid primary key references public.slm_auth_proof_accounts(user_id) on delete cascade,
 message text not null
);
alter table public.slm_auth_proof_accounts enable row level security;
alter table public.slm_auth_proof_sessions enable row level security;
alter table public.slm_auth_proof_protected enable row level security;
revoke all on public.slm_auth_proof_accounts, public.slm_auth_proof_sessions,
 public.slm_auth_proof_protected from public, anon, authenticated;
grant all on public.slm_auth_proof_accounts, public.slm_auth_proof_sessions,
 public.slm_auth_proof_protected to service_role;
-- SELECT/UPDATE nadane celowo: RLS, a nie sam brak GRANT, musi chronić rolę.
grant select, update on public.slm_auth_proof_accounts to authenticated;
grant select, insert, update on public.slm_auth_proof_protected to authenticated;

create function slm_auth_proof_private.allowed() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from public.slm_auth_proof_accounts a
  join public.slm_auth_proof_sessions s on s.user_id = a.user_id
    and s.security_version = a.security_version
  join auth.sessions live on live.id = s.session_id and live.user_id = a.user_id
  where a.user_id = auth.uid() and not a.must_change_password
    and s.session_id::text = auth.jwt()->>'session_id'
 );
$$;
revoke all on function slm_auth_proof_private.allowed() from public, anon;
grant execute on function slm_auth_proof_private.allowed() to authenticated;
create policy owner_access on public.slm_auth_proof_protected for all to authenticated
 using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy password_gate on public.slm_auth_proof_protected as restrictive for all to authenticated
 using ((select slm_auth_proof_private.allowed()))
 with check ((select slm_auth_proof_private.allowed()));

create function slm_auth_proof_private.admin_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
 select slm_auth_proof_private.allowed() and exists(
  select 1 from public.slm_auth_proof_accounts where user_id = auth.uid() and is_admin
 );
$$;
revoke all on function slm_auth_proof_private.admin_allowed() from public, anon;
grant execute on function slm_auth_proof_private.admin_allowed() to authenticated;
create function public.slm_auth_proof_is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
 select slm_auth_proof_private.admin_allowed();
$$;
revoke all on function public.slm_auth_proof_is_admin() from public, anon;
grant execute on function public.slm_auth_proof_is_admin() to authenticated;

-- Bez zapisu payloadu: zawiera OTP i dane Auth.
create function public.slm_auth_proof_block_email(event jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
 select '{"error":{"http_code":403,"message":"SLM_AUTH_PROOF_EMAIL_DISABLED"}}'::jsonb;
$$;
create function public.slm_auth_proof_block_sms(event jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
 select '{"error":{"http_code":403,"message":"SLM_AUTH_PROOF_SMS_DISABLED"}}'::jsonb;
$$;
revoke all on function public.slm_auth_proof_block_email(jsonb),
 public.slm_auth_proof_block_sms(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.slm_auth_proof_block_email(jsonb),
 public.slm_auth_proof_block_sms(jsonb) to supabase_auth_admin;

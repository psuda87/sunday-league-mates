-- Optional aliases remain separate from Supabase Auth's internal primary address.
begin;
create table public.slm_email_links(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 kind text not null check(kind in('verify','recovery')),target_email text not null,prior_email text,
 security_version bigint not null,request_id uuid not null,token_hash text not null unique check(token_hash~'^[0-9a-f]{64}$'),
 expires_at timestamptz not null,state text not null default 'pending' check(state in('pending','consumed','cancelled')),
 delivery text not null default 'queued' check(delivery in('queued','sent','failed')),created_at timestamptz not null default clock_timestamp(),
 lease_id uuid,lease_until timestamptz,operation_id uuid,unique(user_id,kind,request_id)
);
create unique index slm_email_active_link on public.slm_email_links(user_id,kind) where state='pending';
alter table public.slm_email_links enable row level security;
revoke all on public.slm_email_links from public,anon,authenticated;
grant select,insert,update on public.slm_email_links to service_role;

create function public.slm_email_issue(p_user uuid,p_session uuid,p_kind text,p_email text,p_request uuid,p_hash text,
 p_signup uuid default null,p_signup_hash text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.slm_identity_registry;s public.slm_account_security;l public.slm_email_links;
begin
 if not public.slm_model_ready() then raise exception 'model_inactive';end if;
 perform pg_advisory_xact_lock(20261014,1);
 select * into s from public.slm_account_security where user_id=p_user for update;
 select * into r from public.slm_identity_registry where user_id=p_user;
 if s.user_id is null or not s.active or s.operation_id is not null or r.user_id is null then raise exception 'email_not_available';end if;
 if p_kind='verify' then
  if not slm_private.session_valid(p_user,p_session,false) and not exists(select 1 from public.slm_signup_jobs where request_id=p_signup and secret_hash=p_signup_hash and completed_user=p_user)
    then raise exception 'session_invalid';end if;
  if r.email_login=p_email then
   update public.slm_email_links set state='cancelled' where user_id=p_user and kind='verify' and state='pending';
   return jsonb_build_object('status','verified');end if;
  if exists(select 1 from public.slm_identity_registry where email_login=p_email and user_id<>p_user) then raise unique_violation using message='email_taken';end if;
 elsif p_kind='recovery' then
  if r.email_login is null or r.email_login<>p_email then raise exception 'email_not_available';end if;
 else raise exception 'invalid_input';end if;
 if p_email is null or p_email<>lower(btrim(p_email)) or length(p_email)>254 or p_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_email';end if;
 select * into l from public.slm_email_links where user_id=p_user and kind=p_kind and request_id=p_request;
 if found and l.target_email<>p_email then raise exception 'idempotency_conflict';end if;
 if found and l.state='consumed' then return jsonb_build_object('status','used');end if;
 if exists(select 1 from public.slm_email_links where user_id=p_user and kind=p_kind and state='pending' and delivery<>'failed' and created_at>clock_timestamp()-interval '60 seconds')
 then return jsonb_build_object('status','cooldown');end if;
 update public.slm_email_links set state='cancelled' where user_id=p_user and kind=p_kind and state='pending';
 insert into public.slm_email_links(user_id,kind,target_email,prior_email,security_version,request_id,token_hash,expires_at)
 values(p_user,p_kind,p_email,r.email_login,s.security_version,p_request,p_hash,clock_timestamp()+case when p_kind='verify' then interval '30 minutes' else interval '15 minutes' end)
 on conflict(user_id,kind,request_id) do update set token_hash=excluded.token_hash,state='pending',delivery='queued',created_at=clock_timestamp(),expires_at=excluded.expires_at,prior_email=excluded.prior_email,security_version=excluded.security_version
 returning * into l;
 return jsonb_build_object('id',l.id,'status','created');
end$$;

create function public.slm_email_delivered(p_id uuid,p_hash text,p_ok boolean) returns void language sql security invoker set search_path='' as $$
 update public.slm_email_links set delivery=case when p_ok then 'sent' else 'failed' end where id=p_id and token_hash=p_hash and state='pending';
$$;
create function public.slm_email_confirm(p_id uuid,p_hash text) returns void language plpgsql security invoker set search_path='' as $$
declare l public.slm_email_links;s public.slm_account_security;r public.slm_identity_registry;u uuid;
begin
 if not public.slm_model_ready() then raise exception 'model_inactive';end if;
 perform pg_advisory_xact_lock(20261014,1);
 select user_id into u from public.slm_email_links where id=p_id and token_hash=p_hash;
 select * into s from public.slm_account_security where user_id=u for update;
 select * into l from public.slm_email_links where id=p_id for update;
 select * into r from public.slm_identity_registry where user_id=u;
 if l.id is null or l.kind<>'verify' or l.token_hash<>p_hash then raise exception 'link_invalid';end if;
 if l.state='consumed' and r.email_login=l.target_email then return;end if;
 if l.state<>'pending' or l.expires_at<=clock_timestamp() or not s.active or s.operation_id is not null or s.security_version<>l.security_version or r.email_login is distinct from l.prior_email then raise exception 'link_invalid';end if;
 update public.slm_identity_registry set email_login=l.target_email where user_id=u;
 update public.slm_email_links set state=case when id=l.id then 'consumed' else 'cancelled' end where user_id=u and state='pending';
end$$;

-- Bounded exclusive lease handles retries across the Auth/SQL transaction boundary.
create function public.slm_email_recovery_begin(p_id uuid,p_hash text,p_lease uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare l public.slm_email_links;s public.slm_account_security;r public.slm_identity_registry;u uuid;op uuid;
begin
 if not public.slm_model_ready() then raise exception 'model_inactive';end if;
 perform pg_advisory_xact_lock(20261014,1);
 select user_id into u from public.slm_email_links where id=p_id and token_hash=p_hash;
 select * into s from public.slm_account_security where user_id=u for update;
 select * into l from public.slm_email_links where id=p_id for update;
 select * into r from public.slm_identity_registry where user_id=u;
 if u is null or p_lease is null or l.token_hash<>p_hash or l.id is null or l.kind<>'recovery' or l.state<>'pending' or l.expires_at<=clock_timestamp() or not s.active or r.email_login is null or r.email_login<>l.target_email or r.email_login is distinct from l.prior_email then raise exception 'link_invalid';end if;
 if l.lease_until>clock_timestamp() then raise exception 'recovery_busy';end if;
 if l.operation_id is null then
  if s.operation_id is not null or s.security_version<>l.security_version then raise exception 'link_invalid';end if;
  op:=gen_random_uuid();
  update public.slm_account_security set operation_id=op,operation_kind='password',operation_started_at=clock_timestamp(),security_version=security_version+1 where user_id=u;
  delete from public.slm_account_sessions where user_id=u;
 else
  op:=l.operation_id;
  if s.operation_id is distinct from op or s.security_version<>l.security_version+1 then raise exception 'link_invalid';end if;
 end if;
 update public.slm_email_links set lease_id=p_lease,lease_until=clock_timestamp()+interval '180 seconds',operation_id=op where id=l.id;
 return u;
end$$;
create function public.slm_email_recovery_finish(p_id uuid,p_hash text,p_lease uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare l public.slm_email_links;s public.slm_account_security;u uuid;
begin
 perform pg_advisory_xact_lock(20261014,1);
 select user_id into u from public.slm_email_links where id=p_id and token_hash=p_hash;
 select * into s from public.slm_account_security where user_id=u for update;
 select * into l from public.slm_email_links where id=p_id for update;
 if u is null or p_lease is null or l.token_hash<>p_hash or l.kind<>'recovery' or l.id is null or l.state<>'pending' or l.lease_id is distinct from p_lease or l.lease_until<=clock_timestamp() or s.operation_id is distinct from l.operation_id or s.security_version<>l.security_version+1 then raise exception 'link_invalid';end if;
 update public.slm_account_security set operation_id=null,operation_kind=null,operation_started_at=null,must_change_password=false where user_id=u;
 insert into public.slm_account_audit(actor_id,target_id,action) values(u,u,'password');
 update public.slm_email_links set state=case when id=l.id then 'consumed' else 'cancelled' end where user_id=u and state='pending';
end$$;
create function public.slm_email_recovery_release(p_id uuid,p_hash text,p_lease uuid) returns void language sql security invoker set search_path='' as $$
 update public.slm_email_links set lease_until=clock_timestamp() where id=p_id and token_hash=p_hash and lease_id=p_lease and state='pending';
$$;
revoke all on function public.slm_email_issue(uuid,uuid,text,text,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.slm_email_issue(uuid,uuid,text,text,uuid,text,uuid,text) to service_role;
revoke all on function public.slm_email_delivered(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.slm_email_delivered(uuid,text,boolean) to service_role;
revoke all on function public.slm_email_confirm(uuid,text) from public,anon,authenticated;
grant execute on function public.slm_email_confirm(uuid,text) to service_role;
revoke all on function public.slm_email_recovery_begin(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.slm_email_recovery_begin(uuid,text,uuid) to service_role;
revoke all on function public.slm_email_recovery_finish(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.slm_email_recovery_finish(uuid,text,uuid) to service_role;
revoke all on function public.slm_email_recovery_release(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.slm_email_recovery_release(uuid,text,uuid) to service_role;
alter table public.slm_signup_jobs add column email_requested text not null default '';
drop function public.slm_model_signup_begin(uuid,text,text,text,text);
create function public.slm_model_signup_begin(p_request uuid,p_secret_hash text,p_nickname text,p_phone text,p_full_name text,p_email text default '') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.slm_signup_jobs; k text:=slm_private.identity_key(p_nickname);begin
 if not public.slm_model_ready() then raise exception 'model_inactive';end if;
 perform pg_advisory_xact_lock(20261014,1);
 select * into j from public.slm_signup_jobs where request_id=p_request;
 if found then
  if j.secret_hash<>p_secret_hash or j.nickname<>p_nickname or j.phone<>p_phone or j.full_name<>p_full_name or j.email_requested<>p_email then raise exception 'signup_conflict';end if;
 else
  if exists(select 1 from public.slm_identity_registry where nickname_key=k) or
    exists(select 1 from public.slm_player_profiles where lower(normalize(btrim(nickname),NFC))=k) then raise unique_violation using message='nickname_taken';end if;
  if (p_phone<>'' and p_phone!~'^\+48[0-9]{9}$') or length(p_full_name)>100 or p_full_name~'[[:cntrl:]<>]' then raise exception 'invalid_input';end if;
  insert into public.slm_signup_jobs(request_id,secret_hash,nickname_key,nickname,phone,full_name,email_requested)
   values(p_request,p_secret_hash,k,p_nickname,p_phone,p_full_name,p_email) returning * into j;
 end if;
 return jsonb_build_object('auth_email',j.auth_email);
end$$;
revoke all on function public.slm_model_signup_begin(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.slm_model_signup_begin(uuid,text,text,text,text,text) to service_role;
commit;

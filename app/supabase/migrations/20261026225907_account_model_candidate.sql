-- Candidate only. No activation, account updates or automatic migration here.
begin;
create table public.slm_account_model_state(singleton boolean primary key default true check(singleton),active boolean not null default false);
insert into public.slm_account_model_state values(true,false);
alter table public.slm_account_model_state enable row level security;
revoke all on public.slm_account_model_state from public,anon,authenticated;
grant select,update on public.slm_account_model_state to service_role;
create function public.slm_model_ready() returns boolean language sql stable security invoker set search_path='' as $$
 select active from public.slm_account_model_state where singleton;
$$;
create function public.slm_model_prepare() returns void language plpgsql security invoker set search_path='' as $$begin
 perform pg_advisory_xact_lock(20261014,1);
 perform public.slm_identity_prepare();
 if exists(select 1 from public.slm_identity_registry r join public.slm_aliases a on a.user_id<>r.user_id
   and lower(normalize(btrim(a.login),NFC))=r.nickname_key) then raise exception 'old_login_collision';end if;
 update public.slm_account_model_state set active=true where singleton;
end$$;
create function public.slm_model_resolve(p_identifier text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare k text; r public.slm_identity_registry; auth_data jsonb;begin
 if not public.slm_model_ready() then raise exception 'model_inactive';end if;
 if position('@' in p_identifier)>0 then
  select * into r from public.slm_identity_registry where email_login=lower(btrim(p_identifier));
 else
  begin k:=slm_private.identity_key(p_identifier);exception when others then return null;end;
  select * into r from public.slm_identity_registry where nickname_key=k;
 end if;
 if r.user_id is null then return null;end if;
 auth_data:=slm_private.identity_auth(r.user_id);
 if auth_data is null or not (auth_data->>'confirmed')::boolean or auth_data->>'technical_email' is distinct from r.auth_email then return null;end if;
 return jsonb_build_object('user_id',r.user_id,'technical_email',r.auth_email);
end$$;

-- One transaction includes canonical rename, PR16 disclosure validation and contact.
create function public.slm_model_profile_save(p_user uuid,p_session uuid,p_body jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare prior public.slm_v2_requests; key uuid; n text;begin
 if not public.slm_model_ready() then raise exception 'model_inactive';end if;
 if exists(select 1 from jsonb_object_keys(p_body) k where k not in
 ('nickname','expected_nickname','first_name','full_name','display_as','jersey_number','group_scope','accept_disclosure','request_id','contact_phone')) then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for update;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 key:=(p_body->>'request_id')::uuid;if key is null then raise exception 'request_required';end if;
 select * into prior from public.slm_v2_requests where actor_id=p_user and request_id=key;
 if found then if prior.action<>'premium_profile' or prior.body<>p_body then raise exception 'idempotency_conflict';end if;return;end if;
 n:=normalize(btrim(p_body->>'nickname'),NFC);
 if n is distinct from p_body->>'nickname' then raise exception 'invalid_nickname';end if;
 perform public.slm_identity_rename(p_user,p_session,md5(key::text||':model_rename')::uuid,p_body->>'expected_nickname',n);
 perform public.slm_premium_profile_save(p_user,p_session,p_body);
 if jsonb_typeof(p_body->'contact_phone') is distinct from 'string' or
   (p_body->>'contact_phone'<>'' and p_body->>'contact_phone'!~'^\+48[0-9]{9}$') then raise exception 'invalid_phone';end if;
 update public.slm_player_profiles set contact_phone=nullif(p_body->>'contact_phone','') where user_id=p_user;
end$$;

-- Public signup jobs are capabilities, not accounts and never store passwords.
create table public.slm_signup_jobs(
 request_id uuid primary key,secret_hash text not null check(secret_hash~'^[0-9a-f]{64}$'),
 nickname_key text collate "C" not null unique,nickname text not null,phone text not null,full_name text not null,
 auth_email text not null unique default(gen_random_uuid()::text||'@slm.invalid'),
 created_at timestamptz not null default clock_timestamp(),completed_user uuid references auth.users(id)
);
alter table public.slm_signup_jobs enable row level security;
revoke all on public.slm_signup_jobs from public,anon,authenticated;
grant select,insert,update on public.slm_signup_jobs to service_role;
create function public.slm_model_signup_begin(p_request uuid,p_secret_hash text,p_nickname text,p_phone text,p_full_name text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.slm_signup_jobs; k text:=slm_private.identity_key(p_nickname);begin
 if not public.slm_model_ready() then raise exception 'model_inactive';end if;
 perform pg_advisory_xact_lock(20261014,1);
 select * into j from public.slm_signup_jobs where request_id=p_request;
 if found then
  if j.secret_hash<>p_secret_hash or j.nickname<>p_nickname or j.phone<>p_phone or j.full_name<>p_full_name then raise exception 'signup_conflict';end if;
 else
  if exists(select 1 from public.slm_identity_registry where nickname_key=k) or
    exists(select 1 from public.slm_player_profiles where lower(normalize(btrim(nickname),NFC))=k) then raise unique_violation using message='nickname_taken';end if;
  if (p_phone<>'' and p_phone!~'^\+48[0-9]{9}$') or length(p_full_name)>100 or p_full_name~'[[:cntrl:]<>]' then raise exception 'invalid_input';end if;
  insert into public.slm_signup_jobs(request_id,secret_hash,nickname_key,nickname,phone,full_name)
   values(p_request,p_secret_hash,k,p_nickname,p_phone,p_full_name) returning * into j;
 end if;
 return jsonb_build_object('auth_email',j.auth_email);
end$$;
-- Read only; recovers an Auth creation whose HTTP response was lost.
create function public.slm_model_signup_user(p_request uuid,p_secret_hash text) returns uuid
language sql stable security definer set search_path='' as $$
 select u.id from public.slm_signup_jobs j join auth.users u on u.email=j.auth_email
 where j.request_id=p_request and j.secret_hash=p_secret_hash
 and to_jsonb(u)->'raw_app_meta_data'->>'slm_signup_request'=p_request::text
 and u.email_confirmed_at is not null and u.deleted_at is null;
$$;
create function public.slm_model_signup_finish(p_request uuid,p_secret_hash text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare j public.slm_signup_jobs; u uuid;begin
 if not public.slm_model_ready() then raise exception 'model_inactive';end if;
 perform pg_advisory_xact_lock(20261014,1);
 select * into j from public.slm_signup_jobs where request_id=p_request for update;
 if not found or j.secret_hash<>p_secret_hash then raise exception 'signup_conflict';end if;
 u:=public.slm_model_signup_user(p_request,p_secret_hash);
 if u is null then raise exception 'signup_incomplete';end if;
 if j.completed_user is not null then if j.completed_user<>u then raise exception 'signup_conflict';end if;return u;end if;
 -- No groups, global administrator, verified personal e-mail, or client metadata roles.
 insert into public.slm_profiles(user_id,full_name) values(u,j.full_name);
 insert into public.slm_roles(user_id) values(u);
 insert into public.slm_account_security(user_id,must_change_password) values(u,false);
 insert into public.slm_player_profiles(user_id,nickname,contact_phone,email_account) values(u,j.nickname,nullif(j.phone,''),false);
 insert into public.slm_identity_registry(user_id,nickname_key,auth_email) values(u,j.nickname_key,j.auth_email);
 update public.slm_signup_jobs set completed_user=u where request_id=p_request;
 return u;
end$$;
create or replace function public.slm_identity_rename(p_user uuid,p_session uuid,p_request uuid,p_expected text,p_nickname text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare n text:=normalize(btrim(p_nickname),NFC); k text; old_name text; prior public.slm_v2_requests;
 payload jsonb:=jsonb_build_object('expected',p_expected,'nickname',n); previous_writer text;
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for update;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_request is null or p_nickname is null or p_expected is null then raise exception 'invalid_request';end if;
 k:=slm_private.identity_key(n);
 select * into prior from public.slm_v2_requests where actor_id=p_user and request_id=p_request;
 if found then
  if prior.action<>'identity_foundation' or prior.body<>payload then raise exception 'idempotency_conflict';end if;
  return prior.response;
 end if;
 if not exists(select 1 from public.slm_identity_registry where user_id=p_user) then raise exception 'identity_not_prepared';end if;
 select nickname into old_name from public.slm_player_profiles where user_id=p_user for update;
 if old_name is distinct from p_expected then raise exception 'stale_identity';end if;
 -- Include unprepared profiles: no reservation may silently steal an existing name.
 if exists(select 1 from public.slm_signup_jobs where nickname_key=k and completed_user is null) then raise unique_violation using message='nickname_taken';end if;
 if exists(select 1 from public.slm_player_profiles where user_id<>p_user and lower(normalize(btrim(nickname),NFC))=k)
 then raise unique_violation using message='nickname_taken';end if;
 update public.slm_identity_registry set nickname_key=k where user_id=p_user;
 previous_writer:=current_setting('slm.identity_writer',true);
 perform set_config('slm.identity_writer',p_user::text,true);
 update public.slm_player_profiles set nickname=n where user_id=p_user;
 perform set_config('slm.identity_writer',coalesce(previous_writer,''),true);
 insert into public.slm_v2_requests values(p_user,p_request,'identity_foundation',payload,
  jsonb_build_object('nickname',n),clock_timestamp());
 return jsonb_build_object('nickname',n);
end $$;
revoke all on function public.slm_model_ready() from public,anon,authenticated;
grant execute on function public.slm_model_ready() to service_role;
revoke all on function public.slm_model_prepare() from public,anon,authenticated;
grant execute on function public.slm_model_prepare() to service_role;
revoke all on function public.slm_model_resolve(text) from public,anon,authenticated;
grant execute on function public.slm_model_resolve(text) to service_role;
revoke all on function public.slm_model_profile_save(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.slm_model_profile_save(uuid,uuid,jsonb) to service_role;
revoke all on function public.slm_model_signup_begin(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.slm_model_signup_begin(uuid,text,text,text,text) to service_role;
revoke all on function public.slm_model_signup_user(uuid,text) from public,anon,authenticated;
grant execute on function public.slm_model_signup_user(uuid,text) to service_role;
revoke all on function public.slm_model_signup_finish(uuid,text) from public,anon,authenticated;
grant execute on function public.slm_model_signup_finish(uuid,text) to service_role;
commit;

-- Dormant foundation. No backfill/enrolment, Auth edits or login cutover here.
begin;
create function slm_private.identity_key(p_name text) returns text
language plpgsql immutable strict set search_path='' as $$
declare n text:=normalize(btrim(p_name),NFC);
begin
 if n !~ '^[[:alpha:]][[:alnum:]_.-]{2,31}$' then raise exception 'invalid_nickname';end if;
 return lower(n);
end $$;
revoke all on function slm_private.identity_key(text) from public,anon,authenticated;
grant execute on function slm_private.identity_key(text) to service_role;

-- nickname remains ONLY in slm_player_profiles. This is a derived key/private routing.
create table public.slm_identity_registry (
 user_id uuid primary key references public.slm_player_profiles(user_id) on delete cascade,
 nickname_key text collate "C" not null unique,
 auth_email text not null,
 email_login text collate "C" unique,
 check (email_login is null or email_login=lower(btrim(email_login)))
);
alter table public.slm_identity_registry enable row level security;
revoke all on public.slm_identity_registry from public,anon,authenticated;
grant select,insert,update,delete on public.slm_identity_registry to service_role;

-- Explicit staging operation, service-only. Collision aborts ALL inserts; no renaming.
create function public.slm_identity_prepare() returns integer
language plpgsql security invoker set search_path='' as $$
declare p record; i jsonb; total integer:=0;
begin
 perform pg_advisory_xact_lock(20261014,1);
 lock table public.slm_player_profiles in share row exclusive mode;
 if exists(select 1 from public.slm_profiles a left join public.slm_player_profiles n using(user_id) where n.user_id is null)
 or exists(select 1 from public.slm_account_security where operation_id is not null) then raise exception 'identity_preflight_required';end if;
 for p in select * from public.slm_player_profiles order by user_id loop
  i:=public.slm_email_identity(null,p.user_id);
  if i is null or (i->>'email_account')::boolean is distinct from p.email_account then raise exception 'identity_preflight_required';end if;
  if exists(select 1 from public.slm_identity_registry r where r.user_id=p.user_id and
    (r.nickname_key<>slm_private.identity_key(p.nickname) or r.auth_email<>i->>'technical_email')) then raise exception 'identity_preflight_required';end if;
  insert into public.slm_identity_registry(user_id,nickname_key,auth_email,email_login)
   values(p.user_id,slm_private.identity_key(p.nickname),i->>'technical_email',case when p.email_account then lower(i->>'technical_email') end)
   on conflict(user_id) do nothing;
  total:=total+1;
 end loop;
 return total;
end $$;
revoke all on function public.slm_identity_prepare() from public,anon,authenticated;
grant execute on function public.slm_identity_prepare() to service_role;

-- Protect staged canonical names from legacy writers; empty registry changes nothing.
create function slm_private.identity_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare k text; enrolled boolean;
begin
 if not exists(select 1 from public.slm_identity_registry) then return new;end if;
 select exists(select 1 from public.slm_identity_registry where user_id=new.user_id) into enrolled;
 if enrolled and new.nickname is distinct from old.nickname and
  current_setting('slm.identity_writer',true) is distinct from new.user_id::text then raise exception 'identity_update_required';end if;
 begin k:=slm_private.identity_key(new.nickname);
 exception when others then
  if enrolled then raise;end if;
  return new;
 end;
 if exists(select 1 from public.slm_identity_registry where nickname_key=k and user_id<>new.user_id)
 then raise unique_violation using message='nickname_taken';end if;
 return new;
end $$;
revoke all on function slm_private.identity_guard() from public,anon,authenticated;
create trigger identity_canonical_guard before insert or update of nickname on public.slm_player_profiles
 for each row execute function slm_private.identity_guard();

create function public.slm_identity_rename(p_user uuid,p_session uuid,p_request uuid,p_expected text,p_nickname text) returns jsonb
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
revoke all on function public.slm_identity_rename(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.slm_identity_rename(uuid,uuid,uuid,text,text) to service_role;
commit;

-- PREPARED ONLY. Requires explicit deployment after review; no existing data rewrite.
-- Same confirmed-email provisioning contract and ACLs. Metadata is untrusted profile
-- input only: it cannot grant roles, membership, consent, an alias or a session.
begin;
create or replace function public.slm_email_identity(p_email text default null,p_user uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u auth.users; a public.slm_aliases; draft jsonb; nick text:='Zawodnik';
 name text:=''; phone text:=null; shirt integer:=null;
begin
 if p_user is not null then select * into u from auth.users where id=p_user;
 else select * into u from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;end if;
 if u.id is null or u.email_confirmed_at is null or u.deleted_at is not null then return null;end if;
 select * into a from public.slm_aliases where user_id=u.id;
 if a.user_id is not null then return jsonb_build_object('user_id',u.id,'technical_email',a.technical_email,'login',a.login,'phone',a.phone,'email_account',false);end if;
 perform pg_advisory_xact_lock(hashtextextended(u.id::text,20261019));
 draft:=u.raw_user_meta_data->'slm_signup_profile';
 if jsonb_typeof(draft)='object' then
  if jsonb_typeof(draft->'nickname')='string' and length(trim(draft->>'nickname')) between 1 and 48
   and (draft->>'nickname')!~ '[[:cntrl:]<>]' then nick:=trim(draft->>'nickname');end if;
  if jsonb_typeof(draft->'full_name')='string' and length(draft->>'full_name')<=100
   and (draft->>'full_name')!~ '[[:cntrl:]<>]' then name:=trim(draft->>'full_name');end if;
  if jsonb_typeof(draft->'jersey_number')='number' and (draft->>'jersey_number')~ '^\d{1,2}$'
   then shirt:=(draft->>'jersey_number')::integer;end if;
  if jsonb_typeof(draft->'contact_phone')='string' and (draft->>'contact_phone')~ '^\+48[0-9]{9}$'
   then phone:=draft->>'contact_phone';end if;
 end if;
 insert into public.slm_profiles(user_id,full_name) values(u.id,name) on conflict do nothing;
 insert into public.slm_roles(user_id,role) values(u.id,'member') on conflict do nothing;
 insert into public.slm_account_security(user_id,must_change_password) values(u.id,false) on conflict do nothing;
 -- A contact collision never claims another account's phone or prevents email login.
 begin
  insert into public.slm_player_profiles(user_id,nickname,email_account,contact_phone,jersey_number)
  values(u.id,nick,true,phone,shirt) on conflict(user_id) do nothing;
 exception when unique_violation then
  insert into public.slm_player_profiles(user_id,nickname,email_account,jersey_number)
  values(u.id,nick,true,shirt) on conflict(user_id) do nothing;
 end;
 return (select jsonb_build_object('user_id',u.id,'technical_email',u.email,'login',p.nickname,'phone',coalesce(p.contact_phone,''),'email_account',true)
 from public.slm_player_profiles p where p.user_id=u.id);
end $$;
revoke all on function public.slm_email_identity(text,uuid) from public,anon,authenticated;
grant execute on function public.slm_email_identity(text,uuid) to service_role;

-- A DEFINITIVE GoTrue rejection may release only this specific recovery operation.
-- Network/5xx ambiguity must NOT call this helper. Version stays incremented and
-- old sessions stay revoked. Never clear a newer administrator operation.
create function public.slm_account_email_recovery_abort(p_user uuid,p_session uuid,p_operation uuid,p_version bigint,p_was_temporary boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
declare s public.slm_account_security;
begin
 select * into s from public.slm_account_security where user_id=p_user for update;
 if not found or not s.active or s.operation_id is distinct from p_operation
  or s.operation_kind is distinct from 'password' or s.security_version is distinct from p_version
  or p_was_temporary is null or not slm_private.auth_session_exists(p_user,p_session) then return false;end if;
 update public.slm_account_security set operation_id=null,operation_kind=null,operation_started_at=null,
  must_change_password=p_was_temporary where user_id=p_user;
 return true;
end $$;
revoke all on function public.slm_account_email_recovery_abort(uuid,uuid,uuid,bigint,boolean) from public,anon,authenticated;
grant execute on function public.slm_account_email_recovery_abort(uuid,uuid,uuid,bigint,boolean) to service_role;
commit;

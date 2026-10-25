-- Consolidates the previously approved LOCAL B2.2 package. No remote rollout is authorized.
-- Formerly B22_LOCAL_ONLY.sql; now versioned for reproducible replay. No remote rollout authorized.
begin;
do $$ begin
 if not exists(select 1 from storage.buckets where id='slm-profile-photos' and not public)
 then raise exception 'Expected private profile bucket missing';end if;
end $$;
update storage.buckets set public=false,file_size_limit=150000,allowed_mime_types=array['image/webp']
where id='slm-profile-photos';

create or replace function public.slm_profile_number_save(p_user uuid,p_session uuid,p_number integer)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,322));
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_number is null or p_number not between 0 and 99 then raise exception 'invalid_number';end if;
 update public.slm_player_profiles set jersey_number=p_number where user_id=p_user;
 if not found then
  -- Legacy account may not have the profile extension; reuse its real alias, not a fake identity.
  insert into public.slm_player_profiles(user_id,nickname,jersey_number)
  select user_id,login,p_number from public.slm_aliases where user_id=p_user;
  if not found then raise exception 'profile_missing';end if;
 end if;
end $$;
revoke all on function public.slm_profile_number_save(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.slm_profile_number_save(uuid,uuid,integer) to service_role;

-- Preserve session lock, revision CAS, pending cleanup, owner paths and legacy JPEG references.
create or replace function public.slm_profile_photo_commit(p_user uuid,p_session uuid,p_expected uuid,p_path text default null)
returns jsonb language plpgsql security invoker set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare previous public.slm_profile_photos; saved public.slm_profile_photos;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,319));
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid'; end if;
 select * into previous from public.slm_profile_photos where user_id=p_user for update;
 if previous.revision is distinct from p_expected then raise exception 'stale_photo'; end if;
 if previous.cleanup_path is not null then raise exception 'photo_cleanup_required'; end if;
 if p_path is not null and p_path !~ ('^'||p_user::text||'/[a-f0-9-]{36}\.(jpg|webp)$') then raise exception 'invalid_photo'; end if;
 insert into public.slm_profile_photos(user_id,object_path,cleanup_path)
 values(p_user,p_path,previous.object_path)
 on conflict(user_id) do update set object_path=excluded.object_path,cleanup_path=excluded.cleanup_path,
 revision=gen_random_uuid(),updated_at=clock_timestamp() returning * into saved;
 return to_jsonb(saved);
end $$;
revoke all on function public.slm_profile_photo_commit(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.slm_profile_photo_commit(uuid,uuid,uuid,text) to service_role;

-- Contact/name edits must never erase a separately saved jersey number.
create or replace function public.slm_email_profile_save(p_user uuid,p_session uuid,p_nickname text,p_phone text,p_number integer default null)
returns void language plpgsql security invoker set search_path='' as $$ begin
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if not exists(select 1 from public.slm_player_profiles where user_id=p_user and email_account) then raise exception 'forbidden';end if;
 update public.slm_player_profiles set nickname=trim(p_nickname),contact_phone=nullif(p_phone,'') where user_id=p_user;
end $$;
revoke all on function public.slm_email_profile_save(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.slm_email_profile_save(uuid,uuid,text,text,integer) to service_role;
commit;

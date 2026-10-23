-- Private own-profile photos. All access goes through the session-checked Edge API.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('slm-profile-photos','slm-profile-photos',false,2097152,array['image/jpeg']);

create table public.slm_profile_photos (
 user_id uuid primary key references auth.users(id) on delete cascade,
 object_path text, revision uuid not null default gen_random_uuid(), cleanup_path text,
 updated_at timestamptz not null default clock_timestamp(),
 check(object_path is null or object_path like user_id::text||'/%'),
 check(cleanup_path is null or cleanup_path like user_id::text||'/%')
);
alter table public.slm_profile_photos enable row level security;
revoke all on public.slm_profile_photos from public,anon,authenticated;
grant select,insert,update,delete on public.slm_profile_photos to service_role;
-- No storage.objects policies: direct anonymous/authenticated access remains denied.

create function public.slm_profile_photo_commit(p_user uuid,p_session uuid,p_expected uuid,p_path text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare previous public.slm_profile_photos; saved public.slm_profile_photos;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,319));
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid'; end if;
 select * into previous from public.slm_profile_photos where user_id=p_user for update;
 if previous.revision is distinct from p_expected then raise exception 'stale_photo'; end if;
 if previous.cleanup_path is not null then raise exception 'photo_cleanup_required'; end if;
 if p_path is not null and p_path !~ ('^'||p_user::text||'/[a-f0-9-]{36}\.jpg$') then raise exception 'invalid_photo'; end if;
 insert into public.slm_profile_photos(user_id,object_path,cleanup_path)
 values(p_user,p_path,previous.object_path)
 on conflict(user_id) do update set object_path=excluded.object_path,cleanup_path=excluded.cleanup_path,
 revision=gen_random_uuid(),updated_at=clock_timestamp() returning * into saved;
 return to_jsonb(saved);
end $$;
revoke all on function public.slm_profile_photo_commit(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.slm_profile_photo_commit(uuid,uuid,uuid,text) to service_role;

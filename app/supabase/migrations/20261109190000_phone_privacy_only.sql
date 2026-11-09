-- Phone-only extraction from 20261104183413_account_privacy_lifecycle.sql.
-- Do not apply alongside the original full migration without reconciliation.
begin;
alter table public.slm_profiles add column if not exists share_phone boolean not null default false;
alter table public.slm_aliases alter column phone drop not null;
create function slm_private.phone_for(p_viewer uuid,p_target uuid) returns text
language sql stable security definer set search_path='' as $$
 select coalesce(n.contact_phone,a.phone) from public.slm_profiles p
 join public.slm_account_security s on s.user_id=p.user_id and s.active and s.operation_id is null
 left join public.slm_player_profiles n on n.user_id=p.user_id
 left join public.slm_aliases a on a.user_id=p.user_id
 where p.user_id=p_target and (p_viewer=p_target or p.share_phone and exists(
 select 1 from public.slm_group_members v join public.slm_group_members t using(group_id)
 join public.slm_groups g on g.id=v.group_id and not g.archived
 join public.slm_account_security vs on vs.user_id=v.user_id and vs.active and vs.operation_id is null
 where v.user_id=p_viewer and t.user_id=p_target));
$$;
revoke all on function slm_private.phone_for(uuid,uuid) from public,anon,authenticated;
grant execute on function slm_private.phone_for(uuid,uuid) to service_role;

create function public.slm_phone_visibility(p_viewer uuid,p_targets uuid[]) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(u::text,slm_private.phone_for(p_viewer,u)),'{}') from unnest(p_targets) u;
$$;
create function public.slm_phone_save(p_user uuid,p_session uuid,p_phone text,p_share boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for update;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_share is null or p_phone is null or (p_phone<>'' and p_phone !~ '^\+[1-9][0-9]{7,14}$') then raise exception 'invalid_input';end if;
 -- Edge normalizes new numbers to Poland; historical foreign numbers may be kept.
 if p_phone<>'' and p_phone !~ '^\+48[0-9]{9}$' and p_phone is distinct from slm_private.phone_for(p_user,p_user) then raise exception 'invalid_phone';end if;
 update public.slm_aliases set phone=nullif(p_phone,'') where user_id=p_user;
 update public.slm_player_profiles set contact_phone=nullif(p_phone,'') where user_id=p_user;
 update public.slm_profiles set share_phone=p_share and p_phone<>'' where user_id=p_user;
end $$;

create function slm_private.phone_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous text;current_phone text;begin
 previous:=case when TG_TABLE_NAME='slm_aliases' then to_jsonb(old)->>'phone' else to_jsonb(old)->>'contact_phone' end;
 current_phone:=case when TG_TABLE_NAME='slm_aliases' then to_jsonb(new)->>'phone' else to_jsonb(new)->>'contact_phone' end;
 if previous is distinct from current_phone then
 update public.slm_profiles set share_phone=false where user_id=new.user_id;
 if TG_TABLE_NAME='slm_aliases' and (current_phone is null or current_phone ~ '^\+48[0-9]{9}$') then
 update public.slm_player_profiles set contact_phone=current_phone where user_id=new.user_id;
 end if;
 if previous is not null then
 delete from public.slm_group_requests where phone_lookup_key=encode(sha256(convert_to(previous,'UTF8')),'hex');
 delete from public.slm_v2_requests where body->>'phone'=previous;
 end if;
 end if;return new;
end $$;
revoke all on function slm_private.phone_changed() from public,anon,authenticated;
grant execute on function slm_private.phone_changed() to service_role;
create trigger privacy_phone_changed after update of phone on public.slm_aliases for each row execute function slm_private.phone_changed();
create trigger privacy_contact_changed after update of contact_phone on public.slm_player_profiles for each row execute function slm_private.phone_changed();


-- Protect existing group/list projections from bypassing share_phone.
-- Update every current SQL projection, including historical dispatch bodies. No
-- old migration is edited. Candidate/request projections never disclose contacts.
do $$ declare f record; d text; next_d text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','slm_private') and p.prokind='f' loop
 d:=pg_get_functiondef(f.oid);next_d:=d;
 if position('case when g.admin_id=p_user and r.kind=''join'' and r.state=''pending'' then coalesce(pp.contact_phone,a.phone) end' in next_d)>0 then
 next_d:=replace(next_d,'case when g.admin_id=p_user and r.kind=''join'' and r.state=''pending'' then coalesce(pp.contact_phone,a.phone) end','null::text');end if;
 next_d:=replace(next_d,'coalesce(p.guest_phone,pp.contact_phone,a.phone)','slm_private.phone_for(p_user,p.member_id)');
 next_d:=replace(next_d,'coalesce(p.guest_phone,a.phone)','slm_private.phone_for(p_user,p.member_id)');
 next_d:=replace(next_d,'coalesce(pp.contact_phone,a.phone)','slm_private.phone_for(p_user,coalesce(pp.user_id,a.user_id))');
 if position('FUNCTION slm_private.group_profile(' in next_d)>0 then
 next_d:=replace(next_d,'coalesce(n.contact_phone,a.phone)','slm_private.phone_for(p_viewer,p_target)');end if;
 if next_d<>d then execute next_d;end if;
 end loop;
end $$;


revoke all on function public.slm_phone_visibility(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.slm_phone_visibility(uuid,uuid[]) to service_role;
revoke all on function public.slm_phone_save(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.slm_phone_save(uuid,uuid,text,boolean) to service_role;
commit;

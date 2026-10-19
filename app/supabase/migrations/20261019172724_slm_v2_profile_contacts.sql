create function slm_private.contact_unique() returns trigger
language plpgsql security definer set search_path='' as $$
declare phone_value text;begin
 phone_value:=case when tg_table_name='slm_aliases' then to_jsonb(new)->>'phone' else to_jsonb(new)->>'contact_phone' end;
 if phone_value is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(phone_value,20261019));
 if exists(select 1 from public.slm_aliases where phone=phone_value and user_id<>new.user_id)
 or exists(select 1 from public.slm_player_profiles where contact_phone=phone_value and user_id<>new.user_id)
 then raise unique_violation using message='identifier_taken';end if;
 return new;
end $$;
revoke all on function slm_private.contact_unique() from public,anon,authenticated;
create trigger alias_contact_unique before insert or update of phone on public.slm_aliases for each row execute function slm_private.contact_unique();
create trigger profile_contact_unique before insert or update of contact_phone on public.slm_player_profiles for each row execute function slm_private.contact_unique();
create function public.slm_email_profile_save(p_user uuid,p_session uuid,p_nickname text,p_phone text,p_number integer default null) returns void
language plpgsql security invoker set search_path='' as $$ begin
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if not exists(select 1 from public.slm_player_profiles where user_id=p_user and email_account)
 then raise exception 'forbidden';end if;
 update public.slm_player_profiles set nickname=trim(p_nickname),contact_phone=nullif(p_phone,''),jersey_number=p_number where user_id=p_user;
end $$;
revoke all on function public.slm_email_profile_save(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.slm_email_profile_save(uuid,uuid,text,text,integer) to service_role;
create or replace function slm_private.player_name(p_user uuid) returns text
language sql stable security invoker set search_path='' as $$
 select coalesce(case when p.display_as='full_name' then nullif(trim(p.full_name),'') end,a.login,n.nickname,'Zawodnik')
 from public.slm_profiles p left join public.slm_player_profiles n on n.user_id=p.user_id
 left join public.slm_aliases a on a.user_id=p.user_id where p.user_id=p_user;
$$;

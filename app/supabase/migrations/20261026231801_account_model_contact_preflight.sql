-- Explicit cutover only. Refuse ambiguous contacts, never overwrite them.
begin;
create or replace function public.slm_model_prepare() returns void language plpgsql security invoker set search_path='' as $$begin
 perform pg_advisory_xact_lock(20261014,1);
 if public.slm_model_ready() then raise exception 'model_already_active';end if;
 perform public.slm_identity_prepare();
 if exists(select 1 from public.slm_identity_registry r join public.slm_aliases a on a.user_id<>r.user_id
   and lower(normalize(btrim(a.login),NFC))=r.nickname_key) then raise exception 'old_login_collision';end if;
 if exists(select 1 from public.slm_aliases a join public.slm_player_profiles n using(user_id)
   where a.phone!~'^\+48[0-9]{9}$' or n.contact_phone is not null and n.contact_phone<>a.phone)
 then raise exception 'contact_migration_required';end if;
 update public.slm_player_profiles n set contact_phone=a.phone from public.slm_aliases a where a.user_id=n.user_id and n.contact_phone is null;
 update public.slm_account_model_state set active=true where singleton;
end$$;
commit;

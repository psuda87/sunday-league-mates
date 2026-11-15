-- Hardening rezerwacji pseudonimów (audyt bezpieczeństwa 2026-11-15).
-- 1) Rejestracja (także bezpośrednio przez publiczne /auth/v1/signup) rezerwuje pseudonim
--    tylko, gdy spełnia te same reguły co tworzenie profilu w slm_email_identity:
--    1–48 znaków, bez znaków sterujących i < >. Inaczej profil i tak dostaje "Zawodnik".
-- 2) Niepotwierdzone konto starsze niż 48 h nie blokuje pseudonimu: przy próbie zajęcia
--    takie konto (bez żadnych danych aplikacji) jest usuwane, a rezerwacja znika przez
--    ON DELETE CASCADE. Bez pg_cron i bez zwalniania rezerwacji kont, które mogą się
--    jeszcze potwierdzić (to zablokowałoby ich profil przy kolizji pseudonimu).
begin;

create function slm_private.nickname_claim_stale(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from auth.users u
  where u.id=p_user and u.email_confirmed_at is null and u.deleted_at is null
   and u.created_at < clock_timestamp() - interval '48 hours'
   and not exists(select 1 from public.slm_aliases a where a.user_id=u.id)
   and not exists(select 1 from public.slm_profiles p where p.user_id=u.id)
   and not exists(select 1 from public.slm_player_profiles pp where pp.user_id=u.id));
$$;
revoke all on function slm_private.nickname_claim_stale(uuid) from public,anon,authenticated;

create or replace function slm_private.claim_nickname() returns trigger
language plpgsql security definer set search_path='' as $$
declare nick text; owner_id uuid; holder uuid;
begin
 if tg_table_schema='auth' then
  nick:=new.raw_user_meta_data->'slm_signup_profile'->>'nickname'; owner_id:=new.id;
  if jsonb_typeof(new.raw_user_meta_data->'slm_signup_profile'->'nickname') is distinct from 'string'
   or length(btrim(nick)) not between 1 and 48 or nick ~ '[[:cntrl:]<>]' then return new; end if;
 else nick:=new.nickname;owner_id:=new.user_id;end if;
 if nullif(btrim(nick),'') is null then return new;end if;
 select user_id into holder from slm_private.nickname_claims where nickname=lower(btrim(nick));
 if holder is not null and holder<>owner_id and slm_private.nickname_claim_stale(holder) then
  begin
   delete from auth.users where id=holder;
  exception when foreign_key_violation then null; -- dane aplikacji istnieją: rezerwacja zostaje
  end;
 end if;
 insert into slm_private.nickname_claims(user_id,nickname) values(owner_id,lower(btrim(nick)))
 on conflict(user_id) do update set nickname=excluded.nickname;
 return new;
end $$;
revoke all on function slm_private.claim_nickname() from public,anon,authenticated;

create or replace function public.slm_nickname_available(p_nickname text,p_user uuid default null) returns boolean
language sql security definer set search_path='' as $$
 select length(btrim(p_nickname)) between 1 and 48 and not exists(
  select 1 from slm_private.nickname_claims c where c.nickname=lower(btrim(p_nickname))
   and c.user_id is distinct from p_user and not slm_private.nickname_claim_stale(c.user_id))
$$;
revoke all on function public.slm_nickname_available(text,uuid) from public,anon,authenticated;
grant execute on function public.slm_nickname_available(text,uuid) to service_role;

commit;

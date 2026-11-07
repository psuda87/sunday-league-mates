-- Nick claims cover unverified email signups and existing player profiles.
-- No data deletion/renaming: conflicting historical names abort this transaction.
begin;
create unique index slm_player_nickname_ci_key on public.slm_player_profiles(lower(btrim(nickname))) where nullif(btrim(nickname),'') is not null;
create table slm_private.nickname_claims (
 user_id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null check(length(btrim(nickname)) between 1 and 48),
 unique(nickname)
);
alter table slm_private.nickname_claims enable row level security;
revoke all on slm_private.nickname_claims from public,anon,authenticated;
insert into slm_private.nickname_claims select user_id,lower(btrim(nickname)) from public.slm_player_profiles where nullif(btrim(nickname),'') is not null;
insert into slm_private.nickname_claims
 select id,lower(btrim(raw_user_meta_data->'slm_signup_profile'->>'nickname')) from auth.users u
 where deleted_at is null and nullif(btrim(raw_user_meta_data->'slm_signup_profile'->>'nickname'),'') is not null
 and not exists(select 1 from slm_private.nickname_claims n where n.user_id=u.id);
create function slm_private.claim_nickname() returns trigger language plpgsql security definer set search_path='' as $$
declare nick text; owner_id uuid;
begin
 if tg_table_schema='auth' then
  nick:=new.raw_user_meta_data->'slm_signup_profile'->>'nickname'; owner_id:=new.id;
 else nick:=new.nickname;owner_id:=new.user_id;end if;
 if nullif(btrim(nick),'') is null then return new;end if;
 insert into slm_private.nickname_claims(user_id,nickname) values(owner_id,lower(btrim(nick)))
 on conflict(user_id) do update set nickname=excluded.nickname;
 return new;
end $$;
revoke all on function slm_private.claim_nickname() from public,anon,authenticated;
-- AFTER INSERT: the FK points to the newly created Auth user in this transaction.
create trigger slm_signup_nickname_claim after insert on auth.users for each row execute function slm_private.claim_nickname();
create trigger slm_profile_nickname_claim before insert or update of nickname on public.slm_player_profiles for each row execute function slm_private.claim_nickname();
create function public.slm_nickname_available(p_nickname text,p_user uuid default null) returns boolean
language sql security definer set search_path='' as $$
 select length(btrim(p_nickname)) between 1 and 48 and not exists(
 select 1 from slm_private.nickname_claims where nickname=lower(btrim(p_nickname)) and user_id is distinct from p_user)
$$;
revoke all on function public.slm_nickname_available(text,uuid) from public,anon,authenticated;
grant execute on function public.slm_nickname_available(text,uuid) to service_role;
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
 if exists(select 1 from public.slm_player_profiles where user_id=u.id) then
  return (select jsonb_build_object('user_id',u.id,'technical_email',u.email,'login',p.nickname,'phone',coalesce(p.contact_phone,''),'email_account',true) from public.slm_player_profiles p where p.user_id=u.id);
 end if;
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

commit;

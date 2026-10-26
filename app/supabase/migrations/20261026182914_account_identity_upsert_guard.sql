-- Preserve jersey-only upserts for staged identities; no backfill or activation.
begin;
create or replace function slm_private.identity_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare k text; enrolled boolean;
begin
 if not exists(select 1 from public.slm_identity_registry) then return new;end if;
 select exists(select 1 from public.slm_identity_registry where user_id=new.user_id) into enrolled;
 -- Existing jersey upserts INSERT old nickname but only UPDATE jersey on conflict.
 if enrolled and tg_op='INSERT' then return new;end if;
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
commit;

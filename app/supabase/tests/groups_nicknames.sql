-- Run only inside a disposable local scratch database, never Cloud.
begin;
do $$ declare first_user uuid:='90000000-0000-4000-8000-000000000001'; second_user uuid:='90000000-0000-4000-8000-000000000002';begin
 insert into auth.users(id,email,raw_user_meta_data) values(first_user,'nick-one@fixture.invalid','{"slm_signup_profile":{"nickname":"CaseNick"}}');
 if public.slm_nickname_available(' casenick ') then raise exception 'unverified signup did not reserve nickname';end if;
 begin
  insert into auth.users(id,email,raw_user_meta_data) values(second_user,'nick-two@fixture.invalid','{"slm_signup_profile":{"nickname":"CASENICK"}}');
  raise exception 'duplicate signup accepted';
 exception when unique_violation then null;end;
 insert into auth.users(id,email) values(second_user,'nick-two@fixture.invalid');
 insert into public.slm_player_profiles(user_id,nickname,email_account) values(first_user,'CaseNick',true),(second_user,'OtherNick',true);
 begin update public.slm_player_profiles set nickname='casenick' where user_id=second_user;
 raise exception 'duplicate rename accepted';exception when unique_violation then null;end;
 update public.slm_player_profiles set nickname='CASENICK' where user_id=first_user;
 update public.slm_player_profiles set nickname='RenamedNick' where user_id=first_user;
 update auth.users set email_confirmed_at=clock_timestamp() where id=first_user;
 if public.slm_email_identity(null,first_user)->>'login'<>'RenamedNick' then raise exception 'login restored stale signup nickname';end if;
 update public.slm_player_profiles set nickname='CASENICK' where user_id=first_user;
 if not public.slm_nickname_available('CaseNick',first_user) then raise exception 'own case change rejected';end if;
 if has_function_privilege('anon','public.slm_nickname_available(text,uuid)','execute') or has_function_privilege('authenticated','public.slm_nickname_available(text,uuid)','execute') then raise exception 'nickname catalog exposed';end if;
 if has_table_privilege('authenticated','slm_private.nickname_claims','select') then raise exception 'claims exposed';end if;
 raise notice 'PASS nickname signup, rename, case folding and ACL';
end $$;
rollback;

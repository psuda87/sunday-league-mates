-- Run only inside a disposable local scratch database, never Cloud.
begin;
do $$ declare stale uuid:='91000000-0000-4000-8000-000000000001'; fresh uuid:='91000000-0000-4000-8000-000000000002';
 newcomer uuid:='91000000-0000-4000-8000-000000000003'; second uuid:='91000000-0000-4000-8000-000000000004';
 invalid uuid:='91000000-0000-4000-8000-000000000005'; kept uuid:='91000000-0000-4000-8000-000000000006';begin
 -- Nieprawidłowy pseudonim z bezpośredniego signup nie jest rezerwowany.
 insert into auth.users(id,email,raw_user_meta_data) values(invalid,'nick-invalid@fixture.invalid','{"slm_signup_profile":{"nickname":"<b>x</b>"}}');
 if exists(select 1 from slm_private.nickname_claims where user_id=invalid) then raise exception 'invalid nickname reserved';end if;
 insert into auth.users(id,email,raw_user_meta_data) values(second,'nick-long@fixture.invalid',jsonb_build_object('slm_signup_profile',jsonb_build_object('nickname',repeat('a',49))));
 if exists(select 1 from slm_private.nickname_claims where user_id=second) then raise exception 'overlong nickname reserved';end if;
 -- Świeże niepotwierdzone konto nadal blokuje pseudonim.
 insert into auth.users(id,email,raw_user_meta_data) values(fresh,'nick-fresh@fixture.invalid','{"slm_signup_profile":{"nickname":"FreshNick"}}');
 if public.slm_nickname_available('freshnick') then raise exception 'fresh claim released';end if;
 begin
  insert into auth.users(id,email,raw_user_meta_data) values(newcomer,'nick-new@fixture.invalid','{"slm_signup_profile":{"nickname":"FRESHNICK"}}');
  raise exception 'fresh claim overtaken';
 exception when unique_violation then null;end;
 -- Niepotwierdzone konto starsze niż 48 h zwalnia pseudonim i jest usuwane przy przejęciu.
 insert into auth.users(id,email,raw_user_meta_data,created_at) values(stale,'nick-stale@fixture.invalid','{"slm_signup_profile":{"nickname":"StaleNick"}}',clock_timestamp()-interval '3 days');
 if not public.slm_nickname_available('stalenick') then raise exception 'stale claim still blocks availability';end if;
 insert into auth.users(id,email,raw_user_meta_data) values(newcomer,'nick-new@fixture.invalid','{"slm_signup_profile":{"nickname":"StaleNick"}}');
 if exists(select 1 from auth.users where id=stale) then raise exception 'stale account not removed';end if;
 if (select user_id from slm_private.nickname_claims where nickname='stalenick')<>newcomer then raise exception 'claim not transferred';end if;
 -- Stare niepotwierdzone konto z danymi aplikacji nie jest usuwane.
 insert into auth.users(id,email,raw_user_meta_data,created_at) values(kept,'nick-kept@fixture.invalid','{"slm_signup_profile":{"nickname":"KeptNick"}}',clock_timestamp()-interval '3 days');
 insert into public.slm_profiles(user_id,full_name) values(kept,'');
 if public.slm_nickname_available('keptnick') then raise exception 'claim with app data released';end if;
 if has_function_privilege('anon','slm_private.nickname_claim_stale(uuid)','execute') or has_function_privilege('authenticated','slm_private.nickname_claim_stale(uuid)','execute') then raise exception 'stale helper exposed';end if;
 raise notice 'PASS nickname validation, fresh lock, stale release and ACL';
end $$;
rollback;

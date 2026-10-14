-- PRZYGOTOWANE, NIEURUCHOMIONE. Tylko izolowany LOKALNY Supabase; całość ROLLBACK.
-- Sztuczne auth.sessions służą kontroli RPC/RLS, nie są weryfikacją rzeczywistych JWT.
begin;
do $$
declare actor uuid:=gen_random_uuid(); member uuid:=gen_random_uuid(); actor_session uuid:=gen_random_uuid();
 member_session uuid:=gen_random_uuid(); device uuid:=gen_random_uuid(); secret text:=gen_random_uuid()::text||gen_random_uuid()::text;
 binding uuid:=gen_random_uuid(); newer_binding uuid:=gen_random_uuid(); e public.slm_events; previous jsonb;
 a public.slm_event_participants; b public.slm_event_participants; notification uuid; jobs jsonb; q jsonb; token text:='synthetic-fcm-'||gen_random_uuid();
begin
 insert into auth.users(id,aud,role,email) values(actor,'authenticated','authenticated',actor::text||'@fixture.invalid'),
  (member,'authenticated','authenticated',member::text||'@fixture.invalid');
 perform public.slm_account_provision(actor,'Fixture_'||substr(replace(actor::text,'-',''),1,16),'+12025550111',actor::text||'@fixture.invalid');
 perform public.slm_account_provision(member,'Fixture_'||substr(replace(member::text,'-',''),1,16),'+12025550112',member::text||'@fixture.invalid');
 update public.slm_account_security set must_change_password=false where user_id in (actor,member);
 insert into auth.sessions(id,user_id) values(actor_session,actor),(member_session,member);
 insert into public.slm_account_sessions(session_id,user_id,security_version)
  select actor_session,actor,security_version from public.slm_account_security where user_id=actor;
 insert into public.slm_account_sessions(session_id,user_id,security_version)
  select member_session,member,security_version from public.slm_account_security where user_id=member;
 perform public.slm_notifications_dispatch(member,member_session,'prepare_device',jsonb_build_object('device_id',device,'device_secret',secret));
 perform public.slm_notifications_dispatch(member,member_session,'register',jsonb_build_object('device_id',device,'device_secret',secret,
  'binding_id',binding,'binding_version',1,'token',token,'platform','android'));
 insert into public.slm_events(starts_at,location,capacity,created_by) values(clock_timestamp()+interval '3 days','Boisko fixture',10,actor) returning * into e;
 insert into public.slm_event_history(event_id,actor_id,action,server_time,cutoff_at,after_cutoff,snapshot)
  values(e.id,actor,'created',clock_timestamp(),e.starts_at,false,jsonb_build_object('event',to_jsonb(e)));
 if exists(select 1 from public.slm_notifications where event_id=e.id and user_id=actor and kind='new_match')
  or not exists(select 1 from public.slm_notifications where event_id=e.id and user_id=member and kind='new_match') then
  raise exception 'Błędni odbiorcy nowego meczu'; end if;
 select id into notification from public.slm_notifications where event_id=e.id and user_id=member and kind='new_match';
 begin
  perform public.slm_notifications_dispatch(actor,actor_session,'open',jsonb_build_object('notification_id',notification));
  raise exception 'Odczyt cudzego powiadomienia przeszedł';
 exception when others then if sqlerrm<>'not_found' then raise; end if; end;
 perform public.slm_notifications_dispatch(member,member_session,'read',jsonb_build_object('notification_id',notification));
 perform public.slm_notifications_dispatch(member,member_session,'read',jsonb_build_object('notification_id',notification));
 if (select read_at from public.slm_notifications where id=notification) is null then raise exception 'Nie zapisano przeczytania'; end if;

 insert into public.slm_event_participants(event_id,member_id,responsible_user_id,status) values(e.id,actor,actor,'registered') returning * into a;
 insert into public.slm_event_participants(event_id,member_id,responsible_user_id,status) values(e.id,member,member,'reserve') returning * into b;
 update public.slm_event_participants set status='withdrawn' where id=a.id returning * into a;
 insert into public.slm_event_history(event_id,participant_id,actor_id,responsible_user_id,action,server_time,cutoff_at,after_cutoff,snapshot)
  values(e.id,a.id,actor,actor,'withdrawn',clock_timestamp(),e.starts_at,false,
   jsonb_build_object('participant',to_jsonb(a),'previous_status','registered'));
 if (select count(*) from public.slm_notifications where event_id=e.id and user_id=member and kind='vacancy')<>1 then
  raise exception 'Brak powiadomienia rezerwy'; end if;
 if (select status from public.slm_event_participants where id=b.id)<>'reserve' then raise exception 'Nastąpił automatyczny awans'; end if;

 -- Kategorie wyłączają kanał push, nie historię.
 perform public.slm_notifications_dispatch(member,member_session,'preferences',jsonb_build_object('category','vacancy','push_enabled',false));
 jobs:=public.slm_push_claim(20);
 if exists(select 1 from jsonb_array_elements(jobs) j where j->>'kind'='vacancy') then raise exception 'Zignorowano preferencję push'; end if;
 if (select count(*) from public.slm_notifications where event_id=e.id and user_id=member and kind='vacancy')<>1 then raise exception 'Usunięto historię'; end if;
 -- Drugie pobranie nie może dostać trwających rezerwacji pierwszego workera.
 if exists(select 1 from jsonb_array_elements(public.slm_push_claim(20)) j
  where j->>'queue_id' in (select j2->>'queue_id' from jsonb_array_elements(jobs) j2)) then raise exception 'Podwójna rezerwacja'; end if;
 for q in select * from jsonb_array_elements(jobs) loop
  perform public.slm_push_finish((q->>'queue_id')::uuid,gen_random_uuid(),'sent','wrong_lease','',0);
  if (select state from public.slm_push_queue where id=(q->>'queue_id')::uuid)<>'leased' then raise exception 'Spóźniony worker zmienił rezerwację'; end if;
 end loop;

 -- Spóźniony detach starego powiązania nie usuwa nowej sesji/tokenu.
 perform public.slm_notifications_dispatch(member,member_session,'register',jsonb_build_object('device_id',device,'device_secret',secret,
  'binding_id',newer_binding,'binding_version',2,'token',token,'platform','android'));
 perform public.slm_push_detach(device,secret,binding,1);
 if not exists(select 1 from public.slm_push_devices where id=device and binding_id=newer_binding) then raise exception 'Detach usunął nowe powiązanie'; end if;
 begin
  perform public.slm_notifications_dispatch(member,member_session,'register',jsonb_build_object('device_id',device,'device_secret',secret,
   'binding_id',binding,'binding_version',1,'token',token,'platform','android'));
  raise exception 'Spóźniona rejestracja odtworzyła logout';
 exception when others then if sqlerrm<>'device_revoked' then raise; end if; end;

 previous:=to_jsonb(e);
 update public.slm_events set status='cancelled' where id=e.id returning * into e;
 insert into public.slm_event_history(event_id,actor_id,action,server_time,cutoff_at,after_cutoff,snapshot)
  values(e.id,actor,'cancelled',clock_timestamp(),e.starts_at,false,jsonb_build_object('event',to_jsonb(e),'previous_event',previous));
 if exists(select 1 from public.slm_push_reminders where event_id=e.id and state='pending') then raise exception 'Nie anulowano harmonogramu'; end if;
 for q in select * from jsonb_array_elements(jobs) loop
  if public.slm_push_check((q->>'queue_id')::uuid,(q->>'lease_id')::uuid,encode(sha256(convert_to(token,'UTF8')),'hex')) then
   raise exception 'Worker wysłałby powiadomienie anulowanego meczu'; end if;
 end loop;
 perform public.slm_push_detach(device,secret,newer_binding,2);
 if exists(select 1 from public.slm_push_devices where id=device) then raise exception 'Nie usunięto urządzenia'; end if;
 if has_column_privilege('authenticated','public.slm_push_devices','token','SELECT')
  or has_table_privilege('authenticated','public.slm_push_queue','INSERT')
  or has_function_privilege('anon','public.slm_push_claim(integer)','EXECUTE') then raise exception 'Nadmiarowe granty'; end if;
 raise notice 'Lokalne asercje powiadomień zakończone';
end $$;
rollback;

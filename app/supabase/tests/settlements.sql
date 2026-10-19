-- PRZYGOTOWANY, NIEURUCHOMIONY. Wyłącznie jednorazowa LOKALNA baza Supabase.
-- Nie używać zdalnego DATABASE_URL. Cały fixture kończy się ROLLBACK.
-- To kontrola silnika podziału/dziennika/FIFO, nie test rzeczywistego JWT/Edge.
begin;
do $$
declare
 users uuid[] := array[]::uuid[]; participants uuid[] := array[]::uuid[];
 e public.slm_events; e2 public.slm_events; e3 public.slm_events;
 person public.slm_event_participants; u uuid; v_replacement uuid; payment uuid:=gen_random_uuid();
 actor uuid; i integer; n bigint; total bigint; due bigint; paid bigint;
begin
 for i in 1..10 loop
  u:=gen_random_uuid(); users:=array_append(users,u);
  insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated',u::text||'@fixture.invalid');
  perform public.slm_account_provision(u,'Fixture_'||substr(replace(u::text,'-',''),1,16),
   '+1202'||lpad((floor(random()*10000000))::bigint::text,7,'0'),u::text||'@fixture.invalid');
 end loop;
 actor:=users[1];
 insert into public.slm_events(starts_at,location,total_cost,capacity,created_by)
  values('2020-01-16 18:30:00+00','Lokalny fixture',270.01,12,actor) returning * into e;
 for i in 1..10 loop
  insert into public.slm_event_participants(event_id,member_id,responsible_user_id,guest_name,status,joined_at)
   values(e.id,case when i=10 then null else users[i] end,case when i=10 then actor else users[i] end,
    case when i=10 then 'Gość fixture' end,'registered','2020-01-16 14:00:00+00') returning * into person;
  participants:=array_append(participants,person.id);
  insert into public.slm_event_history(event_id,participant_id,actor_id,responsible_user_id,action,server_time,cutoff_at,after_cutoff,snapshot)
   values(e.id,person.id,actor,person.responsible_user_id,'joined','2020-01-16 14:00:00+00',
    '2020-01-16 16:00:00+00',false,jsonb_build_object('event',to_jsonb(e),'participant',to_jsonb(person),'previous_status',null));
 end loop;
 select sum(amount_cents),count(*) filter(where payable) into total,n from slm_private.finance_preview(e.id);
 if total<>27001 or n<>10 then raise exception 'Niepoprawny podział groszy'; end if;
 if (select max(amount_cents)-min(amount_cents) from slm_private.finance_preview(e.id))>1 then
  raise exception 'Niepoprawna reszta groszy'; end if;
 select sum(amount_cents) into due from slm_private.finance_preview(e.id) where responsible_user_id=actor;
 if due not between 5400 and 5402 then raise exception 'Gość nie obciąża zapraszającego'; end if;

 -- 10 -> 9 po 17:00: wycofany udział nadal płaci, brak obecności nie zwalnia.
 update public.slm_event_participants set status='withdrawn',withdrawn_at='2020-01-16 16:01:00+00'
  where id=participants[2] returning * into person;
 insert into public.slm_event_history(event_id,participant_id,actor_id,responsible_user_id,action,server_time,cutoff_at,after_cutoff,snapshot)
  values(e.id,person.id,actor,person.responsible_user_id,'withdrawn','2020-01-16 16:01:00+00',
   '2020-01-16 16:00:00+00',true,jsonb_build_object('participant',to_jsonb(person),'previous_status','registered'));
 if not (select payable from slm_private.finance_preview(e.id) where participant_id=participants[2]) then
  raise exception 'Brak obowiązku przy spadku poniżej 10'; end if;
 update public.slm_event_participants set absent=true where id=participants[1];
 if not (select payable from slm_private.finance_preview(e.id) where participant_id=participants[1]) then
  raise exception 'Nieobecność zwolniła z opłaty'; end if;

 -- Skuteczny nowy zapis konsumuje tylko jedno oczekujące zobowiązanie.
 insert into public.slm_event_participants(event_id,member_id,responsible_user_id,status,joined_at)
  values(e.id,users[10],users[10],'registered','2020-01-16 16:02:00+00') returning * into person;
 v_replacement:=person.id;
 insert into public.slm_event_history(event_id,participant_id,actor_id,responsible_user_id,action,server_time,cutoff_at,after_cutoff,snapshot)
  values(e.id,person.id,actor,person.responsible_user_id,'joined','2020-01-16 16:02:00+00',
   '2020-01-16 16:00:00+00',true,jsonb_build_object('participant',to_jsonb(person),'previous_status',null));
 if (select payable from slm_private.finance_preview(e.id) where participant_id=participants[2])
  or (select replacement_id from public.slm_settlement_shares where participant_id=participants[2]) is distinct from v_replacement
  then raise exception 'Zastępstwo nie przeniosło zobowiązania'; end if;
 if (select sum(amount_cents) from slm_private.finance_preview(e.id))<>27001 then raise exception 'Utracono grosze po zastępstwie'; end if;

 -- 11 -> 10 po 17:00: domyślne zwolnienie (nadal minimum 10).
 insert into public.slm_event_participants(event_id,responsible_user_id,guest_name,status,joined_at)
  values(e.id,actor,'Drugi gość fixture','registered','2020-01-16 16:03:00+00') returning * into person;
 insert into public.slm_event_history(event_id,participant_id,actor_id,responsible_user_id,action,server_time,cutoff_at,after_cutoff,snapshot)
  values(e.id,person.id,actor,actor,'joined','2020-01-16 16:03:00+00','2020-01-16 16:00:00+00',true,
   jsonb_build_object('participant',to_jsonb(person),'previous_status',null));
 update public.slm_event_participants set status='withdrawn',withdrawn_at='2020-01-16 16:04:00+00' where id=person.id returning * into person;
 insert into public.slm_event_history(event_id,participant_id,actor_id,responsible_user_id,action,server_time,cutoff_at,after_cutoff,snapshot)
  values(e.id,person.id,actor,actor,'withdrawn','2020-01-16 16:04:00+00','2020-01-16 16:00:00+00',true,
   jsonb_build_object('participant',to_jsonb(person),'previous_status','registered'));
 if (select payable from slm_private.finance_preview(e.id) where participant_id=person.id) then raise exception 'Naliczono przy pozostającym minimum 10'; end if;

 -- Zwolnienie gościa przelicza wszystkich, koszt pozostaje dokładny.
 update public.slm_settlement_shares set charge_override=false where participant_id=participants[10];
 if (select amount_cents from slm_private.finance_preview(e.id) where participant_id=participants[10])<>0
  or (select sum(amount_cents) from slm_private.finance_preview(e.id))<>27001 then raise exception 'Błędne zwolnienie gościa'; end if;
 if exists(select 1 from slm_private.finance_dues(actor)) then raise exception 'Robocze rozliczenie tworzy zaległość'; end if;

 -- Zapis zatwierdzenia tu służy wyłącznie fixture silnika. API/JWT sprawdzić osobno.
 update public.slm_settlements set approved_at=clock_timestamp(),approved_by=actor where event_id=e.id;
 perform slm_private.finance_revise(e.id,actor,'Zatwierdzenie lokalnego fixture');
 if (select sum(amount_cents) from public.slm_finance_ledger where event_id=e.id)<>-27001 then raise exception 'Błędny dziennik należności'; end if;
 update public.slm_events set total_cost_cents=27003 where id=e.id;
 perform slm_private.finance_revise(e.id,actor,'Korekta kosztu fixture');
 if (select sum(amount_cents) from public.slm_finance_ledger where event_id=e.id)<>-27003
  or (select count(*) from public.slm_settlement_revisions where event_id=e.id)<>2 then raise exception 'Korekta nadpisała historię'; end if;
 begin
  update public.slm_finance_ledger set reason='Niedozwolone' where event_id=e.id;
  raise exception 'Dziennik pozwolił na UPDATE';
 exception when others then
  if sqlerrm<>'immutable_finance_history' then raise; end if;
 end;

 -- Drugi zakończony mecz tego samego konta. Kredyt pokrywa najstarszy.
 insert into public.slm_events(starts_at,location,total_cost,capacity,created_by)
  values('2020-01-17 18:30:00+00','Drugie boisko fixture',100,10,actor) returning * into e2;
 insert into public.slm_event_participants(event_id,member_id,responsible_user_id,status)
  values(e2.id,actor,actor,'registered') returning * into person;
 insert into public.slm_settlements(event_id,approved_at,approved_by) values(e2.id,clock_timestamp(),actor);
 insert into public.slm_settlement_shares(participant_id,event_id,default_payable) values(person.id,e2.id,true);
 perform slm_private.finance_revise(e2.id,actor,'Drugi mecz fixture');
 if (select count(*) from slm_private.finance_dues(actor) where outstanding_cents>0)<>2 then raise exception 'Nie liczono dwóch meczów'; end if;
 select due_cents into due from slm_private.finance_dues(actor) where event_id=e.id;
 paid:=due+1;
 insert into public.slm_payments(id,user_id,amount_cents,corrected_amount_cents,status,submitted_by,note,decided_by,decided_at)
  values(payment,actor,paid,paid,'accepted',actor,'Fixture',actor,clock_timestamp());
 insert into public.slm_finance_ledger(user_id,payment_id,amount_cents,kind,actor_id,reason)
  values(actor,payment,paid,'payment',actor,'Fixture');
 if (select outstanding_cents from slm_private.finance_dues(actor) where event_id=e.id)<>0
  or (select covered_cents from slm_private.finance_dues(actor) where event_id=e2.id)<>1 then raise exception 'Nie działa FIFO / częściowa wpłata'; end if;
 if (select count(*) from slm_private.finance_dues(actor) where outstanding_cents>0)<>1 then raise exception 'Blokada nie znikła po wpłacie'; end if;
 begin
  insert into public.slm_finance_ledger(user_id,payment_id,amount_cents,kind,actor_id,reason)
   values(actor,payment,paid,'payment',actor,'Duplikat');
  raise exception 'Podwójna wpłata została zaksięgowana';
 exception when unique_violation then null;
 end;
 -- Korekta wpłaty do zera odtwarza oba długi; poprzedni kredyt pozostaje w dzienniku.
 update public.slm_payments set corrected_amount_cents=0 where id=payment;
 insert into public.slm_finance_ledger(user_id,payment_id,amount_cents,kind,actor_id,reason)
  values(actor,payment,-paid,'payment_correction',actor,'Wycofanie fixture');
 if (select count(*) from slm_private.finance_dues(actor) where outstanding_cents>0)<>2 then raise exception 'Korekta wpłaty nie odtworzyła długów'; end if;

 -- Nawet awaryjny zapis przyszłego meczu nie może wpływać na blokadę.
 insert into public.slm_events(starts_at,location,total_cost,capacity,created_by)
  values(clock_timestamp()+interval '1 day','Przyszły fixture',10,10,actor) returning * into e3;
 insert into public.slm_settlements(event_id,approved_at,approved_by) values(e3.id,clock_timestamp(),actor);
 insert into public.slm_event_participants(event_id,member_id,responsible_user_id,status)
  values(e3.id,actor,actor,'registered') returning * into person;
 insert into public.slm_settlement_shares(participant_id,event_id,default_payable) values(person.id,e3.id,true);
 perform slm_private.finance_revise(e3.id,actor,'Wyłącznie fixture silnika');
 if exists(select 1 from slm_private.finance_dues(actor) where event_id=e3.id) then raise exception 'Niezakończony mecz blokuje'; end if;

 if has_function_privilege('authenticated','public.slm_settlements_dispatch(uuid,uuid,text,jsonb)','execute')
  or has_function_privilege('anon','public.slm_settlements_dispatch(uuid,uuid,text,jsonb)','execute')
  or has_table_privilege('authenticated','public.slm_finance_ledger','insert')
  then raise exception 'Klient ma finansowy write/RPC'; end if;
 raise notice 'Silnik rozliczeń: lokalne asercje zakończone';
end $$;
rollback;

-- Ocena (zapis ocen) i bramki (zapis gole/asysty) to osobne akcje; ta migracja dodaje:
--  1. gole i asysty z zakończonych meczów widoczne na profilu od razu po zapisie (przed finalizacją okna 48 h),
--     bez podwójnego liczenia po finalizacji (miesięczne sumy liczą tylko mecze sfinalizowane),
--  2. mecz trafia do historii dopiero 48 h po zakończeniu (do tego czasu jest na liście bieżących),
--  3. odznaka SLM-MAT-001 (debiutant) od razu po zakończeniu pierwszego meczu, bez czekania na finalizację,
--  4. zapisy na płatne mecze zawodnika, który ma co najmniej dwie nieuregulowane płatności, są automatycznie anulowane.
-- Okno ocen i MVP (48 h) oraz wzór oceny pozostają bez zmian.
begin;

-- 1. Statystyki profilu (ta sama funkcja co wcześniej, tylko dwa wyrażenia statystyk).
create or replace function public.slm_ratings_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.slm_matches; phase text; target uuid; k text; v jsonb; team text; mvp uuid; a integer; b integer;
begin
 -- Same lock order as the other dispatchers: global gate, actor, event.
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_action is null or p_action not in ('overview','player','get','rate','stats','score') then raise exception 'invalid_action';end if;
 if jsonb_typeof(p_body) is distinct from 'object' then raise exception 'invalid_input';end if;
 perform slm_private.rating_settle();

 if p_action='overview' then
  if p_body<>'{}'::jsonb then raise exception 'invalid_input';end if;
  return jsonb_build_object('me',slm_private.rating_public(p_user)||jsonb_build_object('stats',(select jsonb_build_object(
     'played',coalesce(sum(t.played),0),'goals',coalesce(sum(t.goals),0)+(select coalesce(sum(st.goals),0) from public.slm_match_stats st join public.slm_matches e on e.id=st.event_id left join public.slm_match_rating_state rs on rs.event_id=e.id where st.user_id=p_user and e.status<>'cancelled' and e.starts_at+make_interval(mins=>e.duration_minutes)<=clock_timestamp() and rs.finalized_at is null),'assists',coalesce(sum(t.assists),0)+(select coalesce(sum(st.assists),0) from public.slm_match_stats st join public.slm_matches e on e.id=st.event_id left join public.slm_match_rating_state rs on rs.event_id=e.id where st.user_id=p_user and e.status<>'cancelled' and e.starts_at+make_interval(mins=>e.duration_minutes)<=clock_timestamp() and rs.finalized_at is null),
     'mvp',(select count(*) from public.slm_mvp_gold g where g.user_id=p_user)) from public.slm_rating_months t where t.user_id=p_user)),
   'gold',(select coalesce(jsonb_agg(h order by h),'[]'::jsonb) from slm_private.rating_gold_holders() h
    where h=p_user or exists(select 1 from public.slm_group_members mine join public.slm_group_members theirs on theirs.group_id=mine.group_id
     join public.slm_groups g on g.id=mine.group_id and not g.archived where mine.user_id=p_user and theirs.user_id=h)));
 end if;
 if p_action='player' then
  if jsonb_typeof(p_body->'user_id') is distinct from 'string' or exists(select 1 from jsonb_object_keys(p_body) x where x<>'user_id') then raise exception 'invalid_input';end if;
  target:=(p_body->>'user_id')::uuid;
  if target<>p_user and not exists(select 1 from public.slm_group_members mine join public.slm_group_members theirs on theirs.group_id=mine.group_id
    join public.slm_groups g on g.id=mine.group_id and not g.archived where mine.user_id=p_user and theirs.user_id=target) then raise exception 'not_found';end if;
  return slm_private.rating_public(target)||jsonb_build_object('gold',exists(select 1 from slm_private.rating_gold_holders() h where h=target),
   'stats',(select jsonb_build_object(
     'played',coalesce(sum(t.played),0),'goals',coalesce(sum(t.goals),0)+(select coalesce(sum(st.goals),0) from public.slm_match_stats st join public.slm_matches e on e.id=st.event_id left join public.slm_match_rating_state rs on rs.event_id=e.id where st.user_id=target and e.status<>'cancelled' and e.starts_at+make_interval(mins=>e.duration_minutes)<=clock_timestamp() and rs.finalized_at is null),'assists',coalesce(sum(t.assists),0)+(select coalesce(sum(st.assists),0) from public.slm_match_stats st join public.slm_matches e on e.id=st.event_id left join public.slm_match_rating_state rs on rs.event_id=e.id where st.user_id=target and e.status<>'cancelled' and e.starts_at+make_interval(mins=>e.duration_minutes)<=clock_timestamp() and rs.finalized_at is null),
     'mvp',(select count(*) from public.slm_mvp_gold g where g.user_id=target)) from public.slm_rating_months t where t.user_id=target));
 end if;

 if jsonb_typeof(p_body->'event_id') is distinct from 'string' then raise exception 'invalid_input';end if;
 if exists(select 1 from jsonb_object_keys(p_body) x where x<>all(case p_action when 'get' then array['event_id']
   when 'rate' then array['event_id','ratings','mvp_user','action_team'] when 'stats' then array['event_id','goals','assists']
   else array['event_id','score_a','score_b'] end)) then raise exception 'invalid_input';end if;
 select * into e from public.slm_matches where id=(p_body->>'event_id')::uuid for update;
 if not found then raise exception 'not_found';end if;
 perform 1 from public.slm_group_members where group_id=e.group_id and user_id=p_user for share;
 if not found then raise exception 'not_found';end if;
 if p_action='get' then return slm_private.rating_match_state(e.id,p_user);end if;

 phase:=slm_private.rating_match_state(e.id,p_user)->>'phase';
 if phase<>'open' then raise exception 'rating_closed';end if;
 if not exists(select 1 from slm_private.rating_participants(e.id) x where x.user_id=p_user) then raise exception 'forbidden';end if;
 insert into public.slm_match_rating_state(event_id) values(e.id) on conflict(event_id) do nothing;

 if p_action='rate' then
  if jsonb_typeof(p_body->'ratings') is distinct from 'object' then raise exception 'invalid_input';end if;
  -- One ballot per player, final once sent.
  if exists(select 1 from public.slm_match_votes where event_id=e.id and voter_id=p_user) then raise exception 'ballot_final';end if;
  for k,v in select * from jsonb_each(p_body->'ratings') loop
   if jsonb_typeof(v) is distinct from 'number' or v::text!~'^([1-9]|10)$' then raise exception 'invalid_input';end if;
   target:=k::uuid;
   if target=p_user or not exists(select 1 from slm_private.rating_participants(e.id) x where x.user_id=target) then raise exception 'invalid_input';end if;
   insert into public.slm_match_ratings(event_id,rater_id,target_id,score) values(e.id,p_user,target,v::text::smallint);
  end loop;
  if jsonb_typeof(coalesce(p_body->'mvp_user','null'::jsonb)) not in ('string','null')
   or jsonb_typeof(coalesce(p_body->'action_team','null'::jsonb)) not in ('string','null') then raise exception 'invalid_input';end if;
  mvp:=nullif(p_body->>'mvp_user','')::uuid;team:=p_body->>'action_team';
  if team is not null and team not in ('a','b') then raise exception 'invalid_input';end if;
  if mvp is not null and (mvp=p_user or not exists(select 1 from slm_private.rating_participants(e.id) x where x.user_id=mvp)) then raise exception 'invalid_input';end if;
  insert into public.slm_match_votes(event_id,voter_id,mvp_user,action_team) values(e.id,p_user,mvp,team);
  perform slm_private.rating_try_early_gold(e.id);
 elsif p_action='stats' then
  if jsonb_typeof(p_body->'goals') is distinct from 'number' or jsonb_typeof(p_body->'assists') is distinct from 'number'
   or (p_body->>'goals')!~'^[0-9]{1,2}$' or (p_body->>'assists')!~'^[0-9]{1,2}$' then raise exception 'invalid_input';end if;
  a:=(p_body->>'goals')::integer;b:=(p_body->>'assists')::integer;
  if a>50 or b>50 then raise exception 'invalid_input';end if;
  insert into public.slm_match_stats(event_id,user_id,goals,assists) values(e.id,p_user,a,b)
   on conflict(event_id,user_id) do update set goals=excluded.goals,assists=excluded.assists,updated_at=clock_timestamp();
 else
  if jsonb_typeof(p_body->'score_a') is distinct from 'number' or jsonb_typeof(p_body->'score_b') is distinct from 'number'
   or (p_body->>'score_a')!~'^[0-9]{1,2}$' or (p_body->>'score_b')!~'^[0-9]{1,2}$' then raise exception 'invalid_input';end if;
  update public.slm_match_rating_state set score_a=(p_body->>'score_a')::smallint,score_b=(p_body->>'score_b')::smallint,
   score_by=p_user,score_at=clock_timestamp() where event_id=e.id;
 end if;
 return slm_private.rating_match_state(e.id,p_user);
end $$;

-- 2. Historia: 48 h po zakończeniu meczu (start + czas trwania + 48 h), nie od startu.
do $patch$
declare definition text;old text[];replacement text[];i integer;
begin
 select pg_get_functiondef('slm_private.match_discovery_list(uuid,uuid,jsonb)'::regprocedure) into definition;
 old:=array['or e.starts_at<=v_now)','e.status=''scheduled'' and e.starts_at>v_now)'];
 replacement:=array['or e.starts_at+make_interval(mins=>e.duration_minutes)+interval ''48 hours''<=v_now)',
  'e.status=''scheduled'' and e.starts_at+make_interval(mins=>e.duration_minutes)+interval ''48 hours''>v_now)'];
 for i in 1..array_length(old,1) loop
  if (length(definition)-length(replace(definition,old[i],'')))/length(old[i])<>1 then raise exception 'history_window_contract_changed';end if;
  definition:=replace(definition,old[i],replacement[i]);
 end loop;
 execute definition;
end $patch$;

-- 3. Odznaka debiutanta: pierwszy rozegrany mecz liczy się, gdy się skończył (bez finalizacji okna ocen).
create function slm_private.badges_debut() returns integer
language plpgsql security invoker set search_path='' as $$
declare since timestamptz; k integer;
begin
 select c.enabled_from into since from public.slm_badge_config c;
 insert into public.slm_badges(user_id,code,group_id,season,source_event_id)
 select distinct on (p.member_id) p.member_id,'SLM-MAT-001',null::uuid,null::integer,e.id
 from public.slm_matches e
 join public.slm_match_entries p on p.event_id=e.id and p.member_id is not null and p.status='registered' and not p.absent
 where e.status<>'cancelled' and e.starts_at>=since
  and e.starts_at+make_interval(mins=>e.duration_minutes)<=clock_timestamp()
  and exists(select 1 from auth.users au where au.id=p.member_id)
 order by p.member_id,e.starts_at,e.id
 on conflict on constraint slm_badges_once do nothing;
 get diagnostics k=row_count;
 return k;
end $$;
revoke all on function slm_private.badges_debut() from public,anon,authenticated;
grant execute on function slm_private.badges_debut() to service_role;

do $patch$
declare definition text;needle text:=E'\n foreach u in array users loop perform slm_private.badges_award(u);end loop;';
begin
 select pg_get_functiondef('slm_private.badges_settle()'::regprocedure) into definition;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'badges_settle_contract_changed';end if;
 execute replace(definition,needle,needle||E'\n perform slm_private.badges_debut();');
end $patch$;

-- 4. Zaległości: zawodnik z co najmniej dwiema nieuregulowanymi płatnościami nie może być zapisany na przyszły płatny mecz.
-- Zapis (także rezerwa) jest wycofywany tak jak akcja „withdraw”, z historią, składem i powiadomieniem; blokadę zapisu nakłada ta sama
-- funkcja registration_allowed co przy zapisie, więc nie ma osobnej reguły. Uruchamia ją okresowy worker powiadomień.
create function slm_private.debt_enforce_registrations() returns integer
language plpgsql security invoker set search_path='' as $$
declare r record; e public.slm_matches; old public.slm_match_entries; person public.slm_match_entries; seq bigint; n integer:=0;
begin
 perform pg_advisory_xact_lock(20261014,1);
 for r in select p.id entry_id,p.event_id from public.slm_match_entries p join public.slm_matches m on m.id=p.event_id
   where p.status in ('registered','reserve') and p.member_id is not null and p.responsible_user_id=p.member_id
    and m.status='scheduled' and m.cost_cents>0 and m.starts_at>clock_timestamp()
    and not slm_private.registration_allowed(p.member_id,m.cost_cents)
   order by m.starts_at,p.id loop
  begin
   select * into e from public.slm_matches where id=r.event_id for update;
   select * into old from public.slm_match_entries where id=r.entry_id for update;
   continue when old.status not in ('registered','reserve');
   update public.slm_match_entries set status='withdrawn',withdrawn_at=clock_timestamp(),payable=false,release_sequence=null
    where id=old.id returning * into person;
   insert into public.slm_match_history(event_id,entry_id,actor_id,action,snapshot)
    values(e.id,person.id,e.created_by,'withdrawn',jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(person),
     'request',jsonb_build_object('reason','debt_block','system',true))) returning sequence into seq;
   perform slm_private.tito_lineup_transition(e.id,person.id,'withdrawn',old.status);
   update public.slm_matches set version=version+1 where id=e.id returning * into e;
   perform slm_private.group_revise(e.id,e.created_by,'Zaległości blokują udział');
   perform slm_private.group_surplus_sync(e.group_id,e.created_by);
   perform slm_private.notification_emit('debtremoved:'||seq,'registration_removed','finance',null,
    'Zapis anulowany','Masz co najmniej dwie nieuregulowane płatności, więc zapis na mecz „'||e.name||'” został anulowany. Uregulujesz zaległość i zapiszesz się ponownie.',
    e.starts_at,array[old.member_id]);
   n:=n+1;
  exception when others then
   -- Jeden problematyczny zapis nie może zatrzymać pozostałych; zostanie ponowiony przy kolejnym przebiegu.
   null;
  end;
 end loop;
 return n;
end $$;
revoke all on function slm_private.debt_enforce_registrations() from public,anon,authenticated;
grant execute on function slm_private.debt_enforce_registrations() to service_role;

do $patch$
declare definition text;needle text:=E'\n n:=n+slm_private.payment_reminders();';
begin
 select pg_get_functiondef('public.slm_notifications_prepare()'::regprocedure) into definition;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'notifications_prepare_contract_changed';end if;
 execute replace(definition,needle,needle||E'\n n:=n+slm_private.debt_enforce_registrations();');
end $patch$;

commit;

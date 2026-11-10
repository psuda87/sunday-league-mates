-- Additive completion of Tito. No data backfill runs during migration.
begin;
alter table public.slm_match_entries add column lineup_last_team text
 check(lineup_last_team in ('a','b'));
-- Nullable updated_by already supports privacy erasure on main. Null is NOT Tito.
alter table public.slm_match_lineups add column actor_type text not null default 'manual'
 check(actor_type in ('manual','automatic'));

create or replace function slm_private.lineup_present(p_state jsonb,p_viewer uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select (p_state-'updated_by'-'updated_at'-'actor_type')||jsonb_build_object(
 'can_write',exists(select 1 from public.slm_groups g join public.slm_group_members m on m.group_id=g.id and m.user_id=p_viewer
  where g.id=e.group_id and not g.archived and g.admin_id=p_viewer),
 'last_change',case when p_state->>'updated_at' is null then null else jsonb_build_object(
  -- Old receipts predate actor_type: they are always manual, including erased authors.
  'actor_type',coalesce(p_state->>'actor_type','manual'),
  'user_id',p_state->'updated_by',
  'display_name',case when p_state->>'actor_type'='automatic' then 'Tito'
   when p_state->>'updated_by' is null then 'Usunięty użytkownik'
   else coalesce(slm_private.profile_display_name(p_viewer,(p_state->>'updated_by')::uuid,e.group_id),
    slm_private.public_player_name((p_state->>'updated_by')::uuid),'Zawodnik') end,
  'changed_at',p_state->'updated_at') end)
 from public.slm_matches e where e.id=(p_state->>'event_id')::uuid;
$$;

-- Patch the FINAL main definitions; fail atomically if any integration point changed.
do $patch$
declare definition text; needle text;
begin
 select pg_get_functiondef('slm_private.lineup_state(uuid)'::regprocedure) into definition;
 needle:='''updated_by'',l.updated_by,''updated_at'',l.updated_at';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'tito_state_contract_changed';end if;
 execute replace(definition,needle,needle||',''actor_type'',l.actor_type');
 select pg_get_functiondef('public.slm_lineups_dispatch(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 needle:='roster_version=excluded.roster_version,updated_by=excluded.updated_by,updated_at=excluded.updated_at;';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'tito_manual_contract_changed';end if;
 execute replace(definition,needle,'roster_version=excluded.roster_version,updated_by=excluded.updated_by,updated_at=excluded.updated_at,actor_type=''manual'';');
end $patch$;

-- Called inside the match transaction, after its version increment and before
-- finance, notifications and receipt. Any later error rolls ALL changes back.
create function slm_private.tito_lineup_transition(p_event uuid,p_entry uuid,p_action text,p_previous_status text,p_initiator uuid default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare l public.slm_match_lineups; person public.slm_match_entries; a uuid[]; b uuid[];
 prior text; chosen text; ca integer; cb integer; roster text;
begin
 if p_action not in ('joined','reserved','withdrawn') then return false;end if;
 -- Both dispatchers: global gate -> actor -> event -> lineup. Reentrant locks.
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_matches where id=p_event for update;
 if not found then raise exception 'tito_event_not_found';end if;
 select * into person from public.slm_match_entries where id=p_entry and event_id=p_event;
 if not found then raise exception 'tito_entry_not_found';end if;
 select * into l from public.slm_match_lineups where event_id=p_event for update;
 a:=coalesce(l.team_a,'{}'::uuid[]);b:=coalesce(l.team_b,'{}'::uuid[]);
 if p_action in ('reserved','withdrawn') then
  prior:=case when p_entry=any(a) then 'a' when p_entry=any(b) then 'b' end;
  -- Withdrawal from reserve retains its remembered side too.
  if prior is null then return false;end if;
  update public.slm_match_entries set lineup_last_team=prior where id=p_entry;
  a:=array_remove(a,p_entry);b:=array_remove(b,p_entry);
 else
  if person.status<>'registered' then raise exception 'tito_entry_not_registered';end if;
  if p_entry=any(a) or p_entry=any(b) then return false;end if;
  select count(*) filter(where id=any(a)),count(*) filter(where id=any(b)) into ca,cb
   from public.slm_match_entries where event_id=p_event and status='registered';
  prior:=case when p_previous_status in ('reserve','withdrawn') then person.lineup_last_team end;
  if prior is null and p_previous_status is null and person.member_id is not null then
   -- The new member participation ID stays new; only the last historical side transfers.
   select p.lineup_last_team into prior from public.slm_match_entries p
    where p.event_id=p_event and p.member_id=person.member_id and p.id<>p_entry and p.status='withdrawn'
    order by p.withdrawn_at desc nulls last,p.joined_at desc,p.id desc limit 1;
  end if;
  if prior='a' and abs((ca+1)-cb)<=1 then chosen:='a';
  elsif prior='b' and abs(ca-(cb+1))<=1 then chosen:='b';
  elsif ca<cb then chosen:='a';elsif cb<ca then chosen:='b';
  else chosen:=case when random()<0.5 then 'a' else 'b' end;end if;
  if chosen='a' then a:=array_append(a,p_entry);else b:=array_append(b,p_entry);end if;
 end if;
 select coalesce(array_agg(x order by x),'{}'::uuid[]) into a from unnest(a) x;
 select coalesce(array_agg(x order by x),'{}'::uuid[]) into b from unnest(b) x;
 roster:=slm_private.lineup_state(p_event)->>'roster_version';
 insert into public.slm_match_lineups(event_id,version,team_a,team_b,roster_version,updated_by,updated_at,actor_type)
 values(p_event,1,a,b,roster,p_initiator,clock_timestamp(),'automatic')
 on conflict(event_id) do update set version=public.slm_match_lineups.version+1,
  team_a=excluded.team_a,team_b=excluded.team_b,roster_version=excluded.roster_version,
  updated_by=excluded.updated_by,updated_at=excluded.updated_at,actor_type='automatic';
 return true;
end $$;

do $patch$
declare definition text; needle text;
begin
 select pg_get_functiondef('slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 needle:=' update public.slm_matches set version=version+1 where id=e.id returning * into e;';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'tito_match_contract_changed';end if;
 definition:=replace(definition,needle,needle||E'\n if person.id is not null and v_action in (''joined'',''reserved'',''withdrawn'') then\n  perform slm_private.tito_lineup_transition(e.id,person.id,v_action,old_person.status,p_user);\n end if;');
 needle:='if person.status=v_status then raise exception ''duplicate_signup'';end if;';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'tito_reserve_contract_changed';end if;
 definition:=replace(definition,needle,needle||E'\n     if person.status=''reserve'' and v_status=''registered'' and v_target<>p_user then raise exception ''forbidden'';end if;');
 -- One set-based profile join, inside the EXISTING authorized participant projection.
 needle:='''status'',p.status,''absent'',p.absent,''joined_at'',p.joined_at';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'tito_detail_contract_changed';end if;
 definition:=replace(definition,needle,needle||',''jersey_number'',shirt.jersey_number');
 needle:='left join public.slm_aliases a on a.user_id=p.responsible_user_id';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'tito_jersey_contract_changed';end if;
 execute replace(definition,needle,needle||E'\n   left join public.slm_player_profiles shirt on shirt.user_id=p.member_id');
end $patch$;

-- Explicit, selected-event operator maintenance, NOT a client/Edge RPC.
-- Apply fails quickly when another writer owns the global gate. All writes are
-- transactional; caller should use SET LOCAL lock_timeout/statement_timeout.
create function slm_private.tito_backfill(p_events uuid[],p_apply boolean default false)
returns table(event_id uuid,missing_count bigint,applied_count bigint)
language plpgsql security invoker set search_path='' as $$
declare e record; entry record;
begin
 if p_apply is null or p_events is null or cardinality(p_events)=0 or cardinality(p_events)>100
  or array_position(p_events,null) is not null then raise exception 'invalid_input';end if;
 if p_apply and not pg_try_advisory_xact_lock(20261014,1) then raise exception 'tito_backfill_busy';end if;
 for e in select m.id from public.slm_matches m where m.id=any(p_events)
  and m.status='scheduled' and m.starts_at>clock_timestamp() order by m.id loop
  if p_apply then
   perform 1 from public.slm_matches m where m.id=e.id and m.status='scheduled' and m.starts_at>clock_timestamp() for update;
   if not found then continue;end if;
  end if;
  select count(*) into missing_count from public.slm_match_entries p left join public.slm_match_lineups l on l.event_id=p.event_id
   where p.event_id=e.id and p.status='registered' and not(p.id=any(coalesce(l.team_a,'{}'::uuid[])||coalesce(l.team_b,'{}'::uuid[])));
  event_id:=e.id;applied_count:=0;
  if p_apply and missing_count>0 then
   for entry in select p.id from public.slm_match_entries p left join public.slm_match_lineups l on l.event_id=p.event_id
    where p.event_id=e.id and p.status='registered' and not(p.id=any(coalesce(l.team_a,'{}'::uuid[])||coalesce(l.team_b,'{}'::uuid[])))
    order by p.joined_at,p.id loop
    if slm_private.tito_lineup_transition(e.id,entry.id,'joined',null) then applied_count:=applied_count+1;end if;
   end loop;
  end if;
  return next;
 end loop;
end $$;
revoke all on function slm_private.tito_lineup_transition(uuid,uuid,text,text,uuid),slm_private.tito_backfill(uuid[],boolean) from public,anon,authenticated;
grant execute on function slm_private.tito_lineup_transition(uuid,uuid,text,text,uuid) to service_role;
revoke all on function slm_private.tito_backfill(uuid[],boolean) from service_role;
commit;

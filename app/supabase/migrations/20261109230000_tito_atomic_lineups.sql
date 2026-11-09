-- Tito: transactional lineup maintenance. No existing event is backfilled by this migration.
begin;
alter table public.slm_match_entries add column lineup_last_team text
  check (lineup_last_team in ('a','b'));
alter table public.slm_match_lineups alter column updated_by drop not null;

-- A null author on a saved version represents Tito, never an Auth identity.
create or replace function slm_private.lineup_present(p_state jsonb,p_viewer uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select (p_state-'updated_by'-'updated_at')||jsonb_build_object(
 'can_write',exists(select 1 from public.slm_groups g join public.slm_group_members m on m.group_id=g.id and m.user_id=p_viewer where g.id=e.group_id and not g.archived and g.admin_id=p_viewer),
 'last_change', case when p_state->>'updated_at' is null then null
 when p_state->>'updated_by' is null then jsonb_build_object('actor_type','automatic','user_id',null,'display_name','Tito','changed_at',p_state->'updated_at')
 else jsonb_build_object('user_id',p_state->>'updated_by',
 'display_name',coalesce(slm_private.profile_display_name(p_viewer,(p_state->>'updated_by')::uuid,e.group_id),
 slm_private.public_player_name((p_state->>'updated_by')::uuid),'Zawodnik'), 'changed_at',p_state->'updated_at') end)
 from public.slm_matches e where e.id=(p_state->>'event_id')::uuid;
$$;

-- Reacquire the same gate and event lock as the dispatcher before any lineup lock.
-- Locks are transaction-scoped and reentrant. Only the affected entry moves.
create function slm_private.tito_lineup_transition(p_event uuid,p_entry uuid,p_action text,p_previous_status text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare l public.slm_match_lineups; person public.slm_match_entries; a uuid[]; b uuid[];
 prior text; chosen text; ca integer; cb integer; roster text; changed boolean:=false;
begin
 if p_action not in ('joined','reserved','withdrawn') then return false; end if;
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_matches where id=p_event for update;
 if not found then raise exception 'tito_event_not_found'; end if;
 select * into person from public.slm_match_entries where id=p_entry and event_id=p_event;
 if not found then raise exception 'tito_entry_not_found'; end if;
 select * into l from public.slm_match_lineups where event_id=p_event for update;
 a:=coalesce(l.team_a,'{}'::uuid[]); b:=coalesce(l.team_b,'{}'::uuid[]);
 if p_action in ('reserved','withdrawn') then
  if p_previous_status is distinct from 'registered' then return false; end if;
  prior:=case when p_entry=any(a) then 'a' when p_entry=any(b) then 'b' else null end;
  if prior is null then return false; end if;
  update public.slm_match_entries set lineup_last_team=case when p_action='reserved' then prior else null end where id=p_entry;
  a:=array_remove(a,p_entry); b:=array_remove(b,p_entry); changed:=true;
 elsif p_action='joined' then
  if person.status<>'registered' then raise exception 'tito_entry_not_registered'; end if;
  if p_entry=any(a) or p_entry=any(b) then return false; end if;
  select count(*) filter(where id=any(a)),count(*) filter(where id=any(b)) into ca,cb
  from public.slm_match_entries where event_id=p_event and status='registered';
  prior:=case when p_previous_status='reserve' then person.lineup_last_team else null end;
  if prior='a' and abs((ca+1)-cb)<=1 then chosen:='a';
  elsif prior='b' and abs(ca-(cb+1))<=1 then chosen:='b';
  elsif ca<cb then chosen:='a'; elsif cb<ca then chosen:='b';
  else chosen:=case when random()<0.5 then 'a' else 'b' end; end if;
  if chosen='a' then a:=array_append(a,p_entry); else b:=array_append(b,p_entry); end if;
  changed:=true;
 end if;
 if changed then
  select coalesce(array_agg(x order by x),'{}'::uuid[]) into a from unnest(a) x;
  select coalesce(array_agg(x order by x),'{}'::uuid[]) into b from unnest(b) x;
  roster:=slm_private.lineup_state(p_event)->>'roster_version';
  insert into public.slm_match_lineups(event_id,version,team_a,team_b,roster_version,updated_by,updated_at)
  values(p_event,1,a,b,roster,null,clock_timestamp())
  on conflict(event_id) do update set version=public.slm_match_lineups.version+1,
   team_a=excluded.team_a,team_b=excluded.team_b,roster_version=excluded.roster_version,
   updated_by=null,updated_at=excluded.updated_at;
 end if;
 return changed;
end $$;
revoke all on function slm_private.tito_lineup_transition(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function slm_private.tito_lineup_transition(uuid,uuid,text,text) to service_role;

-- Existing match dispatcher has already locked the global gate and event row,
-- validated permissions and request_id, and incremented the event version.
do $patch$
declare definition text; needle text:=' update public.slm_matches set version=version+1 where id=e.id returning * into e;';
begin
 select pg_get_functiondef('slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'tito_match_contract_changed'; end if;
 execute replace(definition,needle,needle||E'\n if person.id is not null and v_action in (''joined'',''reserved'',''withdrawn'') then\n  perform slm_private.tito_lineup_transition(e.id,person.id,v_action,old_person.status);\n end if;');
end $patch$;

-- Explicit operator-only maintenance. Dry-run never writes. Recheck under locks
-- during apply; cancelled, started and completed matches are never touched.
create function slm_private.tito_backfill(p_apply boolean default false)
returns table(event_id uuid,missing_count bigint,applied_count bigint)
language plpgsql security invoker set search_path='' as $$
declare e record; entry record; n bigint;
begin
 if p_apply is null then raise exception 'invalid_input'; end if;
 if p_apply then perform pg_advisory_xact_lock(20261014,1); end if;
 for e in select m.id from public.slm_matches m where m.status='scheduled' and m.starts_at>clock_timestamp() order by m.id loop
  if p_apply then
   perform 1 from public.slm_matches m where m.id=e.id and m.status='scheduled' and m.starts_at>clock_timestamp() for update;
   if not found then continue; end if;
  end if;
  select count(*) into missing_count from public.slm_match_entries p left join public.slm_match_lineups l on l.event_id=p.event_id
   where p.event_id=e.id and p.status='registered' and not(p.id=any(coalesce(l.team_a,'{}'::uuid[])||coalesce(l.team_b,'{}'::uuid[])));
  if missing_count=0 then continue; end if;
  event_id:=e.id; applied_count:=0;
  if p_apply then
   for entry in select p.id from public.slm_match_entries p left join public.slm_match_lineups l on l.event_id=p.event_id
    where p.event_id=e.id and p.status='registered' and not(p.id=any(coalesce(l.team_a,'{}'::uuid[])||coalesce(l.team_b,'{}'::uuid[]))) order by p.joined_at,p.id loop
    if slm_private.tito_lineup_transition(e.id,entry.id,'joined',null) then applied_count:=applied_count+1; end if;
   end loop;
  end if;
  return next;
 end loop;
end $$;
revoke all on function slm_private.tito_backfill(boolean) from public,anon,authenticated,service_role;
commit;

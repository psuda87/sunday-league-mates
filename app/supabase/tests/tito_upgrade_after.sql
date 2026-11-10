-- Same NEW synthetic upgrade stack after applying the completion migration.
-- Separate from fresh-install suite. Existing pre-change rows must stay intact.
begin;
do $$declare e uuid:='f0000000-0000-4000-8000-000000000004';u uuid:='f0000000-0000-4000-8000-000000000001';
 s uuid:='f0000000-0000-4000-8000-000000000002';l public.slm_match_lineups;r jsonb;body jsonb;
begin
 select * into l from public.slm_match_lineups where event_id=e;
 if l.version is distinct from 7 or l.actor_type<>'manual' or cardinality(l.team_a)<>2 or cardinality(l.team_b)<>0
  or (select count(*) from public.slm_match_entries where event_id=e)<>3 then raise exception 'upgrade_changed_manual_roster';end if;
 -- Missing pre-existing active entry is NOT backfilled by migration.
 if jsonb_array_length(slm_private.lineup_state(e)->'unassigned')<>1 then raise exception 'unexpected_automatic_backfill';end if;
 select q.body||jsonb_build_object('request_id',q.request_id) into body from public.slm_v2_requests q
 where actor_id=u and request_id='f0000000-0000-4000-8000-000000000008';
 r:=public.slm_lineups_dispatch(u,s,'save',body);
 if r->>'replayed'<>'true' or (r->>'version')::int<>7 or r#>>'{last_change,actor_type}'<>'manual' then raise exception 'old_receipt_incompatible';end if;
 perform public.slm_matches_dispatch(u,s,'guest',jsonb_build_object('event_id',e,'guest_name','New after upgrade','request_id',gen_random_uuid()));
 select * into l from public.slm_match_lineups where event_id=e;
 if l.version<>8 or cardinality(l.team_a)<>2 or cardinality(l.team_b)<>1 or l.actor_type<>'automatic'
  or jsonb_array_length(slm_private.lineup_state(e)->'unassigned')<>1 then raise exception 'upgrade_dispatcher_assignment';end if;
end $$;
select 'PASS synthetic main -> Tito upgrade; manual state, historical receipt and no automatic backfill';
rollback;

-- Profil zawodnika: „Mecze” liczy od razu rozegrane mecze, tak jak gole i asysty (migracja 20261120000000),
-- bez czekania 48 h na finalizację okna ocen. Po finalizacji mecz liczą miesięczne sumy (slm_rating_months),
-- a ta funkcja tylko mecze jeszcze niesfinalizowane, więc nic nie jest liczone podwójnie.
-- Predykat uczestnika jest ten sam co w slm_private.rating_participants (zapisany, nieobecny = nie).
begin;

create function slm_private.rating_live_played(p_user uuid) returns bigint
language sql stable security invoker set search_path='' as $$
 select count(distinct m.id) from public.slm_matches m
 join public.slm_match_entries p on p.event_id=m.id and p.member_id=p_user and p.status='registered' and not p.absent
 left join public.slm_match_rating_state rs on rs.event_id=m.id
 where m.status<>'cancelled'
  and m.starts_at>=(select c.enabled_from from public.slm_rating_config c)
  and m.starts_at+make_interval(mins=>m.duration_minutes)<=clock_timestamp()
  and rs.finalized_at is null;
$$;
revoke all on function slm_private.rating_live_played(uuid) from public,anon,authenticated;
grant execute on function slm_private.rating_live_played(uuid) to service_role;

-- Dwa miejsca w slm_ratings_dispatch: „overview” (p_user) i „player” (target). Kontrakt sprawdzany: dokładnie dwa trafienia.
do $patch$
declare d text; r text; hits integer;
begin
 select pg_get_functiondef('public.slm_ratings_dispatch(uuid,uuid,text,jsonb)'::regprocedure) into d;
 hits:=(select count(*) from regexp_matches(d,$re$'played',coalesce\(sum\(t\.played\),0\)$re$,'g'));
 if hits<>2 then raise exception 'ratings_dispatch_played_contract_changed (%)',hits; end if;
 r:=regexp_replace(d,$re$'played',coalesce\(sum\(t\.played\),0\)$re$,$rp$'played',coalesce(sum(t.played),0)+slm_private.rating_live_played(p_user)$rp$);
 r:=regexp_replace(r,$re$'played',coalesce\(sum\(t\.played\),0\)(?!\+slm_private)$re$,$rp$'played',coalesce(sum(t.played),0)+slm_private.rating_live_played(target)$rp$);
 if (length(r)-length(replace(r,'rating_live_played(','')))/length('rating_live_played(')<>2 then raise exception 'ratings_dispatch_played_patch_failed'; end if;
 execute r;
end $patch$;

commit;

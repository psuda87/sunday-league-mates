-- Odznaka wewnętrzna SLM-JUB-002 „Jubileusz 2 lata”: tylko za mecz grupy „Czwartkowy Baloon” (4dafc6b9-4377-415a-9dfc-b3e1f3fc0a39)
-- rozegrany 2026-12-03 (Europe/Warsaw). Odzwierciedla migrację zastosowaną na Cloud (wersja 20261124183909, poza repozytorium).
-- Dopisuje blok do slm_private.badge_progress(uuid) na żywej definicji; wiersz postępu dostaje członek grupy albo zdobywca.
-- Przyznawanie idzie istniejącą ścieżką badges_award() po rozliczeniu meczu (okno ocen). Kod pasuje do slm_badges_code_check.
begin;
do $mig$
declare f regprocedure:='slm_private.badge_progress(uuid)'::regprocedure; d text; n text; blk text;
begin
 d:=pg_get_functiondef(f);
 if position('SLM-JUB-002' in d)>0 then return; end if;
 blk:=$blk$
 select (array_agg(x.event_id order by x.starts_at,x.event_id))[1] into jub_ev from slm_private.badge_appearances() x
  where x.user_id=p_user and x.group_id='4dafc6b9-4377-415a-9dfc-b3e1f3fc0a39'::uuid and (x.starts_at at time zone 'Europe/Warsaw')::date=date '2026-12-03';
 if jub_ev is not null or exists(select 1 from public.slm_group_members gm where gm.group_id='4dafc6b9-4377-415a-9dfc-b3e1f3fc0a39'::uuid and gm.user_id=p_user) then
  b_group:='4dafc6b9-4377-415a-9dfc-b3e1f3fc0a39'::uuid;b_code:='SLM-JUB-002';b_threshold:=1;b_progress:=case when jub_ev is null then 0 else 1 end;b_event:=jub_ev;return next;
  b_group:=null;
 end if;
$blk$;
 n:=replace(d,'declare since timestamptz;','declare jub_ev uuid; since timestamptz;');
 n:=replace(n,E' b_group:=null;\n',E' b_group:=null;\n'||blk);
 if n=d or n not like '%declare jub_ev uuid;%' or n not like '%SLM-JUB-002%' then raise exception 'jubilee patch not applied'; end if;
 execute n;
end $mig$;
commit;

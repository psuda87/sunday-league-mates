-- Przycisk „Wyślij przypomnienie” przy zawodniku w płatnościach meczu (decyzja właściciela 2026-11-23):
-- administrator grupy wysyła zawodnikowi push o zaległych płatnościach (kategoria finance, bez nowych typów).
-- Działa jako akcja group_finance_remind_payment; reszta akcji przechodzi bez zmian do poprzedniego dispatchera.
-- Zabezpieczenia: tylko administrator grupy, adresat musi być członkiem grupy z zaległością (inaczej already_paid),
-- brak przypomnienia, gdy czeka zgłoszona wpłata (pending_payment_exists). Idempotencja: najwyżej jedno przypomnienie na godzinę
-- dla (grupa, zawodnik, mecz), więc podwójne kliknięcie nie wysyła dwóch powiadomień.
do $m$ begin
 if to_regprocedure('public.slm_group_finance_dispatch_pre_remind(uuid,uuid,text,jsonb)') is null then
  alter function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) rename to slm_group_finance_dispatch_pre_remind;
 end if;
end $m$;

create or replace function public.slm_group_finance_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb)
returns jsonb language plpgsql set search_path='' as $f$
declare gid uuid; target uuid; eid uuid; total bigint; v_name text; v_amount text; v_now timestamptz:=clock_timestamp();
begin
 if p_action<>'remind_payment' then
  return public.slm_group_finance_dispatch_pre_remind(p_user,p_session,p_action,p_body);
 end if;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid'; end if;
 gid:=nullif(p_body->>'group_id','')::uuid;target:=nullif(p_body->>'user_id','')::uuid;eid:=nullif(p_body->>'event_id','')::uuid;
 if gid is null or target is null then raise exception 'not_found'; end if;
 if not slm_private.group_finance_admin(gid,p_user) then raise exception 'forbidden'; end if;
 if not exists(select 1 from public.slm_group_members m where m.group_id=gid and m.user_id=target) then raise exception 'not_found'; end if;
 select coalesce(sum(d.outstanding_cents),0) into total from slm_private.group_dues(target) d
  where d.group_id=gid and d.outstanding_cents>0 and (eid is null or d.event_id=eid);
 if total<=0 then raise exception 'already_paid'; end if;
 if exists(select 1 from public.slm_group_payments p where p.group_id=gid and p.user_id=target and p.status='pending') then
  raise exception 'pending_payment_exists';
 end if;
 if eid is not null then select mm.name into v_name from public.slm_matches mm where mm.id=eid and mm.group_id=gid; end if;
 v_amount:=replace(to_char(total/100.0,'FM999999990.00'),'.',',');
 perform slm_private.notification_emit('payreminder:admin:'||gid||':'||target||':'||coalesce(eid::text,'all')||':'||floor(extract(epoch from v_now)/3600)::bigint,
  'payment_reminder','finance',null,'Przypomnienie o płatności',
  'Administrator przypomina o zaległej wpłacie '||v_amount||' zł'||coalesce(' za mecz „'||v_name||'”','')||'. Zgłoś wpłatę w profilu.',
  v_now+interval '2 days',array[target]);
 return jsonb_build_object('ok',true,'group_id',gid);
end $f$;

revoke all on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_group_finance_dispatch(uuid,uuid,text,jsonb) to service_role;
revoke all on function public.slm_group_finance_dispatch_pre_remind(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_group_finance_dispatch_pre_remind(uuid,uuid,text,jsonb) to service_role;

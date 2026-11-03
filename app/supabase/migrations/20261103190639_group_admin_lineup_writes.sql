-- Only the current administrator of this group may write; members retain read.
-- Existing data, CAS, roster tokens, idempotency receipts and ACL stay intact.
begin;
do $patch$
declare definition text;needle text;
begin
 select pg_get_functiondef('public.slm_lineups_dispatch(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 needle:=' perform 1 from public.slm_match_lineups where event_id=e.id for update;';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'lineup_admin_contract_changed';end if;
 execute replace(definition,needle,$new$ if p_action='save' and not exists(select 1 from public.slm_groups where id=e.group_id and admin_id=p_user and not archived) then raise exception 'forbidden';end if;
 perform 1 from public.slm_match_lineups where event_id=e.id for update;$new$);
 select pg_get_functiondef('slm_private.lineup_present(jsonb,uuid)'::regprocedure) into definition;
 needle:='jsonb_build_object(''last_change'',';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'lineup_admin_presentation_contract_changed';end if;
 execute replace(definition,needle,$new$jsonb_build_object('can_write',exists(select 1 from public.slm_groups g join public.slm_group_members m on m.group_id=g.id and m.user_id=p_viewer where g.id=e.group_id and not g.archived and g.admin_id=p_viewer),'last_change',$new$);
end $patch$;
commit;

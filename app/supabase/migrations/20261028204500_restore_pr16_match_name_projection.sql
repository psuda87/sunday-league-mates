-- Consolidation compatibility: the later feed dispatcher must retain PR16 privacy projections.
-- No row updates, new grants, Auth changes or financial calculation changes.
begin;
do $$
declare definition text;
begin
 select pg_get_functiondef('slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure) into definition;
 if position('slm_private.player_name(p.member_id)' in definition)=0 or
    position('slm_private.player_name(p.responsible_user_id)' in definition)=0 then
  raise exception 'match_name_contract_changed';
 end if;
 definition:=replace(definition,'slm_private.player_name(p.member_id)',
  'coalesce(slm_private.profile_display_name(p_user,p.member_id,e.group_id),slm_private.public_player_name(p.member_id))');
 definition:=replace(definition,'slm_private.player_name(p.responsible_user_id)',
  'coalesce(slm_private.profile_display_name(p_user,p.responsible_user_id,e.group_id),slm_private.public_player_name(p.responsible_user_id))');
 execute definition;
end $$;
commit;

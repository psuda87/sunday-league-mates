create or replace function slm_private.match_summary(p_event uuid,p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',e.id,'group_id',e.group_id,'group_name',g.name,'created_by',e.created_by,
 'name',e.name,'visibility',e.visibility,'starts_at',e.starts_at,'location',e.location,'status',e.status,
 'access',slm_private.match_access(e.id,p_user))||case when slm_private.match_access(e.id,p_user)='none' then '{}'::jsonb else
 jsonb_build_object('duration_minutes',e.duration_minutes,'capacity',e.capacity,'cost_cents',e.cost_cents,
 'total_cost',e.cost_cents/100.0,'hourly_rate',e.cost_cents*60.0/(100*e.duration_minutes),
 'minimum_players',10,'registered_count',case when slm_private.match_access(e.id,p_user)='full' then (select count(*) from public.slm_match_entries where event_id=e.id and status='registered') else null end,
 'reserve_count',case when slm_private.match_access(e.id,p_user)='full' then (select count(*) from public.slm_match_entries where event_id=e.id and status='reserve') else null end,
 'registration_open',e.status='scheduled' and clock_timestamp()<e.starts_at,
 'decision_required',slm_private.match_access(e.id,p_user)='full' and e.status='scheduled' and clock_timestamp()>=((e.starts_at at time zone 'Europe/Warsaw')::date+time '17:00') at time zone 'Europe/Warsaw'
 and (select count(*) from public.slm_match_entries where event_id=e.id and status='registered')<10,
 'approved_at',e.approved_at,'version',e.version,'settlements_active',true,
 'can_manage',slm_private.match_finance(e.id,p_user),'can_edit',e.created_by=p_user and slm_private.group_member(e.group_id,p_user)) end||jsonb_build_object('own_participation',exists(select 1 from public.slm_match_entries p where p.event_id=e.id and p.responsible_user_id=p_user and p.status in ('registered','reserve')))
 from public.slm_matches e join public.slm_groups g on g.id=e.group_id;
$$;

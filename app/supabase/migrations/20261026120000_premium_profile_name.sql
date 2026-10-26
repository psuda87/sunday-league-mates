-- Public nickname is not an authentication alias. No Auth/session/role changes.
begin;
alter table public.slm_profiles add column first_name text not null default '' check(length(first_name)<=100 and first_name !~ '[[:cntrl:]<>]');
alter table public.slm_profiles drop constraint slm_profiles_display_as_check;
alter table public.slm_profiles add constraint slm_profiles_display_as_check check(display_as in ('nickname','first_name','full_name'));
alter table public.slm_group_members add column share_first_name boolean not null default false;
create or replace function slm_private.public_player_name(p_target uuid) returns text
language sql stable security invoker set search_path='' as $$
 select coalesce(nullif(trim(n.nickname),''),case when a.login not like '%@%' then nullif(trim(a.login),'') end,'Zawodnik')
 from public.slm_profiles p left join public.slm_player_profiles n on n.user_id=p.user_id
 left join public.slm_aliases a on a.user_id=p.user_id where p.user_id=p_target;
$$;
create function slm_private.profile_display_name(p_viewer uuid,p_target uuid,p_group uuid) returns text
language sql stable security invoker set search_path='' as $$
 select coalesce(case when p.display_as='full_name' and (p_viewer=p_target or m.share_full_name or slm_private.group_admin(p_group,p_viewer)) then nullif(trim(p.full_name),'')
 when p.display_as='first_name' and (p_viewer=p_target or m.share_first_name or m.share_full_name or slm_private.group_admin(p_group,p_viewer)) then nullif(trim(p.first_name),'') end,
 slm_private.public_player_name(p_target))
 from public.slm_profiles p left join public.slm_group_members m on m.user_id=p_target and m.group_id=p_group
 where p.user_id=p_target and (p_viewer=p_target or slm_private.group_member(p_group,p_viewer) and m.user_id is not null);
$$;
revoke all on function slm_private.profile_display_name(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function slm_private.profile_display_name(uuid,uuid,uuid) to service_role;
create or replace function slm_private.group_profile(p_viewer uuid,p_target uuid,p_group uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('user_id',m.user_id,'nickname',slm_private.public_player_name(m.user_id),
 'display_name',slm_private.profile_display_name(p_viewer,p_target,p_group),
 'first_name',case when m.user_id=p_viewer or m.share_first_name or m.share_full_name or slm_private.group_admin(p_group,p_viewer) then p.first_name end,
 'full_name',case when m.user_id=p_viewer or m.share_full_name or slm_private.group_admin(p_group,p_viewer) then p.full_name end,
 'contact_phone',coalesce(n.contact_phone,a.phone),'jersey_number',n.jersey_number,
 'organizer',m.organizer,'joined_at',m.joined_at,'share_full_name',m.share_full_name,'share_first_name',m.share_first_name,'display_as',p.display_as)
 from public.slm_group_members m join public.slm_profiles p on p.user_id=m.user_id
 left join public.slm_player_profiles n on n.user_id=m.user_id left join public.slm_aliases a on a.user_id=m.user_id
 where m.group_id=p_group and m.user_id=p_target and slm_private.group_member(p_group,p_viewer);
$$;
-- All dependent profile/consent changes are one transaction under the same B3 lock.
create function public.slm_premium_profile_save(p_user uuid,p_session uuid,p_body jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare mode text:=p_body->>'display_as'; nickname text:=trim(p_body->>'nickname');
 scope jsonb; required_consent boolean; key uuid; prior public.slm_v2_requests;
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 key:=nullif(p_body->>'request_id','')::uuid;if key is null then raise exception 'request_required';end if;
 select * into prior from public.slm_v2_requests where actor_id=p_user and request_id=key;
 if found then if prior.action<>'premium_profile' or prior.body<>p_body then raise exception 'idempotency_conflict';end if;return;end if;
 if mode is null or mode not in ('nickname','first_name','full_name') or nickname is null or length(nickname) not between 1 and 48
 or nickname ~ '[[:cntrl:]<>]' or jsonb_typeof(p_body->'first_name') is distinct from 'string'
 or jsonb_typeof(p_body->'full_name') is distinct from 'string'
 or length(p_body->>'first_name')>100 or length(p_body->>'full_name')>100
 or ((p_body->>'first_name')||(p_body->>'full_name')) ~ '[[:cntrl:]<>]' then raise exception 'invalid_input';end if;
 select coalesce(jsonb_agg(m.group_id::text order by m.group_id),'[]') into scope from public.slm_group_members m
 join public.slm_groups g on g.id=m.group_id where m.user_id=p_user and not g.archived;
 if scope is distinct from p_body->'group_scope' then raise exception 'stale_scope';end if;
 select exists(select 1 from public.slm_group_members m join public.slm_groups g on g.id=m.group_id
 where m.user_id=p_user and not g.archived and ((mode='full_name' and not m.share_full_name) or (mode='first_name' and not(m.share_full_name or m.share_first_name)))) into required_consent;
 if required_consent and p_body->'accept_disclosure' is distinct from 'true'::jsonb then raise exception 'consent_required';end if;
 if p_body ? 'jersey_number' and p_body->'jersey_number'<>'null'::jsonb and
 (jsonb_typeof(p_body->'jersey_number')<>'number' or (p_body->>'jersey_number')!~ '^\d{1,2}$') then raise exception 'invalid_number';end if;
 insert into public.slm_player_profiles(user_id,nickname) values(p_user,nickname)
 on conflict(user_id) do update set nickname=excluded.nickname;
 if p_body ? 'jersey_number' then update public.slm_player_profiles set jersey_number=(p_body->>'jersey_number')::integer where user_id=p_user;end if;
 update public.slm_profiles set full_name=trim(p_body->>'full_name'),first_name=trim(p_body->>'first_name'),display_as=mode where user_id=p_user;
 if required_consent then
 update public.slm_group_members m set share_full_name=case when mode='full_name' then true else m.share_full_name end,
 share_first_name=case when mode='first_name' then true else m.share_first_name end
 where m.user_id=p_user and m.group_id::text in(select jsonb_array_elements_text(scope));end if;
 insert into public.slm_v2_requests values(p_user,key,'premium_profile',p_body,'{}'::jsonb,clock_timestamp());
end $$;
revoke all on function public.slm_premium_profile_save(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.slm_premium_profile_save(uuid,uuid,jsonb) to service_role;
-- Old clients cannot silently revoke disclosure while keeping a personal name.
alter function public.slm_groups_dispatch(uuid,uuid,text,jsonb) rename to groups_dispatch_name_base;
alter function public.groups_dispatch_name_base(uuid,uuid,text,jsonb) set schema slm_private;
revoke all on function slm_private.groups_dispatch_name_base(uuid,uuid,text,jsonb) from public,anon,authenticated;
create function public.slm_groups_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare mode text; result jsonb;
begin
 perform pg_advisory_xact_lock(20261014,1);
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_action='consent' and exists(select 1 from public.slm_v2_requests where actor_id=p_user and request_id=nullif(p_body->>'request_id','')::uuid) then return slm_private.groups_dispatch_name_base(p_user,p_session,p_action,p_body);end if;
 if p_action='consent' and p_body->'share_full_name'='false'::jsonb then
 select display_as into mode from public.slm_profiles where user_id=p_user;
 if mode in ('first_name','full_name') and p_body->'confirm_nickname' is distinct from 'true'::jsonb then raise exception 'consent_required';end if;
 -- Delegate validation, membership check and idempotency before either dependent write.
 result:=slm_private.groups_dispatch_name_base(p_user,p_session,p_action,p_body);
 update public.slm_group_members set share_first_name=false where user_id=p_user and group_id=(p_body->>'group_id')::uuid;
 if mode in ('first_name','full_name') then update public.slm_profiles set display_as='nickname' where user_id=p_user;end if;
 return result;
 end if;
 return slm_private.groups_dispatch_name_base(p_user,p_session,p_action,p_body);
end $$;
revoke all on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) to service_role;
-- Context-aware labels only, retaining dispatcher access checks and financial rules.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('slm_private.matches_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure);
 if position('slm_private.player_name(p.member_id)' in definition)=0 then raise exception 'match_name_contract_changed';end if;
 definition:=replace(definition,'slm_private.player_name(p.member_id)','coalesce(slm_private.profile_display_name(p_user,p.member_id,e.group_id),slm_private.public_player_name(p.member_id))');
 definition:=replace(definition,'slm_private.player_name(p.responsible_user_id)','coalesce(slm_private.profile_display_name(p_user,p.responsible_user_id,e.group_id),slm_private.public_player_name(p.responsible_user_id))');
 execute definition;
 definition:=pg_get_functiondef('slm_private.group_finance_dispatch_core(uuid,uuid,text,jsonb)'::regprocedure);
 if position('slm_private.player_name(a.member_id)' in definition)=0 then raise exception 'finance_name_contract_changed';end if;
 execute replace(definition,'slm_private.player_name(a.member_id)','coalesce(slm_private.profile_display_name(p_user,a.member_id,v_group),slm_private.public_player_name(a.member_id))');
 definition:=pg_get_functiondef('slm_private.groups_dispatch_b3_projection(uuid,uuid,text,jsonb)'::regprocedure);
 if position('slm_private.public_player_name(r.actor_id)' in definition)=0 then raise exception 'group_request_name_contract_changed';end if;
 definition:=replace(definition,'slm_private.public_player_name(r.actor_id)','coalesce(slm_private.profile_display_name(p_user,r.actor_id,g.id),slm_private.public_player_name(r.actor_id))');
 definition:=replace(definition,'slm_private.public_player_name(r.target_id)','coalesce(slm_private.profile_display_name(p_user,r.target_id,g.id),slm_private.public_player_name(r.target_id))');
 execute definition;
end $$;
commit;

-- Prevent account enumeration via repeated private-phone request counts/statuses.
begin;
alter table public.slm_group_requests add column phone_lookup_key text;
create unique index slm_private_phone_pending on public.slm_group_requests(group_id,actor_id,kind,phone_lookup_key)
 where private and state='pending' and phone_lookup_key is not null;
alter function public.slm_groups_dispatch(uuid,uuid,text,jsonb) rename to groups_dispatch_b3_projection;
alter function public.groups_dispatch_b3_projection(uuid,uuid,text,jsonb) set schema slm_private;
revoke all on function slm_private.groups_dispatch_b3_projection(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function slm_private.groups_dispatch_b3_projection(uuid,uuid,text,jsonb) to service_role;
create function public.slm_groups_dispatch(p_user uuid,p_session uuid,p_action text,p_body jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.slm_groups; cached public.slm_v2_requests; result jsonb; key uuid;
 lookup text; before_ids uuid[]; new_request uuid; request_kind text;
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for share;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_action='phone' then
  select * into g from public.slm_groups where id=nullif(p_body->>'group_id','')::uuid and not archived;
  if g.id is null then raise exception 'not_found';end if;
  if not slm_private.group_member(g.id,p_user) then raise exception 'forbidden';end if;
  if coalesce(p_body->>'phone','') !~ '^\+48[0-9]{9}$' then raise exception 'invalid_phone';end if;
  key:=nullif(p_body->>'request_id','')::uuid;if key is null then raise exception 'request_required';end if;
  select * into cached from public.slm_v2_requests where actor_id=p_user and request_id=key;
  if found then
   if cached.action<>'phone' or cached.body<>p_body then raise exception 'idempotency_conflict';end if;return cached.response;
  end if;
  request_kind:=case when slm_private.group_admin(g.id,p_user) then 'invite' else 'proposal' end;
  lookup:=encode(sha256(convert_to(p_body->>'phone','UTF8')),'hex');
  if exists(select 1 from public.slm_group_requests r where r.group_id=g.id and r.actor_id=p_user
   and r.kind=request_kind and r.private and r.state='pending' and r.phone_lookup_key=lookup) then
   result:=jsonb_build_object('accepted',true);
   insert into public.slm_v2_requests values(p_user,key,'phone',p_body,result,clock_timestamp());return result;
  end if;
  select coalesce(array_agg(r.id),'{}'::uuid[]) into before_ids from public.slm_group_requests r
   where r.group_id=g.id and r.actor_id=p_user and r.private and r.state='pending';
  result:=slm_private.groups_dispatch_b3_projection(p_user,p_session,p_action,p_body);
  select r.id into new_request from public.slm_group_requests r where r.group_id=g.id and r.actor_id=p_user
   and r.private and r.state='pending' and not(r.id=any(before_ids)) limit 1;
  if new_request is not null then update public.slm_group_requests set phone_lookup_key=lookup where id=new_request;
  else
   -- Opaque receipt also when a target already has a pending request. No target
   -- existence signal; never force membership or create a duplicate invitation.
   insert into public.slm_group_requests(group_id,actor_id,target_id,kind,private,phone_lookup_key)
    values(g.id,p_user,null,request_kind,true,lookup);
  end if;
  return result;
 end if;
 result:=slm_private.groups_dispatch_b3_projection(p_user,p_session,p_action,p_body);
 if p_action='detail' then
  -- The recipient may see/decide their private invitation. Its sender must not
  -- infer acceptance/rejection/account existence from outbound request metadata.
  result:=jsonb_set(result,'{requests}',coalesce((select jsonb_agg(item) from jsonb_array_elements(result->'requests') item
   join public.slm_group_requests r on r.id=(item->>'id')::uuid
   where not(r.private and r.kind='invite') or r.target_id=p_user),'[]'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.slm_groups_dispatch(uuid,uuid,text,jsonb) to service_role;
commit;

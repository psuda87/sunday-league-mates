-- Web Push niesie tytuł i treść w zaszyfrowanym (end-to-end) ładunku, więc rozwinięte powiadomienie pokazuje szczegóły.
-- FCM (APK) nadal dostaje wyłącznie ogólny komunikat.
create or replace function public.slm_push_claim(p_limit integer default 20,p_platforms text[] default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare q public.slm_push_queue; n public.slm_notifications; d public.slm_push_devices;
 result jsonb:='[]'; v_lease uuid;
begin
 for q in select qq.* from public.slm_push_queue qq join public.slm_push_devices dd on dd.id=qq.device_id
  where qq.state in ('pending','leased') and qq.next_attempt_at<=clock_timestamp()
  and (qq.state='pending' or qq.lease_until<clock_timestamp())
  and (p_platforms is null or dd.platform=any(p_platforms)) order by qq.next_attempt_at,qq.id
  limit greatest(1,least(p_limit,20)) for update of qq skip locked loop
  select * into n from public.slm_notifications where id=q.notification_id;
  select * into d from public.slm_push_devices where id=q.device_id;
  if q.attempts>=6 then update public.slm_push_queue set state='dead',last_error='attempts_exhausted' where id=q.id;
  elsif not coalesce(slm_private.push_deliverable(n,d),false) then
   update public.slm_push_queue set state='cancelled',last_error='not_eligible' where id=q.id;
  else
   v_lease:=gen_random_uuid();
   update public.slm_push_queue set state='leased',attempts=attempts+1,lease_id=v_lease,lease_until=clock_timestamp()+interval '2 minutes' where id=q.id;
   result:=result||jsonb_build_array(jsonb_build_object('queue_id',q.id,'lease_id',v_lease,'notification_id',n.id,
    'event_id',n.event_id,'kind',n.kind,'title',case when d.platform='web' then n.title end,'body',case when d.platform='web' then n.body end,'platform',d.platform,'token',d.token,'p256dh',d.web_p256dh,'auth',d.web_auth,
    'expires_at',(select expires_at from public.slm_notification_sources where id=n.source_id)));
  end if;
 end loop;
 return result;
end $$;
revoke all on function public.slm_push_claim(integer,text[]) from public,anon,authenticated;
grant execute on function public.slm_push_claim(integer,text[]) to service_role;

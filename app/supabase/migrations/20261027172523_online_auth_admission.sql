-- Inactive online mode only. No accounts, roles or business data are modified.
begin;
create table public.slm_signup_admissions(
 request_id uuid primary key,capability_hash text not null check(capability_hash~'^[a-f0-9]{64}$'),
 subject_hash text not null check(subject_hash~'^[a-f0-9]{64}$'),admitted_at timestamptz not null default clock_timestamp()
);
create index on public.slm_signup_admissions(subject_hash,admitted_at);
alter table public.slm_signup_admissions enable row level security;
revoke all on public.slm_signup_admissions from public,anon,authenticated;
grant select,insert,delete on public.slm_signup_admissions to service_role;
create table public.slm_auth_metrics(bucket timestamptz not null,metric text not null,attempts bigint not null,primary key(bucket,metric));
alter table public.slm_auth_metrics enable row level security;
revoke all on public.slm_auth_metrics from public,anon,authenticated;
grant select,insert,update,delete on public.slm_auth_metrics to service_role;
create function public.slm_online_metric(p_metric text) returns void language plpgsql security invoker set search_path='' as $$begin
 if p_metric not in ('signup_admitted','signup_limited','challenge_rejected') then raise exception 'invalid_input';end if;
 delete from public.slm_auth_metrics where bucket<clock_timestamp()-interval '7 days';
 insert into public.slm_auth_metrics values(date_trunc('hour',clock_timestamp()),p_metric,1) on conflict(bucket,metric) do update set attempts=slm_auth_metrics.attempts+1;
end$$;
create function public.slm_signup_admit(p_request uuid,p_capability text,p_subject text) returns boolean language plpgsql security invoker set search_path='' as $$
declare prior public.slm_signup_admissions;begin
 if not public.slm_model_ready() or p_request is null or p_capability is null or p_subject is null or p_capability!~'^[a-f0-9]{64}$' or p_subject!~'^[a-f0-9]{64}$' then raise exception 'invalid_input';end if;
 perform pg_advisory_xact_lock(hashtextextended('signup-request:'||p_request::text,0));
 select * into prior from public.slm_signup_admissions where request_id=p_request;
 if found then if prior.capability_hash<>p_capability then raise exception 'signup_conflict';end if;return true;end if;
 perform pg_advisory_xact_lock(hashtextextended('signup-subject:'||p_subject,0));
 -- Only transient admission proofs, never account/profile data. Retention48h.
 delete from public.slm_signup_admissions where admitted_at<clock_timestamp()-interval '48 hours';
 if (select count(*) from public.slm_signup_admissions where subject_hash=p_subject and admitted_at>clock_timestamp()-interval '10 minutes')>=5 or
    (select count(*) from public.slm_signup_admissions where subject_hash=p_subject and admitted_at>clock_timestamp()-interval '1 day')>=20 then
  perform public.slm_online_metric('signup_limited');return false;
 end if;
 insert into public.slm_signup_admissions(request_id,capability_hash,subject_hash) values(p_request,p_capability,p_subject);
 perform public.slm_online_metric('signup_admitted');return true;
end$$;
revoke all on function public.slm_online_metric(text) from public,anon,authenticated;
revoke all on function public.slm_signup_admit(uuid,text,text) from public,anon,authenticated;
grant execute on function public.slm_online_metric(text),public.slm_signup_admit(uuid,text,text) to service_role;
commit;

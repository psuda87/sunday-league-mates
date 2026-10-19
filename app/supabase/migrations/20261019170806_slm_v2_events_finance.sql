-- Separate versioned records keep all legacy amounts and APIs intact.
create table public.slm_matches (
 id uuid primary key default gen_random_uuid(),group_id uuid not null references public.slm_groups(id),
 created_by uuid not null references auth.users(id),name text not null check(length(trim(name)) between 1 and 100),
 visibility text not null check(visibility in ('private','public')),starts_at timestamptz not null,
 location text not null check(length(trim(location)) between 1 and 200),address text not null default '' check(length(address)<=200),
 duration_minutes integer not null check(duration_minutes between 1 and 1440),capacity integer not null check(capacity>=10 and capacity<=1000),
 cost_cents bigint not null check(cost_cents between 0 and 999999999999),status text not null default 'scheduled' check(status in ('scheduled','cancelled')),
 version bigint not null default 1,approved_at timestamptz,revision bigint not null default 0,
 created_at timestamptz not null default clock_timestamp()
);
create index slm_matches_group_start on public.slm_matches(group_id,starts_at,id);
create table public.slm_match_entries (
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.slm_matches(id),
 member_id uuid references auth.users(id),responsible_user_id uuid not null references auth.users(id),
 guest_name text,guest_phone text check(guest_phone is null or guest_phone ~ '^\+48[0-9]{9}$'),
 status text not null check(status in ('registered','reserve','withdrawn')),absent boolean not null default false,
 joined_at timestamptz not null default clock_timestamp(),withdrawn_at timestamptz,
 payable boolean not null default false,charge_override boolean,release_sequence bigint,
 replacement_id uuid references public.slm_match_entries(id),
 check((member_id is not null and responsible_user_id=member_id and guest_name is null and guest_phone is null)
 or(member_id is null and length(trim(guest_name)) between 1 and 100))
);
create unique index slm_match_member_active on public.slm_match_entries(event_id,member_id) where member_id is not null and status<>'withdrawn';
create table public.slm_match_history (
 sequence bigint generated always as identity primary key,event_id uuid not null references public.slm_matches(id),
 entry_id uuid references public.slm_match_entries(id),actor_id uuid not null references auth.users(id),action text not null,
 server_time timestamptz not null default clock_timestamp(),snapshot jsonb not null
);
create table public.slm_group_payments (
 id uuid primary key,group_id uuid not null references public.slm_groups(id),event_id uuid references public.slm_matches(id),
 user_id uuid not null references auth.users(id),amount_cents bigint not null check(amount_cents>0 and amount_cents<=999999999999),
 corrected_amount_cents bigint not null check(corrected_amount_cents>=0 and corrected_amount_cents<=999999999999),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 submitted_by uuid not null references auth.users(id),decided_by uuid references auth.users(id),
 note text not null default '' check(length(note)<=500),created_at timestamptz not null default clock_timestamp(),decided_at timestamptz
);
create table public.slm_group_ledger (
 id bigint generated always as identity primary key,group_id uuid not null references public.slm_groups(id),
 event_id uuid references public.slm_matches(id),user_id uuid not null references auth.users(id),
 entry_id uuid references public.slm_match_entries(id),payment_id uuid references public.slm_group_payments(id),
 amount_cents bigint not null,kind text not null check(kind in ('charge','charge_correction','payment','payment_correction')),
 actor_id uuid not null references auth.users(id),reason text not null check(length(trim(reason)) between 1 and 500),
 revision bigint,created_at timestamptz not null default clock_timestamp()
);
create unique index slm_group_payment_once on public.slm_group_ledger(payment_id) where kind='payment';
create unique index slm_group_charge_revision on public.slm_group_ledger(event_id,entry_id,revision) where entry_id is not null;
create index slm_group_ledger_account on public.slm_group_ledger(group_id,user_id,id);
create table public.slm_group_finance_audit (
 id bigint generated always as identity primary key,group_id uuid not null references public.slm_groups(id),
 event_id uuid references public.slm_matches(id),user_id uuid references auth.users(id),actor_id uuid not null references auth.users(id),
 action text not null,reason text not null,snapshot jsonb not null,created_at timestamptz not null default clock_timestamp()
);
create table public.slm_group_surplus (
 event_id uuid primary key references public.slm_matches(id),group_id uuid not null references public.slm_groups(id),
 assessed_cents bigint not null,received_cents bigint not null,updated_at timestamptz not null default clock_timestamp()
);
create table public.slm_surplus_history (
 id bigint generated always as identity primary key,event_id uuid not null references public.slm_matches(id),group_id uuid not null references public.slm_groups(id),
 actor_id uuid not null references auth.users(id),assessed_delta bigint not null,received_delta bigint not null,
 created_at timestamptz not null default clock_timestamp()
);
create function slm_private.match_finance(p_event uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.slm_matches e where e.id=p_event and
 (slm_private.group_admin(e.group_id,p_user) or (e.created_by=p_user and slm_private.group_member(e.group_id,p_user))));
$$;
create function slm_private.own_finance_scope(p_group uuid,p_event uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select slm_private.current_session_valid() and (slm_private.group_admin(p_group,auth.uid())
 or(p_event is not null and slm_private.match_finance(p_event,auth.uid())));
$$;
revoke all on function slm_private.match_finance(uuid,uuid) from public,anon,authenticated;
grant execute on function slm_private.match_finance(uuid,uuid) to service_role;
revoke all on function slm_private.own_finance_scope(uuid,uuid) from public,anon;
grant execute on function slm_private.own_finance_scope(uuid,uuid) to authenticated,service_role;
do $$ declare t text;begin
 foreach t in array array['slm_matches','slm_match_entries','slm_match_history','slm_group_payments','slm_group_ledger','slm_group_finance_audit','slm_group_surplus','slm_surplus_history'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['slm_match_history_sequence_seq','slm_group_ledger_id_seq','slm_group_finance_audit_id_seq','slm_surplus_history_id_seq'] loop
 execute format('grant usage,select on sequence public.%I to service_role',t);
 end loop;
 foreach t in array array['slm_match_history','slm_group_ledger','slm_group_finance_audit','slm_surplus_history'] loop
 execute format('create trigger immutable_history before update or delete on public.%I for each row execute function slm_private.finance_immutable()',t);
 execute format('revoke update,delete,truncate on public.%I from service_role',t);
 end loop;
end $$;
grant select on public.slm_group_ledger,public.slm_group_payments,public.slm_group_surplus to authenticated;
create policy scoped_ledger_read on public.slm_group_ledger for select to authenticated using
 (slm_private.current_session_valid() and(user_id=auth.uid() or slm_private.own_finance_scope(group_id,event_id)));
create policy scoped_payments_read on public.slm_group_payments for select to authenticated using
 (slm_private.current_session_valid() and(user_id=auth.uid() or slm_private.own_finance_scope(group_id,event_id)));
create policy group_surplus_admin on public.slm_group_surplus for select to authenticated using(slm_private.own_finance_scope(group_id,null));

create function slm_private.group_dues(p_user uuid) returns table(group_id uuid,event_id uuid,starts_at timestamptz,due_cents bigint,covered_cents bigint,outstanding_cents bigint)
language sql stable security invoker set search_path='' as $$
 with base as (
  select e.group_id,e.id event_id,e.starts_at,greatest(0,-sum(l.amount_cents))::bigint due
  from public.slm_matches e join public.slm_group_ledger l on l.event_id=e.id and l.user_id=p_user
  where l.kind in ('charge','charge_correction') and e.approved_at is not null
   and clock_timestamp()>=e.starts_at+make_interval(mins=>e.duration_minutes)
  group by e.group_id,e.id,e.starts_at
  union all
  select s.group_id,d.event_id,d.starts_at,d.outstanding_cents from slm_private.finance_dues(p_user) d cross join public.slm_legacy_scope s
 ), targeted as (
  select b.*,greatest(0,coalesce((select sum(l.amount_cents) from public.slm_group_ledger l
   where l.group_id=b.group_id and l.event_id=b.event_id and l.user_id=p_user and l.kind in ('payment','payment_correction')),0))::bigint target
  from base b
 ), remaining as (
  select t.*,greatest(0,t.due-t.target)::bigint remainder from targeted t
 ), general as (
  select l.group_id,greatest(0,sum(l.amount_cents))::bigint credit from public.slm_group_ledger l
  where l.user_id=p_user and l.event_id is null and l.kind in ('payment','payment_correction') group by l.group_id
 ), ordered as (
  select r.*,coalesce(g.credit,0) credit,coalesce(sum(r.remainder) over(partition by r.group_id order by r.starts_at,r.event_id rows between unbounded preceding and 1 preceding),0) previous
  from remaining r left join general g on g.group_id=r.group_id
 ) select o.group_id,o.event_id,o.starts_at,o.due,
  least(o.due,o.target+greatest(0,o.credit-o.previous))::bigint,
  greatest(0,o.due-o.target-greatest(0,o.credit-o.previous))::bigint from ordered o;
$$;
create function slm_private.registration_allowed(p_user uuid,p_cost bigint) returns boolean
language sql stable security invoker set search_path='' as $$
 select p_cost=0 or (select count(distinct event_id)<2 from (
  select event_id from slm_private.group_dues(p_user) where outstanding_cents>0
  union select event_id from slm_private.finance_dues(p_user) where outstanding_cents>0
   and not exists(select 1 from public.slm_legacy_scope)
 )d);
$$;
create function slm_private.group_preview(p_event uuid)
returns table(entry_id uuid,user_id uuid,payable boolean,amount_cents bigint)
language sql stable security invoker set search_path='' as $$
 with entries as (select p.*,e.cost_cents,e.status event_status,
  e.status<>'cancelled' and coalesce(p.charge_override,p.payable) pays
  from public.slm_match_entries p join public.slm_matches e on e.id=p.event_id where e.id=p_event),
 counted as (select *,count(*) filter(where pays) over() n from entries)
 select id,responsible_user_id,pays,case when pays and n>0 then 100*((cost_cents+100*n-1)/(100*n)) else 0 end from counted;
$$;
create function slm_private.group_revise(p_event uuid,p_actor uuid,p_reason text) returns void
language plpgsql security invoker set search_path='' as $$
declare e public.slm_matches; line record; previous bigint;begin
 select * into e from public.slm_matches where id=p_event for update;
 if e.approved_at is null then return;end if;
 if e.status<>'cancelled' and e.cost_cents>0 and not exists(select 1 from slm_private.group_preview(e.id) where payable) then raise exception 'no_payers';end if;
 update public.slm_matches set revision=revision+1 where id=e.id returning * into e;
 for line in select * from slm_private.group_preview(e.id) loop
  select coalesce(-sum(amount_cents),0) into previous from public.slm_group_ledger where entry_id=line.entry_id and kind in ('charge','charge_correction');
  if previous<>line.amount_cents then
   insert into public.slm_group_ledger(group_id,event_id,user_id,entry_id,amount_cents,kind,actor_id,reason,revision)
    values(e.group_id,e.id,line.user_id,line.entry_id,previous-line.amount_cents,
     case when e.revision=1 then 'charge' else 'charge_correction' end,p_actor,p_reason,e.revision);
  end if;
 end loop;
end $$;
create function slm_private.group_surplus_sync(p_group uuid,p_actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare e public.slm_matches; assessed bigint;received bigint; old public.slm_group_surplus;begin
 for e in select * from public.slm_matches where group_id=p_group and approved_at is not null loop
  select coalesce(sum(due_cents),0),coalesce(sum(covered_cents),0) into assessed,received
   from (select distinct user_id from public.slm_group_ledger where event_id=e.id)u
   cross join lateral slm_private.group_dues(u.user_id)d where d.event_id=e.id;
  assessed:=case when e.status='cancelled' then 0 else greatest(0,assessed-e.cost_cents) end;
  received:=case when e.status='cancelled' then 0 else greatest(0,received-e.cost_cents) end;
  select * into old from public.slm_group_surplus where event_id=e.id;
  if old.event_id is null or old.assessed_cents<>assessed or old.received_cents<>received then
   insert into public.slm_surplus_history(event_id,group_id,actor_id,assessed_delta,received_delta)
    values(e.id,p_group,p_actor,assessed-coalesce(old.assessed_cents,0),received-coalesce(old.received_cents,0));
   insert into public.slm_group_surplus values(e.id,p_group,assessed,received,clock_timestamp())
    on conflict(event_id) do update set assessed_cents=excluded.assessed_cents,received_cents=excluded.received_cents,updated_at=excluded.updated_at;
  end if;
 end loop;
end $$;
-- All helpers except fixed-identity RLS helpers remain service-only.
revoke all on function slm_private.group_dues(uuid),slm_private.registration_allowed(uuid,bigint),slm_private.group_preview(uuid),slm_private.group_revise(uuid,uuid,text),slm_private.group_surplus_sync(uuid,uuid) from public,anon,authenticated;
grant execute on function slm_private.group_dues(uuid),slm_private.registration_allowed(uuid,bigint),slm_private.group_preview(uuid),slm_private.group_revise(uuid,uuid,text),slm_private.group_surplus_sync(uuid,uuid) to service_role;

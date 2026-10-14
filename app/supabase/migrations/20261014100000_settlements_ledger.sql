-- Tylko lokalny plik. Wymaga wszystkich migracji Auth i events z feat/events.
-- Jedna zamknięta grupa: wspólny advisory lock serializuje finanse i zapisy.
-- Nie wymaga cron, płatnych usług ani dodatkowych rozszerzeń.
alter table public.slm_events add column timezone text not null default 'Europe/Warsaw';
alter table public.slm_events add constraint slm_events_timezone check(timezone='Europe/Warsaw');
alter table public.slm_events add column total_cost_cents bigint;
update public.slm_events set total_cost_cents=(total_cost*100)::bigint;
alter table public.slm_events alter column total_cost_cents set not null;
alter table public.slm_events add constraint slm_events_cost_cents
 check(total_cost_cents between 0 and 999999999999 and total_cost=total_cost_cents::numeric/100);

-- total_cost pozostaje adapterem starszego API wydarzeń. Źródłem rozliczeń są grosze.
create function slm_private.event_cost_cents() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' or new.total_cost is distinct from old.total_cost then
  new.total_cost_cents:=(new.total_cost*100)::bigint;
 elsif new.total_cost_cents is distinct from old.total_cost_cents then
  new.total_cost:=new.total_cost_cents::numeric/100;
 end if;
 return new;
end $$;
create trigger slm_event_cost_cents before insert or update on public.slm_events
 for each row execute function slm_private.event_cost_cents();

create table public.slm_settlements (
 event_id uuid primary key references public.slm_events(id),
 version bigint not null default 0 check(version>=0),
 approved_at timestamptz,
 approved_by uuid references auth.users(id),
 revision bigint not null default 0 check(revision>=0),
 check((approved_at is null and approved_by is null and revision=0)
  or (approved_at is not null and approved_by is not null))
);
create table public.slm_settlement_shares (
 participant_id uuid primary key references public.slm_event_participants(id),
 event_id uuid not null references public.slm_events(id),
 default_payable boolean not null default false,
 charge_override boolean,
 release_sequence bigint references public.slm_event_history(sequence),
 replacement_id uuid unique references public.slm_event_participants(id)
);
create index slm_shares_event on public.slm_settlement_shares(event_id);
create table public.slm_settlement_revisions (
 id bigint generated always as identity primary key,
 event_id uuid not null references public.slm_events(id),
 revision bigint not null,
 cost_cents bigint not null check(cost_cents>=0),
 actor_id uuid not null references auth.users(id),
 reason text not null check(length(trim(reason)) between 1 and 500),
 created_at timestamptz not null default clock_timestamp(),
 unique(event_id,revision)
);
create table public.slm_settlement_lines (
 revision_id bigint not null references public.slm_settlement_revisions(id),
 participant_id uuid not null references public.slm_event_participants(id),
 responsible_user_id uuid not null references auth.users(id),
 name text not null,
 absent boolean not null,
 payable boolean not null,
 amount_cents bigint not null check(amount_cents>=0),
 primary key(revision_id,participant_id)
);
create table public.slm_payments (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 amount_cents bigint not null check(amount_cents between 1 and 999999999999),
 corrected_amount_cents bigint not null check(corrected_amount_cents between 0 and 999999999999),
 status text not null check(status in ('pending','accepted','rejected')),
 submitted_by uuid not null references auth.users(id),
 note text not null check(length(note)<=500),
 created_at timestamptz not null default clock_timestamp(),
 decided_by uuid references auth.users(id),
 decided_at timestamptz,
 check((status='pending' and decided_by is null and decided_at is null)
  or (status<>'pending' and decided_by is not null and decided_at is not null)),
 check(status='accepted' or corrected_amount_cents=amount_cents)
);
create index slm_payments_user on public.slm_payments(user_id,created_at,id);
create index slm_payments_pending on public.slm_payments(created_at,id) where status='pending';
create function slm_private.finance_payment_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'immutable_finance_history'; end if;
 if new.id<>old.id or new.user_id<>old.user_id or new.amount_cents<>old.amount_cents
  or new.submitted_by<>old.submitted_by or new.note<>old.note or new.created_at<>old.created_at
  or (old.status<>'pending' and (new.status<>old.status or new.decided_by is distinct from old.decided_by
   or new.decided_at is distinct from old.decided_at))
  or (old.status='pending' and (new.status not in ('accepted','rejected') or new.decided_by is null
   or new.decided_at is null or new.corrected_amount_cents<>old.corrected_amount_cents))
  or (old.status='rejected' and new.corrected_amount_cents<>old.corrected_amount_cents)
  then raise exception 'immutable_finance_history'; end if;
 return new;
end $$;
create trigger finance_payment_guard before update or delete on public.slm_payments
 for each row execute function slm_private.finance_payment_guard();
create table public.slm_finance_ledger (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id),
 event_id uuid references public.slm_events(id),
 participant_id uuid references public.slm_event_participants(id),
 revision_id bigint references public.slm_settlement_revisions(id),
 payment_id uuid references public.slm_payments(id),
 amount_cents bigint not null check(amount_cents<>0),
 kind text not null check(kind in ('charge','charge_correction','payment','payment_correction')),
 actor_id uuid not null references auth.users(id),
 reason text not null,
 created_at timestamptz not null default clock_timestamp(),
 check((kind in ('charge','charge_correction') and event_id is not null and participant_id is not null
        and revision_id is not null and payment_id is null)
    or (kind in ('payment','payment_correction') and event_id is null and participant_id is null
        and revision_id is null and payment_id is not null)),
 unique(revision_id,participant_id)
);
create unique index slm_payment_once on public.slm_finance_ledger(payment_id) where kind='payment';
create index slm_ledger_user on public.slm_finance_ledger(user_id,id);
create index slm_ledger_event on public.slm_finance_ledger(event_id,user_id);
create table public.slm_finance_audit (
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id),
 user_id uuid references auth.users(id),
 event_id uuid references public.slm_events(id),
 action text not null,
 reason text not null,
 snapshot jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create index slm_finance_audit_user on public.slm_finance_audit(user_id,id);
create index slm_finance_audit_event on public.slm_finance_audit(event_id,id);
create table public.slm_finance_requests (
 actor_id uuid not null references auth.users(id),
 request_id uuid not null,
 action text not null,
 body jsonb not null,
 response jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,request_id)
);

create function slm_private.finance_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select slm_private.current_session_valid() and exists(
  select 1 from public.slm_roles where user_id=auth.uid() and role='admin');
$$;
revoke all on function slm_private.finance_admin() from public,anon;
grant execute on function slm_private.finance_admin() to authenticated,service_role;
do $$ declare t text; begin
 foreach t in array array['slm_settlements','slm_settlement_shares','slm_settlement_revisions',
  'slm_settlement_lines','slm_payments','slm_finance_ledger','slm_finance_audit','slm_finance_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['slm_settlement_revisions_id_seq','slm_finance_ledger_id_seq','slm_finance_audit_id_seq'] loop
  execute format('grant usage,select on sequence public.%I to service_role',t);
 end loop;
end $$;
grant select on public.slm_finance_ledger,public.slm_payments,public.slm_finance_audit,
 public.slm_settlement_lines,public.slm_settlement_revisions to authenticated;
create policy ledger_own_read on public.slm_finance_ledger for select to authenticated
 using ((select slm_private.current_session_valid()) and (user_id=(select auth.uid()) or (select slm_private.finance_admin())));
create policy payments_own_read on public.slm_payments for select to authenticated
 using ((select slm_private.current_session_valid()) and (user_id=(select auth.uid()) or (select slm_private.finance_admin())));
create policy audit_own_read on public.slm_finance_audit for select to authenticated
 using ((select slm_private.current_session_valid()) and ((user_id=(select auth.uid()) and event_id is null) or (select slm_private.finance_admin())));
create policy lines_own_read on public.slm_settlement_lines for select to authenticated
 using ((select slm_private.current_session_valid()) and (responsible_user_id=(select auth.uid()) or (select slm_private.finance_admin())));
create policy revisions_admin_read on public.slm_settlement_revisions for select to authenticated
 using ((select slm_private.finance_admin()));
-- Stan roboczy i idempotencja dostępne tylko serwerowi. Klient nie ma write ani RPC.

create function slm_private.finance_immutable() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception 'immutable_finance_history'; end $$;
do $$ declare t text; begin
 foreach t in array array['slm_finance_ledger','slm_finance_audit','slm_settlement_revisions','slm_settlement_lines','slm_finance_requests'] loop
  execute format('create trigger finance_immutable before update or delete on public.%I for each row execute function slm_private.finance_immutable()',t);
  execute format('revoke update,delete,truncate on public.%I from service_role',t);
 end loop;
end $$;
revoke delete,truncate on public.slm_payments from service_role;

-- Dodatnie kwoty dziennika to wpłaty/zwroty należności, ujemne to obciążenia.
-- FIFO jest projekcją całego nieusuwalnego dziennika, więc korekta przelicza pokrycie.
create function slm_private.finance_dues(p_user uuid)
returns table(event_id uuid,starts_at timestamptz,due_cents bigint,covered_cents bigint,outstanding_cents bigint)
language sql stable security invoker set search_path='' as $$
 with dues as (
  select e.id,e.starts_at,greatest(0,-sum(l.amount_cents))::bigint due
  from public.slm_finance_ledger l join public.slm_events e on e.id=l.event_id
  join public.slm_settlements s on s.event_id=e.id
  where l.user_id=p_user and s.approved_at is not null
   and clock_timestamp()>=e.starts_at+make_interval(mins=>e.duration_minutes)
  group by e.id,e.starts_at
 ), credits as (
  select greatest(0,coalesce(sum(amount_cents),0))::bigint amount
  from public.slm_finance_ledger where user_id=p_user and payment_id is not null
 ), ranked as (
  select *,coalesce(sum(due) over(order by starts_at,id rows between unbounded preceding and 1 preceding),0)::bigint older
  from dues
 ) select id,starts_at,due,least(due,greatest(0,amount-older)),
   due-least(due,greatest(0,amount-older)) from ranked cross join credits order by starts_at,id;
$$;

create function slm_private.finance_preview(p_event uuid)
returns table(participant_id uuid,responsible_user_id uuid,name text,status text,absent boolean,
 payable boolean,charge_override boolean,replacement_id uuid,amount_cents bigint)
language sql stable security invoker set search_path='' as $$
 with shares as (
  select p.id,p.responsible_user_id,coalesce(p.guest_name,
   case when pr.display_as='full_name' and length(trim(pr.full_name))>0 then pr.full_name else a.login end) name,
   p.status,p.absent,s.charge_override,s.replacement_id,
   e.status<>'cancelled' and coalesce(s.charge_override,s.default_payable) payable
  from public.slm_settlement_shares s join public.slm_event_participants p on p.id=s.participant_id
  join public.slm_events e on e.id=s.event_id join public.slm_aliases a on a.user_id=p.responsible_user_id
  join public.slm_profiles pr on pr.user_id=a.user_id where s.event_id=p_event
 ), ranked as (
  select *,count(*) filter(where payable) over() n,
   count(*) filter(where payable) over(order by id rows unbounded preceding) position from shares
 ) select id,responsible_user_id,name,status,absent,payable,charge_override,replacement_id,
  case when payable and n>0 then e.total_cost_cents/n+case when position<=e.total_cost_cents%n then 1 else 0 end else 0 end
 from ranked cross join public.slm_events e where e.id=p_event order by id;
$$;

create function slm_private.finance_revise(p_event uuid,p_actor uuid,p_reason text) returns void
language plpgsql security invoker set search_path='' as $$
declare s public.slm_settlements; e public.slm_events; v_revision bigint; v_previous bigint; line record;
begin
 select * into s from public.slm_settlements where event_id=p_event for update;
 if s.approved_at is null then return; end if;
 select * into e from public.slm_events where id=p_event;
 if e.status<>'cancelled' and e.total_cost_cents>0 and not exists(
  select 1 from slm_private.finance_preview(p_event) where payable) then raise exception 'no_payers'; end if;
 select id into v_previous from public.slm_settlement_revisions where event_id=p_event and revision=s.revision;
 update public.slm_settlements set revision=revision+1 where event_id=p_event returning * into s;
 insert into public.slm_settlement_revisions(event_id,revision,cost_cents,actor_id,reason)
 values(p_event,s.revision,case when e.status='cancelled' then 0 else e.total_cost_cents end,p_actor,p_reason)
 returning id into v_revision;
 for line in select * from slm_private.finance_preview(p_event) loop
  insert into public.slm_settlement_lines values(v_revision,line.participant_id,line.responsible_user_id,
   line.name,line.absent,line.payable,line.amount_cents);
  insert into public.slm_finance_ledger(user_id,event_id,participant_id,revision_id,amount_cents,kind,actor_id,reason)
   select line.responsible_user_id,p_event,line.participant_id,v_revision,
    coalesce((select amount_cents from public.slm_settlement_lines where revision_id=v_previous
     and participant_id=line.participant_id),0)-line.amount_cents,
    case when s.revision=1 then 'charge' else 'charge_correction' end,p_actor,p_reason
   where coalesce((select amount_cents from public.slm_settlement_lines where revision_id=v_previous
    and participant_id=line.participant_id),0)<>line.amount_cents;
 end loop;
end $$;

-- Używa historycznego after_cutoff i kolejności serwera, również przy odtwarzaniu.
create function slm_private.finance_event_history(h public.slm_event_history) returns void
language plpgsql security invoker set search_path='' as $$
declare v_count integer; v_replacement uuid; v_self_queued boolean;
begin
 insert into public.slm_settlements(event_id) values(h.event_id) on conflict do nothing;
 if h.participant_id is not null then
  insert into public.slm_settlement_shares(participant_id,event_id) values(h.participant_id,h.event_id) on conflict do nothing;
  if h.action='joined' then
   select release_sequence is not null and replacement_id is null and default_payable into v_self_queued
    from public.slm_settlement_shares where participant_id=h.participant_id;
   update public.slm_settlement_shares set default_payable=true,release_sequence=null,replacement_id=null
    where participant_id=h.participant_id;
   if not coalesce(v_self_queued,false) and (select coalesce(charge_override,default_payable)
    from public.slm_settlement_shares where participant_id=h.participant_id) and not exists(
    select 1 from public.slm_settlement_shares where replacement_id=h.participant_id) then
    select participant_id into v_replacement from public.slm_settlement_shares
     where event_id=h.event_id and participant_id<>h.participant_id and release_sequence is not null
      and replacement_id is null and default_payable and charge_override is null
     order by release_sequence,participant_id limit 1;
    if v_replacement is not null then
     update public.slm_settlement_shares set default_payable=false,replacement_id=h.participant_id where participant_id=v_replacement;
    end if;
   end if;
  elsif h.action in ('withdrawn','reserved') and h.snapshot->>'previous_status'='registered' then
   select count(*) into v_count from (
    select distinct on (participant_id) snapshot->'participant'->>'status' status
    from public.slm_event_history where event_id=h.event_id and participant_id is not null and sequence<=h.sequence
    order by participant_id,sequence desc
   ) state where status='registered';
   update public.slm_settlement_shares set default_payable=h.after_cutoff and v_count<10,
    release_sequence=case when h.after_cutoff and v_count<10 then h.sequence else null end,replacement_id=null
    where participant_id=h.participant_id;
  end if;
 end if;
 if h.action='cancelled' then
  update public.slm_settlement_shares set default_payable=false,charge_override=null,release_sequence=null where event_id=h.event_id;
 end if;
 update public.slm_settlements set version=version+1 where event_id=h.event_id;
 insert into public.slm_finance_audit(actor_id,user_id,event_id,action,reason,snapshot)
 values(h.actor_id,h.responsible_user_id,h.event_id,'events_'||h.action,coalesce(nullif(h.snapshot->>'reason',''),'Zmiana wydarzenia'),
  jsonb_build_object('history_sequence',h.sequence,'history',h.snapshot,'after_cutoff',h.after_cutoff,
   'replacement_for',v_replacement,'shares',(select coalesce(jsonb_agg(to_jsonb(s)),'[]')
    from public.slm_settlement_shares s where event_id=h.event_id)));
 perform slm_private.finance_revise(h.event_id,h.actor_id,coalesce(nullif(h.snapshot->>'reason',''),'Zmiana wydarzenia: '||h.action));
end $$;

-- Nie naliczamy istniejących meczów: odtwarzamy tylko obowiązki robocze i FIFO.
insert into public.slm_settlements(event_id) select id from public.slm_events;
insert into public.slm_settlement_shares(participant_id,event_id,default_payable)
 select p.id,p.event_id,p.status='registered' and e.status='scheduled'
 from public.slm_event_participants p join public.slm_events e on e.id=p.event_id;
do $$ declare h public.slm_event_history; begin
 for h in select * from public.slm_event_history order by sequence loop
  perform slm_private.finance_event_history(h);
 end loop;
end $$;
create function slm_private.finance_history_trigger() returns trigger
language plpgsql security invoker set search_path='' as $$
begin perform slm_private.finance_event_history(new); return new; end $$;
create trigger finance_history after insert on public.slm_event_history
 for each row execute function slm_private.finance_history_trigger();

-- Domyślny EXECUTE funkcji PostgreSQL nie może otworzyć prywatnej ścieżki zapisu.
do $$ declare f text; begin
 foreach f in array array['event_cost_cents()','finance_immutable()','finance_dues(uuid)',
  'finance_preview(uuid)','finance_revise(uuid,uuid,text)','finance_event_history(public.slm_event_history)',
  'finance_history_trigger()','finance_payment_guard()'] loop
  execute 'revoke all on function slm_private.'||f||' from public,anon,authenticated';
  execute 'grant execute on function slm_private.'||f||' to service_role';
 end loop;
end $$;

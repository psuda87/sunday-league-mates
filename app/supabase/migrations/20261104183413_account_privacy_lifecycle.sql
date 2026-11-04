-- Additive privacy lifecycle. No production deletion is executed by this migration.
begin;
alter table public.slm_profiles add column share_phone boolean not null default false;
alter table public.slm_aliases alter column phone drop not null;
alter table public.slm_player_profiles drop constraint slm_player_profiles_user_id_fkey;
alter table public.slm_player_profiles add foreign key(user_id) references auth.users(id) on delete cascade;
-- Raw contact tables are never a directory. Own data continues through accounts.
revoke select on public.slm_aliases,public.slm_player_profiles,public.slm_auth_proof_accounts from anon,authenticated;

-- An upload already accepted by accounts must finish (or time out) before a
-- deletion can be acknowledged. Revocation alone cannot stop an in-flight HTTP
-- upload performed by the backend service credential.
create table slm_private.photo_upload_leases(user_id uuid not null,lease_id uuid primary key,expires_at timestamptz not null);
alter table slm_private.photo_upload_leases enable row level security;
revoke all on slm_private.photo_upload_leases from public,anon,authenticated,service_role;
create function public.slm_photo_upload_lease(p_user uuid,p_session uuid,p_lease uuid,p_release boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(20261014,1);
 if p_release then delete from slm_private.photo_upload_leases where user_id=p_user and lease_id=p_lease;return;end if;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 delete from slm_private.photo_upload_leases where expires_at<clock_timestamp();
 insert into slm_private.photo_upload_leases values(p_user,p_lease,clock_timestamp()+interval '2 minutes');
end $$;

create function slm_private.phone_for(p_viewer uuid,p_target uuid) returns text
language sql stable security definer set search_path='' as $$
 select coalesce(n.contact_phone,a.phone) from public.slm_profiles p
 join public.slm_account_security s on s.user_id=p.user_id and s.active and s.operation_id is null
 left join public.slm_player_profiles n on n.user_id=p.user_id
 left join public.slm_aliases a on a.user_id=p.user_id
 where p.user_id=p_target and (p_viewer=p_target or p.share_phone and exists(
 select 1 from public.slm_group_members v join public.slm_group_members t using(group_id)
 join public.slm_groups g on g.id=v.group_id and not g.archived
 join public.slm_account_security vs on vs.user_id=v.user_id and vs.active and vs.operation_id is null
 where v.user_id=p_viewer and t.user_id=p_target));
$$;
revoke all on function slm_private.phone_for(uuid,uuid) from public,anon,authenticated;
grant execute on function slm_private.phone_for(uuid,uuid) to service_role;

create function public.slm_phone_visibility(p_viewer uuid,p_targets uuid[]) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(u::text,slm_private.phone_for(p_viewer,u)),'{}') from unnest(p_targets) u;
$$;
create function public.slm_phone_save(p_user uuid,p_session uuid,p_phone text,p_share boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for update;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_share is null or p_phone is null or (p_phone<>'' and p_phone !~ '^\+[1-9][0-9]{7,14}$') then raise exception 'invalid_input';end if;
 -- Edge normalizes new numbers to Poland; historical foreign numbers may be kept.
 if p_phone<>'' and p_phone !~ '^\+48[0-9]{9}$' and p_phone is distinct from slm_private.phone_for(p_user,p_user) then raise exception 'invalid_phone';end if;
 update public.slm_aliases set phone=nullif(p_phone,'') where user_id=p_user;
 update public.slm_player_profiles set contact_phone=nullif(p_phone,'') where user_id=p_user;
 update public.slm_profiles set share_phone=p_share and p_phone<>'' where user_id=p_user;
end $$;

create function slm_private.phone_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous text;current_phone text;begin
 previous:=case when TG_TABLE_NAME='slm_aliases' then to_jsonb(old)->>'phone' else to_jsonb(old)->>'contact_phone' end;
 current_phone:=case when TG_TABLE_NAME='slm_aliases' then to_jsonb(new)->>'phone' else to_jsonb(new)->>'contact_phone' end;
 if previous is distinct from current_phone then
 update public.slm_profiles set share_phone=false where user_id=new.user_id;
 if TG_TABLE_NAME='slm_aliases' and (current_phone is null or current_phone ~ '^\+48[0-9]{9}$') then
 update public.slm_player_profiles set contact_phone=current_phone where user_id=new.user_id;
 end if;
 if previous is not null then
 delete from public.slm_group_requests where phone_lookup_key=encode(sha256(convert_to(previous,'UTF8')),'hex');
 delete from public.slm_v2_requests where body->>'phone'=previous;
 end if;
 end if;return new;
end $$;
revoke all on function slm_private.phone_changed() from public,anon,authenticated;
grant execute on function slm_private.phone_changed() to service_role;
create trigger privacy_phone_changed after update of phone on public.slm_aliases for each row execute function slm_private.phone_changed();
create trigger privacy_contact_changed after update of contact_phone on public.slm_player_profiles for each row execute function slm_private.phone_changed();

-- Update every current SQL projection, including historical dispatch bodies. No
-- old migration is edited. Candidate/request projections never disclose contacts.
do $$ declare f record; d text; next_d text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','slm_private') and p.prokind='f' loop
 d:=pg_get_functiondef(f.oid);next_d:=d;
 if position('case when g.admin_id=p_user and r.kind=''join'' and r.state=''pending'' then coalesce(pp.contact_phone,a.phone) end' in next_d)>0 then
 next_d:=replace(next_d,'case when g.admin_id=p_user and r.kind=''join'' and r.state=''pending'' then coalesce(pp.contact_phone,a.phone) end','null::text');end if;
 next_d:=replace(next_d,'coalesce(p.guest_phone,pp.contact_phone,a.phone)','slm_private.phone_for(p_user,p.member_id)');
 next_d:=replace(next_d,'coalesce(p.guest_phone,a.phone)','slm_private.phone_for(p_user,p.member_id)');
 next_d:=replace(next_d,'coalesce(pp.contact_phone,a.phone)','slm_private.phone_for(p_user,coalesce(pp.user_id,a.user_id))');
 if position('FUNCTION slm_private.group_profile(' in next_d)>0 then
 next_d:=replace(next_d,'coalesce(n.contact_phone,a.phone)','slm_private.phone_for(p_viewer,p_target)');end if;
 if next_d<>d then execute next_d;end if;
 end loop;
end $$;

create table slm_private.account_deletions(
 operation_id uuid primary key, subject_id uuid unique, proof_hash text not null,
 phase text not null default 'prepared' check(phase in ('prepared','purged','complete')),
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 lease_id uuid,lease_until timestamptz,
 notice_sent_at timestamptz,notice_attempts integer not null default 0,
 notice_after timestamptz not null default clock_timestamp()
);
alter table slm_private.account_deletions enable row level security;
revoke all on slm_private.account_deletions from public,anon,authenticated;
grant all on slm_private.account_deletions to service_role;

create function public.slm_deletion_begin(p_user uuid,p_session uuid,p_operation uuid,p_proof text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(20261014,1);
 perform 1 from public.slm_account_security where user_id=p_user for update;
 if not slm_private.session_valid(p_user,p_session,false) then raise exception 'session_invalid';end if;
 if p_operation is null or p_proof !~ '^[a-f0-9]{64}$' then raise exception 'invalid_input';end if;
 -- Transfer must use the existing group transfer flow. Sole-member groups close.
 if exists(select 1 from public.slm_groups g where g.admin_id=p_user and not g.archived
 and exists(select 1 from public.slm_group_members m where m.group_id=g.id and m.user_id<>p_user)) then raise exception 'group_transfer_required';end if;
 insert into slm_private.account_deletions(operation_id,subject_id,proof_hash)
 values(p_operation,p_user,encode(sha256(convert_to(p_proof,'UTF8')),'hex'));
 update public.slm_groups set archived=true,version=version+1 where admin_id=p_user;
 -- Fail closed before external Storage/Auth calls. No old JWT remains usable.
 update public.slm_account_security set active=false,security_version=security_version+1 where user_id=p_user;
 delete from public.slm_push_device_watermarks where device_id in(select id from public.slm_push_devices where user_id=p_user);
 delete from public.slm_push_revocations where device_id in(select id from public.slm_push_devices where user_id=p_user);
 delete from public.slm_account_sessions where user_id=p_user;
end $$;

-- Only this owner-executed, service-callable lifecycle may redact immutable
-- identity metadata. All monetary facts and ledger keys must remain unchanged.
create function slm_private.privacy_redaction_ok(p_table text,p_old jsonb,p_new jsonb) returns boolean
language sql stable security invoker set search_path='' as $$
 select current_user=pg_get_userbyid((select proowner from pg_proc where oid=to_regprocedure('public.slm_deletion_step(uuid,text,text,uuid)')))
 and exists(select 1 from slm_private.account_deletions
 where operation_id::text=current_setting('slm.deletion_operation',true) and phase='prepared')
 and (p_new is null and p_table in ('slm_finance_requests') or p_new is not null and
 (p_old-array['user_id','actor_id','responsible_user_id','submitted_by','decided_by','decided_by_erased','name','note','reason','snapshot','body','response'])=
 (p_new-array['user_id','actor_id','responsible_user_id','submitted_by','decided_by','decided_by_erased','name','note','reason','snapshot','body','response']));
$$;
revoke all on function slm_private.privacy_redaction_ok(text,jsonb,jsonb) from public,anon,authenticated,service_role;
do $$ declare f regprocedure;d text;begin
 foreach f in array array['slm_private.finance_immutable()'::regprocedure,'slm_private.finance_payment_guard()'::regprocedure,
 'slm_private.group_payment_identity_guard()'::regprocedure] loop
 d:=pg_get_functiondef(f);
 d:=replace(d,'BEGIN', 'begin');
 d:=regexp_replace(d,'\mbegin\M', E'begin\n if slm_private.privacy_redaction_ok(TG_TABLE_NAME,to_jsonb(old),case when TG_OP=''DELETE'' then null else to_jsonb(new) end) then return case when TG_OP=''DELETE'' then old else new end;end if;', 'i');
 execute d;
 end loop;
end $$;

-- Only history references become nullable; personal ownership rows are removed.
do $$ declare r record;begin
 for r in select c.conrelid::regclass as tbl,a.attname from pg_constraint c
 join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
 where c.contype='f' and c.confrelid='auth.users'::regclass and (select relname from pg_class where oid=c.conrelid) in
 ('slm_groups','slm_events','slm_event_participants','slm_event_history','slm_settlements',
 'slm_settlement_revisions','slm_settlement_lines','slm_payments','slm_finance_ledger','slm_finance_audit',
 'slm_group_audit','slm_matches','slm_match_entries','slm_match_history','slm_group_payments',
 'slm_group_ledger','slm_group_finance_audit','slm_surplus_history','slm_match_lineups') loop
 execute format('alter table %s alter column %I drop not null',r.tbl,r.attname);
 end loop;
end $$;
alter table public.slm_settlements add column approved_by_erased boolean not null default false;
alter table public.slm_settlements drop constraint slm_settlements_check;
alter table public.slm_settlements add check((approved_at is null and approved_by is null and revision=0)
 or (approved_at is not null and (approved_by is not null or approved_by_erased)));
alter table public.slm_groups add check(admin_id is not null or archived);
alter table public.slm_payments add column decided_by_erased boolean not null default false;
alter table public.slm_payments drop constraint slm_payments_check;
alter table public.slm_payments add check((status='pending' and decided_by is null and decided_at is null)
 or (status<>'pending' and (decided_by is not null or decided_by_erased) and decided_at is not null));

create function slm_private.erase_json(p_value jsonb,p_needles text[]) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb;v text;needle text;rest text;prefix text;suffix text;built text;pos integer;linked boolean;begin
 if jsonb_typeof(p_value)='object' then
 select exists(select 1 from jsonb_each(p_value) where value=to_jsonb(p_needles[1])) into linked;
 select coalesce(jsonb_object_agg(key,case
 when linked and key in ('phone','contact_phone','guest_phone','target_phone','email','technical_email') then 'null'::jsonb
 when linked and key in ('name','nickname','first_name','full_name','login') then to_jsonb('Usunięty użytkownik'::text)
 else slm_private.erase_json(value,p_needles) end),'{}') into result from jsonb_each(p_value);return result;
 elsif jsonb_typeof(p_value)='array' then
 select coalesce(jsonb_agg(slm_private.erase_json(value,p_needles)),'[]') into result from jsonb_array_elements(p_value);return result;
 elsif jsonb_typeof(p_value)='string' then
 v:=p_value#>>'{}';foreach needle in array p_needles loop
 if length(needle)>0 then
 rest:=v;built:='';loop
 pos:=strpos(rest,needle);exit when pos=0;
 prefix:=substr(rest,1,pos-1);suffix:=substr(rest,pos+length(needle));
 -- Literal whole tokens: a short first name must not corrupt another UUID,
 -- a longer name, JSON key or an accounting code containing those letters.
 if (prefix='' or right(prefix,1)!~'[[:alnum:]_]') and (suffix='' or left(suffix,1)!~'[[:alnum:]_]') then
 built:=built||prefix||'[usunięto]';else built:=built||prefix||needle;end if;
 rest:=suffix;
 end loop;v:=built||rest;
 end if;end loop;return to_jsonb(v);
 end if;return p_value;
end $$;
revoke all on function slm_private.erase_json(jsonb,text[]) from public,anon,authenticated,service_role;

create function public.slm_deletion_step(p_operation uuid,p_proof text,p_step text,p_lease uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j slm_private.account_deletions; r record; needles text[];u uuid; sql_text text;begin
 perform pg_advisory_xact_lock(20261014,1);
 select * into j from slm_private.account_deletions where operation_id=p_operation for update;
 -- A null proof is used only by the service-role worker; clients cannot call RPC.
 if j.operation_id is null or (p_proof is not null and j.proof_hash<>encode(sha256(convert_to(p_proof,'UTF8')),'hex')) then raise exception 'deletion_invalid';end if;
 if p_step='claim' then
 if j.lease_until>clock_timestamp() then raise exception 'deletion_busy';end if;
 update slm_private.account_deletions set lease_id=p_lease,lease_until=clock_timestamp()+interval '90 seconds',
 notice_attempts=notice_attempts+1,notice_after=clock_timestamp()+make_interval(secs=>least(86400,60*power(2,least(notice_attempts,10)))::integer) where operation_id=p_operation;
 elsif p_step='release' then
 update slm_private.account_deletions set lease_id=null,lease_until=null where operation_id=p_operation and lease_id=p_lease;
 elsif p_step='purge' then
 if j.lease_id is distinct from p_lease or j.lease_until<clock_timestamp() then raise exception 'deletion_busy';end if;
 if j.phase='prepared' then
 u:=j.subject_id;perform set_config('slm.deletion_operation',p_operation::text,true);
 select array_remove(array[u::text,a.login,a.phone,a.technical_email,p.full_name,p.first_name,n.nickname,n.contact_phone,au.email],null)
 into needles from public.slm_profiles p left join public.slm_aliases a using(user_id)
 left join public.slm_player_profiles n using(user_id) left join auth.users au on au.id=p.user_id where p.user_id=u;
 -- Remove requests/caches rather than preserving submitted personal payloads.
 delete from public.slm_group_requests where actor_id=u or target_id=u;
 delete from public.slm_group_members where user_id=u;
 delete from public.slm_v2_requests where actor_id=u or body::text like '%'||u::text||'%' or response::text like '%'||u::text||'%';
 delete from public.slm_finance_requests where actor_id=u or body::text like '%'||u::text||'%' or response::text like '%'||u::text||'%';
 update public.slm_settlements set approved_by_erased=true where approved_by=u;
 update public.slm_payments set decided_by_erased=true where decided_by=u;
 update public.slm_settlement_lines set name='Usunięty użytkownik' where responsible_user_id=u;
 -- Redact all personal columns together while original row identities still
 -- exist. Never replace a common name in unrelated users' rows or titles.
 for r in select table_name,string_agg(case when data_type='jsonb' then
 format('%I=slm_private.erase_json(t.%I,$1)',column_name,column_name)
 else format('%I=slm_private.erase_json(to_jsonb(t.%I),$1)#>>''{}''',column_name,column_name) end,',') as assignments
 from information_schema.columns where table_schema='public' and table_name like 'slm_%'
 and (data_type='jsonb' or column_name in ('note','reason','guest_name','title','body')) group by table_name loop
 sql_text:=format('update public.%I t set %s where to_jsonb(t)::text like $2',r.table_name,r.assignments);
 execute sql_text using coalesce(needles,array[u::text]),'%'||u::text||'%';
 end loop;
 -- Membership/entry records keep numeric accounting facts, not the person.
 update public.slm_event_participants set member_id=null,guest_name='Usunięty użytkownik',guest_phone=null where member_id=u;
 update public.slm_match_entries set member_id=null,guest_name='Usunięty użytkownik',guest_phone=null where member_id=u;
 update public.slm_event_participants set guest_phone=null,guest_name='Usunięty gość' where responsible_user_id=u and member_id is null;
 update public.slm_match_entries set guest_phone=null,guest_name='Usunięty gość' where responsible_user_id=u and member_id is null;
 for r in select c.conrelid::regclass as tbl,a.attname from pg_constraint c
 join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
 where c.contype='f' and c.confrelid='auth.users'::regclass and (select relname from pg_class where oid=c.conrelid) in
 ('slm_groups','slm_events','slm_event_participants','slm_event_history','slm_settlements','slm_settlement_revisions',
 'slm_settlement_lines','slm_payments','slm_finance_ledger','slm_finance_audit','slm_group_audit','slm_matches',
 'slm_match_entries','slm_match_history','slm_group_payments','slm_group_ledger','slm_group_finance_audit',
 'slm_surplus_history','slm_match_lineups','slm_account_audit') loop
 execute format('update %s set %I=null where %I=$1',r.tbl,r.attname,r.attname) using u;
 end loop;
 delete from public.slm_player_profiles where user_id=u;
 update slm_private.account_deletions set phase='purged' where operation_id=p_operation;
 end if;
 elsif p_step='complete' then
 if j.lease_id is distinct from p_lease or j.phase<>'purged' then raise exception 'deletion_busy';end if;
 if exists(select 1 from auth.users where id=j.subject_id)
 or exists(select 1 from slm_private.photo_upload_leases where user_id=j.subject_id and expires_at>clock_timestamp())
 or exists(select 1 from storage.objects where bucket_id='slm-profile-photos' and name like j.subject_id::text||'/%') then raise exception 'deletion_pending';end if;
 delete from slm_private.photo_upload_leases where user_id=j.subject_id;
 update slm_private.account_deletions set phase='complete',subject_id=null,completed_at=clock_timestamp() where operation_id=p_operation;
 elsif p_step='notice_sent' then
 if j.phase<>'complete' or j.lease_id is distinct from p_lease then raise exception 'deletion_busy';end if;
 update slm_private.account_deletions set notice_sent_at=clock_timestamp() where operation_id=p_operation;
 else raise exception 'invalid_input';end if;
 select * into j from slm_private.account_deletions where operation_id=p_operation;
 return jsonb_build_object('operation_id',j.operation_id,'subject_id',j.subject_id,'phase',j.phase,'completed_at',j.completed_at,'notice_sent',j.notice_sent_at is not null);
end $$;

create function public.slm_deletion_work() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('operation_id',operation_id)),'[]') from
 (select operation_id from slm_private.account_deletions where
 (phase<>'complete' or notice_sent_at is null) and notice_after<=clock_timestamp()
 and (lease_until is null or lease_until<clock_timestamp()) order by created_at limit 5) j;
$$;

do $$ declare f regprocedure;begin
 foreach f in array array['public.slm_phone_visibility(uuid,uuid[])'::regprocedure,'public.slm_phone_save(uuid,uuid,text,boolean)'::regprocedure,
 'public.slm_deletion_begin(uuid,uuid,uuid,text)'::regprocedure,'public.slm_deletion_step(uuid,text,text,uuid)'::regprocedure,
 'public.slm_deletion_work()'::regprocedure,'public.slm_photo_upload_lease(uuid,uuid,uuid,boolean)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
commit;

-- Account erasure failed for every user with an idempotency receipt: purge deletes their rows from
-- public.slm_v2_requests, but that table carries the immutable-history trigger and the redaction
-- allowlist only covered slm_finance_requests, so the whole deletion aborted with immutable_finance_history.
-- Allow the same narrowly scoped delete (owner-executed purge of a prepared deletion operation) for slm_v2_requests.
begin;
create or replace function slm_private.privacy_redaction_ok(p_table text,p_old jsonb,p_new jsonb) returns boolean
language sql stable security invoker set search_path='' as $$
 select current_user=pg_get_userbyid((select proowner from pg_proc where oid=to_regprocedure('public.slm_deletion_step(uuid,text,text,uuid)')))
 and exists(select 1 from slm_private.account_deletions
 where operation_id::text=current_setting('slm.deletion_operation',true) and phase='prepared')
 and (p_new is null and p_table in ('slm_finance_requests','slm_v2_requests') or p_new is not null and
 (p_old-array['user_id','actor_id','responsible_user_id','submitted_by','decided_by','decided_by_erased','name','note','reason','snapshot','body','response'])=
 (p_new-array['user_id','actor_id','responsible_user_id','submitted_by','decided_by','decided_by_erased','name','note','reason','snapshot','body','response']));
$$;
commit;

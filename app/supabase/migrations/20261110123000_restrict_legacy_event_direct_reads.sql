-- P1: Legacy event data must not be directly readable through PostgREST.
-- All application reads must use the existing session-validated accounts API.
-- Keep service_role privileges and existing RPC/trigger behavior unchanged.
-- Do not alter table contents or any UI.
begin;
revoke select on table public.slm_events from authenticated;
revoke select on table public.slm_event_participants from authenticated;
drop policy if exists events_member_read on public.slm_events;
drop policy if exists participants_member_read on public.slm_event_participants;
commit;

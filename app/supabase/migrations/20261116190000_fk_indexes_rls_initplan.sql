-- Porządki wydajnościowe (Supabase Performance Advisor, 2026-11-16).
-- 1) Indeksy pokrywające 56 kluczy obcych bez indeksu (szybsze JOIN-y i kaskady DELETE/UPDATE).
-- 2) Polityki RLS slm_group_ledger/slm_group_payments: auth.uid() w (select ...), by wartość liczyła się raz na zapytanie.
-- Bez zmiany uprawnień i logiki. Tabele są małe, więc zwykły CREATE INDEX nie blokuje odczuwalnie.

create index if not exists slm_account_audit_actor_id_idx on public.slm_account_audit (actor_id);
create index if not exists slm_account_audit_target_id_idx on public.slm_account_audit (target_id);
create index if not exists slm_auth_proof_sessions_user_id_idx on public.slm_auth_proof_sessions (user_id);
create index if not exists slm_finance_audit_actor_id_idx on public.slm_finance_audit (actor_id);
create index if not exists slm_finance_ledger_actor_id_idx on public.slm_finance_ledger (actor_id);
create index if not exists slm_finance_ledger_participant_id_idx on public.slm_finance_ledger (participant_id);
create index if not exists slm_group_audit_actor_id_idx on public.slm_group_audit (actor_id);
create index if not exists slm_group_audit_group_id_idx on public.slm_group_audit (group_id);
create index if not exists slm_group_finance_audit_actor_id_idx on public.slm_group_finance_audit (actor_id);
create index if not exists slm_group_finance_audit_event_id_idx on public.slm_group_finance_audit (event_id);
create index if not exists slm_group_finance_audit_group_id_idx on public.slm_group_finance_audit (group_id);
create index if not exists slm_group_finance_audit_user_id_idx on public.slm_group_finance_audit (user_id);
create index if not exists slm_group_ledger_actor_id_idx on public.slm_group_ledger (actor_id);
create index if not exists slm_group_ledger_entry_id_idx on public.slm_group_ledger (entry_id);
create index if not exists slm_group_ledger_user_id_idx on public.slm_group_ledger (user_id);
create index if not exists slm_group_payments_decided_by_idx on public.slm_group_payments (decided_by);
create index if not exists slm_group_payments_event_id_idx on public.slm_group_payments (event_id);
create index if not exists slm_group_payments_group_id_idx on public.slm_group_payments (group_id);
create index if not exists slm_group_payments_submitted_by_idx on public.slm_group_payments (submitted_by);
create index if not exists slm_group_payments_user_id_idx on public.slm_group_payments (user_id);
create index if not exists slm_group_requests_actor_id_idx on public.slm_group_requests (actor_id);
create index if not exists slm_group_requests_target_id_idx on public.slm_group_requests (target_id);
create index if not exists slm_group_surplus_group_id_idx on public.slm_group_surplus (group_id);
create index if not exists slm_groups_admin_id_idx on public.slm_groups (admin_id);
create index if not exists slm_match_entries_member_id_idx on public.slm_match_entries (member_id);
create index if not exists slm_match_entries_replacement_id_idx on public.slm_match_entries (replacement_id);
create index if not exists slm_match_entries_responsible_user_id_idx on public.slm_match_entries (responsible_user_id);
create index if not exists slm_match_history_actor_id_idx on public.slm_match_history (actor_id);
create index if not exists slm_match_history_entry_id_idx on public.slm_match_history (entry_id);
create index if not exists slm_match_history_event_id_idx on public.slm_match_history (event_id);
create index if not exists slm_match_lineups_updated_by_idx on public.slm_match_lineups (updated_by);
create index if not exists slm_match_rating_state_mvp_user_idx on public.slm_match_rating_state (mvp_user);
create index if not exists slm_match_rating_state_score_by_idx on public.slm_match_rating_state (score_by);
create index if not exists slm_match_ratings_rater_id_idx on public.slm_match_ratings (rater_id);
create index if not exists slm_match_ratings_target_id_idx on public.slm_match_ratings (target_id);
create index if not exists slm_match_stats_user_id_idx on public.slm_match_stats (user_id);
create index if not exists slm_match_votes_mvp_user_idx on public.slm_match_votes (mvp_user);
create index if not exists slm_match_votes_voter_id_idx on public.slm_match_votes (voter_id);
create index if not exists slm_matches_created_by_idx on public.slm_matches (created_by);
create index if not exists slm_notification_sources_event_id_idx on public.slm_notification_sources (event_id);
create index if not exists slm_notification_sources_match_id_idx on public.slm_notification_sources (match_id);
create index if not exists slm_notifications_event_id_idx on public.slm_notifications (event_id);
create index if not exists slm_notifications_match_id_idx on public.slm_notifications (match_id);
create index if not exists slm_payments_decided_by_idx on public.slm_payments (decided_by);
create index if not exists slm_payments_submitted_by_idx on public.slm_payments (submitted_by);
create index if not exists slm_push_devices_session_id_idx on public.slm_push_devices (session_id);
create index if not exists slm_push_queue_device_id_idx on public.slm_push_queue (device_id);
create index if not exists slm_rating_history_event_id_idx on public.slm_rating_history (event_id);
create index if not exists slm_settlement_lines_participant_id_idx on public.slm_settlement_lines (participant_id);
create index if not exists slm_settlement_lines_responsible_user_id_idx on public.slm_settlement_lines (responsible_user_id);
create index if not exists slm_settlement_revisions_actor_id_idx on public.slm_settlement_revisions (actor_id);
create index if not exists slm_settlement_shares_release_sequence_idx on public.slm_settlement_shares (release_sequence);
create index if not exists slm_settlements_approved_by_idx on public.slm_settlements (approved_by);
create index if not exists slm_surplus_history_actor_id_idx on public.slm_surplus_history (actor_id);
create index if not exists slm_surplus_history_event_id_idx on public.slm_surplus_history (event_id);
create index if not exists slm_surplus_history_group_id_idx on public.slm_surplus_history (group_id);

alter policy scoped_ledger_read on public.slm_group_ledger
  using (slm_private.current_session_valid() and (user_id = (select auth.uid()) or slm_private.own_finance_scope(group_id, event_id)));
alter policy scoped_payments_read on public.slm_group_payments
  using (slm_private.current_session_valid() and (user_id = (select auth.uid()) or slm_private.own_finance_scope(group_id, event_id)));

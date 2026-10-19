import { spawnSync } from 'node:child_process';
import { assertBranch } from './accounts-admin-local.mjs';
export async function cleanupScopedFixture(api,ids,groups){
 assertBranch();

 // Only our generated IDs. Cleanup uses a transaction-local replication role so immutable
 // test audit records can be removed. Authorization tests above run with normal triggers/RLS.
 // Never disable table triggers globally or alter an existing user/group.
 if(ids.length){
  const uuid=/^[0-9a-f-]{36}$/;if(!ids.every(x=>uuid.test(x))||!groups.every(x=>uuid.test(x)))throw new Error('Unsafe cleanup IDs');
  const users=ids.map(x=>"'"+x+"'").join(','),gs=groups.length?groups.map(x=>"'"+x+"'").join(','):"'00000000-0000-0000-0000-000000000000'";
  const query=`begin; set local session_replication_role=replica;
  do $$ begin if exists(select 1 from public.slm_groups where id in (${gs}) and admin_id not in (${users})) then raise exception 'fixture ownership mismatch';end if;end $$;
  delete from public.slm_push_queue where notification_id in(select id from public.slm_notifications where match_id in(select id from public.slm_matches where group_id in (${gs})));
  delete from public.slm_notifications where match_id in(select id from public.slm_matches where group_id in (${gs}));
  delete from public.slm_notification_sources where match_id in(select id from public.slm_matches where group_id in (${gs}));
  delete from public.slm_match_reminders where match_id in(select id from public.slm_matches where group_id in (${gs}));
  delete from public.slm_surplus_history where group_id in (${gs});delete from public.slm_group_surplus where group_id in (${gs});
  delete from public.slm_group_finance_audit where group_id in (${gs});delete from public.slm_group_ledger where group_id in (${gs});delete from public.slm_group_payments where group_id in (${gs});
  delete from public.slm_match_history where event_id in (select id from public.slm_matches where group_id in (${gs}));
  delete from public.slm_match_entries where event_id in (select id from public.slm_matches where group_id in (${gs}));delete from public.slm_matches where group_id in (${gs});
  delete from public.slm_group_audit where group_id in (${gs});delete from public.slm_group_requests where group_id in (${gs});delete from public.slm_group_members where group_id in (${gs});
  delete from public.slm_v2_requests where actor_id in (${users});delete from public.slm_groups where id in (${gs});delete from public.slm_player_profiles where user_id in (${users});
  commit;`;
  const cleanup=spawnSync('docker',['exec','-i','supabase_db_sunday-league-mates','psql','-X','-q','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']});
  if(cleanup.status!==0){console.log('FAIL cleanup own scoped fixture rows');process.exitCode=1;}
  else for(const id of ids){await api.request('/rest/v1/slm_account_audit?or=(actor_id.eq.'+id+',target_id.eq.'+id+')','DELETE');const r=await api.request('/auth/v1/admin/users/'+id,'DELETE');if(!r.ok){console.log('FAIL cleanup own Auth fixture');process.exitCode=1;}}
  const remaining=await api.request('/rest/v1/slm_groups?id=in.('+groups.join(',')+')&select=id');
  if(groups.length&&(!remaining.ok||remaining.data.length)){console.log('FAIL cleanup verification');process.exitCode=1;}else console.log('Cleanup own fictional accounts/groups complete; existing resources unchanged');
 }

}

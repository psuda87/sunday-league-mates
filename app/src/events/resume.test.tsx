import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {SessionManager} from '../auth/sessionManager';
import type {Session} from '../auth/api';
import {AccountError} from '../auth/api';
import {usePremiumEvents} from './usePremiumEvents';
afterEach(cleanup);
it('retains match/scope/query while hidden and replaces private data only after successful revalidation',async()=>{
 let denied=false,revision=1;
 const session:Session={user_id:'owner',access_token:'fixture',refresh_token:'fixture',expires_in:3600,role:'member',must_change_password:false};
 const event={id:'match',group_id:'group',group_name:'Grupa',created_by:'owner',name:'Mecz',visibility:'private',starts_at:'2099-01-01T17:00:00Z',location:'Boisko',status:'scheduled',access:'full',own_participation:false,duration_minutes:90,capacity:15,cost_cents:0,minimum_players:10,registered_count:0,reserve_count:0,registration_open:true,decision_required:false,can_manage:true,can_edit:true,version:1};
 const manager=new SessionManager({read:async()=>'fixture',write:async()=>{},clear:async()=>{}},async<T,>(action:string)=>{
  const result=action==='login'||action==='refresh'?{...session}:action==='groups_list'?{groups:[{id:'group',name:'Grupa',description:'',admin_id:'owner',organizer:true,member_count:2,pending_count:0}]}:action==='matches_list'?{events:[event],server_now:'2030-01-01T00:00:00Z',public_discovery_version:1,match_minimum_version:1,has_more:false,next_offset:null,offset:0,limit:100}:action==='matches_detail'?{event:{...event,version:revision},participants:[],server_now:'2030-01-01T00:00:00Z',can_register_paid:true}:null;
  if(action==='matches_detail'&&denied)throw new AccountError('Denied','not_found');return result as T;
 });
 await manager.signIn('fixture','fixture');const {result}=renderHook(()=>usePremiumEvents(manager,'owner'));
 await waitFor(()=>expect(result.current.events).toHaveLength(1));await act(()=>result.current.open('match'));
 act(()=>manager.suspend());expect(result.current.detail?.event.id).toBe('match');expect(result.current.revalidating).toBe(true);
 revision=2;await act(()=>manager.refresh());await waitFor(()=>expect(result.current.revalidating).toBe(false));
 expect(result.current.detail?.event.id).toBe('match');expect(result.current.detail?.event.version).toBe(2);
 denied=true;act(()=>manager.suspend());await act(()=>manager.refresh());
 await waitFor(()=>expect(result.current.detail).toBeNull());expect(result.current.revalidating).toBe(true);
 await act(()=>manager.logout());expect(result.current.events).toEqual([]);
});

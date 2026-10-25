import { act,cleanup,render,renderHook,waitFor,screen } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { useGroups,groupWorld } from './useGroups';
import type { SessionManager } from '../auth/sessionManager';
import type { GroupSummary,GroupDetail } from './model';
import GroupScreens from '../demo/GroupScreens';
import type { GroupBinding } from './model';
afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});
const group:GroupSummary={id:'group-real',name:'Real API group',description:'',admin_id:'owner',organizer:true,member_count:2,pending_count:1};
const detail:GroupDetail={group,members:[{user_id:'owner',nickname:'Owner',full_name:null,contact_phone:null,jersey_number:0,organizer:true,joined_at:'2026-10-01',share_full_name:false}],requests:[]};
function mock(call:(action:string,body?:Record<string,unknown>)=>Promise<unknown>){return {call:vi.fn(call),getSnapshot:()=>({phase:'ready',session:{user_id:'owner'}})} as unknown as SessionManager;}
it('uses server counts and UUIDs without importing any demo world or inventing memberships',()=>{
 const world=groupWorld('owner',[group],[],null);
 expect(world).not.toHaveProperty('games');expect(world.groupState.groups.map(g=>g.id)).toEqual(['group-real']);
 expect(world.groupState.members).toHaveLength(1);expect(world.players).toEqual([]);
});
it('does not render an invented member profile while a real detail request is loading',()=>{
 window.history.replaceState(null,'','/#group/group-real');
 const binding:GroupBinding={loading:true,busy:false,error:'',searching:false,finding:false,counts:{'group-real':2},pending:{},found:[],candidates:[],requestPhones:{},shareFullName:false,refresh:async()=>{},open:async()=>{},search:()=>{},findPlayers:()=>{},create:async()=>null,act:()=>{},consent:()=>{}};
 render(<GroupScreens world={groupWorld('owner',[group],[],null)} live={binding} dispatch={vi.fn()} onPlayer={vi.fn()}/>);
 expect(screen.getByText('Wczytywanie grup…')).toBeTruthy();expect(screen.queryByText('Osoba demonstracyjna')).toBeNull();
});
it('clears private group state on failed refresh and permits retry without a demo fallback',async()=>{
 let broken=false;
 const manager=mock(async action=>{if(broken)throw Error('Connection unavailable');return action==='groups_list'?{groups:[group]}:{requests:[]};});
 const {result}=renderHook(()=>useGroups(manager,'owner'));
 await waitFor(()=>expect(result.current.binding.loading).toBe(false));expect(result.current.binding.counts['group-real']).toBe(2);
 broken=true;await act(()=>result.current.binding.refresh());
 expect(result.current.world.groupState.groups).toEqual([]);expect(result.current.binding.error).toBe('Connection unavailable');
 broken=false;await act(()=>result.current.binding.refresh());expect(result.current.world.groupState.groups[0].id).toBe('group-real');
});
it('refuses an older backend contract instead of inventing zero counts or demo groups',async()=>{
 const manager=mock(async action=>action==='groups_list'?{groups:[{id:'group-real',name:'Old backend',description:'',admin_id:'owner',organizer:true}]}:{requests:[]});
 const {result}=renderHook(()=>useGroups(manager,'owner'));await waitFor(()=>expect(result.current.binding.loading).toBe(false));
 expect(result.current.binding.error).toContain('Backend');expect(result.current.world.groupState.groups).toEqual([]);
});
it('does not return a late create result to a view that has logged out or unmounted',async()=>{
 let finish:(value:unknown)=>void=()=>{};
 const manager=mock(async action=>action==='groups_create'?new Promise(resolve=>{finish=resolve;}):action==='groups_list'?{groups:[]}:{requests:[]});
 const {result,unmount}=renderHook(()=>useGroups(manager,'owner'));await waitFor(()=>expect(result.current.binding.loading).toBe(false));
 let pending:Promise<string|null>=Promise.resolve(null);
 act(()=>{pending=result.current.binding.create('Group','',crypto.randomUUID());});unmount();
 finish({group_id:'new-real-id'});expect(await pending).toBeNull();
});
it('ignores late search results and updates membership only from server read-back',async()=>{
 let finishOld:(value:unknown)=>void=()=>{};
 const manager=mock(async(action,body)=>{
  if(action==='groups_list')return {groups:[group]};if(action==='groups_inbox')return {requests:[]};if(action==='groups_detail')return detail;
  if(action==='groups_search'&&body?.query==='old')return new Promise(resolve=>{finishOld=resolve;});
  if(action==='groups_search')return {groups:[{...group,id:'new-result'}]};
  return {ok:true};
 });
 const {result}=renderHook(()=>useGroups(manager,'owner'));await waitFor(()=>expect(result.current.binding.loading).toBe(false));
 await act(()=>result.current.binding.open(group.id));
 act(()=>{result.current.binding.search('old');result.current.binding.search('new');});
 await waitFor(()=>expect(result.current.binding.found[0]?.id).toBe('new-result'));
 await act(async()=>{finishOld({groups:[{...group,id:'stale-result'}]});});expect(result.current.binding.found[0].id).toBe('new-result');
 act(()=>result.current.binding.consent(true));
 await waitFor(()=>expect(result.current.binding.busy).toBe(false));
 expect(manager.call).toHaveBeenCalledWith('groups_consent',expect.objectContaining({group_id:'group-real',share_full_name:true,request_id:expect.any(String)}));
 expect(result.current.binding.shareFullName).toBe(false); // Server read-back, never optimistic consent.
});

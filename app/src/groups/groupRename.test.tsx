import {act,cleanup,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useGroups} from './useGroups';
import type {SessionManager} from '../auth/sessionManager';
import type {GroupDetail,GroupSummary} from './model';
import {initialWorld,reduceWorld} from '../demo/data';
import type {World} from '../demo/data';
import GroupScreens from '../demo/GroupScreens';
afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});

const group:GroupSummary={id:'11111111-1111-4111-8111-111111111111',name:'Stara nazwa',description:'',admin_id:'owner',organizer:true,member_count:1,pending_count:0};
const detail:GroupDetail={group,members:[{user_id:'owner',nickname:'Owner',full_name:null,contact_phone:null,jersey_number:0,organizer:true,joined_at:'2026-10-01',share_full_name:false}],requests:[]};

it('sends the trimmed new name to the server and refreshes the group',async()=>{
 let name='Stara nazwa';const state={phase:'ready',session:{user_id:'owner'}};
 const call=vi.fn(async(action:string,body?:Record<string,unknown>)=>{
  if(action==='groups_rename'){name=String(body?.name);return {group_id:group.id,ok:true,name};}
  if(action==='groups_list')return {groups:[{...group,name}]};
  if(action==='groups_inbox')return {requests:[]};
  if(action==='groups_detail')return {...detail,group:{...group,name}};
  return {};
 });
 const manager={call,subscribe:()=>()=>{},getSnapshot:()=>state} as unknown as SessionManager;
 const {result}=renderHook(()=>useGroups(manager,'owner'));
 await waitFor(()=>expect(result.current.binding.loading).toBe(false));
 await act(()=>result.current.binding.open(group.id));
 act(()=>result.current.binding.act({type:'group_rename',groupId:group.id,name:'  Nowa nazwa  '}));
 await waitFor(()=>expect(result.current.world.groupState.groups[0].name).toBe('Nowa nazwa'));
 expect(call).toHaveBeenCalledWith('groups_rename',expect.objectContaining({group_id:group.id,name:'Nowa nazwa'}));
});

const user=(w:World,id:string)=>reduceWorld(w,{type:'user',id});
it('lets only the admin rename a demo group and rejects invalid names',()=>{
 const w=initialWorld();const g=w.groupState.groups.find(x=>x.adminId===w.userId)!;
 const renamed=reduceWorld(w,{type:'group_rename',groupId:g.id,name:'  Orliki Wtorek '});
 expect(renamed.groupState.groups.find(x=>x.id===g.id)!.name).toBe('Orliki Wtorek');
 expect(reduceWorld(w,{type:'group_rename',groupId:g.id,name:'   '})).toBe(w);
 expect(reduceWorld(w,{type:'group_rename',groupId:g.id,name:'<b>x</b>'})).toBe(w);
 const other=w.groupState.members.find(m=>m.groupId===g.id&&m.playerId!==g.adminId)!.playerId;
 const asMember=user(w,other);
 expect(reduceWorld(asMember,{type:'group_rename',groupId:g.id,name:'Przejęta'})).toBe(asMember);
});

it('shows the rename form to the admin and dispatches the new name',()=>{
 const w=initialWorld();const g=w.groupState.groups.find(x=>x.adminId===w.userId)!;
 const dispatch=vi.fn();window.history.replaceState(null,'',`#group/${g.id}`);
 render(<GroupScreens world={w} dispatch={dispatch} onPlayer={()=>{}}/>);
 const manage=screen.queryByRole('button',{name:/Zarządzaj/});if(manage)fireEvent.click(manage);
 const input=screen.getByLabelText('Nazwa grupy',{selector:'input[id^="group-rename-"]'});
 expect(screen.getByRole('button',{name:'Zapisz nazwę'})).toBeDisabled();
 fireEvent.change(input,{target:{value:'Nowa ekipa'}});
 fireEvent.click(screen.getByRole('button',{name:'Zapisz nazwę'}));
 expect(dispatch).toHaveBeenCalledWith({type:'group_rename',groupId:g.id,name:'Nowa ekipa'});
});

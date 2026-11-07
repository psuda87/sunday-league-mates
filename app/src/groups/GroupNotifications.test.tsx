import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import GroupNotifications from './GroupNotifications';
import type {SessionManager} from '../auth/sessionManager';
afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});
const group=(id:string,admin_id:string,pending_count:number)=>({id,name:id,description:'',admin_id,pending_count,organizer:true,member_count:2});
it('counts only administered groups, navigates and refreshes after a decision',async()=>{
 const state={phase:'ready',session:{user_id:'owner'}};let pending=2;
 const call=vi.fn(async()=>({groups:[group('moja','owner',pending),group('inna','other',9)]}));
 const manager={call,subscribe:()=>()=>{},getSnapshot:()=>state} as unknown as SessionManager;
 const onGroups=vi.fn(()=>{window.history.replaceState(null,'','#groups');});
 render(<GroupNotifications manager={manager} userId="owner" onGroups={onGroups} refreshKey={false}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Oczekujące zgłoszenia do grup: 2'})).toBeTruthy());
 fireEvent.click(screen.getByRole('button',{name:'Oczekujące zgłoszenia do grup: 2'}));
 expect(screen.queryByText('inna')).toBeNull();fireEvent.click(screen.getByRole('button',{name:/moja/}));
 expect(onGroups).toHaveBeenCalledOnce();expect(window.location.hash).toBe('#group/moja');
 pending=0;act(()=>{window.dispatchEvent(new Event('slm-groups-changed'));});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Oczekujące zgłoszenia do grup: 0'})).toBeTruthy());
});
it('ignores late results after unmount',async()=>{
 let finish:(value:unknown)=>void=()=>{};const state={phase:'ready',session:{user_id:'owner'}};
 const manager={call:()=>new Promise(resolve=>{finish=resolve;}),subscribe:()=>()=>{},getSnapshot:()=>state} as unknown as SessionManager;
 const {unmount}=render(<GroupNotifications manager={manager} userId="owner" onGroups={()=>{}} refreshKey={false}/>);
 unmount();await act(async()=>{finish({groups:[group('late','owner',5)]});});expect(screen.queryByRole('button')).toBeNull();
});

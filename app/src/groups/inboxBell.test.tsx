import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import GroupNotifications from './GroupNotifications';
import type {SessionManager} from '../auth/sessionManager';
afterEach(cleanup);

const item=(id:string,title:string,read_at:string|null)=>({id,title,body:'Treść '+title,created_at:'2026-11-18T19:50:00Z',read_at});
function setup(){
 const state={phase:'ready',session:{user_id:'me'}};
 const call=vi.fn(async(action:string)=>action==='notifications_list'?{notifications:[item('n1','Test powiadomień',null),item('n2','Stare',  '2026-11-18T19:55:00Z')],unread:1}
  :action==='group_finance_wallet'?{accounts:[]}:action==='groups_list'?{groups:[]}:{ok:true});
 return {call,manager:{call,subscribe:()=>()=>{},getSnapshot:()=>state} as unknown as SessionManager};
}

it('pokazuje nieprzeczytane powiadomienia z bazy w dzwonku i pozwala je oznaczyć',async()=>{
 const {manager,call}=setup();
 render(<GroupNotifications manager={manager} userId="me" onGroups={()=>{}} refreshKey={false}/>);
 const bell=await screen.findByRole('button',{name:/Nowe powiadomienia: 1/});
 expect(within(bell).getByText('1')).toBeTruthy();
 fireEvent.click(bell);
 const panel=screen.getByRole('region',{name:'Powiadomienia'});
 expect(within(panel).getByText('Test powiadomień')).toBeTruthy();
 expect(within(panel).getByText('Treść Test powiadomień')).toBeTruthy();
 fireEvent.click(within(panel).getByRole('button',{name:'Oznacz jako przeczytane'}));
 await waitFor(()=>expect(call).toHaveBeenCalledWith('notifications_read_all'));
});

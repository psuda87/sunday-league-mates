import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import GroupNotifications from './GroupNotifications';
import type {SessionManager} from '../auth/sessionManager';
afterEach(cleanup);

const item=(id:string,title:string,read_at:string|null,days=0)=>({id,title,body:'Treść '+title,created_at:new Date(Date.now()-days*864e5-6e4).toISOString(),read_at});
function setup(){
 const state={phase:'ready',session:{user_id:'me'}};
 const call=vi.fn(async(action:string)=>action==='notifications_list'?{notifications:[item('n1','Test powiadomień',null),item('n2','Wczorajsze','2026-11-18T19:55:00Z',1),item('n3','Archiwalne',null,9)],unread:2}
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
 expect(within(panel).queryByText('Treść Test powiadomień')).toBeNull();
 expect(within(panel).getByText('Wczorajsze')).toBeTruthy();expect(within(panel).queryByText('Archiwalne')).toBeNull();
 fireEvent.click(within(panel).getByRole('button',{name:'Oznacz jako przeczytane'}));
 await waitFor(()=>expect(call).toHaveBeenCalledWith('notifications_read_all'));
});

it('kliknięcie nagłówka otwiera popup z treścią, a Archiwizuj usuwa wpis z listy',async()=>{
 const {manager,call}=setup();
 render(<GroupNotifications manager={manager} userId="me" onGroups={()=>{}} refreshKey={false}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Nowe powiadomienia: 1/}));
 const panel=screen.getByRole('region',{name:'Powiadomienia'});
 fireEvent.click(within(panel).getByRole('button',{name:/Test powiadomień/}));
 const dialog=screen.getByRole('dialog',{name:'Test powiadomień'});
 expect(within(dialog).getByText('Treść Test powiadomień')).toBeTruthy();
 await waitFor(()=>expect(call).toHaveBeenCalledWith('notifications_read',{notification_id:'n1'}));
 // Po archiwizacji serwer nie zwraca już wpisu (ponowne wczytanie listy po zdarzeniu).
 call.mockImplementation(async(action:string)=>action==='notifications_list'?{notifications:[],unread:0}:action==='group_finance_wallet'?{accounts:[]}:action==='groups_list'?{groups:[]}:{ok:true});
 fireEvent.click(within(dialog).getByRole('button',{name:'Archiwizuj'}));
 await waitFor(()=>expect(call).toHaveBeenCalledWith('notifications_archive',{notification_id:'n1'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(within(panel).queryByRole('button',{name:/Test powiadomień/})).toBeNull();
});

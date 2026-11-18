import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import NotificationArchive from './NotificationArchive';
import type {SessionManager} from '../auth/sessionManager';
afterEach(cleanup);
const row=(id:string,title:string,days:number)=>({id,title,body:'b',created_at:new Date(Date.now()-days*864e5).toISOString(),read_at:null});
it('pokazuje tylko powiadomienia starsze niż 7 dni',async()=>{
 const call=vi.fn(async()=>({notifications:[row('1','Nowe',1),row('2','Stare',10)]}));
 const manager={call,getSnapshot:()=>({phase:'ready',session:{user_id:'me'}})} as unknown as SessionManager;
 render(<NotificationArchive manager={manager} userId="me"/>);
 fireEvent.click(screen.getByRole('button',{name:'Archiwum powiadomień'}));
 await waitFor(()=>expect(screen.getByText('Stare')).toBeTruthy());
 expect(screen.queryByText('Nowe')).toBeNull();
});

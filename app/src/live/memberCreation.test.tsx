import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import Matches from './Matches';
import type {SessionManager} from '../auth/sessionManager';
afterEach(cleanup);
it.each([true,false])('LIVE respects server member-creation capability %s without finance elevation',async enabled=>{
 const manager={call:vi.fn(async(action:string)=>action==='matches_list'?{events:[],server_now:'2030-01-01T00:00:00Z',member_creation_enabled:enabled}:{groups:[{id:'g',name:'Member group',admin_id:'other',organizer:false}]})} as unknown as SessionManager;
 render(<Matches manager={manager} userId="member" onLegacy={()=>{}}/>);
 await screen.findByText('Brak meczów w tym widoku.');
 expect(manager.call).toHaveBeenCalledWith('matches_list',{offset:0,scope:'all',period:'upcoming'});
 fireEvent.click(screen.getByRole('button',{name:'Historia'}));
 await screen.findByText('Brak meczów w tym widoku.');
 expect(manager.call).toHaveBeenCalledWith('matches_list',{offset:0,scope:'all',period:'history'});
 if(enabled){fireEvent.click(screen.getByText('Utwórz mecz'));expect(screen.getByLabelText('Grupa')).toHaveValue('g');}
 else expect(screen.queryByText('Utwórz mecz')).toBeNull();
 expect(screen.queryByText('Zarządzanie meczem')).toBeNull();
});

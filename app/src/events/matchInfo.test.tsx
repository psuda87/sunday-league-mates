import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import PremiumEvents from './PremiumEvents';
import type {PremiumEventsController} from './usePremiumEvents';
afterEach(cleanup);

const event={id:'event',group_id:'group',group_name:'Grupa',created_by:'owner',name:'Mecz',visibility:'private',starts_at:'2099-01-01T18:00:00Z',location:'Orlik Kępa',address:'ul. Sportowa 5, Warszawa',status:'scheduled',access:'full',own_participation:false,duration_minutes:90,capacity:15,cost_cents:27000,minimum_players:10,registered_count:0,reserve_count:0,registration_open:true,decision_required:false,can_manage:false,can_edit:false,version:1};
const controller=(e:Record<string,unknown>)=>({detail:{event:e,participants:[],can_register_paid:true,server_now:'2030-01-01T00:00:00Z'},serverNow:'2030-01-01T00:00:00Z',groups:[{id:'group',name:'Grupa'}],organizers:[],events:[],loading:false,busy:false,error:'',notice:'',back:vi.fn(),refresh:vi.fn(),edit:vi.fn()}) as unknown as PremiumEventsController;

it('moves match information from the tabs to the "i" button on the match card',()=>{
 render(<PremiumEvents data={controller(event)} userId="owner" onGroups={vi.fn()}/>);
 expect(screen.queryByRole('tab',{name:/Informacje/})).toBeNull();
 expect(screen.getAllByRole('tab').map(tab=>tab.textContent)).toEqual(['Uczestnicy','Składy','Rozliczenie']);
 expect(screen.getByRole('tab',{name:/Uczestnicy/})).toHaveAttribute('aria-selected','true');
 fireEvent.click(screen.getByRole('button',{name:'Informacje o meczu'}));
 const dialog=screen.getByRole('dialog',{name:'Informacje o meczu'});
 expect(within(dialog).getByText(/Koszt meczu/)).toBeInTheDocument();
 expect(within(dialog).getByText(/Rezygnacja do 17:00/)).toBeInTheDocument();
 fireEvent.keyDown(dialog,{key:'Escape'});
 expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Informacje o meczu'}));
 fireEvent.click(screen.getByRole('button',{name:'Zamknij informacje o meczu'}));
 expect(screen.queryByRole('dialog')).toBeNull();
});

it('keeps the information tab where the match card is not shown',()=>{
 render(<PremiumEvents data={controller({...event,access:'own'})} userId="owner" onGroups={vi.fn()}/>);
 expect(screen.queryByRole('button',{name:'Informacje o meczu'})).toBeNull();
 expect(screen.getByRole('tab',{name:/Informacje/})).toBeInTheDocument();
});

it('shows the venue name but searches Google Maps by the address',()=>{
 render(<PremiumEvents data={controller(event)} userId="owner" onGroups={vi.fn()}/>);
 const link=screen.getByRole('link',{name:/Google Maps/});
 expect(link).toHaveTextContent('Orlik Kępa');
 expect(link).toHaveAttribute('href',`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('ul. Sportowa 5, Warszawa')}`);
});

it('falls back to the venue name when the match has no address',()=>{
 render(<PremiumEvents data={controller({...event,address:'  '})} userId="owner" onGroups={vi.fn()}/>);
 expect(screen.getByRole('link',{name:/Google Maps/})).toHaveAttribute('href',`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Orlik Kępa')}`);
});

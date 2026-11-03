import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import PremiumEvents from './PremiumEvents';
import type {PremiumEventsController} from './usePremiumEvents';
vi.mock('../demo/EventForm',()=>({default:({onSave}:{onSave:(input:unknown)=>void})=><button onClick={()=>onSave({})}>Wyślij szkic</button>}));
afterEach(cleanup);
it('retains the edit draft but refuses to overwrite a version changed during resume',()=>{
 const event={id:'event',group_id:'group',group_name:'Grupa',created_by:'owner',name:'Mecz',visibility:'private',starts_at:'2099-01-01T18:00:00Z',location:'Boisko',status:'scheduled',access:'full',own_participation:false,duration_minutes:90,capacity:15,cost_cents:0,minimum_players:10,registered_count:0,reserve_count:0,registration_open:true,decision_required:false,can_manage:true,can_edit:true,version:1};
 const data={detail:{event,participants:[],can_register_paid:true,server_now:'2030-01-01T00:00:00Z'},serverNow:'2030-01-01T00:00:00Z',groups:[{id:'group',name:'Grupa'}],organizers:[],events:[],loading:false,busy:false,error:'',notice:'',back:vi.fn(),refresh:vi.fn(),edit:vi.fn()} as unknown as PremiumEventsController;
 const {rerender}=render(<PremiumEvents data={data} userId="owner" onGroups={vi.fn()}/>);
 fireEvent.click(screen.getByRole('tab',{name:/Informacje/}));fireEvent.click(screen.getByText('Edytuj mecz'));
 rerender(<PremiumEvents data={{...data,detail:{...data.detail!,event:{...data.detail!.event,version:2}}}} userId="owner" onGroups={vi.fn()}/>);
 fireEvent.click(screen.getByText('Wyślij szkic'));expect(data.edit).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('Szkic zachowano');
 rerender(<PremiumEvents data={{...data,detail:{...data.detail!,event:{...data.detail!.event,can_edit:false}}}} userId="owner" onGroups={vi.fn()}/>);
 expect(screen.queryByText('Wyślij szkic')).toBeNull();
});

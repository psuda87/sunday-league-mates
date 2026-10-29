import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import PremiumEvents from './PremiumEvents';
import type { PremiumEventsController } from './usePremiumEvents';
import DemoBottomNav from '../demo/DemoBottomNav';
afterEach(cleanup);
it('never renders foreign private DTOs even if an older server returns their title/counts',()=>{
 const base={id:'a',group_id:'g',group_name:'Realna grupa',created_by:'u',name:'Prawdziwy mecz',visibility:'private',starts_at:'2099-01-01T18:00:00Z',location:'Miejsce z API',status:'scheduled',own_participation:false};
 const full={...base,access:'full',registered_count:3,reserve_count:0,capacity:10,duration_minutes:90,cost_cents:10000,registration_open:true,decision_required:false};
 const data={events:[full,{...base,id:'b',group_id:'foreign',name:'Ukryty mecz',access:'none',registered_count:999},{...base,id:'c',access:'own'}],groups:[{id:'g'}],organizers:[],detail:null,loading:false,busy:false,error:'',notice:'',activeGroup:'',serverNow:'2030-01-01T00:00:00Z',offset:0,open:vi.fn(),refresh:vi.fn(),selectGroup:vi.fn()} as unknown as PremiumEventsController;
 const {container}=render(<PremiumEvents data={data} userId="u" onGroups={vi.fn()}/>);
 expect(container.querySelectorAll('.slm-match-compact')).toHaveLength(2);expect(container.querySelectorAll('.slm-stadium')).toHaveLength(2);
 expect(container.querySelector('[data-event="b"]')).toBeNull();expect(screen.queryByText('Ukryty mecz')).toBeNull();
 expect(container.querySelector('[data-event="a"]')).toHaveTextContent('3/10');
});
it('shows original plus only to authorized organizers and calls existing create controller',()=>{
 const create=vi.fn();const {rerender}=render(<DemoBottomNav active="events" onSelect={vi.fn()} canCreate={false} onCreate={create}/>);
 expect(screen.queryByRole('button',{name:'Utwórz mecz'})).toBeNull();rerender(<DemoBottomNav active="events" onSelect={vi.fn()} canCreate onCreate={create}/>);
 fireEvent.click(screen.getByRole('button',{name:'Utwórz mecz'}));expect(create).toHaveBeenCalledOnce();
});

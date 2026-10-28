import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import PremiumTeams from './PremiumTeams';
import PremiumEvents from './PremiumEvents';
import type { PremiumEventsController } from './usePremiumEvents';
import type { MatchEntry } from './premiumContracts';
import DemoBottomNav from '../demo/DemoBottomNav';
afterEach(cleanup);
const entry=(id:string,status:MatchEntry['status']='registered'):MatchEntry=>({id,member_id:id,responsible_user_id:id,display_name:'Zawodnik '+id,responsible_name:'Zawodnik '+id,status,absent:false,contact_phone:null,joined_at:'2030-01-01T00:00:00Z',guest_name:null,guest_phone:null});
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
it('manual live preview has no invented split, excludes reserve/withdrawn and swaps only RAM',()=>{
 const people=[entry('1'),entry('2'),entry('3','reserve'),entry('4','withdrawn')];
 const {rerender}=render(<PremiumTeams eventId="real" participants={people} cancelled={false}/>);
 expect(screen.getByText(/bez zapisu na serwerze/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Uczestnik: Zawodnik 1'})).toBeNull();
 expect(screen.queryByLabelText('Drużyna: Zawodnik 3')).toBeNull();expect(screen.queryByLabelText('Drużyna: Zawodnik 4')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Utwórz lokalny podgląd'}));
 fireEvent.click(screen.getByRole('button',{name:'Zamień zawodników'}));fireEvent.click(screen.getByRole('button',{name:'Wybierz do zamiany: Zawodnik 1'}));fireEvent.click(screen.getByRole('button',{name:'Wybierz do zamiany: Zawodnik 2'}));
 expect(within(screen.getByRole('region',{name:'Drużyna A, 1 osób'})).getByText('Zawodnik 2')).toBeTruthy();
 rerender(<PremiumTeams eventId="real" participants={[entry('1','withdrawn'),entry('2')]} cancelled={false}/>);
 expect(screen.queryByRole('button',{name:'Wybierz do zamiany: Zawodnik 1'})).toBeNull();
});
it('unmounting the match discards the preview and cancelled games cannot assign players',()=>{
 const people=[entry('1')],{unmount}=render(<PremiumTeams eventId="real" participants={people} cancelled={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'Dodaj Zawodnik 1 do drużyny A'}));unmount();
 const next=render(<PremiumTeams eventId="real" participants={people} cancelled={false}/>);expect(screen.queryByRole('button',{name:'Uczestnik: Zawodnik 1'})).toBeNull();next.rerender(<PremiumTeams eventId="real" participants={people} cancelled/>);expect(screen.getByText('Mecz anulowany')).toBeTruthy();expect(screen.queryByLabelText('Drużyna: Zawodnik 1')).toBeNull();
});

it('restores demo point-and-swap behavior for odd rosters and guests, with undo and no false author',()=>{
 const people=[entry('1'),entry('2'),{...entry('guest'),member_id:null},entry('reserve','reserve')];
 const {rerender}=render(<PremiumTeams eventId="odd" participants={people} cancelled={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'Utwórz lokalny podgląd'}));
 expect(screen.getByRole('region',{name:'Drużyna A, 2 osób'})).toBeTruthy();expect(screen.getByRole('region',{name:'Drużyna B, 1 osób'})).toBeTruthy();
 expect(within(screen.getByRole('button',{name:'Uczestnik: Zawodnik guest'})).getByText('G')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Zamień zawodników'}));fireEvent.click(screen.getByRole('button',{name:'Wybierz do zamiany: Zawodnik guest'}));fireEvent.click(screen.getByRole('button',{name:'Wybierz do zamiany: Zawodnik 2'}));
 expect(within(screen.getByRole('region',{name:'Drużyna B, 1 osób'})).getByText('Zawodnik guest')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Zakończ zamiany'}));
 rerender(<PremiumTeams eventId="odd" participants={[...people,entry('new')]} cancelled={false}/>);expect(screen.getByText('Poza podziałem: 1')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Cofnij zmiany'}));expect(screen.queryByRole('button',{name:'Uczestnik: Zawodnik guest'})).toBeNull();
 expect(screen.getByText('Ostatnia zmiana: brak zapisanego składu na serwerze.')).toBeTruthy();expect(screen.getByRole('button',{name:'Zapis na serwerze niedostępny'})).toBeDisabled();
});
it('nonmembers cannot edit or generate a local lineup',()=>{
 render(<PremiumTeams eventId="public" participants={[entry('1'),entry('2')]} cancelled={false} canEdit={false}/>);
 expect(screen.getByRole('button',{name:'Utwórz lokalny podgląd'})).toBeDisabled();expect(screen.getByRole('button',{name:'Dodaj Zawodnik 1 do drużyny A'})).toBeDisabled();
});

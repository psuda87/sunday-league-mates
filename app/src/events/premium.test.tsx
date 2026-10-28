import { StrictMode } from 'react';
import { afterEach,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,renderHook,screen,waitFor } from '@testing-library/react';
import type { SessionManager } from '../auth/sessionManager';
import { AccountError } from '../auth/api';
import { eventSummary,heroMatch,matchDetail } from './premiumContracts';
import { premiumDefaults } from './premiumForm';
import { usePremiumEvents } from './usePremiumEvents';
import EventForm from '../demo/EventForm';
import DemoApp from '../demo/App';
import PremiumEvents from './PremiumEvents';
import type { PremiumEventsController } from './usePremiumEvents';

afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});
const now='2030-01-01T12:00:00Z';
const group={id:'group-a',name:'Real group A',description:'',admin_id:'owner',organizer:true,member_count:2,pending_count:0};
const event={id:'event-a',group_id:group.id,group_name:group.name,created_by:'owner',name:'Shared match A',visibility:'private',starts_at:'2030-01-03T17:00:00Z',location:'Real pitch',status:'scheduled',access:'full',own_participation:false,duration_minutes:90,capacity:10,cost_cents:27000,minimum_players:10,registered_count:0,reserve_count:0,registration_open:true,decision_required:false,can_manage:true,can_edit:true,version:1};
const detail={event,participants:[],server_now:now,can_register_paid:true};
function manager(write?:(action:string,body?:Record<string,unknown>)=>Promise<unknown>){
 const call=vi.fn(async(action:string,body?:Record<string,unknown>)=>{
  if(action==='groups_list')return {groups:[group]};
  if(action==='matches_list')return {events:[event],server_now:now};
  if(action==='matches_detail')return {...detail,event:{...event,id:body?.event_id}};
  return write?.(action,body);
 });
 return {call,subscribe:vi.fn(()=>()=>{}),getSnapshot:()=>({phase:'ready',session:{user_id:'owner'}})} as unknown as SessionManager;
}
it('requires stable requested event identity and never invents counts for private outsider',()=>{
 expect(()=>matchDetail(detail,'different-id')).toThrow();
 const locked={...event,access:'none',registered_count:undefined,reserve_count:undefined};
 expect(eventSummary(locked).access).toBe('none');expect(()=>heroMatch(eventSummary(locked))).toThrow();
 expect(()=>matchDetail({...detail,event:locked,participants:[{id:'secret'}]},event.id)).toThrow();
 expect(()=>matchDetail({...detail,event:{...event,registered_count:1}},event.id)).toThrow();
});
it('suggests Thursday/Sunday18:00 without inventing a venue or capacity',()=>{
 const d=premiumDefaults(now);expect(d).toMatchObject({location:'',address:'',capacity:0,durationMinutes:90,minimum:10,costCents:27000});
 expect(d.startsAt).toBe('2030-01-03T17:00:00.000Z');
 expect(premiumDefaults('2030-01-03T18:00:00Z').startsAt).toBe('2030-01-06T17:00:00.000Z');
});
it('loads the actual API in StrictMode and coalesces repeated manual refreshes',async()=>{
 const m=manager(),{result}=renderHook(()=>usePremiumEvents(m,'owner'),{wrapper:StrictMode});
 await waitFor(()=>expect(result.current.events).toHaveLength(1));
 vi.mocked(m.call).mockClear();await act(async()=>{await Promise.all([result.current.refresh(),result.current.refresh()]);});
 expect(vi.mocked(m.call).mock.calls.filter(c=>c[0]==='matches_list')).toHaveLength(1);
 expect(result.current.groups[0].id).toBe(group.id);
});
it('clears real data on read failure and shows no technical error or demo fallback',async()=>{
 const m=manager(),{result}=renderHook(()=>usePremiumEvents(m,'owner'));
 await waitFor(()=>expect(result.current.events).toHaveLength(1));
 vi.mocked(m.call).mockRejectedValue(new Error('PostgreSQL private-schema secret diagnostic'));
 await act(()=>result.current.refresh());expect(result.current.events).toEqual([]);expect(result.current.groups).toEqual([]);expect(result.current.error).not.toMatch(/PostgreSQL|secret/);
});
it('clears cached private data during an Auth recheck and refetches on gallery continuation',async()=>{
 const m=manager();let changed!:()=>void;vi.mocked(m.subscribe).mockImplementation(listener=>{changed=listener;return()=>{};});
 const original=m.getSnapshot;const snapshot=vi.spyOn(m,'getSnapshot');
 const {result}=renderHook(()=>usePremiumEvents(m,'owner'));await waitFor(()=>expect(result.current.events).toHaveLength(1));await act(()=>result.current.open(event.id));
 act(()=>{snapshot.mockReturnValue({phase:'checking',session:null,message:''});changed();});
 expect(result.current.events).toEqual([]);expect(result.current.detail).toBeNull();
 act(()=>{snapshot.mockImplementation(original);changed();});await waitFor(()=>expect(result.current.events).toHaveLength(1));expect(result.current.detail).toBeNull();
});
it('drops a late private detail after Back or changing the active group',async()=>{
 const m=manager(),{result}=renderHook(()=>usePremiumEvents(m,'owner'));
 await waitFor(()=>expect(result.current.loading).toBe(false));
 let finish!:(value:unknown)=>void;
 vi.mocked(m.call).mockImplementation(async<T,>()=>await new Promise<unknown>(resolve=>{finish=resolve;}) as T);
 let pending!:Promise<boolean>;
 act(()=>{pending=result.current.open(event.id);});act(()=>result.current.selectGroup(''));
 await act(async()=>{finish(detail);await pending;});expect(result.current.detail).toBeNull();
});
it('blocks parallel clicks and preserves the idempotency key only across a failed write',async()=>{
 let fail=true;const write=vi.fn(async(action:string,body?:Record<string,unknown>)=>{expect(action).toBe('matches_join');expect(body).toHaveProperty('request_id');if(fail)throw new AccountError('transport','network_error');return {};});
 const m=manager(write),{result}=renderHook(()=>usePremiumEvents(m,'owner'));
 await waitFor(()=>expect(result.current.loading).toBe(false));await act(()=>result.current.open(event.id));
 await act(async()=>{await Promise.all([result.current.act('join'),result.current.act('join')]);});expect(write).toHaveBeenCalledTimes(1);
 fail=false;await act(()=>result.current.act('join'));expect(write).toHaveBeenCalledTimes(2);
 expect(write.mock.calls[0][1]).toEqual(write.mock.calls[1][1]);
 await act(()=>result.current.act('join'));expect(write.mock.calls[2][1]).not.toEqual(write.mock.calls[1][1]);
});
it('does not expose demo tools, fixtures or demo form through legacy hashes in real mode',()=>{
 window.history.replaceState(null,'','/#match-create');
 const enter=vi.fn();render(<DemoApp eventsView={()=> <p>Actual API empty state</p>} groupsView={<p>Actual groups</p>} liveEvents={{canCreate:false,onCreate:vi.fn(),onEnter:enter}}/>);
 expect(screen.getByText('Actual API empty state')).toBeTruthy();expect(screen.queryByText('Narzędzia demo')).toBeNull();expect(screen.queryByText(/Alex Nowak|Harcerskiej|Przykładowy mecz/)).toBeNull();expect(screen.queryByRole('form',{name:'Nowy mecz'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Mecze'}));expect(enter).toHaveBeenCalledTimes(1);
});
it('reuses the original Premium form, accepts another weekday and computes editable costs',async()=>{
 const save=vi.fn(),defaults=premiumDefaults(now,group.id);
 render(<EventForm live={{groups:[group],initial:defaults,busy:false}} onBack={vi.fn()} onSave={save}/>);
 expect(screen.getByLabelText('Miejsce / nazwa boiska')).toHaveValue('');expect(screen.getByLabelText('Limit zawodników')).toHaveValue(null);
 fireEvent.change(screen.getByLabelText('Data'),{target:{value:'07.01.2030'}});
 fireEvent.change(screen.getByLabelText('Miejsce / nazwa boiska'),{target:{value:'Local test pitch'}});
 fireEvent.change(screen.getByLabelText('Limit zawodników'),{target:{value:'10'}});
 fireEvent.change(screen.getByLabelText('Stawka godzinowa · PLN'),{target:{value:'200'}});
 fireEvent.change(screen.getByLabelText('Czas trwania · min'),{target:{value:'120'}});
 expect(screen.getByLabelText('Całkowity koszt · PLN')).toHaveValue('400,00');
 fireEvent.click(screen.getByRole('button',{name:'Podgląd meczu'}));fireEvent.click(screen.getByRole('button',{name:'Utwórz mecz'}));
 await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));expect(save.mock.calls[0][0]).toMatchObject({startsAt:'2030-01-07T17:00:00.000Z',costCents:40000,groupId:group.id});
});
it('withdrawal stays enabled despite debt and real guest writes have no invented owner',async()=>{
 const p={id:'entry',member_id:'owner',responsible_user_id:'owner',status:'registered',absent:false,display_name:'Actual player',guest_name:null,guest_phone:null,responsible_name:'Actual player',contact_phone:null,joined_at:now};
 const actWrite=vi.fn().mockResolvedValue(true);
 const data={...detail,detail:{...detail,event:{...event,registered_count:1},participants:[p],can_register_paid:false},events:[],groups:[group],organizers:[group],activeGroup:'',offset:0,loading:false,busy:false,error:'',notice:'',creating:false,serverNow:now,act:actWrite,back:vi.fn(),refresh:vi.fn(),open:vi.fn(),beginCreate:vi.fn(),selectGroup:vi.fn()} as unknown as PremiumEventsController;
 const {rerender}=render(<PremiumEvents data={data} userId="owner" onGroups={vi.fn()}/>);
 expect(screen.getByText('WYCOFAJ ZAPIS')).not.toHaveAttribute('disabled');
 rerender(<PremiumEvents data={{...data,detail:{...data.detail!,can_register_paid:true}}} userId="owner" onGroups={vi.fn()}/>);
 fireEvent.click(screen.getByText('Dodaj gościa'));fireEvent.change(screen.getByLabelText('Imię lub pseudonim gościa'),{target:{value:'Guest One'}});
 fireEvent.submit(screen.getByLabelText('Imię lub pseudonim gościa').closest('form')!);
 await waitFor(()=>expect(actWrite).toHaveBeenCalledWith('guest',{guest_name:'Guest One',guest_phone:'',list:'registered'}));
 await waitFor(()=>expect(screen.getByLabelText('Imię lub pseudonim gościa')).toHaveValue(''));
});

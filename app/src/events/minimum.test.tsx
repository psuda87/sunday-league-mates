import { afterEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor,renderHook,act } from '@testing-library/react';
import EventForm from '../demo/EventForm';
import { eventInstant } from '../demo/eventDraft';
import { premiumDefaults,premiumEventInput } from './premiumForm';
import { usePremiumEvents } from './usePremiumEvents';
import { eventSummary } from './premiumContracts';
import type { SessionManager } from '../auth/sessionManager';
afterEach(cleanup);
const group={id:'group',name:'Grupa',description:'',admin_id:'owner',organizer:true,member_count:2,pending_count:0};
const event={id:'match',group_id:'group',group_name:'Grupa',created_by:'owner',name:'Mecz',visibility:'private',starts_at:'2099-01-01T17:00:00Z',location:'Boisko',address:'Adres',status:'scheduled',access:'full',own_participation:false,duration_minutes:90,capacity:15,cost_cents:0,minimum_players:13,match_minimum_version:1,registered_count:0,reserve_count:0,registration_open:true,decision_required:false,can_manage:true,can_edit:true,version:7};
it('shows editable default minimum10 independently from capacity',()=>{
 render(<EventForm live={{groups:[group],initial:premiumDefaults('2030-01-01T12:00:00Z','group'),busy:false}} onBack={vi.fn()} onSave={vi.fn()}/>);
 expect(screen.getByLabelText('Minimum zawodników')).toHaveValue(10);expect(screen.getByLabelText('Limit zawodników')).toHaveValue(null);
});
it('previews changed minimum and rejects a minimum greater than capacity',async()=>{
 const initial={...premiumDefaults('2030-01-01T12:00:00Z','group'),location:'Boisko',capacity:15,minimum:13};
 render(<EventForm live={{groups:[group],initial,busy:false}} onBack={vi.fn()} onSave={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText('Limit zawodników'),{target:{value:'12'}});fireEvent.click(screen.getByText('Podgląd meczu'));
 expect(screen.getByRole('alert')).toBeTruthy();fireEvent.change(screen.getByLabelText('Limit zawodników'),{target:{value:'15'}});fireEvent.click(screen.getByText('Podgląd meczu'));
 await waitFor(()=>expect(screen.getByText('13–15 osób')).toBeTruthy());
});
it('maps existing minimum/address and validates malformed server minimum',()=>{
 expect(premiumEventInput(eventSummary(event))).toMatchObject({minimum:13,capacity:15,address:'Adres'});
 for(const minimum_players of [0,16,1.5])expect(()=>eventSummary({...event,minimum_players})).toThrow();
});
it('edits using current version and persists minimum in the existing API payload',async()=>{
 let saved={...event};
 const call=vi.fn(async(action:string,body?:Record<string,unknown>)=>{
  if(action==='groups_list')return {groups:[group]};
  if(action==='matches_list')return {events:[saved],server_now:'2030-01-01T12:00:00Z',match_minimum_version:1};
  if(action==='matches_detail')return {event:saved,participants:[],server_now:'2030-01-01T12:00:00Z',can_register_paid:true};
  if(action==='matches_edit'){saved={...saved,minimum_players:Number(body?.minimum_players),version:8};return {event_id:'match'};}
 });
 const manager={call,getSnapshot:()=>({phase:'ready',session:{user_id:'owner'}}),subscribe:()=>()=>{}} as unknown as SessionManager;
 const {result}=renderHook(()=>usePremiumEvents(manager,'owner'));await waitFor(()=>expect(result.current.events).toHaveLength(1));
 await act(()=>result.current.open('match'));
 await act(()=>result.current.edit({...premiumEventInput(eventSummary(event)),minimum:12,startsAt:eventInstant('2099-01-01','18:00')!}));
 expect(call).toHaveBeenCalledWith('matches_edit',expect.objectContaining({minimum_players:12,capacity:15,expected_version:7}));
 expect(result.current.detail?.event.minimum_players).toBe(12);
});

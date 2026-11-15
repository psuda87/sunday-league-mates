import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import GroupNotifications from './GroupNotifications';
import type {SessionManager} from '../auth/sessionManager';
import {financeChangedEvent,takeOwnPaymentsRequest} from '../finance/paymentsIntent';
afterEach(()=>{cleanup();takeOwnPaymentsRequest();});

const due=(event_id:string,starts_at:string,outstanding_cents:number)=>({event_id,starts_at,due_cents:4500,covered_cents:4500-outstanding_cents,outstanding_cents});
const pending=(id:string,event_id:string|null)=>({id,group_id:'g',event_id,user_id:'me',corrected_amount_cents:4500,status:'pending'});
const wallet=(dues:unknown[],payments:unknown[]=[],registration_allowed=true)=>({accounts:[{group_id:'g',group_name:'Orliki',events:[{id:'m1',name:'Wtorek',starts_at:'2026-11-08T18:00:00Z'},{id:'m2',name:'Czwartek',starts_at:'2026-11-12T18:00:00Z'}],
 account:{group_id:'g',user_id:'me',balance_cents:-9000,registration_allowed,dues,payments,history:[],surplus:null}}]});
const setup=(answer:()=>unknown,groups:unknown[]=[])=>{
 const state={phase:'ready',session:{user_id:'me'}};
 const call=vi.fn(async(action:string)=>action==='group_finance_wallet'?answer():{groups});
 return {call,manager:{call,subscribe:()=>()=>{},getSnapshot:()=>state} as unknown as SessionManager};
};

it('counts each outstanding match on the bell and opens the reminder',async()=>{
 const onPayments=vi.fn();
 const {manager}=setup(()=>wallet([due('m1','2026-11-08T18:00:00Z',4500),due('m2','2026-11-12T18:00:00Z',2000),due('m3','2026-11-14T18:00:00Z',0)]));
 render(<GroupNotifications manager={manager} userId="me" onGroups={()=>{}} onPayments={onPayments} refreshKey={false}/>);
 const bell=await screen.findByRole('button',{name:'Powiadomienia: 2. Zaległe płatności: 2'});
 expect(within(bell).getByText('2')).toBeTruthy();
 fireEvent.click(bell);
 const panel=screen.getByRole('region',{name:'Powiadomienia'});
 expect(within(panel).getByRole('heading',{name:'Zaległe płatności'})).toBeTruthy();
 expect(within(panel).getByText('Wtorek')).toBeTruthy();expect(within(panel).getByText('Czwartek')).toBeTruthy();
 expect(within(panel).getByText(/Dwie zaległości/)).toBeTruthy();
 expect(within(panel).queryByText('Prośby do Twoich grup')).toBeNull();
 fireEvent.click(within(panel).getByRole('button',{name:'Zgłoś wpłatę'}));
 expect(onPayments).toHaveBeenCalledOnce();expect(takeOwnPaymentsRequest()).toBe(true);
 expect(screen.queryByRole('region',{name:'Powiadomienia'})).toBeNull();
});

it('skips matches with a reported payment and warns before the block',async()=>{
 const {manager}=setup(()=>wallet([due('m1','2026-11-08T18:00:00Z',4500),due('m2','2026-11-12T18:00:00Z',4500)],[pending('p','m2')]));
 render(<GroupNotifications manager={manager} userId="me" onGroups={()=>{}} refreshKey={false}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Powiadomienia: 1. Zaległe płatności: 1'}));
 expect(screen.getByText('Druga zaległość zablokuje zapisy na płatne mecze.')).toBeTruthy();
 expect(screen.queryByText('Czwartek')).toBeNull();
});

it('says when paid registrations are already blocked',async()=>{
 const {manager}=setup(()=>wallet([due('m1','2026-11-08T18:00:00Z',4500),due('m2','2026-11-12T18:00:00Z',4500)],[],false));
 render(<GroupNotifications manager={manager} userId="me" onGroups={()=>{}} refreshKey={false}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Zaległe płatności: 2/}));
 expect(screen.getByText(/Zapisy na płatne mecze są zablokowane/)).toBeTruthy();
});

it('adds admin requests to the count and recounts after an own payment report',async()=>{
 let dues=[due('m1','2026-11-08T18:00:00Z',4500)];
 const {manager}=setup(()=>wallet(dues),[{id:'grupa',name:'Grupa',description:'',admin_id:'me',pending_count:2,organizer:true,member_count:3}]);
 render(<GroupNotifications manager={manager} userId="me" onGroups={()=>{}} refreshKey={false}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Powiadomienia: 3. Zaległe płatności: 1, prośby do grup: 2'}));
 expect(screen.getByRole('heading',{name:'Prośby do Twoich grup'})).toBeTruthy();
 dues=[];act(()=>{window.dispatchEvent(new Event(financeChangedEvent));});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Oczekujące zgłoszenia do grup: 2'})).toBeTruthy());
});

it('keeps the bell working when payments cannot be read',async()=>{
 const {manager}=setup(()=>{throw new Error('offline');});
 render(<GroupNotifications manager={manager} userId="me" onGroups={()=>{}} refreshKey={false}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Oczekujące zgłoszenia do grup: 0'}));
 expect(screen.getByText('Brak oczekujących zgłoszeń.')).toBeTruthy();
});

it('opens "Moje płatności" in the profile when asked from the bell',async()=>{
 const {default:PersonalPayments}=await import('../finance/PersonalPayments');
 const {requestOwnPayments}=await import('../finance/paymentsIntent');
 const {manager,call}=setup(()=>wallet([due('m1','2026-11-08T18:00:00Z',4500)]));
 requestOwnPayments();
 render(<PersonalPayments manager={manager} userId="me"/>);
 expect(screen.getByRole('button',{name:'Moje płatności'})).toHaveAttribute('aria-expanded','true');
 await waitFor(()=>expect(call).toHaveBeenCalledWith('group_finance_wallet'));
 expect(takeOwnPaymentsRequest()).toBe(false);
});

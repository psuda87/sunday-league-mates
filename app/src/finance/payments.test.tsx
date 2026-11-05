import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import type {SessionManager} from '../auth/sessionManager';
import PremiumFinance from './PremiumFinance';
import PersonalPayments from './PersonalPayments';
import {isSettledReport,paymentChoices,receiptStatus} from './paymentModel';
import {paymentRoster,paymentWallet} from './contracts';
import type {Account,Receipt} from './contracts';
afterEach(cleanup);
const receipt:Receipt={id:'r',group_id:'g',event_id:'e',user_id:'u',corrected_amount_cents:2300,status:'pending'};
function fixture(initial:'none'|'pending'|'accepted'='pending',admin=true){
 let status=initial,amount=2300;
 const payments=()=>status==='none'?[]:[{...receipt,status:status as Receipt['status'],corrected_amount_cents:amount}];
 const own=():Account=>({group_id:'g',user_id:'u',balance_cents:status==='accepted'?-2300+amount:-2300,registration_allowed:true,dues:[{event_id:'e',starts_at:'2026-11-04T18:00:00Z',due_cents:2300,covered_cents:status==='accepted'?amount:0,outstanding_cents:status==='accepted'?2300-amount:2300}],payments:payments(),history:[],surplus:admin?[]:null});
 const events=[{id:'e',name:'Mecz testowy',starts_at:'2026-11-04T18:00:00Z'}];
 const call=vi.fn(async(action:string,body?:Record<string,unknown>)=>{
  if(action==='group_finance_account')return own();
  if(action==='group_finance_roster')return {group_id:'g',players:[{user_id:'u',name:'Zawodnik fixture',account:own()}],events};
  if(action==='group_finance_wallet')return {accounts:[{group_id:'g',group_name:'Grupa fixture',account:own(),events}]};
  if(action==='group_finance_detail')return {event:{id:'e',group_id:'g',version:1,approved_at:'2026-11-04',cost_cents:27000},participants:[{entry_id:'entry',user_id:'u',name:'Zawodnik fixture',payable:true,amount_cents:2300}],payments:payments(),surplus:[]};
  if(action==='group_finance_accept_payment'||action==='group_finance_record_payment')status='accepted';
  else if(action==='group_finance_reject_payment')status='rejected' as typeof status;
  else if(action==='group_finance_cancel_payment'){status='accepted';amount=0;}
  else if(action==='group_finance_submit_payment'){status='pending';amount=Number(body?.amount_cents);}
  else throw Error('Unexpected '+action);
  return {ok:true,group_id:'g'};
 });
 const snapshot={phase:'ready',session:{user_id:'u'}};
 const manager={call,subscribe:()=>()=>{},getSnapshot:()=>snapshot} as unknown as SessionManager;
 return {manager,call,own};
}
it('accepts directly inside a payer card without entering a reason, then can cancel with a correction',async()=>{
 const f=fixture();render(<PremiumFinance manager={f.manager} userId="u" groupId="g" eventId="e" manage/>);
 const card=await screen.findByRole('article',{name:'Płatności: Zawodnik fixture'});
 expect(within(card).getByText(/Zgłoszono wpłatę/)).toBeTruthy();expect(screen.queryByRole('textbox')).toBeNull();
 expect(within(card).getAllByRole('button').map(b=>b.textContent)).toEqual(['Akceptuj','Odrzuć','Anuluj']);
 expect(within(card).getByRole('button',{name:'Akceptuj zgłoszoną wpłatę'})).toHaveClass('is-reported');
 fireEvent.click(within(card).getByRole('button',{name:'Akceptuj zgłoszoną wpłatę'}));
 await waitFor(()=>expect(screen.queryByRole('article',{name:'Płatności: Zawodnik fixture'})).toBeNull());
 expect(f.call).toHaveBeenCalledWith('group_finance_accept_payment',expect.objectContaining({payment_id:'r',expected_amount_cents:2300,reason:'Akceptacja zgłoszonej wpłaty',request_id:expect.any(String)}));
 fireEvent.click(screen.getByRole('tab',{name:'Historia wpłat'}));await screen.findByText(/Opłacono/);
 fireEvent.click(screen.getByRole('button',{name:'Anuluj'}));await screen.findByText(/Anulowana/);
 expect(screen.getByRole('button',{name:'Anuluj'})).toBeDisabled();
 fireEvent.click(screen.getByRole('tab',{name:'Bieżące płatności'}));await screen.findByRole('button',{name:'Akceptuj wpłatę bez zgłoszenia'});
});
it('rejects a pending contribution in the same card and leaves the debt payable',async()=>{
 const f=fixture();render(<PremiumFinance manager={f.manager} userId="u" groupId="g" eventId="e" manage/>);
 fireEvent.click(await screen.findByRole('button',{name:'Odrzuć'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Odrzuć'})).toBeDisabled());
 expect(await screen.findByRole('button',{name:'Akceptuj wpłatę bez zgłoszenia'})).not.toBeDisabled();
 fireEvent.click(screen.getByRole('tab',{name:'Historia wpłat'}));await screen.findByText(/Odrzucona/);
});
it('records a payment without a player notification and removes the paid match from profile choices',async()=>{
 const f=fixture('none');const page=render(<PremiumFinance manager={f.manager} userId="u" groupId="g" eventId="e" manage/>);
 const accept=await screen.findByRole('button',{name:'Akceptuj wpłatę bez zgłoszenia'});
 expect(accept).toHaveClass('is-unreported');
 expect(screen.getByRole('button',{name:'Odrzuć'})).toBeDisabled();expect(screen.getByRole('button',{name:'Anuluj'})).toBeDisabled();
 fireEvent.click(accept);await waitFor(()=>expect(screen.queryByRole('article',{name:'Płatności: Zawodnik fixture'})).toBeNull());page.unmount();
 render(<PersonalPayments manager={f.manager} userId="u"/>);fireEvent.click(screen.getByRole('button',{name:'Moje płatności'}));
 await screen.findByText(/Wszystkie należności są opłacone/);expect(screen.queryByRole('form')).toBeNull();expect(paymentChoices(f.own())).toEqual([]);
});
it('reports own payment from the profile using only amount and optional unpaid match',async()=>{
 const f=fixture('none',false);render(<PersonalPayments manager={f.manager} userId="u"/>);
 fireEvent.click(screen.getByRole('button',{name:'Moje płatności'}));
 fireEvent.change(await screen.findByLabelText('Kwota (zł)'),{target:{value:'23'}});
 fireEvent.change(screen.getByLabelText('Za który mecz? (opcjonalnie)'),{target:{value:'e'}});
 expect(screen.queryByLabelText(/Opis/)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Zgłoś do zatwierdzenia'}));
 await screen.findByText(/oczekiwanie na decyzję/);
 expect(f.call).toHaveBeenCalledWith('group_finance_submit_payment',expect.objectContaining({event_id:'e',amount_cents:2300,reason:'Zgłoszenie wpłaty przez zawodnika'}));
 expect(screen.queryByRole('option',{name:/Mecz testowy/})).toBeNull();
});
it('rejects foreign wallet accounts and roster payloads and distinguishes cancellation',()=>{
 const f=fixture();expect(()=>paymentWallet({accounts:[{group_id:'g',group_name:'Fixture',account:f.own(),events:[]}]},'foreign')).toThrow();
 expect(()=>paymentRoster({group_id:'other',players:[],events:[]},'g')).toThrow();
 expect(receiptStatus({...receipt,status:'accepted',corrected_amount_cents:0})).toBe('Anulowana');
});
it('labels a pending duplicate on a settled match without pretending the report was accepted',async()=>{
 const f=fixture('accepted',false);
 const own=()=>({...f.own(),payments:[...f.own().payments,{...receipt,id:'duplicate'}]});
 const manager={...f.manager,call:vi.fn(async(action:string)=>{
  if(action==='group_finance_account')return own();
  if(action==='group_finance_wallet')return {accounts:[{group_id:'g',group_name:'Fixture',account:own(),events:[]}]};
  throw Error('Unexpected write');
 })} as unknown as SessionManager;
 render(<PersonalPayments manager={manager} userId="u"/>);fireEvent.click(screen.getByRole('button',{name:'Moje płatności'}));
 await screen.findByText(/nieaktualne zgłoszenie — należność już opłacona/);
 expect(screen.queryByText(/oczekiwanie na decyzję/)).toBeNull();
 expect(isSettledReport(own(),receipt)).toBe(true);expect(receipt.status).toBe('pending');
 expect(isSettledReport({...own(),dues:[]},receipt)).toBe(false);
});
it('refreshes the own account as well as the wallet when the profile refresh button is pressed',async()=>{
 const f=fixture('pending',false);render(<PersonalPayments manager={f.manager} userId="u"/>);
 fireEvent.click(screen.getByRole('button',{name:'Moje płatności'}));await screen.findByText(/oczekiwanie na decyzję/);
 await f.call('group_finance_accept_payment');
 fireEvent.click(screen.getByRole('button',{name:'Odśwież płatności'}));
 await screen.findByText(/Wszystkie należności są opłacone/);expect(screen.queryByText(/oczekiwanie na decyzję/)).toBeNull();
});
it('names an old report for a different unassessed match and does not mark it accepted because the balance is zero',async()=>{
 const f=fixture('accepted',false),own={...f.own(),payments:[...f.own().payments,{...receipt,id:'future-report',event_id:'future'}]};
 const manager={...f.manager,call:vi.fn(async(action:string)=>{
  if(action==='group_finance_account')return own;
  if(action==='group_finance_wallet')return {accounts:[{group_id:'g',group_name:'Fixture',account:own,events:[]}]};
  if(action==='matches_detail')return {event:{id:'future',group_id:'g',group_name:'Fixture',created_by:'u',name:'Mecz nadchodzący',location:'Fixture',starts_at:'2026-11-06T18:00:00Z',visibility:'private',status:'scheduled',access:'own',own_participation:true,duration_minutes:90,capacity:12,cost_cents:27000,minimum_players:10,version:1,registration_open:true,decision_required:false,can_manage:false,can_edit:false}};
  throw Error('Unexpected write');
 })} as unknown as SessionManager;
 render(<PersonalPayments manager={manager} userId="u"/>);fireEvent.click(screen.getByRole('button',{name:'Moje płatności'}));
 await screen.findByText(/Mecz nadchodzący · oczekiwanie na decyzję — za ten mecz nie ma obecnie naliczonej składki/);
 expect(screen.queryByText(/nieaktualne zgłoszenie/)).toBeNull();expect(isSettledReport(own,own.payments[1])).toBe(false);
 expect(own.payments[1].status).toBe('pending');
});

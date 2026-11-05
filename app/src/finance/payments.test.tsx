import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import type {SessionManager} from '../auth/sessionManager';
import PremiumFinance from './PremiumFinance';
import PersonalPayments from './PersonalPayments';
import {paymentChoices,receiptStatus} from './paymentModel';
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
 let card=await screen.findByRole('article',{name:'Płatności: Zawodnik fixture'});
 expect(within(card).getByText(/Zgłoszono wpłatę/)).toBeTruthy();expect(screen.queryByRole('textbox')).toBeNull();
 fireEvent.click(within(card).getByRole('button',{name:'Akceptuj wpłatę'}));
 await screen.findByRole('button',{name:'Anuluj wpłatę'});
 expect(f.call).toHaveBeenCalledWith('group_finance_accept_payment',expect.objectContaining({payment_id:'r',expected_amount_cents:2300,reason:'Akceptacja zgłoszonej wpłaty',request_id:expect.any(String)}));
 card=screen.getByRole('article',{name:'Płatności: Zawodnik fixture'});fireEvent.click(within(card).getByRole('button',{name:'Anuluj wpłatę'}));
 await screen.findByRole('button',{name:'Oznacz jako opłacone'});expect(screen.queryByRole('button',{name:'Anuluj wpłatę'})).toBeNull();
 fireEvent.click(screen.getByRole('tab',{name:'Historia wpłat'}));await screen.findByText(/Anulowana/);
});
it('rejects a pending contribution in the same card and leaves the debt payable',async()=>{
 const f=fixture();render(<PremiumFinance manager={f.manager} userId="u" groupId="g" eventId="e" manage/>);
 fireEvent.click(await screen.findByRole('button',{name:'Odrzuć wpłatę'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Odrzuć wpłatę'})).toBeNull());
 expect(await screen.findByRole('button',{name:'Oznacz jako opłacone'})).not.toBeDisabled();
 fireEvent.click(screen.getByRole('tab',{name:'Historia wpłat'}));await screen.findByText(/Odrzucona/);
});
it('records a payment without a player notification and removes the paid match from profile choices',async()=>{
 const f=fixture('none');const page=render(<PremiumFinance manager={f.manager} userId="u" groupId="g" eventId="e" manage/>);
 fireEvent.click(await screen.findByRole('button',{name:'Oznacz jako opłacone'}));await screen.findByRole('button',{name:'Anuluj wpłatę'});page.unmount();
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

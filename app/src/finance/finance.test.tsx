import { afterEach,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,renderHook,screen,waitFor } from '@testing-library/react';
import type { SessionManager } from '../auth/sessionManager';
import { AccountError } from '../auth/api';
import { account,detail } from './contracts';
import { usePremiumFinance } from './usePremiumFinance';
import PremiumFinance from './PremiumFinance';
afterEach(cleanup);
const own=(user='member',group='g')=>({group_id:group,user_id:user,balance_cents:-8100,registration_allowed:false,dues:[{event_id:'e',starts_at:'2030-01-01T18:00:00Z',due_cents:8100,covered_cents:0,outstanding_cents:8100}],payments:[],history:[],surplus:null});
const event={event:{id:'e',group_id:'g',version:1,approved_at:'2030-01-02',cost_cents:27000},participants:[{entry_id:'p',user_id:'member',name:'Zawodnik fixture',payable:true,amount_cents:2700}],payments:[],surplus:[]};
function manager(writer?:(action:string,body:Record<string,unknown>)=>Promise<unknown>){const call=vi.fn(async(a:string,b:Record<string,unknown>={})=>{if(a==='group_finance_account')return own(String(b.user_id??'member'),String(b.group_id));if(a==='group_finance_detail')return event;return writer?writer(a,b):{ok:true,group_id:b.group_id};});return {call,subscribe:()=>()=>{},getSnapshot:()=>({phase:'ready',session:{user_id:'member'}})} as unknown as SessionManager;}
it('rejects foreign accounts, receipts and malformed money rather than rendering sample balances',()=>{
 expect(account(own(),'g','member').balance_cents).toBe(-8100);expect(()=>account(own('other'),'g','member')).toThrow();expect(()=>account({...own(),balance_cents:NaN},'g','member')).toThrow();expect(()=>account({...own(),payments:[{id:'p',group_id:'g',event_id:'e',user_id:'other',status:'accepted',corrected_amount_cents:1}]},'g','member')).toThrow();expect(()=>detail(event,'foreign','e')).toThrow();
});
it('reads only the own account for a member; no administrator detail/pending calls',async()=>{const m=manager(),{result}=renderHook(()=>usePremiumFinance(m,'member','g','e'));await waitFor(()=>expect(result.current.own).not.toBeNull());expect(m.call).toHaveBeenCalledTimes(1);expect(m.call).toHaveBeenCalledWith('group_finance_account',{group_id:'g'});});
it('reuses the same request after network failure and coalesces simultaneous writes',async()=>{
 let calls=0;const m=manager(async()=>{if(!calls++)throw Error('Network');return {ok:true,group_id:'g'};});const {result}=renderHook(()=>usePremiumFinance(m,'member','g'));
 await waitFor(()=>expect(result.current.own).not.toBeNull());const body={amount_cents:2700,reason:'Fixture'};
 await act(async()=>{await result.current.mutate('submit_payment',body);});await act(async()=>{await Promise.all([result.current.mutate('submit_payment',body),result.current.mutate('submit_payment',body)]);});
 const writes=vi.mocked(m.call).mock.calls.filter(([a])=>a==='group_finance_submit_payment');expect(writes).toHaveLength(2);expect(writes[0][1]?.request_id).toBe(writes[1][1]?.request_id);expect(result.current.error).toBe('');
});
it('keeps the confirmed server-write intent if subsequent readback fails, including remount',async()=>{
 let broken=false;const m=manager(async()=>{broken=true;return {ok:true,group_id:'g'};});const base=vi.mocked(m.call).getMockImplementation()!;vi.spyOn(m,'call').mockImplementation(async(a,b)=>{if(a==='group_finance_account'&&broken)throw Error('Lost readback');return base(a,b);});
 const view=renderHook(()=>usePremiumFinance(m,'member','g'));await waitFor(()=>expect(view.result.current.own).not.toBeNull());const body={amount_cents:2700,reason:'Receipt'};await act(async()=>{await view.result.current.mutate('submit_payment',body);});view.unmount();broken=false;const next=renderHook(()=>usePremiumFinance(m,'member','g'));await waitFor(()=>expect(next.result.current.own).not.toBeNull());await act(async()=>{await next.result.current.mutate('submit_payment',body);});
 const calls=vi.mocked(m.call).mock.calls.filter(([a])=>a==='group_finance_submit_payment');expect(calls[0][1]?.request_id).toBe(calls[1][1]?.request_id);
});
it('shows actual aggregated own+two-guests debt and a server registration block, without DEMO values',async()=>{
 render(<PremiumFinance manager={manager()} userId="member" groupId="g" eventId="e"/>);await screen.findByText(/Blokada nowych płatnych zapisów/);expect(screen.getAllByText(/81,00/).length).toBeGreaterThan(0);expect(screen.queryByText(/DEMO/)).toBeNull();expect(screen.queryByText('Potwierdź otrzymaną wpłatę')).toBeNull();fireEvent.change(screen.getByLabelText('Kwota (zł)'),{target:{value:'12,34'}});fireEvent.click(screen.getByRole('button',{name:'Zgłoś do zatwierdzenia'}));await screen.findByText('Operacja potwierdzona i dane odczytane z serwera.');
});
it('administrator confirms an existing receipt with expected amount and refreshes only server values',async()=>{
 let accepted=false;const receipt={id:'receipt',event_id:'e',group_id:'g',user_id:'member',corrected_amount_cents:8100,status:'pending'};
 const m=manager(async action=>{if(action==='group_finance_accept_payment'){accepted=true;return {ok:true,group_id:'g'};}return undefined;});
 const base=vi.mocked(m.call).getMockImplementation()!;vi.mocked(m.call).mockImplementation(async(a,b)=>{
  if(a==='group_finance_account')return {...own(),surplus:[],payments:[{...receipt,status:accepted?'accepted':'pending'}],dues:own().dues.map(d=>({...d,covered_cents:accepted?8100:0,outstanding_cents:accepted?0:8100})),balance_cents:accepted?0:-8100};
  if(a==='groups_detail')return {members:[{user_id:'member',nickname:'Osoba fixture'}]};
  if(a==='group_finance_pending')return {payments:accepted?[]:[receipt]};
  return base(a,b);
 });
 render(<PremiumFinance manager={m} userId="member" groupId="g" eventId="e" manage/>);
 await screen.findByRole('button',{name:'Zatwierdź wpłatę'});fireEvent.change(screen.getByLabelText('Opis / powód decyzji'),{target:{value:'Gotówka fixture'}});fireEvent.click(screen.getByRole('button',{name:'Zatwierdź wpłatę'}));
 await screen.findByText(/Zaksięgowana/);expect(screen.queryByRole('button',{name:'Zatwierdź wpłatę'})).toBeNull();expect(m.call).toHaveBeenCalledWith('group_finance_accept_payment',expect.objectContaining({payment_id:'receipt',expected_amount_cents:8100,group_id:'g',request_id:expect.any(String)}));expect(screen.getByText(/Opłacono · należne/)).toBeTruthy();
});
it('hides a previous group synchronously when scope changes and ignores its late response',async()=>{
 const m=manager();const {result,rerender}=renderHook(({group})=>usePremiumFinance(m,'member',group),{initialProps:{group:'g'}});await waitFor(()=>expect(result.current.own).not.toBeNull());
 let finish:(v:unknown)=>void=()=>{};vi.mocked(m.call).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));rerender({group:'other'});expect(result.current.own).toBeNull();await act(async()=>{finish(own('member','g'));});expect(result.current.own).toBeNull();expect(result.current.error).not.toBe('');
});
it('clears an uncertain finance intent on logout even when its screen has already unmounted',async()=>{
 let lost=true,signedOut=false;const listeners=new Set<()=>void>();
 const m=manager(async()=>{if(lost)throw new AccountError('Lost acknowledgement','network_error');return {ok:true,group_id:'g'};});
 const snapshot=m.getSnapshot;vi.spyOn(m,'getSnapshot').mockImplementation(()=>signedOut?{phase:'signed_out',session:null,message:''}:snapshot());
 vi.spyOn(m,'subscribe').mockImplementation(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};});
 const body={amount_cents:1000,reason:'New intentional payment after login'};
 const first=renderHook(()=>usePremiumFinance(m,'member','g'));await waitFor(()=>expect(first.result.current.own).not.toBeNull());
 await act(()=>first.result.current.mutate('submit_payment',body));first.unmount();
 act(()=>{signedOut=true;listeners.forEach(listener=>listener());});signedOut=false;lost=false;
 const second=renderHook(()=>usePremiumFinance(m,'member','g'));await waitFor(()=>expect(second.result.current.own).not.toBeNull());await act(()=>second.result.current.mutate('submit_payment',body));
 const calls=vi.mocked(m.call).mock.calls.filter(([action])=>action==='group_finance_submit_payment');
 expect(calls).toHaveLength(2);expect(calls[0][1]?.request_id).not.toBe(calls[1][1]?.request_id);
});

import { afterEach,expect,it,vi } from 'vitest';
import { act,cleanup,render,renderHook,screen,waitFor } from '@testing-library/react';
import type { SessionManager } from '../auth/sessionManager';
import { AccountError } from '../auth/api';
import { account,detail } from './contracts';
import { usePremiumFinance } from './usePremiumFinance';
import PremiumFinance from './PremiumFinance';
afterEach(cleanup);
const own=(user='member',group='g')=>({group_id:group,user_id:user,balance_cents:-8100,registration_allowed:false,dues:[{event_id:'e',starts_at:'2030-01-01T18:00:00Z',due_cents:8100,covered_cents:0,outstanding_cents:8100}],payments:[],history:[],surplus:null});
const event={event:{id:'e',group_id:'g',version:1,approved_at:'2030-01-02',cost_cents:27000},participants:[{entry_id:'p',user_id:'member',name:'Zawodnik fixture',payable:true,amount_cents:2700}],payments:[],surplus:[]};
function manager(writer?:(action:string,body:Record<string,unknown>)=>Promise<unknown>){const call=vi.fn(async(a:string,b:Record<string,unknown>={})=>{if(a==='group_finance_account')return own(String(b.user_id??'member'),String(b.group_id));if(a==='group_finance_detail')return event;if(a==='group_finance_roster')return {group_id:'g',players:[{user_id:'member',name:'Fixture',account:own()}],events:[]};return writer?writer(a,b):{ok:true,group_id:b.group_id};});return {call,subscribe:()=>()=>{},getSnapshot:()=>({phase:'ready',session:{user_id:'member'}})} as unknown as SessionManager;}
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
it('keeps own group finance read-only and directs submission to the profile',async()=>{
 render(<PremiumFinance manager={manager()} userId="member" groupId="g" eventId="e"/>);
 await screen.findAllByText(/81,00/);expect(screen.queryByRole('form')).toBeNull();expect(screen.queryByRole('button',{name:'Zg\u0142o\u015b do zatwierdzenia'})).toBeNull();
 expect(screen.getByText(/swoim profilu/)).toBeTruthy();
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

it('ignores a stale creator/admin manage hint when the current account projection is not admin',async()=>{
 const m=manager(),{result}=renderHook(()=>usePremiumFinance(m,'member','g','e',true));
 await waitFor(()=>expect(result.current.own).not.toBeNull());expect(result.current.detail).toBeNull();
 expect(vi.mocked(m.call).mock.calls.map(c=>c[0])).toEqual(['group_finance_account']);
});
it('a group-role refresh removes cached administrator detail but keeps own account access',async()=>{
 let admin=true;const m=manager(),normal=vi.mocked(m.call).getMockImplementation()!;
 vi.mocked(m.call).mockImplementation(async(action,body)=>{
  if(action==='group_finance_account')return {...own(),surplus:admin?[]:null};
  if(action==='groups_detail')return {members:[{user_id:'member',nickname:'Fixture'}]};
  if(action==='group_finance_pending')return {payments:[]};
  return normal(action,body);
 });
 const {result}=renderHook(()=>usePremiumFinance(m,'member','g','e',true));await waitFor(()=>expect(result.current.detail).not.toBeNull());
 const detailCalls=vi.mocked(m.call).mock.calls.filter(c=>c[0]==='group_finance_detail').length;
 act(()=>{admin=false;window.dispatchEvent(new Event('slm-groups-changed'));});expect(result.current.detail).toBeNull();
 await waitFor(()=>expect(result.current.own).not.toBeNull());expect(result.current.detail).toBeNull();expect(result.current.own?.surplus).toBeNull();
 expect(vi.mocked(m.call).mock.calls.filter(c=>c[0]==='group_finance_detail')).toHaveLength(detailCalls);
});

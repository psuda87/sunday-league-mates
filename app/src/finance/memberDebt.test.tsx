import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import type {SessionManager} from '../auth/sessionManager';
import {AccountError} from '../auth/api';
import MemberDebtPanel from './MemberDebtPanel';
import {matchesWord,memberDebt} from './memberDebt';
import type {Account} from './contracts';

const acc=(user:string,over:Partial<Account>={}):Account=>({group_id:'g',user_id:user,balance_cents:0,registration_allowed:true,dues:[],payments:[],history:[],surplus:null,...over});
const mgr=(call:(a:string,b?:Record<string,unknown>)=>Promise<unknown>)=>({call,subscribe:()=>()=>{},getSnapshot:()=>({phase:'ready',session:{user_id:'admin'}})}) as unknown as SessionManager;
const due=(id:string,at:string,out:number)=>({event_id:id,starts_at:at,due_cents:out,covered_cents:0,outstanding_cents:out});

describe('memberDebt',()=>{
 it('sums only outstanding dues, oldest first, and reports credit, pending and block',()=>{
  const d=memberDebt(acc('m',{registration_allowed:false,dues:[due('b','2026-11-10T18:00:00Z',1500),due('a','2026-11-03T18:00:00Z',2000),due('c','2026-11-01T18:00:00Z',0)],
   payments:[{id:'p',group_id:'g',event_id:null,user_id:'m',corrected_amount_cents:1000,status:'pending'}]}));
  expect(d.totalCents).toBe(3500);expect(d.matches.map(x=>x.event_id)).toEqual(['a','b']);
  expect(d.pendingCents).toBe(1000);expect(d.blocked).toBe(true);expect(d.creditCents).toBe(0);
  expect(memberDebt(acc('m',{balance_cents:500})).creditCents).toBe(500);
 });
 it('declines Polish match plurals',()=>{expect([1,2,5,12,22,25].map(matchesWord)).toEqual(['mecz','mecze','meczów','meczów','mecze','meczów']);});
});

describe('MemberDebtPanel',()=>{
 it('shows an administrator the debt of the viewed member',async()=>{
  const call=vi.fn(async(a:string,b:Record<string,unknown>={})=>b.user_id==='m1'?acc('m1',{dues:[due('e1','2026-11-03T18:00:00Z',2000),due('e2','2026-11-10T18:00:00Z',1500)]}):acc('admin',{surplus:[]}));
  render(<MemberDebtPanel manager={mgr(call)} userId="admin" groupId="g" memberId="m1"/>);
  expect(await screen.findByText(/Zaległość:/)).toHaveTextContent('35,00');
  expect(screen.getByText(/2 mecze/)).toBeInTheDocument();
  expect(call).toHaveBeenCalledWith('group_finance_account',{group_id:'g',user_id:'m1'});
 });
 it('shows "Brak zaległości" when nothing is owed',async()=>{
  const call=vi.fn(async(a:string,b:Record<string,unknown>={})=>b.user_id==='m1'?acc('m1'):acc('admin',{surplus:[]}));
  render(<MemberDebtPanel manager={mgr(call)} userId="admin" groupId="g" memberId="m1"/>);
  expect(await screen.findByText('Brak zaległości')).toBeInTheDocument();
 });
 it('renders nothing and never reads another account for a non-administrator',async()=>{
  const call=vi.fn(async()=>acc('admin'));
  const {container}=render(<MemberDebtPanel manager={mgr(call)} userId="admin" groupId="g" memberId="m1"/>);
  await waitFor(()=>expect(call).toHaveBeenCalledTimes(1));
  expect(container.querySelector('.slm-member-debt')).toBeNull();
 });
 it('hides the panel on forbidden and offers a retry on other errors',async()=>{
  const forbidden=vi.fn(async(a:string,b:Record<string,unknown>={})=>{if(b.user_id)throw new AccountError('forbidden','forbidden');return acc('admin',{surplus:[]});});
  const {container}=render(<MemberDebtPanel manager={mgr(forbidden)} userId="admin" groupId="g" memberId="m1"/>);
  await waitFor(()=>expect(forbidden).toHaveBeenCalledTimes(2));
  await waitFor(()=>expect(container.querySelector('.slm-member-debt')).toBeNull());
  const broken=vi.fn(async()=>{throw new Error('boom');});
  render(<MemberDebtPanel manager={mgr(broken)} userId="admin" groupId="g" memberId="m2"/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się');
  expect(screen.getByRole('button',{name:'Spróbuj ponownie'})).toBeInTheDocument();
 });
});

describe('MemberDebtPanel: wpłata i nadpłata',()=>{
 const owing=()=>acc('m1',{balance_cents:-2500,dues:[due('e1','2026-11-03T18:00:00Z',2500)]});
 it('records a general payment larger than the debt, without an event, and reloads the account',async()=>{
  let paid=false;
  const call=vi.fn(async(a:string,b:Record<string,unknown>={})=>{
   if(a==='group_finance_record_payment'){paid=true;return {ok:true,group_id:'g'};}
   return b.user_id==='m1'?(paid?acc('m1',{balance_cents:7500}):owing()):acc('admin',{surplus:[]});});
  render(<MemberDebtPanel manager={mgr(call)} userId="admin" groupId="g" memberId="m1"/>);
  fireEvent.change(await screen.findByLabelText(/Wpłata zawodnika/),{target:{value:'100'}});
  fireEvent.click(screen.getByRole('button',{name:'Zapisz wpłatę'}));
  expect(await screen.findByText(/Zapisano wpłatę 100,00/)).toBeInTheDocument();
  const write=call.mock.calls.find(c=>c[0]==='group_finance_record_payment')!;
  expect(write[1]).toMatchObject({group_id:'g',user_id:'m1',amount_cents:10000});expect(write[1]).not.toHaveProperty('event_id');expect(typeof write[1]?.request_id).toBe('string');
  expect(await screen.findByText(/nadpłata 75,00/)).toBeInTheDocument();expect(screen.getByText('Brak zaległości')).toBeInTheDocument();
 });
 it('reuses the request id when the same amount is retried after a failed save',async()=>{
  let n=0;const call=vi.fn(async(a:string,b:Record<string,unknown>={})=>{
   if(a==='group_finance_record_payment'){if(++n===1)throw new Error('lost');return {ok:true,group_id:'g'};}
   return b.user_id==='m1'?owing():acc('admin',{surplus:[]});});
  render(<MemberDebtPanel manager={mgr(call)} userId="admin" groupId="g" memberId="m1"/>);
  fireEvent.change(await screen.findByLabelText(/Wpłata zawodnika/),{target:{value:'100'}});
  fireEvent.click(screen.getByRole('button',{name:'Zapisz wpłatę'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie potwierdzono zapisu');
  fireEvent.click(screen.getByRole('button',{name:'Zapisz wpłatę'}));
  await waitFor(()=>expect(call.mock.calls.filter(c=>c[0]==='group_finance_record_payment')).toHaveLength(2));
  const w=call.mock.calls.filter(c=>c[0]==='group_finance_record_payment');expect(w[0][1]?.request_id).toBe(w[1][1]?.request_id);
 });
 it('rejects an invalid amount locally and hides the form while a report waits for a decision',async()=>{
  const call=vi.fn(async(a:string,b:Record<string,unknown>={})=>b.user_id==='m1'?owing():acc('admin',{surplus:[]}));
  const {unmount}=render(<MemberDebtPanel manager={mgr(call)} userId="admin" groupId="g" memberId="m1"/>);
  fireEvent.change(await screen.findByLabelText(/Wpłata zawodnika/),{target:{value:'abc'}});
  fireEvent.click(screen.getByRole('button',{name:'Zapisz wpłatę'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Podaj kwotę');expect(call.mock.calls.some(c=>c[0]==='group_finance_record_payment')).toBe(false);
  unmount();
  const pending=vi.fn(async(a:string,b:Record<string,unknown>={})=>b.user_id==='m1'?{...owing(),payments:[{id:'p',group_id:'g',event_id:null,user_id:'m1',corrected_amount_cents:2500,status:'pending' as const}]}:acc('admin',{surplus:[]}));
  render(<MemberDebtPanel manager={mgr(pending)} userId="admin" groupId="g" memberId="m1"/>);
  expect(await screen.findByText(/Zgłoszona wpłata czeka/)).toBeInTheDocument();expect(screen.queryByLabelText(/Wpłata zawodnika/)).toBeNull();
 });
});

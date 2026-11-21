import {render,screen,waitFor} from '@testing-library/react';
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

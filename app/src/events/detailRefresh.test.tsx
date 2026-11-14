import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {lineupFixture} from './lineupFixture.test-support';
import {usePremiumEvents} from './usePremiumEvents';

afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('does not reopen an old match after its confirmed write arrives following Back',async()=>{
  const f=lineupFixture(4,true),context=await f.context();let resolve!:(v:unknown)=>void;
  f.intercept(async(a,b)=>a==='matches_list'?{events:[],server_now:new Date().toISOString()}:a==='groups_list'?{groups:[]}:
    a==='matches_join'?new Promise(r=>{resolve=r;}):f.handle(a,b,f.userId));
  const {result}=renderHook(()=>usePremiumEvents(context.manager,f.userId));
  await waitFor(()=>expect(result.current.loading).toBe(false));await act(()=>result.current.open(f.eventId));
  let pending!:Promise<boolean>;act(()=>{pending=result.current.act('join');});
  await waitFor(()=>expect(resolve).toBeTypeOf('function'));act(()=>result.current.back());
  await act(async()=>{resolve({event_id:f.eventId});await pending;});
  expect(result.current.detail).toBeNull();
});
it('refreshes only the visible detail, coalesces requests and ignores a late response after Back',async()=>{
  const f=lineupFixture(4,true),context=await f.context();
  f.intercept(async(a,b)=>a==='matches_list'?{events:[],server_now:new Date().toISOString()}:a==='groups_list'?{groups:[]}:f.handle(a,b,f.userId));
  const {result}=renderHook(()=>usePremiumEvents(context.manager,f.userId));
  await waitFor(()=>expect(result.current.loading).toBe(false));await act(()=>result.current.open(f.eventId));
  const before=f.request.mock.calls.filter(c=>c[0]==='matches_detail').length;
  act(()=>window.dispatchEvent(new Event('focus')));expect(f.request.mock.calls.filter(c=>c[0]==='matches_detail')).toHaveLength(before);
  act(()=>result.current.setDetailVisible(true));
  f.event.version=2;act(()=>window.dispatchEvent(new Event('focus')));
  await waitFor(()=>expect(result.current.detail?.event.version).toBe(2));
  expect(f.request.mock.calls.filter(c=>c[0]==='matches_list')).toHaveLength(1);
  let resolve!:(v:unknown)=>void;
  f.intercept(async(a)=>a==='matches_detail'?new Promise(r=>{resolve=r;}):{});
  // A new visible binding resets event coalescing without starting an immediate request.
  act(()=>result.current.setDetailVisible(false));act(()=>result.current.setDetailVisible(true));
  act(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));});
  await waitFor(()=>expect(resolve).toBeTypeOf('function'));act(()=>result.current.back());
  await act(async()=>resolve(f.detail()));expect(result.current.detail).toBeNull();
});

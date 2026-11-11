import {afterEach, expect, it, vi} from 'vitest';
import {act, cleanup, render, renderHook, waitFor} from '@testing-library/react';
import {lineupFixture, uid} from './lineupFixture.test-support';
import {usePremiumLineup} from './usePremiumLineup';
import {useVisibleRefresh} from './useVisibleRefresh';
import PremiumTeams from './PremiumTeams';

afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
const flush=()=>act(async()=>{await Promise.resolve();});
it('unblocks a clean editor after a transient silent read error and a successful unchanged refresh',async()=>{
  let now=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>now);
  const f=lineupFixture(4,true),context=await f.context();
  const {result}=renderHook(()=>usePremiumLineup(f.eventId,context,true,true,''));
  await waitFor(()=>expect(result.current.writable).toBe(true));
  f.intercept(async()=>{throw Error('Transient fixture read failure');});
  act(()=>window.dispatchEvent(new Event('focus')));await waitFor(()=>expect(result.current.state.blocked).toBe(true));
  f.intercept();now+=600;
  act(()=>window.dispatchEvent(new Event('focus')));await waitFor(()=>expect(result.current.writable).toBe(true));
  expect(result.current.state.error).toBe('');expect(result.current.state.snapshot?.version).toBe(1);
});
it('keeps swap mode and the selected player when an unchanged focus read finishes',async()=>{
  const f=lineupFixture(4,true),context=await f.context();
  const {result}=renderHook(()=>usePremiumLineup(f.eventId,context,true,true,''));
  await waitFor(()=>expect(result.current.verified).toBe(true));
  act(()=>{result.current.edit({type:'mode',mode:'swap'});result.current.edit({type:'choose',id:uid(1)});});
  act(()=>window.dispatchEvent(new Event('focus')));await flush();
  expect(result.current.state.editor.mode).toBe('swap');expect(result.current.state.editor.selected).toBe(uid(1));
  act(()=>result.current.edit({type:'choose',id:uid(2)}));expect(result.current.dirty).toBe(true);
});
it('allows edit and save during a pending silent read and ignores its superseded response',async()=>{
  const f=lineupFixture(4,true),context=await f.context();
  const {result}=renderHook(()=>usePremiumLineup(f.eventId,context,true,true,''));
  await waitFor(()=>expect(result.current.verified).toBe(true));
  let release!:(v:unknown)=>void,reads=0;const stale=f.read();
  f.intercept(async(a,b)=>a==='lineups_get'&&++reads===1?new Promise(r=>{release=r;}):f.handle(a,b,f.userId));
  act(()=>window.dispatchEvent(new Event('focus')));await waitFor(()=>expect(release).toBeTypeOf('function'));
  act(()=>{result.current.edit({type:'mode',mode:'swap'});result.current.edit({type:'choose',id:uid(1)});result.current.edit({type:'choose',id:uid(2)});});
  expect(result.current.dirty).toBe(true);await act(()=>result.current.save());
  expect(f.saves()).toHaveLength(1);expect(result.current.state.snapshot?.version).toBe(2);
  await act(async()=>release(stale));expect(result.current.state.snapshot?.version).toBe(2);expect(result.current.dirty).toBe(false);
});
it('does not fetch a hidden lineup on initial mount and reloads on returning to its panel',async()=>{
  const f=lineupFixture(4,true),context=await f.context();
  const view=render(<div role="tabpanel" hidden><PremiumTeams eventId={f.eventId} participants={f.people} canEdit cancelled={false} profileContext={context}/></div>);
  await flush();expect(f.request.mock.calls.filter(c=>c[0]==='lineups_get')).toHaveLength(0);
  view.rerender(<div role="tabpanel"><PremiumTeams eventId={f.eventId} participants={f.people} canEdit cancelled={false} profileContext={context}/></div>);
  await view.findByText('Zapisany skład · lokalna edycja');expect(f.request.mock.calls.filter(c=>c[0]==='lineups_get')).toHaveLength(1);
});
it('coalesces return events and polls only the visible, online active view, then cleans up',()=>{
  vi.useFakeTimers();const run=vi.fn();let visible='visible',online=true;
  vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visible as DocumentVisibilityState);
  vi.spyOn(navigator,'onLine','get').mockImplementation(()=>online);
  const view=renderHook(({active})=>useVisibleRefresh(active,run),{initialProps:{active:true}});
  act(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));});
  expect(run).toHaveBeenCalledTimes(1);
  visible='hidden';act(()=>vi.advanceTimersByTime(15000));expect(run).toHaveBeenCalledTimes(1);
  visible='visible';online=false;act(()=>vi.advanceTimersByTime(15000));expect(run).toHaveBeenCalledTimes(1);
  online=true;act(()=>vi.advanceTimersByTime(15000));expect(run).toHaveBeenCalledTimes(2);
  view.rerender({active:false});act(()=>{vi.advanceTimersByTime(30000);window.dispatchEvent(new Event('focus'));});expect(run).toHaveBeenCalledTimes(2);
});
it('refreshes two active sessions and preserves a conflicting unsaved draft',async()=>{
  const f=lineupFixture(4,true),a=await f.context(),b=await f.context(uid(904));
  const first=renderHook(()=>usePremiumLineup(f.eventId,a,true,true,''));
  const second=renderHook(()=>usePremiumLineup(f.eventId,b,true,true,''));
  await waitFor(()=>expect(first.result.current.verified&&second.result.current.verified).toBe(true));
  const change=(port:typeof first)=>act(()=>{
    port.result.current.edit({type:'mode',mode:'swap'});
    port.result.current.edit({type:'choose',id:uid(1)});port.result.current.edit({type:'choose',id:uid(2)});
  });
  change(second);const draft={...second.result.current.state.editor.draft};change(first);
  await act(()=>first.result.current.save());expect(first.result.current.state.snapshot?.version).toBe(2);
  act(()=>window.dispatchEvent(new Event('focus')));await flush();
  await waitFor(()=>expect(second.result.current.state.blocked).toBe(true));
  expect(second.result.current.state.editor.draft).toEqual(draft);expect(second.result.current.state.error).toBe('lineup_version_conflict');
  expect(second.result.current.dirty).toBe(true);expect(f.saves()).toHaveLength(1);
});
it('ignores a late read across a same-account session replacement',async()=>{
  const f=lineupFixture(4,true),context=await f.context();
  const view=renderHook(()=>usePremiumLineup(f.eventId,context,true,true,''));
  await waitFor(()=>expect(view.result.current.verified).toBe(true));
  let resolve!:(value:unknown)=>void,reads=0;
  f.intercept(async(a,b)=>a==='lineups_get'&&++reads===1?new Promise(r=>{resolve=r;}):f.handle(a,b,f.userId));
  act(()=>window.dispatchEvent(new Event('focus')));await waitFor(()=>expect(resolve).toBeTypeOf('function'));
  await act(()=>context.manager.refresh());await waitFor(()=>expect(view.result.current.verified).toBe(true));
  await act(async()=>resolve({...f.read(),last_change:{...f.read().last_change,display_name:'Stara sesja'}}));
  expect(view.result.current.state.lastChange?.display_name).toBe('Autor API');
});

import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,renderHook,waitFor,render,screen,fireEvent} from '@testing-library/react';
import {usePremiumEvents} from './usePremiumEvents';
import PremiumEvents from './PremiumEvents';
import {matchList} from './premiumContracts';
import type {SessionManager} from '../auth/sessionManager';
afterEach(cleanup);
const now='2030-01-01T12:00:00Z';
const event={id:'public',group_id:'foreign',group_name:'Żółta grupa',created_by:'owner',name:'Łódź %_ [A]',visibility:'public',starts_at:'2099-01-01T18:00:00Z',location:'Boisko',status:'scheduled',access:'full',own_participation:false,duration_minutes:90,capacity:10,cost_cents:0,minimum_players:10,registered_count:0,reserve_count:0,registration_open:true,decision_required:false,can_manage:false,can_edit:false,version:1};
const page=(events:unknown[]=[event],offset=0,more=false)=>({events,server_now:now,public_discovery_version:1,offset,limit:100,has_more:more,next_offset:more?offset+100:null});
function setup(list:(body:Record<string,unknown>)=>Promise<unknown>=async()=>page()){
 let snapshot={phase:'ready',session:{user_id:'owner'}};
 const listeners=new Set<()=>void>();
 const call=vi.fn(async(action:string,body:Record<string,unknown>={})=>action==='groups_list'?{groups:[]}:list(body));
 const manager={call,getSnapshot:()=>snapshot,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);}} as unknown as SessionManager;
 return {manager,call,change:(id:string,phase='ready')=>{snapshot={phase,session:{user_id:id}};listeners.forEach(fn=>fn());}};
}
it('validates exact version and pagination; legacy remains available without new features',()=>{
 expect(matchList({events:[],server_now:now}).discovery).toBe(false);
 for(const bad of [{...page(),public_discovery_version:'1'},{...page(),public_discovery_version:2},{...page(),next_offset:100},{...page(),has_more:true},{...page(),offset:100}])expect(()=>matchList(bad,true)).toThrow();
 expect(matchList(page([],100),true,100).nextOffset).toBeNull();
});
it('debounces literal Polish/special input, resets offset and clears query on leaving public',async()=>{
 const s=setup(),{result}=renderHook(()=>usePremiumEvents(s.manager,'owner'));
 await waitFor(()=>expect(result.current.discoveryEnabled).toBe(true));
 act(()=>result.current.selectGroup('public'));await waitFor(()=>expect(result.current.loading).toBe(false));
 s.call.mockClear();act(()=>{result.current.changeSearch('Ł');result.current.changeSearch('Łódź %_ [A]');});
 expect(s.call).not.toHaveBeenCalled();expect(result.current.events).toEqual([]);
 await waitFor(()=>expect(s.call).toHaveBeenCalledWith('matches_list',expect.objectContaining({scope:'public',query:'Łódź %_ [A]',offset:0})));
 act(()=>result.current.selectGroup('groups'));await waitFor(()=>expect(result.current.loading).toBe(false));
 expect(result.current.search).toBe('');expect(s.call).toHaveBeenLastCalledWith('groups_list');
 const bodies=s.call.mock.calls.filter(c=>c[0]==='matches_list').map(c=>c[1]);expect(bodies.at(-1)).toMatchObject({scope:'groups',offset:0});expect(bodies.at(-1)).not.toHaveProperty('query');
});
it('starts a new scope while an old request is unresolved and discards the late response',async()=>{
 let resolve!:(value:unknown)=>void;
 const s=setup(async body=>body.scope==='public'?new Promise(r=>{resolve=r;}):page([]));
 const {result}=renderHook(()=>usePremiumEvents(s.manager,'owner'));await waitFor(()=>expect(result.current.loading).toBe(false));
 act(()=>result.current.selectGroup('public'));act(()=>result.current.selectGroup('groups'));
 await waitFor(()=>expect(result.current.loading).toBe(false));await act(async()=>resolve(page()));
 expect(result.current.activeGroup).toBe('groups');expect(result.current.events).toEqual([]);
});
it('rejects a late search response after query changes, before the debounce completes',async()=>{
 let resolve!:(value:unknown)=>void;
 const s=setup(async body=>body.query==='old'?new Promise(r=>{resolve=r;}):page([]));
 const {result}=renderHook(()=>usePremiumEvents(s.manager,'owner'));await waitFor(()=>expect(result.current.discoveryEnabled).toBe(true));act(()=>result.current.selectGroup('public'));await waitFor(()=>expect(result.current.loading).toBe(false));
 act(()=>result.current.changeSearch('old'));await waitFor(()=>expect(resolve).toBeTypeOf('function'));
 act(()=>result.current.changeSearch('new'));await act(async()=>resolve(page()));expect(result.current.events).toEqual([]);
 await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.search).toBe('new');expect(result.current.events).toEqual([]);
});
it('uses server has_more/next_offset above 100 and never filters that page locally',async()=>{
 const first=Array.from({length:100},(_,i)=>({...event,id:'p'+i}));
 const s=setup(async b=>b.offset===100?page([{...event,id:'last'}],100):page(first,0,true));
 const {result}=renderHook(()=>usePremiumEvents(s.manager,'owner'));await waitFor(()=>expect(result.current.hasMore).toBe(true));
 await act(()=>result.current.refresh(result.current.nextOffset!));expect(result.current.events[0].id).toBe('last');expect(result.current.offset).toBe(100);expect(result.current.hasMore).toBe(false);
 act(()=>result.current.selectGroup('groups'));await waitFor(()=>expect(result.current.offset).toBe(0));
});
it('does not retain the own-participation tab label after choosing a different server scope',async()=>{
 const s=setup(),{result}=renderHook(()=>usePremiumEvents(s.manager,'owner'));
 await waitFor(()=>expect(result.current.discoveryEnabled).toBe(true));
 act(()=>result.current.changeFilter('mine'));await waitFor(()=>expect(result.current.loading).toBe(false));
 expect(result.current.activeGroup).toBe('mine');
 act(()=>result.current.selectGroup('public'));await waitFor(()=>expect(result.current.loading).toBe(false));
 expect(result.current.listFilter).toBe('upcoming');expect(result.current.activeGroup).toBe('public');
 expect(s.call).toHaveBeenCalledWith('matches_list',expect.objectContaining({scope:'public',period:'upcoming',offset:0}));
});
it('fails closed on an old backend for new scopes and retains retry controls',async()=>{
 const s=setup(async()=>({events:[],server_now:now})),{result}=renderHook(()=>usePremiumEvents(s.manager,'owner'));
 await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.discoveryEnabled).toBe(false);
 act(()=>result.current.selectGroup('public'));await waitFor(()=>expect(result.current.error).not.toBe(''));expect(result.current.events).toEqual([]);
 render(<PremiumEvents data={result.current} userId="owner" onGroups={()=>{}}/>);
 expect(screen.getByRole('combobox',{name:'Aktywna grupa'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Spróbuj ponownie'})).toBeInTheDocument();
});
it('clears debounce/search/data on logout and on a ready-to-ready account change',async()=>{
 const s=setup(),{result}=renderHook(()=>usePremiumEvents(s.manager,'owner'));await waitFor(()=>expect(result.current.discoveryEnabled).toBe(true));
 act(()=>result.current.selectGroup('public'));await waitFor(()=>expect(result.current.loading).toBe(false));s.call.mockClear();
 act(()=>{result.current.changeSearch('private');s.change('other');});expect(result.current.events).toEqual([]);expect(result.current.search).toBe('');
 await new Promise(r=>setTimeout(r,350));expect(s.call).not.toHaveBeenCalled();
 act(()=>s.change('','anonymous'));expect(result.current.groups).toEqual([]);expect(result.current.discoveryEnabled).toBe(false);
});
it('does not send overlong query, accepts whitespace and supports empty/error/retry',async()=>{
 let fail=false;const s=setup(async()=>{if(fail)throw Error('internal secret');return page([]);});
 const {result}=renderHook(()=>usePremiumEvents(s.manager,'owner'));await waitFor(()=>expect(result.current.discoveryEnabled).toBe(true));act(()=>result.current.selectGroup('public'));await waitFor(()=>expect(result.current.loading).toBe(false));
 s.call.mockClear();act(()=>result.current.changeSearch('x'.repeat(101)));expect(result.current.error).toContain('100');expect(s.call).not.toHaveBeenCalled();await act(()=>result.current.refresh());expect(s.call).not.toHaveBeenCalled();
 act(()=>result.current.changeSearch('   '));await waitFor(()=>expect(result.current.loading).toBe(false));expect(s.call).toHaveBeenCalledWith('matches_list',expect.objectContaining({query:'   '}));
 fail=true;await act(()=>result.current.refresh());expect(result.current.error).not.toContain('secret');fail=false;await act(()=>result.current.refresh());expect(result.current.error).toBe('');
 render(<PremiumEvents data={result.current} userId="owner" onGroups={()=>{}}/>);expect(screen.getByLabelText('Szukaj meczu lub grupy')).toBeInTheDocument();expect(screen.getByText('Brak meczów w tym widoku.')).toBeInTheDocument();
 fireEvent.change(screen.getByRole('combobox',{name:'Aktywna grupa'}),{target:{value:''}});
});

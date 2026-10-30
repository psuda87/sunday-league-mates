import { useCallback,useEffect,useRef,useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import { summary } from '../groups/contracts';
import type { GroupSummary } from '../groups/model';
import { matchDetail,matchList,matchError } from './premiumContracts';
import type { EventSummary,MatchDetail } from './premiumContracts';
import type { EventInput } from '../demo/eventDraft';

export function usePremiumEvents(manager:SessionManager,userId:string){
  const [events,setEvents]=useState<EventSummary[]>([]),[groups,setGroups]=useState<GroupSummary[]>([]),[detail,setDetail]=useState<MatchDetail|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[serverNow,setServerNow]=useState('');
  const [listFilter,setListFilter]=useState<'upcoming'|'history'|'mine'>('upcoming');
  const query=useRef<Record<string,string>>({scope:'all',period:'upcoming'});
  const [search,setSearch]=useState(''),[discoveryEnabled,setDiscoveryEnabled]=useState(false),[hasMore,setHasMore]=useState(false),[nextOffset,setNextOffset]=useState<number|null>(null);
  const debounce=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [memberCreationEnabled,setMemberCreationEnabled]=useState(false);
  const [activeGroup,setActiveGroup]=useState(''),[offset,setOffset]=useState(0),[creating,setCreating]=useState(false);
  const alive=useRef(true),epoch=useRef(0),detailEpoch=useRef(0),flight=useRef(false),refreshFlight=useRef<{key:string;promise:Promise<boolean>}|null>(null),keys=useRef(new Map<string,string>());
  const authorized=useCallback(()=>alive.current&&manager.getSnapshot().phase==='ready'&&manager.getSnapshot().session?.user_id===userId,[manager,userId]);
  const refresh=useCallback((page=0):Promise<boolean>=>{
    const values={...query.current},key=JSON.stringify([values,page]);
    if(refreshFlight.current?.key===key)return refreshFlight.current.promise;
    const ticket=++epoch.current;setLoading(true);setError('');
    const pending=(async()=>{
      try{
        if([...(values.query??'')].length>100)throw Error('Invalid search');
        const [a,b]=await Promise.all([manager.call('matches_list',{...values,offset:page}),manager.call<{groups:unknown[]}>('groups_list')]);
        const list=matchList(a,values.scope==='public'||values.scope==='groups',page);if(!Array.isArray(b.groups))throw Error('Invalid groups');const ownGroups=b.groups.map(summary);
        if(authorized()&&ticket===epoch.current&&values.scope==='group'&&!ownGroups.some(g=>g.id===values.group_id)){
          // Membership may have changed during background/resume or a group refresh.
          // Reset both the visible selector and its server query, then fetch the new scope.
          query.current={...query.current,scope:'all',group_id:''};setActiveGroup('');setEvents([]);setGroups(ownGroups);
          queueMicrotask(()=>{if(authorized())void refresh();});return true;
        }
        if(authorized()&&ticket===epoch.current){setEvents(list.events);setGroups(ownGroups);setDiscoveryEnabled(list.discovery);setHasMore(list.hasMore);setNextOffset(list.nextOffset);setMemberCreationEnabled(list.memberCreationEnabled);setServerNow(list.server_now);setOffset(page);setActiveGroup(previous=>['public','groups','mine'].includes(previous)||ownGroups.some(g=>g.id===previous)?previous:'');return true;}
        return false;
      }catch(e){if(authorized()&&ticket===epoch.current){setEvents([]);setGroups([]);setDetail(null);setError(matchError(e));}return false;}
      finally{if(alive.current&&ticket===epoch.current)setLoading(false);}
    })();const request={key,promise:pending};refreshFlight.current=request;
    void pending.finally(()=>{if(refreshFlight.current===request)refreshFlight.current=null;});return pending;
  },[manager,authorized]);
  const invalidate=useCallback(()=>{epoch.current++;detailEpoch.current++;refreshFlight.current=null;},[]);
  useEffect(()=>{alive.current=true;refreshFlight.current=null;query.current={scope:'all',period:'upcoming'};setSearch('');setActiveGroup('');setOffset(0);setListFilter('upcoming');setEvents([]);setGroups([]);setDetail(null);setDiscoveryEnabled(false);void refresh();const changed=()=>{invalidate();setDetail(null);setEvents([]);setOffset(0);void refresh();};window.addEventListener('slm-groups-changed',changed);return()=>{alive.current=false;invalidate();if(debounce.current)clearTimeout(debounce.current);window.removeEventListener('slm-groups-changed',changed);};},[refresh,invalidate]);
  // Native gallery continuation may keep the shell mounted while Auth rechecks.
  // Never reuse a pre-suspend roster after that check: memberships may have changed.
  useEffect(()=>{let previous=manager.getSnapshot();return manager.subscribe(()=>{
    const current=manager.getSnapshot(),phase=current.phase;if(phase===previous.phase&&current.session?.user_id===previous.session?.user_id)return;previous=current;
    if(phase!=='ready'||current.session?.user_id!==userId){invalidate();if(debounce.current)clearTimeout(debounce.current);query.current={scope:'all',period:'upcoming'};setSearch('');setActiveGroup('');setOffset(0);setListFilter('upcoming');setDiscoveryEnabled(false);setHasMore(false);setNextOffset(null);setEvents([]);setGroups([]);setDetail(null);setLoading(true);}
    else{refreshFlight.current=null;void refresh();}
  });},[manager,userId,refresh,invalidate]);
  const open=useCallback(async(id:string)=>{
    const ticket=++detailEpoch.current;setDetail(null);setLoading(true);setError('');setCreating(false);
    try{const d=matchDetail(await manager.call('matches_detail',{event_id:id}),id);if(authorized()&&ticket===detailEpoch.current){setDetail(d);setServerNow(d.server_now);return true;}return false;}
    catch(e){if(authorized()&&ticket===detailEpoch.current)setError(matchError(e));return false;}
    finally{if(alive.current&&ticket===detailEpoch.current)setLoading(false);}
  },[manager,authorized]);
  function back(){detailEpoch.current++;setDetail(null);setCreating(false);setError('');setNotice('');setLoading(false);}
  async function mutate<T>(action:string,values:Record<string,unknown>){
    const fingerprint=JSON.stringify([action,values]);let request=keys.current.get(fingerprint);
    if(!request){request=crypto.randomUUID();keys.current.set(fingerprint,request);}
    const result=await manager.call<T>(action,{...values,request_id:request});keys.current.delete(fingerprint);return result;
  }
  async function work(task:()=>Promise<void>){
    if(flight.current||!authorized())return false;flight.current=true;setBusy(true);setError('');setNotice('');
    try{await task();return true;}catch(e){if(authorized())setError(matchError(e));return false;}finally{flight.current=false;if(alive.current)setBusy(false);}
  }
  async function act(action:string,values:Record<string,unknown>={}){
    const id=detail?.event.id;if(!id)return false;
    return work(async()=>{await mutate('matches_'+action,{event_id:id,...values});if(!authorized())return;if(!await open(id)||!await refresh(offset))throw Error('Readback failed');if(authorized())setNotice('Zmiana została zapisana.');});
  }
  async function create(input:EventInput){
    await work(async()=>{
      const result=await mutate<{event_id:string}>('matches_create',{group_id:input.groupId,name:input.name.trim()||'Mecz',visibility:input.visibility,starts_at:input.startsAt,location:input.location,address:input.address,duration_minutes:input.durationMinutes,capacity:input.capacity,cost_cents:input.costCents});
      if(!authorized())return;setCreating(false);await refresh();await open(result.event_id);
    });
  }
  async function recheckFinancial(){const id=detail?.event.id;if(!id)return;const ticket=++detailEpoch.current;try{const d=matchDetail(await manager.call('matches_detail',{event_id:id}),id);if(authorized()&&ticket===detailEpoch.current)setDetail(d);}catch{if(authorized()){setDetail(null);setError('Nie potwierdzono uprawnień po zmianie finansów. Odśwież mecz.');}}}
  // New member creation is activated only by the versioned server contract.
  const organizers=memberCreationEnabled?groups:groups.filter(g=>g.admin_id===userId||g.organizer);
  function beginCreate(){back();if(organizers.length)setCreating(true);}
  function resetPage(){invalidate();if(debounce.current)clearTimeout(debounce.current);setOffset(0);setHasMore(false);setNextOffset(null);setEvents([]);}
  function selectGroup(id:string){back();resetPage();const next=['public','groups','mine'].includes(id)||groups.some(g=>g.id===id)?id:'';setActiveGroup(next);setSearch('');query.current={...query.current,scope:['public','groups','mine'].includes(next)?next:next?'group':'all',group_id:groups.some(g=>g.id===next)?next:''};delete query.current.query;void refresh();}
  function changeSearch(value:string){if(query.current.scope!=='public')return;resetPage();setSearch(value);query.current={...query.current,query:value};setLoading(true);setError('');if([...value].length>100){setLoading(false);setError('Wpisz najwyżej 100 znaków.');return;}debounce.current=setTimeout(()=>{debounce.current=null;if(authorized())void refresh();},300);}
  function changeFilter(value:'upcoming'|'history'|'mine'){resetPage();setListFilter(value);query.current={...query.current,period:value==='history'?'history':'upcoming'};if(value==='mine'){setActiveGroup('mine');setSearch('');delete query.current.query;query.current.scope='mine';}void refresh();}
  return {listFilter,changeFilter,search,changeSearch,discoveryEnabled,hasMore,nextOffset,recheckFinancial,events,groups,detail,loading,busy,error,notice,serverNow,activeGroup,offset,creating,organizers,refresh,open,back,act,create,beginCreate,selectGroup};
}
export type PremiumEventsController=ReturnType<typeof usePremiumEvents>;

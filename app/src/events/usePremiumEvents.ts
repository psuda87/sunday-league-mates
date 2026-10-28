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
  const [activeGroup,setActiveGroup]=useState(''),[offset,setOffset]=useState(0),[creating,setCreating]=useState(false);
  const alive=useRef(true),epoch=useRef(0),detailEpoch=useRef(0),flight=useRef(false),refreshFlight=useRef<Promise<boolean>|null>(null),keys=useRef(new Map<string,string>());
  const authorized=useCallback(()=>alive.current&&manager.getSnapshot().phase==='ready'&&manager.getSnapshot().session?.user_id===userId,[manager,userId]);
  const refresh=useCallback((page=0)=>{
    if(refreshFlight.current)return refreshFlight.current;
    const ticket=++epoch.current;setLoading(true);setError('');
    const pending=(async()=>{
      try{
        const [a,b]=await Promise.all([manager.call('matches_list',{offset:page}),manager.call<{groups:unknown[]}>('groups_list')]);
        const list=matchList(a);if(!Array.isArray(b.groups))throw Error('Invalid groups');const ownGroups=b.groups.map(summary);
        if(authorized()&&ticket===epoch.current){setEvents(list.events);setGroups(ownGroups);setServerNow(list.server_now);setOffset(page);setActiveGroup(previous=>ownGroups.some(g=>g.id===previous)?previous:'');return true;}
        return false;
      }catch(e){if(authorized()&&ticket===epoch.current){setEvents([]);setGroups([]);setDetail(null);setError(matchError(e));}return false;}
      finally{if(alive.current&&ticket===epoch.current)setLoading(false);}
    })();refreshFlight.current=pending;
    void pending.finally(()=>{if(refreshFlight.current===pending)refreshFlight.current=null;});return pending;
  },[manager,authorized]);
  const invalidate=useCallback(()=>{epoch.current++;detailEpoch.current++;},[]);
  useEffect(()=>{alive.current=true;refreshFlight.current=null;void refresh();const changed=()=>{detailEpoch.current++;setDetail(null);void refresh();};window.addEventListener('slm-groups-changed',changed);return()=>{alive.current=false;invalidate();window.removeEventListener('slm-groups-changed',changed);};},[refresh,invalidate]);
  // Native gallery continuation may keep the shell mounted while Auth rechecks.
  // Never reuse a pre-suspend roster after that check: memberships may have changed.
  useEffect(()=>{let previous=manager.getSnapshot().phase;return manager.subscribe(()=>{
    const phase=manager.getSnapshot().phase;if(phase===previous)return;previous=phase;
    if(phase!=='ready'){invalidate();setEvents([]);setGroups([]);setDetail(null);setLoading(true);}
    else{refreshFlight.current=null;void refresh();}
  });},[manager,refresh,invalidate]);
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
  const organizers=groups.filter(g=>g.admin_id===userId||g.organizer);
  function beginCreate(){back();if(organizers.length)setCreating(true);}
  function selectGroup(id:string){back();setActiveGroup(groups.some(g=>g.id===id)?id:'');}
  return {recheckFinancial,events,groups,detail,loading,busy,error,notice,serverNow,activeGroup,offset,creating,organizers,refresh,open,back,act,create,beginCreate,selectGroup};
}
export type PremiumEventsController=ReturnType<typeof usePremiumEvents>;

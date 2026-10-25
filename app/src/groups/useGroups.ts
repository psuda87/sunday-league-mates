import { useCallback,useEffect,useRef,useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import type { GroupWorld,GroupPerson } from '../demo/groups';
import type { GroupBinding,GroupDetail,GroupIdentity,GroupRequest,GroupSummary } from './model';
import { summary,details,requests,member } from './contracts';
import { normalizePolishPhone } from '../../supabase/functions/_shared/phone';

// Only real DTOs enter this legacy presentation shape. No initialWorld/reducer or fixtures.
const player=(id:string,name:string):GroupPerson=>({id,name,nick:name});
export function groupWorld(userId:string,groups:GroupSummary[],inbox:GroupRequest[],detail:GroupDetail|null):GroupWorld {
 const groupRows=new Map<string,GroupIdentity>(groups.map(g=>[g.id,g]));
 for(const request of inbox)if(!groupRows.has(request.group_id))groupRows.set(request.group_id,{id:request.group_id,name:request.group_name??'',description:'',admin_id:''});
 const players=new Map<string,GroupPerson>();
 const members=groups.filter(g=>g.id!==detail?.group.id).map(g=>({groupId:g.id,playerId:userId,organizer:g.organizer,joinedAt:''}));
 if(detail){groupRows.set(detail.group.id,detail.group);for(const m of detail.members){players.set(m.user_id,player(m.user_id,m.nickname));members.push({groupId:detail.group.id,playerId:m.user_id,organizer:m.organizer,joinedAt:m.joined_at});}}
 const requests=new Map([...inbox,...(detail?.requests??[])].map(r=>[r.id,r]));
 for(const r of requests.values()){
  if(r.actor_id&&r.actor_name&&!players.has(r.actor_id))players.set(r.actor_id,player(r.actor_id,r.actor_name));
  if(r.target_id&&r.target_name&&!players.has(r.target_id))players.set(r.target_id,player(r.target_id,r.target_name));
 }
 return {userId,players:[...players.values()],notice:'',groupState:{nextId:0,clock:0,
  groups:[...groupRows.values()].map(g=>({id:g.id,name:g.name,description:g.description,adminId:g.admin_id})),members,
  requests:[...requests.values()].map(r=>({id:r.id,groupId:r.group_id,kind:r.kind,status:r.state,targetId:r.target_id??(r.kind==='invite'||r.kind==='join'?userId:null),requestedBy:r.actor_id??userId,channel:r.target_id===null?'phone':'nick'}))}};
}
export function useGroups(manager:SessionManager,userId:string){
 const [state,setState]=useState<{groups:GroupSummary[];inbox:GroupRequest[];detail:GroupDetail|null}>({groups:[],inbox:[],detail:null});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[found,setFound]=useState<GroupBinding['found']>([]),[candidates,setCandidates]=useState<GroupBinding['candidates']>([]);
 const [searching,setSearching]=useState(false),[finding,setFinding]=useState(false);
 const alive=useRef(true),generation=useRef(0),searchEpoch=useRef(0),candidateEpoch=useRef(0),flight=useRef(false),selected=useRef<string|null>(window.location.hash.startsWith('#group/')?window.location.hash.slice(7):null),keys=useRef(new Map<string,string>());
 const fail=useCallback((e:unknown)=>{if(alive.current)setError(e instanceof Error?e.message:'Nie udało się potwierdzić danych grup.');},[]);
 const refresh=useCallback(async()=>{
  if(!alive.current)return;const ticket=++generation.current;setLoading(true);setError('');
  try {
   const [a,b]=await Promise.all([manager.call<{groups:GroupSummary[]}>('groups_list'),manager.call<{requests:GroupRequest[];outgoing?:GroupRequest[]}>('groups_inbox')]);
   if(!Array.isArray(a.groups)||!Array.isArray(b.requests))throw Error('Nieprawidłowy kontrakt grup.');
   const groups=a.groups.map(summary),inbox=[...requests(b.requests),...requests(b.outgoing??[])];
   let detail:GroupDetail|null=null;
   if(selected.current&&groups.some(g=>g.id===selected.current))detail=details(await manager.call('groups_detail',{group_id:selected.current}),selected.current,userId);
   if(alive.current&&ticket===generation.current)setState({groups,inbox,detail});
  } catch(e){if(ticket===generation.current){setState({groups:[],inbox:[],detail:null});fail(e);}}
  finally {if(alive.current&&ticket===generation.current)setLoading(false);}
 },[manager,userId,fail]);
 // Coalesce manual refreshes synchronously, before React disables the button.
 const manualFlight=useRef<Promise<void>|null>(null);
 const manualRefresh=useCallback(()=>{
  if(manualFlight.current)return manualFlight.current;
  const pending=refresh();manualFlight.current=pending;
  void pending.finally(()=>{if(manualFlight.current===pending)manualFlight.current=null;});return pending;
 },[refresh]);
 const invalidate=useCallback(()=>{generation.current++;searchEpoch.current++;candidateEpoch.current++;},[]);
 useEffect(()=>{alive.current=true;void refresh();return()=>{alive.current=false;invalidate();};},[refresh,userId,invalidate]);
 const mutate=async<T,>(action:string,body:Record<string,unknown>)=>{
  const fingerprint=JSON.stringify([action,body]);let key=keys.current.get(fingerprint);if(!key){key=crypto.randomUUID();keys.current.set(fingerprint,key);}
  const result=await manager.call<T>(action,{...body,request_id:key});keys.current.delete(fingerprint);return result;
 };
 async function work<T>(task:()=>Promise<T>):Promise<T|null>{
  if(flight.current||manager.getSnapshot().phase!=='ready'||manager.getSnapshot().session?.user_id!==userId)return null;
  flight.current=true;setBusy(true);setError('');
  try{const value=await task();return alive.current&&manager.getSnapshot().phase==='ready'&&manager.getSnapshot().session?.user_id===userId?value:null;}
  catch(e){fail(e);return null;}finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 const search=useCallback((query:string)=>{
  const ticket=++searchEpoch.current;setFound([]);setSearching(query.trim().length>=2);if(query.trim().length<2)return;
  void manager.call<{groups:(GroupSummary&{member_count:number})[]}>('groups_search',{query}).then(r=>{if(alive.current&&ticket===searchEpoch.current)setFound(r.groups.map(g=>({id:g.id,name:g.name,description:g.description,count:g.member_count})));}).catch(e=>{if(ticket===searchEpoch.current)fail(e);}).finally(()=>{if(alive.current&&ticket===searchEpoch.current)setSearching(false);});
 },[manager,fail]);
 const findPlayers=useCallback((id:string,query:string)=>{
  const ticket=++candidateEpoch.current;setCandidates([]);setFinding(query.trim().length>=2);if(query.trim().length<2)return;
  void manager.call<{players:{id:string;name:string}[]}>('groups_candidates',{group_id:id,query}).then(r=>{if(alive.current&&ticket===candidateEpoch.current)setCandidates(r.players);}).catch(e=>{if(ticket===candidateEpoch.current)fail(e);}).finally(()=>{if(alive.current&&ticket===candidateEpoch.current)setFinding(false);});
 },[manager,fail]);
 const binding:GroupBinding={loading,busy,error,searching,finding,found,candidates,search,findPlayers,refresh:manualRefresh,
  counts:Object.fromEntries(state.groups.map(g=>[g.id,g.member_count])),pending:Object.fromEntries(state.groups.map(g=>[g.id,g.pending_count])),
  requestPhones:Object.fromEntries((state.detail?.requests??[]).filter(r=>!!r.contact_phone).map(r=>[r.id,r.contact_phone!])),
  shareFullName:state.detail?.members.find(m=>m.user_id===userId)?.share_full_name??false,
  open:async id=>{selected.current=id;setCandidates([]);await refresh();},
  create:async(name,description,key)=>work(async()=>{const r=await mutate<{group_id:string}>('groups_create',{name,description,request_id:key});selected.current=r.group_id;await refresh();return r.group_id;}),
  consent:share=>{void work(async()=>{await mutate('groups_consent',{group_id:state.detail!.group.id,share_full_name:share});await refresh();});},
  act:action=>{void work(async()=>{
   if(action.type==='group_create')return;const body:Record<string,unknown>={};let operation:string;
   if(action.type==='group_decide'||action.type==='group_cancel'){body.id=action.requestId;operation=action.type==='group_decide'?'decide':'cancel_request';if(action.type==='group_decide')body.accept=action.accept;}
   else {body.group_id=action.groupId;operation=action.type.slice(6);
    if('targetId'in action)body.user_id=action.targetId;
    if(action.type==='group_permission')body.organizer=action.allow;
    if(action.type==='group_phone')body.phone=normalizePolishPhone(action.phone);
   }
   await mutate('groups_'+operation,body);if(action.type==='group_leave')selected.current=null;await refresh();
  });},
 };
 const readMember=async(id:string,groupId:string)=>{const m=member(await manager.call('groups_profile',{group_id:groupId,user_id:id}));if(m.user_id!==id)throw Error('Nieprawidłowy profil.');return m;};
 return {world:groupWorld(userId,state.groups,state.inbox,state.detail),binding,readMember};
}

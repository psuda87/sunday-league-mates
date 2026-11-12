import { useCallback,useEffect,useRef,useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import { account,detail,paymentRoster } from './contracts';
import type { Account,Detail,Receipt,PlayerAccount,PaymentEvent } from './contracts';
import { AccountError } from '../auth/api';
// Preserve an uncertain intent across view navigation in this authenticated RAM session.
const intents=new WeakMap<SessionManager,{owner:string;keys:Map<string,string>;watching:boolean}>();
function requestRegistry(manager:SessionManager,owner:string){let entry=intents.get(manager);if(!entry){entry={owner,keys:new Map(),watching:false};intents.set(manager,entry);}if(entry.owner!==owner){entry.keys.clear();entry.owner=owner;}return entry;}
export function usePremiumFinance(manager:SessionManager,userId:string,groupId:string,eventId?:string,manage=false,onChanged?:()=>void,adminView=true,refreshVersion=0){
 const scope=`${userId}:${groupId}:${eventId??''}:${manage}`,currentScope=useRef(scope);currentScope.current=scope;
 const empty={scope,own:null,detail:null,pending:[],names:{},players:[],events:[]};
 const [state,setState]=useState<{scope:string;own:Account|null;detail:Detail|null;pending:Receipt[];names:Record<string,string>;players:PlayerAccount[];events:PaymentEvent[]}>(empty),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const registry=requestRegistry(manager,userId);
 const alive=useRef(true),generation=useRef(0),flight=useRef(false),keys=useRef(registry.keys);keys.current=registry.keys;
 // A data-only observer lives with this manager, not with an individual screen.
 // Logout must clear uncertain intents even after navigating away from Finance.
 // Network unavailability keeps them for a verified session resume and safe retry.
 useEffect(()=>{if(registry.watching)return;registry.watching=true;manager.subscribe(()=>{
  const auth=manager.getSnapshot();if(auth.phase==='signed_out'||auth.phase==='storage_error'||auth.session&&auth.session.user_id!==registry.owner)registry.keys.clear();
 });},[manager,registry]);
 const valid=useCallback(()=>alive.current&&currentScope.current===scope&&manager.getSnapshot().phase==='ready'&&manager.getSnapshot().session?.user_id===userId,[manager,userId,scope]);
 const reload=useCallback(async()=>{
  const ticket=++generation.current;setLoading(true);setError('');setState({scope,own:null,detail:null,pending:[],names:{},players:[],events:[]});
  try{const own=account(await manager.call('group_finance_account',{group_id:groupId}),groupId,userId);
   const event=eventId&&manage&&own.surplus!==null?detail(await manager.call('group_finance_detail',{group_id:groupId,event_id:eventId}),groupId,eventId):null;
   const names:Record<string,string>={};
   const board=adminView&&own.surplus!==null?paymentRoster(await manager.call('group_finance_roster',{group_id:groupId,...(eventId?{event_id:eventId}:{})}),groupId):null;
   for(const p of board?.players??[])names[p.user_id]=p.name;
   const pending=board?board.players.flatMap(p=>p.account.payments.filter(r=>r.status==='pending')):[];
   if(valid()&&generation.current===ticket){setState({scope,own,detail:event,pending,names,players:board?.players??[],events:board?.events??[]});return true;}return false;
  }catch{if(valid()&&generation.current===ticket)setError('Nie udało się potwierdzić rozliczeń. Odśwież i spróbuj ponownie.');return false;}
  finally{if(alive.current&&generation.current===ticket)setLoading(false);}
 },[manager,userId,groupId,eventId,manage,valid,scope,adminView]);
 useEffect(()=>{alive.current=true;void reload();return()=>{alive.current=false;};},[reload,refreshVersion]);
 useEffect(()=>{const changed=()=>{void reload();};window.addEventListener('slm-groups-changed',changed);return()=>window.removeEventListener('slm-groups-changed',changed);},[reload]);
 useEffect(()=>{let previous=manager.getSnapshot().phase;return manager.subscribe(()=>{const phase=manager.getSnapshot().phase;if(phase===previous)return;previous=phase;if(phase==='signed_out'||phase==='storage_error')keys.current.clear();if(phase!=='ready'){generation.current++;setState({scope,own:null,detail:null,pending:[],names:{},players:[],events:[]});setLoading(true);}else void reload();});},[manager,reload,scope]);
 async function mutate(action:string,body:Record<string,unknown>){
  if(flight.current||!valid())return false;flight.current=true;setBusy(true);setError('');setNotice('');
  const reasons:Record<string,string>={submit_payment:'Zgłoszenie wpłaty przez zawodnika',record_payment:'Wpłata oznaczona przez administratora',accept_payment:'Akceptacja zgłoszonej wpłaty',reject_payment:'Odrzucenie zgłoszonej wpłaty',cancel_payment:'Anulowanie zatwierdzonej wpłaty',approve:'Zatwierdzenie rozliczenia zakończonego meczu'};
  body={...body,reason:typeof body.reason==='string'&&body.reason.trim()?body.reason:reasons[action]??'Operacja płatności'};
  const fingerprint=JSON.stringify([userId,groupId,action,body]);let id=keys.current.get(fingerprint);if(!id){id=crypto.randomUUID();keys.current.set(fingerprint,id);}
  try{const ack=await manager.call<{ok?:boolean;group_id?:string}>('group_finance_'+action,{...body,group_id:groupId,request_id:id});if(ack?.ok!==true||ack.group_id!==groupId)throw Error('Invalid write acknowledgement');if(!valid())return false;if(!await reload()||!valid())return false;keys.current.delete(fingerprint);setNotice('Operacja potwierdzona i dane odczytane z serwera.');onChanged?.();return true;}
  catch(e){if(valid()){const code=e instanceof AccountError?e.code:'';setError(code==='match_not_finished'?'Mecz jeszcze się nie zakończył. Zatwierdzenie rozliczenia będzie możliwe po planowanym końcu meczu.':code==='stale_version'||code==='payment_processed'?'Dane zostały zmienione. Odśwież przed kolejną decyzją.':code==='already_approved'?'Ten mecz został już zatwierdzony. Odśwież rozliczenie.':code==='forbidden'?'Nie masz uprawnień do zatwierdzenia tego meczu.':code==='event_cancelled'?'Nie można zatwierdzić odwołanego meczu.':'Nie udało się potwierdzić operacji. Odśwież dane i sprawdź stan rozliczenia przed ponowną próbą; identyfikator żądania został zachowany.');}return false;}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 const visible=state.scope===scope&&valid();
 return {...state,own:visible?state.own:null,detail:visible?state.detail:null,pending:visible?state.pending:[],names:visible?state.names:{},players:visible?state.players:[],events:visible?state.events:[],loading,busy,error,notice,reload,mutate};
}

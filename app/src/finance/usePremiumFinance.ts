import { useCallback,useEffect,useRef,useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import { account,detail,receipts } from './contracts';
import type { Account,Detail,Receipt } from './contracts';
import { AccountError } from '../auth/api';
// Preserve an uncertain intent across view navigation in this authenticated RAM session.
const intents=new WeakMap<SessionManager,{owner:string;keys:Map<string,string>}>();
function requestKeys(manager:SessionManager,owner:string){let entry=intents.get(manager);if(!entry||entry.owner!==owner){entry={owner,keys:new Map()};intents.set(manager,entry);}return entry.keys;}
export function usePremiumFinance(manager:SessionManager,userId:string,groupId:string,eventId?:string,manage=false,onChanged?:()=>void){
 const scope=`${userId}:${groupId}:${eventId??''}:${manage}`,currentScope=useRef(scope);currentScope.current=scope;
 const [state,setState]=useState<{scope:string;own:Account|null;detail:Detail|null;pending:Receipt[];names:Record<string,string>}>({scope,own:null,detail:null,pending:[],names:{}}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const registry=requestKeys(manager,userId);
 const alive=useRef(true),generation=useRef(0),flight=useRef(false),keys=useRef(registry);keys.current=registry;
 const valid=useCallback(()=>alive.current&&currentScope.current===scope&&manager.getSnapshot().phase==='ready'&&manager.getSnapshot().session?.user_id===userId,[manager,userId,scope]);
 const reload=useCallback(async()=>{
  const ticket=++generation.current;setLoading(true);setError('');setState({scope,own:null,detail:null,pending:[],names:{}});
  try{const own=account(await manager.call('group_finance_account',{group_id:groupId}),groupId,userId);
   const event=eventId&&manage?detail(await manager.call('group_finance_detail',{group_id:groupId,event_id:eventId}),groupId,eventId):null;
   const names:Record<string,string>={};
   if(own.surplus!==null||event) {const g=await manager.call<{members:{user_id:string;nickname:string;display_name?:string}[]}>('groups_detail',{group_id:groupId});if(!Array.isArray(g.members))throw Error('Missing payer identities');for(const m of g.members){const label=m.display_name??m.nickname;if(typeof m.user_id!=='string'||typeof label!=='string'||!label.trim())throw Error('Invalid identity');names[m.user_id]=label;}}
   const pending=own.surplus!==null?receipts(await manager.call('group_finance_pending',{group_id:groupId}),groupId):event?.payments.filter(p=>p.status==='pending')??[];
   if(valid()&&generation.current===ticket){setState({scope,own,detail:event,pending,names});return true;}return false;
  }catch{if(valid()&&generation.current===ticket)setError('Nie udało się potwierdzić rozliczeń. Odśwież i spróbuj ponownie.');return false;}
  finally{if(alive.current&&generation.current===ticket)setLoading(false);}
 },[manager,userId,groupId,eventId,manage,valid,scope]);
 useEffect(()=>{alive.current=true;void reload();return()=>{alive.current=false;};},[reload]);
 useEffect(()=>{let previous=manager.getSnapshot().phase;return manager.subscribe(()=>{const phase=manager.getSnapshot().phase;if(phase===previous)return;previous=phase;if(phase==='signed_out'||phase==='storage_error')keys.current.clear();if(phase!=='ready'){generation.current++;setState({scope,own:null,detail:null,pending:[],names:{}});setLoading(true);}else void reload();});},[manager,reload,scope]);
 async function mutate(action:string,body:Record<string,unknown>){
  if(flight.current||!valid())return false;flight.current=true;setBusy(true);setError('');setNotice('');
  const fingerprint=JSON.stringify([userId,groupId,action,body]);let id=keys.current.get(fingerprint);if(!id){id=crypto.randomUUID();keys.current.set(fingerprint,id);}
  try{const ack=await manager.call<{ok?:boolean;group_id?:string}>('group_finance_'+action,{...body,group_id:groupId,request_id:id});if(ack?.ok!==true||ack.group_id!==groupId)throw Error('Invalid write acknowledgement');if(!valid())return false;if(!await reload()||!valid())return false;keys.current.delete(fingerprint);setNotice('Operacja potwierdzona i dane odczytane z serwera.');onChanged?.();return true;}
  catch(e){if(valid()){const code=e instanceof AccountError?e.code:'';setError(code==='stale_version'||code==='payment_processed'?'Dane zostały zmienione. Odśwież przed kolejną decyzją.':'Nie potwierdzono operacji. Po błędzie sieci ponów tę samą operację; identyfikator żądania zostanie zachowany.');}return false;}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 const visible=state.scope===scope&&valid();
 return {...state,own:visible?state.own:null,detail:visible?state.detail:null,pending:visible?state.pending:[],names:visible?state.names:{},loading,busy,error,notice,reload,mutate};
}

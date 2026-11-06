import {useEffect,useState,useSyncExternalStore} from 'react';
import {IonIcon} from '@ionic/react';
import {notificationsOutline} from 'ionicons/icons';
import type {SessionManager} from '../auth/sessionManager';
import {summary} from './contracts';
import type {GroupSummary} from './model';
import './GroupControls.css';

export default function GroupNotifications({manager,userId,onGroups,refreshKey}:{manager:SessionManager;userId:string;onGroups:()=>void;refreshKey:boolean}){
 const auth=useSyncExternalStore(manager.subscribe,manager.getSnapshot);
 const [groups,setGroups]=useState<GroupSummary[]>([]),[open,setOpen]=useState(false),[error,setError]=useState(false);

 useEffect(()=>{
  let alive=true,epoch=0;
  async function refresh(){
   const ticket=++epoch,session=manager.getSnapshot().session;
   setGroups([]);setError(false);
   if(manager.getSnapshot().phase!=='ready'||session?.user_id!==userId)return;
   try{
    const result=await manager.call<{groups:GroupSummary[]}>('groups_list');
    const rows=result.groups.map(summary).filter(g=>g.admin_id===userId&&g.pending_count>0);
    if(alive&&ticket===epoch&&manager.getSnapshot().session===session)setGroups(rows);
   }catch{if(alive&&ticket===epoch)setError(true);}
  }
  void refresh();window.addEventListener('slm-groups-changed',refresh);
  return()=>{alive=false;epoch++;window.removeEventListener('slm-groups-changed',refresh);};
 },[manager,userId,auth.session,auth.phase,refreshKey]);
 const total=groups.reduce((n,g)=>n+g.pending_count,0);
 return <aside className="slm-group-notifications" aria-label="Powiadomienia grup">
  <button type="button" className="slm-group-bell" aria-label={`Oczekujące zgłoszenia do grup: ${total}`} aria-expanded={open} onClick={()=>setOpen(!open)}><IonIcon icon={notificationsOutline} aria-hidden="true"/>{total>0&&<span className="slm-group-count">{total}</span>}</button>
  {open&&<section aria-label="Oczekujące zgłoszenia"><h2>Prośby do Twoich grup</h2>{error?<p role="alert">Nie udało się odczytać zgłoszeń. Odśwież mecze.</p>:total===0?<p>Brak oczekujących zgłoszeń.</p>:<ul>{groups.map(g=><li key={g.id}><button type="button" onClick={()=>{setOpen(false);onGroups();window.location.hash=`group/${g.id}`;}}><strong>{g.name}</strong><span>Oczekujące: {g.pending_count}</span></button></li>)}</ul>}</section>}
 </aside>;
}

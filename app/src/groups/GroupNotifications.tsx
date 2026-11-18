import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {IonIcon} from '@ionic/react';
import {notificationsOutline} from 'ionicons/icons';
import type {SessionManager} from '../auth/sessionManager';
import {summary} from './contracts';
import type {GroupSummary} from './model';
import {paymentWallet} from '../finance/contracts';
import {outstandingMatches,paidRegistrationBlocked} from '../finance/paymentModel';
import type {OutstandingMatch} from '../finance/paymentModel';
import {financeChangedEvent,requestOwnPayments} from '../finance/paymentsIntent';
import {formatCents} from '../settlements/model';
import {matchDate} from '../events/model';
import {useOwnBadgeNotices} from '../badges/BadgesProvider';
import {requestOwnBadges} from '../badges/badgeContracts';
import {BADGES} from '../badges/catalog';
import PushSection from '../notifications/PushSection';
import {usePushState} from '../notifications/usePushState';
import {OPEN_BELL_EVENT} from '../notifications/shared';
import './GroupControls.css';

// One bell for everyone: own outstanding match payments plus, for group admins, pending join requests.
export default function GroupNotifications({manager,userId,onGroups,refreshKey,onPayments,onBadges}:{manager:SessionManager;userId:string;onGroups:()=>void;refreshKey:boolean;onPayments?:()=>void;onBadges?:()=>void}){
 const badgeNotices=useOwnBadgeNotices();
 const auth=useSyncExternalStore(manager.subscribe,manager.getSnapshot);
 const [groups,setGroups]=useState<GroupSummary[]>([]),[open,setOpen]=useState(false),[error,setError]=useState(false);
 const [dues,setDues]=useState<OutstandingMatch[]>([]),[blocked,setBlocked]=useState(false);
 const bell=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null);
 const [panelTop,setPanelTop]=useState(0);
 const pushState=usePushState(manager);
 useEffect(()=>{const show=()=>setOpen(true);window.addEventListener(OPEN_BELL_EVENT,show);return()=>window.removeEventListener(OPEN_BELL_EVENT,show);},[]);

 useEffect(()=>{
  let alive=true,epoch=0;
  async function refresh(){
   const ticket=++epoch,session=manager.getSnapshot().session;
   setGroups([]);setError(false);setDues([]);setBlocked(false);
   if(manager.getSnapshot().phase!=='ready'||session?.user_id!==userId)return;
   const current=()=>alive&&ticket===epoch&&manager.getSnapshot().session===session;
   // A failed payment read never hides admin requests; the reminder simply stays empty.
   void manager.call('group_finance_wallet').then(value=>{const wallet=paymentWallet(value,userId);if(current()){setDues(outstandingMatches(wallet));setBlocked(paidRegistrationBlocked(wallet));}}).catch(()=>undefined);
   try{
    const result=await manager.call<{groups:GroupSummary[]}>('groups_list');
    const rows=result.groups.map(summary).filter(g=>(g.admin_id===userId||g.admin===true)&&g.pending_count>0);
    if(alive&&ticket===epoch&&manager.getSnapshot().session===session)setGroups(rows);
   }catch{if(alive&&ticket===epoch)setError(true);}
  }
  void refresh();window.addEventListener('slm-groups-changed',refresh);window.addEventListener(financeChangedEvent,refresh);
  return()=>{alive=false;epoch++;window.removeEventListener('slm-groups-changed',refresh);window.removeEventListener(financeChangedEvent,refresh);};
 },[manager,userId,auth.session,auth.phase,refreshKey]);
 useEffect(()=>{
  if(!open)return;
  const position=()=>setPanelTop(Math.max(8,Math.min((bell.current?.getBoundingClientRect().bottom??0)+8,window.innerHeight-96)));
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!bell.current?.contains(event.target)&&!panel.current?.contains(event.target))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);bell.current?.focus();}};
  position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 const requests=groups.reduce((n,g)=>n+g.pending_count,0),total=requests+dues.length+badgeNotices.bell.length;
 const badgeLabel=badgeNotices.bell.length?`, nowe odznaki: ${badgeNotices.bell.length}`:'';
 const label=dues.length?`Powiadomienia: ${total}. Zaległe płatności: ${dues.length}${requests?`, prośby do grup: ${requests}`:''}${badgeLabel}`:`Oczekujące zgłoszenia do grup: ${requests}${badgeLabel}`;
 const needsPush=pushState.supported&&!pushState.enabled&&!pushState.denied;
 const admin=groups.length>0||error;
 return <aside className="slm-group-notifications" aria-label="Powiadomienia">
  <button ref={bell} type="button" className="slm-group-bell" aria-label={needsPush?label+'. Włącz powiadomienia na telefonie':label} aria-expanded={open} onClick={()=>setOpen(!open)}><IonIcon icon={notificationsOutline} aria-hidden="true"/>{total>0&&<span className="slm-group-count">{total}</span>}{total===0&&needsPush&&<span className="slm-group-dot" aria-hidden="true"/>}</button>
  {open&&createPortal(<section ref={panel} className="slm-group-notification-panel" style={{top:panelTop}} aria-label="Powiadomienia">
   <PushSection manager={manager}/>
   {dues.length>0&&<div className="slm-payment-reminder"><h2>Zaległe płatności</h2><ul>{dues.map(d=><li key={`${d.group_id}:${d.event_id}`}><span><strong>{d.name??'Mecz'}</strong> · {d.group_name}</span><span>{matchDate(d.starts_at)} · do zapłaty {formatCents(d.outstanding_cents)}</span></li>)}</ul>
    <p className="slm-payment-reminder-warning" role="note">{blocked?'⚠ Zapisy na płatne mecze są zablokowane do czasu wpłaty.':dues.length===1?'Druga zaległość zablokuje zapisy na płatne mecze.':'⚠ Dwie zaległości mogą zablokować zapisy na płatne mecze.'}</p>
    {onPayments&&<button type="button" className="slm-payment-reminder-cta" onClick={()=>{setOpen(false);requestOwnPayments();onPayments();}}>Zgłoś wpłatę</button>}</div>}
   {badgeNotices.bell.length>0&&<div className="slm-badge-notices"><h2>Odznaki</h2><ul>{badgeNotices.bell.map(b=><li key={`${b.code}:${b.group_id??''}:${b.season??''}`}><button type="button" onClick={()=>{setOpen(false);badgeNotices.dismiss();requestOwnBadges();onBadges?.();}}><strong>Nowa odznaka: {BADGES.find(d=>d.code===b.code)?.name??b.code}</strong><span>{[b.group_name,b.season,matchDate(b.earned_at)].filter(Boolean).join(' · ')}</span></button></li>)}</ul></div>}
   {(admin||dues.length===0)&&<><h2>Prośby do Twoich grup</h2>{error?<p role="alert">Nie udało się odczytać zgłoszeń. Odśwież mecze.</p>:requests===0?<p>Brak oczekujących zgłoszeń.</p>:<ul>{groups.map(g=><li key={g.id}><button type="button" onClick={()=>{setOpen(false);onGroups();window.location.hash=`group/${g.id}`;}}><strong>{g.name}</strong><span>Oczekujące: {g.pending_count}</span></button></li>)}</ul>}</>}
  </section>,document.body)}
 </aside>;
}

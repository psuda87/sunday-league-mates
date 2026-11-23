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
import {ARCHIVE_AFTER_MS} from '../notifications/NotificationArchive';
import NotificationDialog from '../notifications/NotificationDialog';
import type {InboxItem} from '../notifications/NotificationDialog';
import {NOTIFICATIONS_EVENT,OPEN_BELL_EVENT,takeBellRequest} from '../notifications/shared';
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
 const [inbox,setInbox]=useState<InboxItem[]>([]),[unread,setUnread]=useState(0);
 const [selected,setSelected]=useState<InboxItem|null>(null),[archiving,setArchiving]=useState(false),[archiveError,setArchiveError]=useState(false);
 useEffect(()=>{
  let alive=true;
  async function load(){
   const session=manager.getSnapshot().session;
   if(manager.getSnapshot().phase!=='ready'||session?.user_id!==userId)return;
   try{
    const r=await manager.call<{notifications?:InboxItem[];unread?:number}>('notifications_list',{offset:0});
    if(alive&&Array.isArray(r?.notifications)){const recent=r.notifications.filter(n=>!n.archived_at&&Date.parse(n.created_at)>=Date.now()-ARCHIVE_AFTER_MS);setInbox(recent.slice(0,10));setUnread(recent.filter(n=>!n.read_at).length);}
   }catch{/* Lista w dzwonku jest dodatkiem; błąd nie blokuje reszty. */}
  }
  void load();window.addEventListener(NOTIFICATIONS_EVENT,load);
  return()=>{alive=false;window.removeEventListener(NOTIFICATIONS_EVENT,load);};
 },[manager,userId,auth.session,auth.phase,open]);
 function openItem(n:InboxItem){
  setArchiveError(false);setSelected(n);
  if(n.read_at)return;
  const now=new Date().toISOString();
  setInbox(list=>list.map(x=>x.id===n.id?{...x,read_at:now}:x));setUnread(count=>Math.max(0,count-1));
  void manager.call('notifications_read',{notification_id:n.id}).catch(()=>{/* Ponowne wczytanie listy przywróci stan z serwera. */});
 }
 async function archiveSelected(){
  if(!selected||archiving)return;
  setArchiving(true);setArchiveError(false);
  try{
   await manager.call('notifications_archive',{notification_id:selected.id});
   const id=selected.id;setInbox(list=>list.filter(x=>x.id!==id));setSelected(null);
   window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
  }catch{setArchiveError(true);}finally{setArchiving(false);}
 }
 async function markAllRead(){try{await manager.call('notifications_read_all');}catch{/* Ponowna próba przy następnym otwarciu. */}window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));}
 useEffect(()=>{const show=()=>{takeBellRequest();setOpen(true);};if(takeBellRequest())setOpen(true);window.addEventListener(OPEN_BELL_EVENT,show);return()=>window.removeEventListener(OPEN_BELL_EVENT,show);},[]);

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
  const outside=(event:PointerEvent)=>{if(event.target instanceof Element&&event.target.closest('.slm-notification-dialog-backdrop'))return;if(event.target instanceof Node&&!bell.current?.contains(event.target)&&!panel.current?.contains(event.target))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);bell.current?.focus();}};
  position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 const requests=groups.reduce((n,g)=>n+g.pending_count,0),total=requests+dues.length+badgeNotices.bell.length+unread;
 const badgeLabel=badgeNotices.bell.length?`, nowe odznaki: ${badgeNotices.bell.length}`:'';
 const label=dues.length?`Powiadomienia: ${total}. Zaległe płatności: ${dues.length}${requests?`, prośby do grup: ${requests}`:''}${badgeLabel}`:`Oczekujące zgłoszenia do grup: ${requests}${badgeLabel}`;
 const needsPush=pushState.supported&&!pushState.enabled&&!pushState.denied;
 const admin=groups.length>0||error;
 return <aside className="slm-group-notifications" aria-label="Powiadomienia">
  <button ref={bell} type="button" className="slm-group-bell" aria-label={(unread?label+'. Nowe powiadomienia: '+unread:label)+(needsPush?'. Włącz powiadomienia na telefonie':'')} aria-expanded={open} onClick={()=>setOpen(!open)}><IonIcon icon={notificationsOutline} aria-hidden="true"/>{total>0&&<span className="slm-group-count">{total}</span>}{total===0&&needsPush&&<span className="slm-group-dot" aria-hidden="true"/>}</button>
  {open&&createPortal(<section ref={panel} className="slm-group-notification-panel" style={{top:panelTop}} aria-label="Powiadomienia">
   <PushSection manager={manager}/>
   {inbox.length>0&&<div className="slm-inbox"><h2>Ostatnie powiadomienia</h2><ul>{inbox.map(n=><li key={n.id} className={n.read_at?undefined:'slm-inbox-unread'}><button type="button" className="slm-inbox-open" onClick={()=>openItem(n)}><strong>{n.title}</strong><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString('pl-PL',{dateStyle:'short',timeStyle:'short'})}</time></button></li>)}</ul>
    {unread>0&&<button type="button" onClick={()=>void markAllRead()}>Oznacz jako przeczytane</button>}</div>}
   {dues.length>0&&<div className="slm-payment-reminder"><h2>Zaległe płatności</h2><ul>{dues.map(d=><li key={`${d.group_id}:${d.event_id}`}><span><strong>{d.name??'Mecz'}</strong> · {d.group_name}</span><span>{matchDate(d.starts_at)} · do zapłaty {formatCents(d.outstanding_cents)}</span></li>)}</ul>
    <p className="slm-payment-reminder-warning" role="note">{blocked?'⚠ Zapisy na płatne mecze są zablokowane do czasu wpłaty.':dues.length===1?'Druga zaległość zablokuje zapisy na płatne mecze.':'⚠ Dwie zaległości mogą zablokować zapisy na płatne mecze.'}</p>
    {onPayments&&<button type="button" className="slm-payment-reminder-cta" onClick={()=>{setOpen(false);requestOwnPayments();onPayments();}}>Zgłoś wpłatę</button>}</div>}
   {badgeNotices.bell.length>0&&<div className="slm-badge-notices"><h2>Odznaki</h2><ul>{badgeNotices.bell.map(b=><li key={`${b.code}:${b.group_id??''}:${b.season??''}`}><button type="button" onClick={()=>{setOpen(false);badgeNotices.dismiss();requestOwnBadges();onBadges?.();}}><strong>Nowa odznaka: {BADGES.find(d=>d.code===b.code)?.name??b.code}</strong><span>{[b.group_name,b.season,matchDate(b.earned_at)].filter(Boolean).join(' · ')}</span></button></li>)}</ul></div>}
   {(admin||dues.length===0)&&<><h2>Prośby do Twoich grup</h2>{error?<p role="alert">Nie udało się odczytać zgłoszeń. Odśwież mecze.</p>:requests===0?<p>Brak oczekujących zgłoszeń.</p>:<ul>{groups.map(g=><li key={g.id}><button type="button" onClick={()=>{setOpen(false);onGroups();window.location.hash=`group/${g.id}`;}}><strong>{g.name}</strong><span>Oczekujące: {g.pending_count}</span></button></li>)}</ul>}</>}
  </section>,document.body)}
  {selected&&<NotificationDialog item={selected} busy={archiving} error={archiveError} onArchive={()=>void archiveSelected()} onClose={()=>setSelected(null)}/>}
 </aside>;
}

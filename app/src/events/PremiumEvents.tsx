import GroupNotifications from '../groups/GroupNotifications';
import GuestForm from './GuestForm';
import { visiblePremiumEvents } from './eventFilters';
import PremiumScrollHeader from './PremiumScrollHeader';
import PremiumFinance from '../finance/PremiumFinance';
import PremiumGroupFinance from '../finance/PremiumGroupFinance';
import type { SessionManager } from '../auth/sessionManager';
import { useEffect,useRef,useState } from 'react';
import { IonButton,IonIcon } from '@ionic/react';
import { refreshOutline } from 'ionicons/icons';
import MatchHero from '../ui/MatchHero';
import MatchFilters from '../ui/MatchFilters';
import type { MatchFilter } from '../ui/MatchFilters';
import MatchTabs from '../ui/MatchTabs';
import PremiumTeams from './PremiumTeams';
import LineupPlayerProfile from './LineupPlayerProfile';
import { EventPrivacy } from '../demo/EventAccessView';
import './premiumEvents.css';
import ParticipantGroup,{ RosterSummary } from '../ui/ParticipantGroup';
import EventForm from '../demo/EventForm';
import { useFrozenBack } from '../native/frozenDemoAndroid';
import { heroMatch } from './premiumContracts';
import type { MatchEntry,EventSummary } from './premiumContracts';
import { premiumDefaults,premiumEventInput } from './premiumForm';
import type { PremiumEventsController } from './usePremiumEvents';
import { matchDate,money } from './model';

export default function PremiumEvents(props:Parameters<typeof PremiumEventsScreen>[0]){
  return <>{props.data.revalidating&&<section role="status"><p>{props.data.error||'Potwierdzanie dostępu do bieżącego widoku…'}</p><button type="button" onClick={()=>{void props.data.revalidate();}}>Ponów odczyt widoku</button></section>}<div hidden={props.data.revalidating}><PremiumEventsScreen {...props}/></div></>;
}
function PremiumEventsScreen({data,userId,onGroups,manager,onOwnProfile}:{manager?:SessionManager;data:PremiumEventsController;userId:string;onGroups:()=>void;onOwnProfile?:()=>void}){
  const [finance,setFinance]=useState(false);
  const [confirmJoin,setConfirmJoin]=useState(false);
  const [confirmWithdraw,setConfirmWithdraw]=useState<{id:string;label:string;own:boolean}|null>(null),[undoWithdraw,setUndoWithdraw]=useState(false);
  const [selectedParticipant,setSelectedParticipant]=useState<MatchEntry|null>(null);
  const [editing,setEditing]=useState(false),[editConflict,setEditConflict]=useState('');
  const editVersion=useRef<number|undefined>(undefined);
  const [localFilter,setLocalFilter]=useState<MatchFilter>('upcoming'),[reason,setReason]=useState('');
  const filter=data.listFilter??localFilter;
  const area=useRef<HTMLElement>(null);
  useFrozenBack(()=>{if(selectedParticipant){setSelectedParticipant(null);return true;}if(confirmJoin){setConfirmJoin(false);return true;}if(confirmWithdraw){setConfirmWithdraw(null);return true;}if(editing){setEditing(false);return true;}if(finance){setFinance(false);return true;}if(!data.detail&&!data.creating)return false;data.back();return true;},()=>area.current,25);
  const d=data.detail,e=d?.event,full=e?.access==='full',own=d?.participants.find(p=>p.member_id===userId&&p.status!=='withdrawn');
  useEffect(()=>{setReason('');setEditing(false);setConfirmJoin(false);setSelectedParticipant(null);},[e?.id]);
  const hasPlace=!!e&&full&&e.registered_count!<e.capacity!,closed=!e?.registration_open||e.status==='cancelled';
  useEffect(()=>{setUndoWithdraw(false);setConfirmWithdraw(null);},[e?.id]);
  const blocked=!!d&&!d.can_register_paid,writeDisabled=data.busy||data.loading;
  const badge=(m:EventSummary)=><EventPrivacy game={{visibility:m.visibility}}/>;
  const refresh=<IonButton fill="clear" aria-label="Odśwież mecze" aria-busy={data.loading} disabled={writeDisabled} onClick={()=>{void (e?data.open(e.id):data.refresh(data.offset));}}><IonIcon icon={refreshOutline} aria-hidden="true"/></IonButton>;
  const messages=<>{data.error&&<p className="slm-error" role="alert">{data.error}<button type="button" disabled={writeDisabled} onClick={()=>{void(e?data.open(e.id):data.refresh(data.offset));}}>Spróbuj ponownie</button></p>}{data.notice&&<p role="status" className="slm-notice">{data.notice}</p>}{data.loading&&<p role="status">Wczytywanie meczów…</p>}</>;
  function participant(p:MatchEntry){
    const manages=p.responsible_user_id===userId||e?.can_manage;
    return <li className="slm-live-entry" key={p.id} data-entry={p.id}><span className="slm-roster-avatar" aria-hidden="true">{p.display_name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}</span><div className="slm-demo-person-meta"><strong>{p.member_id?<button type="button" className="slm-participant-profile-link" onClick={()=>{if(p.member_id===userId&&onOwnProfile){onOwnProfile();return;}setSelectedParticipant(p);}} aria-label={`Otwórz profil: ${p.display_name}`}>{p.display_name}</button>:p.display_name}</strong><small>{p.member_id?'Zawodnik':`Gość · odpowiada: ${p.responsible_name}`}{p.absent?' · Nieobecny':''}</small>{p.contact_phone&&<a className="slm-call" href={'tel:'+p.contact_phone}>Zadzwoń</a>}{manages&&!closed&&p.status!=='withdrawn'&&<details><summary>Zarządzaj udziałem</summary><IonButton size="small" fill="clear" disabled={writeDisabled} onClick={()=>setConfirmWithdraw({id:p.id,label:p.member_id?`udział: ${p.display_name}`:`gościa: ${p.display_name}`,own:p.member_id===userId})}>Wycofaj {p.member_id?'udział':'gościa'}</IonButton>{!p.member_id&&p.status==='reserve'&&full&&hasPlace&&<IonButton size="small" fill="clear" disabled={writeDisabled||blocked} onClick={()=>{void data.act('move_guest',{participant_id:p.id,list:'registered'});}}>Potwierdź miejsce dla gościa</IonButton>}</details>}</div></li>;
  }
  const ownAction=e&&d&&e.access!=='none'&&<><IonButton className="slm-match-cta" expand="block" disabled={writeDisabled||closed||(own?.status!=='registered'&&(!full||blocked||own?.status==='reserve'&&!hasPlace))} onClick={()=>{if(own?.status==='registered'){setConfirmWithdraw({id:own.id,label:'Twój zapis na mecz',own:true});return;}setConfirmJoin(true);}}>{closed?'ZAPISY ZAMKNIĘTE':own?.status==='registered'?'WYCOFAJ ZAPIS':blocked?'BLOKADA · ZALEGŁOŚCI':own?.status==='reserve'?hasPlace?'POTWIERDŹ WOLNE MIEJSCE':'JESTEŚ NA REZERWIE':hasPlace?'ZAPISZ SIĘ NA MECZ':'DOŁĄCZ DO REZERWY'}</IonButton>{own?.status==='reserve'&&!closed&&<IonButton fill="clear" disabled={writeDisabled} onClick={()=>setConfirmWithdraw({id:own.id,label:'Twoje miejsce na rezerwie',own:true})}>Opuść rezerwę</IonButton>}{undoWithdraw&&!own&&!closed&&<p role="status" className="slm-notice">Wycofano Twój zapis. <button type="button" disabled={writeDisabled} onClick={()=>{setUndoWithdraw(false);void data.act(hasPlace?'join':'reserve',{});}}>{hasPlace?'Przywróć zapis':'Wróć na rezerwę'}</button></p>}{own?.status==='reserve'&&hasPlace&&!closed&&<p role="status">Zwolniło się miejsce. Potwierdź udział, aby je zająć. Rezerwa nie awansuje automatycznie.</p>}{blocked&&<p>Nowe zapisy na płatne mecze są zablokowane z powodu zaległości. Możesz nadal wycofać swój udział.</p>}</>;
  const filtered=data.discoveryEnabled?data.events:visiblePremiumEvents(data.events,data.groups,data.serverNow,filter,data.activeGroup);
  if(finance&&manager)return <section ref={area} className="slm-premium-events"><PremiumScrollHeader title="Rozliczenia" onBack={()=>setFinance(false)}/><PremiumGroupFinance manager={manager} userId={userId} initialGroup={data.groups.some(g=>g.id===data.activeGroup)?data.activeGroup:undefined}/></section>;
  if(selectedParticipant?.member_id&&manager&&e&&d?.participants.some(p=>p.id===selectedParticipant.id&&p.member_id===selectedParticipant.member_id))return <section ref={area} className="slm-premium-events" aria-label="Profil uczestnika"><PremiumScrollHeader title="Profil zawodnika" onBack={()=>setSelectedParticipant(null)}/><LineupPlayerProfile key={e.group_id+':'+selectedParticipant.member_id} context={{manager,userId,groupId:e.group_id}} memberId={selectedParticipant.member_id} onBack={()=>setSelectedParticipant(null)} backLabel="Wróć do uczestników"/></section>;
  return <section ref={area} className="slm-premium-events" aria-label="Mecze" aria-busy={writeDisabled}>
    {confirmJoin&&e&&<div className="slm-join-dialog-backdrop"><div role="alertdialog" aria-modal="true" aria-labelledby="slm-join-title" aria-describedby="slm-join-description" className="slm-join-dialog">
      <h2 id="slm-join-title">Potwierdź udział</h2>
      <p id="slm-join-description">Po 17:00 w dniu meczu rezygnacja może pozostawić obowiązek opłaty do czasu rozliczenia zastępstwa.</p>
      <div className="slm-join-dialog-actions"><button type="button" disabled={writeDisabled} onClick={()=>setConfirmJoin(false)}>Anuluj</button><button type="button" disabled={writeDisabled} onClick={()=>{setConfirmJoin(false);void data.act(hasPlace?'join':'reserve',{});}}>Rozumiem, {hasPlace?'zapisz mnie':'dołącz do rezerwy'}</button></div>
    </div></div>}
    {confirmWithdraw&&<div className="slm-join-dialog-backdrop"><div role="alertdialog" aria-modal="true" aria-labelledby="slm-withdraw-title" aria-describedby="slm-withdraw-description" className="slm-join-dialog">
      <h2 id="slm-withdraw-title">Na pewno wycofać?</h2>
      <p id="slm-withdraw-description">{confirmWithdraw.label}. {confirmWithdraw.own?'Zapis możesz od razu przywrócić, jeśli miejsce nadal będzie wolne.':'Wpis trafi do wycofanych; jego przywrócenie wymaga ponownego zapisu.'}</p>
      <div className="slm-join-dialog-actions"><button type="button" disabled={writeDisabled} onClick={()=>setConfirmWithdraw(null)}>Anuluj</button><button type="button" disabled={writeDisabled} onClick={()=>{const target=confirmWithdraw;setConfirmWithdraw(null);void data.act('withdraw',{participant_id:target.id}).then(ok=>{if(ok&&target.own)setUndoWithdraw(true);});}}>Tak, wycofaj</button></div>
    </div></div>}
    {(data.creating||editing&&e?.can_edit&&full)&&data.serverNow?<>{messages}{editConflict&&<p role="alert">{editConflict}</p>}<EventForm onBack={()=>editing?setEditing(false):data.back()} onSave={async input=>{if(editing){if(editVersion.current!==e?.version){setEditConflict('Mecz zmienił się podczas edycji. Szkic zachowano. Anuluj edycję i otwórz aktualny mecz przed nowym zapisem.');return;}if(await data.edit(input))setEditing(false);}else await data.create(input);}} live={{editing,canEdit:e?.can_edit,occupied:e?.registered_count??0,groups:editing&&e?data.groups.filter(g=>g.id===e.group_id):data.organizers,initial:editing&&e?premiumEventInput(e):premiumDefaults(data.serverNow,data.organizers.some(g=>g.id===data.activeGroup)?data.activeGroup:data.organizers[0]?.id),busy:data.busy}}/></>:<>
    <PremiumScrollHeader title={e?'Szczegóły meczu':'Mecze'} action={refresh} primaryAction={!e&&manager?<GroupNotifications manager={manager} userId={userId} onGroups={onGroups} refreshKey={data.loading}/>:undefined} onBack={e?data.back:undefined}/>{messages}
    {e&&d?<>
      {full?<><p className="slm-event-label"><span>{e.group_name}</span></p><MatchHero match={heroMatch(e)} minimum={e.minimum_players} displayName={e.name} badge={badge(e)} title="Szczegóły meczu">{ownAction}</MatchHero></>:<section className="slm-panel"><h2>{e.name}</h2><p>{matchDate(e.starts_at)} · {e.location} · {e.group_name}</p><p>{e.access==='none'?'Szczegóły tego prywatnego meczu są dostępne dla członków grupy.':'Widoczny jest wyłącznie Twój udział po opuszczeniu grupy.'}</p>{e.access==='own'&&ownAction}</section>}
      {e.access!=='none'&&<MatchTabs key={e.id} panels={[<section className="slm-panel slm-match-info"><h2>Informacje</h2><p>{e.group_name} · {matchDate(e.starts_at)}</p><p>{e.location} · {e.duration_minutes} minut</p><p>Koszt meczu: {money(e.cost_cents!/100)} · minimum {e.minimum_players} uczestników</p><p>Rezygnacja do 17:00 w dniu meczu. Później obowiązują zasady odpowiedzialności finansowej, a zastępstwa rozliczane są według kolejności zwolnionych miejsc.</p>{e.decision_required&&<p role="status">Nie ma minimum {e.minimum_players} osób. Administrator podejmuje decyzję o odwołaniu.</p>}{e.can_edit&&e.registration_open&&e.status!=='cancelled'&&<IonButton disabled={writeDisabled} onClick={()=>{editVersion.current=e.version;setEditConflict('');setEditing(true);}}>Edytuj mecz</IonButton>}{e.can_manage&&e.status!=='cancelled'&&<details><summary>Zarządzanie meczem</summary><label>Powód odwołania<input value={reason} maxLength={200} onChange={ev=>setReason(ev.target.value)}/></label><IonButton disabled={writeDisabled||!reason.trim()} color="danger" onClick={()=>{if(window.confirm('Odwołać mecz z zachowaniem historii i rozliczeń?'))void data.act('cancel',{reason});}}>Odwołaj mecz</IonButton></details>}</section> ,<>
        {full&&<RosterSummary occupied={e.registered_count!} capacity={e.capacity!} reserve={e.reserve_count!}/>}
        {full&&own?.status==='registered'&&!closed&&<details className="slm-panel"><summary>Dodaj gościa</summary><GuestForm key={e.id} disabled={writeDisabled||blocked} hasPlace={hasPlace} onSave={body=>data.act('guest',body)}/></details>}
        <ParticipantGroup title={full?'Uczestnicy':'Twoje wpisy'} emptyText="Brak zapisanych osób." previewLimit={5}>{d.participants.filter(p=>p.status==='registered').map(participant)}</ParticipantGroup>
        <ParticipantGroup title="Rezerwa" emptyText="Rezerwa jest pusta." description="Kolejność zgłoszeń. Zajęcie wolnego miejsca wymaga potwierdzenia.">{d.participants.filter(p=>p.status==='reserve').map(participant)}</ParticipantGroup>
        {d.participants.some(p=>p.status==='withdrawn')&&<ParticipantGroup title="Wycofane wpisy" emptyText="Brak wpisów.">{d.participants.filter(p=>p.status==='withdrawn').map(participant)}</ParticipantGroup>}
      </>,full?<PremiumTeams key={e.id} eventId={e.id} participants={d.participants} cancelled={e.status==='cancelled'} canEdit={data.groups.some(g=>g.id===e.group_id)} profileContext={manager?{manager,userId,groupId:e.group_id}:undefined}/>:<p>Składy niedostępne bez pełnego dostępu do meczu.</p>,manager?<PremiumFinance key={`${userId}:${e.group_id}:${e.id}`} manager={manager} userId={userId} groupId={e.group_id} eventId={e.id} manage={!!e.can_manage||data.groups.some(g=>g.id===e.group_id&&g.admin_id===userId)} onChanged={()=>{void data.recheckFinancial?.();}}/>:<p>Rozliczenia wymagają aktywnej sesji.</p>]}/>}</>
    :<section className="slm-matches-screen">
      <div className="slm-events-controls"><label>Aktywna grupa<select aria-label="Aktywna grupa" value={data.activeGroup} onChange={ev=>data.selectGroup(ev.target.value)}><option value="">Wszystkie</option><option value="groups" disabled={!data.discoveryEnabled}>Moje grupy</option><option value="public" disabled={!data.discoveryEnabled}>Publiczne</option><option value="mine">Moje mecze</option>{data.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      {data.activeGroup==='public'&&<label className="slm-player-search">Szukaj meczu lub grupy<input type="search" value={data.search??''} maxLength={100} onChange={ev=>data.changeSearch(ev.target.value)}/></label>}
      
      </div>
      <MatchFilters value={filter} onChange={value=>{if(data.changeFilter)data.changeFilter(value);else{setLocalFilter(value);if(data.offset)void data.refresh();}}}/>
      <div className="slm-match-list">{!data.loading&&!data.error&&filtered.map(m=><div key={m.id} data-event={m.id}>
        <p className="slm-event-label"><span>{m.group_name}</span></p>
        <MatchHero minimum={m.minimum_players} compact title="Mecz" match={m.access==='full'?heroMatch(m):{starts_at:m.starts_at,location:m.location,status:m.status}}
          displayName={m.name} badge={badge(m)} onOpen={m.access==='none'?undefined:()=>{void data.open(m.id);}} openDisabled={writeDisabled}/>
        {m.access==='none'&&<p className="slm-events-private-note">Szczegóły tylko dla członków grupy.</p>}
      </div>)}</div>
      {!data.loading&&!data.error&&!filtered.length&&<p role="status">Brak meczów w tym widoku.{data.offset>0?' Sprawdź pozostałe strony.':''}</p>}
      {(data.offset>0||data.hasMore)&&<div className="slm-group-actions"><button type="button" disabled={writeDisabled||!data.offset} onClick={()=>{void data.refresh(Math.max(0,data.offset-100));}}>Poprzednia strona</button><button type="button" disabled={writeDisabled||!data.hasMore||data.nextOffset===null} onClick={()=>{if(data.nextOffset!==null)void data.refresh(data.nextOffset);}}>Następna strona</button></div>}
    </section>}
    </>}
  </section>;
}

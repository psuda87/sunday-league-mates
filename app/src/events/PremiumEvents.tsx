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
import { EventPrivacy } from '../demo/EventAccessView';
import './premiumEvents.css';
import ParticipantGroup,{ RosterSummary } from '../ui/ParticipantGroup';
import EventForm from '../demo/EventForm';
import { useFrozenBack } from '../native/frozenDemoAndroid';
import { heroMatch } from './premiumContracts';
import type { MatchEntry,EventSummary } from './premiumContracts';
import { premiumDefaults } from './premiumForm';
import type { PremiumEventsController } from './usePremiumEvents';
import { matchDate,money } from './model';

export default function PremiumEvents({data,userId,onGroups,manager}:{manager?:SessionManager;data:PremiumEventsController;userId:string;onGroups:()=>void}){
  const [finance,setFinance]=useState(false);
  const [localFilter,setLocalFilter]=useState<MatchFilter>('upcoming'),[guest,setGuest]=useState(''),[phone,setPhone]=useState(''),[reserve,setReserve]=useState(false),[reason,setReason]=useState('');
  const filter=data.listFilter??localFilter;
  const area=useRef<HTMLElement>(null);
  useFrozenBack(()=>{if(finance){setFinance(false);return true;}if(!data.detail&&!data.creating)return false;data.back();return true;},()=>area.current,25);
  const d=data.detail,e=d?.event,full=e?.access==='full',own=d?.participants.find(p=>p.member_id===userId&&p.status!=='withdrawn');
  useEffect(()=>{setGuest('');setPhone('');setReserve(false);setReason('');},[e?.id]);
  const hasPlace=!!e&&full&&e.registered_count!<e.capacity!,closed=!e?.registration_open||e.status==='cancelled';
  const blocked=!!d&&!d.can_register_paid,writeDisabled=data.busy||data.loading;
  const badge=(m:EventSummary)=><EventPrivacy game={{visibility:m.visibility}}/>;
  const refresh=<IonButton fill="clear" aria-label="Odśwież mecze" aria-busy={data.loading} disabled={writeDisabled} onClick={()=>{void (e?data.open(e.id):data.refresh(data.offset));}}><IonIcon icon={refreshOutline} aria-hidden="true"/></IonButton>;
  const messages=<>{data.error&&<p className="slm-error" role="alert">{data.error}<button type="button" disabled={writeDisabled} onClick={()=>{void(e?data.open(e.id):data.refresh(data.offset));}}>Spróbuj ponownie</button></p>}{data.notice&&<p role="status" className="slm-notice">{data.notice}</p>}{data.loading&&<p role="status">Wczytywanie meczów…</p>}</>;
  function participant(p:MatchEntry){
    const manages=p.responsible_user_id===userId||e?.can_manage;
    return <li className="slm-live-entry" key={p.id} data-entry={p.id}><span className="slm-roster-avatar" aria-hidden="true">{p.display_name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}</span><div className="slm-demo-person-meta"><strong>{p.display_name}</strong><small>{p.member_id?'Zawodnik':`Gość · odpowiada: ${p.responsible_name}`}{p.absent?' · Nieobecny':''}</small>{p.contact_phone&&<a className="slm-call" href={'tel:'+p.contact_phone}>Zadzwoń</a>}{manages&&!closed&&p.status!=='withdrawn'&&<details><summary>Zarządzaj udziałem</summary><IonButton size="small" fill="clear" disabled={writeDisabled} onClick={()=>{void data.act('withdraw',{participant_id:p.id});}}>Wycofaj {p.member_id?'udział':'gościa'}</IonButton>{!p.member_id&&p.status==='reserve'&&full&&hasPlace&&<IonButton size="small" fill="clear" disabled={writeDisabled||blocked} onClick={()=>{void data.act('move_guest',{participant_id:p.id,list:'registered'});}}>Potwierdź miejsce dla gościa</IonButton>}</details>}</div></li>;
  }
  const ownAction=e&&d&&e.access!=='none'&&<><IonButton className="slm-match-cta" expand="block" disabled={writeDisabled||closed||(own?.status!=='registered'&&(!full||blocked||own?.status==='reserve'&&!hasPlace))} onClick={()=>{void data.act(own?.status==='registered'?'withdraw':hasPlace?'join':'reserve',own?.status==='registered'?{participant_id:own.id}:{});}}>{closed?'ZAPISY ZAMKNIĘTE':own?.status==='registered'?'WYCOFAJ ZAPIS':blocked?'BLOKADA · ZALEGŁOŚCI':own?.status==='reserve'?hasPlace?'POTWIERDŹ WOLNE MIEJSCE':'JESTEŚ NA REZERWIE':hasPlace?'ZAPISZ SIĘ NA MECZ':'DOŁĄCZ DO REZERWY'}</IonButton>{own?.status==='registered'&&!closed&&<p className="slm-muted">Po 17:00 rezygnacja może pozostawić obowiązek opłaty do czasu rozliczenia zastępstwa.</p>}{own?.status==='reserve'&&!closed&&<IonButton fill="clear" disabled={writeDisabled} onClick={()=>{void data.act('withdraw',{participant_id:own.id});}}>Opuść rezerwę</IonButton>}{own?.status==='reserve'&&hasPlace&&!closed&&<p role="status">Zwolniło się miejsce. Potwierdź udział, aby je zająć. Rezerwa nie awansuje automatycznie.</p>}{blocked&&<p>Nowe zapisy na płatne mecze są zablokowane z powodu zaległości. Możesz nadal wycofać swój udział.</p>}</>;
  const filtered=visiblePremiumEvents(data.events,data.groups,data.serverNow,filter,data.activeGroup);
  if(finance&&manager)return <section ref={area} className="slm-premium-events"><PremiumScrollHeader title="Rozliczenia" onBack={()=>setFinance(false)}/><PremiumGroupFinance manager={manager} userId={userId} initialGroup={data.groups.some(g=>g.id===data.activeGroup)?data.activeGroup:undefined}/></section>;
  return <section ref={area} className="slm-premium-events" aria-label="Mecze" aria-busy={writeDisabled}>
    {data.creating&&data.serverNow?<>{messages}<EventForm onBack={data.back} onSave={input=>data.create(input)} live={{groups:data.organizers,initial:premiumDefaults(data.serverNow,data.organizers.some(g=>g.id===data.activeGroup)?data.activeGroup:data.organizers[0]?.id),busy:data.busy}}/></>:<>
    <PremiumScrollHeader title={e?'Szczegóły meczu':'Mecze'} action={refresh} onBack={e?data.back:undefined}/>{messages}
    {e&&d?<>
      {full?<><p className="slm-event-label"><span>{e.group_name}</span></p><MatchHero match={heroMatch(e)} displayName={e.name} badge={badge(e)} title="Szczegóły meczu">{ownAction}</MatchHero></>:<section className="slm-panel"><h2>{e.name}</h2><p>{matchDate(e.starts_at)} · {e.location} · {e.group_name}</p><p>{e.access==='none'?'Szczegóły tego prywatnego meczu są dostępne dla członków grupy.':'Widoczny jest wyłącznie Twój udział po opuszczeniu grupy.'}</p>{e.access==='own'&&ownAction}</section>}
      {e.access!=='none'&&<MatchTabs key={e.id} panels={[<section className="slm-panel slm-match-info"><h2>Informacje</h2><p>{e.group_name} · {matchDate(e.starts_at)}</p><p>{e.location} · {e.duration_minutes} minut</p><p>Koszt meczu: {money(e.cost_cents!/100)} · minimum 10 uczestników</p><p>Rezygnacja do 17:00 w dniu meczu. Później obowiązują zasady odpowiedzialności finansowej, a zastępstwa rozliczane są według kolejności zwolnionych miejsc.</p>{e.decision_required&&<p role="status">Nie ma minimum 10 osób. Administrator podejmuje decyzję o odwołaniu.</p>}{e.can_manage&&e.status!=='cancelled'&&<details><summary>Zarządzanie meczem</summary><label>Powód odwołania<input value={reason} maxLength={200} onChange={ev=>setReason(ev.target.value)}/></label><IonButton disabled={writeDisabled||!reason.trim()} color="danger" onClick={()=>{if(window.confirm('Odwołać mecz z zachowaniem historii i rozliczeń?'))void data.act('cancel',{reason});}}>Odwołaj mecz</IonButton></details>}</section> ,<>
        {full&&<RosterSummary occupied={e.registered_count!} capacity={e.capacity!} reserve={e.reserve_count!}/>}
        {full&&own?.status==='registered'&&!closed&&<details className="slm-panel"><summary>Dodaj gościa</summary><form className="slm-group-form" onSubmit={ev=>{ev.preventDefault();void data.act('guest',{guest_name:guest,guest_phone:phone,list:reserve?'reserve':'registered'}).then(saved=>{if(saved){setGuest('');setPhone('');}});}}><label>Imię lub pseudonim gościa<input required maxLength={64} value={guest} onChange={ev=>setGuest(ev.target.value)}/></label><label>Telefon gościa · opcjonalnie<input type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={ev=>setPhone(ev.target.value)}/></label><label>Lista<select value={reserve?'reserve':'registered'} onChange={ev=>setReserve(ev.target.value==='reserve')}><option value="registered">Na mecz</option><option value="reserve">Rezerwa</option></select></label><p>Odpowiadasz finansowo za swojego gościa. Dodaj jednego gościa, a następnie powtórz dla drugiego.</p><button className="slm-group-primary" type="submit" disabled={writeDisabled||blocked||!guest.trim()||!reserve&&!hasPlace}>Zapisz gościa</button></form></details>}
        <ParticipantGroup title={full?'Uczestnicy':'Twoje wpisy'} emptyText="Brak zapisanych osób." previewLimit={5}>{d.participants.filter(p=>p.status==='registered').map(participant)}</ParticipantGroup>
        <ParticipantGroup title="Rezerwa" emptyText="Rezerwa jest pusta." description="Kolejność zgłoszeń. Zajęcie wolnego miejsca wymaga potwierdzenia.">{d.participants.filter(p=>p.status==='reserve').map(participant)}</ParticipantGroup>
        {d.participants.some(p=>p.status==='withdrawn')&&<ParticipantGroup title="Wycofane wpisy" emptyText="Brak wpisów.">{d.participants.filter(p=>p.status==='withdrawn').map(participant)}</ParticipantGroup>}
      </>,full?<PremiumTeams key={e.id} eventId={e.id} participants={d.participants} cancelled={e.status==='cancelled'} canEdit={data.groups.some(g=>g.id===e.group_id)} profileContext={manager?{manager,userId,groupId:e.group_id}:undefined}/>:<p>Składy niedostępne bez pełnego dostępu do meczu.</p>,manager?<PremiumFinance key={`${userId}:${e.group_id}:${e.id}`} manager={manager} userId={userId} groupId={e.group_id} eventId={e.id} manage={!!e.can_manage||data.groups.some(g=>g.id===e.group_id&&g.admin_id===userId)} onChanged={()=>{void data.recheckFinancial?.();}}/>:<p>Rozliczenia wymagają aktywnej sesji.</p>]}/>}</>
    :!data.loading&&!data.error&&<section className="slm-matches-screen">
      <div className="slm-events-controls"><label>Aktywna grupa<select aria-label="Aktywna grupa" value={data.activeGroup} onChange={ev=>data.selectGroup(ev.target.value)}><option value="">Wszystkie dostępne</option><option value="public">Publiczne</option><option value="mine">Moje mecze</option>{data.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      {!data.groups.length&&<section className="slm-group-empty"><h2>Znajdź swoją ekipę</h2><p>Utwórz grupę albo przyjmij zaproszenie, aby grać razem.</p><button type="button" className="slm-group-primary" onClick={onGroups}>Przejdź do grup</button></section>}
      {manager&&<IonButton fill="outline" onClick={()=>setFinance(true)}>Moje rozliczenia grupowe</IonButton>}</div>
      <MatchFilters value={filter} onChange={value=>{if(data.changeFilter)data.changeFilter(value);else{setLocalFilter(value);if(data.offset)void data.refresh();}}}/>
      <div className="slm-match-list">{filtered.map(m=><div key={m.id} data-event={m.id}>
        <p className="slm-event-label"><span>{m.group_name}</span></p>
        <MatchHero compact title="Mecz" match={m.access==='full'?heroMatch(m):{starts_at:m.starts_at,location:m.location,status:m.status}}
          displayName={m.name} badge={badge(m)} onOpen={m.access==='none'?undefined:()=>{void data.open(m.id);}} openDisabled={writeDisabled}/>
        {m.access==='none'&&<p className="slm-events-private-note">Szczegóły tylko dla członków grupy.</p>}
      </div>)}</div>
      {!filtered.length&&<p role="status">Brak meczów w tym widoku.{data.offset>0?' Sprawdź pozostałe strony.':''}</p>}
      {(data.offset>0||data.events.length===100)&&<div className="slm-group-actions"><button type="button" disabled={writeDisabled||!data.offset} onClick={()=>{void data.refresh(Math.max(0,data.offset-100));}}>Poprzednia strona</button><button type="button" disabled={writeDisabled||data.events.length<100} onClick={()=>{void data.refresh(data.offset+100);}}>Następna strona</button></div>}
    </section>}
    </>}
  </section>;
}

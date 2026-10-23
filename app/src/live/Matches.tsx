import LimitedMatchCard from '../ui/LimitedMatchCard';
import { useBackAction } from '../ui/backNavigation';
import { requireMatchDetail } from './matchResponse';
import EventPrivacy from '../ui/EventPrivacy';
import { dateEntry, timeEntry, dateToIso, displayDate } from '../ui/dateEntry';
import MatchSections from '../ui/MatchSections';
import { RosterSummary } from '../ui/ParticipantGroup';
import MatchRoster from './MatchRoster';
import LineupPreview from './LineupPreview';
import type { LiveEntry } from './LineupPreview';
import ParticipantCard from './ParticipantCard';
import { useEffect, useRef, useState } from 'react';
import { IonButton, IonSpinner, IonModal, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/react';
import type { SessionManager } from '../auth/sessionManager';
import type { Match } from '../events/model';
import { matchDate, money, nextMatchDay, warsawFields } from '../events/model';
import MatchHeader from '../ui/MatchHeader';
import MatchHero from '../ui/MatchHero';
import MatchFilters from '../ui/MatchFilters';
import type { MatchFilter } from '../ui/MatchFilters';
import type { Group } from './Groups';
import Finance from './Finance';
import { useOperation } from './useOperation';
interface LiveMatch extends Match {own_participation:boolean;name:string;group_id:string;group_name:string;visibility:'public'|'private';access:'full'|'own'|'none';cost_cents:number;version:number;approved_at:string|null;can_manage:boolean;can_edit:boolean}
type Entry = LiveEntry;
interface Detail {event:LiveMatch;participants:Entry[];server_now:string;can_register_paid:boolean}
interface Form {group_id:string;name:string;date:string;time:string;location:string;duration_minutes:string;hourly_rate:string;total_cost:string;capacity:string;visibility:string}
const empty=(group=''):Form=>({group_id:group,name:'Mecz',date:'',time:'',location:'',duration_minutes:'90',hourly_rate:'180',total_cost:'270',capacity:'',visibility:'private'});
export default function Matches({manager,userId,onLegacy,initialEventId,createRequest=0}:{manager:SessionManager;userId:string;onLegacy:()=>void;initialEventId?:string|null;createRequest?:number}) {
 const [matches,setMatches]=useState<LiveMatch[]|null>(null),[groups,setGroups]=useState<Group[]>([]),[detail,setDetail]=useState<Detail|null>(null),[serverNow,setServerNow]=useState(''),[filter,setFilter]=useState<MatchFilter>('upcoming');
 const [form,setForm]=useState<Form|null>(null),[editing,setEditing]=useState<LiveMatch|null>(null),[finance,setFinance]=useState(false),[name,setName]=useState(''),[phone,setPhone]=useState(''),[reserve,setReserve]=useState(false),[initialError,setInitialError]=useState(''),[offset,setOffset]=useState(0);
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{void root.current?.closest('ion-content')?.scrollToTop(0);},[detail?.event.id,form!==null]);
 const [selectedPerson,setSelectedPerson]=useState<string|null>(null);
 const {busy,error,run,mutate}=useOperation(manager);
 async function list(page=offset){const r=await manager.call<{events:LiveMatch[];server_now:string}>('matches_list',{offset:page});setMatches(r.events);setServerNow(r.server_now);setOffset(page);}
 async function open(id:string){const r=await manager.call<Detail>('matches_detail',{event_id:id});requireMatchDetail(r,id);setDetail(r);setServerNow(r.server_now);setForm(null);setFinance(false);}
 useEffect(()=>{let live=true;Promise.all([manager.call<{events:LiveMatch[];server_now:string}>('matches_list'),manager.call<{groups:Group[]}>('groups_list')]).then(([a,b])=>{if(!Array.isArray(a.events)||!Array.isArray(b.groups))throw new Error('Serwer zwrócił nieprawidłową listę meczów lub grup.');if(live){setMatches(a.events);setServerNow(a.server_now);setGroups(b.groups);setInitialError('');}}).catch(e=>{if(live)setInitialError(e instanceof Error?e.message:'Nie udało się pobrać meczów.');});return()=>{live=false;};},[manager]);
 useEffect(()=>{if(!initialEventId)return;let live=true;manager.call<Detail>('matches_detail',{event_id:initialEventId}).then(r=>{requireMatchDetail(r,initialEventId);if(live){setDetail(r);setServerNow(r.server_now);}}).catch(e=>{if(live)setInitialError(e instanceof Error?e.message:'Nie udało się otworzyć meczu.');});return()=>{live=false;};},[manager,initialEventId]);
 const consumedCreate = useRef(0);
 useEffect(() => {
   if (!createRequest || consumedCreate.current === createRequest) return;
   const allowed = groups.find(group => group.organizer || group.admin_id === userId);
   if (!allowed) return;
   consumedCreate.current = createRequest;
   setEditing(null); setDetail(null); setFinance(false); setForm(empty(allowed.id));
 }, [createRequest, groups, userId]);
 useBackAction(30, form !== null && !finance, () => { if (!busy) { setForm(null); setEditing(null); } });
 useBackAction(20, detail !== null && form === null && !finance, () => { if (!busy) {const opened=Array.from(document.querySelectorAll<HTMLDetailsElement>('.slm-live-matches details[open]')).pop();if(opened)opened.open=false;else setDetail(null);} });
 const e=detail?.event,own=detail?.participants.find(p=>p.member_id===userId&&p.status!=='withdrawn');
 const selectedEntry=e?.access==='full'&&!form&&!finance?detail?.participants.find(p=>p.id===selectedPerson&&!!p.member_id):undefined;
 const participation=e&&detail?<section className="slm-panel slm-match-participation"><h2>Twój udział</h2><p>{own?own.status==='reserve'?'Jesteś na rezerwie':'Jesteś zapisany':'Nie jesteś zapisany'}</p>{e.registration_open&&<div className="slm-actions">{own&&<IonButton disabled={busy} onClick={()=>void run(()=>operation('withdraw',{participant_id:own.id}))}>Zrezygnuj</IonButton>}{e.access==='full'&&own?.status!=='registered'&&<><IonButton disabled={busy||!detail.can_register_paid} onClick={()=>void run(()=>operation('join'))}>Zapisz się</IonButton><IonButton disabled={busy||!detail.can_register_paid||own?.status==='reserve'} onClick={()=>void run(()=>operation('reserve'))}>Dołącz do rezerwy</IonButton></>}</div>}{!detail.can_register_paid&&<p>⚠ Zaległości blokują nowe zapisy na płatne mecze. Rezygnacja nadal jest możliwa.</p>}<p>Koszt całkowity: {money(e.cost_cents/100)}. Opłata jest zaokrąglana w górę do pełnej złotówki po zatwierdzeniu rozliczenia.</p></section>:null;
 const organizers=groups.filter(g=>g.organizer||g.admin_id===userId);
 async function operation(action:string,values:Record<string,unknown>={}){if(!e)return;await mutate('matches_'+action,{event_id:e.id,...values});await open(e.id);await list();}
 function edit(m?:LiveMatch){setEditing(m??null);setForm(m?{...empty(m.group_id),...warsawFields(m.starts_at),date:displayDate(warsawFields(m.starts_at).date),name:m.name,location:m.location,duration_minutes:String(m.duration_minutes),hourly_rate:String(m.hourly_rate),total_cost:String(m.total_cost),capacity:String(m.capacity),visibility:m.visibility}:empty(organizers[0]?.id));}
 function update(key:keyof Form,value:string){setForm(previous=>{if(!previous)return previous;const next={...previous,[key]:value};if(key==='duration_minutes'||key==='hourly_rate')next.total_cost=(Number(next.duration_minutes)*Number(next.hourly_rate)/60).toFixed(2);return next;});}
 const subset=matches?.filter(m=>{const old=m.status==='cancelled'||Date.parse(m.starts_at)<=Date.parse(serverNow);return filter==='history'?old:!old&&(filter!=='mine'||m.own_participation);}).sort((a,b)=>filter==='history'?Date.parse(b.starts_at)-Date.parse(a.starts_at):Date.parse(a.starts_at)-Date.parse(b.starts_at));
 if(finance&&e)return <Finance manager={manager} manageEvent={e.can_manage} eventId={e.id} groupId={e.group_id} onBack={()=>{setFinance(false);void run(()=>open(e.id));}}/>;
 return <div className="slm-live-matches" ref={root}><MatchHeader busy={busy} title={form?'Formularz meczu':detail?'Szczegóły meczu':'Mecze'} onBack={detail||form?()=>{if(form){setForm(null);setEditing(null);}else setDetail(null);void run(()=>list());}:undefined}/>
 {selectedEntry&&<IonModal isOpen onDidDismiss={()=>setSelectedPerson(null)}><IonHeader><IonToolbar><IonTitle>Profil zawodnika</IonTitle><IonButton slot="end" fill="clear" onClick={()=>setSelectedPerson(null)}>Zamknij</IonButton></IonToolbar></IonHeader><IonContent><ParticipantCard key={selectedEntry.id} entry={selectedEntry} manager={manager} userId={userId}/></IonContent></IonModal>}
 {(error||initialError)&&<p role="alert" className="slm-error">⚠ {error||initialError}</p>}{busy&&<IonSpinner/>}
 {form?<section className="slm-panel slm-event-form"><form className="slm-form" onSubmit={ev=>{ev.preventDefault();void run(async()=>{const result=await mutate<{event_id:string}>(editing?'matches_edit':'matches_create',{...form,date:dateToIso(form.date),event_id:editing?.id,expected_version:editing?.version,cost_cents:Math.round(Number(form.total_cost)*100),duration_minutes:Number(form.duration_minutes),capacity:Number(form.capacity)});await open(result.event_id);await list();});}}>
 <label>Grupa<select required disabled={!!editing} value={form.group_id} onChange={ev=>update('group_id',ev.target.value)}><option value="">Wybierz grupę</option>{organizers.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
 <label>Nazwa<input required maxLength={100} value={form.name} onChange={ev=>update('name',ev.target.value)}/></label>
 <label>Widoczność<select value={form.visibility} onChange={ev=>update('visibility',ev.target.value)}><option value="private">Prywatny — zapisy członków grupy</option><option value="public">Publiczny — zapisy zalogowanych zawodników</option></select></label>
 <p>Data i godzina obowiązują w strefie Europe/Warsaw.</p><div className="slm-actions">{serverNow&&<><IonButton fill="outline" onClick={()=>update('date',displayDate(nextMatchDay(serverNow,4)))}>Czwartek</IonButton><IonButton fill="outline" onClick={()=>update('date',displayDate(nextMatchDay(serverNow,0)))}>Niedziela</IonButton></>}</div>
 <label>Data<input type="text" inputMode="numeric" placeholder="DD.MM.RRRR" pattern="[0-9]{2}\.[0-9]{2}\.[0-9]{4}" maxLength={10} required value={form.date} onChange={ev=>update('date',dateEntry(ev.target.value))}/></label><label>Godzina<input type="text" inputMode="numeric" placeholder="HH:mm" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" maxLength={5} required value={form.time} onChange={ev=>update('time',timeEntry(ev.target.value))}/></label>
 <label>Miejsce<input required maxLength={160} value={form.location} onChange={ev=>update('location',ev.target.value)}/></label>
 <label>Czas gry (min)<input type="number" required min="1" max="1440" value={form.duration_minutes} onChange={ev=>update('duration_minutes',ev.target.value)}/></label>
 <label>Stawka (zł/h)<input type="number" min="0" step="0.01" required value={form.hourly_rate} onChange={ev=>update('hourly_rate',ev.target.value)}/></label>
 <label>Koszt całkowity (zł)<input type="number" min="0" step="0.01" required value={form.total_cost} onChange={ev=>update('total_cost',ev.target.value)}/></label>
 <label>Limit miejsc<input type="number" min="10" max="1000" required value={form.capacity} onChange={ev=>update('capacity',ev.target.value)}/></label><IonButton disabled={busy} type="submit">Zapisz mecz</IonButton></form></section>
 :detail&&e?<>{e.access==='full'?<MatchHero match={e} displayName={e.name} title="Szczegóły meczu" badge={<EventPrivacy visibility={e.visibility}/>}/>:<LimitedMatchCard match={e} compact={false}/>}
 {e.access!=='none'&&<>
 <MatchSections key={e.id} information={<><section className="slm-panel"><h2>Informacje o meczu</h2><p>{e.group_name} · {matchDate(e.starts_at)}</p><p>{e.location} · {e.duration_minutes} minut</p></section> {e.can_manage&&<details className="slm-panel slm-match-management"><summary>Zarządzanie meczem</summary>{e.can_edit&&e.registration_open&&<IonButton disabled={busy} onClick={()=>edit(e)}>Edytuj mecz</IonButton>}<IonButton disabled={busy} onClick={()=>setFinance(true)}>Rozliczenie meczu</IonButton>{e.status!=='cancelled'&&<IonButton disabled={busy} color="danger" onClick={()=>{const reason=window.prompt('Powód odwołania meczu');if(reason?.trim())void run(()=>operation('cancel',{reason}));}}>Odwołaj mecz</IonButton>}</details>}</>} participants={<>{participation}{e.access==='full'&&<RosterSummary occupied={e.registered_count} capacity={e.capacity} reserve={e.reserve_count}/>} {e.access==='full'&&e.registration_open&&<details className="slm-panel slm-guest-form"><summary>Dodaj gościa</summary><form className="slm-form" onSubmit={ev=>{ev.preventDefault();void run(async()=>{await operation('guest',{guest_name:name,guest_phone:phone,list:reserve?'reserve':'registered'});setName('');setPhone('');});}}><label>Imię / pseudonim<input required maxLength={64} value={name} onChange={ev=>setName(ev.target.value)}/></label><label>Telefon (opcjonalnie)<input type="tel" value={phone} onChange={ev=>setPhone(ev.target.value)}/></label><label><input type="checkbox" checked={reserve} onChange={ev=>setReserve(ev.target.checked)}/>Dodaj do osobnej rezerwy</label><p>Odpowiadasz za opłatę swojego gościa. Rezerwa nie awansuje automatycznie.</p><IonButton type="submit" disabled={busy||!detail.can_register_paid}>Dodaj gościa</IonButton></form></details>}
 <MatchRoster entries={detail.participants} userId={userId} canManage={e.can_manage} registrationOpen={e.registration_open} fullAccess={e.access==='full'} busy={busy} approved={!!e.approved_at} onPlayer={setSelectedPerson} onAction={(action,values)=>void run(()=>operation(action,values))}/>
</>} teams={e.access==='full'?<LineupPreview key={e.id} entries={detail.participants} cancelled={e.status==='cancelled'} onPlayer={setSelectedPerson}/>:<p>Składy niedostępne w tym widoku.</p>} settlement={<section className="slm-panel"><h2>Rozliczenie w grupie</h2><p>Wpłaty i saldo dotyczą tej grupy. Blokada zapisów uwzględnia kwalifikujące zaległości w całym SLM.</p><IonButton disabled={busy} onClick={()=>setFinance(true)}>Otwórz rozliczenie meczu</IonButton></section>} />
 </>}
 </>:<><IonButton disabled={busy} fill="outline" onClick={()=>void run(()=>list())}>Odśwież mecze</IonButton>{organizers.length>0&&<IonButton disabled={busy} onClick={()=>edit()}>Utwórz mecz</IonButton>}<IonButton fill="clear" onClick={onLegacy}>Wydarzenia i rozliczenia historyczne</IonButton><MatchFilters value={filter} onChange={setFilter}/>{matches===null&&!initialError&&<p role="status">Wczytywanie meczów…</p>}{subset?.length===0&&<p role="status">Brak meczów w tym widoku.</p>}{subset?.map(m=><div key={m.id}><p className="slm-live-label">{m.group_name}</p>{m.access==='full'?<MatchHero match={m} displayName={m.name} compact onOpen={()=>void run(()=>open(m.id))} openDisabled={busy} badge={<EventPrivacy visibility={m.visibility}/>}/>:<LimitedMatchCard match={m} disabled={busy} onOpen={()=>void run(()=>open(m.id))}/>} </div>)}<div className="slm-actions"><IonButton disabled={busy||offset===0} onClick={()=>void run(()=>list(Math.max(0,offset-100)))}>Poprzednia strona</IonButton><IonButton disabled={busy||matches?.length!==100} onClick={()=>void run(()=>list(offset+100))}>Następna strona</IonButton></div></>}
 </div>;
}

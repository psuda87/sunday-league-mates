import { useEffect, useState } from 'react';
import { IonButton, IonSpinner } from '@ionic/react';
import MatchHeader from '../ui/MatchHeader';
import type { SessionManager } from '../auth/sessionManager';
import { normalizePolishPhone } from '../../supabase/functions/_shared/phone';
import { useOperation } from './useOperation';
export interface Group { id:string; name:string; description:string; admin_id:string; organizer:boolean }
interface Request { id:string; group_id:string; group_name?:string; kind:string; state:string; actor_id?:string; target_id?:string }
interface Member {user_id:string; nickname:string;organizer:boolean;contact_phone?:string|null}
interface Details {group:Group;members:Member[];requests:Request[]}
export default function Groups({manager,userId}:{manager:SessionManager;userId:string}) {
 const [groups,setGroups]=useState<Group[]|null>(null),[inbox,setInbox]=useState<Request[]>([]),[detail,setDetail]=useState<Details|null>(null);
 const [found,setFound]=useState<Group[]>([]),[query,setQuery]=useState(''),[name,setName]=useState(''),[description,setDescription]=useState(''),[phone,setPhone]=useState(''),[initialError,setInitialError]=useState('');
 const {busy,error,run,mutate}=useOperation(manager);
 async function refresh(){const [a,b]=await Promise.all([manager.call<{groups:Group[]}>('groups_list'),manager.call<{requests:Request[]}>('groups_inbox')]);setGroups(a.groups);setInbox(b.requests);setInitialError('');}
 async function open(id:string){setDetail(await manager.call<Details>('groups_detail',{group_id:id}));}
 useEffect(()=>{let live=true;Promise.all([manager.call<{groups:Group[]}>('groups_list'),manager.call<{requests:Request[]}>('groups_inbox')]).then(([a,b])=>{if(!Array.isArray(a.groups)||!Array.isArray(b.requests))throw new Error('Serwer zwrócił nieprawidłową listę grup.');if(live){setGroups(a.groups);setInbox(b.requests);}}).catch(e=>{if(live)setInitialError(e instanceof Error?e.message:'Nie udało się pobrać grup.');});return()=>{live=false;};},[manager]);
 const admin=detail?.group.admin_id===userId;
 async function decide(request:Request,accept:boolean){await mutate('groups_decide',{id:request.id,accept});await refresh();if(detail)await open(detail.group.id);}
 return <><MatchHeader title="Grupy" onBack={detail?()=>setDetail(null):undefined} backLabel="Wróć do grup"/>
 {(error||initialError)&&<p role="alert" className="slm-error">⚠ {error||initialError}</p>}{busy&&<IonSpinner/>}
 <IonButton disabled={busy} fill="outline" onClick={()=>void run(async()=>{await refresh();if(detail)await open(detail.group.id);})}>Odśwież grupy</IonButton>
 {!groups&&!initialError&&<p role="status">Wczytywanie grup…</p>}
 {detail?<><section className="slm-group-hero"><div><h2>{detail.group.name}</h2><p>{detail.group.description}</p><span className="slm-group-role">{admin?'Administrator grupy':'Członek grupy'}</span></div></section>
 <section className="slm-panel"><h2>Członkowie</h2>{detail.members.map(m=><article className="slm-group-person" key={m.user_id}><strong>{m.nickname}</strong>{m.contact_phone&&<a className="slm-call" href={'tel:'+m.contact_phone}>Zadzwoń</a>}<span>{m.user_id===detail.group.admin_id?'Administrator':m.organizer?'Organizator':'Członek'}</span>
 {admin&&m.user_id!==userId&&<div className="slm-group-actions"><button disabled={busy} onClick={()=>void run(async()=>{await mutate('groups_permission',{group_id:detail.group.id,user_id:m.user_id,organizer:!m.organizer});await open(detail.group.id);})}>{m.organizer?'Odbierz':'Nadaj'} tworzenie meczów</button>
 <button disabled={busy} onClick={()=>{if(window.confirm('Przekazać administrację temu członkowi?'))void run(async()=>{await mutate('groups_transfer',{group_id:detail.group.id,user_id:m.user_id});await open(detail.group.id);});}}>Przekaż administrację</button>
 <button disabled={busy} onClick={()=>{if(window.confirm('Usunąć członka z grupy?'))void run(async()=>{await mutate('groups_remove',{group_id:detail.group.id,user_id:m.user_id});await open(detail.group.id);});}}>Usuń członka</button></div>}</article>)}</section>
 <section className="slm-panel"><h2>{admin?'Zaproś':'Zaproponuj zaproszenie'}</h2><form className="slm-form" onSubmit={e=>{e.preventDefault();void run(async()=>{await mutate('groups_phone',{group_id:detail.group.id,phone:normalizePolishPhone(phone)});setPhone('');await open(detail.group.id);});}}><label>Polski numer telefonu<input type="tel" required value={phone} onChange={e=>setPhone(e.target.value)}/></label><p>Żądanie zostanie przekazane, jeśli konto może otrzymać zaproszenie. Nie wysyłamy SMS-ów.</p><IonButton type="submit" disabled={busy}>Przekaż prośbę</IonButton></form></section>
 {admin&&<section className="slm-panel"><h2>Prośby i propozycje</h2>{detail.requests.filter(r=>r.state==='pending'&&r.kind!=='invite').map(r=><article key={r.id}><p>{r.kind==='join'?'Prośba o dołączenie':'Propozycja zaproszenia'}</p><IonButton disabled={busy} onClick={()=>void run(()=>decide(r,true))}>Akceptuj</IonButton><IonButton disabled={busy} onClick={()=>void run(()=>decide(r,false))}>Odrzuć</IonButton></article>)}</section>}
 <IonButton color="danger" disabled={busy} onClick={()=>{if(window.confirm('Opuścić grupę? Historia finansowa zostanie zachowana. Administrację przejmie kolejny uprawniony członek.'))void run(async()=>{await mutate('groups_leave',{group_id:detail.group.id});setDetail(null);await refresh();});}}>Opuść grupę</IonButton>
 </>:<><section className="slm-panel"><h2>Moje grupy</h2>{groups?.length===0&&<p>Nie należysz jeszcze do żadnej grupy.</p>}{groups?.map(g=><button className="slm-group-card" key={g.id} disabled={busy} onClick={()=>void run(()=>open(g.id))}><strong>{g.name}</strong><p>{g.description}</p></button>)}</section>
 <section className="slm-panel"><h2>Zaproszenia</h2>{!inbox.length&&<p>Brak oczekujących zaproszeń.</p>}{inbox.map(r=><article key={r.id}><strong>{r.group_name}</strong><IonButton disabled={busy} onClick={()=>void run(()=>decide(r,true))}>Dołącz</IonButton><IonButton disabled={busy} onClick={()=>void run(()=>decide(r,false))}>Odrzuć</IonButton></article>)}</section>
 <section className="slm-panel"><h2>Znajdź grupę</h2><form className="slm-form" onSubmit={e=>{e.preventDefault();void run(async()=>setFound((await manager.call<{groups:Group[]}>('groups_search',{query})).groups));}}><label>Nazwa grupy<input required minLength={2} maxLength={64} value={query} onChange={e=>setQuery(e.target.value)}/></label><IonButton type="submit" disabled={busy}>Szukaj</IonButton></form>{found.map(g=><article key={g.id}><h3>{g.name}</h3><p>{g.description}</p><IonButton disabled={busy||groups?.some(own=>own.id===g.id)} onClick={()=>void run(async()=>{await mutate('groups_join',{group_id:g.id});await refresh();})}>Poproś o dołączenie</IonButton></article>)}</section>
 <section className="slm-panel"><h2>Utwórz grupę</h2><form className="slm-form" onSubmit={e=>{e.preventDefault();void run(async()=>{const g=await mutate<{group_id:string}>('groups_create',{name,description});setName('');setDescription('');await refresh();await open(g.group_id);});}}><label>Nazwa<input required maxLength={64} value={name} onChange={e=>setName(e.target.value)}/></label><label>Opis<textarea maxLength={180} value={description} onChange={e=>setDescription(e.target.value)}/></label><IonButton type="submit" disabled={busy}>Utwórz grupę</IonButton></form></section></>}
 </>;
}

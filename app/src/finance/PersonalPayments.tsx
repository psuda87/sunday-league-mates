import {useEffect,useRef,useState} from 'react';
import type {SessionManager} from '../auth/sessionManager';
import {paymentWallet} from './contracts';
import type {WalletGroup} from './contracts';
import {usePremiumFinance} from './usePremiumFinance';
import {paymentChoices,receiptStatus} from './paymentModel';
import {formatCents,parseCents} from '../settlements/model';
import {matchDate} from '../events/model';
import './premiumFinance.css';

function OwnPaymentForm({manager,userId,group,onChanged}:{manager:SessionManager;userId:string;group:WalletGroup;onChanged:()=>void}){
 const f=usePremiumFinance(manager,userId,group.group_id,undefined,false,onChanged,false);
 const [tab,setTab]=useState<'pay'|'history'>('pay'),[amount,setAmount]=useState(''),[eventId,setEventId]=useState(''),[error,setError]=useState('');
 const choices=f.own?paymentChoices(f.own):[];
 const title=(id:string)=>group.events.find(e=>e.id===id)?.name??'Mecz';
 const pending=f.own?.payments.filter(p=>p.status==='pending')??[];
 const selected=choices.find(d=>d.event_id===eventId);
 const stale=!!eventId&&!selected;
 async function submit(){
  setError('');try{
   if(stale)throw Error('Ten mecz jest opłacony albo wpłata czeka już na decyzję. Wybierz ponownie.');
   if(!eventId&&pending.length)throw Error('Wpłata czeka już na decyzję administratora.');
   const cents=parseCents(amount);
   if(selected&&cents>selected.outstanding_cents)throw Error('Kwota przewyższa pozostałą należność za mecz.');
   if(await f.mutate('submit_payment',{amount_cents:cents,...(eventId?{event_id:eventId}:{})})){setAmount('');setEventId('');}
  }catch(ex){setError(ex instanceof Error?ex.message:'Sprawdź kwotę wpłaty.');}
 }
 return <div aria-busy={f.loading||f.busy}>
  {(error||f.error)&&<p role="alert">{error||f.error}</p>}{f.notice&&<p role="status">{f.notice}</p>}
  {f.loading&&<p role="status">Wczytywanie Twoich płatności…</p>}
  {f.own&&!f.loading&&<>
   <div role="tablist" aria-label="Moje płatności"><button role="tab" aria-selected={tab==='pay'} onClick={()=>setTab('pay')}>Zgłoś wpłatę</button><button role="tab" aria-selected={tab==='history'} onClick={()=>setTab('history')}>Historia wpłat</button></div>
   {tab==='pay'?<div role="tabpanel" aria-label="Zgłoszenie wpłaty">
    <p>Saldo: {formatCents(f.own.balance_cents)}</p>
    {f.own.dues.filter(d=>d.outstanding_cents>0).map(d=><p key={d.event_id}>{title(d.event_id)} · {matchDate(d.starts_at)} · do zapłaty {formatCents(d.outstanding_cents)}</p>)}
    {pending.map(p=><p key={p.id}>Zgłoszono {formatCents(p.corrected_amount_cents)} · {p.event_id?title(p.event_id):'wpłata ogólna'} · oczekiwanie na decyzję</p>)}
    {f.own.dues.some(d=>d.outstanding_cents>0)?<form className="slm-finance-form" aria-label="Zgłoś własną wpłatę" noValidate onSubmit={e=>{e.preventDefault();void submit();}}>
     <label>Kwota (zł)<input inputMode="decimal" autoComplete="off" value={amount} disabled={f.busy} onChange={e=>setAmount(e.target.value)}/></label>
     <label>Za który mecz? (opcjonalnie)<select value={eventId} disabled={f.busy} onChange={e=>{setEventId(e.target.value);setError('');}}><option value="">Wpłata ogólna w tej grupie</option>{stale&&<option value={eventId} disabled>Mecz niedostępny — wybierz ponownie</option>}{choices.map(d=><option key={d.event_id} value={d.event_id}>{title(d.event_id)} · {matchDate(d.starts_at)} · {formatCents(d.outstanding_cents)}</option>)}</select></label>
     <p>Zgłoszenie nie oznacza jeszcze zatwierdzenia wpłaty. Mecze opłacone lub ze zgłoszoną wpłatą nie są dostępne do ponownego wyboru.</p>
     {stale&&<p role="status">Poprzednio wybrany mecz nie jest już dostępny. Wybierz ponownie.</p>}
     <button type="submit" disabled={f.busy||stale||!amount||!eventId&&pending.length>0}>Zgłoś do zatwierdzenia</button>
    </form>:<p>Wszystkie należności są opłacone. Nie ma wpłaty do zgłoszenia.</p>}
   </div>:<div role="tabpanel" aria-label="Moja historia wpłat"><h3>Historia wpłat</h3>{!f.own.payments.length&&<p>Brak wpłat.</p>}{f.own.payments.map(p=><article className="slm-payment-card" key={p.id}><p>{p.event_id?title(p.event_id):'Wpłata ogólna'} · {formatCents(p.corrected_amount_cents)} · {receiptStatus(p)}</p></article>)}</div>}
  </>}
 </div>;
}

export default function PersonalPayments({manager,userId}:{manager:SessionManager;userId:string}){
 const [open,setOpen]=useState(false),[groups,setGroups]=useState<WalletGroup[]|null>(null),[groupId,setGroupId]=useState(''),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const generation=useRef(0);
 useEffect(()=>manager.subscribe(()=>{
  const auth=manager.getSnapshot();if(auth.phase!=='ready'||auth.session?.user_id!==userId){generation.current++;setGroups(null);}else setRevision(v=>v+1);
 }),[manager,userId]);
 useEffect(()=>{
  const ticket=++generation.current;if(!open)return;setError('');
  const auth=manager.getSnapshot();if(auth.phase!=='ready'||auth.session?.user_id!==userId)return;
  let alive=true;
  void manager.call('group_finance_wallet').then(value=>{
   if(!alive||ticket!==generation.current||manager.getSnapshot().phase!=='ready'||manager.getSnapshot().session?.user_id!==userId)return;
   const result=paymentWallet(value,userId);setGroups(result);setGroupId(previous=>result.some(g=>g.group_id===previous)?previous:result[0]?.group_id??'');
  }).catch(()=>{if(alive&&ticket===generation.current){setGroups(null);setError('Nie udało się odczytać Twoich płatności. Spróbuj ponownie.');}});
  return()=>{alive=false;};
 },[manager,userId,open,revision]);
 const group=groups?.find(g=>g.group_id===groupId);
 return <section className="slm-finance slm-premium-finance" aria-label="Płatności własnego profilu">
  <button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>Moje płatności</button>
  {open&&<><h2>Moje płatności</h2>{error&&<p role="alert">{error}</p>}{!groups&&!error&&<p role="status">Wczytywanie płatności…</p>}<button onClick={()=>setRevision(v=>v+1)}>Odśwież płatności</button>
   {groups?.length===0&&<p>Nie masz jeszcze rozliczeń w grupach.</p>}
   {groups&&groups.length>1?<label>Grupa<select value={groupId} onChange={e=>setGroupId(e.target.value)}>{groups.map(g=><option key={g.group_id} value={g.group_id}>{g.group_name}</option>)}</select></label>:group&&<p>{group.group_name}</p>}
   {group&&<OwnPaymentForm key={`${userId}:${group.group_id}`} manager={manager} userId={userId} group={group} onChanged={()=>setRevision(v=>v+1)}/>}
  </>}
 </section>;
}

import './premiumFinance.css';
import {useState} from 'react';
import type {SessionManager} from '../auth/sessionManager';
import {usePremiumFinance} from './usePremiumFinance';
import {formatCents,ledgerKind} from '../settlements/model';
import {matchDate} from '../events/model';
import {receiptStatus} from './paymentModel';
export default function PremiumFinance({manager,userId,groupId,eventId,manage=false,onChanged}:{manager:SessionManager;userId:string;groupId:string;eventId?:string;manage?:boolean;onChanged?:()=>void}){
 const f=usePremiumFinance(manager,userId,groupId,eventId,manage,onChanged);
 const [tab,setTab]=useState<'current'|'history'>('current');
 const admin=!!f.own&&f.own.surplus!==null;
 const title=(id:string)=>f.events.find(e=>e.id===id)?.name??'Mecz';
 const people=f.players.filter(p=>!eventId||f.detail?.participants.some(r=>r.user_id===p.user_id));
 const history=admin?people.flatMap(p=>p.account.payments.map(receipt=>({receipt,name:p.name}))):f.own?.payments.map(receipt=>({receipt,name:'Twoja wpłata'}))??[];
 return <section className="slm-finance slm-premium-finance" aria-label="Płatności" aria-busy={f.loading||f.busy}>
  <div className="slm-finance-list-heading"><h2>Płatności</h2><button type="button" disabled={f.busy||f.loading} onClick={()=>{void f.reload();}}>Odśwież</button></div>
  {f.error&&<p role="alert">{f.error}</p>}{f.notice&&<p role="status">{f.notice}</p>}{f.loading&&<p role="status">Wczytywanie płatności…</p>}
  {f.own&&!f.loading&&<>
   <div role="tablist" aria-label="Widok płatności"><button role="tab" aria-selected={tab==='current'} onClick={()=>setTab('current')}>Bieżące płatności</button><button role="tab" aria-selected={tab==='history'} onClick={()=>setTab('history')}>Historia wpłat</button></div>
   {tab==='current'?<div role="tabpanel" aria-label="Bieżące płatności">
    <p>Twoje saldo: <strong>{formatCents(f.own.balance_cents)}</strong></p>
    {!admin&&<><p>Zgłoszenie wpłaty znajdziesz w swoim profilu, w sekcji „Moje płatności”.</p>{f.own.dues.filter(d=>!eventId||d.event_id===eventId).map(d=><p key={d.event_id}>{matchDate(d.starts_at)} · {d.outstanding_cents>0?'Do zapłaty':'Opłacono'}: {formatCents(d.outstanding_cents)}</p>)}</>}
    {f.detail&&!f.detail.event.approved_at&&<article className="slm-payment-card"><h3>Rozliczenie meczu</h3><p>Koszt {formatCents(f.detail.event.cost_cents)}. Składki zostaną naliczone po zatwierdzeniu zakończonego meczu.</p><button disabled={f.busy} onClick={()=>{void f.mutate('approve',{event_id:eventId,expected_version:f.detail!.event.version});}}>Zatwierdź zakończony mecz</button></article>}
    {admin&&people.map(person=>{
     const dues=person.account.dues.filter(d=>!eventId||d.event_id===eventId);
     const payments=person.account.payments.filter(p=>!eventId||p.event_id===null||p.event_id===eventId);
     const pending=payments.filter(p=>p.status==='pending');
     const accepted=payments.filter(p=>p.status==='accepted'&&p.corrected_amount_cents>0);
     return <article className="slm-payment-card" key={person.user_id} aria-label={`Płatności: ${person.name}`}>
      <h3>{person.name}{person.user_id===userId?' · Ty':''}</h3>
      {!dues.length&&<p>Brak zatwierdzonych należności.</p>}
      {dues.map(d=>{
       const awaiting=pending.some(p=>p.event_id===null||p.event_id===d.event_id);
       return <div className="slm-payment-line" key={d.event_id}><p><strong>{title(d.event_id)}</strong><br/>{matchDate(d.starts_at)} · {d.outstanding_cents===0?'✓ Opłacono':d.covered_cents>0?'Częściowo opłacono':'Do zapłaty'} · pozostało {formatCents(d.outstanding_cents)}</p>
        {d.outstanding_cents>0&&!d.legacy&&<button disabled={f.busy||awaiting} onClick={()=>{void f.mutate('record_payment',{event_id:d.event_id,user_id:person.user_id,amount_cents:d.outstanding_cents});}}>Oznacz jako opłacone</button>}
       </div>;
      })}
      {pending.map(p=>{
       const remaining=person.account.dues.filter(d=>p.event_id===null||d.event_id===p.event_id).reduce((sum,d)=>sum+d.outstanding_cents,0);
       return <div className="slm-payment-receipt" key={p.id}><p><strong>Zgłoszono wpłatę: {formatCents(p.corrected_amount_cents)}</strong> · {p.event_id?title(p.event_id):'Wpłata ogólna'}</p>
        <div className="slm-payment-actions"><button disabled={f.busy||remaining<=0||p.event_id!==null&&p.corrected_amount_cents>remaining} onClick={()=>{void f.mutate('accept_payment',{payment_id:p.id,expected_amount_cents:p.corrected_amount_cents,...(p.event_id?{event_id:p.event_id}:{})});}}>Akceptuj wpłatę</button><button disabled={f.busy} onClick={()=>{void f.mutate('reject_payment',{payment_id:p.id,...(p.event_id?{event_id:p.event_id}:{})});}}>Odrzuć wpłatę</button></div>
        {remaining===0&&<small>Należność została już pokryta. Odrzuć nieaktualne zgłoszenie.</small>}
       </div>;
      })}
      {accepted.map(p=><div className="slm-payment-line" key={p.id}><p>✓ Opłacono {formatCents(p.corrected_amount_cents)} · {p.event_id?title(p.event_id):'Wpłata ogólna'}</p><button disabled={f.busy} onClick={()=>{void f.mutate('cancel_payment',{payment_id:p.id,expected_amount_cents:p.corrected_amount_cents,...(p.event_id?{event_id:p.event_id}:{})});}}>Anuluj wpłatę</button></div>)}
     </article>;
    })}
   </div>:<div role="tabpanel" aria-label="Historia wpłat">
    <h3>Historia wpłat</h3>{!history.length&&<p>Brak wpłat.</p>}
    {history.filter(({receipt:p})=>!eventId||p.event_id===null||p.event_id===eventId).map(({receipt:p,name})=><article className="slm-payment-card" key={p.id}><strong>{name}</strong><p>{formatCents(p.corrected_amount_cents)} · {receiptStatus(p)} · {p.event_id?title(p.event_id):'Wpłata ogólna'}</p></article>)}
    <h3>Twoje operacje księgowe</h3>{f.own.history.filter(h=>!eventId||h.event_id===eventId).map(h=><p key={h.id}>{matchDate(h.created_at)} · {ledgerKind[h.kind as keyof typeof ledgerKind]??'Operacja'} · {formatCents(h.amount_cents)}</p>)}
   </div>}
  </>}
 </section>;
}

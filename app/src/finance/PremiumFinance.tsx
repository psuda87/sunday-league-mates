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
     const dues=person.account.dues.filter(d=>(!eventId||d.event_id===eventId)&&d.outstanding_cents>0);
     const payments=person.account.payments.filter(p=>!eventId||p.event_id===null||p.event_id===eventId);
     const pending=payments.filter(p=>p.status==='pending');
     const accepted=payments.filter(p=>p.status==='accepted'&&p.corrected_amount_cents>0);
     const items=[...dues.map(d=>({due:d,payment:pending.find(p=>p.event_id===d.event_id)})),...pending.filter(p=>!dues.some(d=>d.event_id===p.event_id)).map(payment=>({due:undefined,payment}))];
     return items.map(({due:d,payment:p})=>{
      const id=d?.event_id??p?.event_id;
      const remaining=person.account.dues.filter(d=>!id||d.event_id===id).reduce((sum,d)=>sum+d.outstanding_cents,0);
      const previous=accepted.find(r=>r.event_id===id);
      const generalPending=!p&&pending.some(r=>r.event_id===null);
      const covered=remaining<=0;
      return <article className="slm-payment-card" key={`${person.user_id}:${d?.event_id??p!.id}`} aria-label={`Płatności: ${person.name}`}>
       <h3>{person.name}{person.user_id===userId?' · Ty':''}</h3>
       <p><strong>{id?title(id):'Wpłata ogólna'}</strong>{d&&<><br/>{matchDate(d.starts_at)}</>}<br/>Do zapłaty: {formatCents(remaining)}</p>
       <p className="slm-payment-report">{p?`Zgłoszono wpłatę: ${formatCents(p.corrected_amount_cents)}`:generalPending?'Zgłoszono wpłatę ogólną — rozpatrz jej kafelek.':'Brak zgłoszenia wpłaty'}</p>
       <div className="slm-payment-actions" role="group" aria-label="Decyzje dotyczące wpłaty">
        <button className={`slm-payment-accept ${p?'is-reported':'is-unreported'}`} aria-label={p?'Akceptuj zgłoszoną wpłatę':'Akceptuj wpłatę bez zgłoszenia'} disabled={f.busy||covered||generalPending||!!d?.legacy||!!p&&p.event_id!==null&&p.corrected_amount_cents>remaining} onClick={()=>{void(p?f.mutate('accept_payment',{payment_id:p.id,expected_amount_cents:p.corrected_amount_cents,...(p.event_id?{event_id:p.event_id}:{})}):f.mutate('record_payment',{event_id:d!.event_id,user_id:person.user_id,amount_cents:d!.outstanding_cents}));}}>{p?'Potwierdź zgłoszenie':'Oznacz jako opłacone'}</button>
        <button disabled={f.busy||!p} onClick={()=>{if(p)void f.mutate('reject_payment',{payment_id:p.id,...(p.event_id?{event_id:p.event_id}:{})});}}>Odrzuć</button>
        <button disabled={f.busy||!previous} title={previous?'Cofnij zatwierdzoną wpłatę':'Nie ma zatwierdzonej wpłaty do anulowania'} onClick={()=>{if(previous)void f.mutate('cancel_payment',{payment_id:previous.id,expected_amount_cents:previous.corrected_amount_cents,...(previous.event_id?{event_id:previous.event_id}:{})});}}>Anuluj</button>
       </div>
       {p&&covered&&<small>Wpłata została już zaksięgowana. To zgłoszenie jest nieaktualne — odrzuć tylko zgłoszenie; nie anuluj zaksięgowanej wpłaty.</small>}
       {!p&&previous&&covered&&<small>Opłacono — wpłata jest zaksięgowana.</small>}
      </article>;
     });
    })}
   </div>:<div role="tabpanel" aria-label="Historia wpłat">
    <h3>Historia wpłat</h3>{!history.length&&<p>Brak wpłat.</p>}
    {history.filter(({receipt:p})=>!eventId||p.event_id===null||p.event_id===eventId).map(({receipt:p,name})=><article className="slm-payment-card" key={p.id}><h3>{name}</h3><p>{p.event_id?title(p.event_id):'Wpłata ogólna'}<br/>{formatCents(p.corrected_amount_cents)} · {receiptStatus(p)}</p>{admin&&<div className="slm-payment-actions" role="group" aria-label="Decyzje dotyczące wpłaty">{p.status==='pending'?<><span>Zgłoszenie oczekuje na decyzję — nie zostało zaksięgowane.</span><button disabled={f.busy} onClick={()=>{void f.mutate('reject_payment',{payment_id:p.id,...(p.event_id?{event_id:p.event_id}:{})});}}>Odrzuć zgłoszenie</button></>:p.status==='accepted'&&p.corrected_amount_cents>0?<button disabled={f.busy} onClick={()=>{void f.mutate('cancel_payment',{payment_id:p.id,expected_amount_cents:p.corrected_amount_cents,...(p.event_id?{event_id:p.event_id}:{})});}}>Cofnij zaksięgowaną wpłatę</button>:<span>Brak aktywnej wpłaty do cofnięcia.</span>}</div>}</article>)}
    <h3>Twoje operacje księgowe</h3>{f.own.history.filter(h=>!eventId||h.event_id===eventId).map(h=><p key={h.id}>{matchDate(h.created_at)} · {ledgerKind[h.kind as keyof typeof ledgerKind]??'Operacja'} · {formatCents(h.amount_cents)}</p>)}
   </div>}
  </>}
 </section>;
}

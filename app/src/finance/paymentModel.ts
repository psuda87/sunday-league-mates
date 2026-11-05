import type {Account,Receipt} from './contracts';
export const receiptStatus=(p:Receipt)=>p.status==='accepted'&&p.corrected_amount_cents===0?'Anulowana':p.status==='accepted'?'Opłacono':p.status==='pending'?'Zgłoszono wpłatę':'Odrzucona';
export function isSettledReport(a:Account,p:Receipt){
 const dues=a.dues.filter(d=>p.event_id===null||d.event_id===p.event_id);
 return p.status==='pending'&&dues.length>0&&dues.every(d=>d.outstanding_cents===0);
}
export function paymentChoices(a:Account){
 return a.dues.filter(d=>!d.legacy&&d.outstanding_cents>0&&!a.payments.some(p=>p.status==='pending'&&(p.event_id===null||p.event_id===d.event_id)));
}

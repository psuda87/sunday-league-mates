import type {Account,Receipt,WalletGroup} from './contracts';
export const receiptStatus=(p:Receipt)=>p.status==='accepted'&&p.corrected_amount_cents===0?'Anulowana':p.status==='accepted'?'Opłacono':p.status==='pending'?'Zgłoszono wpłatę':'Odrzucona';
export function isSettledReport(a:Account,p:Receipt){
 const dues=a.dues.filter(d=>p.event_id===null||d.event_id===p.event_id);
 return p.status==='pending'&&dues.length>0&&dues.every(d=>d.outstanding_cents===0);
}
export function paymentChoices(a:Account){
 return a.dues.filter(d=>!d.legacy&&d.outstanding_cents>0&&!a.payments.some(p=>p.status==='pending'&&(p.event_id===null||p.event_id===d.event_id)));
}

export interface OutstandingMatch {group_id:string;group_name:string;event_id:string;name:string|null;starts_at:string;outstanding_cents:number}
// Bell reminder: every match with money still owed, unless a payment report for it (or a general one) awaits the admin.
export function outstandingMatches(wallet:WalletGroup[]):OutstandingMatch[]{
 return wallet.flatMap(g=>g.account.dues.filter(d=>d.outstanding_cents>0&&!g.account.payments.some(p=>p.status==='pending'&&(p.event_id===null||p.event_id===d.event_id)))
  .map(d=>({group_id:g.group_id,group_name:g.group_name,event_id:d.event_id,name:g.events.find(e=>e.id===d.event_id)?.name??null,starts_at:d.starts_at,outstanding_cents:d.outstanding_cents})))
  .sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
}
export const paidRegistrationBlocked=(wallet:WalletGroup[])=>wallet.some(g=>!g.account.registration_allowed);

// DTO validation only; accounting and allocation remain on the server.
export interface Receipt {id:string;group_id:string;event_id:string|null;user_id:string;corrected_amount_cents:number;status:'pending'|'accepted'|'rejected'}
export interface Due {event_id:string;starts_at:string;due_cents:number;covered_cents:number;outstanding_cents:number;legacy?:boolean}
export interface History {id:number;event_id:string|null;user_id:string;group_id:string;amount_cents:number;kind:string;reason:string;created_at:string}
export interface Account {group_id:string;user_id:string;balance_cents:number;registration_allowed:boolean;dues:Due[];payments:Receipt[];history:History[];surplus:null|{event_id:string;assessed_cents:number;received_cents:number}[]}
export interface Detail {event:{id:string;group_id:string;version:number;approved_at:string|null;cost_cents:number};participants:{entry_id:string;user_id:string;name:string;payable:boolean;amount_cents:number}[];payments:Receipt[];surplus:Account['surplus']}
const row=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid financial DTO');return v as Record<string,unknown>;};
const text=(v:unknown)=>typeof v==='string'&&!!v;
const cents=(v:unknown)=>Number.isSafeInteger(v);
function receipt(v:unknown,g:string):Receipt {const p=row(v);if(!text(p.id)||p.group_id!==g||!text(p.user_id)||!(p.event_id===null||text(p.event_id))||!cents(p.corrected_amount_cents)||Number(p.corrected_amount_cents)<0||!['pending','accepted','rejected'].includes(String(p.status)))throw Error('Invalid receipt');return p as unknown as Receipt;}
export function account(v:unknown,g:string,u:string):Account {
 const a=row(v);if(a.group_id!==g||a.user_id!==u||!cents(a.balance_cents)||typeof a.registration_allowed!=='boolean'||!Array.isArray(a.dues)||!Array.isArray(a.payments)||!Array.isArray(a.history)||!(a.surplus===null||Array.isArray(a.surplus)))throw Error('Invalid account');
 for(const d of a.dues){const r=row(d);if(!text(r.event_id)||!text(r.starts_at)||!Number.isFinite(Date.parse(String(r.starts_at)))||!['due_cents','covered_cents','outstanding_cents'].every(k=>cents(r[k])&&Number(r[k])>=0))throw Error('Invalid due');}
 const payments=a.payments.map(p=>receipt(p,g));if(payments.some(p=>p.user_id!==u))throw Error('Foreign payments');
 for(const h of a.history){const r=row(h);if(r.group_id!==g||r.user_id!==u||!cents(r.amount_cents)||!text(r.kind)||!text(r.reason)||!text(r.created_at))throw Error('Foreign history');}
 return {...a,payments} as unknown as Account;
}
export function detail(v:unknown,g:string,e:string):Detail {
 const d=row(v),m=row(d.event);if(m.id!==e||m.group_id!==g||!cents(m.version)||!cents(m.cost_cents)||!(m.approved_at===null||text(m.approved_at))||!Array.isArray(d.participants)||!Array.isArray(d.payments)||!(d.surplus===null||Array.isArray(d.surplus)))throw Error('Invalid settlement');
 for(const p of d.participants){const r=row(p);if(!text(r.entry_id)||!text(r.user_id)||!text(r.name)||typeof r.payable!=='boolean'||!cents(r.amount_cents)||Number(r.amount_cents)<0)throw Error('Invalid share');}
 return {...d,payments:d.payments.map(p=>receipt(p,g))} as unknown as Detail;
}
export function receipts(v:unknown,g:string):Receipt[]{const d=row(v);if(!Array.isArray(d.payments))throw Error('Invalid pending payments');return d.payments.map(p=>receipt(p,g));}

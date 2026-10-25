import type { GroupDetail,GroupIdentity,GroupMember,GroupRequest,GroupSummary } from './model';
const row=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Nieprawidłowy kontrakt grup B3.');return value as Record<string,unknown>;};
const text=(value:unknown)=>typeof value==='string';
const count=(value:unknown)=>Number.isInteger(value)&&Number(value)>=0;
export function identity(value:unknown):GroupIdentity {
 const g=row(value);if(!text(g.id)||!g.id||!text(g.name)||!g.name||!text(g.description)||!text(g.admin_id))throw Error('Nieprawidłowy kontrakt grup B3.');return g as unknown as GroupIdentity;
}
export function summary(value:unknown):GroupSummary {
 const g=row(value);identity(g);if(typeof g.organizer!=='boolean'||!count(g.member_count)||Number(g.member_count)<1||!count(g.pending_count))throw Error('Backend nie udostępnia pełnego kontraktu grup B3.');return g as unknown as GroupSummary;
}
export function member(value:unknown):GroupMember {
 const m=row(value);if(!text(m.user_id)||!text(m.nickname)||!m.nickname||!(m.full_name===null||text(m.full_name))||!(m.contact_phone===null||text(m.contact_phone))||!text(m.joined_at)||typeof m.organizer!=='boolean'||typeof m.share_full_name!=='boolean'||!(m.jersey_number===null||count(m.jersey_number)&&Number(m.jersey_number)<=99))throw Error('Nieprawidłowa projekcja prywatności profilu.');return m as unknown as GroupMember;
}
export function requests(value:unknown):GroupRequest[]{
 if(!Array.isArray(value))throw Error('Nieprawidłowa lista zgłoszeń.');
 return value.map(v=>{const r=row(v);if(!text(r.id)||!text(r.group_id)||!['invite','proposal','join'].includes(String(r.kind))||!['pending','accepted','rejected','cancelled'].includes(String(r.state)))throw Error('Nieprawidłowa lista zgłoszeń.');return r as unknown as GroupRequest;});
}
export function details(value:unknown,groupId:string,userId:string):GroupDetail {
 const d=row(value),group=identity(d.group);if(group.id!==groupId||!Array.isArray(d.members))throw Error('Nieprawidłowa grupa.');
 const members=d.members.map(member);if(!members.some(m=>m.user_id===userId))throw Error('Nie potwierdzono członkostwa.');return {group,members,requests:requests(d.requests)};
}

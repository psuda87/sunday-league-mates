import type { Match, Participant } from './model';
import { AccountError } from '../auth/api';

export interface EventSummary {
  id:string; group_id:string; group_name:string; created_by:string; name:string;
  visibility:'public'|'private'; starts_at:string; location:string;
  status:'scheduled'|'cancelled'; access:'full'|'own'|'none'; own_participation:boolean;
  duration_minutes?:number; capacity?:number; cost_cents?:number; minimum_players?:number;
  registered_count?:number|null; reserve_count?:number|null; registration_open?:boolean;
  current_group_member?:boolean; own_history?:boolean; decision_required?:boolean; can_manage?:boolean; can_edit?:boolean; version?:number;
}
export interface MatchEntry extends Omit<Participant,'status'|'contact_phone'> {
  status:'registered'|'reserve'|'withdrawn'; contact_phone:string|null; joined_at:string;
}
export interface MatchDetail {event:EventSummary;participants:MatchEntry[];server_now:string;can_register_paid:boolean}
const row=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid match contract');return v as Record<string,unknown>;};
const text=(v:unknown)=>typeof v==='string'&&v.length>0;
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
export function eventSummary(value:unknown):EventSummary {
  const r=row(value);
  if(!['id','group_id','group_name','created_by','name','location'].every(k=>text(r[k]))||!text(r.starts_at)||!Number.isFinite(Date.parse(String(r.starts_at)))||!['public','private'].includes(String(r.visibility))||!['scheduled','cancelled'].includes(String(r.status))||!['full','own','none'].includes(String(r.access))||typeof r.own_participation!=='boolean')throw Error('Invalid match contract');
  if(r.access!=='none'){
    if(!['duration_minutes','capacity','cost_cents','minimum_players','version'].every(k=>integer(r[k]))||!['registration_open','decision_required','can_manage','can_edit'].every(k=>typeof r[k]==='boolean'))throw Error('Incomplete match contract');
    if(r.access==='full'&&(!integer(r.registered_count)||!integer(r.reserve_count)))throw Error('Missing authorized counts');
  }
  for(const key of ['own_history','current_group_member'])if(r[key]!==undefined&&typeof r[key]!=='boolean')throw Error('Invalid event privacy flags');
  return r as unknown as EventSummary;
}
export function matchList(value:unknown,requireDiscovery=false,offset=0){
  const r=row(value);if(!Array.isArray(r.events)||!text(r.server_now)||!Number.isFinite(Date.parse(String(r.server_now))))throw Error('Invalid match list');
  if(r.member_creation_enabled!==undefined&&typeof r.member_creation_enabled!=='boolean')throw Error('Invalid creation capability');
  const events=r.events.map(eventSummary);if(new Set(events.map(e=>e.id)).size!==events.length)throw Error('Duplicate match identifiers');
  const discovery=r.public_discovery_version===1;
  if(requireDiscovery&&!discovery)throw Error('Discovery backend unavailable');
  if(discovery&&(r.offset!==offset||r.limit!==100||events.length>100||typeof r.has_more!=='boolean'||
    (r.has_more?(events.length!==100||r.next_offset!==offset+100):r.next_offset!==null)))throw Error('Invalid discovery page');
  return {events,server_now:r.server_now as string,memberCreationEnabled:r.member_creation_enabled===true,
    discovery,hasMore:discovery?r.has_more===true:events.length===100,nextOffset:discovery?(r.next_offset as number|null):(events.length===100?offset+100:null)};
}
export function matchDetail(value:unknown,id:string):MatchDetail {
  const r=row(value),event=eventSummary(r.event);
  if(event.id!==id||!Array.isArray(r.participants)||!text(r.server_now)||!Number.isFinite(Date.parse(String(r.server_now))))throw Error('Invalid match detail');
  if(event.access==='none'){if(r.participants.length)throw Error('Private roster exposed');return {event,participants:[],server_now:r.server_now as string,can_register_paid:false};}
  if(typeof r.can_register_paid!=='boolean')throw Error('Missing registration permission');
  const participants=r.participants.map(v=>{
    const p=row(v);
    if(!text(p.id)||!(p.member_id===null||text(p.member_id))||!text(p.responsible_user_id)||!text(p.display_name)||!text(p.responsible_name)||!['registered','reserve','withdrawn'].includes(String(p.status))||typeof p.absent!=='boolean'||!(p.contact_phone===null||typeof p.contact_phone==='string')||!text(p.joined_at)||!Number.isFinite(Date.parse(String(p.joined_at))))throw Error('Invalid roster');
    return p as unknown as MatchEntry;
  });
  if(new Set(participants.map(p=>p.id)).size!==participants.length)throw Error('Duplicate roster identifiers');
  if(event.access==='full'&&(participants.filter(p=>p.status==='registered').length!==event.registered_count||participants.filter(p=>p.status==='reserve').length!==event.reserve_count))throw Error('Inconsistent roster');
  return {event,participants,server_now:r.server_now as string,can_register_paid:r.can_register_paid};
}
// Only authorized full DTOs can enter the existing public visual component.
export function heroMatch(e:EventSummary):Match {
  if(e.access!=='full')throw Error('No public roster projection');
  return {...e,duration_minutes:e.duration_minutes!,capacity:e.capacity!,hourly_rate:e.cost_cents!*60/(100*e.duration_minutes!),total_cost:e.cost_cents!/100,
    registered_count:e.registered_count!,reserve_count:e.reserve_count!,registration_open:e.registration_open!,decision_required:e.decision_required!,cutoff_at:'',estimated_per_person:null,settlements_active:true};
}
export function matchError(error:unknown):string {
  const code=error instanceof AccountError?error.code:'';
  return ({event_full:'Ostatnie miejsce zostało zajęte. Odśwież mecz i dołącz do rezerwy.',registration_blocked:'Dwie kwalifikujące się zaległości blokują nowe zapisy na płatne mecze.',registration_closed:'Zapisy są już zamknięte.',forbidden:'Nie masz uprawnień do tej operacji.',stale_version:'Mecz został zmieniony. Odśwież dane.',duplicate_signup:'Ten udział już istnieje. Odśwież mecz.',invalid_phone:'Sprawdź numer telefonu gościa.'} as Record<string,string>)[code]??'Nie udało się potwierdzić danych. Odśwież i spróbuj ponownie.';
}

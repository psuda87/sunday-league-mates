import type { EventSummary } from './premiumContracts';
export function visiblePremiumEvents(events:EventSummary[],groups:{id:string}[],serverNow:string,period:'upcoming'|'history'|'mine',scope:string){
 const memberships=new Set(groups.map(g=>g.id)),now=Date.parse(serverNow);
 return events.filter(m=>{
  const member=memberships.has(m.group_id),history=m.status==='cancelled'||Date.parse(m.starts_at)<=now;
  const own=m.own_history??m.own_participation;
  // Defense in depth also protects clients against the previous, overly broad list DTO.
  if(history?!(member||own):!(member||m.visibility==='public'))return false;
  if(m.access==='none')return false;
  if(scope==='public'&&m.visibility!=='public'||scope==='mine'&&!own)return false;
  if(scope&&!['public','mine'].includes(scope)&&m.group_id!==scope)return false;
  return period==='history'?history:!history&&(period!=='mine'||m.own_participation);
 }).sort((a,b)=>period==='history'?b.starts_at.localeCompare(a.starts_at):a.starts_at.localeCompare(b.starts_at));
}

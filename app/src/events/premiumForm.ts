import { eventInstant,localEventTime } from '../demo/eventDraft';
import type { EventInput } from '../demo/eventDraft';
export function premiumDefaults(serverNow:string,groupId=''):EventInput {
  const now=Date.parse(serverNow),day=new Date(localEventTime(now).date+'T12:00:00Z');
  let startsAt='';
  for(let n=0;n<8;n++){
    const date=new Date(day);date.setUTCDate(day.getUTCDate()+n);
    if(![0,4].includes(date.getUTCDay()))continue;
    const candidate=eventInstant(date.toISOString().slice(0,10),'18:00');
    if(candidate&&Date.parse(candidate)>now){startsAt=candidate;break;}
  }
  // A suggestion only. The original form keeps date/time editable; pitch/capacity are entered by the organizer.
  return {groupId,visibility:'private',name:'',startsAt,location:'',address:'',durationMinutes:90,minimum:10,capacity:0,costCents:27000};
}

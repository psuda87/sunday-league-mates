// Demo-only input contract. No production events, API or persistence.
export interface EventInput {
  groupId:string; visibility:'private'|'public'; name:string; startsAt:string; location:string; address:string;
  durationMinutes:number; minimum:number; capacity:number; costCents:number;
}
export const eventZone='Europe/Warsaw';
const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:eventZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function localEventTime(instant:string|number) {
  const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
export function eventInstant(date:string,time:string):string|null {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;
  const [year,month,day]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number);
  const nominal=Date.UTC(year,month-1,day,hour,minute);
  if(new Date(nominal).toISOString().slice(0,16)!==`${date}T${time}`)return null;
  // Try the offsets around this day, round-trip, and reject missing/ambiguous DST times.
  const candidates=new Set<number>();
  for(const offset of [1,2]) {
    const instant=nominal-offset*3600000,local=localEventTime(instant);
    if(local.date===date&&local.time===time)candidates.add(instant);
  }
  return candidates.size===1?new Date([...candidates][0]).toISOString():null;
}
export function validateEvent(input:EventInput,occupied=0,now=Date.now()):string[] {
  const errors:string[]=[];
  if(!['private','public'].includes(input.visibility))errors.push('Wybierz widoczność prywatną lub publiczną.');
  if(!Number.isFinite(Date.parse(input.startsAt))||Date.parse(input.startsAt)<=now)errors.push('Wybierz przyszłą datę i godzinę meczu.');
  if(!Number.isSafeInteger(input.durationMinutes)||input.durationMinutes<=0||input.durationMinutes>1440)errors.push('Czas trwania: liczba całkowita od 1 do 1440 minut.');
  if(!Number.isSafeInteger(input.minimum)||input.minimum<=0)errors.push('Minimum musi być dodatnią liczbą całkowitą.');
  if(!Number.isSafeInteger(input.capacity)||input.capacity<input.minimum||input.capacity<=0||input.capacity>100)errors.push('Limit musi wynosić od minimum do 100 osób.');
  if(input.capacity<occupied)errors.push(`Limit nie może być mniejszy niż liczba zapisanych (${occupied}).`);
  if(!Number.isSafeInteger(input.costCents)||input.costCents<0||input.costCents>100000000)errors.push('Koszt: poprawna kwota od 0 do 1 000 000 zł, maksymalnie dwa miejsca po przecinku.');
  if(!input.location.trim())errors.push('Podaj miejsce meczu.');
  if(input.name.length>80||input.location.length>120||input.address.length>180)errors.push('Skróć nazwę (80), miejsce (120) lub adres (180 znaków).');
  if([input.name,input.location,input.address].some(s=>Array.from(s).some(char=>char.codePointAt(0)!<32||char.codePointAt(0)===127||char==='<'||char==='>')))errors.push('Usuń niedozwolone znaki z pól tekstowych.');
  return errors;
}
export function defaultEvent(now=Date.now()):EventInput {
  const date=localEventTime(now+86400000).date;
  return {groupId:'',visibility:'private',name:'',startsAt:eventInstant(date,'18:00')!,location:'Boisko przy ul. Harcerskiej 1',address:'Harcerska 1, Chorzów',durationMinutes:90,minimum:10,capacity:15,costCents:27000};
}

// Explicit demo presentation: independent of the OS/browser locale. Internal dates stay ISO.
export const displayEventDate=(iso:string)=>iso.split('-').reverse().join('.');
export function parseEventDate(value:string):string|null {
 if(!/^\d{2}\.\d{2}\.\d{4}$/.test(value))return null;
 const [day,month,year]=value.split('.'),iso=`${year}-${month}-${day}`;
 return eventInstant(iso,'12:00')?iso:null;
}
export const formatEventDateTime=(instant:string)=>new Intl.DateTimeFormat('pl-PL',{timeZone:eventZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(instant));

// Numeric keyboards can enter digits only; separators are visual, never OS date widgets.
export function dateEntry(value:string) {
 if(!/^[\d.,]*$/.test(value))return value;
 const digits=value.replace(/\D/g,'').slice(0,8);
 return [digits.slice(0,2),digits.slice(2,4),digits.slice(4)].filter(Boolean).join('.');
}
export function timeEntry(value:string) {
 if(!/^[\d:]*$/.test(value))return value;
 const digits=value.replace(/\D/g,'').slice(0,4);
 return [digits.slice(0,2),digits.slice(2)].filter(Boolean).join(':');
}

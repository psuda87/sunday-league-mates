import { useEffect, useRef, useState } from 'react';
import MatchHeader from '../ui/MatchHeader';
import MatchHero from '../ui/MatchHero';
import type { Match } from '../events/model';
import { canManageDemoEvents, parseDemoMoney, registered } from './data';
import type { Game, World } from './data';
import { defaultEvent, eventInstant, localEventTime, validateEvent } from './eventDraft';
import type { EventInput } from './eventDraft';

export default function EventForm({world,game,onBack,onSave}:{world:World;game?:Game;onBack:()=>void;onSave:(input:EventInput,key:string)=>void}) {
  const initial=game?{...defaultEvent(),...game,location:game.location??'Boisko demonstracyjne',address:game.address??'',durationMinutes:game.durationMinutes??90,minimum:game.minimum??10}:defaultEvent();
  const local=localEventTime(initial.startsAt);
  const [draft,setDraft]=useState({name:initial.name, date:local.date,time:local.time,location:initial.location,address:initial.address,durationMinutes:String(initial.durationMinutes),minimum:String(initial.minimum),capacity:String(initial.capacity),cost:(initial.costCents/100).toFixed(2).replace('.',',')});
  const [errors,setErrors]=useState<string[]>([]),[preview,setPreview]=useState<EventInput|null>(null);
  const key=useRef(crypto.randomUUID()),saving=useRef(false),errorBox=useRef<HTMLDivElement>(null);
  useEffect(()=>{const host=errorBox.current?.closest('ion-content')??document.querySelector('.slm-event-form')?.closest('ion-content');void host?.scrollToTop?.(0);const heading=document.querySelector<HTMLElement>('.slm-event-form h1');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});},[preview]);
  const update=(name:keyof typeof draft,value:string)=>{setDraft(previous=>({...previous,[name]:value}));setErrors([]);};
  if(!canManageDemoEvents(world))return <section className="slm-event-form"><MatchHeader title="Nowy mecz" onBack={onBack}/><p role="alert">Formularz jest dostępny tylko dla administratora demo.</p></section>;
  const field=(name:keyof typeof draft,label:string,type='text',extra:Record<string,string|number>={})=><label htmlFor={`event-${name}`}><span>{label}</span><input id={`event-${name}`} name={name} type={type} value={draft[name]} onChange={e=>update(name,e.target.value)} {...extra}/></label>;
  function review(event:React.FormEvent) {
    event.preventDefault();
    const startsAt=eventInstant(draft.date,draft.time);
    const input:EventInput={name:draft.name,startsAt:startsAt??'',location:draft.location,address:draft.address,durationMinutes:Number(draft.durationMinutes||NaN),minimum:Number(draft.minimum||NaN),capacity:Number(draft.capacity||NaN),costCents:parseDemoMoney(draft.cost)??NaN};
    const problems=validateEvent(input,game?registered(game).length:0);
    if(!startsAt)problems.unshift('Wybierz poprawny, jednoznaczny termin w strefie Europe/Warsaw (zmiana czasu może wykluczać tę godzinę).');
    setErrors(problems);
    if(problems.length){requestAnimationFrame(()=>errorBox.current?.focus());return;}
    setPreview(input);
  }
  const model:Match|undefined=preview?{id:game?.id??'preview',starts_at:preview.startsAt,location:preview.location,duration_minutes:preview.durationMinutes,hourly_rate:0,total_cost:preview.costCents/100,capacity:preview.capacity,status:'scheduled',registered_count:game?registered(game).length:0,reserve_count:0,registration_open:true,decision_required:false,cutoff_at:'',estimated_per_person:null,settlements_active:false}:undefined;
  return <section className="slm-event-form" aria-label={game?'Edytuj mecz':'Nowy mecz'}><MatchHeader title={preview?'Podgląd meczu':game?'Edytuj mecz':'Nowy mecz'} onBack={preview?()=>setPreview(null):onBack}/><p className="slm-muted">Demo · pamięć sesji · Europe/Warsaw</p>
    {errors.length>0&&<div ref={errorBox} tabIndex={-1} className="slm-event-errors" role="alert"><strong>Popraw formularz</strong><ul>{errors.map(message=><li key={message}>{message}</li>)}</ul></div>}
    {preview&&model?<><MatchHero match={model} minimum={preview.minimum} compact displayName={preview.name.trim()||'Mecz · demo'} title="Podgląd meczu"/><dl className="slm-match-facts"><div><dt>Czas trwania</dt><dd>{preview.durationMinutes} min</dd></div><div><dt>Uczestnicy</dt><dd>{preview.minimum}–{preview.capacity} osób</dd></div><div><dt>Koszt całkowity</dt><dd>{(preview.costCents/100).toLocaleString('pl-PL',{style:'currency',currency:'PLN'})}</dd></div><div><dt>Adres</dt><dd>{preview.address||'Nie podano'}</dd></div></dl><div className="slm-event-buttons"><button type="button" onClick={()=>setPreview(null)}>Wróć do edycji</button><button className="slm-event-primary" type="button" onClick={()=>{if(saving.current)return;const problems=validateEvent(preview,game?registered(game).length:0);if(problems.length){setErrors(problems);setPreview(null);return;}saving.current=true;onSave(preview,key.current);}}>{game?'Zapisz zmiany':'Utwórz mecz'}</button></div></>:<form noValidate onSubmit={review}><fieldset><legend>Podstawowe</legend>{field('name','Nazwa meczu · opcjonalnie','text',{maxLength:80})}<div className="slm-event-grid">{field('date','Data','date')}{field('time','Godzina','time')}{field('durationMinutes','Czas trwania · min','number',{min:1,max:1440,step:1})}</div>{field('location','Miejsce / nazwa boiska','text',{maxLength:120})}{field('address','Adres boiska','text',{maxLength:180})}</fieldset><fieldset><legend>Uczestnicy</legend><div className="slm-event-grid">{field('minimum','Minimum zawodników','number',{min:1,step:1})}{field('capacity','Limit zawodników','number',{min:1,max:100,step:1})}</div>{game&&<p className="slm-muted">Aktualnie zapisani: {registered(game).length}. Goście zajmują miejsca; rezerwa nie.</p>}</fieldset><fieldset><legend>Finanse</legend>{field('cost','Całkowity koszt · PLN','text',{inputMode:'decimal'})}</fieldset><div className="slm-event-buttons"><button type="button" onClick={onBack}>Anuluj</button><button className="slm-event-primary" type="submit">Podgląd meczu</button></div></form>}
  </section>;
}

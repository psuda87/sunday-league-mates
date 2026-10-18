import { useEffect, useId, useRef, useState } from 'react';
import type { Dispatch, FormEvent } from 'react';
import MatchHeader from '../ui/MatchHeader';
import UltimatePlayerCard from './UltimatePlayerCard';
import type { Action, World } from './data';
import { statistics } from './data';
export default function DemoProfile({world,id,onBack,dispatch}:{world:World;id:string;onBack:()=>void;dispatch:Dispatch<Action>}) {
  const player=world.players.find(p=>p.id===id)!;
  const heading=useRef<HTMLHeadingElement>(null),field=useId(),errorId=useId();
  const [editing,setEditing]=useState(false),[number,setNumber]=useState(''),[error,setError]=useState('');
  const own=world.userId===id;
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
  const stats=statistics(world,id);
  function save(event:FormEvent) {
    event.preventDefault();
    if(!own)return;
    if(!/^[0-9]{1,2}$/.test(number.trim())){setError('Wpisz pełny numer od 0 do 99.');return;}
    dispatch({type:'jersey',playerId:id,number:Number(number.trim())});setEditing(false);
  }
  return <div className="slm-players-screen slm-ultimate-profile"><MatchHeader title="Zawodnicy" backLabel="Wróć do poprzedniego widoku" onBack={onBack}/><p className="slm-players-demo">Dane przykładowe · fikcyjne portrety i statystyki</p>
    <UltimatePlayerCard key={id} name={player.name} portrait={player.portrait} jerseyNumber={player.jerseyNumber} headingRef={heading} onEditNumber={own?()=>{setNumber(String(player.jerseyNumber));setError('');setEditing(true);}:undefined}/>
    {editing&&own&&<form className="slm-number-form" onSubmit={save} noValidate aria-label="Edycja numeru demonstracyjnego">
      <label htmlFor={field}>Twój numer koszulki · demo (0–99)</label>
      <input id={field} autoFocus inputMode="numeric" autoComplete="off" value={number} onChange={e=>setNumber(e.target.value)} aria-invalid={!!error} aria-describedby={error?errorId:undefined}/>
      {error&&<p id={errorId} role="alert">{error}</p>}
      <div><button type="submit">Zapisz numer</button><button type="button" onClick={()=>setEditing(false)}>Anuluj</button></div>
    </form>}
    <section className="slm-player-stats slm-ultimate-summary" aria-label="Cztery podstawowe statystyki demonstracyjne"><dl className="slm-ultimate-stats">{[[stats.played,'Mecze'],[player.demoTotals.goals,'Bramki'],[player.demoTotals.assists,'Asysty'],[player.demoTotals.mvp,'MVP']].map(([value,label])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
  </div>;
}

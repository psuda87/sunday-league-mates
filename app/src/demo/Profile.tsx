import { useEffect, useRef } from 'react';
import MatchHeader from '../ui/MatchHeader';
import UltimatePlayerCard from './UltimatePlayerCard';
import type { World } from './data';
import { history, statistics } from './data';
export default function DemoProfile({world,id,onBack,onGame}:{world:World;id:string;onBack:()=>void;onGame:(id:string)=>void}) {
  const player=world.players.find(p=>p.id===id)!;
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
  const stats=statistics(world,id),rows=history(world,id);
  return <div className="slm-players-screen slm-ultimate-profile"><MatchHeader title="Zawodnicy" backLabel="Wróć do poprzedniego widoku" onBack={onBack}/><p className="slm-players-demo">Dane przykładowe · fikcyjne portrety</p>
    <UltimatePlayerCard key={id} name={player.name} portrait={player.portrait} headingRef={heading}/>
    <section className="slm-player-stats slm-ultimate-summary" aria-label="Podstawowe dane demonstracyjne"><p><strong>{stats.played}</strong> rozegrane mecze · dane demo</p>
      <details className="slm-demo-profile-history"><summary>Historia demo z poprzedniego etapu</summary><p>Dotychczasowa historia fikcyjnych, potwierdzonych obecności. Bez ocen, bramek, asyst i MVP.</p>{rows.length?<ul className="slm-demo-history">{rows.map(({game,entry})=><li key={game.id}><button type="button" onClick={()=>onGame(game.id)}>{game.name}<small>{new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',dateStyle:'medium'}).format(new Date(game.startsAt))} · {entry.attendance?'Obecny':'Nieobecny'}</small></button></li>)}</ul>:<p>Brak potwierdzonych występów w danych demo.</p>}</details>
    </section>
  </div>;
}

import { useEffect, useRef } from 'react';
import MatchHeader from '../ui/MatchHeader';
import type { World } from './data';
import { history, statistics } from './data';
export default function DemoProfile({world,id,onBack,onGame}:{world:World;id:string;onBack:()=>void;onGame:(id:string)=>void}) {
  const player=world.players.find(p=>p.id===id)!;
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
  const stats=statistics(world,id),rows=history(world,id);
  return <div className="slm-players-screen"><MatchHeader title="Zawodnicy" backLabel="Wróć do poprzedniego widoku" onBack={onBack}/><p className="slm-players-demo">Dane przykładowe · profil demonstracyjny</p><section className="slm-player-card" aria-label="Profil zawodnika"><p className="slm-player-eyebrow">SUNDAY LEAGUE MATES</p><span className="slm-player-portrait" aria-hidden="true">{player.name.split(' ').map(s=>s[0]).join('')}</span><h2 ref={heading} tabIndex={-1}>{player.name}</h2><p>Fikcyjny zawodnik · bez danych rzeczywistych</p></section><section className="slm-player-stats"><h2>Statystyki · demo</h2><dl className="slm-roster-overview"><div><dt>Rozegrane</dt><dd>{stats.played}</dd></div><div><dt>Potwierdzone</dt><dd>{stats.confirmed}</dd></div><div><dt>Frekwencja</dt><dd>{stats.attendance===null?'—':`${stats.attendance}%`}</dd></div></dl><p>Wyłącznie fikcyjne, potwierdzone obecności w zakończonych meczach. Frekwencja: obecności / potwierdzone udziały.</p><h3>Ostatnie występy i historia</h3>{rows.length?<ul className="slm-demo-history">{rows.map(({game,entry})=><li key={game.id}><button type="button" onClick={()=>onGame(game.id)}>{game.name}<small>{new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',dateStyle:'medium'}).format(new Date(game.startsAt))} · {entry.attendance?'Obecny':'Nieobecny'}</small></button></li>)}</ul>:<p>Brak potwierdzonych występów w danych demo.</p>}</section></div>;
}

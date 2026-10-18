import { useEffect, useReducer, useRef, useState } from 'react';
import { IonButton, IonContent, IonFooter, IonPage } from '@ionic/react';
import MatchHeader from '../ui/MatchHeader';
import MatchHero from '../ui/MatchHero';
import MatchFilters from '../ui/MatchFilters';
import type { MatchFilter } from '../ui/MatchFilters';
import BottomNav from '../ui/BottomNav';
import type { Tab } from '../ui/BottomNav';
import AppearanceSettings from '../ui/AppearanceSettings';
import type { Match } from '../events/model';
import { initialWorld, reduceWorld, registered, reserves, scenarioGame, unpaidGames } from './data';
import type { Game, Scenario } from './data';
import { DemoPanels } from './Panels';
import DemoProfile from './Profile';
import '../pages/Accounts.css';
type Frame={key:number;kind:'player'|'game';id:string;y:number;focus:HTMLElement|null};
const fold=(s:string)=>s.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/ł/g,'l').trim();
const matchModel=(game:Game):Match=>({id:game.id,starts_at:game.startsAt,location:'Boisko demonstracyjne',duration_minutes:90,hourly_rate:180,total_cost:game.costCents/100,capacity:game.capacity,status:game.status==='cancelled'?'cancelled':'scheduled',registered_count:registered(game).length,reserve_count:reserves(game).length,registration_open:game.status==='upcoming',decision_required:false,cutoff_at:'',estimated_per_person:null,settlements_active:false});
export default function DemoApp() {
  const [world,dispatch]=useReducer(reduceWorld,undefined,initialWorld);
  const [tab,setTab]=useState<Tab>('events');
  const [detail,setDetail]=useState(()=>window.location.hash.startsWith('#details'));
  const [selected,setSelected]=useState('demo-1');
  const [filter,setFilter]=useState<MatchFilter>('upcoming');
  const [query,setQuery]=useState('');
  const [frames,setFrames]=useState<Frame[]>([]);
  const content=useRef<HTMLIonContentElement>(null),sequence=useRef(0),opening=useRef(false);
  const latestFrames=useRef(frames);latestFrames.current=frames;
  const top=frames.at(-1);
  const selectedGame=world.games.find(g=>g.id===selected)!;
  function goHome(){setDetail(false);window.history.replaceState(null,'','#home');void content.current?.scrollToTop(0);}
  function openGame(id:string){setSelected(id);setTab('events');setDetail(true);window.history.replaceState(null,'','#details-b');void content.current?.scrollToTop(0);}
  async function push(kind:Frame['kind'],id:string){
    if(opening.current)return;opening.current=true;
    const focused=document.activeElement as HTMLElement|null;
    try {const scroll=await content.current?.getScrollElement();setFrames(previous=>[...previous,{key:++sequence.current,kind,id,y:scroll?.scrollTop??0,focus:focused}]);await content.current?.scrollToTop(0);} finally {opening.current=false;}
  }
  function pop(){const frame=latestFrames.current.at(-1);if(!frame)return;setFrames(previous=>previous.slice(0,-1));requestAnimationFrame(()=>{frame.focus?.focus({preventScroll:true});void content.current?.scrollToPoint(0,frame.y,0);});}
  useEffect(()=>{const listener=()=>{setFrames([]);setTab('events');setDetail(window.location.hash.startsWith('#details'));void content.current?.scrollToTop(0);};window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener);},[]);
  const playerLink=(id:string)=>{void push('player',id);};
  const visible=world.games.filter(game=>filter==='history'?game.status!=='upcoming':game.status==='upcoming'&&(filter!=='mine'||game.entries.some(e=>e.playerId===world.userId&&e.status!=='withdrawn')));
  const sorted=world.players.filter(p=>fold(p.name).includes(fold(query))).sort((a,b)=>a.name.localeCompare(b.name,'pl'));
  function gameScreen(game:Game,onBack:()=>void,backLabel='Wróć do meczów'){
    const own=game.entries.find(e=>e.playerId===world.userId&&e.status!=='withdrawn');
    const invitedByOther=!!own?.inviterId&&own.inviterId!==world.userId;
    const full=registered(game).length>=game.capacity,claim=own?.status==='reserve'&&!full;
    const withdrawing=!!own&&!claim,blocked=unpaidGames(world,world.userId)>=2;
    return <><MatchHeader onBack={onBack} backLabel={backLabel}/><MatchHero match={matchModel(game)} title="Szczegóły meczu" displayName={game.name}><IonButton className="slm-match-cta" expand="block" disabled={game.status!=='upcoming'||invitedByOther||(!withdrawing&&blocked)} onClick={()=>dispatch({type:withdrawing?'withdraw':'join',gameId:game.id})}>{game.status!=='upcoming'?'ZAPISY ZAMKNIĘTE':invitedByOther?'GOŚĆ · WPIS ZAPRASZAJĄCEGO':withdrawing?own.status==='reserve'?'OPUŚĆ REZERWĘ':'WYCOFAJ ZAPIS':blocked?'BLOKADA DEMO · ZALEGŁOŚCI':claim?'ZAJMIJ WOLNE MIEJSCE':full?'DOŁĄCZ DO REZERWY':'ZAPISZ SIĘ NA MECZ'}</IonButton></MatchHero>

      <DemoPanels key={game.id} world={world} game={game} dispatch={dispatch} onPlayer={playerLink} actions={game.status==='upcoming'&&!invitedByOther&&(own?.status==='registered'||claim)&&<div className="slm-demo-secondary-actions"><IonButton fill="outline" disabled={own?.status!=='registered'||full||blocked} onClick={()=>dispatch({type:'guest',gameId:game.id})}>Dodaj gościa · demo</IonButton>{claim&&<IonButton fill="clear" onClick={()=>dispatch({type:'withdraw',gameId:game.id})}>Opuść rezerwę</IonButton>}</div>}/></>;
  }
  return <IonPage className="slm-demo"><IonContent ref={content}><main className="slm-accounts">
    <section className="slm-demo-scene" hidden={frames.length>0} aria-label="Główny widok demo">
      {tab==='events'?detail?gameScreen(selectedGame,goHome):<><MatchHeader/><section className="slm-matches-screen" aria-label="Mecze demonstracyjne"><MatchFilters value={filter} onChange={setFilter}/><div className="slm-match-list">{visible.map(game=><MatchHero key={game.id} match={matchModel(game)} compact title="Przykładowy mecz" displayName={game.name} onOpen={()=>openGame(game.id)}/>)}</div>{!visible.length&&<section className="slm-player-empty">Brak meczów w tym filtrze. Zmień użytkownika lub zapisz się w demo.</section>}</section></>:tab==='players'?<div className="slm-players-screen"><MatchHeader title="Zawodnicy"/><p className="slm-players-demo">Dane przykładowe · fikcyjni zawodnicy</p><label className="slm-player-search" htmlFor="demo-player-search"><span>Szukaj zawodnika</span><input type="search" id="demo-player-search" autoComplete="off" placeholder="Wpisz nazwę…" value={query} onChange={e=>setQuery(e.target.value)}/></label><p className="slm-player-count" role="status">{sorted.length} z {world.players.length} zawodników · A–Z</p><ul className="slm-player-list">{sorted.map(player=><li key={player.id}><button type="button" onClick={()=>playerLink(player.id)}><span className="slm-player-avatar" aria-hidden="true">{player.name.split(' ').map(s=>s[0]).join('')}</span><span className="slm-player-name">{player.name}</span><span className="slm-player-arrow" aria-hidden="true">›</span></button></li>)}</ul>{!sorted.length&&<section className="slm-player-empty"><h2>Brak wyników</h2><button type="button" onClick={()=>setQuery('')}>Wyczyść wyszukiwanie</button></section>}</div>:<><MatchHeader title="Profil"/><section className="slm-panel"><h2>Twój użytkownik demonstracyjny</h2><button type="button" className="slm-demo-person" onClick={()=>playerLink(world.userId)}>{world.players.find(p=>p.id===world.userId)?.name}</button><p>To symulacja, bez logowania i prawdziwego konta.</p></section><AppearanceSettings/></>}
    </section>
    {frames.map((frame,index)=><section className="slm-demo-scene" hidden={index!==frames.length-1} key={frame.key} aria-label={frame.kind==='player'?'Profil demonstracyjny':'Mecz z historii'}>{frame.kind==='player'?<DemoProfile world={world} id={frame.id} onBack={pop} onGame={id=>{void push('game',id);}}/>:gameScreen(world.games.find(g=>g.id===frame.id)!,pop,'Wróć do poprzedniego widoku')}</section>)}
    {world.notice&&<p className="slm-notice" role="status">{world.notice}</p>}
    <p className="slm-demo-badge">Dane przykładowe · wszystkie operacje tylko w pamięci demo</p>
    <details className="slm-demo-tools"><summary>Narzędzia demo</summary><p>Fikcyjna symulacja. Brak API, logowania, backendu i rzeczywistych wpłat.</p><label>Scenariusz<select id="demo-scenario" defaultValue="free" onChange={e=>{const scenario=e.target.value as Scenario;dispatch({type:'reset',scenario});setFrames([]);setFilter('upcoming');setQuery('');openGame(scenarioGame[scenario]);}}>{Object.entries({free:'Mecz z wolnymi miejscami',full:'Mecz pełny',joined:'Użytkownik zapisany',reserve:'Użytkownik na rezerwie',completed:'Mecz zakończony',cancelled:'Mecz anulowany',debt:'Przykładowe zaległości'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Użytkownik demo<select id="demo-user" value={world.userId} onChange={e=>dispatch({type:'user',id:e.target.value})}>{world.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><p>Nieopłacone zakończone mecze użytkownika: {unpaidGames(world,world.userId)}. Blokada od dwóch (symulacja).</p><label htmlFor="demo-count">Uczestnicy wybranego meczu: {registered(selectedGame).length} / {selectedGame.capacity}</label><input id="demo-count" type="range" min="0" max={selectedGame.capacity} step="1" value={registered(selectedGame).length} disabled={selectedGame.status!=='upcoming'} onChange={e=>dispatch({type:'resize',gameId:selectedGame.id,count:Number(e.target.value)})}/><IonButton onClick={()=>{dispatch({type:'reset'});setFrames([]);setSelected('demo-1');setFilter('upcoming');setQuery('');setTab('events');goHome();const el=document.getElementById('demo-scenario') as HTMLSelectElement|null;if(el)el.value='free';}}>Reset danych demo</IonButton><AppearanceSettings/></details>
  </main></IonContent><IonFooter><BottomNav active={top?(top.kind==='player'?'players':'events'):tab} onSelect={value=>{setFrames([]);setTab(value);goHome();}}/></IonFooter></IonPage>;
}

import { useEffect, useReducer, useRef, useState } from 'react';
import { IonButton, IonContent, IonFooter, IonPage } from '@ionic/react';
import MatchHeader from '../ui/MatchHeader';
import MatchHero from '../ui/MatchHero';
import MatchFilters from '../ui/MatchFilters';
import type { MatchFilter } from '../ui/MatchFilters';
import BottomNav from './DemoBottomNav';
import type { DemoTab as Tab } from './DemoBottomNav';
import EventForm from './EventForm';
import type { EventInput } from './eventDraft';
import AppearanceSettings from '../ui/AppearanceSettings';
import type { Match } from '../events/model';
import { canManageDemoEvents, initialWorld, reduceWorld, registered, reserves, scenarioGame, unpaidGames } from './data';
import type { Game, Scenario } from './data';
import { DemoPanels } from './Panels';
import DemoProfile from './Profile';
import '../pages/Accounts.css';
type Frame={key:number;kind:'player'|'game';id:string;y:number;focus:HTMLElement|null};
const matchModel=(game:Game):Match=>({id:game.id,starts_at:game.startsAt,location:game.location??'Boisko demonstracyjne',duration_minutes:game.durationMinutes??90,hourly_rate:game.costCents/100/((game.durationMinutes??90)/60),total_cost:game.costCents/100,capacity:game.capacity,status:game.status==='cancelled'?'cancelled':'scheduled',registered_count:registered(game).length,reserve_count:reserves(game).length,registration_open:game.status==='upcoming',decision_required:false,cutoff_at:'',estimated_per_person:null,settlements_active:false});
export default function DemoApp() {
  const [world,dispatch]=useReducer(reduceWorld,undefined,initialWorld);
  const [tab,setTab]=useState<Tab>('events');
  const [detail,setDetail]=useState(()=>window.location.hash.startsWith('#details'));
  const [selected,setSelected]=useState('demo-1');
  const [filter,setFilter]=useState<MatchFilter>('upcoming');
  const [form,setForm]=useState<null|'create'|string>(()=>window.location.hash==='#match-create'?'create':null);
  const formScroll=useRef(0);
  const [frames,setFrames]=useState<Frame[]>([]);
  const content=useRef<HTMLIonContentElement>(null),sequence=useRef(0),opening=useRef(false);
  const latestFrames=useRef(frames);latestFrames.current=frames;
  const top=frames.at(-1);
  const selectedGame=world.games.find(g=>g.id===selected)!;
  async function openForm(id='create'){formScroll.current=(await content.current?.getScrollElement())?.scrollTop??0;setForm(id);void content.current?.scrollToTop(0);}
  function closeForm(){setForm(null);if(window.location.hash==='#match-create')window.history.replaceState(null,'','#home');requestAnimationFrame(()=>{void content.current?.scrollToPoint(0,formScroll.current,0);});}
  function saveEvent(input:EventInput,key:string){if(!canManageDemoEvents(world))return;if(form==='create')setFilter('upcoming');const id=form==='create'?`demo-${world.nextGameId}`:form!;dispatch(form==='create'?{type:'event_create',input,key}:{type:'event_update',gameId:id,input});setForm(null);setFrames([]);openGame(id);}
  function goHome(){setDetail(false);window.history.replaceState(null,'','#home');void content.current?.scrollToTop(0);}
  function openGame(id:string){setSelected(id);setTab('events');setDetail(true);window.history.replaceState(null,'','#details-b');void content.current?.scrollToTop(0);}
  async function push(kind:Frame['kind'],id:string){
    if(opening.current)return;opening.current=true;
    const focused=document.activeElement as HTMLElement|null;
    try {const scroll=await content.current?.getScrollElement();setFrames(previous=>[...previous,{key:++sequence.current,kind,id,y:scroll?.scrollTop??0,focus:focused}]);await content.current?.scrollToTop(0);} finally {opening.current=false;}
  }
  function pop(){const frame=latestFrames.current.at(-1);if(!frame)return;setFrames(previous=>previous.slice(0,-1));requestAnimationFrame(()=>{frame.focus?.focus({preventScroll:true});void content.current?.scrollToPoint(0,frame.y,0);});}
  useEffect(()=>{const listener=()=>{setFrames([]);setForm(window.location.hash==='#match-create'?'create':null);setTab('events');setDetail(window.location.hash.startsWith('#details'));void content.current?.scrollToTop(0);};window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener);},[]);
  const playerLink=(id:string)=>{void push('player',id);};
  const visible=world.games.filter(game=>filter==='history'?game.status!=='upcoming':game.status==='upcoming'&&(filter!=='mine'||game.entries.some(e=>e.playerId===world.userId&&e.status!=='withdrawn'))).sort((a,b)=>filter==='history'?b.startsAt.localeCompare(a.startsAt):a.startsAt.localeCompare(b.startsAt));
  function gameScreen(game:Game,onBack:()=>void,backLabel='Wróć do meczów'){
    const own=game.entries.find(e=>e.playerId===world.userId&&e.status!=='withdrawn');
    const invitedByOther=!!own?.inviterId&&own.inviterId!==world.userId;
    const full=registered(game).length>=game.capacity,claim=own?.status==='reserve'&&!full;
    const withdrawing=!!own&&!claim,blocked=unpaidGames(world,world.userId)>=2;
    return <><MatchHeader onBack={onBack} backLabel={backLabel}/>{canManageDemoEvents(world)&&game.status==='upcoming'&&<IonButton className="slm-demo-edit-event" size="small" fill="clear" onClick={()=>{void openForm(game.id);}}>Edytuj mecz</IonButton>}<MatchHero minimum={game.minimum??10} match={matchModel(game)} title="Szczegóły meczu" displayName={game.name}><IonButton className="slm-match-cta" expand="block" disabled={game.status!=='upcoming'||invitedByOther||(!withdrawing&&blocked)} onClick={()=>dispatch({type:withdrawing?'withdraw':'join',gameId:game.id})}>{game.status!=='upcoming'?'ZAPISY ZAMKNIĘTE':invitedByOther?'GOŚĆ · WPIS ZAPRASZAJĄCEGO':withdrawing?own.status==='reserve'?'OPUŚĆ REZERWĘ':'WYCOFAJ ZAPIS':blocked?'BLOKADA DEMO · ZALEGŁOŚCI':claim?'ZAJMIJ WOLNE MIEJSCE':full?'DOŁĄCZ DO REZERWY':'ZAPISZ SIĘ NA MECZ'}</IonButton></MatchHero>

      <DemoPanels key={game.id} world={world} game={game} dispatch={dispatch} onPlayer={playerLink} actions={game.status==='upcoming'&&!invitedByOther&&(own?.status==='registered'||claim)&&<div className="slm-demo-secondary-actions"><IonButton fill="outline" disabled={own?.status!=='registered'||full||blocked} onClick={()=>dispatch({type:'guest',gameId:game.id})}>Dodaj gościa · demo</IonButton>{claim&&<IonButton fill="clear" onClick={()=>dispatch({type:'withdraw',gameId:game.id})}>Opuść rezerwę</IonButton>}</div>}/></>;
  }
  return <IonPage className="slm-demo"><IonContent ref={content}><main className="slm-accounts">
    <section className="slm-demo-scene" hidden={frames.length>0||form!==null} aria-label="Główny widok demo">
      {tab==='events'?detail?gameScreen(selectedGame,goHome):<><MatchHeader/><section className="slm-matches-screen" aria-label="Mecze demonstracyjne"><MatchFilters value={filter} onChange={setFilter}/><div className="slm-match-list">{visible.map(game=><MatchHero minimum={game.minimum??10} key={game.id} match={matchModel(game)} compact title="Przykładowy mecz" displayName={game.name} onOpen={()=>openGame(game.id)}/>)}</div>{!visible.length&&<section className="slm-player-empty">Brak meczów w tym filtrze. Zmień użytkownika lub zapisz się w demo.</section>}</section></>:<DemoProfile key={world.userId} world={world} id={world.userId} personal dispatch={dispatch}/>}
    </section>
    {frames.map((frame,index)=><section className="slm-demo-scene" hidden={index!==frames.length-1||form!==null} key={frame.key} aria-label={frame.kind==='player'?'Profil demonstracyjny':'Mecz z historii'}>{frame.kind==='player'?<DemoProfile world={world} id={frame.id} onBack={pop} dispatch={dispatch}/>:gameScreen(world.games.find(g=>g.id===frame.id)!,pop,'Wróć do poprzedniego widoku')}</section>)}
    {form!==null&&<EventForm key={form} world={world} game={form==='create'?undefined:world.games.find(g=>g.id===form)} onBack={closeForm} onSave={saveEvent}/>}
    {world.notice&&<p className={tab==='profile'&&!top?'slm-identity-feedback':'slm-notice'} role="status">{world.notice}</p>}
    <p className="slm-demo-badge">Dane przykładowe · wszystkie operacje tylko w pamięci demo</p>
    <details className="slm-demo-tools"><summary>Narzędzia demo</summary><p>Fikcyjna symulacja. Brak API, logowania, backendu i rzeczywistych wpłat.</p><label>Scenariusz<select id="demo-scenario" defaultValue="free" onChange={e=>{const scenario=e.target.value as Scenario;dispatch({type:'reset',scenario});setForm(null);setFrames([]);setFilter('upcoming');openGame(scenarioGame[scenario]);}}>{Object.entries({free:'Mecz z wolnymi miejscami',full:'Mecz pełny',joined:'Użytkownik zapisany',reserve:'Użytkownik na rezerwie',completed:'Mecz zakończony',cancelled:'Mecz anulowany',debt:'Przykładowe zaległości'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Rola wydarzeń · wyłącznie symulacja<select id="demo-event-role" value={world.eventRole} onChange={e=>dispatch({type:'event_role',role:e.target.value as 'player'|'admin'})}><option value="player">Zawodnik</option><option value="admin">Administrator demo</option></select></label><label>Użytkownik demo<select id="demo-user" value={world.userId} onChange={e=>dispatch({type:'user',id:e.target.value})}>{world.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><p>Nieopłacone zakończone mecze użytkownika: {unpaidGames(world,world.userId)}. Blokada od dwóch (symulacja).</p><label htmlFor="demo-count">Uczestnicy wybranego meczu: {registered(selectedGame).length} / {selectedGame.capacity}</label><input id="demo-count" type="range" min="0" max={selectedGame.capacity} step="1" value={registered(selectedGame).length} disabled={selectedGame.status!=='upcoming'} onChange={e=>dispatch({type:'resize',gameId:selectedGame.id,count:Number(e.target.value)})}/><IonButton onClick={()=>{dispatch({type:'reset'});setForm(null);setFrames([]);setSelected('demo-1');setFilter('upcoming');setTab('events');goHome();const el=document.getElementById('demo-scenario') as HTMLSelectElement|null;if(el)el.value='free';}}>Reset danych demo</IonButton><AppearanceSettings/></details>
  </main></IonContent><IonFooter><BottomNav canCreate={canManageDemoEvents(world)} onCreate={()=>{void openForm();}} active={top?'events':tab} onSelect={value=>{setFrames([]);setForm(null);setTab(value);goHome();}}/></IonFooter></IonPage>;
}

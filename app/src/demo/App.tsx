import { initialAccountWorld } from './accountState';
import type { AccountView } from '../account-ui/model';
import './palettes.css';
import { canCreateEvents, canEditEvent, canViewEventProfile, eventAccess } from './eventAccess';
import { EventPrivacy, EventLabel, LockedEvent, OwnEvent } from './EventAccessView';
import { groupCanOrganize } from './groups';
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
import { initialWorld, reduceWorld, registered, reserves, scenarioGame, unpaidGames } from './data';
import type { DemoPlayer, Game, Scenario } from './data';
import { DemoPanels } from './Panels';
import DemoProfile from './Profile';
import Groups from './GroupScreens';
import { canViewGroupProfile } from './groups';
import '../pages/Accounts.css';
type Frame={key:number;kind:'player'|'game';id:string;y:number;focus:HTMLElement|null;groupId?:string;gameId?:string};
const matchModel=(game:Game):Match=>({id:game.id,starts_at:game.startsAt,location:game.location??'Boisko demonstracyjne',duration_minutes:game.durationMinutes??90,hourly_rate:game.costCents/100/((game.durationMinutes??90)/60),total_cost:game.costCents/100,capacity:game.capacity,status:game.status==='cancelled'?'cancelled':'scheduled',registered_count:registered(game).length,reserve_count:reserves(game).length,registration_open:game.status==='upcoming',decision_required:false,cutoff_at:'',estimated_per_person:null,settlements_active:false});
export default function DemoApp({initialPlayer,initialTab,onAccount,onLogout}:{initialPlayer?:DemoPlayer;initialTab?:Tab;onAccount?:(view:AccountView,tab:Tab)=>void;onLogout?:()=>void}={}) {
  const initialize=()=>initialAccountWorld(initialPlayer);
  const [world,dispatch]=useReducer((previous:ReturnType<typeof initialWorld>,action:Parameters<typeof reduceWorld>[1])=>initialPlayer&&action.type==='reset'?initialize():reduceWorld(previous,action),undefined,initialize);
  const [tab,setTab]=useState<Tab>(()=>initialTab??(window.location.hash.startsWith('#group')?'groups':'events'));
  const [groupsKey,setGroupsKey]=useState(0);
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
  function saveEvent(input:EventInput,key:string){const original=world.games.find(g=>g.id===form);if(form==='create'?!groupCanOrganize(world,input.groupId):!original||!canEditEvent(world,original))return;if(form==='create')setFilter('upcoming');const id=form==='create'?`demo-${world.nextGameId}`:form!;dispatch(form==='create'?{type:'event_create',input,key}:{type:'event_update',gameId:id,input});setForm(null);setFrames([]);openGame(id);}
  function goHome(){setDetail(false);window.history.replaceState(null,'','#home');void content.current?.scrollToTop(0);}
  function openGame(id:string){setSelected(id);setTab('events');setDetail(true);window.history.replaceState(null,'','#details-b');void content.current?.scrollToTop(0);}
  async function push(kind:Frame['kind'],id:string,groupId?:string,gameId?:string){
    if(groupId&&!canViewGroupProfile(world,groupId,id))return;
    if(gameId){const game=world.games.find(g=>g.id===gameId);if(!game||!canViewEventProfile(world,game,id))return;}
    if(opening.current)return;opening.current=true;
    const focused=document.activeElement as HTMLElement|null;
    try {const scroll=await content.current?.getScrollElement();setFrames(previous=>[...previous,{key:++sequence.current,kind,id,groupId,gameId,y:scroll?.scrollTop??0,focus:focused}]);await content.current?.scrollToTop(0);} finally {opening.current=false;}
  }
  function pop(){const frame=latestFrames.current.at(-1);if(!frame)return;setFrames(previous=>previous.slice(0,-1));requestAnimationFrame(()=>{frame.focus?.focus({preventScroll:true});void content.current?.scrollToPoint(0,frame.y,0);});}
  useEffect(()=>{const listener=()=>{setFrames([]);setForm(window.location.hash==='#match-create'?'create':null);setTab(window.location.hash.startsWith('#group')?'groups':'events');setDetail(window.location.hash.startsWith('#details'));void content.current?.scrollToTop(0);};window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener);},[]);
  const visible=world.games.filter(game=>filter==='history'?game.status!=='upcoming':game.status==='upcoming'&&(filter!=='mine'||game.entries.some(e=>e.playerId===world.userId&&e.status!=='withdrawn'))).sort((a,b)=>filter==='history'?b.startsAt.localeCompare(a.startsAt):a.startsAt.localeCompare(b.startsAt));
  function gameScreen(game:Game,onBack:()=>void,backLabel='Wróć do meczów'){
    const access=eventAccess(world,game);
    if(access==='none')return <><MatchHeader onBack={onBack}/><LockedEvent world={world} game={game}/></>;
    if(access==='own')return <OwnEvent world={world} game={game} dispatch={dispatch} onBack={onBack} onPlayer={id=>{void push('player',id,undefined,game.id);}}/>;
    const own=game.entries.find(e=>e.playerId===world.userId&&e.status!=='withdrawn');
    const invitedByOther=!!own?.inviterId&&own.inviterId!==world.userId;
    const full=registered(game).length>=game.capacity,claim=own?.status==='reserve'&&!full;
    const withdrawing=!!own&&!claim,blocked=unpaidGames(world,world.userId)>=2;
    return <><MatchHeader onBack={onBack} backLabel={backLabel}/>{canEditEvent(world,game)&&<IonButton className="slm-demo-edit-event" size="small" fill="clear" onClick={()=>{void openForm(game.id);}}>Edytuj mecz</IonButton>}<EventLabel world={world} game={game}/><MatchHero badge={<EventPrivacy game={game}/>} minimum={game.minimum??10} match={matchModel(game)} title="Szczegóły meczu" displayName={game.name}><IonButton className="slm-match-cta" expand="block" disabled={game.status!=='upcoming'||invitedByOther||(!withdrawing&&blocked)} onClick={()=>dispatch({type:withdrawing?'withdraw':'join',gameId:game.id})}>{game.status!=='upcoming'?'ZAPISY ZAMKNIĘTE':invitedByOther?'GOŚĆ · WPIS ZAPRASZAJĄCEGO':withdrawing?own.status==='reserve'?'OPUŚĆ REZERWĘ':'WYCOFAJ ZAPIS':blocked?'BLOKADA DEMO · ZALEGŁOŚCI':claim?'ZAJMIJ WOLNE MIEJSCE':full?'DOŁĄCZ DO REZERWY':'ZAPISZ SIĘ NA MECZ'}</IonButton></MatchHero>

      <DemoPanels key={game.id} world={world} game={game} dispatch={dispatch} onPlayer={id=>{void push('player',id,undefined,game.id);}} actions={game.status==='upcoming'&&!invitedByOther&&(own?.status==='registered'||claim)&&<div className="slm-demo-secondary-actions"><IonButton fill="outline" disabled={own?.status!=='registered'||full||blocked} onClick={()=>dispatch({type:'guest',gameId:game.id})}>Dodaj gościa · demo</IonButton>{claim&&<IonButton fill="clear" onClick={()=>dispatch({type:'withdraw',gameId:game.id})}>Opuść rezerwę</IonButton>}</div>}/></>;
  }
  return <IonPage className="slm-demo"><IonContent ref={content}><main className="slm-accounts">
    <section className="slm-demo-scene" hidden={frames.length>0||form!==null} aria-label="Główny widok demo">
      {tab==='events'?detail?gameScreen(selectedGame,goHome):<><MatchHeader/><section className="slm-matches-screen" aria-label="Mecze demonstracyjne"><MatchFilters value={filter} onChange={setFilter}/><div className="slm-match-list">{visible.map(game=><div key={game.id} data-game={game.id}>{eventAccess(world,game)==='none'?<LockedEvent world={world} game={game}/>:<><EventLabel world={world} game={game}/><MatchHero badge={<EventPrivacy game={game}/>} minimum={game.minimum??10} key={game.id} match={matchModel(game)} compact title="Przykładowy mecz" displayName={game.name} onOpen={()=>openGame(game.id)}/></>}</div>)}</div>{!visible.length&&<section className="slm-player-empty">Brak meczów w tym filtrze. Zmień użytkownika lub zapisz się w demo.</section>}</section></>:tab==='groups'?<Groups key={groupsKey} world={world} dispatch={dispatch} onPlayer={(id,groupId)=>{void push('player',id,groupId);}}/>:<DemoProfile key={world.userId} world={world} id={world.userId} personal dispatch={dispatch} onPassword={()=>onAccount?.('password',tab)} onLogout={onLogout}/>}
    </section>
    {frames.map((frame,index)=><section className="slm-demo-scene" hidden={index!==frames.length-1||form!==null} key={frame.key} aria-label={frame.kind==='player'?'Profil demonstracyjny':'Mecz z historii'}>{frame.kind==='player'?((frame.groupId&&!canViewGroupProfile(world,frame.groupId,frame.id))||(frame.gameId&&!canViewEventProfile(world,world.games.find(g=>g.id===frame.gameId)!,frame.id))?<><MatchHeader title="Profil" onBack={pop}/><p role="status">Brak dostępu do tego profilu w bieżącym kontekście.</p></>:<DemoProfile world={world} id={frame.id} onBack={pop} dispatch={dispatch}/>):gameScreen(world.games.find(g=>g.id===frame.id)!,pop,'Wróć do poprzedniego widoku')}</section>)}
    {form!==null&&<EventForm key={form} world={world} game={form==='create'?undefined:world.games.find(g=>g.id===form)} onBack={closeForm} onSave={saveEvent}/>}
    {world.notice&&(tab!=='groups'||!!top)&&<p className={tab==='profile'&&!top?'slm-identity-feedback':'slm-notice'} role="status">{world.notice}</p>}
    <p className="slm-demo-badge">Dane przykładowe · wszystkie operacje tylko w pamięci demo</p>
    <details className="slm-demo-tools"><summary>Narzędzia demo</summary><p>Fikcyjna symulacja. Brak API, logowania, backendu i rzeczywistych wpłat.</p><label>Scenariusz<select id="demo-scenario" defaultValue="free" onChange={e=>{const scenario=e.target.value as Scenario;dispatch({type:'reset',scenario});setForm(null);setFrames([]);setFilter('upcoming');openGame(scenarioGame[scenario]);}}>{Object.entries({free:'Mecz z wolnymi miejscami',full:'Mecz pełny',joined:'Użytkownik zapisany',reserve:'Użytkownik na rezerwie',completed:'Mecz zakończony',cancelled:'Mecz anulowany',debt:'Przykładowe zaległości'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Użytkownik demo<select id="demo-user" value={world.userId} onChange={e=>dispatch({type:'user',id:e.target.value})}>{world.players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><p>Nieopłacone zakończone mecze użytkownika: {unpaidGames(world,world.userId)}. Blokada od dwóch (symulacja).</p>{eventAccess(world,selectedGame)==='full'&&<><label htmlFor="demo-count">Uczestnicy wybranego meczu: {registered(selectedGame).length} / {selectedGame.capacity}</label><input id="demo-count" type="range" min="0" max={selectedGame.capacity} step="1" value={registered(selectedGame).length} disabled={selectedGame.status!=='upcoming'} onChange={e=>dispatch({type:'resize',gameId:selectedGame.id,count:Number(e.target.value)})}/></>}<IonButton onClick={()=>{dispatch({type:'reset'});setForm(null);setFrames([]);setSelected('demo-1');setFilter('upcoming');setTab('events');goHome();const el=document.getElementById('demo-scenario') as HTMLSelectElement|null;if(el)el.value='free';}}>Reset danych demo</IonButton><AppearanceSettings enablePalettes/>{onAccount&&<div className="slm-account-actions"><button type="button" onClick={()=>onAccount('login',tab)}>Ekrany kont · symulator</button><button type="button" onClick={()=>onAccount('expired',tab)}>Symuluj wygaśnięcie sesji</button></div>}</details>
  </main></IonContent><IonFooter><BottomNav canCreate={canCreateEvents(world)} onCreate={()=>{void openForm();}} active={top?(top.groupId?'groups':'events'):tab} onSelect={value=>{setFrames([]);setForm(null);setTab(value);goHome();if(value==='groups'){setGroupsKey(key=>key+1);window.history.replaceState(null,'','#groups');}}}/></IonFooter></IonPage>;
}

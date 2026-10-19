import { useState } from 'react';
import type { Dispatch } from 'react';
import { IonAlert } from '@ionic/react';
import MatchHeader from '../ui/MatchHeader';
import DemoFinance from './Finance';
import { groupName, ownParticipation } from './eventAccess';
import { personName, registered, unpaidGames } from './data';
import type { Action, Game, World } from './data';
import './eventAccess.css';
export function EventLabel({world,game}:{world:World;game:Game}) {
 return <p className="slm-event-label"><span>{groupName(world,game)}</span><strong>{game.visibility==='public'?'◎ Publiczne':'▣ Prywatne'}</strong></p>;
}
export function LockedEvent({world,game}:{world:World;game:Game}) {
 const date=new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',dateStyle:'medium',timeStyle:'short'}).format(new Date(game.startsAt));
 return <article className="slm-locked-event" aria-label={`Prywatny mecz: ${game.name}`}><EventLabel world={world} game={game}/><h2>{game.name}</h2><time dateTime={game.startsAt}>{date}</time><p>▣ Wydarzenie prywatne · szczegóły tylko dla członków grupy.</p></article>;
}
export function OwnEvent({world,game,dispatch,onBack,onPlayer}:{world:World;game:Game;dispatch:Dispatch<Action>;onBack:()=>void;onPlayer:(id:string)=>void}) {
 const [remove,setRemove]=useState<string|null>(null);
 const own=ownParticipation(world,game),current=own.find(e=>e.playerId===world.userId&&e.status!=='withdrawn');
 return <><MatchHeader onBack={onBack}/><EventLabel world={world} game={game}/><section className="slm-own-event"><h2>{game.name}</h2><p role="status">Mecz prywatny. Zachowujesz swój udział i własne rozliczenie. Pozostali uczestnicy, składy i dane grupy są ukryte.</p><dl className="slm-match-facts"><div><dt>Termin · Europe/Warsaw</dt><dd>{new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',dateStyle:'long',timeStyle:'short'}).format(new Date(game.startsAt))}</dd></div><div><dt>Miejsce</dt><dd>{game.location??'Boisko demonstracyjne'}{game.address&&<small>{game.address}</small>}</dd></div><div><dt>Czas gry</dt><dd>{game.durationMinutes??90} min</dd></div></dl><h3>Twój udział</h3><ul>{own.map(entry=><li key={entry.id}><span>{entry.playerId===world.userId?'Ty':entry.inviterId===world.userId?personName(world,entry):'Twój wpis'} · {entry.status==='registered'?'Zapisany':entry.status==='reserve'?'Rezerwa':'Wycofany'}</span>{entry.inviterId===world.userId&&entry.status!=='withdrawn'&&game.status==='upcoming'&&<button type="button" aria-label={`Usuń gościa: ${personName(world,entry)}`} onClick={()=>setRemove(entry.id)}>Usuń własnego gościa</button>}</li>)}</ul>{current&&(!current.inviterId||current.inviterId===world.userId)&&game.status==='upcoming'&&<button type="button" onClick={()=>dispatch({type:'withdraw',gameId:game.id})}>Wycofaj własny zapis</button>}{current?.status==='reserve'&&(!current.inviterId||current.inviterId===world.userId)&&game.status==='upcoming'&&<button type="button" disabled={registered(game).length>=game.capacity||unpaidGames(world,world.userId)>=2} onClick={()=>dispatch({type:'join',gameId:game.id})}>Zajmij wolne miejsce z własnej rezerwy</button>}<p className="slm-muted">Nowe zapisy i dodawanie gości wymagają członkostwa albo publicznego wydarzenia.</p></section><DemoFinance world={world} game={game} dispatch={dispatch} onPlayer={onPlayer}/><IonAlert isOpen={!!remove} header="Usunąć własnego gościa?" subHeader={game.entries.find(e=>e.id===remove)?personName(world,game.entries.find(e=>e.id===remove)!):undefined} message="Zmiana dotyczy tylko tego meczu demo. Wpłaty pozostają w historii; rezerwa nie awansuje automatycznie." buttons={[{text:'Anuluj',role:'cancel'},{text:'Usuń gościa',role:'destructive',handler:()=>{if(remove)dispatch({type:'remove_guest',gameId:game.id,entryId:remove});}}]} onDidDismiss={()=>setRemove(null)}/></>;
}

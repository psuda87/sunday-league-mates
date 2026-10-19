import { formatEventDateTime } from './eventDraft';
import { eventAccess } from './eventAccess';
import { DemoAvatar } from './Identity';
import DemoFinance from './Finance';
import DemoTeams from './Teams';
import { useState } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { trashOutline } from 'ionicons/icons';
import { IonAlert, IonIcon } from '@ionic/react';
import MatchTabs from '../ui/MatchTabs';
import ParticipantGroup, { RosterSummary } from '../ui/ParticipantGroup';
import type { Action, Entry, Game, World } from './data';
import { personName, registered, reserves } from './data';
export function PlayerLink({world,id,onPlayer}:{world:World;id:string;onPlayer:(id:string)=>void}) {
  return <button type="button" className="slm-demo-person" onClick={()=>onPlayer(id)}>{world.players.find(p=>p.id===id)?.name??'Nieznany profil demo'}</button>;
}
export function DemoPanels({world,game,dispatch,onPlayer,actions}:{world:World;game:Game;dispatch:Dispatch<Action>;onPlayer:(id:string)=>void;actions?:ReactNode}) {
  const [removeId,setRemoveId]=useState<string|null>(null);
  const removing=game.entries.find(e=>e.id===removeId);
  const rows=registered(game), waiting=reserves(game);
  const person=(entry:Entry)=>entry.playerId?<PlayerLink world={world} id={entry.playerId} onPlayer={onPlayer}/>:<span>{personName(world,entry)}<small>Gość bez własnego profilu</small></span>;
  if(eventAccess(world,game)!=='full')return <p role="status">Brak dostępu do uczestników i paneli tego meczu.</p>;
  return <><IonAlert isOpen={!!removing} header="Usunąć gościa?" subHeader={removing?personName(world,removing):undefined} message={`Usuniesz wyłącznie wpis z tego meczu demonstracyjnego. ${removing?.playerId?'Profil zawodnika pozostanie dostępny.':'Gość nie ma własnego profilu.'} Rezerwa nie zostanie automatycznie awansowana.`} buttons={[{text:'Anuluj',role:'cancel'},{text:'Usuń gościa',role:'destructive',handler:()=>{if(removeId)dispatch({type:'remove_guest',gameId:game.id,entryId:removeId});}}]} onDidDismiss={()=>setRemoveId(null)}/><MatchTabs panels={[
    <section className="slm-panel slm-match-info"><dl className="slm-match-facts"><div><dt>Termin · Europe/Warsaw</dt><dd>{formatEventDateTime(game.startsAt)}</dd></div><div><dt>Lokalizacja</dt><dd>{game.location??'Boisko demonstracyjne'}{game.address&&<small>{game.address}</small>}</dd></div><div><dt>Czas gry</dt><dd>{game.durationMinutes??90} minut</dd></div><div><dt>Status</dt><dd>{game.status==='completed'?'Zakończony':game.status==='cancelled'?'Anulowany':'Nadchodzący'}</dd></div></dl><p>Wyłącznie fikcyjny scenariusz. Żadna akcja nie zmienia prawdziwego systemu.</p></section>,
    <section className="slm-demo-roster"><RosterSummary occupied={rows.length} capacity={game.capacity} reserve={waiting.length}/>{actions}{[
      {title:'Zapisani',entries:rows.filter(e=>!e.inviterId)},
      {title:'Goście',entries:rows.filter(e=>e.inviterId)},
      {title:'Rezerwa',entries:waiting},
    ].map(group=><ParticipantGroup key={group.title} title={group.title} emptyText="Brak osób w tej grupie." previewLimit={group.title==='Zapisani'?5:undefined}>{group.entries.map(entry=><li key={entry.id}><span className="slm-roster-avatar" aria-hidden="true">{entry.playerId?<DemoAvatar player={world.players.find(p=>p.id===entry.playerId)!}/>:personName(world,entry).split(' ').slice(0,2).map(s=>s[0]).join('')}</span><div className="slm-demo-person-meta">{person(entry)}<small>{entry.status==='reserve'?'Na rezerwie':entry.inviterId?'Gość':'Zapisany'} · demo</small>{entry.inviterId&&<small>Zaprasza: <PlayerLink world={world} id={entry.inviterId} onPlayer={onPlayer}/></small>}</div>{game.status==='upcoming'&&entry.inviterId===world.userId&&<button type="button" className="slm-demo-remove-guest" aria-label={`Usuń gościa: ${personName(world,entry)}`} disabled={removeId!==null} onClick={()=>setRemoveId(entry.id)}><IonIcon icon={trashOutline} aria-hidden="true"/></button>}{game.status==='completed'&&<button className="slm-demo-attendance" type="button" aria-label={`Zmień obecność: ${personName(world,entry)}`} onClick={()=>dispatch({type:'attendance',gameId:game.id,entryId:entry.id})}>{entry.attendance?'✓ Obecny':'— Nieobecny'}</button>}</li>)}</ParticipantGroup>)}<p className="slm-muted">Kliknij nazwę, aby otworzyć profil. Gość bez profilu nie ma konta.</p></section>,
    <DemoTeams world={world} game={game} dispatch={dispatch} onPlayer={onPlayer}/>,
    <DemoFinance world={world} game={game} dispatch={dispatch} onPlayer={onPlayer}/>,
  ]}/></>;
}

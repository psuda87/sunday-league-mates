import PremiumPitch from '../ui/PremiumPitch';
import { eventAccess } from './eventAccess';
import { DemoAvatar } from './Identity';
import { useState } from 'react';
import type { Dispatch } from 'react';
import type { Action, Entry, Game, World } from './data';
import { personName, registered, teamEntries } from './data';
import { useMvpGoldHolders } from '../rating/mvpGold';
export default function DemoTeams({world,game,dispatch,onPlayer}:{world:World;game:Game;dispatch:Dispatch<Action>;onPlayer:(id:string)=>void}) {
  const goldHolders=useMvpGoldHolders();
  const [swap,setSwap]=useState(false),[selected,setSelected]=useState<string|null>(null),[notice,setNotice]=useState('');
  const teams=teamEntries(game),selectedSide=teams.a.some(e=>e.id===selected)?'a':teams.b.some(e=>e.id===selected)?'b':null;
  const activeSelected=selectedSide?selected:null;
  function choose(entry:Entry,side:'a'|'b') {
    if(!swap){if(entry.playerId)onPlayer(entry.playerId);return;}
    if(activeSelected===entry.id){setSelected(null);return;}
    if(activeSelected&&selectedSide!==side){
      dispatch({type:'lineup_swap',gameId:game.id,a:side==='a'?entry.id:activeSelected,b:side==='b'?entry.id:activeSelected});
      setSelected(null);setNotice('Zamieniono zawodników tylko w demo.');
    }else {setSelected(entry.id);setNotice('Wybierz osobę z przeciwnej drużyny.');}
  }
  function marker(entry:Entry,side:'a'|'b') {
    const player=world.players.find(p=>p.id===entry.playerId),name=personName(world,entry),short=player?player.name.split(' ').at(-1):entry.guestName?.replace(' · demo','')??'Gość';
    const content=<><span className="slm-pitch-token" aria-hidden="true">{player?.portraitEdited?<><DemoAvatar player={player}/><span className="slm-pitch-custom-number">{player.jerseyNumber}</span></>:player?(player.jerseyNumber??0):'G'}</span><span className="slm-pitch-name" aria-hidden="true">{short}</span><span className="slm-sr-only">{name}{!player?' · gość bez profilu':''}</span></>;
    return <li key={entry.id} data-entry={entry.id} data-player={entry.playerId??''} data-mvp-gold={entry.playerId&&goldHolders.has(entry.playerId)?'true':undefined}>{swap||player?<button type="button" className={`slm-pitch-player${!swap?' slm-demo-person':''}`} aria-label={`${swap?'Wybierz do zamiany':'Otwórz kartę'}: ${name}`} aria-pressed={swap?activeSelected===entry.id:undefined} onClick={()=>choose(entry,side)}>{content}</button>:<span className="slm-pitch-player slm-pitch-guest" title="Gość bez profilu">{content}</span>}</li>;
  }
  if(eventAccess(world,game)!=='full')return <p role="status">Składy niedostępne w tym widoku.</p>;
  return <section className="slm-demo-teams" aria-label="Demonstracyjne składy na boisku">
    <p className="slm-teams-disclaimer">Przykładowe składy · tylko pamięć demo</p>
    {game.status==='cancelled'?<div className="slm-teams-empty"><h3>Mecz anulowany</h3><p>Brak składów dla odwołanego spotkania.</p></div>:!game.lineup||registered(game).length<2?<div className="slm-teams-empty"><span aria-hidden="true">⚽</span><h3>Boisko czeka na drużyny</h3><p>{registered(game).length<2?'Potrzeba co najmniej dwóch uczestników.':'Użyj uczestników tego meczu do przykładowego podziału.'}</p><button type="button" disabled={registered(game).length<2} onClick={()=>dispatch({type:'lineup_reset',gameId:game.id})}>Utwórz przykładowe składy</button></div>:<>
      <div className="slm-team-score"><span><i aria-hidden="true"/>Drużyna A <strong>{teams.a.length}</strong></span><span><i aria-hidden="true"/>Drużyna B <strong>{teams.b.length}</strong></span></div>
      <div className="slm-team-actions"><button type="button" aria-pressed={swap} disabled={!teams.a.length||!teams.b.length} onClick={()=>{setSwap(!swap);setSelected(null);setNotice('');}}>{swap?'Zakończ zamiany':'Zamień zawodników'}</button><button type="button" disabled={registered(game).length<2} onClick={()=>{dispatch({type:'lineup_reset',gameId:game.id});setSelected(null);setNotice('Przywrócono podział aktualnych uczestników.');}}>Reset podziału</button></div>
      <p className="slm-teams-hint" role="status">{swap?(notice||'Tryb zamiany: wybierz po jednej osobie z każdej drużyny.'):notice||'Dotknij zawodnika, aby otworzyć jego kartę. Goście bez konta nie mają profilu.'}</p>
      <PremiumPitch a={teams.a} b={teams.b} renderPlayer={marker}/>
      {teams.unassigned.length>0&&<div className="slm-team-unassigned"><h3>Poza podziałem: {teams.unassigned.length}</h3><p>Lista uczestników zmieniła się. Reset podziału uwzględni wszystkie aktualne osoby; rezerwa pozostaje poza boiskiem.</p><ul>{teams.unassigned.map(entry=><li key={entry.id}>{entry.playerId?<button type="button" className="slm-demo-person" onClick={()=>onPlayer(entry.playerId!)}>{personName(world,entry)}</button>:personName(world,entry)}</li>)}</ul></div>}
      {!teams.a.length&&!teams.b.length&&<p>Brak przypisanych uczestników. Do podziału potrzeba co najmniej dwóch osób.</p>}
    </>}
  </section>;
}

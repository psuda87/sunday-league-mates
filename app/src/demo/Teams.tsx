import { DemoAvatar } from './Identity';
import { useState } from 'react';
import type { CSSProperties, Dispatch } from 'react';
import type { Action, Entry, Game, World } from './data';
import { personName, registered, teamEntries } from './data';
const formations:Record<number,number[]>={1:[1],2:[1,1],3:[1,2],4:[1,2,1],5:[1,2,2],6:[1,2,3],7:[1,3,3],8:[1,2,2,3]};
function rows(entries:Entry[]) {
  const sizes=formations[entries.length]??Array.from({length:Math.ceil(entries.length/2)},(_,i)=>Math.min(2,entries.length-i*2));
  let offset=0;return sizes.map(size=>{const group=entries.slice(offset,offset+size);offset+=size;return group;});
}
export default function DemoTeams({world,game,dispatch,onPlayer}:{world:World;game:Game;dispatch:Dispatch<Action>;onPlayer:(id:string)=>void}) {
  const [swap,setSwap]=useState(false),[selected,setSelected]=useState<string|null>(null),[notice,setNotice]=useState('');
  const teams=teamEntries(game),selectedSide=teams.a.some(e=>e.id===selected)?'a':teams.b.some(e=>e.id===selected)?'b':null;
  const activeSelected=selectedSide?selected:null;
  const aRows=rows(teams.a),bRows=rows(teams.b),rowCount=Math.max(aRows.length,bRows.length,3);
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
    const content=<><span className="slm-pitch-token" aria-hidden="true">{player?.portraitEdited?<><DemoAvatar player={player}/><span className="slm-pitch-custom-number">{player.jerseyNumber}</span></>:player?.jerseyNumber??'G'}</span><span className="slm-pitch-name" aria-hidden="true">{short}</span><span className="slm-sr-only">{name}{!player?' · gość bez profilu':''}</span></>;
    return <li key={entry.id} data-entry={entry.id} data-player={entry.playerId??''}>{swap||player?<button type="button" className={`slm-pitch-player${!swap?' slm-demo-person':''}`} aria-label={`${swap?'Wybierz do zamiany':'Otwórz kartę'}: ${name}`} aria-pressed={swap?activeSelected===entry.id:undefined} onClick={()=>choose(entry,side)}>{content}</button>:<span className="slm-pitch-player slm-pitch-guest" title="Gość bez profilu">{content}</span>}</li>;
  }
  return <section className="slm-demo-teams" aria-label="Demonstracyjne składy na boisku">
    <p className="slm-teams-disclaimer">Przykładowe składy · tylko pamięć demo</p>
    {game.status==='cancelled'?<div className="slm-teams-empty"><h3>Mecz anulowany</h3><p>Brak składów dla odwołanego spotkania.</p></div>:!game.lineup||registered(game).length<2?<div className="slm-teams-empty"><span aria-hidden="true">⚽</span><h3>Boisko czeka na drużyny</h3><p>{registered(game).length<2?'Potrzeba co najmniej dwóch uczestników.':'Użyj uczestników tego meczu do przykładowego podziału.'}</p><button type="button" disabled={registered(game).length<2} onClick={()=>dispatch({type:'lineup_reset',gameId:game.id})}>Utwórz przykładowe składy</button></div>:<>
      <div className="slm-team-score"><span><i aria-hidden="true"/>Drużyna A <strong>{teams.a.length}</strong></span><span><i aria-hidden="true"/>Drużyna B <strong>{teams.b.length}</strong></span></div>
      <div className="slm-team-actions"><button type="button" aria-pressed={swap} disabled={!teams.a.length||!teams.b.length} onClick={()=>{setSwap(!swap);setSelected(null);setNotice('');}}>{swap?'Zakończ zamiany':'Zamień zawodników'}</button><button type="button" disabled={registered(game).length<2} onClick={()=>{dispatch({type:'lineup_reset',gameId:game.id});setSelected(null);setNotice('Przywrócono podział aktualnych uczestników.');}}>Reset podziału</button></div>
      <p className="slm-teams-hint" role="status">{swap?(notice||'Tryb zamiany: wybierz po jednej osobie z każdej drużyny.'):notice||'Dotknij zawodnika, aby otworzyć jego kartę. Goście bez konta nie mają profilu.'}</p>
      <div className="slm-football-pitch" style={{'--pitch-half-height':`${Math.max(244,rowCount*74+32)}px`} as CSSProperties}>
        <svg className="slm-pitch-lines" viewBox="0 0 100 160" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g fill="none"><rect x="4" y="4" width="92" height="152" rx="1"/><path d="M4 80H96M20 4V29H80V4M35 4V14H65V4M20 156V131H80V156M35 156V146H65V156"/><path d="M40 29Q50 38 60 29M40 131Q50 122 60 131"/><rect className="slm-pitch-goal" x="40" y="0.5" width="20" height="3.5"/><rect className="slm-pitch-goal" x="40" y="156" width="20" height="3.5"/></g><g className="slm-pitch-spots"><circle cx="50" cy="80" r=".8"/><circle cx="50" cy="23" r=".6"/><circle cx="50" cy="137" r=".6"/></g></svg>
        <span className="slm-pitch-centre" aria-hidden="true"/>
        {(['a','b'] as const).map(side=><section className={`slm-team-half slm-team-${side}`} key={side} aria-label={`Drużyna ${side.toUpperCase()}, ${teams[side].length} osób`}><ul>{(side==='a'?aRows:[...bRows].reverse()).map((row,i)=><li className="slm-formation-row" key={i}><ul>{row.map(entry=>marker(entry,side))}</ul></li>)}</ul></section>)}
      </div>
      {teams.unassigned.length>0&&<div className="slm-team-unassigned"><h3>Poza podziałem: {teams.unassigned.length}</h3><p>Lista uczestników zmieniła się. Reset podziału uwzględni wszystkie aktualne osoby; rezerwa pozostaje poza boiskiem.</p><ul>{teams.unassigned.map(entry=><li key={entry.id}>{entry.playerId?<button type="button" className="slm-demo-person" onClick={()=>onPlayer(entry.playerId!)}>{personName(world,entry)}</button>:personName(world,entry)}</li>)}</ul></div>}
      {!teams.a.length&&!teams.b.length&&<p>Brak przypisanych uczestników. Do podziału potrzeba co najmniej dwóch osób.</p>}
    </>}
  </section>;
}

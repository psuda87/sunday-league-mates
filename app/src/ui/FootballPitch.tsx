import type { CSSProperties, ReactNode } from 'react';

// Presentation extracted from the approved Premium demo/Teams.tsx. No assignment
// algorithm or persistence: callers supply both teams and retain their own rules.
export interface PitchPerson {
  id:string; playerId?:string|null; name:string; shortName?:string;
  number?:number|null; guest?:boolean; avatar?:ReactNode;
}
const formations:Record<number,number[]>={1:[1],2:[1,1],3:[1,2],4:[1,2,1],5:[1,2,2],6:[1,2,3],7:[1,3,3],8:[1,2,2,3]};
function rows(entries:PitchPerson[]) {
  const sizes=formations[entries.length]??Array.from({length:Math.ceil(entries.length/2)},(_,i)=>Math.min(2,entries.length-i*2));
  let offset=0;return sizes.map(size=>{const row=entries.slice(offset,offset+size);offset+=size;return row;});
}
export default function FootballPitch({a,b,onPlayer,selectionLabel,selectedId}:{
  a:PitchPerson[];b:PitchPerson[];onPlayer?:(person:PitchPerson,side:'a'|'b')=>void;selectionLabel?:string;selectedId?:string|null;
}) {
  const aRows=rows(a),bRows=rows(b),rowCount=Math.max(aRows.length,bRows.length,3);
  const marker=(person:PitchPerson,side:'a'|'b')=>{
    const content=<><span className="slm-pitch-token" aria-hidden="true">{person.avatar?<>{person.avatar}<span className="slm-pitch-custom-number">{person.number??'—'}</span></>:person.guest?'G':person.number??'—'}</span><span className="slm-pitch-name" aria-hidden="true">{person.shortName??person.name.split(' ').at(-1)}</span><span className="slm-sr-only">{person.name}{person.guest?' · gość bez profilu':''}</span></>;
    return <li key={person.id} data-entry={person.id} data-player={person.playerId??''}>{onPlayer&&(!person.guest||selectionLabel)?<button type="button" className="slm-pitch-player" aria-label={`${selectionLabel??'Otwórz kartę'}: ${person.name}`} aria-pressed={selectionLabel?selectedId===person.id:undefined} onClick={()=>onPlayer(person,side)}>{content}</button>:<span className="slm-pitch-player slm-pitch-guest" title={person.guest?'Gość bez profilu':person.name}>{content}</span>}</li>;
  };
  return <div className="slm-football-pitch" style={{'--pitch-half-height':`${Math.max(244,rowCount*74+32)}px`} as CSSProperties}>
    <svg className="slm-pitch-lines" viewBox="0 0 100 160" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g fill="none"><rect x="4" y="4" width="92" height="152" rx="1"/><path d="M4 80H96M20 4V29H80V4M35 4V14H65V4M20 156V131H80V156M35 156V146H65V156"/><path d="M40 29Q50 38 60 29M40 131Q50 122 60 131"/><rect className="slm-pitch-goal" x="40" y="0.5" width="20" height="3.5"/><rect className="slm-pitch-goal" x="40" y="156" width="20" height="3.5"/></g><g className="slm-pitch-spots"><circle cx="50" cy="80" r=".8"/><circle cx="50" cy="23" r=".6"/><circle cx="50" cy="137" r=".6"/></g></svg>
    <span className="slm-pitch-centre" aria-hidden="true"/>
    {(['a','b'] as const).map(side=><section className={`slm-team-half slm-team-${side}`} key={side} aria-label={`Drużyna ${side.toUpperCase()}, ${(side==='a'?a:b).length} osób`}><ul>{(side==='a'?aRows:[...bRows].reverse()).map((row,i)=><li className="slm-formation-row" key={i}><ul>{row.map(person=>marker(person,side))}</ul></li>)}</ul></section>)}
  </div>;
}

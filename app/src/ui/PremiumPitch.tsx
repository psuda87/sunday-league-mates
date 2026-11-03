import type { CSSProperties, ReactNode } from 'react';
const formations:Record<number,number[]>={1:[1],2:[1,1],3:[1,2],4:[1,2,1],5:[1,2,2],6:[1,2,3],7:[1,3,3],8:[1,2,2,3]};
function rows<T>(entries:T[]) {
  const sizes=formations[entries.length]??Array.from({length:Math.ceil(entries.length/2)},(_,i)=>Math.min(2,entries.length-i*2));
  let offset=0;return sizes.map(size=>{const group=entries.slice(offset,offset+size);offset+=size;return group;});
}

// Original Premium3.18 geometry; data and mutations belong to the caller.
export default function PremiumPitch<T>({a,b,renderPlayer}:{a:T[];b:T[];renderPlayer:(entry:T,side:'a'|'b')=>ReactNode}){
 const aRows=rows(a),bRows=rows(b),rowCount=Math.max(aRows.length,bRows.length,3);
 return (      <div className="slm-football-pitch" style={{'--pitch-half-height':`${Math.max(244,rowCount*74+32)}px`} as CSSProperties}>
        <svg className="slm-pitch-lines" viewBox="0 0 100 160" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g fill="none"><rect x="4" y="4" width="92" height="152" rx="1"/><path d="M4 80H96M20 4V29H80V4M35 4V14H65V4M20 156V131H80V156M35 156V146H65V156"/><path d="M40 29Q50 38 60 29M40 131Q50 122 60 131"/><rect className="slm-pitch-goal" x="40" y="0.5" width="20" height="3.5"/><rect className="slm-pitch-goal" x="40" y="156" width="20" height="3.5"/></g><g className="slm-pitch-spots"><circle cx="50" cy="80" r=".8"/><circle cx="50" cy="23" r=".6"/><circle cx="50" cy="137" r=".6"/></g></svg>
        <span className="slm-pitch-centre" aria-hidden="true"/>
        {(['a','b'] as const).map(side=><section className={`slm-team-half slm-team-${side}`} key={side} aria-label={`Drużyna ${side.toUpperCase()}, ${(side==='a'?a:b).length} osób`}><ul>{(side==='a'?aRows:[...bRows].reverse()).map((row,i)=><li className="slm-formation-row" key={i}><ul>{row.map(entry=>renderPlayer(entry,side))}</ul></li>)}</ul></section>)}
      </div>
 );
}

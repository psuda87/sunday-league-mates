import { useId, useState } from 'react';
import type { CSSProperties, Ref } from 'react';
export interface CardPortrait { src: string; column?: 0 | 1; row?: 0 | 1 }
export default function UltimatePlayerCard({ name, portrait, jerseyNumber, headingRef }: { name: string; portrait?: CardPortrait; jerseyNumber?: number; headingRef?: Ref<HTMLHeadingElement> }) {
  const title=useId();
  const [failedSource,setFailedSource]=useState<string|null>(null);
  const parts=name.trim().split(/\s+/u),surname=parts.length>1?parts.slice(1).join(' '):parts[0];
  const initials=parts.slice(0,2).map(part=>Array.from(part)[0]).join('');
  const sheet=portrait?.column!==undefined&&portrait?.row!==undefined;
  const showPortrait=portrait&&portrait.src!==failedSource;
  return <div className="slm-ultimate-shell"><article className="slm-ultimate-card" aria-labelledby={title}>
    <div className="slm-ultimate-inner"><div className="slm-ultimate-stadium" aria-hidden="true"/>
      <img className="slm-ultimate-crest" src="/assets/branding/slm-logo-primary-transparent.png" width="450" height="505" alt="Herb Sunday League Mates"/>
      {jerseyNumber!==undefined&&<span className="slm-ultimate-number" aria-label={`Numer koszulki ${jerseyNumber}`}>{jerseyNumber}</span>}
      <div className="slm-ultimate-portrait" data-layout={sheet?'sheet':'single'} data-portrait={showPortrait?(sheet?`${portrait.column}-${portrait.row}`:'single'):'initials'}>
        {showPortrait?<img src={portrait.src} alt={`Fikcyjny portret demonstracyjny: ${name}`} style={{'--portrait-column':portrait.column??0,'--portrait-row':portrait.row??0} as CSSProperties} onError={()=>setFailedSource(portrait.src)}/>:<span className="slm-ultimate-initials" aria-label={`Brak zdjęcia: ${name}`}>{initials}</span>}
      </div>
      <div className="slm-ultimate-nameplate"><h2 ref={headingRef} tabIndex={-1} id={title}>{parts.length>1&&<span>{parts[0]} </span>}<strong>{surname}</strong></h2></div>
      <span className="slm-ultimate-filigree" aria-hidden="true"/>
    </div>
  </article></div>;
}

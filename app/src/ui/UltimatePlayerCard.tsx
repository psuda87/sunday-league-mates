import { useId, useState } from 'react';
import type { CSSProperties, Ref } from 'react';
export interface CardPortrait { src: string; column?: 0 | 1; row?: 0 | 1 }
export default function UltimatePlayerCard({ name, portrait, jerseyNumber, headingRef, onEditNumber, portraitDescription }: { name: string; portrait?: CardPortrait; jerseyNumber?: number; headingRef?: Ref<HTMLHeadingElement>; onEditNumber?:()=>void; portraitDescription?:string }) {
  const title=useId();
  const shield=useId();
  const silhouette="M .5 .008 C .46 .045 .43 .035 .4 .024 C .32 .025 .22 .105 .035 .145 L .035 .79 Q .035 .875 .13 .9 L .5 .99 L .87 .9 Q .965 .875 .965 .79 L .965 .145 C .78 .105 .68 .025 .6 .024 C .57 .035 .54 .045 .5 .008 Z";
  const [failedSource,setFailedSource]=useState<string|null>(null);
  const parts=name.trim().split(/\s+/u),surname=parts.length>1?parts.slice(1).join(' '):parts[0];
  const initials=parts.slice(0,2).map(part=>Array.from(part)[0]).join('');
  const sheet=portrait?.column!==undefined&&portrait?.row!==undefined;
  const showPortrait=portrait&&portrait.src!==failedSource;
  return <div className="slm-ultimate-shell"><svg width="0" height="0" aria-hidden="true" focusable="false"><defs><clipPath id={shield} clipPathUnits="objectBoundingBox"><path d={silhouette}/></clipPath></defs></svg><article className="slm-ultimate-card" aria-labelledby={title} style={{'--slm-shield':`url(#${shield})`} as CSSProperties}>
    <div className="slm-ultimate-inner"><div className="slm-ultimate-stadium" aria-hidden="true"/>
      <img className="slm-ultimate-crest" src="/assets/branding/slm-logo-primary-transparent.png" width="450" height="505" alt="Herb Sunday League Mates"/>
      {jerseyNumber!==undefined&&(onEditNumber?<button type="button" className="slm-ultimate-number slm-ultimate-number-edit" onClick={onEditNumber} aria-label={`Zmień numer koszulki, obecnie ${jerseyNumber}`}><span aria-label={`Numer koszulki ${jerseyNumber}`}>{jerseyNumber}</span><small aria-hidden="true">✎</small></button>:<span className="slm-ultimate-number" aria-label={`Numer koszulki ${jerseyNumber}`}>{jerseyNumber}</span>)}
      <div className="slm-ultimate-portrait" data-layout={sheet?'sheet':'single'} data-portrait={showPortrait?(sheet?`${portrait.column}-${portrait.row}`:'single'):'initials'}>
        {showPortrait?<img src={portrait.src} alt={`${portraitDescription??(portrait.src.startsWith('data:image/')?'Lokalne zdjęcie w pamięci demo':'Fikcyjny portret demonstracyjny')}: ${name}`} style={{'--portrait-column':portrait.column??0,'--portrait-row':portrait.row??0} as CSSProperties} onError={()=>setFailedSource(portrait.src)}/>:<span className="slm-ultimate-initials" aria-label={`Brak zdjęcia: ${name}`}>{initials}</span>}
      </div>
      <div className="slm-ultimate-nameplate"><h2 ref={headingRef} tabIndex={-1} id={title}>{parts.length>1&&<span>{parts[0]} </span>}<strong>{surname}</strong></h2></div>
      <span className="slm-ultimate-stars" aria-hidden="true">★★★★★</span>
      <svg className="slm-ultimate-rim" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d={silhouette} transform="translate(.018 .012) scale(.964 .976)"/></svg>
    </div>
  </article></div>;
}

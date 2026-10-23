import { IonIcon } from '@ionic/react';
import { locationOutline, timeOutline } from 'ionicons/icons';
import EventPrivacy from './EventPrivacy';

// Intentionally accepts only fields already present in the server's basic/own DTO.
export default function LimitedMatchCard({ match, onOpen, disabled=false, compact=true }: {
  match: { id:string; name:string; starts_at:string; location:string; visibility:'public'|'private'; access:'none'|'own'|'full'; status:string; capacity?:number };
  onOpen?:()=>void; disabled?:boolean; compact?:boolean;
}) {
  const date=new Date(match.starts_at);
  const format=(options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',hourCycle:'h23',...options}).format(date);
  return <section className={`slm-next-match slm-limited-match slm-has-privacy-badge${compact?' slm-match-compact':' slm-match-detail'}`} aria-label="Mecz z ograniczonym dostępem">
    <article className={`slm-hero-card${onOpen?' slm-hero-interactive':''}`}>
      <EventPrivacy visibility={match.visibility}/>
      <div className="slm-stadium-frame" aria-hidden="true"><img className="slm-stadium" src="/assets/branding/stadium-bg-card.jpg" alt=""/></div>
      {onOpen&&<button type="button" className="slm-card-link" disabled={disabled} onClick={onOpen} aria-label={`Otwórz mecz: ${match.name}`}><span aria-hidden="true"/></button>}
      <div className="slm-match-top"><time className="slm-date-tile" dateTime={match.starts_at}>
        <span>{format({weekday:'short'})}</span><strong>{format({day:'numeric'})}</strong><span>{format({month:'short'})}</span>
      </time><div className="slm-match-meta"><h2 className="slm-card-name">{match.name}</h2>
        <p className="slm-location"><IonIcon icon={locationOutline} aria-hidden="true"/>{match.location}</p>
        <p className="slm-match-date"><IonIcon icon={timeOutline} aria-hidden="true"/>{format({hour:'2-digit',minute:'2-digit'})}</p>
      </div></div>
      <p className="slm-limited-access">{match.access==='own'?'Twój zachowany udział':'Dostęp dla członków grupy'}{match.access==='own'&&match.capacity!==undefined?` · Limit ${match.capacity}`:''}</p>
      {match.status==='cancelled'&&<p className="slm-match-status">Mecz odwołany</p>}
    </article>
  </section>;
}

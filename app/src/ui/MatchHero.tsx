import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { informationCircleOutline, locationOutline, timeOutline } from 'ionicons/icons';
import type { Match } from '../events/model';
import { capacityState } from './capacity';
import MatchCapacityProgress from './MatchCapacityProgress';
export type MatchHeroModel = Pick<Match,'starts_at'|'location'|'status'> & Partial<Pick<Match,'registered_count'|'capacity'|'duration_minutes'|'registration_open'|'decision_required'>> & { address?: string };
// The visible label is the venue name; Google Maps searches by the street address when one is known.
const mapsSearchUrl =(match: Pick<MatchHeroModel,'location'|'address'>) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((match.address?.trim() || match.location).trim())}`;
export default function MatchHero({ match, children, badge, imageSrc = '/assets/branding/stadium-bg-card.jpg', title = 'Następny mecz', onOpen, openDisabled = false, compact = false, displayName, minimum = 10, onInfo }: { match: MatchHeroModel; children?: ReactNode; badge?:ReactNode; imageSrc?: string; title?: string; onOpen?: () => void; openDisabled?: boolean; compact?: boolean; displayName?: string; minimum?:number; onInfo?: () => void }) {
  const date = new Date(match.starts_at);
  const mapsUrl = mapsSearchUrl(match);
  const isDetail = title === 'Szczegóły meczu';
  const capacity = typeof match.registered_count==='number' && typeof match.capacity==='number' ? capacityState(match.registered_count, match.capacity, minimum) : null;
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hourCycle:'h23', ...options }).format(date);
  return <section className={`slm-next-match${compact ? ' slm-match-compact' : ''}${badge?' slm-has-privacy-badge':''}${title === 'Szczegóły meczu' ? ' slm-match-detail' : ''}`} aria-label={title}>
    {!compact && <h1>{title}</h1>}
    <article className={`slm-hero-card${onOpen ? ' slm-hero-interactive' : ''}`}>
      {!isDetail && badge}
      <div className="slm-stadium-frame" aria-hidden="true"><img src={title === 'Szczegóły meczu' && imageSrc === '/assets/branding/stadium-bg-card.jpg' ? '/assets/branding/stadium-bg-main.jpg' : imageSrc} width="1400" height="800" decoding="async" alt="" className="slm-stadium" onError={event => { const image = event.currentTarget; if (!image.src.endsWith('/assets/branding/stadium-bg-main.jpg')) image.src = '/assets/branding/stadium-bg-main.jpg'; }} /></div>
      {onOpen && <button type="button" className="slm-card-link" aria-label={`Otwórz szczegóły meczu: ${format({ day: 'numeric', month: 'long' })}, ${match.location}`} disabled={openDisabled} onClick={onOpen}><span aria-hidden="true" /></button>}
      <div className="slm-match-top">
        <time className="slm-date-tile" dateTime={match.starts_at} aria-label={format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
          <span>{format({ weekday: 'short' })}</span><strong>{format({ day: 'numeric' })}</strong><span>{format({ month: 'short' })}</span>
        </time>
        <div className="slm-match-meta">{compact ? <h2 className="slm-card-name">{displayName ?? `Mecz · ${format({ weekday: 'long' })}`}</h2> : isDetail ? <><div className="slm-detail-title-row"><h2 className="slm-detail-name">{displayName ?? `Mecz · ${format({ weekday: 'long' })}`}</h2>{badge}{onInfo && <button type="button" className="slm-match-info-button" aria-label="Informacje o meczu" aria-haspopup="dialog" onClick={onInfo}><IonIcon icon={informationCircleOutline} aria-hidden="true" /></button>}</div><strong className="slm-kickoff">{format({ hour: '2-digit', minute: '2-digit' })}</strong></> : <><p className="slm-weekday">{format({ weekday: 'long' })}</p><strong className="slm-kickoff">{format({ hour: '2-digit', minute: '2-digit' })}</strong></>}
          <p className="slm-location"><IonIcon icon={locationOutline} aria-hidden="true" /> <a className="slm-location-map-link" href={mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Otwórz lokalizację w Google Maps: ${match.location}${match.address?.trim() ? `, ${match.address.trim()}` : ''}`} onClick={event=>event.stopPropagation()}>{match.location}</a></p>
          <p className="slm-match-date"><IonIcon icon={timeOutline} aria-hidden="true" /> {compact ? `${format({ hour: '2-digit', minute: '2-digit' })}${match.duration_minutes===undefined?'':` · ${match.duration_minutes} min`}` : `${match.duration_minutes} minut · ${format({ year: 'numeric' })}`}</p>
        </div>
      </div>
      {capacity ? compact ? <p className="slm-compact-count" data-state={capacity.occupied === 0 ? 'empty' : capacity.occupied >= minimum ? 'ready' : 'low'}><strong>{capacity.occupied}/{capacity.total}</strong><span className="slm-sr-only"> zawodników · {capacity.label}</span></p> : <MatchCapacityProgress minimum={minimum} count={match.registered_count!} capacity={match.capacity!} /> : <p className="slm-compact-count"><span>Prywatny mecz</span></p>}
    {(match.status === 'cancelled' || match.registration_open === false) && <p className="slm-match-status">{match.status === 'cancelled' ? '⛔ Mecz odwołany' : '🔒 Zapisy zamknięte'}</p>}{match.decision_required && <p className="slm-match-status">⚠ Brak minimum po 17:00 — decyzja administratora</p>}</article>{children}
  </section>;
}

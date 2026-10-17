import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { locationOutline, timeOutline } from 'ionicons/icons';
import type { Match } from '../events/model';
import MatchCapacityProgress from './MatchCapacityProgress';
export default function MatchHero({ match, children, imageSrc = '/images/match-evening.jpg', title = 'Następny mecz', onOpen, openDisabled = false, compact = false }: { match: Match; children?: ReactNode; imageSrc?: string; title?: string; onOpen?: () => void; openDisabled?: boolean; compact?: boolean }) {
  const date = new Date(match.starts_at);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', ...options }).format(date);
  return <section className={`slm-next-match${compact ? ' slm-match-compact' : ''}${title === 'Szczegóły meczu' ? ' slm-match-detail' : ''}`} aria-label={title}>
    {!compact && <h1>{title}</h1>}
    <article className={`slm-hero-card${onOpen ? ' slm-hero-interactive' : ''}`}>
      <div className="slm-stadium-frame" aria-hidden="true"><img src={imageSrc} width="1280" height="785" decoding="async" alt="" className="slm-stadium" onError={event => { const image = event.currentTarget; if (!image.src.endsWith('/images/stadium.svg')) image.src = '/images/stadium.svg'; }} /></div>
      {onOpen && <button type="button" className="slm-card-link" aria-label={`Otwórz szczegóły meczu: ${format({ day: 'numeric', month: 'long' })}, ${match.location}`} disabled={openDisabled} onClick={onOpen}><span aria-hidden="true" /></button>}
      <div className="slm-match-top">
        <time className="slm-date-tile" dateTime={match.starts_at} aria-label={format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
          <span>{format({ weekday: 'short' })}</span><strong>{format({ day: 'numeric' })}</strong><span>{format({ month: 'short' })}</span>
        </time>
        <div className="slm-match-meta"><p className="slm-weekday">{format({ weekday: 'long' })}</p><strong className="slm-kickoff">{format({ hour: '2-digit', minute: '2-digit' })}</strong>
          <p className="slm-location"><IonIcon icon={locationOutline} aria-hidden="true" /> {match.location}</p>
          <p className="slm-match-date"><IonIcon icon={timeOutline} aria-hidden="true" /> {match.duration_minutes} minut · {format({ year: 'numeric' })}</p>
        </div>
      </div>
      {compact ? <p className="slm-compact-count">{match.registered_count} / {match.capacity} zawodników</p> : <MatchCapacityProgress count={match.registered_count} capacity={match.capacity} />}
    {(match.status === 'cancelled' || !match.registration_open) && <p className="slm-match-status">{match.status === 'cancelled' ? '⛔ Mecz odwołany' : '🔒 Zapisy zamknięte'}</p>}</article>{children}
  </section>;
}

import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { locationOutline, timeOutline } from 'ionicons/icons';
import type { Match } from '../events/model';
import { capacityState } from './capacity';
import MatchCapacityProgress from './MatchCapacityProgress';
export default function MatchHero({ match, children, badge, imageSrc = '/assets/branding/stadium-bg-card.jpg', title = 'Następny mecz', onOpen, openDisabled = false, compact = false, displayName, minimum = 10 }: { match: Match; children?: ReactNode; badge?:ReactNode; imageSrc?: string; title?: string; onOpen?: () => void; openDisabled?: boolean; compact?: boolean; displayName?: string; minimum?:number }) {
  const date = new Date(match.starts_at);
  const isDetail = title === 'Szczegóły meczu';
  const capacity = capacityState(match.registered_count, match.capacity, minimum);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hourCycle:'h23', ...options }).format(date);
  return <section className={`slm-next-match${compact ? ' slm-match-compact' : ''}${badge?' slm-has-privacy-badge':''}${title === 'Szczegóły meczu' ? ' slm-match-detail' : ''}`} aria-label={title}>
    {!compact && <h1>{title}</h1>}
    <article className={`slm-hero-card${onOpen ? ' slm-hero-interactive' : ''}`}>
      {badge}
      <div className="slm-stadium-frame" aria-hidden="true"><img src={title === 'Szczegóły meczu' && imageSrc === '/assets/branding/stadium-bg-card.jpg' ? '/assets/branding/stadium-bg-main.jpg' : imageSrc} width="1400" height="800" decoding="async" alt="" className="slm-stadium" onError={event => { const image = event.currentTarget; if (!image.src.endsWith('/assets/branding/stadium-bg-main.jpg')) image.src = '/assets/branding/stadium-bg-main.jpg'; }} /></div>
      {onOpen && <button type="button" className="slm-card-link" aria-label={`Otwórz szczegóły meczu: ${format({ day: 'numeric', month: 'long' })}, ${match.location}`} disabled={openDisabled} onClick={onOpen}><span aria-hidden="true" /></button>}
      <div className="slm-match-top">
        <time className="slm-date-tile" dateTime={match.starts_at} aria-label={format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
          <span>{format({ weekday: 'short' })}</span><strong>{format({ day: 'numeric' })}</strong><span>{format({ month: 'short' })}</span>
        </time>
        <div className="slm-match-meta">{compact ? <h2 className="slm-card-name">{displayName ?? `Mecz · ${format({ weekday: 'long' })}`}</h2> : isDetail ? <><h2 className="slm-detail-name">{displayName ?? `Mecz · ${format({ weekday: 'long' })}`}</h2><strong className="slm-kickoff">{format({ hour: '2-digit', minute: '2-digit' })}</strong></> : <><p className="slm-weekday">{format({ weekday: 'long' })}</p><strong className="slm-kickoff">{format({ hour: '2-digit', minute: '2-digit' })}</strong></>}
          <p className="slm-location"><IonIcon icon={locationOutline} aria-hidden="true" /> {match.location}</p>
          <p className="slm-match-date"><IonIcon icon={timeOutline} aria-hidden="true" /> {compact ? `${format({ hour: '2-digit', minute: '2-digit' })} · ${match.duration_minutes} min` : `${match.duration_minutes} minut · ${format({ year: 'numeric' })}`}</p>
        </div>
      </div>
      {compact ? <p className="slm-compact-count" data-state={capacity.occupied === 0 ? 'empty' : capacity.occupied >= minimum ? 'ready' : 'low'}><strong>{capacity.occupied}/{capacity.total}</strong><span className="slm-sr-only"> zawodników · {capacity.label}</span></p> : <MatchCapacityProgress minimum={minimum} count={match.registered_count} capacity={match.capacity} />}
    {(match.status === 'cancelled' || !match.registration_open) && <p className="slm-match-status">{match.status === 'cancelled' ? '⛔ Mecz odwołany' : '🔒 Zapisy zamknięte'}</p>}{match.decision_required && <p className="slm-match-status">⚠ Brak minimum po 17:00 — decyzja administratora</p>}</article>{children}
  </section>;
}

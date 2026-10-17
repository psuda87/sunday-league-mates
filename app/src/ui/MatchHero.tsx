import type { ReactNode } from 'react';
import type { Match } from '../events/model';
import MatchCapacityProgress from './MatchCapacityProgress';
export default function MatchHero({ match, children, imageSrc = '/images/match-evening.jpg', title = 'Następny mecz', onOpen, openDisabled = false }: { match: Match; children?: ReactNode; imageSrc?: string; title?: string; onOpen?: () => void; openDisabled?: boolean }) {
  const date = new Date(match.starts_at);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', ...options }).format(date);
  return <section className="slm-next-match" aria-label={title}><p className="slm-eyebrow">PIŁKA ŁĄCZY · SUNDAY LEAGUE MATES</p><h1>{title}</h1>
    <article className={`slm-hero-card${onOpen ? ' slm-hero-interactive' : ''}`}>
      {onOpen && <button type="button" className="slm-card-link" aria-label={`Otwórz szczegóły meczu: ${format({ day: 'numeric', month: 'long' })}, ${match.location}`} disabled={openDisabled} onClick={onOpen}><span aria-hidden="true" /></button>}<div className="slm-match-top"><div><p className="slm-weekday">{format({ weekday: 'long' })}</p>
      <strong className="slm-kickoff">{format({ hour: '2-digit', minute: '2-digit' })}</strong>
      <p className="slm-match-date">{format({ day: 'numeric', month: 'long', year: 'numeric' })}</p><p className="slm-location">⌖ {match.location}</p></div>
      <div className="slm-stadium-frame"><img src={imageSrc} width="1280" height="785" decoding="async" alt="" className="slm-stadium" onError={event => { const image = event.currentTarget; if (!image.src.endsWith('/images/stadium.svg')) image.src = '/images/stadium.svg'; }} /><span aria-hidden="true">WIECZÓR NA BOISKU</span></div></div>
      <MatchCapacityProgress count={match.registered_count} capacity={match.capacity} /></article>{children}
  </section>;
}

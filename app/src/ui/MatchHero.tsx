import type { ReactNode } from 'react';
import type { Match } from '../events/model';
import MatchCapacityProgress from './MatchCapacityProgress';
export default function MatchHero({ match, children }: { match: Match; children?: ReactNode }) {
  const date = new Date(match.starts_at);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', ...options }).format(date);
  return <section className="slm-next-match" aria-label="Najbliższy mecz"><p className="slm-eyebrow">SUNDAY LEAGUE MATES · MATCHDAY</p><h1>Następny mecz</h1>
    <article className="slm-hero-card"><div className="slm-match-top"><div><p className="slm-weekday">{format({ weekday: 'long' })}</p>
      <strong className="slm-kickoff">{format({ hour: '2-digit', minute: '2-digit' })}</strong>
      <p>{format({ day: 'numeric', month: 'long', year: 'numeric' })}</p><p className="slm-location">⌖ {match.location}</p></div>
      <img src="/images/stadium.svg" alt="" className="slm-stadium" /></div>
      <MatchCapacityProgress count={match.registered_count} capacity={match.capacity} /></article>{children}
  </section>;
}

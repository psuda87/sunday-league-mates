import { useId, useState } from 'react';
import { BADGES, badgeAsset } from './catalog';
import NewBadgeCelebration from './NewBadgeCelebration';
import type { BadgeDefinition } from './catalog';
import './badges.css';

/** Stan jednej odznaki dla zawodnika: data zdobycia albo bieżący postęp. */
export interface BadgeState { code: string; earnedAt?: string; current?: number; groupName?: string; season?: number }

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Warsaw' });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

function progressLabel(badge: BadgeDefinition, current: number) {
  if (badge.threshold <= 1) return 'Jeszcze niezdobyta';
  if (badge.unit.startsWith('%')) return `${current}% z ${badge.threshold}% meczów grupy`;
  return `${Math.min(current, badge.threshold)}/${badge.threshold} ${badge.unit}`;
}

function Row({ badge, state, onOpen }: { badge: BadgeDefinition; state?: BadgeState; onOpen?: (state: BadgeState) => void }) {
  const earned = !!state?.earnedAt;
  const current = Math.max(0, state?.current ?? 0);
  const percent = Math.min(100, Math.round(current / Math.max(1, badge.threshold) * 100));
  const image = <img className="slm-badge-image" src={badgeAsset(badge.code)} alt="" width={56} height={56} loading="lazy" decoding="async" />;
  return <li className={'slm-badge' + (earned ? ' slm-badge-earned slm-badge-openable' : ' slm-badge-locked')} onClick={earned && onOpen ? () => onOpen(state!) : undefined}>
    {earned && onOpen
      ? <button type="button" className="slm-badge-open" aria-label={`Pokaż odznakę: ${badge.name}`} onClick={event => { event.stopPropagation(); onOpen(state!); }}>{image}</button>
      : image}
    <div className="slm-badge-body">
      <div className="slm-badge-title"><strong>{badge.name}</strong>
        {earned && <span className="slm-badge-date">✓ <span className="slm-visually-hidden">Zdobyta </span>{formatDate(state!.earnedAt!)}</span>}
      </div>
      <p className="slm-badge-description">{badge.description}</p>
      {!earned && (badge.threshold > 1
        ? <div className="slm-badge-progress">
            <div className="slm-badge-bar" role="progressbar" aria-valuemin={0} aria-valuemax={badge.threshold}
              aria-valuenow={Math.min(current, badge.threshold)} aria-label={`Postęp: ${badge.name}`}><span style={{ width: percent + '%' }} /></div>
            <small>{progressLabel(badge, current)}</small>
          </div>
        : <small className="slm-badge-pending">{progressLabel(badge, current)}</small>)}
    </div>
  </li>;
}

/**
 * Odznaki pod kartą zawodnika: zdobyte zawsze widoczne, niezdobyte zwinięte pod „Pokaż pozostałe”
 * (decyzja właściciela 2026-11-16, docs/BADGES_PLAN.md).
 */
export default function BadgeList({ states, own = false, label, anchorId }: { states: readonly BadgeState[]; own?: boolean; label?: string; anchorId?: string }) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<BadgeState | null>(null);
  const headingId = useId(), listId = useId();
  const byCode = new Map(states.map(s => [s.code, s]));
  const visible = BADGES.filter(b => !b.exclusive || byCode.has(b.code));
  const earned = visible.filter(b => byCode.get(b.code)?.earnedAt)
    .sort((a, b) => (byCode.get(b.code)!.earnedAt!).localeCompare(byCode.get(a.code)!.earnedAt!));
  const locked = visible.filter(b => !byCode.get(b.code)?.earnedAt);
  return <section id={anchorId} className="slm-badges" aria-labelledby={headingId} tabIndex={anchorId ? -1 : undefined}>
    <header className="slm-badges-header">
      <h2 id={headingId}>Odznaki</h2>
      <span className="slm-badges-count" aria-label={`Zdobyte ${earned.length} z ${visible.length}`}>{earned.length}/{visible.length}</span>
    </header>
    {label && <p className="slm-badges-note">{label}</p>}
    {earned.length
      ? <ul className="slm-badge-list">{earned.map(b => <Row key={b.code} badge={b} state={byCode.get(b.code)} onOpen={setViewing} />)}</ul>
      : <p className="slm-badges-empty">{own ? 'Zagraj pierwszy mecz, aby zdobyć odznakę Debiutant.' : 'Brak zdobytych odznak.'}</p>}
    {locked.length > 0 && <>
      <button type="button" className="slm-badges-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(v => !v)}>
        {open ? 'Ukryj pozostałe' : `Pokaż pozostałe (${locked.length})`}
      </button>
      <ul id={listId} className="slm-badge-list slm-badge-list-locked" hidden={!open}>
        {locked.map(b => <Row key={b.code} badge={b} state={byCode.get(b.code)} />)}
      </ul>
    </>}
    {viewing?.earnedAt && <NewBadgeCelebration kicker="Odznaka" buttonLabel="Zamknij" onDone={() => setViewing(null)}
      badges={[{ code: viewing.code, group_id: null, group_name: viewing.groupName ?? null, season: viewing.season ?? null, earned_at: viewing.earnedAt, new: false, celebrate: false }]} />}
  </section>;
}

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BADGES, badgeAsset } from './catalog';
import type { EarnedBadge } from './badgeContracts';
import './badges.css';

/**
 * Jednorazowe okienko „Nowa odznaka!” (zatwierdzone przez właściciela): odznaka powiększa się z poświatą,
 * nazwa i opis, przycisk „Super”. Kilka odznak pokazuje po kolei; prefers-reduced-motion wyłącza ruch (CSS).
 */
export default function NewBadgeCelebration({ badges, onDone }: { badges: readonly EarnedBadge[]; onDone: () => void }) {
  const items = badges.map(b => ({ earned: b, badge: BADGES.find(d => d.code === b.code) })).filter(x => x.badge);
  const [index, setIndex] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const titleId = useId(), descriptionId = useId();
  const current = items[index];
  useEffect(() => { button.current?.focus(); }, [index]);
  useEffect(() => { if (!current) onDone(); }, [current, onDone]);
  if (!current) return null;
  const next = () => { if (index + 1 < items.length) setIndex(index + 1); else onDone(); };
  const { badge, earned } = current;
  return createPortal(<div className="slm-badge-celebration-backdrop">
    <div className="slm-badge-celebration" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
      onKeyDown={event => { if (event.key === 'Escape') next(); }}>
      <p className="slm-badge-celebration-kicker">Nowa odznaka!{items.length > 1 ? ` (${index + 1}/${items.length})` : ''}</p>
      <div key={badge!.code} className="slm-badge-celebration-image">
        <img src={badgeAsset(badge!.code)} alt="" width={160} height={160} decoding="async"/>
      </div>
      <h2 id={titleId}>{badge!.name}</h2>
      <p id={descriptionId}>{badge!.description}{earned.group_name ? ` · ${earned.group_name}` : ''}{earned.season ? ` · ${earned.season}` : ''}</p>
      <button ref={button} type="button" onClick={next}>Super</button>
    </div>
  </div>, document.body);
}

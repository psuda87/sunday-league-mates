import { Children, useId, useState } from 'react';
import type { ReactNode } from 'react';
export default function ParticipantGroup({ title, children, emptyText, description, previewLimit }: { title: string; children: ReactNode; emptyText: string; description?: string; previewLimit?: number }) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const rows = Children.toArray(children);
  const canExpand = previewLimit !== undefined && rows.length > previewLimit;
  return <section className="slm-roster-group"><h3>{title} <span>({rows.length})</span></h3>
    {description && <p className="slm-roster-note">{description}</p>}
    {rows.length ? <ul id={listId} className="slm-participants slm-roster-list">{canExpand && !expanded ? rows.slice(0, previewLimit) : rows}</ul> : <p className="slm-roster-note">{emptyText}</p>}
    {canExpand && <button type="button" className="slm-roster-expand" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>{expanded ? 'Zwiń listę' : `Pokaż wszystkich (${rows.length})`} <span aria-hidden="true">{expanded ? '↑' : '↓'}</span></button>}
  </section>;
}
export function RosterSummary({ occupied, capacity, reserve }: { occupied: number; capacity: number; reserve: number }) {
  return <dl className="slm-roster-overview"><div><dt>Na mecz</dt><dd>{occupied} / {capacity}</dd></div><div><dt>Wolne miejsca</dt><dd>{Math.max(0, capacity - occupied)}</dd></div><div><dt>Rezerwa</dt><dd>{reserve}</dd></div></dl>;
}

import { useId } from 'react';
import type { ReactNode } from 'react';

export default function MatchSections({ information, participants, settlement }: {
  information: ReactNode; participants: ReactNode; settlement: ReactNode;
}) {
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const sections = [
    ['info', 'Informacje', information],
    ['participants', 'Uczestnicy', participants],
    ['teams', 'Składy', <section className="slm-panel"><p className="slm-planned">Planowane</p><p>Składy dla tego meczu nie są jeszcze dostępne. Algorytm tworzenia drużyn jest planowany.</p></section>],
    ['settlement', 'Rozliczenie', settlement],
  ] as const;
  return <div className="slm-match-sections">
    <nav aria-label="Sekcje meczu">{sections.map(([key, label]) => <button key={key} aria-controls={`${prefix}-${key}`} onClick={() => {
      const target = document.getElementById(`${prefix}-${key}`);
      target?.scrollIntoView({ block: 'start', behavior: 'instant' }); target?.focus({ preventScroll: true });
    }}>{label}</button>)}</nav>
    {sections.map(([key, label, content]) => <section key={key} id={`${prefix}-${key}`} aria-label={label} tabIndex={-1}>
      <h2 className="slm-section-heading">{label}</h2>{content}
    </section>)}
  </div>;
}

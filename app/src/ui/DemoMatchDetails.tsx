import { useId, useState } from 'react';
import MatchSections from './MatchSections';
export type DetailsVariant = 'a' | 'b';

export default function DemoMatchDetails({ variant, count }: { variant: DetailsVariant; count: number }) {
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [active, setActive] = useState(0);
  const panels = [
    ['Informacje', <section className="slm-panel"><p>Boisko demonstracyjne · 90 minut</p><p>22 października 2026, godz. 18:00 · Europe/Warsaw</p><p className="slm-muted">Przykładowe wydarzenie. Bez prawdziwych zapisów.</p></section>],
    ['Uczestnicy', <section className="slm-panel"><p>{count} / 15 uczestników demonstracyjnych · rezerwa: 0</p><p>Wyłącznie licznik. Bez danych i nazwisk zawodników.</p></section>],
    ['Składy', <section className="slm-panel"><p className="slm-planned">Planowane</p><p>Składy dla tego meczu nie są jeszcze dostępne. Algorytm tworzenia drużyn jest planowany.</p></section>],
    ['Rozliczenie', <section className="slm-panel"><p className="slm-planned">Podgląd planowany</p><p>Rozliczenie nie jest dostępne w demo. Nie pokazujemy fikcyjnych należności, wpłat ani sald.</p></section>],
  ] as const;
  if (variant === 'a') return <MatchSections information={panels[0][1]} participants={panels[1][1]} settlement={panels[3][1]} />;
  return <div className="slm-detail-tabs">
    <div role="tablist" aria-label="Sekcje meczu — wariant B">{panels.map(([label], index) => <button key={label} id={`${prefix}-tab-${index}`} role="tab" aria-selected={active === index} tabIndex={active === index ? 0 : -1} aria-controls={`${prefix}-panel-${index}`} onClick={() => setActive(index)} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null;
      if (next === null) return;
      event.preventDefault(); setActive(next); document.getElementById(`${prefix}-tab-${next}`)?.focus();
    }}>{label}</button>)}</div>
    {panels.map(([label, body], index) => <section key={label} id={`${prefix}-panel-${index}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${index}`} hidden={active !== index} tabIndex={0}>
      <h2 className="slm-section-heading">{label}</h2>{body}
    </section>)}
  </div>;
}

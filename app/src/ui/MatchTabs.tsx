import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { informationCircleOutline, peopleOutline, shirtOutline, starOutline, walletOutline } from 'ionicons/icons';

export default function MatchTabs({ panels }: { panels: readonly ReactNode[] }) {
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [active, setActive] = useState(1);
  // The fifth tab (ratings) exists only where a fifth panel is supplied; the four-tab layout is unchanged.
  const size = panels.length >= 5 ? 5 : 4;
  const labels = ['Informacje', 'Uczestnicy', 'Składy', 'Rozliczenie', 'Oceny'].slice(0, size);
  const icons = [informationCircleOutline, peopleOutline, shirtOutline, walletOutline, starOutline];
  return <div className="slm-detail-tabs">
    <div role="tablist" aria-orientation="horizontal" aria-label="Sekcje meczu" data-tabs={size} style={size === 5 ? { gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' } : undefined}>{labels.map((label, index) => <button key={label} id={`${prefix}-tab-${index}`} role="tab" aria-selected={active === index} tabIndex={active === index ? 0 : -1} aria-controls={`${prefix}-panel-${index}`} onClick={() => setActive(index)} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % size : event.key === 'ArrowLeft' ? (index + size - 1) % size : event.key === 'Home' ? 0 : event.key === 'End' ? size - 1 : null;
      if (next === null) return;
      event.preventDefault(); setActive(next); document.getElementById(`${prefix}-tab-${next}`)?.focus();
    }}><IonIcon icon={icons[index]} aria-hidden="true" /><span>{label}</span></button>)}</div>
    {labels.map((label, index) => <section key={label} id={`${prefix}-panel-${index}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${index}`} hidden={active !== index} tabIndex={0}>
      {panels[index]}
    </section>)}
  </div>;
}

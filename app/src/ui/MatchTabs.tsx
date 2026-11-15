import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { informationCircleOutline, peopleOutline, shirtOutline, starOutline, walletOutline } from 'ionicons/icons';

const TABS = [['Informacje', informationCircleOutline], ['Uczestnicy', peopleOutline], ['Składy', shirtOutline], ['Rozliczenie', walletOutline], ['Oceny', starOutline]] as const;

// withInfo=false: match information lives behind the "i" button on the match card instead of a tab.
export default function MatchTabs({ panels, withInfo = true }: { panels: readonly ReactNode[]; withInfo?: boolean }) {
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [active, setActive] = useState(withInfo ? 1 : 0);
  const available = withInfo ? TABS : TABS.slice(1);
  // The ratings tab exists only where an extra panel is supplied; the base layout is unchanged.
  const base = available.length - 1;
  const size = panels.length > base ? base + 1 : base;
  const labels = available.slice(0, size).map(([label]) => label);
  const icons = available.map(([, icon]) => icon);
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

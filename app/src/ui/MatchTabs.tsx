import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { informationCircleOutline, peopleOutline, shirtOutline, walletOutline } from 'ionicons/icons';

export default function MatchTabs({ panels }: { panels: readonly ReactNode[] }) {
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [active, setActive] = useState(1);
  const labels = ['Informacje', 'Uczestnicy', 'Składy', 'Rozliczenie'];
  const icons = [informationCircleOutline, peopleOutline, shirtOutline, walletOutline];
  return <div className="slm-detail-tabs">
    <div role="tablist" aria-orientation="horizontal" aria-label="Sekcje meczu">{labels.map((label, index) => <button key={label} id={`${prefix}-tab-${index}`} role="tab" aria-selected={active === index} tabIndex={active === index ? 0 : -1} aria-controls={`${prefix}-panel-${index}`} onClick={() => setActive(index)} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null;
      if (next === null) return;
      event.preventDefault(); setActive(next); document.getElementById(`${prefix}-tab-${next}`)?.focus();
    }}><IonIcon icon={icons[index]} aria-hidden="true" /><span>{label}</span></button>)}</div>
    {labels.map((label, index) => <section key={label} id={`${prefix}-panel-${index}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${index}`} hidden={active !== index} tabIndex={0}>
      <h2 className="slm-section-heading">{label}</h2>{panels[index]}
    </section>)}
  </div>;
}

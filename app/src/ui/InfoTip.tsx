import { useId, useState, type ReactNode } from 'react';
import '../groups/GroupControls.css';

/** Nagłówek z ikoną „i”: długie objaśnienia są schowane i pokazują się po kliknięciu (decyzja właściciela 2026-11-25). */
export default function InfoHeading({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false), id = useId();
  return <>
    <div className="slm-info-heading"><h2>{title}</h2>
      <button type="button" className="slm-info-button" aria-expanded={open} aria-controls={id} aria-label={`Informacje: ${title}`} onClick={() => setOpen(v => !v)}>i</button></div>
    {open && <div id={id} className="slm-info-box" role="note">{children}</div>}
  </>;
}

/** Mała ikona „i” przy etykiecie; objaśnienie rozwija się pod nią. */
export function InfoInline({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false), id = useId();
  return <>
    <button type="button" className="slm-info-button slm-info-inline" aria-expanded={open} aria-controls={id} aria-label={`Informacje: ${label}`} onClick={() => setOpen(v => !v)}>i</button>
    {open && <div id={id} className="slm-info-box" role="note">{children}</div>}
  </>;
}

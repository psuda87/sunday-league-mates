import type { ReactNode } from 'react';
import { IonButton } from '@ionic/react';
export default function MatchHeader({ onBack, busy = false, action, title = 'Mecze', backLabel = 'Wróć do meczów' }: { onBack?: () => void; busy?: boolean; action?: ReactNode; title?: string; backLabel?: string }) {
  return <header className="slm-floating-brand slm-compact-header">
    {onBack && <IonButton className="slm-compact-back" fill="clear" disabled={busy} aria-label={backLabel} onClick={onBack}><span aria-hidden="true">←</span><span className="slm-sr-only">{backLabel}</span></IonButton>}
    <h1>{title}</h1>{action}
    <img className="slm-logo slm-crest slm-floating-crest" src="/assets/branding/slm-logo-primary-transparent.png" alt="Sunday League Mates" width="450" height="505" />
  </header>;
}

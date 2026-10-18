import type { ReactNode } from 'react';
import { IonButton } from '@ionic/react';
export default function MatchHeader({ onBack, busy = false, action }: { onBack?: () => void; busy?: boolean; action?: ReactNode }) {
  return <header className="slm-floating-brand slm-compact-header">
    {onBack && <IonButton className="slm-compact-back" fill="clear" disabled={busy} aria-label="Wróć do meczów" onClick={onBack}><span aria-hidden="true">←</span><span className="slm-sr-only">Wróć do meczów</span></IonButton>}
    <h1>Mecze</h1>{action}
    <img className="slm-logo slm-crest slm-floating-crest" src="/assets/branding/slm-logo-primary-transparent.png" alt="Sunday League Mates" width="450" height="505" />
  </header>;
}

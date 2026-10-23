import { IonIcon } from '@ionic/react';
import { lockClosedOutline, lockOpenOutline } from 'ionicons/icons';

export default function EventPrivacy({ visibility }: { visibility: 'public' | 'private' }) {
  return <span className="slm-privacy-badge"><IonIcon aria-hidden="true" icon={visibility === 'public' ? lockOpenOutline : lockClosedOutline} />{visibility === 'public' ? 'Publiczne' : 'Prywatne'}</span>;
}

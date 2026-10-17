import { useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonContent, IonFooter, IonButton } from '@ionic/react';
import MatchHero from './MatchHero';
import AppearanceSettings from './AppearanceSettings';
import BottomNav from './BottomNav';
import type { Tab } from './BottomNav';
import '../pages/Accounts.css';
import type { Match } from '../events/model';
// Static fixture: no API, credentials or personal data.
const demo: Match = { id: 'demo', starts_at: '2026-10-22T16:00:00Z', location: 'Boisko demonstracyjne', duration_minutes: 90, hourly_rate: 180, total_cost: 270, capacity: 15, status: 'scheduled', registered_count: 12, reserve_count: 0, registration_open: true, decision_required: false, cutoff_at: '', estimated_per_person: null, settlements_active: false };
export default function Demo() {
  const [tab, setTab] = useState<Tab>('events');
  return <IonPage className="slm-demo"><IonHeader><IonToolbar><div className="slm-shell-header"><span className="slm-logo">SLM</span><span>DEMO</span></div></IonToolbar></IonHeader>
    <IonContent><main className="slm-accounts"><p className="slm-demo-banner">PODGLĄD UI · Dane demonstracyjne · Brak połączenia z backendem</p>
      {tab === 'events' ? <MatchHero match={demo}><IonButton expand="block" className="slm-match-cta" disabled>ZAPISZ SIĘ NA MECZ · DEMO</IonButton></MatchHero> : tab !== 'profile' && <section className="slm-panel"><h1>{tab === 'teams' ? 'Składy' : 'Zawodnicy'}</h1><p>Ten ekran nie jest częścią demonstracji.</p></section>}
      <AppearanceSettings /></main></IonContent><IonFooter><BottomNav active={tab} onSelect={setTab} /></IonFooter></IonPage>;
}

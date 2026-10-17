import { notificationsOutline } from 'ionicons/icons';
import { useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonContent, IonFooter, IonButton, IonIcon } from '@ionic/react';
import MatchHero from './MatchHero';
import AppearanceSettings from './AppearanceSettings';
import BottomNav from './BottomNav';
import type { Tab } from './BottomNav';
import '../pages/Accounts.css';
import type { Match } from '../events/model';
// Static fixture: no API, credentials or personal data.
const demo: Match = { id: 'demo', starts_at: '2026-10-22T16:00:00Z', location: 'Boisko demonstracyjne', duration_minutes: 90, hourly_rate: 180, total_cost: 270, capacity: 15, status: 'scheduled', registered_count: 12, reserve_count: 0, registration_open: true, decision_required: false, cutoff_at: '', estimated_per_person: null, settlements_active: false };
export default function Demo() {
  const [count, setCount] = useState(12);
  const [tab, setTab] = useState<Tab>('events');
  return <IonPage className="slm-demo"><IonHeader><IonToolbar><div className="slm-shell-header"><span className="slm-logo" title="Miejsce na zatwierdzony herb SLM">SLM</span><span className="slm-demo-header"><small>DEMO UI</small><IonIcon icon={notificationsOutline} aria-label="Podgląd ikony powiadomień" /></span></div></IonToolbar></IonHeader>
    <IonContent><main className="slm-accounts"><p className="slm-demo-banner">PODGLĄD UI · Dane demonstracyjne · Bez połączenia z backendem</p>
      {tab === 'events' ? <MatchHero match={{ ...demo, registered_count: count }}><IonButton expand="block" className="slm-match-cta" disabled>ZAPISZ SIĘ NA MECZ · DEMO</IonButton></MatchHero> : tab !== 'profile' && <section className="slm-panel"><h1>{tab === 'teams' ? 'Składy' : 'Zawodnicy'}</h1><p>Ten ekran nie jest częścią demonstracji.</p></section>}
      {tab === 'events' && <section className="slm-panel slm-demo-capacity"><h2>Przetestuj zajętość</h2>
        <label htmlFor="demo-count">Przykładowi uczestnicy: {count} / 15</label>
        <input id="demo-count" type="range" min="0" max="15" step="1" value={count} onChange={event => setCount(Number(event.target.value))} style={{ width: '100%', minHeight: 44 }} />
        <p className="slm-muted">Symulacja lokalna · bez zapisu na mecz i bez danych zawodników.</p>
      </section>}
      <AppearanceSettings /></main></IonContent><IonFooter><BottomNav active={tab} onSelect={setTab} /></IonFooter></IonPage>;
}

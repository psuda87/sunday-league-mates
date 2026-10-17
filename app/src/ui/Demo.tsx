import { notificationsOutline } from 'ionicons/icons';
import { useEffect, useRef, useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonContent, IonFooter, IonButton, IonIcon } from '@ionic/react';
import DemoMatchDetails from './DemoMatchDetails';
import MatchHero from './MatchHero';
import AppearanceSettings from './AppearanceSettings';
import BottomNav from './BottomNav';
import type { Tab } from './BottomNav';
import '../pages/Accounts.css';
import type { Match } from '../events/model';
type View = 'home' | 'compare' | 'details-a' | 'details-b';
const readView = (): View => {
  const hash = window.location.hash.slice(1);
  return hash === 'compare' || hash === 'details-a' || hash === 'details-b' ? hash : 'home';
};
// Static fixture: no API, credentials or personal data.
const demo: Match = { id: 'demo', starts_at: '2026-10-22T16:00:00Z', location: 'Boisko demonstracyjne', duration_minutes: 90, hourly_rate: 180, total_cost: 270, capacity: 15, status: 'scheduled', registered_count: 12, reserve_count: 0, registration_open: true, decision_required: false, cutoff_at: '', estimated_per_person: null, settlements_active: false };
export default function Demo() {
  const content = useRef<HTMLIonContentElement>(null);
  const [view, setView] = useState<View>(readView);
  const [count, setCount] = useState(12);
  const [tab, setTab] = useState<Tab>('events');
  useEffect(() => {
    const sync = () => { setView(readView()); setTab('events'); void content.current?.scrollToTop?.(0); };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  function navigate(next: View) { setView(next); window.location.hash = next; void content.current?.scrollToTop?.(0); }
  return <IonPage className="slm-demo"><IonHeader><IonToolbar><div className="slm-shell-header"><span className="slm-logo" title="Miejsce na zatwierdzony herb SLM">SLM</span><span className="slm-demo-header"><small>DEMO UI</small><IonIcon icon={notificationsOutline} aria-label="Podgląd ikony powiadomień" /></span></div></IonToolbar></IonHeader>
    <IonContent ref={content}><main className="slm-accounts"><p className="slm-demo-banner">PODGLĄD UI · Dane demonstracyjne · Bez połączenia z backendem</p>
      {tab === 'events' ? <>
        {view !== 'home' && <div className="slm-actions"><IonButton fill="clear" onClick={() => navigate('home')}>← Wróć do meczów</IonButton>{view !== 'compare' && <IonButton fill="clear" onClick={() => navigate('compare')}>Porównaj A i B</IonButton>}</div>}
        {view === 'home' ? <MatchHero match={{ ...demo, registered_count: count }} onOpen={() => navigate('compare')}>
          <IonButton expand="block" className="slm-match-cta" disabled>ZAPISZ SIĘ NA MECZ · DEMO</IonButton>
        </MatchHero> : view === 'compare' ? <>
          <h1>Porównaj szczegóły meczu</h1><p className="slm-muted">Dwa układy tego samego wydarzenia. Wariant docelowy nie został wybrany.</p>
          {(['a', 'b'] as const).map(variant => <section key={variant} className="slm-variant-preview" aria-label={`Wariant ${variant.toUpperCase()}`}>
            <p className="slm-eyebrow">WARIANT {variant.toUpperCase()}</p><h2>{variant === 'a' ? 'A · Sekcje jedna pod drugą' : 'B · Przełączane zakładki'}</h2>
            <IonButton fill="outline" expand="block" onClick={() => navigate(variant === 'a' ? 'details-a' : 'details-b')}>Otwórz {variant.toUpperCase()} w pełnym widoku</IonButton>
            <DemoMatchDetails variant={variant} count={count} />
          </section>)}
        </> : <>
          <MatchHero match={{ ...demo, registered_count: count }} title={`Szczegóły meczu · ${view === 'details-a' ? 'A' : 'B'}`} />
          <section className="slm-variant-full" aria-label={`Pełny wariant ${view === 'details-a' ? 'A' : 'B'}`}><p className="slm-eyebrow">WARIANT {view === 'details-a' ? 'A · SEKCJE JEDNA POD DRUGĄ' : 'B · PRZEŁĄCZANE ZAKŁADKI'}</p><DemoMatchDetails key={view} variant={view === 'details-a' ? 'a' : 'b'} count={count} /></section>
        </>}
        {view === 'home' && <section className="slm-panel slm-demo-capacity"><h2>Przetestuj zajętość</h2>
          <label htmlFor="demo-count">Przykładowi uczestnicy: {count} / 15</label>
          <input id="demo-count" type="range" min="0" max="15" step="1" value={count} onChange={event => setCount(Number(event.target.value))} style={{ width: '100%', minHeight: 44 }} />
          <p className="slm-muted">Symulacja lokalna · bez zapisu na mecz i bez danych zawodników.</p>
        </section>}
      </> : tab === 'players' && <section className="slm-panel"><h1>Zawodnicy</h1><p className="slm-planned">Planowane</p><p>Katalog zawodników nie jest dostępny w demonstracji.</p></section>}
      <AppearanceSettings /></main></IonContent><IonFooter><BottomNav active={tab} onSelect={value => { setTab(value); setView('home'); window.history.replaceState(window.history.state, '', '#home'); void content.current?.scrollToTop?.(0); }} /></IonFooter></IonPage>;
}

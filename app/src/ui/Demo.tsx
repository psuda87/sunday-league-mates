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
  return hash === 'compare' || hash === 'details-a' || hash === 'details-b' ? hash : hash === 'details' ? 'details-b' : 'home';
};
// Static fixture: no API, credentials or personal data.
const demo: Match = { id: 'demo', starts_at: '2026-10-22T16:00:00Z', location: 'Boisko demonstracyjne', duration_minutes: 90, hourly_rate: 180, total_cost: 270, capacity: 15, status: 'scheduled', registered_count: 12, reserve_count: 0, registration_open: true, decision_required: false, cutoff_at: '', estimated_per_person: null, settlements_active: false };
export default function Demo() {
  const content = useRef<HTMLIonContentElement>(null);
  const [view, setView] = useState<View>(readView);
  const [count, setCount] = useState(12);
  const [selected, setSelected] = useState(0);
  const fixtures = [demo, { ...demo, id: 'demo-2', starts_at: '2026-10-29T17:00:00Z', registered_count: 8 }, { ...demo, id: 'demo-3', starts_at: '2026-11-05T17:00:00Z', registered_count: 5 }];
  const current = fixtures[selected];
  const currentCount = selected === 0 ? count : current.registered_count;
  const [tab, setTab] = useState<Tab>('events');
  useEffect(() => {
    const sync = () => { setView(readView()); setTab('events'); void content.current?.scrollToTop?.(0); };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  function navigate(next: View) { setView(next); window.location.hash = next; void content.current?.scrollToTop?.(0); }
  return <IonPage className="slm-demo"><IonHeader><IonToolbar><div className="slm-shell-header"><img className="slm-logo slm-crest" src="/assets/branding/slm-crest-espana.svg" alt="Sunday League Mates" width="54" height="61" /><span className="slm-demo-header"><IonIcon icon={notificationsOutline} aria-label="Podgląd ikony powiadomień" /></span></div></IonToolbar></IonHeader>
    <IonContent ref={content}><main className="slm-accounts"><p className="slm-demo-badge">Dane przykładowe</p>
      {tab === 'events' ? <>
        {view !== 'home' && <div className="slm-actions"><IonButton fill="clear" onClick={() => navigate('home')}>← Wróć do meczów</IonButton></div>}
        {view === 'home' ? <><MatchHero match={{ ...demo, registered_count: count }} onOpen={() => { setSelected(0); navigate('details-b'); }}>
          <IonButton expand="block" className="slm-match-cta" disabled>ZAPISZ SIĘ NA MECZ</IonButton>
        </MatchHero><div className="slm-demo-fixtures" aria-label="Kolejne przykładowe mecze">{fixtures.slice(1).map((fixture, index) => <MatchHero key={fixture.id} match={fixture} compact title="Przykładowy mecz" onOpen={() => { setSelected(index + 1); navigate('details-b'); }} />)}</div></> : view === 'compare' ? <>
          <h1>Porównaj szczegóły meczu</h1><p className="slm-muted">Dwa układy tego samego wydarzenia. Wariant docelowy nie został wybrany.</p>
          {(['a', 'b'] as const).map(variant => <section key={variant} className="slm-variant-preview" aria-label={`Wariant ${variant.toUpperCase()}`}>
            <p className="slm-eyebrow">WARIANT {variant.toUpperCase()}</p><h2>{variant === 'a' ? 'A · Sekcje jedna pod drugą' : 'B · Przełączane zakładki'}</h2>
            <IonButton fill="outline" expand="block" onClick={() => navigate(variant === 'a' ? 'details-a' : 'details-b')}>Otwórz {variant.toUpperCase()} w pełnym widoku</IonButton>
            <DemoMatchDetails variant={variant} count={count} />
          </section>)}
        </> : <>
          <MatchHero match={{ ...current, registered_count: currentCount }} title="Szczegóły meczu" />
          <section className="slm-variant-full" aria-label={`Pełny wariant ${view === 'details-a' ? 'A' : 'B'}`}><DemoMatchDetails key={view} variant={view === 'details-a' ? 'a' : 'b'} count={currentCount} startsAt={current.starts_at} /></section>
        </>}
      </> : tab === 'players' && <section className="slm-panel"><h1>Zawodnicy</h1><p className="slm-planned">Planowane</p><p>Katalog zawodników nie jest dostępny w demonstracji.</p></section>}
      <details className="slm-demo-tools"><summary>Narzędzia demo</summary>
        <p className="slm-muted">Fikcyjne dane, brak API, logowania i połączeń z backendem. Przycisk zapisu jest nieaktywny.</p>
        <section className="slm-panel slm-demo-capacity"><h2>Przetestuj zajętość</h2>
          <label htmlFor="demo-count">Przykładowi uczestnicy: {count} / 15</label>
          <input id="demo-count" type="range" min="0" max="15" step="1" value={count} onChange={event => setCount(Number(event.target.value))} style={{ width: '100%', minHeight: 44 }} />
          <p className="slm-muted">Symulacja lokalna · bez zapisu na mecz i bez danych zawodników.</p>
        </section>
        <AppearanceSettings /><IonButton fill="clear" onClick={() => { setTab('events'); navigate('compare'); }}>Archiwalne porównanie A/B</IonButton>
      </details></main></IonContent><IonFooter><BottomNav active={tab} onSelect={value => { setTab(value); setView('home'); window.history.replaceState(window.history.state, '', '#home'); void content.current?.scrollToTop?.(0); }} /></IonFooter></IonPage>;
}

import { useEffect, useRef, useState } from 'react';
import { IonPage, IonContent, IonFooter, IonButton } from '@ionic/react';
import DemoMatchDetails from './DemoMatchDetails';
import MatchHero from './MatchHero';
import MatchFilters from './MatchFilters';
import type { MatchFilter } from './MatchFilters';
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
  const [filter, setFilter] = useState<MatchFilter>('upcoming');
  const fixtures = [demo, { ...demo, id: 'demo-2', starts_at: '2026-10-29T17:00:00Z', registered_count: 8 }, { ...demo, id: 'demo-3', starts_at: '2026-11-05T17:00:00Z', registered_count: 5 }, { ...demo, id: 'demo-4', starts_at: '2026-11-12T17:00:00Z', registered_count: 0 }, { ...demo, id: 'demo-history', starts_at: '2026-10-08T16:00:00Z', registered_count: 15, registration_open: false }];
  const names = ['El Clásico · demo', 'La Liga · demo', 'Rondo Cup · demo', 'Derby · demo', 'Mecz archiwalny · demo'];
  const visible = fixtures.map((match, index) => ({ match, index })).filter(({ index }) => filter === 'history' ? index === 4 : filter === 'mine' ? index === 0 || index === 2 : index < 4);
  const current = fixtures[selected];
  const currentCount = selected === 0 ? count : current.registered_count;
  const [tab, setTab] = useState<Tab>('events');
  useEffect(() => {
    const sync = () => { setView(readView()); setTab('events'); void content.current?.scrollToTop?.(0); };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  function navigate(next: View) { setView(next); window.location.hash = next; void content.current?.scrollToTop?.(0); }
  return <IonPage className="slm-demo">
    <IonContent ref={content}><main className="slm-accounts"><div className="slm-shell-header slm-floating-brand"><img className="slm-logo slm-crest slm-floating-crest" src="/assets/branding/slm-logo-primary-transparent.png" alt="Sunday League Mates" width="450" height="505" /></div><p className="slm-demo-badge">Dane przykładowe</p>
      {tab === 'events' ? <>
        {view !== 'home' && <div className="slm-actions slm-detail-back"><IonButton fill="clear" onClick={() => navigate('home')}>← Wróć do meczów</IonButton></div>}
        {view === 'home' ? <section className="slm-matches-screen" aria-label="Mecze demonstracyjne"><h1>Mecze</h1><MatchFilters value={filter} onChange={setFilter} /><div className="slm-match-list" aria-live="polite">{visible.map(({ match, index }) => <MatchHero key={match.id} match={{ ...match, registered_count: index === 0 ? count : match.registered_count }} compact title="Przykładowy mecz" displayName={names[index]} onOpen={() => { setSelected(index); navigate('details-b'); }} />)}</div></section> : view === 'compare' ? <>
          <h1>Porównaj szczegóły meczu</h1><p className="slm-muted">Dwa układy tego samego wydarzenia. Wariant docelowy nie został wybrany.</p>
          {(['a', 'b'] as const).map(variant => <section key={variant} className="slm-variant-preview" aria-label={`Wariant ${variant.toUpperCase()}`}>
            <p className="slm-eyebrow">WARIANT {variant.toUpperCase()}</p><h2>{variant === 'a' ? 'A · Sekcje jedna pod drugą' : 'B · Przełączane zakładki'}</h2>
            <IonButton fill="outline" expand="block" onClick={() => navigate(variant === 'a' ? 'details-a' : 'details-b')}>Otwórz {variant.toUpperCase()} w pełnym widoku</IonButton>
            <DemoMatchDetails variant={variant} count={count} />
          </section>)}
        </> : <>
          <MatchHero match={{ ...current, registered_count: currentCount }} title="Szczegóły meczu" displayName={names[selected]}><IonButton expand="block" className="slm-match-cta" disabled>ZAPISZ SIĘ NA MECZ</IonButton></MatchHero>
          <section className="slm-variant-full" aria-label={`Pełny wariant ${view === 'details-a' ? 'A' : 'B'}`}><DemoMatchDetails key={view} variant={view === 'details-a' ? 'a' : 'b'} count={currentCount} startsAt={current.starts_at} /></section>
        </>}
      </> : tab === 'players' && <section className="slm-panel"><h1>Zawodnicy</h1><p className="slm-planned">Planowane</p><p>Katalog zawodników nie jest dostępny w demonstracji.</p></section>}
      <details className="slm-demo-tools"><summary>Narzędzia demo</summary>
        <p className="slm-muted">Fikcyjne dane, brak API, logowania i połączeń z backendem. Przycisk zapisu w szczegółach jest nieaktywny.</p>
        <section className="slm-panel slm-demo-capacity"><h2>Przetestuj zajętość</h2>
          <label htmlFor="demo-count">Przykładowi uczestnicy: {count} / 15</label>
          <input id="demo-count" type="range" min="0" max="15" step="1" value={count} onChange={event => setCount(Number(event.target.value))} style={{ width: '100%', minHeight: 44 }} />
          <p className="slm-muted">Symulacja lokalna · bez zapisu na mecz i z fikcyjnymi uczestnikami.</p>
        </section>
        <AppearanceSettings /><IonButton fill="clear" onClick={() => { setTab('events'); navigate('compare'); }}>Archiwalne porównanie A/B</IonButton>
      </details></main></IonContent><IonFooter><BottomNav active={tab} onSelect={value => { setTab(value); setView('home'); window.history.replaceState(window.history.state, '', '#home'); void content.current?.scrollToTop?.(0); }} /></IonFooter></IonPage>;
}

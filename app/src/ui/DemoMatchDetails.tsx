import MatchSections from './MatchSections';
import { IonIcon } from '@ionic/react';
import { checkmarkCircleOutline, timeOutline } from 'ionicons/icons';
export type DetailsVariant = 'a' | 'b';

export default function DemoMatchDetails({ variant, count, startsAt = '2026-10-22T16:00:00Z' }: { variant: DetailsVariant; count: number; startsAt?: string }) {
  const panels = [
    ['Informacje', <section className="slm-panel"><p>Boisko demonstracyjne · 90 minut</p><p>{new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'long', timeStyle: 'short' }).format(new Date(startsAt))} · Europe/Warsaw</p><p className="slm-muted">Przykładowe wydarzenie. Bez prawdziwych zapisów.</p></section>],
    ['Uczestnicy', <section className="slm-demo-roster"><p className="slm-roster-summary">{count} / 15 uczestników <span>Dane przykładowe</span></p>{[
      { label: 'Zapisani', count: Math.max(0, count - Math.min(2, count)), names: ['Alex', 'Kamil', 'Marek', 'Piotr', 'Adrian', 'Olek', 'Jan', 'Patryk', 'Igor', 'Filip', 'Leon', 'Dawid', 'Adam'], reserve: false },
      { label: 'Goście', count: Math.min(2, count), names: ['Tomek', 'Łukasz'], reserve: false },
      { label: 'Rezerwa', count: 2, names: ['Rafał', 'Michał'], reserve: true },
    ].map(group => <section className="slm-roster-group" key={group.label}><h3>{group.label} <span>({group.count})</span></h3>{group.count === 0 ? <p className="slm-muted">Brak uczestników w tej grupie.</p> : <ul>{group.names.slice(0, group.count).map((name, index) => <li key={name}><span className="slm-roster-avatar" aria-hidden="true">{name.slice(0, 1)}{index + 1}</span><span>{name}<small>{group.label === 'Goście' ? 'Gość · dane przykładowe' : 'Zawodnik demonstracyjny'}</small></span><IonIcon icon={group.reserve ? timeOutline : checkmarkCircleOutline} aria-label={group.reserve ? 'Na rezerwie' : 'Zapisany'} /></li>)}</ul>}</section>)}<p className="slm-muted">Fikcyjne osoby. Rezerwa nie zwiększa zajętości.</p></section>],
    ['Składy', <section className="slm-panel"><p className="slm-planned">Planowane</p><p>Składy dla tego meczu nie są jeszcze dostępne. Algorytm tworzenia drużyn jest planowany.</p></section>],
    ['Rozliczenie', <section className="slm-panel"><p className="slm-planned">Podgląd planowany</p><p>Rozliczenie nie jest dostępne w demo. Nie pokazujemy fikcyjnych należności, wpłat ani sald.</p></section>],
  ] as const;
  return <MatchSections layout={variant === 'a' ? 'stacked' : 'tabs'} information={panels[0][1]} participants={panels[1][1]} settlement={panels[3][1]} />;
}

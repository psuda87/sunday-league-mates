import ParticipantGroup, { RosterSummary } from './ParticipantGroup';
import MatchSections from './MatchSections';
import { IonIcon } from '@ionic/react';
import { checkmarkCircleOutline, timeOutline } from 'ionicons/icons';
export type DetailsVariant = 'a' | 'b';

export default function DemoMatchDetails({ variant, count, startsAt = '2026-10-22T16:00:00Z' }: { variant: DetailsVariant; count: number; startsAt?: string }) {
  const panels = [
    ['Informacje', <section className="slm-panel slm-match-info"><dl className="slm-match-facts"><div><dt>Termin · Europe/Warsaw</dt><dd>{new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'long', timeStyle: 'short' }).format(new Date(startsAt))}</dd></div><div><dt>Lokalizacja</dt><dd>Boisko demonstracyjne</dd></div><div><dt>Czas gry</dt><dd>90 minut</dd></div><div><dt>Miejsca</dt><dd>{count} / 15 · minimum 10</dd></div></dl><p className="slm-muted">Przykładowe wydarzenie. Bez prawdziwych zapisów.</p></section>],
    ['Uczestnicy', <section className="slm-demo-roster"><RosterSummary occupied={count} capacity={15} reserve={2} />{[
      { label: 'Zapisani', count: Math.max(0, count - Math.min(2, count)), names: ['Alex', 'Kamil', 'Marek', 'Piotr', 'Adrian', 'Olek', 'Jan', 'Patryk', 'Igor', 'Filip', 'Leon', 'Dawid', 'Adam'], reserve: false },
      { label: 'Goście', count: Math.min(2, count), names: ['Tomek', 'Łukasz'], reserve: false },
      { label: 'Rezerwa', count: 2, names: ['Rafał', 'Michał'], reserve: true },
    ].map(group => <ParticipantGroup key={group.label} title={group.label} emptyText="Brak uczestników w tej grupie." previewLimit={group.label === 'Zapisani' ? 5 : undefined}>{group.names.slice(0, group.count).map((name, index) => <li key={name}><span className="slm-roster-avatar" aria-hidden="true">{name.slice(0, 1)}{index + 1}</span><span>{name}<small>{group.label === 'Goście' ? 'Gość · dane przykładowe' : group.reserve ? 'Na rezerwie' : 'Zapisany · dane przykładowe'}</small></span><IonIcon icon={group.reserve ? timeOutline : checkmarkCircleOutline} aria-label={group.reserve ? 'Na rezerwie' : 'Zapisany'} /></li>)}</ParticipantGroup>)}<p className="slm-muted">Fikcyjne osoby. Rezerwa nie zwiększa zajętości.</p></section>],
    ['Składy', <section className="slm-panel"><p className="slm-planned">Planowane</p><p>Składy dla tego meczu nie są jeszcze dostępne. Algorytm tworzenia drużyn jest planowany.</p></section>],
    ['Rozliczenie', <section className="slm-panel"><p className="slm-planned">Funkcja w przygotowaniu</p><p>Rozliczenie nie jest dostępne w demo. Nie pokazujemy fikcyjnych należności, wpłat ani sald.</p></section>],
  ] as const;
  return <MatchSections layout={variant === 'a' ? 'stacked' : 'tabs'} information={panels[0][1]} participants={panels[1][1]} settlement={panels[3][1]} />;
}

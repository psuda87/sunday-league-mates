import MatchSections from './MatchSections';
export type DetailsVariant = 'a' | 'b';

export default function DemoMatchDetails({ variant, count }: { variant: DetailsVariant; count: number }) {
  const panels = [
    ['Informacje', <section className="slm-panel"><p>Boisko demonstracyjne · 90 minut</p><p>22 października 2026, godz. 18:00 · Europe/Warsaw</p><p className="slm-muted">Przykładowe wydarzenie. Bez prawdziwych zapisów.</p></section>],
    ['Uczestnicy', <section className="slm-panel"><p>{count} / 15 uczestników demonstracyjnych · rezerwa: 0</p><p>Wyłącznie licznik. Bez danych i nazwisk zawodników.</p></section>],
    ['Składy', <section className="slm-panel"><p className="slm-planned">Planowane</p><p>Składy dla tego meczu nie są jeszcze dostępne. Algorytm tworzenia drużyn jest planowany.</p></section>],
    ['Rozliczenie', <section className="slm-panel"><p className="slm-planned">Podgląd planowany</p><p>Rozliczenie nie jest dostępne w demo. Nie pokazujemy fikcyjnych należności, wpłat ani sald.</p></section>],
  ] as const;
  return <MatchSections layout={variant === 'a' ? 'stacked' : 'tabs'} information={panels[0][1]} participants={panels[1][1]} settlement={panels[3][1]} />;
}

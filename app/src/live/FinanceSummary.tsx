import { money } from '../events/model';

export default function FinanceSummary({ balanceCents, outstandingCents }: { balanceCents: number; outstandingCents: number }) {
  return <dl className="slm-finance-tiles" aria-label="Twoje rozliczenie w wybranej grupie">
    <div><dt>Moje saldo w grupie</dt><dd>{money(balanceCents / 100)}</dd></div>
    <div><dt>Pozostało do zapłaty</dt><dd>{money(outstandingCents / 100)}</dd></div>
  </dl>;
}

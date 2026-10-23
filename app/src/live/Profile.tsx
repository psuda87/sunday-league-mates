import type { ReactNode } from 'react';
import type { Profile as AccountProfile } from '../auth/api';
import MatchHeader from '../ui/MatchHeader';
import UltimatePlayerCard from '../ui/UltimatePlayerCard';

export default function Profile({ profile, children, accountActions, appearance }: {
  profile: AccountProfile | null; children: ReactNode; accountActions: ReactNode; appearance: ReactNode;
}) {
  return <div className="slm-players-screen slm-ultimate-profile slm-live-profile">
    <MatchHeader title="Mój profil" />
    {profile ? <>
      <UltimatePlayerCard name={profile.display_name} />
      {profile.phone && <a className="slm-call" href={`tel:${profile.phone}`}>Zadzwoń</a>}
      <section className="slm-player-stats slm-ultimate-summary" aria-label="Statystyki zawodnika">
        <dl className="slm-ultimate-stats">{['Mecze', 'Bramki', 'Asysty', 'MVP'].map(label =>
          <div key={label}><dt>{label}</dt><dd aria-label={`${label}: niedostępne`}>—</dd></div>)}</dl>
        <p className="slm-muted">Statystyki, zdjęcie i numer koszulki są w przygotowaniu.</p>
      </section>
    </> : <p role="status">Wczytywanie profilu…</p>}
    <details className="slm-identity-settings slm-live-profile-edit">
      <summary>Edytuj profil i dane konta</summary>{children}
    </details>
    <details className="slm-identity-settings">
      <summary>Ustawienia aplikacji i konta</summary>{appearance}{accountActions}
    </details>
  </div>;
}

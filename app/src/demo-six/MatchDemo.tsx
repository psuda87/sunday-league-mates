import { useReducer, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import DemoTeams from '../demo/Teams';
import DemoProfile from '../demo/Profile';
import { personName, reduceWorld } from '../demo/data';
import AppearanceSettings from '../ui/AppearanceSettings';
import MatchHeader from '../ui/MatchHeader';
import ParticipantGroup, { RosterSummary } from '../ui/ParticipantGroup';
import '../pages/Accounts.css';
import '../demo/palettes.css';
import { createMatchDemo } from './fixture';
import './match.css';

export default function MatchDemo() {
  const [world, dispatch] = useReducer(reduceWorld, undefined, createMatchDemo);
  const [profile, setProfile] = useState<string | null>(null);
  const game = world.games[0];
  return <IonPage className="slm-demo slm-demo-six"><IonContent><main className="slm-accounts">
    {profile ? <DemoProfile world={world} id={profile} dispatch={dispatch} onBack={() => setProfile(null)}/> : <>
      <MatchHeader title="Sparing 6 na 6"/>
      <p className="slm-demo-badge">Fikcyjny mecz testowy · dane tylko w pamięci przeglądarki</p>
      <section className="slm-panel slm-match-info"><h2>{game.name}</h2>
        <p>12 uczestników · bez opłat. Numery koszulek są przykładowe.</p>
        <p>Składy dobrano automatycznie, naprzemiennie z listy. To test obsługi składów, bez ocen umiejętności.</p>
        <p>Aby zamienić zawodników, włącz „Zamień zawodników” i wybierz po jednej osobie z każdej drużyny. Gościa również można zamienić.</p>
      </section>
      <DemoTeams world={world} game={game} dispatch={dispatch} onPlayer={setProfile} fullNames/>
      <section className="slm-demo-roster" aria-label="Uczestnicy meczu testowego">
        <RosterSummary occupied={game.entries.length} capacity={12} reserve={0}/>
        <ParticipantGroup title="Uczestnicy" emptyText="Brak uczestników.">
          {game.entries.map(entry => <li key={entry.id}><span className="slm-roster-avatar" aria-hidden="true">{entry.playerId ? world.players.find(p => p.id === entry.playerId)?.jerseyNumber : 'G'}</span>
            <div className="slm-demo-person-meta">{entry.playerId ? <button type="button" className="slm-demo-person" onClick={() => setProfile(entry.playerId)}>{personName(world, entry)}</button> : <span>{personName(world, entry)}</span>}
              <small>{entry.playerId ? 'Zawodnik fikcyjny' : 'Gość krystiana · bez konta'}</small>
            </div></li>)}
        </ParticipantGroup>
      </section>
      <details className="slm-demo-tools"><summary>Wygląd aplikacji</summary><AppearanceSettings enablePalettes/></details>
      <p className="slm-teams-disclaimer">Odświeżenie strony przywraca początkowe dane i podział 6 na 6. Zmiany nie są zapisywane na serwerze.</p>
    </>}
  </main></IonContent></IonPage>;
}

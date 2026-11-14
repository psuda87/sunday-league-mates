import { useEffect, useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import { scoreWarnings } from './ratingContracts';
import type { MatchRatingState, Team } from './ratingContracts';
import { useMatchRating } from './useMatchRating';
import { useRatingsRefresh } from './RatingProvider';
import './ratingPanel.css';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const when = (iso: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const teamName = (team: Team | null) => (team === 'a' ? 'Drużyna A' : team === 'b' ? 'Drużyna B' : 'Bez drużyny');
const count = (value: string) => Math.max(0, Math.min(50, Math.trunc(Number(value) || 0)));

function Result({ state }: { state: MatchRatingState }) {
  const r = state.result;
  if (!r) return <p className="slm-rating-note">Okno oceniania jest zamknięte. Wynik głosowania pojawi się po przeliczeniu.</p>;
  const name = state.participants.find(p => p.user_id === r.mvp_user)?.display_name;
  return <div className="slm-rating-result">
    <p><strong>MVP meczu:</strong> {r.mvp_outcome === 'gold' ? (name ?? 'Zawodnik') : r.mvp_outcome === 'tie' ? 'remis — bez MVP Gold' : r.mvp_outcome === 'no_quorum' ? 'za mało głosów (potrzebna co najmniej połowa uczestników)' : 'nikt nie głosował'}</p>
    <p><strong>Akcja meczu:</strong> {r.action_team ? teamName(r.action_team) : 'bez rozstrzygnięcia'}</p>
  </div>;
}

/** Zakładka „Oceny” w szczegółach meczu: oceny 1–10, głos na MVP, akcja meczu, własne gole i asysty, wynik. */
export default function MatchRatingPanel({ manager, userId, eventId, active = true }: { manager: SessionManager; userId: string; eventId: string; active?: boolean }) {
  const api = useMatchRating(manager, eventId, active);
  const refreshRatings = useRatingsRefresh();
  const s = api.state;
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [mvp, setMvp] = useState<string | null>(null);
  const [action, setAction] = useState<Team | null>(null);
  const [goals, setGoals] = useState('0'), [assists, setAssists] = useState('0');
  const [scoreA, setScoreA] = useState(''), [scoreB, setScoreB] = useState('');
  const [confirm, setConfirm] = useState(false);
  const stamp = s ? JSON.stringify([s.event_id, s.my, s.score]) : '';
  useEffect(() => {
    if (!s) return;
    setRatings(s.my.ratings); setMvp(s.my.mvp_user); setAction(s.my.action_team);
    setGoals(String(s.my.goals)); setAssists(String(s.my.assists));
    setScoreA(s.score ? String(s.score.a) : ''); setScoreB(s.score ? String(s.score.b) : ''); setConfirm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset drafts only when the server copy changes
  }, [stamp]);
  useEffect(() => { if (s?.result) refreshRatings(); }, [s?.result, refreshRatings]);

  if (!s) return <section className="slm-panel slm-rating-panel"><h2>Oceny</h2>{api.error ? <><p role="alert">{api.error}</p><button type="button" onClick={() => void api.reload()}>Spróbuj ponownie</button></> : <p>Ładowanie ocen…</p>}</section>;
  const others = s.participants.filter(p => p.user_id !== userId);
  const warnings = scoreWarnings(s);
  const hasTeams = s.participants.some(p => p.team);
  const earlyMvp = s.phase === 'open' && s.gold_user ? s.participants.find(p => p.user_id === s.gold_user)?.display_name ?? 'Zawodnik' : null;
  const canBallot = s.phase === 'open' && s.can_rate && !s.my.submitted;
  return <section className="slm-panel slm-rating-panel" aria-busy={api.pending}>
    <h2>Oceny</h2>
    {s.phase === 'disabled' && <p className="slm-rating-note">Ten mecz nie podlega ocenianiu.</p>}
    {s.phase === 'before' && <p className="slm-rating-note">Ocenianie otworzy się po zakończeniu meczu i potrwa 48 godzin.</p>}
    {s.phase === 'open' && <p className="slm-rating-note">Ocenianie otwarte do: <strong>{when(s.closes_at)}</strong>. Oceny są anonimowe.</p>}
    {earlyMvp && <p className="slm-rating-result"><strong>MVP meczu:</strong> {earlyMvp} — wynik głosowania jest już przesądzony.</p>}
    {s.phase === 'closed' && <Result state={s} />}
    {api.error && <p role="alert" className="slm-rating-error">{api.error}</p>}
    {api.notice && <p role="status" className="slm-rating-ok">{api.notice}</p>}

    {(s.phase === 'open' || s.score) && <fieldset className="slm-rating-block" disabled={!s.can_rate || api.pending}>
      <legend>Wynik meczu</legend>
      <div className="slm-rating-score">
        <label>Drużyna A<input inputMode="numeric" aria-label="Gole drużyny A" value={scoreA} onChange={e => setScoreA(e.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
        <span aria-hidden="true">:</span>
        <label>Drużyna B<input inputMode="numeric" aria-label="Gole drużyny B" value={scoreB} onChange={e => setScoreB(e.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
        {s.can_rate && <button type="button" disabled={scoreA === '' || scoreB === ''} onClick={() => void api.saveScore(Number(scoreA), Number(scoreB))}>Zapisz wynik</button>}
      </div>
      {s.score && <p className="slm-rating-note">Ostatnia zmiana: {s.score.changed_by}, {when(s.score.changed_at)}</p>}
      {warnings.map(w => <p key={w} role="note" className="slm-rating-warning">⚠ {w}</p>)}
    </fieldset>}

    {s.phase === 'open' && !s.can_rate && <p className="slm-rating-note">Oceniać mogą tylko zawodnicy, którzy zagrali w tym meczu.</p>}
    {s.phase === 'open' && s.can_rate && <>
      <fieldset className="slm-rating-block" disabled={api.pending}>
        <legend>Twoje gole i asysty</legend>
        <div className="slm-rating-score">
          <label>Gole<input inputMode="numeric" value={goals} onChange={e => setGoals(e.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
          <label>Asysty<input inputMode="numeric" value={assists} onChange={e => setAssists(e.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
          <button type="button" onClick={() => void api.saveStats(count(goals), count(assists))}>Zapisz</button>
        </div>
      </fieldset>
    </>}
    {s.phase === 'open' && s.can_rate && s.my.submitted && <p className="slm-rating-ok">Twoje oceny i głosy są zapisane. Nie można ich już zmienić.</p>}
    {canBallot && <>
      <fieldset className="slm-rating-block" disabled={api.pending}>
        <legend>Oceń zawodników (1–10)</legend>
        {others.length === 0 && <p className="slm-rating-note">Brak innych zawodników do oceny.</p>}
        <ul className="slm-rating-list">{others.map(p => <li key={p.user_id}>
          <div className="slm-rating-who"><strong>{p.display_name}</strong><small>{teamName(p.team)}</small>
            <label className="slm-rating-mvp"><input type="radio" name={`mvp-${eventId}`} checked={mvp === p.user_id} onChange={() => setMvp(p.user_id)} /> MVP</label></div>
          <div className="slm-rating-scale" role="radiogroup" aria-label={`Ocena: ${p.display_name}`}>{SCORES.map(n => <button key={n} type="button" role="radio" aria-checked={ratings[p.user_id] === n} onClick={() => setRatings(r => r[p.user_id] === n ? Object.fromEntries(Object.entries(r).filter(([id]) => id !== p.user_id)) : { ...r, [p.user_id]: n })}>{n}</button>)}</div>
        </li>)}</ul>
        {mvp && <button type="button" className="slm-rating-link" onClick={() => setMvp(null)}>Usuń głos na MVP</button>}
      </fieldset>
      {hasTeams && <fieldset className="slm-rating-block" disabled={api.pending}>
        <legend>Akcja meczu — która drużyna?</legend>
        <div className="slm-rating-teams" role="radiogroup" aria-label="Akcja meczu">{(['a', 'b'] as const).map(t => <button key={t} type="button" role="radio" aria-checked={action === t} onClick={() => setAction(action === t ? null : t)}>{teamName(t)}</button>)}</div>
      </fieldset>}
      {!confirm ? <button type="button" className="slm-rating-submit" disabled={api.pending} onClick={() => setConfirm(true)}>Zapisz oceny</button>
        : <div role="alertdialog" aria-label="Potwierdzenie ocen" className="slm-rating-confirm">
          <p>Po zapisaniu nie zmienisz już ocen ani głosów w tym meczu. Zapisać?</p>
          <button type="button" onClick={() => setConfirm(false)}>Wróć</button>
          <button type="button" className="slm-rating-submit" disabled={api.pending} onClick={() => void api.rate({ ratings, mvp_user: mvp, action_team: action })}>Tak, zapisz</button>
        </div>}
    </>}
  </section>;
}

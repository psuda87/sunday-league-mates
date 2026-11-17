import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {SessionManager} from '../auth/sessionManager';
import {member} from '../groups/contracts';
import type {GroupMember} from '../groups/model';
import UltimatePlayerCard from '../ui/UltimatePlayerCard';
import {usePlayerRating} from '../rating/RatingProvider';
import BadgeList from '../badges/BadgeList';
import {usePlayerBadges} from '../badges/BadgesProvider';
import {useFrozenBack} from '../native/frozenDemoAndroid';

export interface LineupProfileContext {manager: SessionManager; userId: string; groupId: string}

// Same group-profile API/card as PremiumGroups. No roster name as a privacy fallback.
export default function LineupPlayerProfile({context, memberId, onBack, backLabel = 'Wróć do składów'}: {context: LineupProfileContext; memberId: string; onBack: () => void; backLabel?: string}) {
  const {manager, userId, groupId} = context;
  const auth = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const ready = auth.phase === 'ready' && auth.session?.user_id === userId;
  const [state, setState] = useState<{value: GroupMember | null; error: boolean}>({value: null, error: false});
  const [revision, setRevision] = useState(0);
  const area = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {if (ready && state.value) heading.current?.focus({preventScroll: true});}, [ready, state.value]);
  useFrozenBack(() => {onBack(); return true;}, () => area.current, 35);
  useEffect(() => {
    let active = true;
    setState({value: null, error: false});
    if (ready) void manager.call('groups_profile', {group_id: groupId, user_id: memberId}).then(value => {
      const p = member(value);
      if (p.user_id !== memberId) throw Error('Unexpected profile identity');
      if (active) setState({value: p, error: false});
    }).catch(() => {if (active) setState({value: null, error: true});});
    return () => {active = false;};
  }, [manager, userId, groupId, memberId, ready, revision]);
  const p = ready ? state.value : null;
  const stats = usePlayerRating(p ? memberId : undefined)?.stats;
  const badges = usePlayerBadges(p ? memberId : undefined);
  return <section ref={area} className="slm-players-screen slm-ultimate-profile" aria-label="Profil zawodnika ze składów">
    <div className="slm-team-actions"><button type="button" onClick={onBack}>{backLabel}</button></div>
    {!ready ? <p role="status">Profil wymaga potwierdzonej sesji.</p> : state.error ? <>
      <p role="alert">Nie udało się potwierdzić dostępu do profilu w tej grupie.</p>
      <button type="button" onClick={() => setRevision(n => n + 1)}>Spróbuj ponownie</button>
    </> : !p ? <p role="status">Wczytywanie profilu…</p> : <>
      <p className="slm-players-demo">Profil grupowy · tylko dane udostępnione przez serwer</p>
      <UltimatePlayerCard playerId={memberId} headingRef={heading} name={typeof p.display_name === 'string' && p.display_name.trim() ? p.display_name : p.nickname} jerseyNumber={p.jersey_number ?? undefined}/>
      <section className="slm-player-stats slm-ultimate-summary" aria-label={stats ? 'Statystyki zawodnika' : 'Statystyki niedostępne'}><dl className="slm-ultimate-stats">{([['Mecze', stats?.played], ['Gole', stats?.goals], ['Asysty', stats?.assists], ['MVP', stats?.mvp]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl></section>
      {!stats && <p className="slm-muted">Statystyki zawodnika są niedostępne.</p>}
      {badges && <BadgeList states={badges} own={memberId === userId}/>}
    </>}
  </section>;
}

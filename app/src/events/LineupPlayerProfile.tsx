import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {SessionManager} from '../auth/sessionManager';
import {member} from '../groups/contracts';
import type {GroupMember} from '../groups/model';
import UltimatePlayerCard from '../ui/UltimatePlayerCard';
import {useFrozenBack} from '../native/frozenDemoAndroid';

export interface LineupProfileContext {manager: SessionManager; userId: string; groupId: string}

// Same group-profile API/card as PremiumGroups. No roster name as a privacy fallback.
export default function LineupPlayerProfile({context, memberId, onBack}: {context: LineupProfileContext; memberId: string; onBack: () => void}) {
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
  return <section ref={area} className="slm-players-screen slm-ultimate-profile" aria-label="Profil zawodnika ze składów">
    <div className="slm-team-actions"><button type="button" onClick={onBack}>Wróć do składów</button></div>
    {!ready ? <p role="status">Profil wymaga potwierdzonej sesji.</p> : state.error ? <>
      <p role="alert">Nie udało się potwierdzić dostępu do profilu w tej grupie.</p>
      <button type="button" onClick={() => setRevision(n => n + 1)}>Spróbuj ponownie</button>
    </> : !p ? <p role="status">Wczytywanie profilu…</p> : <>
      <p className="slm-players-demo">Profil grupowy · tylko dane udostępnione przez serwer</p>
      <UltimatePlayerCard headingRef={heading} name={typeof p.display_name === 'string' && p.display_name.trim() ? p.display_name : p.nickname} jerseyNumber={p.jersey_number ?? undefined}/>
      <p className="slm-muted">Statystyki i zdjęcia innych zawodników nie są jeszcze dostępne.</p>
    </>}
  </section>;
}

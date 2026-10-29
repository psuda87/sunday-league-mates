import {useEffect, useId, useRef, useState} from 'react';
import PremiumPitch from '../ui/PremiumPitch';
import type {MatchEntry} from './premiumContracts';
import type {LineupAction} from './lineupEditor';
import LineupPlayerProfile from './LineupPlayerProfile';
import type {LineupProfileContext} from './LineupPlayerProfile';
import {usePremiumLineup} from './usePremiumLineup';

// Stage 1 pitch/editor; Stage 2A snapshots and explicit, versioned server writes.
export default function PremiumTeams({eventId, participants, cancelled, canEdit = false, profileContext}: {
  eventId: string; participants: MatchEntry[]; cancelled: boolean; canEdit?: boolean; profileContext?: LineupProfileContext;
}) {
  const alive = useRef(true), opening = useRef(0);
  useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  const saveLimit = useId();
  const current = useRef({eventId, canEdit, cancelled, profileContext}); current.current = {eventId, canEdit, cancelled, profileContext};
  const [active, setActive] = useState(true), [confirmRefresh, setConfirmRefresh] = useState(false);
  const [notice, setNotice] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null), lastTrigger = useRef<HTMLButtonElement | null>(null), scrollTop = useRef(0);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const panel = section.current?.closest('[role="tabpanel"]');
    if (!panel) return;
    const update = () => setActive(!panel.hasAttribute('hidden')); update();
    const observer = new MutationObserver(update); observer.observe(panel, {attributes: true, attributeFilter: ['hidden']});
    return () => observer.disconnect();
  }, []);
  const remote = usePremiumLineup(eventId, profileContext, canEdit, active, participants.filter(p => p.status === 'registered').map(p => p.id).sort().join('|'));
  const {editor: state, snapshot} = remote.state;
  const eligible = remote.verified ? remote.state.detail?.participants.filter(p => p.status === 'registered') ?? [] : [];
  useEffect(() => {setProfileId(null); setNotice('');}, [eventId]);
  useEffect(() => {if (!canEdit || cancelled || !remote.verified) {opening.current++; setProfileId(null);}}, [canEdit, cancelled, remote.verified]);
  const teams = {a: eligible.filter(p => state.draft[p.id] === 'a'), b: eligible.filter(p => state.draft[p.id] === 'b')};
  const selectedEntry = eligible.find(p => p.id === state.selected), selectedSide = selectedEntry && state.draft[selectedEntry.id];
  const unassigned = eligible.filter(p => !state.draft[p.id]);
  const dirty = remote.dirty;
  const writable = remote.writable && !cancelled;
  function change(action: LineupAction) {if (writable) remote.edit(action);}
  function refresh() {
    if (dirty || remote.state.intent) setConfirmRefresh(true);
    else void remote.reload();
  }
  function closeProfile() {
    opening.current++;
    setProfileId(null);
    requestAnimationFrame(() => {
      lastTrigger.current?.focus({preventScroll: true});
      void area.current?.closest('ion-content')?.scrollToPoint?.(0, scrollTop.current, 0);
    });
  }
  async function openProfile(p: MatchEntry, trigger: HTMLButtonElement) {
    if (!p.member_id || !canEdit || !profileContext) return;
    const ticket = ++opening.current;
    lastTrigger.current = trigger;
    const content = area.current?.closest('ion-content');
    if (content?.getScrollElement) scrollTop.current = (await content.getScrollElement()).scrollTop;
    const latest = current.current;
    if (alive.current && ticket === opening.current && latest.eventId === eventId && latest.canEdit && !latest.cancelled && latest.profileContext?.groupId === profileContext.groupId && latest.profileContext?.userId === profileContext.userId) setProfileId(p.member_id);
  }
  function choose(p: MatchEntry, trigger: HTMLButtonElement) {
    if (!state.mode) {void openProfile(p, trigger); return;}
    const swapped = state.mode === 'swap' && state.selected !== p.id && selectedSide && selectedSide !== state.draft[p.id];
    change({type: 'choose', id: p.id});
    if (swapped) {setNotice('Zamieniono wyłącznie w lokalnym podglądzie.'); return;}
    setNotice(state.mode === 'swap' ? 'Wybierz po jednej osobie z obu drużyn. Ponowne kliknięcie usuwa zaznaczenie.' : 'Potwierdź przeniesienie zaznaczonej osoby przyciskiem nad boiskiem.');
  }
  const visibleProfile = remote.verified && canEdit && !cancelled && profileContext && profileId && eligible.some(p => p.member_id === profileId);
  return <section ref={section} className="slm-demo-teams slm-live-teams" aria-label="Składy meczu" data-event-id={eventId} aria-busy={!!remote.state.pending}>
    <div ref={area} hidden={!!visibleProfile} data-lineup-dirty={dirty}>
      {remote.error && <p className="slm-error" role="alert">{remote.error}</p>}
      {remote.state.pending && <p role="status">{remote.state.pending === 'save' ? 'Potwierdzanie zapisu…' : 'Wczytywanie składu…'}</p>}
      {!remote.ready && <p role="status">Skład wymaga potwierdzonej sesji i aktywnego członkostwa w grupie.</p>}
      <div className="slm-team-actions"><button type="button" disabled={!remote.ready || !!remote.state.pending} onClick={refresh}>Odśwież skład</button></div>
      {confirmRefresh && <div role="alertdialog" aria-labelledby={saveLimit + '-confirm'}>
        <p id={saveLimit + '-confirm'}>Odświeżenie zastąpi lokalny szkic aktualnym składem z serwera. Niezapisane zmiany zostaną utracone. Po niepewnym zapisie serwer mógł już przyjąć żądanie.</p>
        <button type="button" onClick={() => setConfirmRefresh(false)}>Zachowaj szkic</button>
        <button type="button" disabled={!!remote.state.pending} onClick={() => {setConfirmRefresh(false); void remote.reload();}}>Pobierz aktualny skład</button>
      </div>}
      {remote.verified && <>
        <p className="slm-teams-disclaimer">{snapshot?.version === 0 ? 'Propozycja składu · niezapisana' : 'Zapisany skład · lokalna edycja'}</p>
        {(cancelled || remote.closed) && <p role="status">{cancelled || remote.state.detail?.event.status === 'cancelled' ? 'Mecz anulowany' : 'Mecz zakończony'} · zapis składu jest zamknięty.</p>}
        {!eligible.length && <div className="slm-teams-empty"><h3>Boisko czeka na drużyny</h3><p>Brak aktualnie zapisanych uczestników.</p></div>}
        <div className="slm-team-score"><span><i aria-hidden="true"/>Drużyna A <strong>{teams.a.length}</strong></span><span><i aria-hidden="true"/>Drużyna B <strong>{teams.b.length}</strong></span></div>
        <div className="slm-team-actions">
          <button type="button" disabled={!writable || !teams.a.length || !teams.b.length} aria-pressed={state.mode === 'swap'} onClick={() => {change({type: 'mode', mode: state.mode === 'swap' ? null : 'swap'}); setNotice('');}}>{state.mode === 'swap' ? 'Zakończ zamiany' : 'Zamień zawodników'}</button>
          <button type="button" disabled={!writable || !state.initialized} aria-pressed={state.mode === 'transfer'} onClick={() => {change({type: 'mode', mode: state.mode === 'transfer' ? null : 'transfer'}); setNotice('');}}>{state.mode === 'transfer' ? 'Zakończ przenoszenie' : 'Przenieś zawodnika'}</button>
          <button type="button" disabled={!writable || !(dirty || state.selected || state.mode)} onClick={() => {change({type: 'restore'}); setNotice('Przywrócono skład z początku tej lokalnej edycji. Niczego nie zapisano.');}}>Przywróć skład</button>
          <button type="button" disabled={!writable || !dirty} aria-describedby={saveLimit} onClick={() => {void remote.save();}}>Zapisz</button>
          {remote.state.intent && <button type="button" disabled={!!remote.state.pending} onClick={() => {void remote.save();}}>{remote.state.intent.accepted ? 'Ponów odczyt po zapisie' : 'Ponów zapis'}</button>}
          {state.mode === 'transfer' && <button type="button" disabled={!writable || !selectedSide} onClick={() => {change({type: 'transfer'}); setNotice('Przeniesiono osobę wyłącznie w lokalnym podglądzie.');}}>Przenieś do drużyny {selectedSide === 'a' ? 'B' : selectedSide === 'b' ? 'A' : 'A lub B'}</button>}
        </div>
        <p className="slm-teams-hint" role="status"><span>{dirty ? 'Niezapisane zmiany lokalne.' : 'Brak niezapisanych zmian.'}</span>{' '}<span>{remote.state.notice || notice || (state.mode === 'swap' ? 'Wybierz po jednej osobie z obu drużyn.' : state.mode === 'transfer' ? 'Wybierz osobę, a następnie drużynę docelową.' : 'Dotknij zawodnika, aby otworzyć profil grupowy. Goście bez konta nie mają profilu.')}</span></p>
        {unassigned.length > 0 && <div className="slm-team-unassigned"><h3>Poza podziałem: {unassigned.length}</h3><ul>{unassigned.map(p => <li key={p.id}>{p.display_name}{!p.member_id ? ' · gość' : ''}{(['a', 'b'] as const).map(side => <button type="button" disabled={!writable} key={side} aria-label={'Dodaj ' + p.display_name + ' do drużyny ' + side.toUpperCase()} onClick={() => change({type: 'assign', id: p.id, side})}>{side.toUpperCase()}</button>)}</li>)}</ul></div>}
        <PremiumPitch a={teams.a} b={teams.b} renderPlayer={p => {
          const interactive = state.mode ? writable : !!p.member_id && canEdit && !!profileContext;
          const content = <><span className="slm-pitch-token" aria-hidden="true">{p.member_id ? '—' : 'G'}</span><span className="slm-pitch-name">{p.display_name}</span></>;
          return <li key={p.id} data-entry={p.id}>{interactive ? <button type="button" className="slm-pitch-player" aria-label={(state.mode === 'swap' ? 'Wybierz do zamiany: ' : state.mode === 'transfer' ? 'Wybierz do przeniesienia: ' : 'Otwórz profil: ') + p.display_name} aria-pressed={state.mode ? state.selected === p.id : undefined} onClick={e => choose(p, e.currentTarget)}>{content}</button> : <span className="slm-pitch-player slm-pitch-guest" title={p.member_id ? 'Profil grupowy niedostępny w tym kontekście' : 'Gość bez profilu'}>{content}</span>}</li>;
        }}/>
        <p className="slm-teams-hint">{remote.state.lastChange ? `Ostatnia zmiana: ${remote.state.lastChange.display_name}` : 'Brak zapisanych zmian'}</p>
        <p id={saveLimit} className="slm-teams-hint">Zmiany trafiają do wspólnego składu dopiero po potwierdzeniu zapisu przez serwer.</p>
      </>}
    </div>
    {visibleProfile && <LineupPlayerProfile key={`${profileContext.groupId}:${profileContext.userId}:${profileId}`} context={profileContext} memberId={profileId} onBack={closeProfile}/>}
  </section>;
}

import MatchHeader from '../ui/MatchHeader';
import type { ReactNode } from 'react';
import ParticipantGroup, { RosterSummary } from '../ui/ParticipantGroup';
import { IonIcon } from '@ionic/react';
import { checkmarkCircleOutline, timeOutline, alertCircleOutline } from 'ionicons/icons';
import MatchSections from '../ui/MatchSections';
import MatchHero from '../ui/MatchHero';
import MatchFilters from '../ui/MatchFilters';
import type { MatchFilter } from '../ui/MatchFilters';
import PhoneInput from '../components/PhoneInput';
import { normalizePhoneUpdate, nationalPhone } from '../../supabase/functions/_shared/phone';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IonButton, IonInput, IonSelect, IonSelectOption, IonSpinner } from '@ionic/react';
import type { SessionManager } from '../auth/sessionManager';
import type { ManagedAccount, Session } from '../auth/api';
import { emptyMatchForm, matchDate, money, nextMatchDay, warsawFields } from '../events/model';
import type { Detail, Match, MatchForm, Participant } from '../events/model';
import './Events.css';
import MatchSettlement from './MatchSettlement';

export default function Events({ manager, session, initialEventId, headerAction }: { manager: SessionManager; session: Session; initialEventId?: string | null; headerAction?: ReactNode }) {
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [filter, setFilter] = useState<MatchFilter>('upcoming');
  const [matches, setMatches] = useState<Match[]>([]);
  const [preview, setPreview] = useState<Detail | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<MatchForm | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [serverNow, setServerNow] = useState('');
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestList, setGuestList] = useState('registered');
  const [guestEdit, setGuestEdit] = useState<string | null>(null);
  const [guestRequestId, setGuestRequestId] = useState(() => crypto.randomUUID());
  const [people, setPeople] = useState<ManagedAccount[]>([]);
  const [peopleOffset, setPeopleOffset] = useState(0);
  const [selectedMember, setSelectedMember] = useState('');
  const [responsible, setResponsible] = useState(session.user_id);
  const [offset, setOffset] = useState(0);
  const [finance, setFinance] = useState<{ blocked: boolean; unpaid_matches: number } | null>(null);
  const admin = session.role === 'admin';
  const findNext = useCallback(async (initialRows: Match[], now: string): Promise<Match | null> => {
    let rows = initialRows;
    let page = 0;
    let candidate: Match | null = null;
    for (;;) {
      for (const match of rows) if (match.status === 'scheduled' && Date.parse(match.starts_at) > Date.parse(now) && (!candidate || Date.parse(match.starts_at) < Date.parse(candidate.starts_at))) candidate = match;
      // Existing RPC pages newest first; stop once the page reaches the past.
      if (rows.length < 50 || rows.some(m => Date.parse(m.starts_at) <= Date.parse(now))) return candidate;
      page += 50;
      rows = (await manager.call<{ events: Match[] }>('events_list', { offset: page })).events;
    }
  }, [manager]);
  async function list(page = offset) {
    const result = await manager.call<{ events: Match[]; server_now: string }>('events_list', { offset: page });
    setMatches(result.events); setServerNow(result.server_now); setOffset(page);
    if (page === 0) setNextMatch(await findNext(result.events, result.server_now));
  }
  async function open(id: string) {
    const result = await manager.call<Detail>('events_detail', { event_id: id });
    setDetail(result); setServerNow(result.server_now); setForm(null); setGuestEdit(null);
  }
  async function work(task: () => Promise<void>) {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true); setError(''); setNotice('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'Nie udało się wykonać operacji.'); }
    finally { actionPending.current = false; setBusy(false); }
  }
  useEffect(() => {
    let alive = true;
    manager.call<{ events: Match[]; server_now: string }>('events_list', { offset: 0 })
      .then(async r => { if (alive) { setMatches(r.events); setServerNow(r.server_now); } const next = await findNext(r.events, r.server_now); if (alive) setNextMatch(next); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Nie udało się pobrać meczów.'); });
    return () => { alive = false; };
  }, [manager, findNext]);
  useEffect(() => {
    let alive = true;
    manager.call<{ blocked: boolean; unpaid_matches: number }>('settlements_account')
      .then(r => { if (alive) setFinance(r); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Nie udało się sprawdzić zaległości.'); });
    return () => { alive = false; };
  }, [manager, detail]);
  useEffect(() => {
    if (!initialEventId) return;
    let alive = true;
    manager.call<Detail>('events_detail',{ event_id: initialEventId }).then(r => {
      if (alive) { setDetail(r); setServerNow(r.server_now); setForm(null); }
    }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Nie udało się otworzyć meczu.'); });
    return () => { alive = false; };
  },[manager,initialEventId]);
  async function operation(action: string, values: Record<string, unknown> = {}) {
    if (!detail) return;
    await manager.call('events_' + action, { event_id: detail.event.id, ...values });
    await open(detail.event.id); setNotice('Zmiana zapisana.');
  }
  async function loadPeople(page = 0) {
    const rows = await manager.call<ManagedAccount[]>('list_accounts', { offset: page });
    setPeople(rows); setPeopleOffset(page);
  }
  function beginForm(match?: Match) {
    setEditId(match?.id ?? null);
    setForm(match ? { ...warsawFields(match.starts_at), location: match.location, duration_minutes: String(match.duration_minutes),
      hourly_rate: String(match.hourly_rate), total_cost: String(match.total_cost), capacity: String(match.capacity) } : emptyMatchForm());
  }
  function update(key: keyof MatchForm, value: string) {
    setForm(previous => {
      if (!previous) return previous;
      const next = { ...previous, [key]: value };
      if (key === 'duration_minutes' || key === 'hourly_rate')
        next.total_cost = (Number(next.duration_minutes) * Number(next.hourly_rate) / 60).toFixed(2);
      return next;
    });
  }
  const upcoming = nextMatch;
  const filteredMatches = matches.filter(match => {
    if (!serverNow) return false;
    const historical = Date.parse(match.starts_at) <= Date.parse(serverNow) || match.status === 'cancelled';
    return filter === 'history' ? historical : !historical;
  }).sort((a, b) => filter === 'history' ? Date.parse(b.starts_at) - Date.parse(a.starts_at) : Date.parse(a.starts_at) - Date.parse(b.starts_at));
  useEffect(() => {
    let alive = true;
    setPreview(null);
    if (upcoming?.id) manager.call<Detail>('events_detail', { event_id: upcoming.id }).then(result => { if (alive) setPreview(result); }).catch(error => { if (alive) setError(error instanceof Error ? error.message : 'Nie udało się pobrać stanu zapisu.'); });
    return () => { alive = false; };
  }, [manager, upcoming]);
  const e = detail?.event;
  const mine = detail?.participants.find(p => p.member_id === session.user_id);
  function matchAction(current: Detail | null) {
    const event = current?.event;
    const own = current?.participants.find(p => p.member_id === session.user_id);
    const closed = !event?.registration_open || event.status === 'cancelled';
    const full = !!event && event.registered_count >= event.capacity;
    const withdrawing = own?.status === 'registered';
    const waiting = own?.status === 'reserve' && full;
    const label = !event ? 'Sprawdzanie zapisu…' : event.status === 'cancelled' ? 'Mecz odwołany' : closed ? 'Zapisy zamknięte' : withdrawing ? 'Zrezygnuj z meczu' : finance === null ? 'Sprawdzanie możliwości zapisu…' : finance.blocked ? 'Blokada z powodu zaległości' : waiting ? 'Jesteś na rezerwie' : full ? 'Dołącz do rezerwy' : 'ZAPISZ SIĘ NA MECZ';
    return <IonButton aria-busy={busy} className="slm-match-cta" expand="block" disabled={busy || closed || (!withdrawing && (finance === null || finance.blocked || waiting))} onClick={() => void work(async () => {
      if (!event) return;
      await manager.call('events_' + (withdrawing ? 'withdraw' : full ? 'reserve' : 'join'), { event_id: event.id, ...(withdrawing ? { participant_id: own.id } : {}) });
      await open(event.id); await list(); setNotice('Zmiana zapisana.');
    })}>{busy ? 'Trwa operacja…' : label}</IonButton>;
  }
  function participant(p: Participant) {
    const manage = admin || p.responsible_user_id === session.user_id;
    return <li key={p.id} className="slm-participant">
      <span className="slm-avatar" aria-hidden="true">{p.display_name.slice(0, 2).toUpperCase()}</span>
      <div><div className="slm-participant-heading"><strong>{p.display_name}</strong><span className="slm-participant-status"><IonIcon icon={p.status === 'reserve' ? timeOutline : p.absent ? alertCircleOutline : checkmarkCircleOutline} aria-hidden="true" />{p.status === 'reserve' ? 'Na rezerwie' : p.absent ? 'Nieobecny' : 'Zapisany'}</span></div>
        <p>{p.member_id ? 'Zawodnik' : `Gość · odpowiedzialny: ${p.responsible_name}`}
          {p.status === 'registered' && (p.absent ? ' · ⚠ Nieobecny' : ' · Obecny')}</p>
        {p.contact_phone && <a className="slm-call" href={`tel:${p.contact_phone}`}>Zadzwoń{!p.member_id && !p.guest_phone ? ' do zapraszającego' : ''}</a>}
        {manage && e?.registration_open && <div className="slm-actions">
          <IonButton size="small" fill="outline" disabled={busy} onClick={() => void work(() => operation('withdraw', { participant_id: p.id }))}>Zrezygnuj{p.member_id ? '' : ' z gościa'}</IonButton>
          <IonButton size="small" fill="outline" disabled={busy} onClick={() => void work(() => operation(p.member_id ? (p.status === 'reserve' ? 'join' : 'reserve') : 'move_guest',
            p.member_id ? { user_id: p.member_id } : { participant_id: p.id, list: p.status === 'reserve' ? 'registered' : 'reserve' }))}>
            {p.status === 'reserve' ? 'Zapisz na mecz' : 'Przenieś na rezerwę'}</IonButton>
          {!p.member_id && <IonButton size="small" fill="outline" disabled={busy} onClick={() => { setGuestEdit(p.id); setGuestName(p.guest_name ?? ''); setGuestPhone(nationalPhone(p.guest_phone ?? '')); }}>Edytuj gościa</IonButton>}
        </div>}
      </div>
    </li>;
  }
  return <section aria-label="Wydarzenia" aria-busy={busy}>
    <MatchHeader action={headerAction} busy={busy} onBack={detail ? () => void work(async () => { setDetail(null); setForm(null); await list(0); }) : undefined} />
    {error && <p role="alert" className="slm-error">⚠ {error}</p>}
    {notice && <p role="status" className="slm-notice">✓ {notice}</p>}
    {busy && <IonSpinner aria-label="Trwa operacja wydarzenia" />}
    <div className={`slm-actions${detail ? ' slm-detail-back' : ''}`}>
      {!detail && <IonButton fill="outline" disabled={busy} onClick={() => void work(async () => { setDetail(null); setForm(null); await list(0); })}>Lista meczów</IonButton>}
      {admin && <IonButton disabled={busy} onClick={() => beginForm()}>Utwórz mecz</IonButton>}
      <IonButton fill="clear" disabled={busy} onClick={() => void work(() => e ? open(e.id) : list())}>Odśwież</IonButton>
    </div>
    {form ? <section className="slm-panel"><h1>{editId ? 'Edytuj mecz' : 'Nowy mecz'}</h1>
      <p className="slm-muted">Termin w Europe/Warsaw. Godzinę i limit miejsc podaje administrator.</p>
      <div className="slm-actions">{([4, 0] as const).map(day => <IonButton key={day} fill="outline" disabled={!serverNow}
        onClick={() => update('date', nextMatchDay(serverNow, day))}>{day === 4 ? 'Najbliższy czwartek' : 'Najbliższa niedziela'}</IonButton>)}</div>
      <form className="slm-form" onSubmit={event => { event.preventDefault(); void work(async () => {
        const result = await manager.call<{ event_id: string }>(editId ? 'events_edit' : 'events_create', { ...form, event_id: editId,
          duration_minutes: Number(form.duration_minutes), hourly_rate: Number(form.hourly_rate), total_cost: Number(form.total_cost), capacity: Number(form.capacity) });
        await open(result.event_id); setNotice('Mecz zapisany. Powiadomienia obsługuje centrum; systemowy push wymaga konfiguracji.');
      }); }}>
        <label>Data<input type="date" required value={form.date} onChange={ev => update('date', ev.target.value)} /></label>
        <label>Godzina<input type="time" required value={form.time} onChange={ev => update('time', ev.target.value)} /></label>
        <IonInput label="Miejsce" labelPlacement="stacked" required maxlength={200} value={form.location} onIonInput={ev => update('location', ev.detail.value ?? '')} />
        <IonInput label="Czas gry (minuty)" labelPlacement="stacked" type="number" required min={1} step="1" value={form.duration_minutes} onIonInput={ev => update('duration_minutes', ev.detail.value ?? '')} />
        <IonInput label="Stawka godzinowa (zł)" labelPlacement="stacked" type="number" required min={0} step="0.01" value={form.hourly_rate} onIonInput={ev => update('hourly_rate', ev.detail.value ?? '')} />
        <IonInput label="Koszt całkowity (zł)" labelPlacement="stacked" type="number" required min={0} step="0.01" value={form.total_cost} onIonInput={ev => update('total_cost', ev.detail.value ?? '')} />
        <IonInput label="Maksymalna liczba miejsc" labelPlacement="stacked" type="number" required min={10} step="1" value={form.capacity} onIonInput={ev => update('capacity', ev.detail.value ?? '')} />
        <p className="slm-muted">Minimum do gry: 10 osób. Koszt wyliczamy z czasu i stawki; możesz poprawić koszt całkowity.</p>
        <IonButton type="submit" disabled={busy}>Zapisz mecz</IonButton>
      </form></section> : detail && e ? <>
      <MatchHero match={e} title="Szczegóły meczu">{matchAction(detail)}</MatchHero>
      <MatchSections key={e.id} information={<>
      <section className="slm-panel slm-match-info"><h3>{matchDate(e.starts_at)}</h3><p>{e.location} · {e.duration_minutes} minut</p>
        <p>{money(e.hourly_rate)}/h · razem {money(e.total_cost)}</p>
        <p>Uczestnicy: {e.registered_count}/{e.capacity} · minimum 10 · rezerwa: {e.reserve_count}</p>
        <p className="slm-muted">Podział należności uwzględnia decyzje o opłacie i zastępstwa. Administrator widzi go w rozliczeniu meczu; zatwierdzone należności są w zakładce Rozliczenia.</p>
        {finance && <p role="status" className={finance.blocked ? 'slm-error' : ''}>{finance.blocked
          ? `🔒 Dwa nieuregulowane mecze blokują nowe zapisy i dodawanie gości (${finance.unpaid_matches}). Przejdź do Rozliczeń.`
          : `Nieuregulowane mecze: ${finance.unpaid_matches} · brak blokady zapisów.`}</p>}
        {e.status === 'cancelled' ? <p role="status">⛔ Mecz odwołany</p> : !e.registration_open && <p role="status">🔒 Zapisy zamknięte — mecz już się rozpoczął.</p>}
        {e.decision_required && <p role="status" className="slm-error">⚠ Po 17:00 jest mniej niż 10 osób. Wymagana decyzja administratora; mecz nie został automatycznie odwołany.</p>}
        {e.registration_open && <div className="slm-actions">
          {mine?.status !== 'registered' && <IonButton disabled={busy || finance?.blocked} onClick={() => void work(() => operation('join'))}>Zapisz się</IonButton>}
          {!mine && <IonButton fill="outline" disabled={busy || finance?.blocked} onClick={() => void work(() => operation('reserve'))}>Dołącz do rezerwy</IonButton>}
        </div>}
        {admin && e.status === 'scheduled' && <div className="slm-actions">
          {e.registration_open && <IonButton fill="outline" disabled={busy} onClick={() => beginForm(e)}>Edytuj mecz</IonButton>}
          <IonButton fill="outline" disabled={busy} onClick={() => {
            if (!window.confirm('Odwołać mecz? Zapisy zostaną zamknięte, a zatwierdzone należności wycofane korektą.')) return;
            const reason = window.prompt('Powód odwołania (1–500 znaków):');
            if (!reason?.trim() || reason.trim().length > 500) return;
            void work(() => operation('cancel', { reason: reason.trim() }));
          }}>Odwołaj mecz</IonButton>
        </div>}
      </section>
      </>} participants={<>
      <RosterSummary occupied={e.registered_count} capacity={e.capacity} reserve={e.reserve_count} />
      <ParticipantGroup title="Zapisani" emptyText="Brak zapisanych zawodników." previewLimit={5}>{detail.participants.filter(p => p.status === 'registered' && p.member_id).map(participant)}</ParticipantGroup>
      <ParticipantGroup title="Goście" emptyText="Brak gości.">{detail.participants.filter(p => p.status === 'registered' && !p.member_id).map(participant)}</ParticipantGroup>
      <ParticipantGroup title="Rezerwa" emptyText="Rezerwa jest pusta." description="Nie zajmuje miejsc. Bez automatycznego awansu — miejsce daje dopiero skuteczny zapis.">{detail.participants.filter(p => p.status === 'reserve').map(participant)}</ParticipantGroup>
      {admin && e.registration_open && <section className="slm-panel"><h2>Zarządzaj uczestnikami</h2>
        <IonButton fill="outline" disabled={busy} onClick={() => void work(() => loadPeople())}>Wczytaj zawodników</IonButton>
        <IonSelect label="Zawodnik" labelPlacement="stacked" value={selectedMember} onIonChange={ev => setSelectedMember(ev.detail.value)}>
          {people.map(p => <IonSelectOption value={p.user_id} key={p.user_id}>{p.display_name}</IonSelectOption>)}
        </IonSelect><div className="slm-actions">
          <IonButton disabled={busy || !selectedMember} onClick={() => void work(() => operation('join', { user_id: selectedMember }))}>Dodaj zawodnika</IonButton>
          <IonButton fill="outline" disabled={busy || !selectedMember} onClick={() => void work(() => operation('reserve', { user_id: selectedMember }))}>Dodaj na rezerwę</IonButton>
          <IonButton fill="clear" disabled={busy || !peopleOffset} onClick={() => void work(() => loadPeople(Math.max(0, peopleOffset - 50)))}>Poprzedni zawodnicy</IonButton>
          <IonButton fill="clear" disabled={busy || people.length < 50} onClick={() => void work(() => loadPeople(peopleOffset + 50))}>Następni zawodnicy</IonButton>
        </div></section>}
      {e.registration_open && <section className="slm-panel"><h2>{guestEdit ? 'Edytuj gościa' : 'Dodaj gościa'}</h2>
        <form className="slm-form" onSubmit={event => { event.preventDefault(); void work(async () => {
          await operation(guestEdit ? 'edit_guest' : 'guest', { participant_id: guestEdit, request_id: guestRequestId,
            guest_name: guestName, guest_phone: guestPhone.trim() ? normalizePhoneUpdate(guestPhone, detail.participants.find(p => p.id === guestEdit)?.guest_phone ?? undefined) : '', list: guestList, user_id: responsible });
          setGuestName(''); setGuestPhone(''); setGuestEdit(null);
          setGuestRequestId(crypto.randomUUID());
        }); }}>
          <IonInput label="Imię/pseudonim gościa" labelPlacement="stacked" required maxlength={100} value={guestName} onIonInput={ev => setGuestName(ev.detail.value ?? '')} />
          <PhoneInput label="Telefon gościa (opcjonalnie)" required={false} value={guestPhone} onChange={setGuestPhone} />
          {!guestEdit && <IonSelect label="Lista gościa" labelPlacement="stacked" value={guestList} onIonChange={ev => setGuestList(ev.detail.value)}>
            <IonSelectOption value="registered">Uczestnicy</IonSelectOption><IonSelectOption value="reserve">Rezerwa</IonSelectOption></IonSelect>}
          {admin && !guestEdit && <IonSelect label="Konto odpowiedzialne" labelPlacement="stacked" value={responsible} onIonChange={ev => setResponsible(ev.detail.value)}>
            <IonSelectOption value={session.user_id}>Moje konto</IonSelectOption>{people.filter(p => p.user_id !== session.user_id).map(p => <IonSelectOption key={p.user_id} value={p.user_id}>{p.display_name}</IonSelectOption>)}
          </IonSelect>}
          <p className="slm-muted">Gość zajmuje osobne miejsce i udział w kosztach. Za jego opłatę odpowiada zapraszający. Bez telefonu kontakt prowadzi do zapraszającego.</p>
          <IonButton type="submit" disabled={busy || (!guestEdit && responsible === session.user_id && finance?.blocked)}>{guestEdit ? 'Zapisz gościa' : 'Dodaj gościa'}</IonButton>
          {guestEdit && <IonButton fill="clear" onClick={() => { setGuestEdit(null); setGuestName(''); setGuestPhone(''); }}>Anuluj edycję</IonButton>}
        </form></section>}
      </>} settlement={admin ? <MatchSettlement key={`${e.id}:${e.settlement_version ?? e.status}`} manager={manager} eventId={e.id} onChange={() => open(e.id)} /> : <section className="slm-panel"><p>Zatwierdzone należności za ten mecz sprawdzisz w swoich Rozliczeniach. Podział administracyjny nie jest dostępny w tym widoku.</p></section>} />
    </> : <section className="slm-matches-screen"><MatchFilters value={filter} onChange={setFilter} mineUnavailable />
      <p className="slm-filter-limit">Filtry obejmują pobraną stronę. Starsze mecze: przyciski stronicowania. „Moje” niedostępne — lista nie zawiera informacji o Twoich zapisach.</p>
      {filter === 'upcoming' && offset === 0 && upcoming && <MatchHero compact title="Najbliższy mecz" match={preview?.event ?? upcoming} openDisabled={busy} onOpen={() => void work(() => open(upcoming.id))}>
        {matchAction(preview)}
      </MatchHero>}
      {!filteredMatches.length && !(filter === 'upcoming' && offset === 0 && upcoming) && <p role="status">Brak meczów dla tego filtra na pobranej stronie.</p>}
      {filteredMatches.filter(match => !(filter === 'upcoming' && offset === 0 && upcoming?.id === match.id)).map(match => <div key={match.id} className="slm-match-list-item"><MatchHero match={match} compact title="Mecz" openDisabled={busy} onOpen={() => void work(() => open(match.id))} />
        <p className="slm-muted">{match.status === 'cancelled' ? '⛔ Odwołany' : match.registration_open ? 'Zapisy otwarte' : '🔒 Zapisy zamknięte'}</p></div>)}
      <div className="slm-actions"><IonButton fill="outline" disabled={busy || !offset} onClick={() => void work(() => list(Math.max(0, offset - 50)))}>Poprzednie mecze</IonButton>
        <IonButton fill="outline" disabled={busy || matches.length < 50} onClick={() => void work(() => list(offset + 50))}>Następne mecze</IonButton></div>
    </section>}
  </section>;
}

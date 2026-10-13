import { useEffect, useState } from 'react';
import { IonButton, IonInput, IonSelect, IonSelectOption, IonSpinner } from '@ionic/react';
import type { SessionManager } from '../auth/sessionManager';
import type { ManagedAccount, Session } from '../auth/api';
import { emptyMatchForm, matchDate, money, nextMatchDay, warsawFields } from '../events/model';
import type { Detail, Match, MatchForm, Participant } from '../events/model';
import './Events.css';

export default function Events({ manager, session }: { manager: SessionManager; session: Session }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<MatchForm | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [serverNow, setServerNow] = useState('');
  const [busy, setBusy] = useState(false);
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
  const admin = session.role === 'admin';
  async function list(page = offset) {
    const result = await manager.call<{ events: Match[]; server_now: string }>('events_list', { offset: page });
    setMatches(result.events); setServerNow(result.server_now); setOffset(page);
  }
  async function open(id: string) {
    const result = await manager.call<Detail>('events_detail', { event_id: id });
    setDetail(result); setServerNow(result.server_now); setForm(null); setGuestEdit(null);
  }
  async function work(task: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'Nie udało się wykonać operacji.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let alive = true;
    manager.call<{ events: Match[]; server_now: string }>('events_list', { offset: 0 })
      .then(r => { if (alive) { setMatches(r.events); setServerNow(r.server_now); } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Nie udało się pobrać meczów.'); });
    return () => { alive = false; };
  }, [manager]);
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
  const e = detail?.event;
  const mine = detail?.participants.find(p => p.member_id === session.user_id);
  function participant(p: Participant) {
    const manage = admin || p.responsible_user_id === session.user_id;
    return <li key={p.id} className="slm-participant">
      <span className="slm-avatar" aria-hidden="true">{p.display_name.slice(0, 2).toUpperCase()}</span>
      <div><strong>{p.display_name}</strong>
        <p>{p.member_id ? 'Zawodnik' : `Gość · odpowiedzialny: ${p.responsible_name}`}
          {p.status === 'registered' && (p.absent ? ' · ⚠ Nieobecny' : ' · Obecny')}</p>
        <a className="slm-call" href={`tel:${p.contact_phone}`}>Zadzwoń{!p.member_id && !p.guest_phone ? ' do zapraszającego' : ''}</a>
        {manage && e?.registration_open && <div className="slm-actions">
          <IonButton size="small" fill="outline" disabled={busy} onClick={() => void work(() => operation('withdraw', { participant_id: p.id }))}>Zrezygnuj{p.member_id ? '' : ' z gościa'}</IonButton>
          <IonButton size="small" fill="outline" disabled={busy} onClick={() => void work(() => operation(p.member_id ? (p.status === 'reserve' ? 'join' : 'reserve') : 'move_guest',
            p.member_id ? { user_id: p.member_id } : { participant_id: p.id, list: p.status === 'reserve' ? 'registered' : 'reserve' }))}>
            {p.status === 'reserve' ? 'Zapisz na mecz' : 'Przenieś na rezerwę'}</IonButton>
          {!p.member_id && <IonButton size="small" fill="outline" disabled={busy} onClick={() => { setGuestEdit(p.id); setGuestName(p.guest_name ?? ''); setGuestPhone(p.guest_phone ?? ''); }}>Edytuj gościa</IonButton>}
        </div>}
        {admin && e?.status === 'scheduled' && p.status === 'registered' && <IonButton size="small" fill="outline" disabled={busy}
          onClick={() => void work(() => operation('attendance', { participant_id: p.id, absent: !p.absent }))}>{p.absent ? 'Oznacz obecność' : 'Oznacz nieobecność'}</IonButton>}
      </div>
    </li>;
  }
  return <section aria-label="Wydarzenia">
    {error && <p role="alert" className="slm-error">⚠ {error}</p>}
    {notice && <p role="status" className="slm-notice">✓ {notice}</p>}
    {busy && <IonSpinner aria-label="Trwa operacja wydarzenia" />}
    <div className="slm-actions">
      <IonButton fill="outline" disabled={busy} onClick={() => void work(async () => { setDetail(null); setForm(null); await list(0); })}>Lista meczów</IonButton>
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
        await open(result.event_id); setNotice('Mecz zapisany. Powiadomienia push nie są jeszcze aktywne.');
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
      <section className="slm-panel"><h1>{matchDate(e.starts_at)}</h1><p>{e.location} · {e.duration_minutes} minut</p>
        <p>{money(e.hourly_rate)}/h · razem {money(e.total_cost)}</p>
        <p>Uczestnicy: {e.registered_count}/{e.capacity} · minimum 10 · rezerwa: {e.reserve_count}</p>
        <p className="slm-muted">Szacunkowo na osobę: {e.estimated_per_person === null ? 'brak zapisanych' : money(e.estimated_per_person)}. Rozliczenia nie są jeszcze aktywne.</p>
        {e.status === 'cancelled' ? <p role="status">⛔ Mecz odwołany</p> : !e.registration_open && <p role="status">🔒 Zapisy zamknięte — mecz już się rozpoczął.</p>}
        {e.decision_required && <p role="status" className="slm-error">⚠ Po 17:00 jest mniej niż 10 osób. Wymagana decyzja administratora; mecz nie został automatycznie odwołany.</p>}
        {e.registration_open && <div className="slm-actions">
          {mine?.status !== 'registered' && <IonButton disabled={busy} onClick={() => void work(() => operation('join'))}>Zapisz się</IonButton>}
          {!mine && <IonButton fill="outline" disabled={busy} onClick={() => void work(() => operation('reserve'))}>Dołącz do rezerwy</IonButton>}
        </div>}
        {admin && e.status === 'scheduled' && <div className="slm-actions">
          {e.registration_open && <IonButton fill="outline" disabled={busy} onClick={() => beginForm(e)}>Edytuj mecz</IonButton>}
          <IonButton fill="outline" disabled={busy} onClick={() => { if (window.confirm('Odwołać mecz? Zapisy zostaną zamknięte. Rozliczenia nie są aktywne.')) void work(() => operation('cancel')); }}>Odwołaj mecz</IonButton>
        </div>}
      </section>
      <section className="slm-panel"><h2>Uczestnicy</h2><ul className="slm-participants">{detail.participants.filter(p => p.status === 'registered').map(participant)}</ul>{!e.registered_count && <p>Brak zapisanych.</p>}</section>
      <section className="slm-panel"><h2>Rezerwa</h2><p className="slm-muted">Nie zajmuje miejsc. Bez automatycznego awansu: pierwszy skuteczny zapis zajmuje wolne miejsce. Push nie jest jeszcze aktywny.</p>
        <ul className="slm-participants">{detail.participants.filter(p => p.status === 'reserve').map(participant)}</ul>{!e.reserve_count && <p>Rezerwa jest pusta.</p>}</section>
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
            guest_name: guestName, guest_phone: guestPhone, list: guestList, user_id: responsible });
          setGuestName(''); setGuestPhone(''); setGuestEdit(null);
          setGuestRequestId(crypto.randomUUID());
        }); }}>
          <IonInput label="Imię/pseudonim gościa" labelPlacement="stacked" required maxlength={100} value={guestName} onIonInput={ev => setGuestName(ev.detail.value ?? '')} />
          <IonInput label="Telefon gościa (opcjonalnie, z prefiksem kraju)" labelPlacement="stacked" type="tel" value={guestPhone} onIonInput={ev => setGuestPhone(ev.detail.value ?? '')} />
          {!guestEdit && <IonSelect label="Lista gościa" labelPlacement="stacked" value={guestList} onIonChange={ev => setGuestList(ev.detail.value)}>
            <IonSelectOption value="registered">Uczestnicy</IonSelectOption><IonSelectOption value="reserve">Rezerwa</IonSelectOption></IonSelect>}
          {admin && !guestEdit && <IonSelect label="Konto odpowiedzialne" labelPlacement="stacked" value={responsible} onIonChange={ev => setResponsible(ev.detail.value)}>
            <IonSelectOption value={session.user_id}>Moje konto</IonSelectOption>{people.filter(p => p.user_id !== session.user_id).map(p => <IonSelectOption key={p.user_id} value={p.user_id}>{p.display_name}</IonSelectOption>)}
          </IonSelect>}
          <p className="slm-muted">Gość zajmuje osobne miejsce. Konto zapraszającego będzie odpowiedzialne za opłatę w przyszłym module rozliczeń. Bez telefonu kontakt prowadzi do zapraszającego.</p>
          <IonButton type="submit" disabled={busy}>{guestEdit ? 'Zapisz gościa' : 'Dodaj gościa'}</IonButton>
          {guestEdit && <IonButton fill="clear" onClick={() => { setGuestEdit(null); setGuestName(''); setGuestPhone(''); }}>Anuluj edycję</IonButton>}
        </form></section>}
    </> : <section className="slm-panel"><h1>Mecze</h1>
      {!matches.length && <p>Brak wydarzeń.</p>}
      {matches.map(match => <article key={match.id} className="slm-match"><h2>{matchDate(match.starts_at)}</h2><p>{match.location}</p>
        <p>{match.status === 'cancelled' ? '⛔ Odwołany' : match.registration_open ? 'Zapisy otwarte' : '🔒 Zapisy zamknięte'} · {match.registered_count}/{match.capacity}</p>
        {match.decision_required && <p>⚠ Brak minimum po 17:00 — decyzja administratora</p>}
        <IonButton fill="outline" disabled={busy} onClick={() => void work(() => open(match.id))}>Szczegóły</IonButton></article>)}
      <div className="slm-actions"><IonButton fill="outline" disabled={busy || !offset} onClick={() => void work(() => list(Math.max(0, offset - 50)))}>Poprzednie mecze</IonButton>
        <IonButton fill="outline" disabled={busy || matches.length < 50} onClick={() => void work(() => list(offset + 50))}>Następne mecze</IonButton></div>
    </section>}
  </section>;
}

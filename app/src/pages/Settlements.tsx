import { useEffect, useState } from 'react';
import { IonButton, IonInput, IonSelect, IonSelectOption, IonSpinner } from '@ionic/react';
import type { ManagedAccount, Session } from '../auth/api';
import type { SessionManager } from '../auth/sessionManager';
import { matchDate } from '../events/model';
import { centsText, decisionName, formatCents, ledgerKind, parseCents, paymentStatus } from '../settlements/model';
import type { FinanceAccount, Payment } from '../settlements/model';
import { useFinanceOperation } from '../settlements/useFinanceOperation';
import './Settlements.css';

export default function Settlements({ manager, session }: { manager: SessionManager; session: Session }) {
  const admin = session.role === 'admin';
  const [account, setAccount] = useState<FinanceAccount | null>(null);
  const [people, setPeople] = useState<ManagedAccount[]>([]);
  const [peopleOffset, setPeopleOffset] = useState(0);
  const [userId, setUserId] = useState(session.user_id);
  const [offset, setOffset] = useState(0);
  const [pendingOffset, setPendingOffset] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [correction, setCorrection] = useState<Payment | null>(null);
  const [correctedAmount, setCorrectedAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const op = useFinanceOperation(manager);
  const date = (value: string) => new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Warsaw' }).format(new Date(value));
  async function refresh() {
    const result = await manager.call<FinanceAccount>('settlements_account', { user_id: userId, offset });
    setAccount(result);
    if (admin) {
      const result = await manager.call<{ payments: Payment[] }>('settlements_pending', { offset: pendingOffset });
      setPayments(result.payments);
    }
  }
  async function read(work: () => Promise<void>) {
    setLoading(true); op.setError('');
    try { await work(); } catch (e) { op.setError(e instanceof Error ? e.message : 'Nie udało się pobrać danych.'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let alive = true;
    setAccount(null); setLoading(true);
    Promise.all([
      manager.call<FinanceAccount>('settlements_account', { user_id: userId, offset }),
      admin ? manager.call<{ payments: Payment[] }>('settlements_pending', { offset: pendingOffset }) : Promise.resolve({ payments: [] }),
    ]).then(([a, p]) => { if (alive) { setAccount(a); setPayments(p.payments); } })
      .catch(e => { if (alive) op.setError(e instanceof Error ? e.message : 'Nie udało się pobrać rozliczeń.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // setError jest stabilnym setterem useState.
  }, [manager, userId, offset, pendingOffset, admin, op.setError]);
  const disabled = op.busy || loading || !!op.pending;
  async function loadPeople(page: number) {
    setPeople(await manager.call<ManagedAccount[]>('list_accounts', { offset: page })); setPeopleOffset(page);
  }
  async function submit(manual: boolean) {
    try {
      const amount_cents = parseCents(amount);
      if (manual && !reason.trim()) throw new Error('Podaj opis otrzymanej wpłaty.');
      const saved = await op.mutate(manual ? 'record_payment' : 'submit_payment', {
        amount_cents, reason: reason.trim(), ...(manual ? { user_id: userId } : {}),
      }, refresh);
      if (saved) { setAmount(''); setReason(''); }
    } catch (e) { op.setError(e instanceof Error ? e.message : 'Sprawdź kwotę.'); }
  }
  return <section className="slm-settlements">
    <div className="slm-actions"><IonButton fill="outline" disabled={op.busy || loading} onClick={() => void read(refresh)}>Odśwież</IonButton>
      {op.pending && <IonButton disabled={op.busy || loading} onClick={() => void op.retry(refresh).then(saved => {
        if (saved) { setAmount(''); setReason(''); setCorrection(null); }
      })}>Ponów operację</IonButton>}
      {op.pending && <IonButton fill="outline" disabled={op.busy || loading} onClick={() => void op.resolve(refresh).then(saved => {
        if (saved) { setAmount(''); setReason(''); setCorrection(null); }
      })}>Rozstrzygnij wynik</IonButton>}</div>
    {op.error && <p role="alert" className="slm-error">⚠ {op.error}</p>}
    {op.notice && <p role="status" className="slm-notice">✓ {op.notice}</p>}
    {op.pending && <p role="status">Operacja oczekuje na potwierdzenie. Ponowienie używa tego samego identyfikatora. Rozstrzygnięcie potwierdzi zapis lub zamknie niezaksięgowane żądanie bez pobrania kwoty; po restarcie aplikacji sprawdzany jest poprzedni wynik.</p>}
    {(loading || op.busy) && <IonSpinner aria-label="Pobieranie rozliczeń" />}
    {admin && <section className="slm-panel"><h2>Konto do rozliczenia</h2>
      <IonButton fill="outline" disabled={disabled} onClick={() => void read(() => loadPeople(0))}>Wczytaj zawodników</IonButton>
      <IonSelect label="Zawodnik" labelPlacement="stacked" value={userId} disabled={disabled} onIonChange={ev => {
        setUserId(ev.detail.value); setOffset(0); setCorrection(null);
      }}><IonSelectOption value={session.user_id}>Moje konto</IonSelectOption>
        {userId !== session.user_id && !people.some(p => p.user_id === userId) && <IonSelectOption value={userId}>Wybrane konto</IonSelectOption>}
        {people.filter(p => p.user_id !== session.user_id).map(p => <IonSelectOption key={p.user_id} value={p.user_id}>{p.display_name}</IonSelectOption>)}
      </IonSelect>
      <div className="slm-actions"><IonButton fill="clear" disabled={disabled || !peopleOffset} onClick={() => void read(() => loadPeople(Math.max(0, peopleOffset - 50)))}>Poprzedni zawodnicy</IonButton>
        <IonButton fill="clear" disabled={disabled || people.length < 50} onClick={() => void read(() => loadPeople(peopleOffset + 50))}>Następni zawodnicy</IonButton></div>
    </section>}
    {account && <>
      <section className="slm-panel"><h1>{userId === session.user_id ? 'Moje rozliczenia' : 'Rozliczenia zawodnika'}</h1>
        <p className="slm-balance">Saldo: <strong>{formatCents(account.balance_cents)}</strong></p>
        <p>{account.balance_cents > 0 ? 'Nadpłata' : account.balance_cents < 0 ? 'Zadłużenie' : 'Rozliczone'}</p>
        <p className="slm-muted">Wpłaty pokrywają najstarsze należności. Zgłoszenie wpłaty nie zmienia salda do akceptacji.</p>
        <p role="status" className={account.blocked ? 'slm-error' : ''}>{account.blocked ? '🔒 Zapisy i dodawanie gości zablokowane' : '✓ Brak blokady zapisów'} · nieuregulowane mecze: {account.unpaid_matches}</p>
        {account.dues.map(d => <article className="slm-finance-row" key={d.event_id}>
          <h3>{matchDate(d.starts_at)}</h3><p>Należność: {formatCents(d.due_cents)} · pokryte: {formatCents(d.covered_cents)}</p>
          <p>{d.outstanding_cents > 0 ? '⚠ Pozostało' : '✓ Rozliczone'}: {formatCents(d.outstanding_cents)}</p>
        </article>)}
      </section>
      <section className="slm-panel"><h2>{admin ? 'Zarejestruj otrzymaną wpłatę' : 'Zgłoś wpłatę'}</h2>
        <form className="slm-form" onSubmit={ev => { ev.preventDefault(); void submit(admin); }}>
          <IonInput label="Kwota (zł)" labelPlacement="stacked" inputmode="decimal" required value={amount} disabled={disabled}
            onIonInput={ev => setAmount(ev.detail.value ?? '')} />
          <IonInput label={admin ? 'Opis / powód decyzji' : 'Opis wpłaty (opcjonalnie)'} labelPlacement="stacked" maxlength={500}
            required={admin} value={reason} disabled={disabled} onIonInput={ev => setReason(ev.detail.value ?? '')} />
          <IonButton type="submit" disabled={disabled}>{admin ? 'Zaksięguj wpłatę' : 'Zgłoś do zatwierdzenia'}</IonButton>
          {admin && userId === session.user_id && <IonButton fill="outline" disabled={disabled} onClick={() => void submit(false)}>Zgłoś własną wpłatę do zatwierdzenia</IonButton>}
        </form><p className="slm-muted">Ręczna ewidencja, bez banków i płatności online. Nadpłata zostaje na koncie.</p>
      </section>
      <section className="slm-panel"><h2>Wpłaty i zgłoszenia</h2>
        {!account.payments.length && <p>Brak wpłat na tej stronie.</p>}
        {account.payments.map(p => <article key={p.id} className="slm-finance-row">
          <strong>{formatCents(p.corrected_amount_cents)} · {paymentStatus[p.status]}</strong>
          <p>{date(p.created_at)} · {p.note || 'Bez opisu'}</p>
          {p.amount_cents !== p.corrected_amount_cents && <p>Kwota pierwotna: {formatCents(p.amount_cents)}</p>}
          {admin && p.status === 'accepted' && <IonButton size="small" fill="outline" disabled={disabled} onClick={() => {
            setCorrection(p); setCorrectedAmount(centsText(p.corrected_amount_cents));
          }}>Skoryguj wpłatę</IonButton>}
        </article>)}
        {admin && correction && <form className="slm-form" onSubmit={ev => {
          ev.preventDefault();
          try {
            const amount_cents = parseCents(correctedAmount, true);
            if (!reason.trim()) throw new Error('Podaj powód korekty.');
            void op.mutate('correct_payment', { payment_id: correction.id, amount_cents,
              expected_amount_cents: correction.corrected_amount_cents, reason: reason.trim() }, refresh)
              .then(saved => { if (saved) { setCorrection(null); setReason(''); } });
          } catch (e) { op.setError(e instanceof Error ? e.message : 'Sprawdź korektę.'); }
        }}><h3>Korekta wpłaty z {date(correction.created_at)}</h3>
          <IonInput label="Poprawna kwota całej wpłaty (zł); 0 wycofuje wpłatę" labelPlacement="stacked" inputmode="decimal" required
            value={correctedAmount} disabled={disabled} onIonInput={ev => setCorrectedAmount(ev.detail.value ?? '')} />
          <p>Powód wpisz w polu „Opis / powód decyzji” powyżej. Korekta zachowa poprzedni zapis.</p>
          <IonButton type="submit" disabled={disabled}>Zapisz korektę</IonButton>
          <IonButton fill="clear" disabled={disabled} onClick={() => setCorrection(null)}>Zamknij korektę</IonButton>
        </form>}
      </section>
      <section className="slm-panel"><h2>Historia salda</h2>
        {!account.history.length && <p>Brak operacji na tej stronie.</p>}
        {account.history.map(l => <article className="slm-finance-row" key={l.id}>
          <strong>{ledgerKind[l.kind]}: {formatCents(l.amount_cents)}</strong><p>{date(l.created_at)} · {l.reason}</p>
          {l.starts_at && <p>{matchDate(l.starts_at)} · {l.is_guest ? 'Gość: ' : 'Udział: '}{l.participant_name}</p>}
          <p>Zapisał: {l.actor_name || 'Administrator'}</p>
        </article>)}
        {account.decisions.map(a => <p key={a.id}>{date(a.created_at)} · {decisionName[a.action] || 'Decyzja'} · {a.reason || 'Bez opisu'}</p>)}
        <div className="slm-actions"><IonButton fill="clear" disabled={disabled || !offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Nowsza historia</IonButton>
          <IonButton fill="clear" disabled={disabled || Math.max(account.history.length, account.payments.length, account.decisions.length) < 50} onClick={() => setOffset(offset + 50)}>Starsza historia</IonButton></div>
      </section>
    </>}
    {admin && <section className="slm-panel"><h2>Wpłaty oczekujące na decyzję</h2>
      <p>Przed decyzją wpisz powód w polu opisu powyżej. Zaksięgowanie następuje tylko raz.</p>
      {!payments.length && <p>Brak oczekujących wpłat na tej stronie.</p>}
      {payments.map(p => <article className="slm-finance-row" key={p.id}><h3>{p.display_name}</h3>
        <p>{formatCents(p.amount_cents)} · {date(p.created_at)} · {p.note || 'Bez opisu'}</p>
        <div className="slm-actions">{(['accept_payment', 'reject_payment'] as const).map(action => <IonButton key={action}
          fill={action === 'accept_payment' ? 'solid' : 'outline'} disabled={disabled || !reason.trim()} onClick={() => void op.mutate(action,
            { payment_id: p.id, reason: reason.trim() }, refresh)}>{action === 'accept_payment' ? 'Akceptuj wpłatę' : 'Odrzuć zgłoszenie'}</IonButton>)}</div>
      </article>)}
      <div className="slm-actions"><IonButton fill="clear" disabled={disabled || !pendingOffset} onClick={() => setPendingOffset(Math.max(0, pendingOffset - 50))}>Poprzednie zgłoszenia</IonButton>
        <IonButton fill="clear" disabled={disabled || payments.length < 50} onClick={() => setPendingOffset(pendingOffset + 50)}>Następne zgłoszenia</IonButton></div>
    </section>}
  </section>;
}

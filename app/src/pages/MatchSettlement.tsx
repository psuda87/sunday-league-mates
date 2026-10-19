import { useEffect, useState } from 'react';
import { IonButton, IonInput, IonSelect, IonSelectOption, IonSpinner } from '@ionic/react';
import type { SessionManager } from '../auth/sessionManager';
import { centsText, decisionName, formatCents, parseCents } from '../settlements/model';
import type { SettlementDetail } from '../settlements/model';
import { useFinanceOperation } from '../settlements/useFinanceOperation';
import './Settlements.css';

export default function MatchSettlement({ manager, eventId, onChange }: {
  manager: SessionManager; eventId: string; onChange: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<SettlementDetail | null>(null);
  const [cost, setCost] = useState('');
  const [reason, setReason] = useState('');
  const [historyOffset, setHistoryOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const op = useFinanceOperation(manager);
  const { setError: setOperationError } = op;
  async function load() {
    const result = await manager.call<SettlementDetail>('settlements_detail', { event_id: eventId, offset: historyOffset });
    setDetail(result); setCost(centsText(result.cost_cents));
  }
  async function refresh() { await load(); await onChange(); }
  useEffect(() => {
    let alive = true;
    setDetail(null); setLoading(true);
    manager.call<SettlementDetail>('settlements_detail', { event_id: eventId, offset: historyOffset })
      .then(r => { if (alive) { setDetail(r); setCost(centsText(r.cost_cents)); } })
      .catch(e => { if (alive) setOperationError(e instanceof Error ? e.message : 'Nie udało się pobrać rozliczenia.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [manager, eventId, historyOffset, setOperationError]);
  async function change(action: string, body: Record<string, unknown> = {}) {
    if (!detail) return;
    if (!reason.trim()) { op.setError('Podaj powód decyzji.'); return; }
    await op.mutate(action, { ...body, event_id: eventId, expected_version: detail.version, reason: reason.trim() }, refresh);
  }
  const disabled = op.busy || loading || !!op.pending;
  const date = (value: string) => new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short', timeZone: detail?.timezone || 'Europe/Warsaw' }).format(new Date(value));
  return <section className="slm-panel slm-settlements"><h2>Rozliczenie meczu</h2>
    {op.error && <p role="alert" className="slm-error">⚠ {op.error}</p>}
    {op.notice && <p role="status" className="slm-notice">✓ {op.notice}</p>}
    {(op.busy || loading) && <IonSpinner aria-label="Rozliczanie meczu" />}
    <div className="slm-actions"><IonButton fill="outline" disabled={op.busy || loading} onClick={() => {
      setLoading(true); void load().catch(e => op.setError(e instanceof Error ? e.message : 'Błąd odświeżenia')).finally(() => setLoading(false));
    }}>Odśwież rozliczenie</IonButton>
      {op.pending && <IonButton disabled={op.busy || loading} onClick={() => void op.retry(refresh)}>Ponów operację</IonButton>}
      {op.pending && <IonButton fill="outline" disabled={op.busy || loading} onClick={() => void op.resolve(refresh)}>Rozstrzygnij wynik</IonButton>}</div>
    {op.pending && <p role="status">Najpierw potwierdź poprzednią operację. Ponowienie zachowuje jej dane; rozstrzygnięcie potwierdzi zapis lub zamknie niezaksięgowane żądanie.</p>}
    {detail && <>
      <p>{detail.approved_at ? `Zatwierdzone · rewizja ${detail.revision}` : 'Wstępne — nie tworzy zaległości ani blokady'}</p>
      <p className="slm-muted">Obecność i opłata są niezależne. Każdy płatny udział, także gość, ma osobną kwotę. Grosze rozdziela serwer w stałej kolejności.</p>
      {detail.approved_at && <p>Zmiany utworzą korektę i zachowają poprzednie operacje. Nowy koszt zostanie ponownie podzielony pomiędzy wszystkie płatne udziały.</p>}
      <IonInput label="Powód decyzji / korekty" labelPlacement="stacked" required maxlength={500} disabled={disabled}
        value={reason} onIonInput={ev => setReason(ev.detail.value ?? '')} />
      <form className="slm-form" onSubmit={ev => { ev.preventDefault();
        try { void change('cost', { amount_cents: parseCents(cost, true) }); }
        catch (e) { op.setError(e instanceof Error ? e.message : 'Sprawdź koszt.'); }
      }}><IonInput label="Całkowity koszt meczu (zł)" labelPlacement="stacked" inputmode="decimal" required
        value={cost} disabled={disabled || detail.status === 'cancelled'} onIonInput={ev => setCost(ev.detail.value ?? '')} />
        <IonButton type="submit" disabled={disabled || detail.status === 'cancelled'}>{detail.approved_at ? 'Skoryguj koszt i podział' : 'Zapisz koszt'}</IonButton>
      </form>
      <ul className="slm-share-list">{detail.participants.map(p => <li className="slm-finance-row" key={p.participant_id}>
        <h3>{p.name}</h3><p>{p.status === 'registered' ? 'Zapisany' : p.status === 'reserve' ? 'Rezerwa' : 'Zrezygnował'} · {p.absent ? '⚠ Nieobecny' : p.status === 'registered' ? 'Obecny' : 'Bez oznaczenia nieobecności'}</p>
        <p>{p.payable ? 'Do zapłaty' : 'Zwolniony / bez obowiązku'}: <strong>{formatCents(p.amount_cents)}</strong>
          {p.charge_override !== null && ' · decyzja administratora'}{p.replacement_id && ' · miejsce przejęte przez zastępcę'}</p>
        <div className="slm-actions">
          <IonButton size="small" fill="outline" disabled={disabled} onClick={() => void change('attendance', { participant_id: p.participant_id, absent: !p.absent })}>
            {p.absent ? 'Oznacz obecność' : 'Oznacz nieobecność'}</IonButton>
          <IonButton size="small" fill="outline" disabled={disabled || detail.status === 'cancelled'} onClick={() => void change('charge', { participant_id: p.participant_id, payable: !p.payable })}>
            {p.payable ? 'Zwolnij z opłaty' : 'Nalicz opłatę'}</IonButton>
          {p.charge_override !== null && <IonButton size="small" fill="clear" disabled={disabled || detail.status === 'cancelled'} onClick={() => void change('charge', { participant_id: p.participant_id, payable: null })}>Przywróć regułę domyślną</IonButton>}
        </div>
        {p.status !== 'registered' && p.payable && !p.replacement_id && <>
          <IonSelect label="Zastępca (serwer sprawdzi skuteczne przejęcie)" labelPlacement="stacked" value={replacements[p.participant_id] ?? ''} disabled={disabled}
            onIonChange={ev => setReplacements(previous => ({ ...previous, [p.participant_id]: ev.detail.value }))}>
            {detail.participants.filter(x => x.status === 'registered').map(x => <IonSelectOption key={x.participant_id} value={x.participant_id}>{x.name}</IonSelectOption>)}
          </IonSelect><IonButton size="small" disabled={disabled || !replacements[p.participant_id]} onClick={() => void change('replacement', {
            participant_id: p.participant_id, replacement_id: replacements[p.participant_id],
          })}>Potwierdź zastępstwo</IonButton>
        </>}
      </li>)}</ul>
      {!detail.participants.length && <p>Brak udziałów do rozliczenia.</p>}
      <p>Koszt do podziału: {formatCents(detail.status === 'cancelled' ? 0 : detail.cost_cents)}</p>
      {!detail.approved_at && <>
        <IonButton disabled={disabled || !detail.can_approve || !reason.trim()} onClick={() => {
          if (window.confirm('Zatwierdzić rozliczenie i zaksięgować należności? Dalsze zmiany będą korektami.')) void change('approve');
        }}>Zatwierdź rozliczenie</IonButton>
        {!detail.can_approve && <p>Zatwierdzenie dopiero po planowanym końcu meczu. Odwołany mecz nie tworzy należności.</p>}
      </>}
      <details><summary>Historia rozliczenia i decyzji</summary>
        {detail.revisions.map(r => <article className="slm-finance-row" key={r.id}><strong>Rewizja {r.revision} · {formatCents(r.cost_cents)}</strong>
          <p>{date(r.created_at)} · {r.reason}</p></article>)}
        {detail.audit.map(a => <article className="slm-finance-row" key={a.id}><p>{date(a.created_at)} · {decisionName[a.action] || 'Decyzja'} · {a.reason}</p>
          <details><summary>Dane audytu · operacja {a.id}</summary><p>Wykonawca: {a.actor_id}</p><pre>{JSON.stringify(a.snapshot, null, 2)}</pre></details>
        </article>)}
        <div className="slm-actions"><IonButton fill="clear" disabled={disabled || !historyOffset} onClick={() => setHistoryOffset(Math.max(0, historyOffset - 50))}>Nowsze decyzje</IonButton>
          <IonButton fill="clear" disabled={disabled || Math.max(detail.audit.length, detail.revisions.length) < 50} onClick={() => setHistoryOffset(historyOffset + 50)}>Starsze decyzje</IonButton></div>
      </details>
    </>}
  </section>;
}

import { useEffect, useState } from 'react';
import { IonButton, IonSpinner, IonToggle } from '@ionic/react';
import type { SessionManager } from '../auth/sessionManager';
import type { NativePush } from '../notifications/nativePush';
import { categories } from '../notifications/model';
import type { Category, NotificationList } from '../notifications/model';
import './Notifications.css';

export default function Notifications({ manager, push, pushStatus, onOpen, onRefresh }: {
  manager: SessionManager; push: NativePush; pushStatus: string; onOpen: (id: string) => Promise<void>; onRefresh: () => void;
}) {
  const [list, setList] = useState<NotificationList | null>(null);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const date = (value: string) => new Intl.DateTimeFormat('pl-PL',{ dateStyle: 'short',timeStyle: 'short',timeZone: 'Europe/Warsaw' }).format(new Date(value));
  async function load() { setList(await manager.call<NotificationList>('notifications_list',{ offset })); onRefresh(); }
  async function work(task: () => Promise<void>) {
    setBusy(true); setError('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'Nie udało się obsłużyć powiadomienia.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let alive = true; setBusy(true);
    manager.call<NotificationList>('notifications_list',{ offset })
      .then(r => { if (alive) setList(r); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Nie udało się pobrać powiadomień.'); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  },[manager,offset]);
  return <section aria-label="Powiadomienia">
    {error && <p role="alert" className="slm-error">⚠ {error}</p>}
    {busy && <IonSpinner aria-label="Pobieranie powiadomień" />}
    <section className="slm-panel"><h1>Centrum powiadomień</h1><p>Nieprzeczytane: {list?.unread ?? '—'}</p>
      <div className="slm-actions"><IonButton fill="outline" disabled={busy} onClick={() => void work(load)}>Odśwież</IonButton>
        <IonButton fill="outline" disabled={busy || !list?.unread} onClick={() => void work(async () => {
          await manager.call('notifications_read_all'); await load();
        })}>Oznacz wszystkie jako przeczytane</IonButton></div>
      {list && !list.notifications.length && <p>{offset ? 'Brak starszych powiadomień.' : 'Nie masz jeszcze powiadomień. Nowe informacje pojawią się tutaj także bez zgody na systemowy push.'}</p>}
      {list?.notifications.map(n => <article key={n.id} className="slm-notification">
        <h2>{!n.read_at && <span aria-label="Nieprzeczytane">● </span>}{n.title}</h2>
        <p>{n.body}</p><p className="slm-muted">{date(n.created_at)} · {n.read_at ? 'Przeczytane' : 'Nowe'}</p>
        <div className="slm-actions"><IonButton fill="outline" disabled={busy} onClick={() => void work(async () => {
          await onOpen(n.id); if (!n.event_id) await load();
        })}>{n.event_id ? 'Otwórz mecz' : n.category === 'finance' ? 'Otwórz powiadomienie' : 'Przeczytaj'}</IonButton>
          {!n.read_at && <IonButton fill="clear" disabled={busy} onClick={() => void work(async () => {
            await manager.call('notifications_read',{ notification_id: n.id }); await load();
          })}>Oznacz jako przeczytane</IonButton>}</div>
      </article>)}
      <div className="slm-actions"><IonButton fill="clear" disabled={busy || !offset} onClick={() => setOffset(Math.max(0,offset-50))}>Nowsze</IonButton>
        <IonButton fill="clear" disabled={busy || offset>=10000 || (list?.notifications.length ?? 0)<50} onClick={() => setOffset(offset+50)}>Starsze</IonButton></div>
    </section>
    <section className="slm-panel"><h2>Powiadomienia systemowe</h2><p role="status">{pushStatus}</p>
      <p>Historia i licznik w aplikacji działają niezależnie od zgody na push. Push może dotrzeć z opóźnieniem lub nie dotrzeć.</p>
      <div className="slm-actions"><IonButton disabled={busy} onClick={() => void work(() => push.enable())}>Włącz na tym urządzeniu</IonButton>
        <IonButton fill="outline" disabled={busy} onClick={() => void work(() => push.disable())}>Wyłącz na tym urządzeniu</IonButton></div>
      {list && <><h3>Kategorie systemowego push</h3><p>Wyłączenie kategorii nie usuwa historii w aplikacji.</p>
        {(Object.entries(categories) as [Category,string][]).map(([key,label]) => <IonToggle key={key} className="slm-notification-toggle"
          checked={list.preferences[key]} disabled={busy} onIonChange={ev => void work(async () => {
            await manager.call('notifications_preferences',{ category: key,push_enabled: ev.detail.checked }); await load();
          })}>{label}</IonToggle>)}
      </>}
    </section>
  </section>;
}

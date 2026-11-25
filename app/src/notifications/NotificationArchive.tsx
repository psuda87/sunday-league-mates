import { useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import NotificationDialog from './NotificationDialog';

/** Powiadomienia starsze niż tydzień trafiają do archiwum; każdy widzi wyłącznie swoje (serwer zwraca rekordy sesji). */
export const ARCHIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
interface Row { id: string; title: string; body: string; created_at: string; archived_at?: string | null }
const PAGE = 50, MAX_PAGES = 4;

export default function NotificationArchive({ manager, userId }: { manager: SessionManager; userId: string }) {
  const [open, setOpen] = useState(false), [rows, setRows] = useState<Row[] | null>(null), [error, setError] = useState(false), [busy, setBusy] = useState(false), [shown, setShown] = useState<Row | null>(null);
  async function load() {
    if (busy) return; setBusy(true); setError(false);
    try {
      const found: Row[] = [], limit = Date.now() - ARCHIVE_AFTER_MS;
      for (let page = 0; page < MAX_PAGES; page++) {
        const snapshot = manager.getSnapshot();
        if (snapshot.phase !== 'ready' || snapshot.session?.user_id !== userId) throw new Error('session');
        const r = await manager.call<{ notifications?: Row[] }>('notifications_list', { offset: page * PAGE });
        const list = Array.isArray(r?.notifications) ? r.notifications : [];
        found.push(...list.filter(n => !!n.archived_at || Date.parse(n.created_at) < limit));
        if (list.length < PAGE) break;
      }
      setRows(found);
    } catch { setError(true); } finally { setBusy(false); }
  }
  if (!open) return <section className="slm-notification-archive"><button type="button" onClick={() => { setOpen(true); void load(); }}>Archiwum powiadomień</button></section>;
  return <section className="slm-notification-archive" aria-label="Archiwum powiadomień">
    <h2>Archiwum powiadomień</h2><p>Powiadomienia zarchiwizowane oraz starsze niż 7 dni.</p>
    {error ? <p role="alert">Nie udało się wczytać archiwum. <button type="button" onClick={() => void load()}>Spróbuj ponownie</button></p>
      : rows === null ? <p>Wczytywanie…</p>
      : rows.length === 0 ? <p>Archiwum jest puste.</p>
      : <ul className="slm-archive-tiles">{rows.map(n => <li key={n.id}><button type="button" className="slm-archive-tile" onClick={() => setShown(n)}>
        <strong>{n.title}</strong><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</time>
        <span aria-hidden="true">›</span></button></li>)}</ul>}
    {shown && <NotificationDialog item={{ ...shown, read_at: null }} onClose={() => setShown(null)}/>}
    <button type="button" onClick={() => setOpen(false)}>Zamknij archiwum</button>
  </section>;
}

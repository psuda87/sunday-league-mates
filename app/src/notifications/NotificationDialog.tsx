import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface InboxItem { id: string; title: string; body: string; created_at: string; read_at: string | null; archived_at?: string | null }

/**
 * Pełna treść powiadomienia z dzwonka (decyzja właściciela 2026-11-23): lista pokazuje same nagłówki,
 * a po kliknięciu otwiera się ten popup z treścią i przyciskiem „Archiwizuj”, który chowa wpis z listy.
 */
export default function NotificationDialog({ item, busy, error, onArchive, onClose }:
  { item: InboxItem; busy?: boolean; error?: boolean; onArchive?: () => void; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId(), bodyId = useId();
  useEffect(() => { close.current?.focus(); }, [item.id]);
  return createPortal(<div className="slm-notification-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="slm-notification-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
      <h2 id={titleId}>{item.title}</h2>
      <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</time>
      <p id={bodyId}>{item.body}</p>
      {error && <p role="alert">Nie udało się zarchiwizować. Spróbuj ponownie.</p>}
      <div className="slm-notification-dialog-actions">
        {onArchive && <button type="button" onClick={onArchive} disabled={busy}>{busy ? 'Archiwizuję…' : 'Archiwizuj'}</button>}
        <button ref={close} type="button" className="slm-notification-dialog-close" onClick={onClose}>Zamknij</button>
      </div>
    </div>
  </div>, document.body);
}

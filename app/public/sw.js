// Service worker SLM: wyłącznie Web Push (bez cache i bez przechwytywania żądań).
// Payload jest szyfrowany end-to-end do tego urządzenia; zawiera id rekordu oraz tytuł i treść do pokazania w rozwiniętym powiadomieniu.
// Gdy tytułu/treści brak lub payload jest nieczytelny, pokazujemy ogólny komunikat.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let id = null, title = null, text = null;
  try { const data = event.data ? event.data.json() : null; if (data && typeof data.notification_id === 'string' && UUID.test(data.notification_id)) id = data.notification_id; if (data && typeof data.title === 'string' && data.title.trim()) title = data.title.slice(0, 80); if (data && typeof data.body === 'string' && data.body.trim()) text = data.body.slice(0, 160); }
  catch (_) { /* Nieczytelny payload: pokazujemy ogólne powiadomienie (wymóg userVisibleOnly). */ }
  event.waitUntil((async () => {
    await self.registration.showNotification(title || 'Sunday League Mates', {
      body: text || 'Masz nowe powiadomienie. Otwórz aplikację, aby zobaczyć szczegóły.',
      icon: '/assets/branding/slm-pwa-icon-192.png', badge: '/assets/branding/slm-pwa-icon-192.png',
      tag: id || 'slm-update', renotify: false, data: { notification_id: id },
    });
    // Otwarta aplikacja odświeża licznik, nie czekając na minutowy odczyt.
    for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) client.postMessage({ type: 'slm-push-received' });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.notification_id;
  const id = typeof raw === 'string' && UUID.test(raw) ? raw : null;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (open) { await open.focus(); if (id) open.postMessage({ type: 'slm-open-notification', id }); return; }
    await self.clients.openWindow(id ? '/?slm_n=' + id : '/');
  })());
});

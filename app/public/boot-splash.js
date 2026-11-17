// Ekran startowy SLM: zostaje, dopóki aplikacja sprawdza sesję (min. 1,2 s, maks. 10 s), potem się wygasza.
(function () {
  var splash = document.getElementById('slm-boot');
  if (!splash) return;
  // Kolory jak w aplikacji (src/ui/theme.ts): profil slm.palette, tryb slm.appearance; domyślnie España, ciemny.
  var BG = { 'espana-dark': '#0b0c10', 'espana-light': '#f7f5f0', 'fcb-dark': '#080f22', 'fcb-light': '#f4f5fa',
    'lime-dark': '#172a27', 'lime-light': '#f4f8ef', 'deimos-dark': '#121212', 'deimos-light': '#f7f3fc' };
  var palette = 'espana', mode = 'dark';
  try {
    var p = localStorage.getItem('slm.palette');
    if (p === 'fcb' || p === 'lime' || p === 'deimos' || p === 'espana') palette = p;
    var a = localStorage.getItem('slm.appearance');
    var systemDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (a === 'light' || (a === 'auto' && !systemDark)) mode = 'light';
  } catch (e) { /* Brak dostępu do pamięci: domyślne kolory. */ }
  splash.setAttribute('data-p', palette);
  splash.setAttribute('data-m', mode);
  var bg = BG[palette + '-' + mode];
  document.documentElement.style.background = bg;
  if (document.body) document.body.style.background = bg;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bg);
  var started = Date.now(), MIN = 1200, MAX = 10000, done = false, observer;
  function appReady() {
    var root = document.getElementById('root');
    if (!root || !root.firstElementChild) return false;
    // Ekran „sprawdzania sesji” to jeszcze start aplikacji.
    return (root.textContent || '').indexOf('do sprawdzenia sesji') === -1;
  }
  function hide() {
    if (done) return;
    done = true;
    if (observer) observer.disconnect();
    splash.classList.add('slm-boot-out');
    setTimeout(function () {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
      document.documentElement.style.background = '';
      if (document.body) document.body.style.background = '';
    }, 500);
  }
  function check() {
    if (done) return;
    var elapsed = Date.now() - started;
    if (elapsed >= MAX) return hide();
    if (appReady()) {
      if (elapsed >= MIN) hide(); else setTimeout(check, MIN - elapsed);
    }
  }
  var root = document.getElementById('root');
  if (root && 'MutationObserver' in window) {
    observer = new MutationObserver(check);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }
  setTimeout(hide, MAX);
  setTimeout(check, MIN);
})();

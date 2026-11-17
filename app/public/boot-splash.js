// Ekran startowy SLM: zostaje, dopóki aplikacja sprawdza sesję (min. 1,2 s, maks. 10 s), potem się wygasza.
(function () {
  var splash = document.getElementById('slm-boot');
  if (!splash) return;
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
    setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 500);
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

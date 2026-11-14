import {useEffect, useRef} from 'react';

// Poll only a visible online view. Coalesce focus/online/visibility bursts.
export function useVisibleRefresh(enabled: boolean, refresh: () => void) {
  const latest = useRef(refresh); latest.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    let last = -Infinity;
    const check = () => {
      if (document.visibilityState !== 'visible' || navigator.onLine === false || Date.now() - last < 500) return;
      last = Date.now(); latest.current();
    };
    const timer = window.setInterval(check, 15000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
    };
  }, [enabled]);
}

import { useEffect } from 'react';
import type { DependencyList } from 'react';

interface LoadOptions { skip?: boolean; onStart?: () => void; onEnd?: () => void }

// Jednorazowe pobranie danych przy zmianie zależności. Wynik, błąd i zakończenie są pomijane,
// jeśli efekt został już zastąpiony lub odmontowany. Wyjątek z onData trafia do onError.
export function useLoad<T>(
  load: () => Promise<T>, onData: (value: T) => void, onError: (message: string) => void,
  fallback: string, deps: DependencyList, options: LoadOptions = {},
) {
  useEffect(() => {
    if (options.skip) return;
    let live = true;
    options.onStart?.();
    load().then(value => { if (live) onData(value); })
      .catch(e => { if (live) onError(e instanceof Error ? e.message : fallback); })
      .finally(() => { if (live) options.onEnd?.(); });
    return () => { live = false; };
    // Zależności podaje wywołujący; load/onData/onError są przy każdym renderze nowymi domknięciami.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

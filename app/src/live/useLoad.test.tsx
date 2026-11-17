import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLoad } from './useLoad';

describe('useLoad', () => {
  it('przekazuje dane i kończy; błąd z onData trafia do onError', async () => {
    const onData = vi.fn(), onError = vi.fn(), onEnd = vi.fn();
    renderHook(() => useLoad(async () => 1, v => { onData(v); throw new Error('zły kontrakt'); }, onError, 'domyślny', [], { onEnd }));
    await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
    expect(onData).toHaveBeenCalledWith(1); expect(onError).toHaveBeenCalledWith('zły kontrakt');
  });
  it('pomija wynik po odmontowaniu i nie ładuje przy skip', async () => {
    const onData = vi.fn(), onError = vi.fn(); let done!: (v: number) => void;
    const { unmount } = renderHook(() => useLoad(() => new Promise<number>(r => { done = r; }), onData, onError, 'x', []));
    unmount(); done(2); await Promise.resolve();
    expect(onData).not.toHaveBeenCalled();
    const load = vi.fn(async () => 3);
    renderHook(() => useLoad(load, onData, onError, 'x', [], { skip: true }));
    expect(load).not.toHaveBeenCalled();
  });
  it('nieznany błąd używa komunikatu domyślnego', async () => {
    const onError = vi.fn();
    renderHook(() => useLoad(async () => { throw 'nie-Error'; }, () => undefined, onError, 'Nie udało się pobrać.', []));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Nie udało się pobrać.'));
  });
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

interface BackEvent extends Event { detail: { register: (priority: number, handler: () => void | Promise<void>) => void } }

// Ionic overlays retain priority 100, menus 99. A single action consumes each press.
export function useBackAction(priority: number, enabled: boolean, action: () => void) {
  const current = useRef(action);
  current.current = action;
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: Event) => (event as BackEvent).detail.register(priority, () => current.current());
    document.addEventListener('ionBackButton', listener);
    return () => document.removeEventListener('ionBackButton', listener);
  }, [priority, enabled]);
}

export function useScreenHistory<T extends string>(initial: T) {
  const [screen, update] = useState(initial);
  const current = useRef(initial), history = useRef<T[]>([]);
  const navigate = useCallback((next: T) => {
    if (current.current === next) return;
    history.current = [...history.current, current.current].slice(-20);
    current.current = next; update(next);
  }, []);
  const back = useCallback(() => {
    if (current.current === initial) {
      history.current = [];
      if (Capacitor.getPlatform() === 'android') void App.minimizeApp();
      return;
    }
    const next = history.current.pop() ?? initial;
    current.current = next; update(next);
  }, [initial]);
  const reset = useCallback(() => { history.current=[]; current.current=initial; update(initial); }, [initial]);
  return { screen, navigate, back, reset };
}

export function useAndroidShell() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    // AppPlugin emits Ionic's document backbutton only while a native listener exists.
    // Do not dispatch a second event from this callback, or one press pops twice.
    const android = Capacitor.getPlatform() === 'android';
    const back = android ? App.addListener('backButton', () => {}) : null;
    const show = () => setKeyboardOpen(true), hide = () => setKeyboardOpen(false);
    const nativeShow = android ? Keyboard.addListener('keyboardDidShow', show) : null;
    const nativeHide = android ? Keyboard.addListener('keyboardDidHide', hide) : null;
    window.addEventListener('ionKeyboardDidShow', show);
    window.addEventListener('ionKeyboardDidHide', hide);
    return () => {
      window.removeEventListener('ionKeyboardDidShow', show); window.removeEventListener('ionKeyboardDidHide', hide);
      void back?.then(handle => handle.remove());
      void nativeShow?.then(handle => handle.remove()); void nativeHide?.then(handle => handle.remove());
    };
  }, []);
  useBackAction(60, keyboardOpen, () => {
    (document.activeElement as HTMLElement | null)?.blur();
    if (Capacitor.getPlatform() === 'android') void Keyboard.hide();
    setKeyboardOpen(false);
  });
  return keyboardOpen;
}

export type Appearance = 'auto' | 'light' | 'dark';
// Retain the subscribed MediaQueryList for the lifetime of the app.
let activeMedia: MediaQueryList | null = null;
export const appearanceKey = 'slm.appearance';
export function readAppearance(): Appearance {
  try { const value = localStorage.getItem(appearanceKey); return value === 'light' || value === 'dark' ? value : 'auto'; }
  catch { return 'auto'; }
}
export function resolveDark(mode: Appearance, systemDark: boolean) { return mode === 'dark' || (mode === 'auto' && systemDark); }
export function applyTheme(mode = readAppearance()) {
  document.documentElement.dataset.theme = 'espana';
  document.documentElement.classList.toggle('ion-palette-dark', resolveDark(mode, (activeMedia ?? window.matchMedia('(prefers-color-scheme: dark)')).matches));
}
export function setAppearance(mode: Appearance) {
  try { localStorage.setItem(appearanceKey, mode); } catch { /* Memory-only selection when storage is unavailable. */ }
  applyTheme(mode);
  window.dispatchEvent(new CustomEvent('slm-appearance', { detail: mode }));
}
export function initializeTheme() {
  let mode = readAppearance();
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  activeMedia = media;
  applyTheme(mode);
  const system = () => applyTheme(mode);
  const local = (e: Event) => { mode = (e as CustomEvent<Appearance>).detail; };
  const storage = (e: StorageEvent) => { if (e.key === appearanceKey || e.key === null) { mode = readAppearance(); applyTheme(mode); } };
  media.addEventListener('change', system);
  window.addEventListener('slm-appearance', local);
  window.addEventListener('storage', storage);
  return () => { if (activeMedia === media) activeMedia = null; media.removeEventListener('change', system); window.removeEventListener('slm-appearance', local); window.removeEventListener('storage', storage); };
}

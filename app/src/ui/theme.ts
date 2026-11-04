export type Palette = 'espana'|'fcb'|'lime'|'deimos'|'midnight';
export const palettes:readonly Palette[]=['espana','fcb','lime','deimos','midnight'];
export const paletteKey='slm.palette';
let paletteEnabled=false;
let currentPalette:Palette='espana';
export function readPalette():Palette {try {const value=localStorage.getItem(paletteKey);return palettes.includes(value as Palette)?value as Palette:'espana';}catch{return currentPalette;}}
export function setPalette(palette:Palette) {
 if(!paletteEnabled||!palettes.includes(palette))return;
 currentPalette=palette;try{localStorage.setItem(paletteKey,palette);}catch{/* Session-only when storage is unavailable. */}
 document.documentElement.dataset.theme=palette;window.dispatchEvent(new CustomEvent('slm-palette',{detail:palette}));
}
export type Appearance = 'auto' | 'light' | 'dark';
let memoryAppearance:Appearance='auto';
// Retain the subscribed MediaQueryList for the lifetime of the app.
let activeMedia: MediaQueryList | null = null;
export const appearanceKey = 'slm.appearance';
export function readAppearance(): Appearance {
  try { const value = localStorage.getItem(appearanceKey); return value === 'light' || value === 'dark' ? value : 'auto'; }
  catch { return memoryAppearance; }
}
export function resolveDark(mode: Appearance, systemDark: boolean) { return mode === 'dark' || (mode === 'auto' && systemDark); }
export function applyTheme(mode = readAppearance()) {
  memoryAppearance=mode;
  document.documentElement.dataset.theme = paletteEnabled?currentPalette:'espana';
  document.documentElement.classList.toggle('ion-palette-dark', resolveDark(mode, (activeMedia ?? window.matchMedia('(prefers-color-scheme: dark)')).matches));
}
export function setAppearance(mode: Appearance) {
  try { localStorage.setItem(appearanceKey, mode); } catch { /* Memory-only selection when storage is unavailable. */ }
  applyTheme(mode);
  window.dispatchEvent(new CustomEvent('slm-appearance', { detail: mode }));
}
export function initializeTheme(options:{palettes?:boolean}={}) {
  paletteEnabled=options.palettes===true;currentPalette=paletteEnabled?readPalette():'espana';
  let mode = readAppearance();
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  activeMedia = media;
  applyTheme(mode);
  const system = () => applyTheme(mode);
  const local = (e: Event) => { mode = (e as CustomEvent<Appearance>).detail; };
  const storage = (e: StorageEvent) => { if (e.key === appearanceKey || e.key === paletteKey || e.key === null) { mode = readAppearance();currentPalette=paletteEnabled?readPalette():'espana'; applyTheme(mode); } };
  media.addEventListener('change', system);
  window.addEventListener('slm-appearance', local);
  window.addEventListener('storage', storage);
  return () => { if (activeMedia === media) activeMedia = null; media.removeEventListener('change', system); window.removeEventListener('slm-appearance', local); window.removeEventListener('storage', storage); };
}

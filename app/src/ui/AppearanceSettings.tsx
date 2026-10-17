import { useEffect, useState } from 'react';
import { readAppearance, setAppearance } from './theme';
import type { Appearance } from './theme';
export default function AppearanceSettings() {
  const [mode, setMode] = useState(readAppearance);
  useEffect(() => {
    const local = (e: Event) => setMode((e as CustomEvent<Appearance>).detail);
    const storage = () => setMode(readAppearance());
    window.addEventListener('slm-appearance', local); window.addEventListener('storage', storage);
    return () => { window.removeEventListener('slm-appearance', local); window.removeEventListener('storage', storage); };
  }, []);
  return <section className="slm-panel slm-appearance"><h2>Wygląd aplikacji</h2><p className="slm-muted">España · czerwień i złoto</p>
    <fieldset><legend>Tryb kolorystyczny</legend>{(['auto', 'light', 'dark'] as const).map((value, i) => <label key={value}>
      <input type="radio" name="appearance" value={value} checked={mode === value} onChange={() => setAppearance(value)} />{['Automatyczny', 'Jasny', 'Ciemny'][i]}</label>)}</fieldset>
  </section>;
}

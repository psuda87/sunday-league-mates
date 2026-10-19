import { useEffect, useId, useState } from 'react';
import { palettes, readPalette, setPalette, readAppearance, setAppearance } from './theme';
import type { Appearance } from './theme';
export default function AppearanceSettings({enablePalettes=false}:{enablePalettes?:boolean}) {
  const group=useId();
  const [palette,updatePalette]=useState(readPalette);
  const [mode, setMode] = useState(readAppearance);
  useEffect(() => {
    const local = (e: Event) => setMode((e as CustomEvent<Appearance>).detail);
    const paletteChange=()=>updatePalette(readPalette());
    const storage = () => {setMode(readAppearance());updatePalette(readPalette());};
    window.addEventListener('slm-palette',paletteChange);
    window.addEventListener('slm-appearance', local); window.addEventListener('storage', storage);
    return () => {window.removeEventListener('slm-palette',paletteChange); window.removeEventListener('slm-appearance', local); window.removeEventListener('storage', storage); };
  }, []);
  return <section className="slm-panel slm-appearance"><h2>Wygląd aplikacji</h2>{!enablePalettes&&<p className="slm-muted">España · czerwień i złoto</p>}{enablePalettes&&<fieldset className="slm-palette-picker"><legend>Motyw kolorystyczny</legend>{palettes.map(value=><label key={value} data-palette={value}><input type="radio" name={`palette-${group}`} value={value} checked={palette===value} onChange={()=>{setPalette(value);updatePalette(value);}}/><span className="slm-palette-swatch" aria-hidden="true"><i/><i/><i/></span>{({espana:'España',fcb:'FCB',lime:'Classic Lime',deimos:'Deimos-Code'})[value]}</label>)}</fieldset>}
    <fieldset><legend>{enablePalettes?'Wygląd':'Tryb kolorystyczny'}</legend>{(['auto', 'light', 'dark'] as const).map((value, i) => <label key={value}>
      <input type="radio" name={`appearance-${group}`} value={value} checked={mode === value} onChange={() => setAppearance(value)} />{['Automatyczny', 'Jasny', 'Ciemny'][i]}</label>)}</fieldset>
  </section>;
}

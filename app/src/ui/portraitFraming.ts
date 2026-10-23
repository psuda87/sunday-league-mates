import type { CSSProperties } from 'react';
// Presentation boundary for a future move/zoom/head-position editor. These
// values are not persisted and do not claim background removal support.
export interface PortraitFraming { x:number;y:number;zoom:number }
export const defaultPortraitFraming:PortraitFraming={x:50,y:32,zoom:1};
export function portraitFramingStyle(value?:Partial<PortraitFraming>):CSSProperties {
  const finite=(v:number|undefined,fallback:number,min:number,max:number)=>Number.isFinite(v)?Math.min(max,Math.max(min,v!)):fallback;
  return {'--portrait-x':`${finite(value?.x,50,0,100)}%`,'--portrait-y':`${finite(value?.y,32,0,100)}%`,'--portrait-zoom':finite(value?.zoom,1,1,3)} as CSSProperties;
}

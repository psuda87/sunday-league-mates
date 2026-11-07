import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

type Props = {file:File; onCancel:()=>void; onApply:(file:File)=>Promise<void>};
const W=600,H=800,INITIAL_ZOOM=1.2,MIN_ZOOM=0.55;
export default function PhotoCropEditor({file,onCancel,onApply}:Props){
 const [url,setUrl]=useState(''),[size,setSize]=useState({w:0,h:0}),[zoom,setZoom]=useState(INITIAL_ZOOM),[offset,setOffset]=useState({x:0,y:0}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const image=useRef<HTMLImageElement|null>(null),surface=useRef<HTMLDivElement|null>(null),drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
 useEffect(()=>{const u=URL.createObjectURL(file);setUrl(u);return()=>URL.revokeObjectURL(u);},[file]);
 const base=size.w&&size.h?Math.max(W/size.w,H/size.h):1;
 const scale=base*zoom;
 const maxX=Math.max(0,(size.w*scale-W)/2),maxY=Math.max(0,(size.h*scale-H)/2);
 const clamp=(x:number,y:number)=>({x:Math.max(-maxX,Math.min(maxX,x)),y:Math.max(-maxY,Math.min(maxY,y))});
 function pointerDown(e:PointerEvent<HTMLDivElement>){if(busy)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y};}
 function pointerMove(e:PointerEvent<HTMLDivElement>){if(!drag.current||!surface.current)return;const rect=surface.current.getBoundingClientRect(),d=drag.current;setOffset(clamp(d.ox+(e.clientX-d.x)*W/rect.width,d.oy+(e.clientY-d.y)*H/rect.height));}
 function pointerUp(){drag.current=null;}
 async function apply(){
  if(!image.current||!size.w||busy)return;
  setBusy(true);setError('');
  try{
   const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Brak obsługi kadrowania.');
   // A blurred full-bleed copy fills exposed edges when zoomed out.\n   ctx.save();ctx.filter='blur(18px) brightness(0.65)';const bgScale=base*1.25;ctx.drawImage(image.current,(W-size.w*bgScale)/2,(H-size.h*bgScale)/2,size.w*bgScale,size.h*bgScale);ctx.restore();
   ctx.drawImage(image.current,(W-size.w*scale)/2+offset.x,(H-size.h*scale)/2+offset.y,size.w*scale,size.h*scale);
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
   canvas.width=0;canvas.height=0;
   if(!blob)throw Error('Nie udało się przygotować kadru.');
   await onApply(new File([blob],'slm-crop.png',{type:'image/png'}));
  }catch(e){setError(e instanceof Error?e.message:'Nie udało się wykadrować zdjęcia.');}
  finally{setBusy(false);}
 }
 return <div className="slm-photo-crop" aria-label="Kadrowanie zdjęcia">
  <h3>Ustaw zdjęcie na karcie</h3>
  <p>Przesuń zdjęcie palcem, przybliż lub oddal, aby pokazać również ramiona. Przy oddaleniu wolne miejsce wypełni rozmyte tło.</p>
  <div ref={surface} className="slm-photo-crop-surface"  onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
   {url&&<img ref={image} src={url} alt="Zdjęcie do kadrowania" draggable={false} onLoad={e=>{const i=e.currentTarget;setSize({w:i.naturalWidth,h:i.naturalHeight});setZoom(INITIAL_ZOOM);setOffset({x:0,y:0});}} style={{width:size.w*scale/W*100+'%',height:size.h*scale/H*100+'%',left:'calc(50% + '+offset.x/W*100+'%)',top:'calc(50% + '+offset.y/H*100+'%)'}}/>}
   <span className="slm-photo-crop-guide" aria-hidden="true"/>
  </div>
  <label htmlFor="slm-photo-crop-zoom">Powiększenie: {zoom.toFixed(2)}×</label>
  <input id="slm-photo-crop-zoom" type="range" min={MIN_ZOOM} max="3" step="0.05" value={zoom} disabled={busy||!size.w} onChange={e=>{const z=Number(e.target.value);const mx=Math.max(0,(size.w*base*z-W)/2),my=Math.max(0,(size.h*base*z-H)/2);setZoom(z);setOffset(p=>({x:Math.max(-mx,Math.min(mx,p.x)),y:Math.max(-my,Math.min(my,p.y))}));}}/>
  {error&&<p role="alert">{error}</p>}
  <div className="slm-identity-actions"><button type="button" disabled={busy||!size.w} onClick={()=>{setZoom(INITIAL_ZOOM);setOffset({x:0,y:0});}}>Wyśrodkuj</button><button type="button" disabled={busy||!size.w} onClick={()=>void apply()}>{busy?'Przetwarzanie…':'Zastosuj kadr'}</button><button type="button" disabled={busy} onClick={onCancel}>Anuluj</button></div>
 </div>;
}

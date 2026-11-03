import { Capacitor } from '@capacitor/core';

// Resize the viewport natively; scroll the actual Ionic scroll container here.
// No keyboard height/padding, user values, storage or navigation are changed.
export function installFocusVisibility(native=Capacitor.isNativePlatform()) {
 if(!native)return ()=>{};
 let frame=0,alive=true;
 async function reveal(){
  const field=document.activeElement;
  if(!(field instanceof HTMLElement)||!field.matches('input:not([type=file]),textarea,select,[contenteditable=true]'))return;
  const content=field.closest('ion-content');
  const scroller=await content?.getScrollElement?.();
  if(!alive||document.activeElement!==field||!scroller)return;
  const rect=field.getBoundingClientRect(),viewport=window.visualViewport;
  const top=Math.max(scroller.getBoundingClientRect().top,viewport?.offsetTop??0)+16;
  const bottom=Math.min(scroller.getBoundingClientRect().bottom,(viewport?.offsetTop??0)+(viewport?.height??window.innerHeight))-16;
  const delta=rect.bottom>bottom?rect.bottom-bottom:rect.top<top?rect.top-top:0;
  if(delta)scroller.scrollTop+=delta;
 }
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{void reveal();});};
 document.addEventListener('focusin',schedule);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
 return()=>{alive=false;cancelAnimationFrame(frame);document.removeEventListener('focusin',schedule);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);};
}

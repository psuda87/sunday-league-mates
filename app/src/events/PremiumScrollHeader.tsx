import { useEffect,useRef,useState } from 'react';
import type { ComponentProps } from 'react';
import { IonButton } from '@ionic/react';
import MatchHeader from '../ui/MatchHeader';
// The decorative logo scrolls away. Only the small title/action bar sticks.
export default function PremiumScrollHeader(props:ComponentProps<typeof MatchHeader>){
 const marker=useRef<HTMLDivElement>(null),[stuck,setStuck]=useState(false);
 useEffect(()=>{
  let observer:IntersectionObserver|undefined,alive=true;
  let scrollRoot:HTMLElement|null=null,previousPadding='';
  const element=marker.current;
  if(!element||typeof IntersectionObserver==='undefined')return;
  const content=element.closest('ion-content');
  void (content?content.getScrollElement():Promise.resolve(null)).then(root=>{
   if(!alive)return;
   if(root){scrollRoot=root;previousPadding=root.style.scrollPaddingTop;root.style.scrollPaddingTop='calc(56px + var(--ion-safe-area-top,0px))';}
   observer=new IntersectionObserver(([entry])=>setStuck(!entry.isIntersecting&&entry.boundingClientRect.top<(entry.rootBounds?.top??0)),{root,threshold:0});observer.observe(element);
  });
  return()=>{alive=false;observer?.disconnect();if(scrollRoot)scrollRoot.style.scrollPaddingTop=previousPadding;};
 },[]);
 return <><MatchHeader {...props}/><div ref={marker} className="slm-scroll-header-marker" aria-hidden="true"/>
  <header className="slm-scroll-header" data-stuck={stuck} aria-hidden={!stuck} inert={!stuck}>
   {props.onBack&&<IonButton fill="clear" aria-label="Wróć do meczów" onClick={props.onBack}>←</IonButton>}
   <strong>{props.title??'Mecze'}</strong>{props.action}
  </header></>;
}

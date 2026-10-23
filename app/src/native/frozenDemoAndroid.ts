import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

type Next=()=>void;
interface BackEvent extends Event {detail:{register:(priority:number,handler:(next:Next)=>void)=>void}}

// Native transport only. Original components own their unchanged state/actions.
export function useFrozenBack(action:()=>boolean,scope:()=>HTMLElement|null,priority=10) {
  const latest=useRef({action,scope});latest.current={action,scope};
  useEffect(()=>{
    const listener=(event:Event)=>(event as BackEvent).detail.register(priority,next=>{
      const element=latest.current.scope();
      if(!element||element.closest('[hidden]')||!latest.current.action())next();
    });
    document.addEventListener('ionBackButton',listener);
    return()=>document.removeEventListener('ionBackButton',listener);
  },[priority]);
}
export function minimizeFrozenDemo(){if(Capacitor.getPlatform()==='android')void App.minimizeApp();}

export function installFrozenAndroid() {
  if(Capacitor.getPlatform()!=='android')return;
  // AppPlugin emits Ionic's document event only when a native listener exists.
  void App.addListener('backButton',()=>{});
  let keyboard=false;
  void Keyboard.addListener('keyboardDidShow',()=>{keyboard=true;});
  void Keyboard.addListener('keyboardDidHide',()=>{keyboard=false;});
  document.addEventListener('ionBackButton',event=>{
    if(keyboard)(event as BackEvent).detail.register(60,()=>{void Keyboard.hide();});
  });
}

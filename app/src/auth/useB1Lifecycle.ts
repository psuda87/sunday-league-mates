import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { SessionManager, SessionState } from './sessionManager';

// Lifecycle extracted from the existing Accounts controller; same server gate.
const alwaysResume=()=>true;
export function useB1Lifecycle(manager:SessionManager,auth:SessionState,mayResume:()=>boolean=alwaysResume){
 useEffect(()=>{if(mayResume())void manager.refresh();},[manager,mayResume]);
 useEffect(()=>{
  const retry=()=>{if(mayResume()&&manager.getSnapshot().phase!=='signed_out')void manager.resume();};
  const visible=()=>{if(document.visibilityState==='visible')retry();};
  const focus=()=>{if(document.visibilityState==='visible')retry();};
  const offline=()=>{manager.suspend();if(manager.getSnapshot().phase!=='signed_out')void manager.refresh();};
  window.addEventListener('focus',focus);
  window.addEventListener('online',retry);window.addEventListener('offline',offline);
  document.addEventListener('visibilitychange',visible);
  const listener=Capacitor.isNativePlatform()?App.addListener('appStateChange',state=>{if(state.isActive)retry();}):null;
  return()=>{window.removeEventListener('focus',focus);window.removeEventListener('online',retry);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',visible);void listener?.then(handle=>handle.remove());};
 },[manager,mayResume]);
 useEffect(()=>{
  if(auth.phase!=='ready'||!auth.session)return;
  const timer=window.setTimeout(()=>{if(mayResume())void manager.refresh(true);},Math.max(5000,(auth.session.expires_in-60)*1000));
  return()=>window.clearTimeout(timer);
 },[manager,auth.phase,auth.session,mayResume]);
}

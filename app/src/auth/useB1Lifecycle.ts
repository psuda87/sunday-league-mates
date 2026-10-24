import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { SessionManager, SessionState } from './sessionManager';

// Lifecycle extracted from the existing Accounts controller; same server gate.
export function useB1Lifecycle(manager:SessionManager,auth:SessionState){
 useEffect(()=>{void manager.refresh();},[manager]);
 useEffect(()=>{
  const retry=()=>{if(manager.getSnapshot().phase!=='signed_out')void manager.refresh();};
  const visible=()=>{if(document.visibilityState==='visible')retry();else manager.suspend();};
  const offline=()=>{if(manager.getSnapshot().phase==='ready')void manager.refresh();};
  window.addEventListener('online',retry);window.addEventListener('offline',offline);
  document.addEventListener('visibilitychange',visible);
  const listener=Capacitor.isNativePlatform()?App.addListener('appStateChange',state=>{if(state.isActive)retry();else manager.suspend();}):null;
  return()=>{window.removeEventListener('online',retry);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',visible);void listener?.then(handle=>handle.remove());};
 },[manager]);
 useEffect(()=>{
  if(auth.phase!=='ready'||!auth.session)return;
  const timer=window.setTimeout(()=>{void manager.refresh();},Math.max(5000,(auth.session.expires_in-60)*1000));
  return()=>window.clearTimeout(timer);
 },[manager,auth.phase,auth.session]);
}

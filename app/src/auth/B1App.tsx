import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import AccountScreens from '../account-ui/AccountScreens';
import type { AccountUiPort, AccountView } from '../account-ui/model';
import WorldApp from '../events/PremiumWorld';
import PremiumGroups from '../groups/PremiumGroups';
import AppearanceSettings from '../ui/AppearanceSettings';
import { useFrozenBack, minimizeFrozenDemo } from '../native/frozenDemoAndroid';
import { SessionManager } from './sessionManager';
import { accountRequest } from './api';
import { tokenStore } from './tokenStore';
import { useOwnProfile } from './useOwnProfile';
import { b1Port } from './b1Port';
import { useB1Lifecycle } from './useB1Lifecycle';
import { installFocusVisibility } from '../native/focusVisibility';
import { consumeEmailCallback,legalDocuments } from './emailCallback';
import { AccountUiFailure,accountMessage } from '../account-ui/model';
import { AccountError } from './api';
import '../demo/palettes.css';
import '../pages/Accounts.css';

export default function B1App({manager:provided}:{manager?:SessionManager}){
 const [manager]=useState(()=>provided??new SessionManager(tokenStore,accountRequest));
 const [callback]=useState(()=>consumeEmailCallback(window.location,window.history));
 const [emailGate,setEmailGate]=useState(!!callback);
 const emailFlow=useRef(!!callback),callbackFlight=useRef<Promise<AccountView>|null>(null);
 const auth=useSyncExternalStore(manager.subscribe,manager.getSnapshot);
 const [picker,setPicker]=useState<{owner:string;done:boolean}|null>(null);
 const [requested,setRequested]=useState<AccountView|null>(null);
 const [pending,setPending]=useState<'login'|'password'|'reset'|null>(null);
 const scope=useRef<HTMLIonContentElement>(null);
 const loggingOut=useRef(false);
 const mayResume=useCallback(()=>!loggingOut.current&&!emailFlow.current,[]);
 useB1Lifecycle(manager,auth,mayResume);
 const ready=auth.phase==='ready'&&!!auth.session;
 const forced=ready&&auth.session!.must_change_password;
 // Preserve RAM navigation only across verification, never across a denied session.
 const continuation=useRef<string|null>(null);
 if(ready&&!forced&&!loggingOut.current)continuation.current=auth.session!.user_id;
 else if(auth.phase!=='checking'||loggingOut.current)continuation.current=null;
 const owner=loggingOut.current||emailGate?null:ready&&!forced?auth.session!.user_id:auth.phase==='checking'?continuation.current:null;
 useEffect(()=>installFocusVisibility(),[]);
 const personalProfile=useOwnProfile(manager,owner,{
  begin:()=>{if(ready&&!forced)setPicker({owner:auth.session!.user_id,done:false});},
  end:()=>setPicker(previous=>previous?{...previous,done:true}:null),
 });
 useEffect(()=>{
  if(picker&&(auth.phase!=='checking'&&(auth.phase!=='ready'||forced||auth.session?.user_id!==picker.owner)||ready&&picker.done))setPicker(null);
 },[auth.phase,auth.session,forced,ready,picker]);
 const signedOutView:AccountView=requested??(auth.message?'expired':'login');
 const view:AccountView|null=emailGate?'checking':pending??(auth.phase==='checking'?'checking':auth.phase==='unavailable'||auth.phase==='storage_error'?'network':forced?'password':ready?requested:signedOutView);
 const legal=useMemo(()=>legalDocuments(import.meta.env.VITE_SLM_TERMS_URL,import.meta.env.VITE_SLM_PRIVACY_URL),[]);
 const base=useMemo(()=>b1Port(manager,{callback,legal}),[manager,callback,legal]);
 useEffect(()=>{
  if(!callback)return;
  if(callback.kind==='proof')callback.tokenHash='';
  let alive=true;
  const flight=callbackFlight.current??(callbackFlight.current=(async():Promise<AccountView>=>{
   try{
    // Drop the previous account before processing a proof for another identity.
    await manager.logout();
    if(callback.kind==='invalid')return 'invalid-link';
    if(callback.intent==='recovery')return 'reset';
    await base.completeRedirect('verify');return 'confirmed';
   }catch(error){return error instanceof AccountUiFailure&&error.kind==='network'?'network':'invalid-link';}
  })());
  void flight.then(next=>{if(alive){setRequested(next);emailFlow.current=manager.getSnapshot().phase!=='signed_out';setEmailGate(false);}});
  return()=>{alive=false;};
 },[manager,callback,base]);
 const port:AccountUiPort={...base,
  async signOut(){loggingOut.current=true;continuation.current=null;setPicker(null);try{await base.signOut();}finally{loggingOut.current=false;}},
  async signIn(identifier,password){base.discardProof();setPending('login');try{await base.signIn(identifier,password);setRequested(null);}finally{setPending(null);}},
  async signUp(profile,email,password){await base.signUp(profile,email,password);setRequested('verify');},
  async updatePassword(password,current){setPending(current?'password':'reset');try{await base.updatePassword(password,current);setRequested(current?null:'password-saved');}finally{setPending(null);}},
  async restoreSession(){
   // A failed callback vault-clear must never refresh the previous account.
   if(emailFlow.current){await manager.logout();base.discardProof();emailFlow.current=false;}
   else await base.restoreSession();
   setRequested(null);
  },
 };
 function navigate(next:AccountView){
  // A callback never grants a session; all successful email flows return to login.
  if(next!=='reset')base.discardProof();
  if(forced){if(next==='login'){setRequested('login');void port.signOut();}return;}
  if(ready){if(next==='login'||next==='password-saved')setRequested(null);return;}
  setRequested(next==='register'||next==='forgot'?next:'login');
 }
 useFrozenBack(()=>{if(!view)return false;if(ready&&!forced)setRequested(null);else if(view==='login'||forced)minimizeFrozenDemo();else navigate('login');return true;},()=>scope.current,15);
 return <>
 {owner&&<div hidden={view!==null} className="slm-demo-world"><WorldApp key={owner} manager={manager} userId={owner} liveAuth personalProfile={personalProfile} groupsView={<PremiumGroups key={owner} manager={manager} userId={owner}/>} onAccount={next=>{if(next==='password')setRequested('password');}} onLogout={()=>{setRequested(null);void port.signOut();}}/></div>}
 {view&&<IonPage className="slm-demo slm-account-page"><IonContent ref={scope}><main className="slm-accounts"><div className="slm-account-shell"><header className="slm-account-brand"><span>SUNDAY LEAGUE MATES</span><img src="/assets/branding/slm-logo-primary-transparent.png" width="450" height="505" alt="Sunday League Mates"/></header>
 <AccountScreens key={view} view={view} port={port} onNavigate={navigate} loginOrPhone legal={legal} messageForError={liveAccountMessage}/>
 <details className="slm-account-appearance"><summary>Wygląd aplikacji</summary><AppearanceSettings enablePalettes/></details>
 </div></main></IonContent></IonPage>}
 </>;
}

function liveAccountMessage(error:unknown){
 if(error instanceof AccountError){
  const messages:Record<string,string>={
   policies_unconfigured:'Rejestracja oczekuje na zatwierdzony regulamin i politykę prywatności.',
   mail_unconfigured:'Rejestracja i odzyskiwanie hasła oczekują na konfigurację poczty.',
   mail_unavailable:'Nie udało się uruchomić procesu e-mail. Spróbuj później.',
   rate_limited:'Zbyt wiele prób. Spróbuj ponownie później.',
   invalid_password:'Auth odrzucił nowe hasło. Wybierz inne i poproś o nowy link.',
   operation_pending:'Nie potwierdzono zakończenia operacji. Nie ponawiaj linku; skontaktuj się z administratorem.',
   verification_required:'Rejestracja wymaga weryfikacji adresu e-mail. Skontaktuj się z administratorem.',
  };
  if(messages[error.code])return messages[error.code];
 }
 return accountMessage(error);
}

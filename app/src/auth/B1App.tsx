import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import AccountScreens from '../account-ui/AccountScreens';
import type { AccountUiPort, AccountView } from '../account-ui/model';
import WorldApp from '../demo/App';
import AppearanceSettings from '../ui/AppearanceSettings';
import { useFrozenBack, minimizeFrozenDemo } from '../native/frozenDemoAndroid';
import { SessionManager } from './sessionManager';
import { accountRequest } from './api';
import { tokenStore } from './tokenStore';
import { useOwnProfile } from './useOwnProfile';
import { b1Port } from './b1Port';
import { useB1Lifecycle } from './useB1Lifecycle';
import '../demo/palettes.css';
import '../pages/Accounts.css';

export default function B1App({manager:provided}:{manager?:SessionManager}){
 const [manager]=useState(()=>provided??new SessionManager(tokenStore,accountRequest));
 const auth=useSyncExternalStore(manager.subscribe,manager.getSnapshot);
 const [requested,setRequested]=useState<AccountView|null>(null);
 const [pending,setPending]=useState<'login'|'password'|null>(null);
 const scope=useRef<HTMLIonContentElement>(null);
 useB1Lifecycle(manager,auth);
 const ready=auth.phase==='ready'&&!!auth.session;
 const forced=ready&&auth.session!.must_change_password;
 const personalProfile=useOwnProfile(manager,ready&&!forced?auth.session!.user_id:null);
 const view:AccountView|null=pending??(auth.phase==='checking'?'checking':auth.phase==='unavailable'||auth.phase==='storage_error'?'network':forced?'password':ready?requested:requested==='login'?'login':auth.message||requested==='expired'?'expired':requested==='register'||requested==='forgot'?requested:'login');
 const base=useMemo(()=>b1Port(manager),[manager]);
 const port:AccountUiPort={...base,
  async signIn(identifier,password){setPending('login');try{await base.signIn(identifier,password);setRequested(null);}finally{setPending(null);}},
  async updatePassword(password,current){setPending('password');try{await base.updatePassword(password,current);setRequested(null);}finally{setPending(null);}},
 };
 function navigate(next:AccountView){
  // No simulator, callback URL, registration or recovery can grant access.
  if(forced){if(next==='login'){setRequested('login');void base.signOut();}return;}
  if(ready){if(next==='login'||next==='password-saved')setRequested(null);return;}
  setRequested(next==='register'||next==='forgot'?next:'login');
 }
 useFrozenBack(()=>{if(!view)return false;if(ready&&!forced)setRequested(null);else if(view==='login'||forced)minimizeFrozenDemo();else navigate('login');return true;},()=>scope.current,15);
 return <>
 {ready&&!forced&&<div hidden={view!==null} className="slm-demo-world"><WorldApp liveAuth personalProfile={personalProfile} onAccount={next=>{if(next==='password')setRequested('password');}} onLogout={()=>{setRequested(null);void port.signOut();}}/></div>}
 {view&&<IonPage className="slm-demo slm-account-page"><IonContent ref={scope}><main className="slm-accounts"><div className="slm-account-shell"><header className="slm-account-brand"><span>SUNDAY LEAGUE MATES</span><img src="/assets/branding/slm-logo-primary-transparent.png" width="450" height="505" alt="Sunday League Mates"/></header>
 <AccountScreens key={view} view={view} port={port} onNavigate={navigate} loginOrPhone/>
 <details className="slm-account-appearance"><summary>Wygląd demonstracji</summary><AppearanceSettings enablePalettes/></details>
 </div></main></IonContent></IonPage>}
 </>;
}

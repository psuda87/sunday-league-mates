import { accountPlayer } from './accountState';
import { useEffect, useRef, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import AccountScreens from '../account-ui/AccountScreens';
import { AccountUiFailure, accountRoute, emptyProfile } from '../account-ui/model';
import type { AccountUiPort, AccountView, ProfileDraft } from '../account-ui/model';
import AppearanceSettings from '../ui/AppearanceSettings';
import WorldApp from './App';
import { demoPortraits } from './portraits';
import type { DemoPlayer } from './data';
import './palettes.css';
import '../pages/Accounts.css';
type View=AccountView|'browse';
export default function AccountDemo() {
 const initial=accountRoute(window.location.hash);
 const accountContent=useRef<HTMLIonContentElement>(null);
 const [view,setView]=useState<View>(initial??'browse'),[authorized,setAuthorized]=useState(!initial);
 const [seed,setSeed]=useState<DemoPlayer>(),[draft,setDraft]=useState<ProfileDraft>(emptyProfile),[outcome,setOutcome]=useState('success'),[actor,setActor]=useState('fixture');
 const pending=useRef<ProfileDraft|null>(null),verified=useRef(false),recovery=useRef(false),epoch=useRef(0),[returnTab,setReturnTab]=useState<'events'|'groups'|'profile'>('events');
 const show=(next:View)=>{setView(next);window.history.replaceState(null,'',next==='browse'?'#home':`#account/${next}`);};
 function leave(next:AccountView='login'){epoch.current++;setAuthorized(false);setSeed(undefined);pending.current=null;verified.current=false;recovery.current=false;setDraft(emptyProfile());show(next);}
 function navigate(next:AccountView){if(next==='first-profile'&&!verified.current){show('invalid-link');return;}if(next==='login'){leave();return;}epoch.current++;show(next);}
 async function wait(){const ticket=epoch.current;await new Promise(resolve=>setTimeout(resolve,280));if(ticket!==epoch.current)throw new AccountUiFailure('link');if(outcome==='network')throw new AccountUiFailure('network');if(outcome==='unavailable')throw new AccountUiFailure('integration');}
 const port:AccountUiPort={
  async signIn(){await wait();if(outcome==='credentials')throw new AccountUiFailure('credentials');if(outcome==='pending'){pending.current=emptyProfile();setDraft(emptyProfile());show('verify');return;}if(actor==='new'){pending.current={...emptyProfile(),nickname:'Nowy zawodnik'};verified.current=true;setDraft(pending.current);show('first-profile');return;}setSeed(undefined);setAuthorized(true);show('browse');},
  async signUp(profile){await wait();pending.current={...profile};setDraft({...profile});verified.current=false;show('verify');},
  async signOut(){leave('signing-out');const ticket=epoch.current;await new Promise(resolve=>setTimeout(resolve,280));if(ticket===epoch.current)show('login');},
  async resendVerification(){await wait();},
  async requestPasswordReset(){await wait();},
  async updatePassword(){if(!authorized&&!recovery.current)throw new AccountUiFailure('link');await wait();recovery.current=false;show('password-saved');},
  async restoreSession(){setAuthorized(false);show('checking');try{await wait();leave();}catch(error){if(error instanceof AccountUiFailure&&error.kind==='network')show('network');else throw error;}},
  async completeRedirect(intent){await wait();if(intent==='recovery'){recovery.current=true;show('reset');}else{verified.current=true;if(!pending.current)pending.current={...emptyProfile(),nickname:'Nowy zawodnik'};setDraft(pending.current);show('confirmed');}},
  async saveProfile(profile){if(!verified.current)throw new AccountUiFailure('link');await wait();setSeed(accountPlayer(profile));pending.current=null;setDraft(emptyProfile());verified.current=false;setReturnTab('events');setAuthorized(true);show('browse');},
 };
 useEffect(()=>{const changed=()=>{const route=accountRoute(window.location.hash);if(route){epoch.current++;setAuthorized(false);setSeed(undefined);setView(route);recovery.current=false;verified.current=false;pending.current=null;setDraft(emptyProfile());}};window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{accountContent.current?.querySelectorAll<HTMLDetailsElement>('.slm-account-simulator,.slm-account-appearance').forEach(panel=>{panel.open=false;});void accountContent.current?.scrollToTop(0);});return()=>cancelAnimationFrame(frame);},[view]);
 async function simulatedLink(intent:'verify'|'recovery'){try{await port.completeRedirect(intent);}catch{show(outcome==='network'?'network':'invalid-link');}}
 return <>{authorized&&<div hidden={view!=='browse'} className="slm-demo-world"><WorldApp key={seed?.id??'fixture'} initialPlayer={seed} initialTab={returnTab} onAccount={(next,tab)=>{setReturnTab(tab);if(next==='password')show('password');else leave(next);}} onLogout={()=>{void port.signOut();}}/></div>}
 {view!=='browse'&&<IonPage className="slm-demo slm-account-page"><IonContent ref={accountContent}><main className="slm-accounts"><div className="slm-account-shell"><header className="slm-account-brand"><span>SUNDAY LEAGUE MATES</span><img src="/assets/branding/slm-logo-primary-transparent.png" width="450" height="505" alt="Sunday League Mates"/></header>
 <AccountScreens key={view} view={view} port={port} onNavigate={navigate} profile={draft} portraits={demoPortraits} demo/>
 <details className="slm-account-appearance"><summary>Wygląd demonstracji</summary><AppearanceSettings enablePalettes/></details>
 <details className="slm-account-simulator"><summary>Symulator stanów konta</summary><p>To nie jest logowanie produkcyjne. Formularze nie sprawdzają haseł, nie tworzą kont, nie wysyłają poczty i nie utrwalają sesji. Używaj tylko fikcyjnych danych.</p><label htmlFor="account-outcome">Wynik następnej operacji<select id="account-outcome" value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="success">Sukces demonstracyjny</option><option value="credentials">Błędne dane · logowanie</option><option value="network">Błąd sieci</option><option value="pending">Oczekiwanie na e-mail · logowanie</option><option value="unavailable">Brak integracji Auth</option></select></label><label htmlFor="account-actor">Użytkownik po symulacji logowania<select id="account-actor" value={actor} onChange={e=>setActor(e.target.value)}><option value="fixture">Istniejący zawodnik fikcyjny</option><option value="new">Nowy zawodnik bez grupy</option></select></label><div><button type="button" onClick={()=>{leave('checking');}}>Sprawdzanie sesji</button><button type="button" onClick={()=>leave('expired')}>Sesja wygasła</button><button type="button" onClick={()=>leave('network')}>Błąd sieci</button><button type="button" onClick={()=>{void simulatedLink('verify');}}>Symuluj poprawny link e-mail</button><button type="button" onClick={()=>{void simulatedLink('recovery');}}>Symuluj poprawny link resetujący</button><button type="button" onClick={()=>{recovery.current=false;verified.current=false;epoch.current++;show('invalid-link');}}>Symuluj wygasły link</button><button type="button" onClick={()=>{leave();setAuthorized(true);show('browse');}}>Otwórz podgląd fikcyjnych danych</button></div></details>
 <p className="slm-account-demo-note">Domyślny podgląd demo nie jest trwałą sesją serwerową. Wyjście z symulatora usuwa widoki i operacje prywatne z bieżącego stanu. Preferencje wyglądu pozostają lokalnie.</p>
 </div></main></IonContent></IonPage>}</>;
}

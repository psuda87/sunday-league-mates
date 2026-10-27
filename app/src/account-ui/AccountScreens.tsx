import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { IonSpinner } from '@ionic/react';
import { AccountHeading, PasswordField, SignInFields, TextField } from './Fields';
import { accountMessage, nicknameProblem, emailProblem, emptyProfile, normalizeEmail, passwordProblem, profileProblems } from './model';
import type { AccountUiPort, AccountView, ProfileDraft } from './model';
import UltimatePlayerCard from '../ui/UltimatePlayerCard';
import type { CardPortrait } from '../ui/UltimatePlayerCard';
export default function AccountScreens({view,port,onNavigate,profile=emptyProfile(),portraits=[],demo=false,loginOrPhone=false,nicknameModel=false}:{view:AccountView;port:AccountUiPort;onNavigate:(view:AccountView)=>void;profile?:ProfileDraft;portraits?:CardPortrait[];demo?:boolean;loginOrPhone?:boolean;nicknameModel?:boolean}) {
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[current,setCurrent]=useState('');
 const [draft,setDraft]=useState(profile),[number,setNumber]=useState(profile.jerseyNumber===undefined?'':String(profile.jerseyNumber)),[consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false),[errors,setErrors]=useState<string[]>([]),[notice,setNotice]=useState(''),[cooldown,setCooldown]=useState(0);
 const flight=useRef(false),alive=useRef(true),errorBox=useRef<HTMLDivElement>(null),heading=useRef<HTMLElement>(null);
 useEffect(()=>{alive.current=true;const title=heading.current?.querySelector<HTMLElement>('h1');title?.setAttribute('tabindex','-1');title?.focus({preventScroll:true});return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!cooldown)return;const timer=window.setTimeout(()=>setCooldown(v=>Math.max(0,v-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
 async function work(operation:()=>Promise<void>,success?:string) {
  if(flight.current)return;flight.current=true;setBusy(true);setErrors([]);setNotice('');
  try{await operation();if(alive.current&&success)setNotice(success);}catch(error){if(alive.current){setErrors([accountMessage(error)]);requestAnimationFrame(()=>errorBox.current?.focus());}}
  finally{setPassword('');setConfirmation('');setCurrent('');flight.current=false;if(alive.current)setBusy(false);}
 }
 const profileValue=()=>({...draft,nickname:draft.nickname.trim(),fullName:draft.fullName.trim(),jerseyNumber:number===''?undefined:Number(number)});
 function submit(event:FormEvent){event.preventDefault();if(flight.current)return;
  const problems:string[]=[];
  if(view==='login'&&(loginOrPhone||nicknameModel)&&!email.trim())problems.push(nicknameModel?'Podaj pseudonim lub e-mail.':'Podaj login lub numer telefonu.');
  if((view==='login'&&!loginOrPhone&&!nicknameModel)||(view==='register'&&(!nicknameModel||!!email.trim()))||view==='forgot')problems.push(...[emailProblem(email)].filter(Boolean));
  if(view==='login'&&!password)problems.push('Podaj hasło.');
  if(['register','reset','password'].includes(view)){const problem=passwordProblem(password);if(problem)problems.push(problem);if(password!==confirmation)problems.push('Hasła muszą być takie same.');}
  if(view==='register'||view==='first-profile')problems.push(...profileProblems(profileValue()));
  if(nicknameModel&&view==='register')problems.push(...[nicknameProblem(draft.nickname)].filter(Boolean));
  if(view==='register'&&!consent)problems.push('Akceptacja regulaminu i polityki prywatności jest wymagana.');
  if(view==='password'&&!current)problems.push('Podaj obecne hasło.');
  if(problems.length){setErrors(problems);requestAnimationFrame(()=>errorBox.current?.focus());return;}
  if(view==='login')void work(()=>port.signIn((loginOrPhone||nicknameModel)?email.trim():normalizeEmail(email),password));
  if(view==='register')void work(()=>port.signUp(profileValue(),normalizeEmail(email),password));
  if(view==='forgot')void work(()=>port.requestPasswordReset(normalizeEmail(email)),demo?'Symulacja: jeśli konto kwalifikuje się do odzyskania, Auth wysłałby instrukcję. W demo nie wysyłamy wiadomości.':'Jeśli konto kwalifikuje się do odzyskania, otrzymasz instrukcję. Sprawdź skrzynkę i spam.');
  if(view==='reset'||view==='password')void work(()=>port.updatePassword(password,view==='password'?current:undefined));
  if(view==='first-profile')void work(()=>port.saveProfile(profileValue()));
 }
 const titles:Record<AccountView,string>={login:'Zaloguj się',register:'Dołącz do SLM',verify:'Potwierdź e-mail',confirmed:'E-mail potwierdzony',forgot:'Nie pamiętasz hasła?',reset:'Ustaw nowe hasło',password:'Zmień hasło','password-saved':'Zmiana hasła', 'first-profile':'Twoja karta zawodnika',checking:'Sprawdzanie sesji',expired:'Sesja wygasła',network:'Brak połączenia','signing-out':'Wylogowywanie','invalid-link':'Link niedostępny'};
 const submitLabels:Partial<Record<AccountView,string>>={login:'Zaloguj',register:'Zarejestruj się',forgot:'Wyślij link resetujący',reset:'Zapisz nowe hasło',password:'Zmień hasło','first-profile':'Zapisz profil'};
 const change=(key:keyof ProfileDraft,value:string)=>setDraft(v=>({...v,[key]:value}));
 const profileFields=<><TextField id="account-nickname" label="Nazwa zawodnika / pseudonim" value={draft.nickname} onChange={v=>change('nickname',v)} maxLength={48}/><TextField id="account-fullname" label="Imię i nazwisko · opcjonalnie" value={draft.fullName} onChange={v=>change('fullName',v)} maxLength={100}/>{view==='register'&&<TextField id="account-phone" label="Telefon · opcjonalnie" value={draft.phone} onChange={v=>change('phone',v)} inputMode="tel" autoComplete="tel" maxLength={24}/>}{(!nicknameModel||view!=='register')&&<TextField id="account-number" label="Numer koszulki · opcjonalnie (0–99)" value={number} onChange={setNumber} inputMode="numeric" maxLength={2}/>}</>;
 return <section ref={heading} className="slm-account-panel" aria-label={titles[view]}><AccountHeading title={titles[view]}/>{demo&&<p className="slm-account-demo-note">Symulator kont · bez Auth, wysyłania e-maili i zapisu haseł</p>}
  {errors.length>0&&<div className="slm-account-error" role="alert" ref={errorBox} tabIndex={-1}><strong>Sprawdź dane</strong><ul>{errors.map(message=><li key={message}>{message}</li>)}</ul></div>}
  {notice&&<p className="slm-notice" role="status">{notice}</p>}
  {busy&&<p role="status"><IonSpinner/> Trwa operacja…</p>}
  {view==='first-profile'&&<div className="slm-account-profile-preview slm-ultimate-profile"><UltimatePlayerCard name={draft.nickname.trim()||'Nowy zawodnik'} jerseyNumber={number!==''&&/^\d{1,2}$/.test(number)?Number(number):undefined} portrait={draft.portrait}/><dl className="slm-ultimate-stats">{['Mecze','Gole','Asysty','MVP'].map(label=><div key={label}><dt>{label}</dt><dd>0</dd></div>)}</dl><p>Gwiazdki są dekoracją. Zdjęcie i numer są opcjonalne; nie należysz jeszcze do żadnej grupy.</p></div>}
  {submitLabels[view]&&<form noValidate onSubmit={submit} aria-label={titles[view]} aria-busy={busy}>
   {view==='login'?<SignInFields loginOrPhone={loginOrPhone} nicknameModel={nicknameModel} identifier={email} password={password} onIdentifier={setEmail} onPassword={setPassword}/>:<>
    {(view==='register'||view==='first-profile')&&profileFields}
    {(view==='register'||view==='forgot')&&<TextField id="account-email" label={nicknameModel&&view==='register'?"Adres e-mail · opcjonalnie":"Adres e-mail"} type="email" autoComplete="email" inputMode="email" value={email} onChange={setEmail} maxLength={254}/>}
    {view==='password'&&<PasswordField label="Obecne hasło" value={current} onChange={setCurrent}/>}
    {['register','reset','password'].includes(view)&&<><PasswordField label={view==='register'?'Hasło':'Nowe hasło'} value={password} onChange={setPassword} newPassword/><PasswordField label={view==='register'?'Powtórz hasło':'Powtórz nowe hasło'} value={confirmation} onChange={setConfirmation} newPassword/><p className="slm-muted">Minimum 8 znaków, maksimum 72 bajty UTF-8. Użyj unikalnego hasła.</p></>}
   </>}
   {view==='register'&&<><details className="slm-account-policies"><summary>Regulamin i polityka prywatności · podgląd</summary><p>{demo?'Demonstracja nie tworzy kont i nie wysyła danych. Nie wpisuj prawdziwych danych.':'Dokumenty wymagają zatwierdzenia przed publicznym uruchomieniem rejestracji. Ten wariant nie jest jeszcze udostępniony użytkownikom.'}</p></details><label className="slm-account-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{demo?'Akceptuję regulamin i politykę prywatności · wersja demonstracyjna':'Akceptuję regulamin i politykę prywatności'}</span></label></>}
   {view==='first-profile'&&<div className="slm-account-portraits" role="group" aria-label="Opcjonalne zdjęcie demonstracyjne"><button type="button" aria-pressed={!draft.portrait} onClick={()=>setDraft(v=>({...v,portrait:undefined}))}>Bez zdjęcia</button>{portraits.map((portrait,i)=><button type="button" key={i} aria-pressed={draft.portrait===portrait} onClick={()=>setDraft(v=>({...v,portrait}))}>Portret {i+1} · demo</button>)}</div>}
   <button className="slm-account-primary" type="submit" disabled={busy}>{submitLabels[view]}</button>
  </form>}
  {view==='login'&&<div className="slm-account-actions"><button type="button" disabled={busy} onClick={()=>onNavigate('register')}>Nie masz konta? Zarejestruj się</button><button type="button" disabled={busy} onClick={()=>onNavigate('forgot')}>Nie pamiętasz hasła?</button></div>}
  {view==='verify'&&<><p>{demo?'Symulacja etapu wysłania wiadomości. Żadna wiadomość nie została wysłana.':'Sprawdź wiadomość potwierdzającą adres e-mail.'} Zajrzyj także do folderu spam.</p><button type="button" disabled={busy||cooldown>0} onClick={()=>void work(async()=>{await port.resendVerification();if(alive.current)setCooldown(30);},demo?'Symulacja ponowienia. Nie wysłano wiadomości.':'Jeśli można ponowić wysyłkę, otrzymasz wiadomość.')}>{cooldown?`Ponów za ${cooldown} s`:'Wyślij ponownie'}</button></>}
  {view==='confirmed'&&<><p>{demo?'Wynik demonstracyjny: adres został oznaczony jako potwierdzony przez symulator.':'Adres potwierdzony przez Auth.'}</p><button className="slm-account-primary" type="button" onClick={()=>onNavigate('first-profile')}>Uzupełnij profil</button></>}
  {view==='password-saved'&&<><p role="status">{demo?'Symulacja zakończona. Prawdziwe hasło nie zostało zmienione.':'Auth potwierdził zmianę hasła.'}</p><button type="button" onClick={()=>onNavigate('login')}>Wróć do logowania</button></>}
  {view==='invalid-link'&&<><p role="alert">Link jest nieprawidłowy, wygasł albo nie został jeszcze zweryfikowany przez Auth. Sam adres strony nie potwierdza tożsamości.</p><button type="button" onClick={()=>onNavigate('forgot')}>Poproś o nowy link resetujący</button></>}
  {(view==='checking'||view==='signing-out')&&<p role="status"><IonSpinner/> {view==='checking'?'Chronione widoki są ukryte do sprawdzenia sesji.':'Czyszczenie widoków konta…'}</p>}{view==='checking'&&<button type="button" disabled={busy} onClick={()=>void work(port.restoreSession)}>Sprawdź sesję</button>}
  {view==='network'&&<><p role="alert">Nie można potwierdzić dostępu. Chronione widoki pozostają ukryte.</p><button type="button" disabled={busy} onClick={()=>void work(port.restoreSession)}>Spróbuj ponownie</button></>}
  {view==='expired'&&<p role="status">Sesja wygasła. Zaloguj się ponownie; poprzednie widoki zostały usunięte.</p>}
  {!['login','checking','signing-out','confirmed','password-saved'].includes(view)&&<div className="slm-account-actions"><button type="button" disabled={busy} onClick={()=>onNavigate('login')}>Wróć do logowania</button></div>}
 </section>;
}

import {useRef,useState} from 'react';
import type {PersonalProfileBinding} from '../ui/personalProfile';
export default function EmailSettings({binding}:{binding:PersonalProfileBinding}){
 const p=binding.profile!,[email,setEmail]=useState(p.email_pending?.target_email??p.email_login??''),[password,setPassword]=useState(''),[notice,setNotice]=useState('');
 const flight=useRef(false),request=useRef(crypto.randomUUID());
 async function send(){if(flight.current||binding.saving||!binding.requestEmail)return;if(!password||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setNotice('Podaj poprawny e-mail i obecne hasło.');return;}
  flight.current=true;const proof=password;setPassword('');try{const ok=await binding.requestEmail(email,proof,request.current);setNotice(ok?'Żądanie przyjęte. Adres pozostaje niepotwierdzony do użycia linku; ponowienie możliwe po minucie.':'Nie potwierdzono żądania. Sprawdź hasło, adres i dostępność wysyłki.');if(ok)request.current=crypto.randomUUID();}finally{flight.current=false;}}
 return <section className="slm-premium-identity" aria-label="E-mail konta" onKeyDown={e=>{if(e.key==='Enter'&&e.target instanceof HTMLInputElement){e.preventDefault();void send();}}}><h3>E-mail · opcjonalnie</h3>
 <p>Potwierdzony adres: {p.email_login??'brak'}. Telefon nie służy do odzyskiwania hasła.</p>
 {p.email_pending&&<p role="status">Oczekuje: {p.email_pending.target_email}. {p.email_pending.delivery==='failed'?'Nie potwierdzono wysyłki. Ponów później.':'Potwierdź własność przez link w wiadomości.'}</p>}
 <label>Nowy adres e-mail<input type="email" autoComplete="email" value={email} disabled={binding.saving||!p.email_enabled} onChange={e=>{setEmail(e.target.value);request.current=crypto.randomUUID();}}/></label>
 <label>Obecne hasło do zmiany e-maila<input type="password" autoComplete="current-password" value={password} disabled={binding.saving||!p.email_enabled} onChange={e=>setPassword(e.target.value)}/></label>
 {!p.email_enabled&&<p>Wysyłka wiadomości nie jest jeszcze uruchomiona.</p>}
 <div className="slm-identity-actions"><button type="button" disabled={binding.saving||!p.email_enabled} onClick={()=>void send()}>{p.email_pending?'Wyślij ponownie':'Wyślij link potwierdzający'}</button><button type="button" disabled={binding.saving} onClick={binding.reload}>Odśwież status e-maila</button></div>
 {notice&&<p role="status">{notice}</p>}</section>;
}

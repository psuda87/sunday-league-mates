import {useRef,useState} from 'react';
import {accountRequest,AccountError} from './api';
import {PasswordField,AccountHeading,TextField} from '../account-ui/Fields';
import {passwordProblem} from '../account-ui/model';
import type {EmailProof} from './emailProof';
export default function EmailCallback({initial,request=accountRequest}:{initial:EmailProof|null;request?:typeof accountRequest}){
 const proof=useRef(initial),flight=useRef(false),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[notice,setNotice]=useState(initial?'':'Link jest nieprawidłowy albo wygasł.'),[password,setPassword]=useState(''),[repeat,setRepeat]=useState(''),[email,setEmail]=useState('');
 const recovery=initial?.kind==='recovery';
 async function complete(){if(flight.current||!proof.current)return;const p=proof.current;if(recovery&&(passwordProblem(password)||password!==repeat)){setNotice(passwordProblem(password)||'Hasła muszą być takie same.');return;}
  flight.current=true;setBusy(true);const next=password;setPassword('');setRepeat('');
  try{await request(recovery?'model_recovery_complete':'model_email_confirm',{id:p.id,token:p.token,...(recovery?{new_password:next}:{})});proof.current=null;setDone(true);setNotice(recovery?'Hasło zostało zmienione. Zaloguj się pseudonimem lub potwierdzonym e-mailem.':'Adres e-mail został potwierdzony. Możesz używać go do logowania.');}
  catch(error){if(error instanceof AccountError&&['link_invalid','email_taken'].includes(error.code)){proof.current=null;setNotice('Link jest wykorzystany, wygasł albo adres nie jest dostępny. Poproś o nowy.');}else setNotice('Nie potwierdzono operacji. Jeśli trwa zmiana hasła, odczekaj kilka minut i ponów tym samym linkiem.');}
  finally{flight.current=false;setBusy(false);}}
 async function resend(){if(flight.current)return;flight.current=true;setBusy(true);try{await request('model_recovery_request',{email});setNotice('Jeśli adres jest potwierdzony i konto kwalifikuje się do odzyskania, otrzymasz wiadomość.');}catch{setNotice('Nie można teraz przyjąć żądania. Spróbuj później.');}finally{flight.current=false;setBusy(false);}}
 return <section className="slm-account-panel" aria-label="Obsługa linku e-mail"><AccountHeading title={recovery?'Ustaw nowe hasło':'Potwierdź adres e-mail'}/>
 {!done&&proof.current&&<><p>{recovery?'Ustaw nowe hasło wyłącznie do swojego konta SLM.':'Potwierdź adres wyłącznie, jeśli prosiłeś o dodanie go do swojego konta SLM.'}</p>{recovery&&<><PasswordField label="Nowe hasło" value={password} onChange={setPassword} newPassword/><PasswordField label="Powtórz nowe hasło" value={repeat} onChange={setRepeat} newPassword/></>}
 <button className="slm-account-primary" type="button" disabled={busy} onClick={()=>void complete()}>{recovery?'Zapisz nowe hasło':'Potwierdź adres'}</button></>}
 {notice&&<p role="status">{notice}</p>}
 {!done&&!proof.current&&recovery&&<><TextField label="Potwierdzony adres e-mail" value={email} onChange={setEmail} type="email"/><button type="button" disabled={busy} onClick={()=>void resend()}>Poproś o nowy link</button></>}
 <p><a href="/">Wróć do aplikacji</a></p><p>Potwierdzenie adresu nie loguje do aplikacji. Po zmianie hasła zaloguj się ponownie.</p>
 </section>;
}

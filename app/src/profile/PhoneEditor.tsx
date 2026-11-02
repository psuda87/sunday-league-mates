import { useRef,useState } from 'react';
import { normalizePhoneUpdate,PHONE_ERROR } from '../../supabase/functions/_shared/phone';
import type { PersonalProfileBinding } from '../ui/personalProfile';
export default function PhoneEditor({binding,onClose}:{binding:PersonalProfileBinding;onClose:()=>void}){
 const profile=binding.profile!;
 const [phone,setPhone]=useState(profile.phone),[password,setPassword]=useState(''),[error,setError]=useState('');
 const flight=useRef(false);
 return <form className="slm-identity-editor slm-premium-identity" aria-label="Zmiana telefonu" noValidate onSubmit={async e=>{
  e.preventDefault();if(flight.current||binding.saving)return;
  let normalized:string;
  try{normalized=phone.trim()===''&&profile.email_account===true?'':normalizePhoneUpdate(phone,profile.phone);}catch{setError(PHONE_ERROR);return;}
  if(normalized===profile.phone){setError('Numer nie został zmieniony.');return;}
  if(!password){setError('Potwierdź zmianę obecnym hasłem.');return;}
  flight.current=true;const proof=password;setPassword('');setError('');
  try{if(await binding.changePhone?.(normalized,proof))onClose();else setError('Nie potwierdzono zmiany. Sprawdź hasło, dostępność numeru i ponów odczyt profilu.');}
  catch{setError('Nie potwierdzono zmiany. Ponów odczyt profilu.');}
  finally{flight.current=false;}
 }}>
  <h2>Numer telefonu</h2>
  <p>{profile.email_account===false?'Numer jest także identyfikatorem logowania. Zmiana wymaga obecnego hasła i potwierdzenia nowej sesji.':'Opcjonalny numer kontaktowy. Logowanie e-mailem pozostaje bez zmian; zmiana numeru wymaga obecnego hasła.'}</p>
  <label>Telefon<input type="tel" autoComplete="tel" maxLength={32} value={phone} disabled={binding.saving} onChange={e=>{setPhone(e.target.value);setError('');}}/></label>
  <p>9 cyfr, także z prefiksem +48 lub 0048.</p>
  <label>Obecne hasło do zmiany telefonu<input type="password" autoComplete="current-password" maxLength={128} value={password} disabled={binding.saving} onChange={e=>setPassword(e.target.value)}/></label>
  {error&&<p role="alert">{error}</p>}
  <div className="slm-identity-actions"><button type="submit" disabled={binding.saving}>Zmień telefon</button><button type="button" disabled={binding.saving} onClick={onClose}>Anuluj zmianę telefonu</button></div>
 </form>;
}

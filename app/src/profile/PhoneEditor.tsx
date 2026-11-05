import { useRef,useState } from 'react';
import { normalizePhoneUpdate,PHONE_ERROR } from '../../supabase/functions/_shared/phone';
import type { PersonalProfileBinding } from '../ui/personalProfile';
export default function PhoneEditor({binding,onClose}:{binding:PersonalProfileBinding;onClose:()=>void}){
 const profile=binding.profile!;
 const [phone,setPhone]=useState(profile.phone),[password,setPassword]=useState(''),[error,setError]=useState('');
 const [share,setShare]=useState(profile.share_phone===true);
 const flight=useRef(false);
 return <form className="slm-identity-editor slm-premium-identity" aria-label="Zmiana telefonu" noValidate onSubmit={async e=>{
  e.preventDefault();if(flight.current||binding.saving)return;
  let normalized:string;
  try{normalized=phone.trim()===''?'':normalizePhoneUpdate(phone,profile.phone);}catch{setError(PHONE_ERROR);return;}
  if(normalized===profile.phone&&share===(profile.share_phone===true)){setError('Numer i widoczność nie zostały zmienione.');return;}
  if(!password){setError('Potwierdź zmianę obecnym hasłem.');return;}
  flight.current=true;const proof=password;setPassword('');setError('');
  try{if(await binding.changePhone?.(normalized,proof,share&&normalized!==''))onClose();else setError('Nie potwierdzono zmiany. Sprawdź hasło, dostępność numeru i ponów odczyt profilu.');}
  catch{setError('Nie potwierdzono zmiany. Ponów odczyt profilu.');}
  finally{flight.current=false;}
 }}>
  <h2>Numer telefonu</h2>
  <p>Numer jest opcjonalny i domyślnie prywatny. Puste pole usuwa numer. {profile.email_account===false?'Po usunięciu numeru nadal możesz logować się swoim loginem; usunięty numer przestanie służyć do logowania.':'Logowanie e-mailem pozostaje bez zmian.'}</p>
  <label>Telefon<input type="tel" autoComplete="tel" maxLength={32} value={phone} disabled={binding.saving} onChange={e=>{setPhone(e.target.value);setError('');}}/></label>
  <p>9 cyfr, także z prefiksem +48 lub 0048.</p>
  <label><input type="checkbox" checked={share} disabled={binding.saving} onChange={e=>setShare(e.target.checked)}/>Udostępniaj mój numer telefonu członkom moich grup</label>
  <p>Dotyczy wyłącznie aktualnych członków wspólnych aktywnych grup. Wyłączenie lub usunięcie numeru blokuje jego kolejne odczyty; nie usuwa kopii wcześniej zapisanych przez odbiorców.</p>
  <label>Obecne hasło do zmiany telefonu<input type="password" autoComplete="current-password" maxLength={128} value={password} disabled={binding.saving} onChange={e=>setPassword(e.target.value)}/></label>
  {error&&<p role="alert">{error}</p>}
  <div className="slm-identity-actions"><button type="submit" disabled={binding.saving}>Zmień telefon</button><button type="button" disabled={binding.saving} onClick={onClose}>Anuluj zmianę telefonu</button></div>
 </form>;
}

export function AccountDeletion({binding}:{binding:PersonalProfileBinding}){
 const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
 const flight=useRef(false),ticket=useRef<{operation_id:string;proof:string}|null>(null);
 if(!binding.deleteAccount)return null;
 if(!open)return <button type="button" onClick={()=>setOpen(true)}>Usuń konto</button>;
 return <form className="slm-identity-editor slm-premium-identity" aria-label="Usuwanie konta" onSubmit={async e=>{
  e.preventDefault();if(flight.current)return;setError('');
  if(!pending&&(!password||confirmation!=='USUŃ KONTO')){setError('Podaj obecne hasło i wpisz USUŃ KONTO.');return;}
  if(!ticket.current)ticket.current={operation_id:crypto.randomUUID(),proof:Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('')};
  flight.current=true;setBusy(true);const proof=password;setPassword('');
  try{await binding.deleteAccount!(proof,confirmation,ticket.current,pending);}
  catch(ex){
   const code=ex instanceof Error&&'code' in ex&&typeof ex.code==='string'?ex.code:'';
   if(['group_transfer_required','invalid_credentials','deletion_confirmation','deletion_invalid'].includes(code)){
    setPending(false);setError(code==='group_transfer_required'?'Przekaż administratora grupy innemu aktywnemu członkowi w ustawieniach grupy i spróbuj ponownie.':code==='deletion_invalid'?'Operacja nie została rozpoczęta. Potwierdź ją ponownie hasłem.':'Sprawdź hasło i potwierdzenie.');
   }else{setPending(true);setError('Nie potwierdzono zakończenia usuwania. Konto może już być zablokowane. Ponów sprawdzenie; nie zamykaj tej strony.');}
  }finally{flight.current=false;setBusy(false);}
 }}>
 <h2>Usuń konto</h2><p>Operacja jest nieodwracalna. Usuniemy konto logowania, profil, telefon, zdjęcia i członkostwa. Pozostaną wyłącznie zredagowane fakty historyczne potrzebne dla integralności rozliczeń i meczów. Grupa z innymi członkami wymaga wcześniejszego przekazania administratora; Twoje grupy jednoosobowe zostaną zamknięte.</p>
 {!pending&&<><label>Obecne hasło do usunięcia konta<input type="password" autoComplete="current-password" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label><label>Wpisz USUŃ KONTO<input value={confirmation} disabled={busy} onChange={e=>setConfirmation(e.target.value)}/></label></>}
 {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Trwa sprawdzanie operacji…</p>}
 <button type="submit" disabled={busy}>{pending?'Ponów sprawdzenie usuwania':'Nieodwracalnie usuń moje konto'}</button>
 {!pending&&<button type="button" disabled={busy} onClick={()=>{setOpen(false);setPassword('');setConfirmation('');}}>Anuluj usunięcie</button>}
 </form>;
}

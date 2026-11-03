import { useId, useRef, useState } from 'react';
import { normalizePolishPhone, PHONE_ERROR } from '../../supabase/functions/_shared/phone';

export default function GuestForm({disabled,hasPlace,onSave}:{disabled:boolean;hasPlace:boolean;onSave:(body:{guest_name:string;guest_phone:string;list:'registered'|'reserve'})=>Promise<boolean>}) {
 const id=useId(),flight=useRef(false);
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[reserve,setReserve]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 async function submit(){
  if(disabled||flight.current||!reserve&&!hasPlace)return;
  const guestName=name.trim();
  if(!guestName||guestName.length>64||/[<>]/.test(guestName)||[...guestName].some(c=>c.charCodeAt(0)<32)){setError('Podaj imię lub pseudonim gościa (do 64 znaków).');return;}
  let normalized='';
  try {if(phone.trim()){if(phone.length>32)throw Error();normalized=normalizePolishPhone(phone);}}
  catch {setError(PHONE_ERROR);return;}
  flight.current=true;setSaving(true);setError('');
  try {if(await onSave({guest_name:guestName,guest_phone:normalized,list:reserve?'reserve':'registered'})){setName('');setPhone('');}else setError('Nie potwierdzono zapisu gościa. Dane pozostawiono w formularzu.');}
  catch {setError('Nie potwierdzono zapisu gościa. Dane pozostawiono w formularzu.');}
  finally {flight.current=false;setSaving(false);}
 }
 return <form className="slm-group-form slm-guest-form" aria-label="Dodawanie gościa" noValidate onSubmit={e=>{e.preventDefault();void submit();}}>
 <label>Imię lub pseudonim gościa<input required autoComplete="off" maxLength={64} disabled={disabled||saving} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Telefon gościa · opcjonalnie<input type="tel" inputMode="tel" autoComplete="off" maxLength={32} disabled={disabled||saving} aria-describedby={id+'-phone'} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
 <p id={id+'-phone'} className="slm-muted">9 cyfr, opcjonalnie +48 lub 0048. Nowe numery zagraniczne nie są obsługiwane. Dotychczasowe kontakty pozostają bez zmian.</p>
 <label>Lista<select disabled={disabled||saving} value={reserve?'reserve':'registered'} onChange={e=>setReserve(e.target.value==='reserve')}><option value="registered">Na mecz</option><option value="reserve">Rezerwa</option></select></label>
 <p>Odpowiadasz finansowo za swojego gościa. Dodaj jednego gościa, a następnie powtórz dla drugiego.</p>
 {error&&<p role="alert">{error}</p>}
 <button className="slm-group-primary" type="submit" disabled={disabled||saving||!name.trim()||!reserve&&!hasPlace}>{saving?'Zapisywanie…':'Zapisz gościa'}</button>
 </form>;
}

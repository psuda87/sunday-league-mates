import EmailSettings from './EmailSettings';
import { useRef,useState } from 'react';
import { IonAlert } from '@ionic/react';
import type { PersonalProfileBinding,IdentityDraft } from '../ui/personalProfile';
import { nicknameProblem,profileProblems } from '../account-ui/model';
export default function PremiumIdentityEditor({binding,onClose}:{binding:PersonalProfileBinding;onClose:()=>void}){
 const p=binding.profile!;
 const [nick,setNick]=useState(p.nickname??''),[first,setFirst]=useState(p.first_name??''),[full,setFull]=useState(p.full_name),[number,setNumber]=useState(p.jersey_number==null?'':String(p.jersey_number)),[mode,setMode]=useState(p.display_as),[error,setError]=useState(''),[pending,setPending]=useState<IdentityDraft|null>(null);
 const [phone,setPhone]=useState(p.phone),[password,setPassword]=useState('');
 const flight=useRef(false),closing=useRef(false),request=useRef(crypto.randomUUID());
 const groups=p.group_scope;
 const needs=groups?.some(g=>mode==='full_name'?!g.share_full_name:mode==='first_name'&&!g.share_full_name&&!g.share_first_name)??false;
 const preview=mode==='first_name'?first.trim()||nick.trim():mode==='full_name'?full.trim()||nick.trim():nick.trim();
 async function save(draft:IdentityDraft){if(flight.current)return;flight.current=true;try{if(await binding.saveIdentity?.(draft))onClose();else setError('Nie potwierdzono zapisu. Odśwież profil.');}finally{setPassword('');flight.current=false;}}
 return <form className="slm-identity-editor slm-premium-identity" noValidate aria-label="Edycja publicznej nazwy" onSubmit={e=>{e.preventDefault();if(flight.current||closing.current||binding.saving)return;const problems=profileProblems({nickname:nick,fullName:full,phone:p.account_model?phone:''});if(problems.length||profileProblems({nickname:'Profil',fullName:first,phone:''}).length){setError(problems[0]||'Sprawdź imię.');return;}if(p.account_model&&nicknameProblem(nick)){setError(nicknameProblem(nick));return;}if(!groups||!p.nickname){setError('Backend nie udostępnia kontraktu nazw. Odśwież profil.');return;}if(number!==''&&!/^\d{1,2}$/.test(number)){setError('Numer: 0–99 lub puste pole.');return;}if(p.account_model&&nick.trim()!==p.nickname&&!password){setError('Zmiana pseudonimu wymaga obecnego hasła.');return;}const draft:IdentityDraft={nickname:p.account_model?nick.trim().normalize('NFC'):nick.trim(),first_name:first.trim(),full_name:full.trim(),display_as:mode,jersey_number:number===''?null:Number(number),group_scope:groups.map(g=>g.group_id).sort(),accept_disclosure:false,request_id:request.current,...(p.account_model?{expected_nickname:p.nickname,contact_phone:phone,current_password:nick.trim()!==p.nickname?password:undefined}:{})};if(needs)setPending(draft);else void save(draft);}}>
 <h2>Edytuj profil</h2><p>{p.account_model?'Pseudonim jest Twoim loginem. Telefon służy wyłącznie do kontaktu.':'Pseudonim nie zmienia loginu ani sesji.'} Sposób wyświetlania jest wspólny dla konta; zgody pozostają ograniczone do grup.</p>
 <label>Pseudonim<input value={nick} maxLength={48} disabled={binding.saving} onChange={e=>setNick(e.target.value)}/></label>
 {p.account_model&&<><label>Telefon kontaktowy · opcjonalnie<input type="tel" autoComplete="tel" value={phone} disabled={binding.saving} onChange={e=>setPhone(e.target.value)}/></label>{nick.trim()!==p.nickname&&<label>Obecne hasło<input type="password" autoComplete="current-password" value={password} disabled={binding.saving} onChange={e=>setPassword(e.target.value)}/></label>}</>}
 <label>Imię · wpisz jawnie<input value={first} maxLength={100} disabled={binding.saving} onChange={e=>setFirst(e.target.value)}/></label>
 <label>Imię i nazwisko · opcjonalnie<input value={full} maxLength={100} disabled={binding.saving} onChange={e=>setFull(e.target.value)}/></label>
 <label>Wyświetlaj mnie jako<select value={mode} disabled={binding.saving} onChange={e=>setMode(e.target.value as typeof mode)}><option value="nickname">Pseudonim</option><option value="first_name">Imię</option><option value="full_name">Imię i nazwisko</option></select></label>
 <p aria-live="polite">Podgląd dla uprawnionych: <strong>{preview||'Podaj pseudonim'}</strong>. Bez wymaganej zgody w grupie: {nick||'pseudonim'}. Administrator zachowuje dostęp B3.</p>
 <label>Numer koszulki<input inputMode="numeric" value={number} disabled={binding.saving} onChange={e=>setNumber(e.target.value)}/></label>
 {p.account_model&&binding.requestEmail&&<EmailSettings binding={binding}/>}
 {error&&<p role="alert">{error}</p>}<div className="slm-identity-actions"><button type="submit" disabled={binding.saving||!!pending}>Zapisz dane</button><button type="button" disabled={binding.saving} onClick={onClose}>Anuluj</button></div>
 <IonAlert isOpen={!!pending} header="Udostępnienie danych" message={`${mode==='first_name'?'Aby wyświetlać się jako imię, musisz udostępnić swoje imię innym uprawnionym zawodnikom. Czy chcesz kontynuować?':'Aby wyświetlać się jako imię i nazwisko, musisz udostępnić te dane innym uprawnionym zawodnikom. Czy chcesz kontynuować?'} Zakres: wszystkie Twoje obecne grupy (${groups?.length??0}). Bez nowych grup i osób z zewnątrz.`} buttons={[{text:'Anuluj',role:'cancel',handler:()=>{closing.current=true;setPassword('');setPending(null);}},{text:'Akceptuję',handler:()=>{if(pending){closing.current=true;const draft={...pending,accept_disclosure:true};setPending(null);void save(draft);}}}]} onDidDismiss={()=>{closing.current=false;setPending(null);}}/>
 </form>;
}

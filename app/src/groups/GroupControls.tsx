import { useId,useState } from 'react';
import { IonIcon,IonAlert } from '@ionic/react';
import { refreshOutline } from 'ionicons/icons';
import './GroupControls.css';

export function GroupConsent({checked,busy,onChange,mode='nickname',first=false}:{checked:boolean;busy:boolean;onChange:(value:boolean,confirmNickname?:boolean)=>void;mode?:'nickname'|'first_name'|'full_name';first?:boolean}) {
 const id=useId(),[confirm,setConfirm]=useState(false);
 function change(value:boolean){if(!value&&mode!=='nickname')setConfirm(true);else onChange(value);}
 return <div className="slm-group-consent" aria-busy={busy}>
 <div><strong id={id}>Udostępniaj imię i nazwisko</strong><p id={`${id}-help`}>Pozostali członkowie tej grupy zobaczą dane. Samo włączenie nie zmienia nazwy. Administrator zachowuje dostęp B3.</p>{first&&!checked&&<button disabled={busy} onClick={()=>change(false)}>Ukryj udostępnione imię</button>}</div>
 <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} aria-describedby={`${id}-help`} disabled={busy} onClick={()=>change(!checked)}><span aria-hidden="true"/></button>
 <IonAlert isOpen={confirm} header="Ukrycie danych" message={`Obecnie wyświetlasz się jako ${mode==='full_name'?'imię i nazwisko':'imię'}. Aby ukryć te dane, zmienimy Twój sposób wyświetlania na pseudonim. Czy chcesz kontynuować? Zgoda zostanie wyłączona tylko w tej grupie. Administrator zachowuje dostęp B3.`} buttons={[{text:'Anuluj',role:'cancel'},{text:'Akceptuję',handler:()=>onChange(false,true)}]} onDidDismiss={()=>setConfirm(false)}/>
 </div>;
}

export function GroupRefresh({loading,disabled,onRefresh}:{loading:boolean;disabled:boolean;onRefresh:()=>Promise<void>}) {
 return <button className="slm-group-refresh" type="button" aria-label="Odśwież grupy" aria-busy={loading} disabled={loading||disabled} onClick={()=>void onRefresh()}>
  <IonIcon icon={refreshOutline} aria-hidden="true"/>
  <span className="slm-sr-only" role="status">{loading?'Odświeżanie grup…':''}</span>
 </button>;
}

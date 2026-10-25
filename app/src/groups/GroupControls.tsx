import { useId } from 'react';
import { IonIcon } from '@ionic/react';
import { refreshOutline } from 'ionicons/icons';
import './GroupControls.css';

export function GroupConsent({checked,busy,onChange}:{checked:boolean;busy:boolean;onChange:(value:boolean)=>void}) {
 const id=useId();
 return <div className="slm-group-consent" aria-busy={busy}>
  <div><strong id={id}>Udostępniaj imię i nazwisko</strong><p id={`${id}-help`}>Pozostali członkowie tej grupy zobaczą Twoje dane. Administrator ma do nich dostęp niezależnie od ustawienia.</p></div>
  <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} aria-describedby={`${id}-help`} disabled={busy} onClick={()=>onChange(!checked)}><span aria-hidden="true"/></button>
 </div>;
}

export function GroupRefresh({loading,disabled,onRefresh}:{loading:boolean;disabled:boolean;onRefresh:()=>Promise<void>}) {
 return <button className="slm-group-refresh" type="button" aria-label="Odśwież grupy" aria-busy={loading} disabled={loading||disabled} onClick={()=>void onRefresh()}>
  <IonIcon icon={refreshOutline} aria-hidden="true"/>
  <span className="slm-sr-only" role="status">{loading?'Odświeżanie grup…':''}</span>
 </button>;
}

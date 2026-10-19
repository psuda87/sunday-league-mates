import { IonIcon } from '@ionic/react';
import { addOutline, calendarOutline, peopleOutline, personOutline } from 'ionicons/icons';
export type DemoTab='events'|'groups'|'profile';
export default function DemoBottomNav({active,onSelect,canCreate,onCreate}:{active:DemoTab;onSelect:(tab:DemoTab)=>void;canCreate:boolean;onCreate:()=>void}) {
  const items=[['events','Mecze',calendarOutline],['groups','Grupy',peopleOutline],['profile','Profil',personOutline]] as const;
  return <nav className={`slm-bottom-nav slm-demo-nav${canCreate?' slm-demo-nav-admin':''}`} aria-label="Główna nawigacja"><span className="slm-demo-nav-surface" aria-hidden="true"/>{canCreate&&<svg className="slm-demo-nav-notch" width="80" height="44" viewBox="0 0 80 44" aria-hidden="true"><path d="M0 0.5 H7 A34 34 0 1 0 73 0.5 H80"/></svg>}{items.map(([tab,label,icon])=><button data-tab={tab} type="button" key={tab} aria-current={active===tab?'page':undefined} onClick={()=>onSelect(tab)}><IonIcon icon={icon} aria-hidden="true"/>{label}</button>)}{canCreate&&<button type="button" className="slm-demo-create" aria-label="Utwórz mecz" onClick={onCreate}><IonIcon icon={addOutline} aria-hidden="true"/></button>}</nav>;
}

import { IonIcon } from '@ionic/react';
import { addOutline, calendarOutline, peopleOutline, personOutline } from 'ionicons/icons';
export type Tab = 'events' | 'groups' | 'profile';
export default function BottomNav({ active, onSelect, canCreate = false, onCreate }: { active: string; onSelect: (tab: Tab) => void; canCreate?: boolean; onCreate?: () => void }) {
  const items = [['events', 'Mecze', calendarOutline], ['groups', 'Grupy', peopleOutline], ['profile', 'Profil', personOutline]] as const;
  return <nav className={`slm-bottom-nav slm-live-nav${canCreate && onCreate ? ' slm-live-nav-organizer' : ''}`} aria-label="Główna nawigacja">
    <span className="slm-live-nav-surface" aria-hidden="true" />
    {items.map(([tab, label, icon]) => <button data-tab={tab} type="button" key={tab} aria-current={active === tab ? 'page' : undefined} onClick={() => onSelect(tab)}><IonIcon icon={icon} aria-hidden="true" />{label}</button>)}
    {canCreate && onCreate && <button type="button" className="slm-live-create" aria-label="Utwórz mecz" onClick={onCreate}><IonIcon icon={addOutline} aria-hidden="true" /></button>}
  </nav>;
}

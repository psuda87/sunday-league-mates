import { IonIcon } from '@ionic/react';
import { calendarOutline, peopleOutline, personOutline } from 'ionicons/icons';
export type Tab = 'events' | 'groups' | 'profile';
export default function BottomNav({ active, onSelect }: { active: string; onSelect: (tab: Tab) => void }) {
  const items = [['events', 'Mecze', calendarOutline], ['groups', 'Grupy', peopleOutline], ['profile', 'Profil', personOutline]] as const;
  return <nav className="slm-bottom-nav" aria-label="Główna nawigacja">{items.map(([tab, label, icon]) => <button key={tab} aria-current={active === tab ? 'page' : undefined} onClick={() => onSelect(tab)}><IonIcon icon={icon} aria-hidden="true" />{label}</button>)}</nav>;
}

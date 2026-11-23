import { IonIcon } from '@ionic/react';
import { trophyOutline, footballOutline, flashOutline } from 'ionicons/icons';
import { usePlayerRating } from '../rating/RatingProvider';

/** Małe statystyki zawodnika przy wierszu listy: MVP u góry, pod spodem gole i asysty. Bez danych nic nie pokazuje. */
export default function MemberStats({ id }: { id?: string | null }) {
  const stats = usePlayerRating(id)?.stats;
  if (!stats) return null;
  return <span className="slm-member-stats" aria-label={`MVP ${stats.mvp}, gole ${stats.goals}, asysty ${stats.assists}`}><span className="slm-member-stat-mvp" title="MVP"><IonIcon icon={trophyOutline} aria-hidden="true"/>{stats.mvp}</span><span title="Gole"><IonIcon icon={footballOutline} aria-hidden="true"/>{stats.goals}</span><span title="Asysty"><IonIcon icon={flashOutline} aria-hidden="true"/>{stats.assists}</span></span>;
}

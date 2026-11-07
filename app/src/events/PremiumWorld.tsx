import type { ComponentProps } from 'react';
import WorldApp from '../demo/App';
import PremiumEvents from './PremiumEvents';
import { usePremiumEvents } from './usePremiumEvents';
import type { SessionManager } from '../auth/sessionManager';

export default function PremiumWorld({manager,userId,...props}:ComponentProps<typeof WorldApp>&{manager:SessionManager;userId:string}){
  const data=usePremiumEvents(manager,userId);
  return <WorldApp {...props} eventsView={(onGroups,onOwnProfile)=><PremiumEvents manager={manager} data={data} userId={userId} onGroups={onGroups} onOwnProfile={onOwnProfile}/>} liveEvents={{canCreate:data.organizers.length>0&&!data.error,onCreate:data.beginCreate,onEnter:()=>{data.back();void data.refresh();}}}/>;
}

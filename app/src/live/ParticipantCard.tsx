import { useEffect, useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import UltimatePlayerCard from '../ui/UltimatePlayerCard';
import type { LiveEntry } from './LineupPreview';

export default function ParticipantCard({entry,manager,userId}:{entry:LiveEntry;manager:SessionManager;userId:string}) {
  const [photo,setPhoto]=useState<string|null>(null);
  useEffect(()=>{
    let active=true;
    // The current API exposes only the authenticated user's own private photo.
    if(entry.member_id===userId)void manager.call<{image_data_url:string|null}>('profile_photo_get').then(r=>{if(active)setPhoto(r.image_data_url);}).catch(()=>{});
    return()=>{active=false;};
  },[entry.member_id,manager,userId]);
  return <div className="slm-participant-profile slm-ultimate-profile">
    <UltimatePlayerCard name={entry.display_name} portrait={photo?{src:photo}:undefined} portraitDescription="Zdjęcie profilowe"/>
    {entry.contact_phone&&<a className="slm-call" href={'tel:'+entry.contact_phone}>Zadzwoń</a>}
    <p className="slm-muted">Dane dostępne w tym meczu. Zdjęcia innych osób, numery koszulek i statystyki są niedostępne.</p>
  </div>;
}

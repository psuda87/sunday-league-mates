import { useEffect, useMemo, useRef, useState } from 'react';
import type { SessionManager } from './sessionManager';
import { profileAdapter } from './profileAdapter';
import type { PersonalProfileBinding,PersonalProfileData } from '../ui/personalProfile';

type State={owner:string|null;phase:PersonalProfileBinding['phase'];profile:PersonalProfileData|null;notice:string};
export function useOwnProfile(manager:SessionManager,userId:string|null):PersonalProfileBinding {
 const [state,setState]=useState<State>({owner:null,phase:'loading',profile:null,notice:''});
 const [revision,setRevision]=useState(0),[saving,setSaving]=useState(false);
 const generation=useRef(0),flight=useRef(false);
 const adapter=useMemo(()=>userId?profileAdapter(manager,userId):null,[manager,userId]);
 useEffect(()=>{
  const ticket=++generation.current;flight.current=false;setSaving(false);
  setState({owner:userId,phase:'loading',profile:null,notice:''});
  if(adapter)void adapter.read().then(profile=>{
   if(ticket===generation.current)setState({owner:userId,phase:profile?'ready':'missing',profile,notice:profile?'':'Profil nie jest dostępny. Nie utworzono danych zastępczych.'});
  }).catch(()=>{if(ticket===generation.current)setState({owner:userId,phase:'error',profile:null,notice:'Nie udało się odczytać profilu. Spróbuj ponownie.'});});
  return()=>{generation.current=ticket+1;};
 },[adapter,userId,revision]);
 // Hide a previous account synchronously, before the effect/late request can run.
 const current=state.owner===userId&&userId!==null?state:{owner:userId,phase:'loading' as const,profile:null,notice:''};
 return {...current,saving:current.phase==='ready'&&saving,reload:()=>setRevision(v=>v+1),
  async save(fullName){
   const auth=manager.getSnapshot();
   if(flight.current||!adapter||!current.profile||current.phase!=='ready'||auth.phase!=='ready'||auth.session?.user_id!==userId)return false;
   const ticket=generation.current;flight.current=true;setSaving(true);
   try {
    const profile=await adapter.save(fullName,current.profile.display_as);
    if(ticket!==generation.current)return false;
    if(!profile)throw new Error('profile_missing');
    setState({owner:userId,phase:'ready',profile,notice:'Zapisano profil i potwierdzono dane na serwerze.'});return true;
   } catch {
    if(ticket===generation.current)setState(previous=>({...previous,phase:'error',profile:null,notice:'Nie udało się potwierdzić zapisu profilu. Ponów odczyt przed dalszą edycją.'}));
    return false;
   } finally {if(ticket===generation.current){flight.current=false;setSaving(false);}}
  },
 };
}

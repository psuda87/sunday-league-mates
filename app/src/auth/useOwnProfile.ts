import { useOwnPhoto } from './useOwnPhoto';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SessionManager } from './sessionManager';
import { profileAdapter } from './profileAdapter';
import type { IdentityDraft,PersonalProfileBinding,PersonalProfileData } from '../ui/personalProfile';

type State={owner:string|null;phase:PersonalProfileBinding['phase'];profile:PersonalProfileData|null;notice:string};
export function useOwnProfile(manager:SessionManager,userId:string|null,selection?:{begin:()=>void;end:()=>void}):PersonalProfileBinding {
 const photo=useOwnPhoto(manager,userId,selection);
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
 async function saveNumber(number:number){
  const auth=manager.getSnapshot();
  if(flight.current||!adapter||!current.profile||current.phase!=='ready'||auth.phase!=='ready'||auth.session?.user_id!==userId)return false;
  const ticket=generation.current;flight.current=true;setSaving(true);
  try {const profile=await adapter.saveNumber(number);if(ticket!==generation.current)return false;setState({owner:userId,phase:'ready',profile,notice:'Zapisano numer koszulki.'});return true;}
  catch {if(ticket===generation.current)setState(previous=>({...previous,phase:'error',profile:null,notice:'Nie udało się potwierdzić numeru. Ponów odczyt profilu.'}));return false;}
  finally {if(ticket===generation.current){flight.current=false;setSaving(false);}}
 }
 async function changeAlias(login:string,currentPassword:string){
  const auth=manager.getSnapshot();
  if(flight.current||!adapter||current.profile?.email_account!==false||auth.phase!=='ready'||auth.session?.user_id!==userId)return false;
  const ticket=generation.current;flight.current=true;setSaving(true);
  try {const profile=await adapter.changeAlias(login,currentPassword);if(ticket!==generation.current)return false;setState({owner:userId,phase:'ready',profile,notice:'Zmieniono login i potwierdzono nową sesję.'});return true;}
  catch {if(ticket===generation.current)setState(previous=>({...previous,notice:'Nie udało się potwierdzić zmiany loginu. Sprawdź hasło i dostępność loginu; przy przerwanej operacji ponów odczyt.'}));return false;}
  finally{if(ticket===generation.current){flight.current=false;setSaving(false);}}
 }
 async function saveIdentity(draft:IdentityDraft){
  const auth=manager.getSnapshot();if(flight.current||!adapter||current.phase!=='ready'||auth.phase!=='ready'||auth.session?.user_id!==userId)return false;
  const ticket=generation.current;flight.current=true;setSaving(true);
  try{const profile=await adapter.saveIdentity(draft);if(ticket!==generation.current)return false;setState({owner:userId,phase:'ready',profile,notice:'Zapisano i ponownie odczytano profil.'});return true;}
  catch{if(ticket===generation.current)setState({owner:userId,phase:'error',profile:null,notice:'Nie potwierdzono zapisu. Ponów odczyt profilu.'});return false;}
  finally{if(ticket===generation.current){flight.current=false;setSaving(false);}}
 }
 useEffect(()=>{const reload=()=>setRevision(v=>v+1);window.addEventListener('slm-profile-changed',reload);return()=>window.removeEventListener('slm-profile-changed',reload);},[]);
 return {...current,photo,saveIdentity,saveNumber,changeAlias,saving:current.phase==='ready'&&saving,reload:()=>setRevision(v=>v+1),
  async save(fullName,number){
   const auth=manager.getSnapshot();
   if(flight.current||!adapter||!current.profile||current.phase!=='ready'||auth.phase!=='ready'||auth.session?.user_id!==userId)return false;
   const ticket=generation.current;flight.current=true;setSaving(true);
   try {
    if(number!==undefined&&(!Number.isInteger(number)||number<0||number>99))throw new Error('invalid_number');
    let profile=await adapter.save(fullName,current.profile.display_as);
    if(ticket!==generation.current)return false;
    if(number!==undefined&&number!==profile?.jersey_number)profile=await adapter.saveNumber(number);
    if(profile?.full_name!==fullName.trim())throw new Error('profile_readback_mismatch');
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

import { useEffect,useRef,useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import GroupScreens from '../demo/GroupScreens';
import { isGroupAction } from '../demo/groups';
import MatchHeader from '../ui/MatchHeader';
import UltimatePlayerCard from '../ui/UltimatePlayerCard';
import { useFrozenBack } from '../native/frozenDemoAndroid';
import { useGroups } from './useGroups';
import type { GroupMember } from './model';

export default function PremiumGroups({manager,userId}:{manager:SessionManager;userId:string}){
 const {world,binding,readMember}=useGroups(manager,userId);
 const [profile,setProfile]=useState<{member:GroupMember|null;error:string}|null>(null);
 const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 function close(){generation.current++;setProfile(null);}
 useFrozenBack(()=>{if(!profile)return false;close();return true;},()=>document.querySelector<HTMLElement>('.slm-ultimate-profile'),30);
 async function open(id:string,groupId:string){
  const ticket=++generation.current;setProfile({member:null,error:''});
  try{const member=await readMember(id,groupId);if(ticket===generation.current)setProfile({member,error:''});}
  catch{if(ticket===generation.current)setProfile({member:null,error:'Nie udało się potwierdzić dostępu do profilu. Wróć i odśwież grupę.'});}
 }
 return <>
 <div hidden={profile!==null}><GroupScreens world={world} live={binding} dispatch={action=>{if(isGroupAction(action))binding.act(action);}} onPlayer={(id,groupId)=>{void open(id,groupId);}}/></div>
 {profile&&<section className="slm-players-screen slm-ultimate-profile"><MatchHeader title="Zawodnik" onBack={close} backLabel="Wróć do grupy"/>
 {profile.error?<p role="alert">{profile.error}</p>:!profile.member?<p role="status">Wczytywanie profilu…</p>:<>
 <p className="slm-players-demo">Profil grupowy · tylko dane udostępnione przez serwer</p>
 <UltimatePlayerCard name={profile.member.full_name||profile.member.nickname} jerseyNumber={profile.member.jersey_number??undefined}/>
 <p className="slm-muted">{profile.member.nickname}</p>
 {profile.member.contact_phone&&<a className="slm-call" href={'tel:'+profile.member.contact_phone}>Zadzwoń</a>}
 <section className="slm-player-stats slm-ultimate-summary" aria-label="Statystyki niedostępne"><dl className="slm-ultimate-stats">{['Mecze','Gole','Asysty','MVP'].map(label=><div key={label}><dt>{label}</dt><dd>—</dd></div>)}</dl></section>
 <p className="slm-muted">Statystyki i zdjęcia innych zawodników nie są jeszcze dostępne.</p>
 </>}</section>}
 </>;
}

import { useEffect,useRef,useState } from 'react';
import type { SessionManager } from '../auth/sessionManager';
import PremiumFinance from './PremiumFinance';
export default function PremiumGroupFinance({manager,userId,initialGroup=''}:{manager:SessionManager;userId:string;initialGroup?:string}){
 const epoch=useRef(0);const [loadedFor,setLoadedFor]=useState('');
 const [groups,setGroups]=useState<{id:string;name:string}[]|null>(null),[selected,setSelected]=useState(''),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;const ticket=++epoch.current;setError(false);setGroups(null);void manager.call<{groups:{id:string;name:string}[]}>('finance_groups').then(r=>{if(!Array.isArray(r.groups)||r.groups.some(g=>!g.id||!g.name))throw Error('Invalid groups');if(live&&ticket===epoch.current&&manager.getSnapshot().phase==='ready'&&manager.getSnapshot().session?.user_id===userId){setLoadedFor(userId);setGroups(r.groups);setSelected(r.groups.some(g=>g.id===initialGroup)?initialGroup:r.groups[0]?.id??'');}}).catch(()=>{if(live&&ticket===epoch.current)setError(true);});return()=>{live=false;};},[manager,userId,initialGroup,revision]);
 useEffect(()=>{let previous=manager.getSnapshot().phase;return manager.subscribe(()=>{const phase=manager.getSnapshot().phase;if(previous===phase)return;previous=phase;epoch.current++;setLoadedFor('');setGroups(null);if(phase==='ready')setRevision(v=>v+1);});},[manager]);
 const visibleGroups=loadedFor===userId?groups:null;
 return <section className="slm-premium-finance" aria-label="Finanse moich grup">{error?<><p role="alert">Nie udało się pobrać grup finansowych.</p><button onClick={()=>setRevision(r=>r+1)}>Spróbuj ponownie</button></>:visibleGroups===null?<p role="status">Wczytywanie grup…</p>:!visibleGroups.length?<p>Nie masz jeszcze rozliczeń w żadnej grupie.</p>:<><label>Grupa rozliczeń<select value={selected} onChange={e=>setSelected(e.target.value)}>{visibleGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>{selected&&<PremiumFinance key={`${userId}:${selected}`} manager={manager} userId={userId} groupId={selected}/>}</>}</section>;
}

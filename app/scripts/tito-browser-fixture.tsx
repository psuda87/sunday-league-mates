// Browser-only synthetic transport. Never imported by any application entry.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {IonApp,IonPage,IonContent,setupIonicReact} from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/palettes/dark.class.css';
import '../src/theme/variables.css';
import '../src/pages/Accounts.css';
import '../src/demo/palettes.css';
import '../src/events/premiumEvents.css';
import PremiumTeams from '../src/events/PremiumTeams';
import {currentWithdrawals} from '../src/events/premiumContracts';
import type {MatchDetail,MatchEntry} from '../src/events/premiumContracts';
import {SessionManager} from '../src/auth/sessionManager';
import {AccountError} from '../src/auth/api';
import type {LineupWrite,LineupSnapshot} from '../src/events/lineupContracts';
setupIonicReact();
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const eventId=id(900),groupId=id(901),userId=id(902);
const people:MatchEntry[]=Array.from({length:11},(_,i)=>({id:id(i+1),member_id:i<9?id(i+101):null,
 responsible_user_id:userId,display_name:'Osoba '+i,responsible_name:'Fixture',status:'registered',absent:false,
 contact_phone:null,guest_name:i<9?null:'Gość',guest_phone:null,joined_at:'2026-11-01T00:00:00Z',jersey_number:i===0?0:i===1?99:null}));
people.push({...people[0],id:id(51),status:'withdrawn'},
 {...people[9],id:id(52),status:'withdrawn',display_name:'Wycofany gość'});
const detail:MatchDetail={event:{id:eventId,group_id:groupId,group_name:'Fixture',created_by:userId,name:'Syntetyczny mecz',visibility:'private',
 starts_at:'2099-01-01T18:00:00Z',location:'Fixture',status:'scheduled',access:'full',own_participation:true,
 duration_minutes:90,capacity:15,cost_cents:0,minimum_players:10,registered_count:11,reserve_count:0,registration_open:true,decision_required:false,can_manage:true,can_edit:true,version:1},
 participants:people,server_now:new Date().toISOString(),can_register_paid:true};
let snapshot:LineupSnapshot={can_write:true,event_id:eventId,event_version:1,version:1,roster_version:'a'.repeat(64),saved_roster_version:'a'.repeat(64),
 team_a:people.slice(0,11).filter((_,i)=>i%2===0).map(p=>p.id),team_b:people.slice(0,11).filter((_,i)=>i%2===1).map(p=>p.id),unassigned:[],stale_entry_ids:[],
 last_change:{user_id:userId,actor_type:'automatic',display_name:'Tito',changed_at:new Date().toISOString()}};
const receipts=new Map<string,unknown>();
async function context(index:number){
 const manager=new SessionManager({read:async()=>null,write:async()=>{},clear:async()=>{}},async<T,>(action:string,body:Record<string,unknown>={})=>{
  if(action==='login'||action==='refresh')return {user_id:id(902+index),access_token:'synthetic',refresh_token:'synthetic',expires_in:3600,role:'member',must_change_password:false} as T;
  if(action==='matches_detail')return structuredClone(detail) as T;
  if(action==='lineups_get')return structuredClone(snapshot) as T;
  if(action==='lineups_save'){
   const b=body as unknown as LineupWrite;
   if(receipts.has(b.request_id))return {...receipts.get(b.request_id) as object,replayed:true} as T;
   if(b.expected_version!==snapshot.version)throw new AccountError('conflict','lineup_version_conflict');
   snapshot={...snapshot,version:snapshot.version+1,team_a:[...b.team_a],team_b:[...b.team_b],
    last_change:{user_id:id(902+index),actor_type:'manual',display_name:'Autor '+index,changed_at:new Date().toISOString()}};
   const receipt={...snapshot,changed:true,replayed:false};receipts.set(b.request_id,receipt);return structuredClone(receipt) as T;
  }
  throw Error('Unexpected browser fixture request '+action);
 });
 await manager.signIn('fixture','synthetic');return {manager,userId:id(902+index),groupId};
}
const contexts=await Promise.all([context(0),context(1)]);
export function App(){
 const [hidden,setHidden]=useState(false);
 return <IonApp><IonPage className="slm-demo"><IonContent><main className="slm-accounts">
  <h1>Test UI Tito · syntetyczny transport</h1><p>Bez bazy i sieci API.</p>
  <button onClick={()=>setHidden(v=>!v)}>Przełącz widok</button>
  <ul aria-label="Wycofane wpisy">{currentWithdrawals(people).map(p=><li key={p.id} data-withdrawn={p.id}>{p.display_name}</li>)}</ul>
  {contexts.map((c,i)=><section key={i} data-client={i} hidden={hidden}><h2>Sesja {i+1}</h2>
   <PremiumTeams eventId={eventId} participants={people} canEdit cancelled={false} profileContext={c}/>
  </section>)}
 </main></IonContent></IonPage></IonApp>;
}
createRoot(document.getElementById('root')!).render(<App/>);

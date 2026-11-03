// Real controls/CSS, fictional controller; deliberately no Auth or backend.
import {createRoot} from 'react-dom/client';
import {IonApp,IonPage,IonContent,setupIonicReact} from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/palettes/dark.class.css';
import '../../src/theme/variables.css';
import GuestForm from '../../src/events/GuestForm';
import PremiumEvents from '../../src/events/PremiumEvents';
import type {PremiumEventsController} from '../../src/events/usePremiumEvents';
setupIonicReact();
const controller={activeGroup:'mine',groups:[],events:[],detail:null,loading:false,busy:false,error:'',notice:'',creating:false,
 discoveryEnabled:true,listFilter:'upcoming',offset:0,hasMore:false,serverNow:'2026-10-31T12:00:00Z',selectGroup:()=>{},changeFilter:()=>{},refresh:async()=>{},back:()=>{}} as unknown as PremiumEventsController;
createRoot(document.getElementById('root')!).render(<IonApp><IonPage className="slm-demo"><IonContent><main>
 <p>Test interfejsu · fikcyjne dane · bez API</p>
 <section className="slm-premium-events"><GuestForm disabled={false} hasPlace onSave={async()=>false}/></section>
 <PremiumEvents data={controller} userId="fixture" onGroups={()=>{}}/>
</main></IonContent></IonPage></IonApp>);

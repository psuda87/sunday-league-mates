// Test-only entry: original profile/editor/CSS, fictional binding, no Auth/API.
import {createRoot} from 'react-dom/client';
import {IonApp,IonPage,IonContent,IonFooter,setupIonicReact} from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/palettes/dark.class.css';
import '../../src/theme/variables.css';
import Profile from '../../src/demo/Profile';
import {initialWorld} from '../../src/demo/data';
import BottomNav from '../../src/demo/DemoBottomNav';
import type {PersonalProfileBinding} from '../../src/ui/personalProfile';
setupIonicReact();
const world=initialWorld();
const binding:PersonalProfileBinding={phase:'ready',saving:false,notice:'',reload:()=>{},save:async()=>false,saveIdentity:async()=>false,profile:{user_id:world.userId,login:'layout_fixture',nickname:'Fikcyjny zawodnik',first_name:'Test',full_name:'Testowy Zawodnik',display_as:'nickname',display_name:'Fikcyjny zawodnik',jersey_number:27,phone:'',group_scope:[]}};
createRoot(document.getElementById('root')!).render(<IonApp><IonPage className="slm-demo"><IonContent><main><Profile world={world} id={world.userId} personal personalProfile={binding} dispatch={()=>{}}/></main></IonContent><IonFooter><BottomNav active="profile" onSelect={()=>{}} canCreate={false} onCreate={()=>{}}/></IonFooter></IonPage></IonApp>);

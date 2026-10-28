import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { createRoot } from 'react-dom/client';
import { IonApp, setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/palettes/dark.class.css';
import '../src/theme/variables.css';
import { initializeTheme } from '../src/ui/theme';
import Demo from '../src/auth/B1App';
import { SessionManager } from '../src/auth/sessionManager';
import { createProjectTokenStore } from '../src/auth/tokenStore';
import { accountRequest } from '../src/auth/api';
import { installFrozenAndroid } from '../src/native/frozenDemoAndroid';

initializeTheme({palettes:true});
setupIonicReact({hardwareBackButton:true});
if(Capacitor.getPlatform()==='android')void StatusBar.setOverlaysWebView({overlay:false});
installFrozenAndroid();
// Local test namespace only (20 lowercase letters), not a Supabase Cloud project.
const manager = new SessionManager(createProjectTokenStore('slmfinanceandroiddev'), accountRequest);
createRoot(document.getElementById('root')!).render(<IonApp><Demo manager={manager} /></IonApp>);

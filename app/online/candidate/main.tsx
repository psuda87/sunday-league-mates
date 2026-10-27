// Explicit candidate entry. Never replaces main or silently enables online Auth.
import {createRoot} from 'react-dom/client';import {IonApp,setupIonicReact} from '@ionic/react';
import '@ionic/react/css/core.css';import '@ionic/react/css/normalize.css';import '@ionic/react/css/structure.css';import '@ionic/react/css/typography.css';import '@ionic/react/css/palettes/dark.class.css';
import '../../src/theme/variables.css';import {initializeTheme} from '../../src/ui/theme';import B1App from '../../src/auth/B1App';import {onlineClient} from '../../src/auth/onlineClient';import {installFrozenAndroid} from '../../src/native/frozenDemoAndroid';
const config=JSON.parse(import.meta.env.VITE_SLM_AUTH_PUBLIC_CONFIG);initializeTheme({palettes:true});setupIonicReact({hardwareBackButton:true});installFrozenAndroid();
const client=config.enabled?onlineClient(config):null;
createRoot(document.getElementById('root')!).render(<IonApp>{client?<B1App manager={client.manager} signupChallenge={client.signupChallenge} accountModel/>:<main className="slm-accounts"><p>Wariant testowy online pozostaje wyłączony.</p></main>}</IonApp>);

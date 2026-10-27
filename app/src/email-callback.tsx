import {createRoot} from 'react-dom/client';
import {IonApp,setupIonicReact} from '@ionic/react';
import '@ionic/react/css/core.css';import '@ionic/react/css/normalize.css';import '@ionic/react/css/structure.css';import '@ionic/react/css/typography.css';import '@ionic/react/css/palettes/dark.class.css';
import './theme/variables.css';import './demo/palettes.css';import './pages/Accounts.css';
import {initializeTheme} from './ui/theme';
import EmailCallback from './auth/EmailCallback';
import {readEmailCallback} from './auth/emailProof';
// Read once, then remove bearer data before rendering, requests, or navigation.
const proof=readEmailCallback(new URL(location.href));history.replaceState(null,'',location.pathname);
initializeTheme({palettes:true});setupIonicReact();
createRoot(document.getElementById('root')!).render(<IonApp><main className="slm-accounts slm-demo"><EmailCallback initial={proof}/></main></IonApp>);

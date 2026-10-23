import { createRoot } from 'react-dom/client';
import { IonApp, setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/palettes/dark.class.css';
import '../src/theme/variables.css';
import { initializeTheme } from '../src/ui/theme';
import Demo from '../src/ui/Demo';
import { installFrozenAndroid } from '../src/native/frozenDemoAndroid';

initializeTheme({palettes:true});
setupIonicReact({hardwareBackButton:true});
installFrozenAndroid();
createRoot(document.getElementById('root')!).render(<IonApp><Demo /></IonApp>);

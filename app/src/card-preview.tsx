// Standalone local Vite entry: no App, Auth, API or native initialization.
import { createRoot } from 'react-dom/client';
import { IonApp, setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/palettes/dark.class.css';
import './theme/variables.css';
import './demo/palettes.css';
import { initializeTheme } from './ui/theme';
import UltimatePlayerCard from './ui/UltimatePlayerCard';

initializeTheme({ palettes: true });
setupIonicReact();
createRoot(document.getElementById('root')!).render(
  <IonApp>
    <main className="slm-demo slm-players-screen slm-ultimate-profile"
      style={{ width: '100%', maxWidth: 430, margin: '0 auto', padding: 24, boxSizing: 'border-box', overflow: 'auto' }}>
      <UltimatePlayerCard name="Test Zawodnik" jerseyNumber={27} portrait={{ src: '/test-portrait.jpg' }} />
    </main>
  </IonApp>,
);

// Test-only entry: real navigation components/styles, no Auth or backend.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/palettes/dark.class.css';
import '../../src/theme/variables.css';
import BottomNav from '../../src/ui/BottomNav';
import type { Tab } from '../../src/ui/BottomNav';
import DemoBottomNav from '../../src/demo/DemoBottomNav';

setupIonicReact();
export function Example({ variant }: { variant: 'live' | 'premium' | 'admin' }) {
  const [active, setActive] = useState<Tab>('events');
  const [created, setCreated] = useState(0);
  return <section aria-label={variant} className={variant === 'live' ? '' : 'slm-demo'} style={{ marginBlock: 35 }}>
    <h2 style={{ fontSize: 12 }}>{variant}</h2>
    {variant === 'live' ? <BottomNav active={active} onSelect={setActive} /> :
      <DemoBottomNav active={active} onSelect={setActive} canCreate={variant === 'admin'} onCreate={() => setCreated(value => value + 1)} />}
    <output aria-label="Utworzone">{created}</output>
  </section>;
}
createRoot(document.getElementById('root')!).render(<main>{(['live', 'premium', 'admin'] as const).map(variant => <Example key={variant} variant={variant} />)}</main>);

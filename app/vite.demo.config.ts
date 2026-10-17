import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('.', import.meta.url));
// Explicit allowlist: accidentally importing App/Auth/Edge fails the build.
const allowed = new Set([
  'demo/index.html', 'demo/main.tsx', 'src/ui/Demo.tsx', 'src/ui/DemoMatchDetails.tsx', 'src/ui/MatchHero.tsx',
  'src/ui/MatchCapacityProgress.tsx', 'src/ui/capacity.ts', 'src/ui/BottomNav.tsx',
  'src/ui/AppearanceSettings.tsx', 'src/ui/MatchSections.tsx', 'src/ui/MatchTabs.tsx', 'src/ui/theme.ts', 'src/theme/variables.css',
  'src/pages/Accounts.css',
]);
export default defineConfig({
  root: fileURLToPath(new URL('./demo', import.meta.url)),
  envDir: false,
  envPrefix: [],
  publicDir: false,
  plugins: [react(), {
    name: 'demo-isolation',
    generateBundle(_, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const raw of Object.keys(output.modules)) {
          const id = raw.split('?')[0];
          if (id.startsWith(app) && !id.includes('/node_modules/') && !allowed.has(id.slice(app.length)))
            this.error(`Non-demo module in demo bundle: ${id.slice(app.length)}`);
        }
      }
      for (const name of ['stadium.svg', 'match-evening.jpg']) this.emitFile({ type: 'asset', fileName: `images/${name}`,
        source: readFileSync(new URL(`./public/images/${name}`, import.meta.url)) });
      this.emitFile({ type: 'asset', fileName: 'assets/branding/slm-crest-espana.svg', source: readFileSync(new URL('./public/assets/branding/slm-crest-espana.svg', import.meta.url)) });
    },
  }],
  preview: { host: '127.0.0.1', port: 5175, strictPort: true, headers: Object.fromEntries(JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')).headers[0].headers.map((h: { key: string; value: string }) => [h.key, h.value])) },
  build: { outDir: '../dist-demo', emptyOutDir: true, sourcemap: false },
});

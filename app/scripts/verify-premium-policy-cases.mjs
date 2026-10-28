import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {verifyPremiumRuntime} from './premium-route-policy.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>readFileSync(root+'/'+p,'utf8');
test('actual source graph passes',()=>assert.equal(verifyPremiumRuntime(root).frozen,55));
for(const [label,path,mutate] of [
 ['B1 bypasses live wrapper','app/src/auth/B1App.tsx',s=>s.replace('../events/PremiumWorld','../demo/App')],
 ['world replaces event slot','app/src/events/PremiumWorld.tsx',s=>s.replace('eventsView=','unusedView=')],
 ['details replaces original pitch','app/src/events/PremiumTeams.tsx',s=>s.replace('../ui/PremiumPitch','../ui/MatchSections')],
 ['cards replaced in rendering','app/src/events/PremiumEvents.tsx',s=>s.replace('<MatchHero compact','<section compact')],
 ['Android HTML uses a different entry','app/android-stage3/index.html',s=>s.replace('./main.tsx','../demo/main.tsx')],
 ['main switches to demo','app/src/App.tsx',()=>"export {default} from './ui/Demo';"],
 ['contract hash self-approval','app/scripts/premium318-contract.json',s=>{const j=JSON.parse(s);j.files['app/src/ui/UltimatePlayerCard.tsx'].sha256='0'.repeat(64);return JSON.stringify(j);}],
 ['Capacitor uses a hidden replacement','app/capacitor.config.ts',s=>s.replace('webDir:',"webDir: true ? 'dist-demo' :")],
 ['Vite redirects Premium entry','app/vite.b1.config.ts',s=>s.replace("'./b1'","'./demo'")],
 ['build script bypass','app/package.json',s=>{const j=JSON.parse(s);j.scripts.build='vite build --config other.ts';return JSON.stringify(j);}],
 ['alternate build alias','app/package.json',s=>{const j=JSON.parse(s);j.scripts['build:evil']='vite other';return JSON.stringify(j);}],
 ['frozen list shrinks','app/scripts/premium318-contract.json',s=>{const j=JSON.parse(s);delete j.files['app/src/ui/UltimatePlayerCard.tsx'];return JSON.stringify(j);}],
])test('rejects '+label,()=>{verifyPremiumRuntime(root);assert.throws(()=>verifyPremiumRuntime(root,{[path]:mutate(read(path))}));});

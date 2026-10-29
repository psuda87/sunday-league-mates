import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyPremiumRuntime,APPROVED,LINEUPS_MIGRATION} from './premium-route-policy.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>readFileSync(root+'/'+p,'utf8');
test('actual source graph passes',()=>assert.equal(verifyPremiumRuntime(root).frozen,55));
for(const [label,path,mutate] of [
 ['B1 bypasses live wrapper','app/src/auth/B1App.tsx',s=>s.replace('../events/PremiumWorld','../demo/App')],
 ['world replaces event slot','app/src/events/PremiumWorld.tsx',s=>s.replace('eventsView=','unusedView=')],
 ['details replaces original pitch','app/src/events/PremiumTeams.tsx',s=>s.replace('../ui/PremiumPitch','../ui/MatchSections')],
 ['Stage 1 event profile binding reverted','app/src/events/PremiumEvents.tsx',()=>execFileSync('git',['show',APPROVED+':app/src/events/PremiumEvents.tsx'],{cwd:root,encoding:'utf8'})],
 ['Stage 1 editor reverted','app/src/events/PremiumTeams.tsx',()=>execFileSync('git',['show',APPROVED+':app/src/events/PremiumTeams.tsx'],{cwd:root,encoding:'utf8'})],
 ['lineup ignores dirty comparison','app/src/events/lineupEditor.ts',s=>s.replace('.some(id => baseline[id] !== draft[id])','.some(() => false)')],
 ['restore loses baseline','app/src/events/lineupEditor.ts',s=>s.replace('draft: {...state.baseline}','draft: {}')],
 ['fake server save enabled','app/src/events/PremiumTeams.tsx',s=>s.replace('disabled aria-describedby={saveLimit}','aria-describedby={saveLimit}')],
 ['profile allows foreign identity','app/src/events/LineupPlayerProfile.tsx',s=>s.replace('if (p.user_id !== memberId)','if (false)')],
 ['profile adapter replaced','app/src/events/LineupPlayerProfile.tsx',()=>"export default function Profile(){return null;}"],
 ['original pitch geometry changed','app/src/ui/PremiumPitch.tsx',s=>s.replace('M4 80H96','M4 90H96')],
 ['BottomNav restyled','app/src/demo/DemoBottomNav.tsx',s=>s.replace('slm-demo-nav-notch','slm-demo-nav-notch-altered')],
 ['Ultimate component replaced','app/src/ui/UltimatePlayerCard.tsx',()=>"export default function Card(){return null;}"],
 ['lineup table RLS disabled',LINEUPS_MIGRATION,s=>s.replace('enable row level security','disable row level security')],
 ['lineup service RPC exposed',LINEUPS_MIGRATION,s=>s.replace('to service_role;','to authenticated,service_role;')],
 ['lineup no-op always writes',LINEUPS_MIGRATION,s=>s.replace('if changed then','if true then')],
 ['lineup CAS removed',LINEUPS_MIGRATION,s=>s.replace("raise exception 'lineup_version_conflict';",'null;')],
 ['lineup scope check removed',LINEUPS_MIGRATION,s=>s.replace('group_id=e.group_id and user_id=p_user','group_id=e.group_id')],
 ['lineup API author forged','app/supabase/functions/accounts/handler.ts',s=>s.replace('p_user:ctx.id,p_session:ctx.sid,p_action:action.slice(8)','p_user:body.user_id,p_session:ctx.sid,p_action:action.slice(8)')],
 ['cards replaced in rendering','app/src/events/PremiumEvents.tsx',s=>s.replace('<MatchHero compact','<section compact')],
 ['Android HTML uses a different entry','app/android-stage3/index.html',s=>s.replace('./main.tsx','../demo/main.tsx')],
 ['main switches to demo','app/src/App.tsx',()=>"export {default} from './ui/Demo';"],
 ['contract hash self-approval','app/scripts/premium318-contract.json',s=>{const j=JSON.parse(s);j.files['app/src/ui/UltimatePlayerCard.tsx'].sha256='0'.repeat(64);return JSON.stringify(j);}],
 ['Capacitor uses a hidden replacement','app/capacitor.config.ts',s=>s.replace('webDir:',"webDir: true ? 'dist-demo' :")],
 ['Vite redirects Premium entry','app/vite.b1.config.ts',s=>s.replace("'./b1'","'./demo'")],
 ['build script bypass','app/package.json',s=>{const j=JSON.parse(s);j.scripts.build='vite build --config other.ts';return JSON.stringify(j);}],
 ['alternate build alias','app/package.json',s=>{const j=JSON.parse(s);j.scripts['build:evil']='vite other';return JSON.stringify(j);}],
 ['frozen list shrinks','app/scripts/premium318-contract.json',s=>{const j=JSON.parse(s);delete j.files['app/src/ui/UltimatePlayerCard.tsx'];return JSON.stringify(j);}],
])test('rejects '+label,()=>{verifyPremiumRuntime(root);const source=read(path),changed=mutate(source);assert.notEqual(changed,source,'Mutation must exercise a real source change');assert.throws(()=>verifyPremiumRuntime(root,{[path]:changed}));});

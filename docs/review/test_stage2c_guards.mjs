// Real current Premium/consolidation guards, mutations in a private temporary copy.
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,copyFileSync,unlinkSync,symlinkSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {verifyPremiumRuntime} from '../../app/scripts/premium-route-policy.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root});
const temporary=mkdtempSync(path.join(tmpdir(),'slm-stage2c-guard-'));
const verifiedTemp=realpathSync(temporary);
assert(path.dirname(verifiedTemp)===realpathSync(tmpdir())&&path.basename(verifiedTemp).startsWith('slm-stage2c-guard-'));
let passed=0;
try{
 for(const name of git('ls-files','--','app').toString().trim().split('\n')){
  const target=path.join(temporary,name);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(path.join(root,name),target);
 }
 copyFileSync(path.join(root,'vercel.json'),path.join(temporary,'vercel.json'));
 writeFileSync(path.join(temporary,'.git'),'gitdir: '+git('rev-parse','--absolute-git-dir').toString().trim()+'\n');
 symlinkSync(path.join(root,'app/node_modules'),path.join(temporary,'app/node_modules'),'junction');
 const consolidation=()=>spawnSync(process.execPath,[path.join(temporary,'app/scripts/verify-consolidation.mjs')],{cwd:temporary,encoding:'utf8'});
 assert.equal(verifyPremiumRuntime(temporary).frozen,55);passed++;
 const migration='app/supabase/migrations/99999999999999_unapproved43.sql';
 writeFileSync(path.join(temporary,migration),'select 1;');
 assert.throws(()=>verifyPremiumRuntime(temporary));unlinkSync(path.join(temporary,migration));passed++;
 const historical=git('ls-tree','-r','--name-only','e04d9a47560de36657da76f12ae63e20ef2299cb','--','app/supabase/migrations').toString().trim().split('\n');
 assert.equal(historical.length,41);
 const extra=['app/supabase/migrations/20261030090000_public_match_discovery.sql','app/supabase/functions/accounts/handler.ts',
  'app/src/auth/B1App.tsx','app/src/auth/tokenStore.ts','app/src/finance/PremiumFinance.tsx','app/src/finance/premiumFinance.css',
  'app/src/events/PremiumTeams.tsx','app/src/events/usePremiumLineup.ts','app/src/events/lineupEditor.ts',
  'app/src/events/PremiumEvents.tsx','app/src/events/usePremiumEvents.ts','app/src/events/premiumContracts.ts',
  'app/src/ui/UltimatePlayerCard.tsx','app/src/ui/PremiumPitch.tsx'];
 for(const name of [...historical,...extra]){
  const original=readFileSync(path.join(temporary,name),'utf8');
  let runtimeDenied=false;try{verifyPremiumRuntime(temporary,{[name]:original+'\n// unauthorized Stage2C mutation\n'});}catch{runtimeDenied=true;}
  if(!runtimeDenied){
   const file=path.join(temporary,name),bytes=readFileSync(file);
   try{writeFileSync(file,original+'\n-- unauthorized Stage2C mutation\n');assert.notEqual(consolidation().status,0,name);}
   finally{writeFileSync(file,bytes);}
   console.log('WARN standalone runtime does not pin '+name+'; actual consolidation rejects mutation');
  }
  passed++;
 }
 const baseline=consolidation();assert.equal(baseline.status,0,baseline.stderr);passed++;
 for(const name of [migration,historical[0]]){
  let original=null;try{original=readFileSync(path.join(temporary,name));}catch{/* extra43 is absent */}
  try{writeFileSync(path.join(temporary,name),'select 1; -- unauthorized mutation\n');assert.notEqual(consolidation().status,0);passed++;}
  finally{if(original)writeFileSync(path.join(temporary,name),original);else unlinkSync(path.join(temporary,name));}
 }
 console.log(`PASS ${passed} actual Premium/consolidation checks: all41 historical migrations, extra43, backend, Auth gate/vault, finance, lineups, runtime and protected UI`);
}finally{
 // Only the exact mkdtemp directory verified above; the dependency junction is
 // removed as a link, never traversed into the original workspace.
 assert(realpathSync(temporary)===verifiedTemp);rmSync(temporary,{recursive:true,force:true});
}

import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {LINEUPS_STAGE2A,LINEUPS_MIGRATION,DISCOVERY_SOURCE,DISCOVERY_MIGRATION} from './premium-route-policy.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('./consolidation-sources.json',import.meta.url),'utf8'));
assert.equal(execFileSync('git',['merge-base',manifest.main,'HEAD'],{cwd:repo,encoding:'utf8'}).trim(),manifest.main,'Must retain current main ancestry');
for(const [path,expected] of Object.entries({...manifest.main_migrations,...manifest.main_runtime})){
 const value=readFileSync(repo+path,'utf8').replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(value).digest('hex'),expected,'Protected main source modified: '+path);
}
const discoveryBase='e04d9a47560de36657da76f12ae63e20ef2299cb';
const historical=execFileSync('git',['ls-tree','-r','--name-only',discoveryBase,'--','app/supabase/migrations'],{cwd:repo,encoding:'utf8'}).trim().split('\n');
assert.equal(historical.length,41,'Exact Stage3B migration baseline');
assert.deepEqual(readdirSync(repo+'app/supabase/migrations').filter(p=>p.endsWith('.sql')).sort(),[...historical,DISCOVERY_MIGRATION].map(p=>p.split('/').at(-1)).sort(),'Unexpected migration/model activation');
for(const path of historical)assert.equal(readFileSync(repo+path,'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show',discoveryBase+':'+path],{cwd:repo,encoding:'utf8'}).replace(/\r\n/g,'\n'),'Stage3B migration changed: '+path);
for(const path of [DISCOVERY_MIGRATION,'app/supabase/functions/accounts/handler.ts'])assert.equal(readFileSync(repo+path,'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show',DISCOVERY_SOURCE+':'+path],{cwd:repo,encoding:'utf8'}).replace(/\r\n/g,'\n'),'Unreviewed discovery backend source: '+path);
const lineupMigration=readFileSync(repo+LINEUPS_MIGRATION,'utf8').replace(/\r\n/g,'\n');
assert.equal(lineupMigration,execFileSync('git',['show',LINEUPS_STAGE2A+':'+LINEUPS_MIGRATION],{cwd:repo,encoding:'utf8'}).replace(/\r\n/g,'\n'),'Unreviewed lineup migration');
for(const path of ['vercel.json','app/vercel.json']){
 const config=JSON.parse(readFileSync(repo+path,'utf8'));
 assert.equal(config.git?.deploymentEnabled,false,'Automatic deployment must stay disabled: '+path);
}
const prepare=readFileSync(new URL('./prepare-edge-local.py',import.meta.url),'utf8');
assert(!/premium318-live|\.worktrees|B22_LOCAL_ONLY/.test(prepare),'Local prep must use canonical sources only');
console.log('PASS consolidation: historical main sources unchanged, 42 exact versioned steps including pinned lineups and discovery, main ancestry, deployment disabled, canonical local preparation.');

import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {LINEUPS_STAGE2A,LINEUPS_MIGRATION} from './premium-route-policy.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('./consolidation-sources.json',import.meta.url),'utf8'));
assert.equal(execFileSync('git',['merge-base',manifest.main,'HEAD'],{cwd:repo,encoding:'utf8'}).trim(),manifest.main,'Must retain current main ancestry');
for(const [path,expected] of Object.entries({...manifest.main_migrations,...manifest.main_runtime})){
 const value=readFileSync(repo+path,'utf8').replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(value).digest('hex'),expected,'Protected main source modified: '+path);
}
assert.equal(readdirSync(repo+'app/supabase/migrations').filter(p=>p.endsWith('.sql')).length,41);
const lineupMigration=readFileSync(repo+LINEUPS_MIGRATION,'utf8').replace(/\r\n/g,'\n');
assert.equal(lineupMigration,execFileSync('git',['show',LINEUPS_STAGE2A+':'+LINEUPS_MIGRATION],{cwd:repo,encoding:'utf8'}).replace(/\r\n/g,'\n'),'Unreviewed lineup migration');
for(const path of ['vercel.json','app/vercel.json']){
 const config=JSON.parse(readFileSync(repo+path,'utf8'));
 assert.equal(config.git?.deploymentEnabled,false,'Automatic deployment must stay disabled: '+path);
}
const prepare=readFileSync(new URL('./prepare-edge-local.py',import.meta.url),'utf8');
assert(!/premium318-live|\.worktrees|B22_LOCAL_ONLY/.test(prepare),'Local prep must use canonical sources only');
console.log('PASS consolidation: historical main sources unchanged, 41 versioned steps including pinned lineups, main ancestry, deployment disabled, canonical local preparation.');

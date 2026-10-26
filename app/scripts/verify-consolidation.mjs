import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('./consolidation-sources.json',import.meta.url),'utf8'));
assert.equal(execFileSync('git',['merge-base',manifest.main,'HEAD'],{cwd:repo,encoding:'utf8'}).trim(),manifest.main,'Must retain current main ancestry');
for(const [path,expected] of Object.entries({...manifest.main_migrations,...manifest.main_runtime})){
 const value=readFileSync(repo+path,'utf8').replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(value).digest('hex'),expected,'Protected main source modified: '+path);
}
assert.equal(readdirSync(repo+'app/supabase/migrations').filter(p=>p.endsWith('.sql')).length,35);
for(const path of ['vercel.json','app/vercel.json']){
 const config=JSON.parse(readFileSync(repo+path,'utf8'));
 assert.equal(config.git?.deploymentEnabled,false,'Automatic deployment must stay disabled: '+path);
}
const prepare=readFileSync(new URL('./prepare-edge-local.py',import.meta.url),'utf8');
assert(!/premium318-live|\.worktrees|B22_LOCAL_ONLY/.test(prepare),'Local prep must use canonical sources only');
console.log('PASS consolidation: 32 main migrations unchanged, 35 versioned steps, main ancestry, deployment disabled, canonical local preparation.');

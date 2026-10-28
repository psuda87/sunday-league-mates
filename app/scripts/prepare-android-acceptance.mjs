// Run from repository root. Only the dedicated 55321 test stack; never migrate/reset a database.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {cli,sql,assertIsolated,project,base} from './stabilization-local.mjs';
const source='39ef2e3937b781439864029a92c12de315024263';
const git=(args,encoding='utf8')=>execFileSync('git',args,{encoding,stdio:['ignore','pipe','pipe']});
const normalize=b=>b.toString('utf8').replace(/\r\n/g,'\n');
const files=git(['ls-tree','-r','--name-only',source,'--','app/supabase/migrations','app/supabase/functions']).trim().split('\n');
for(const f of files)assert.equal(normalize(readFileSync(f)),normalize(git(['show',source+':'+f],undefined)),'Backend source differs from PR24: '+f);
const stack='.cache/stabilization-stack';mkdirSync('.cache',{recursive:true});
if(!existsSync(stack+'/supabase/config.toml'))execFileSync(process.execPath,['app/scripts/prepare-stabilization-local.mjs'],{stdio:['ignore','pipe','pipe']});
// No stop, reset, migration up, link or remote API operation.
let edge;
try{edge=JSON.parse(execFileSync('docker',['inspect','supabase_edge_runtime_'+project],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0];}catch{}
if(!edge?.State.Running){
 const log=cli(['start','--workdir',stack,'--exclude','studio,realtime,imgproxy,logflare,vector,supavisor,mailpit,postgres-meta']);
 writeFileSync('.cache/android-acceptance-start-private.log',log); // CLI output may include local keys: never publish.
 edge=JSON.parse(execFileSync('docker',['inspect','supabase_edge_runtime_'+project],{encoding:'utf8'}))[0];
}
assertIsolated();assert.equal(edge.Config.Labels['com.supabase.cli.project'],project);
const expected=files.filter(f=>f.endsWith('.sql')&&f.includes('/migrations/')).map(f=>path.basename(f).split('_')[0]).sort();
assert.equal(sql("select string_agg(version,',' order by version) from supabase_migrations.schema_migrations"),expected.join(','),'Unexpected migration history: stop, do not migrate automatically');
assert.equal(sql("select to_regclass('public.slm_account_model_state') is null"),'t','Experimental Auth schema must be absent');
const mount=edge.Mounts.find(m=>m.Type==='bind'&&m.Source.replaceAll('\\','/').endsWith('/.cache/stabilization-stack/supabase/functions'));
assert(mount,'Unknown Edge function mount');
let mounted=mount.Source;
if(process.platform==='win32')mounted=mounted.replace(/^\/run\/desktop\/mnt\/host\/([a-z])\//,(_,drive)=>drive.toUpperCase()+':/');
const target=path.resolve(mounted),common=path.dirname(git(['rev-parse','--path-format=absolute','--git-common-dir']).trim());
assert(target.toLowerCase().startsWith((path.resolve(common)+path.sep).toLowerCase()),'Function mount outside this repository workspace');
// Refuse unknown drift, then copy only known canonical PR24 functions and the local CORS wrapper.
const writes=[];
for(const f of files.filter(f=>f.endsWith('.ts')&&f.includes('/functions/'))){
 const dest=path.join(target,path.relative('app/supabase/functions',f));const canonical=readFileSync(f);
 if(!existsSync(dest)||normalize(readFileSync(dest))!==normalize(canonical)){
  if(existsSync(dest)){
   const prior=normalize(readFileSync(dest));
   assert(f.endsWith('/_shared/webp.ts')&&prior.replace('extended:typeof image=null','extended:{width:number;height:number}|null=null')===normalize(canonical),'Unknown served source drift: '+f);
  }
  writes.push([dest,canonical]);
 }
}
const wrapper=readFileSync(stack+'/supabase/functions/accounts/stabilization-local.ts');
const entry=path.join(target,'accounts/stabilization-local.ts');
if(!existsSync(entry)||normalize(readFileSync(entry))!==normalize(wrapper)){writes.push([entry,wrapper]);}
for(const [dest,content] of writes){mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,content);}
if(writes.length)execFileSync('docker',['restart','supabase_edge_runtime_'+project],{stdio:['ignore','pipe','pipe']});
const results=[];
for(const origin of ['https://localhost','http://localhost','capacitor://localhost','https://not-allowed.invalid']){
 let response;
 for(let i=0;i<40;i++){
  try{response=await fetch(base+'/functions/v1/accounts',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'profile'}),signal:AbortSignal.timeout(1000)});if(response.status!==503&&response.status!==502)break;}catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 assert(response,'Local Edge unavailable');const allowed=origin!=='https://not-allowed.invalid';
 assert.equal(response.status,allowed?401:403);if(allowed)assert(['*',origin].includes(response.headers.get('access-control-allow-origin')),'Native CORS blocked');
 results.push({origin,status:response.status,allowOrigin:response.headers.get('access-control-allow-origin')});
}
writeFileSync('.cache/android-acceptance-backend.json',JSON.stringify({source,project,api:base,migrations:expected.length,cors:results,phoneApi:'http://127.0.0.1:64321',proposedReverse:'adb -s c7a559b5 reverse tcp:64321 tcp:55321',reverseExecuted:false},null,2));
console.log('PASS isolated PR24 backend: '+expected.length+' migrations; 3 native origins allowed, foreign origin denied. No phone tunnel/installation.');

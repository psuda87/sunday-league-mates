// Evaluate the REVIEW-ONLY patch with mocked metadata. No Docker, network,
// database, credentials or active guard changes. Run from the repository root.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const patch=readFileSync('docs/review/tito-local-stack-guard-proposed.patch','utf8').replaceAll('\r\n','\n');
function candidate(path){
 const input=readFileSync(path,'utf8').replaceAll('\r\n','\n').split('\n');
 const section=patch.split('--- a/'+path+'\n')[1].split(/\n--- a\//)[0].split('\n');
 const output=[];let cursor=0,inHunk=false;
 for(const line of section.slice(1)){
  if(line.startsWith('@@')){const start=Number(line.match(/@@ -(\d+)/)[1])-1;output.push(...input.slice(cursor,start));cursor=start;inHunk=true;continue;}
  if(!inHunk)continue;
  if(line.startsWith(' ')||line.startsWith('-')){assert.equal(input[cursor++],line.slice(1));if(line.startsWith(' '))output.push(line.slice(1));}
  else if(line.startsWith('+'))output.push(line.slice(1));
 }
 output.push(...input.slice(cursor));return output.join('\n').replace(/^import .*;\n/gm,'').replace(/\bexport /g,'');
}
const tito='codex/tito-lineups-completion',project='slm-main-stabilization';
const marker={branch:tito,project,prepared_at:'2026-11-10T22:30:00Z'};
function metadata(api=false){return {Created:'2026-11-10T22:31:00Z',Config:{Labels:{'com.supabase.cli.project':project,'com.supabase.cli.workdir':resolve('.cache/stabilization-stack')}},HostConfig:{PortBindings:{[api?'8000/tcp':'5432/tcp']:[{HostPort:api?'55321':'55322'}]}}};}
function runtime(change={}){
 const c={branch:tito,env:{},db:metadata(),api:metadata(true),marker:{...marker},cloud:false,...change};
 const calls=[];
 const exec=(name,args)=>{calls.push([name,args]);if(name==='git')return c.branch;if(name==='docker'&&args[0]==='inspect')return JSON.stringify([args[1].startsWith('supabase_db')?c.db:c.api]);throw Error('Forbidden subprocess');};
 const read=path=>path.endsWith('config.toml')?'project_id = "slm-main-stabilization"':JSON.stringify(c.marker);
 const fn=new Function('execFileSync','readFileSync','existsSync','resolve','assert','process',candidate('app/scripts/stabilization-local.mjs')+';return assertIsolated;');
 fn(exec,read,()=>c.cloud,resolve,assert,{env:c.env})();
 assert(!calls.some(([name,args])=>name==='docker'&&args[0]==='exec'));
}
runtime();let count=1;
for(const mutate of [
 ()=>({branch:'unapproved'}),()=>({env:{GITHUB_ACTIONS:'true',GITHUB_REF:'refs/heads/codex/tito-lineups-completion'}}),
 ()=>({cloud:true}),()=>({marker:{...marker,branch:'other'}}),
 ()=>({db:{...metadata(),Created:'2026-10-28T21:30:19Z'}}),
 ()=>{const db=metadata();db.Config.Labels['com.supabase.cli.workdir']='I:/retained-stack';return {db};},
 ()=>{const db=metadata();db.Config.Labels['com.supabase.cli.project']='production';return {db};},
 ()=>{const db=metadata();db.HostConfig.PortBindings['5432/tcp'][0].HostPort='54322';return {db};},
 ()=>{const api=metadata(true);api.HostConfig.PortBindings['8000/tcp'][0].HostPort='443';return {api};},
]){assert.throws(()=>runtime(mutate()));count++;}
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function prepare(change={}){
 const c={branch:tito,env:{},containers:'',volumes:'',cloud:false,busyPort:0,...change};
 const ready=Error('READY_FOR_SOURCE_COPY');
 const exec=(name,args)=>{if(name==='git')return c.branch;if(name==='docker')return args[0]==='ps'?c.containers:c.volumes;throw Error('Forbidden subprocess');};
 const exists=path=>path.endsWith('project-ref')&&c.cloud;
 const createServer=()=>{let fail;return {once:(_event,callback)=>{fail=callback;},listen:(port,_host,callback)=>{if(port===c.busyPort)fail(Error('EADDRINUSE'));else callback();},close:callback=>callback()};};
 // Success stops at mkdir, before even writing copied sources.
 const fn=new AsyncFunction('execFileSync','existsSync','readFileSync','mkdirSync','writeFileSync','readdirSync','assert','process','createServer',candidate('app/scripts/prepare-stabilization-local.mjs'));
 try{await fn(exec,exists,()=>'',()=>{throw ready;},()=>{throw Error('Unexpected write');},()=>[],assert,{env:c.env},createServer);throw Error('Unexpected fallthrough');}
 catch(error){if(error===ready)return true;throw error;}
}
assert(await prepare());count++;
for(const c of [{branch:'wrong'},{env:{GITHUB_ACTIONS:'true'}},{cloud:true},{containers:'retained-id'},{volumes:'retained-volume'},{busyPort:55321},{busyPort:55322}]){await assert.rejects(()=>prepare(c));count++;}
console.log(`PASS ${count} mocked guard-proposal cases. Patch NOT applied; SQL/real isolation NOT tested.`);

// Isolated PostgreSQL contract test. Auth/Storage are fixture contracts, NOT real Supabase.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const host=process.env.DOCKER_HOST??execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();
assert(host.startsWith('unix://')||host.startsWith('npipe://'),'Only local Docker sockets');
const name='slm-profile-contract-'+randomUUID();let assertions=0;
function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw Error(r.stderr||r.stdout||'Docker failed');assertions+=(r.stderr.match(/NOTICE:\s+PASS /g)??[]).length;return r.stdout;}
function sql(input){return docker(['exec','-i',name,'psql','-X','-At','-U','postgres','-v','ON_ERROR_STOP=1'],input);}
try{
 docker(['run','--detach','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
 let ready=false;for(let i=0;i<60;i++){const r=spawnSync('docker',['exec',name,'pg_isready','-U','postgres'],{stdio:'ignore'});if(r.status===0&&docker(['logs',name]).includes('init process complete')){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert(ready,'PostgreSQL startup');
 sql(readFileSync('supabase/tests/support/profile_contract_bootstrap.sql','utf8'));
 const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();for(const file of files)sql(readFileSync('supabase/migrations/'+file,'utf8'));
 sql(readFileSync('supabase/tests/premium_profile_name.sql','utf8').replace(/rollback;\s*$/,'commit;'));
 assert.equal(sql("select count(*) from public.slm_player_profiles where nickname='Independent';").trim(),'1');
 docker(['restart',name]);
 for(let i=0;i<60;i++){if(spawnSync('docker',['exec',name,'pg_isready','-U','postgres'],{stdio:'ignore'}).status===0)break;await new Promise(r=>setTimeout(r,500));}
 assert.equal(sql("select count(*) from public.slm_player_profiles where nickname='Independent';").trim(),'1');
 assert.equal(assertions,28,'All SQL assertions must execute');
 console.log(`PASS: ${assertions} SQL/RLS assertions, ${files.length} migrations replayed; profile SQL/RLS assertions; persisted nickname survives PostgreSQL restart. Auth/Storage are fixture contracts. No HTTP/Auth/Edge integration tested.`);
}finally{spawnSync('docker',['rm','--force',name],{stdio:'ignore'});}

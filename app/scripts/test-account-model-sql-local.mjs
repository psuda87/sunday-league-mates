// Isolated PostgreSQL contract test. Auth/Storage are fixture contracts, NOT real Supabase.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const host=process.env.DOCKER_HOST??execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();
assert(host.startsWith('unix://')||host.startsWith('npipe://'),'Only local Docker sockets');
const name='slm-identity-contract-'+randomUUID();let assertions=0;
function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw Error(r.stderr||r.stdout||'Docker failed');assertions+=(r.stderr.match(/NOTICE:\s+PASS /g)??[]).length;return r.stdout;}
function sql(input){return docker(['exec','-i',name,'psql','-X','-At','-U','postgres','-v','ON_ERROR_STOP=1'],input);}
try{
 docker(['run','--detach','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
 let ready=false;for(let i=0;i<60;i++){const r=spawnSync('docker',['exec',name,'pg_isready','-U','postgres'],{stdio:'ignore'});if(r.status===0&&docker(['logs',name]).includes('init process complete')){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert(ready,'PostgreSQL startup');
 sql(readFileSync('supabase/tests/support/profile_contract_bootstrap.sql','utf8'));
 sql("alter table auth.users add column deleted_at timestamptz, add column raw_app_meta_data jsonb default '{}'::jsonb;");
 const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();for(const file of files)sql(readFileSync('supabase/migrations/'+file,'utf8'));
 sql(readFileSync('supabase/tests/premium_profile_name.sql','utf8'));
 sql(readFileSync('supabase/tests/account_identity_foundation.sql','utf8'));
 sql(readFileSync('supabase/tests/account_model_candidate.sql','utf8'));
 sql(readFileSync('supabase/tests/account_model_contacts.sql','utf8'));
 sql(readFileSync('supabase/tests/account_email.sql','utf8'));
 sql(readFileSync('supabase/tests/online_admission.sql','utf8'));
 assert.equal(assertions,96,'All profile and foundation assertions must execute');
 console.log(`PASS: ${assertions} SQL/RLS assertions; ${files.length} migrations replayed; Auth/Storage are fixture contracts.`);
}finally{spawnSync('docker',['rm','--force',name],{stdio:'ignore'});}

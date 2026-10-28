import {assertLocalTestContext} from './local-test-context.mjs';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
assertLocalTestContext(branch);
const dir='.cache/stabilization-stack/supabase';
assert(!existsSync(dir+'/config.toml'),'Refusing to overwrite an existing local project; reuse it without resetting');
mkdirSync(dir+'/migrations',{recursive:true});
for(const name of readdirSync('app/supabase/migrations').sort())if(name.endsWith('.sql'))writeFileSync(dir+'/migrations/'+name,readFileSync('app/supabase/migrations/'+name));
function copy(src,dest){mkdirSync(dest,{recursive:true});for(const e of readdirSync(src,{withFileTypes:true}))if(e.isDirectory())copy(src+'/'+e.name,dest+'/'+e.name);else if(e.name.endsWith('.ts'))writeFileSync(dest+'/'+e.name,readFileSync(src+'/'+e.name));}
copy('app/supabase/functions',dir+'/functions');
writeFileSync(dir+'/functions/accounts/stabilization-local.ts',`import {createHandler} from './handler.ts';
declare const Deno:{env:{get(n:string):string|undefined};serve(h:(r:Request)=>Promise<Response>):void};
const url=Deno.env.get('SUPABASE_URL')??'';
if(!['http://kong:8000','http://127.0.0.1:55321'].includes(url))throw Error('Local isolation required');
Deno.serve(createHandler({url,anon:Deno.env.get('SUPABASE_ANON_KEY')??'',service:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',origins:['http://127.0.0.1:5196','http://localhost:5196','https://localhost','http://localhost','capacitor://localhost']}));
`);
writeFileSync(dir+'/config.toml',`project_id = "slm-main-stabilization"
[api]
port = 55321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
[db]
port = 55322
shadow_port = 55320
major_version = 17
[db.seed]
enabled = false
[studio]
enabled = false
[realtime]
enabled = false
[local_smtp]
enabled = false
[storage]
enabled = true
[analytics]
enabled = false
[auth]
site_url = "http://127.0.0.1:5196"
enable_signup = false
[auth.email]
enable_signup = true
[edge_runtime]
enabled = true
policy = "per_worker"
inspector_port = 55328
[functions.accounts]
verify_jwt = false
entrypoint = "./functions/accounts/stabilization-local.ts"
`);
console.log('Prepared isolated local test sources; no credentials, reset or Cloud operation.');

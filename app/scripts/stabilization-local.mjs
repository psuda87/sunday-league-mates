// Dedicated disposable test project only. Never read a linked/cloud/POCO project.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
export const project='slm-main-stabilization',base='http://127.0.0.1:55321';
export function cli(args){return execFileSync(process.platform==='win32'?'cmd':'npx',process.platform==='win32'?['/c','npx','--yes','--package=supabase@2.121.0','supabase',...args]:['--yes','--package=supabase@2.121.0','supabase',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
export function assertIsolated(){
 const branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
 assert(branch==='chore/main-stabilization'||process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REF==='refs/heads/chore/main-stabilization');
 assert.match(readFileSync('.cache/stabilization-stack/supabase/config.toml','utf8'),/project_id = "slm-main-stabilization"/);
 const info=JSON.parse(execFileSync('docker',['inspect','supabase_db_'+project],{encoding:'utf8'}));
 assert.equal(info[0].Config.Labels['com.supabase.cli.project'],project);
}
export function localKeys(){assertIsolated();const raw=cli(['status','--workdir','.cache/stabilization-stack','-o','json']);const keys=JSON.parse(raw.slice(raw.indexOf('{')));assert.equal(keys.API_URL,base);return keys;}
export function sql(query){assertIsolated();return execFileSync('docker',['exec','-i','supabase_db_'+project,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}

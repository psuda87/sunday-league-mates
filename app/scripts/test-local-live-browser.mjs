// Reuse the unchanged Stage2B browser assertions on the existing real local stack.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const fixture=JSON.parse(readFileSync('.cache/live-backend/poco-fixture/account.private.json','utf8'));
assert.equal(fixture.project,'slm-main-stabilization');assert.equal(fixture.api,'http://127.0.0.1:55321');
async function api(user,action,body={}) {
 const r=await fetch(fixture.api+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.access_token}:{})},body:JSON.stringify({action,...body})});
 const data=await r.json();assert(r.ok,action+' HTTP'+r.status+' '+String(data.code??''));return data;
}
const users=[];
for(const label of ['member','admin']) {
 const creds=fixture[label];const session=await api(null,'login',{identifier:creds.login,password:creds.password});
 const groups=await api(session,'groups_list');assert(groups.groups.some(g=>g.id===fixture.groupId&&g.name.startsWith('SLM LIVE test ')));
 users.push(session);
}
const write=(u,a,b)=>api(u,a,{...b,request_id:randomUUID()});
const event=(await write(users[0],'matches_create',{group_id:fixture.groupId,name:'LIVE browser '+randomUUID().slice(0,8),visibility:'private',date:'2099-01-03',time:'18:00',location:'Lokalny test UI/API',duration_minutes:90,capacity:15,cost_cents:0})).event_id;
for(const u of users) await write(u,'matches_join',{event_id:event});
for(let i=0;i<9;i++) await write(users[0],'matches_guest',{event_id:event,guest_name:'Gosc browser '+i,list:'registered'});
const bootstrap={proxy:fixture.api,eventId:event,groupId:fixture.groupId,users:users.map(u=>({id:u.user_id,refresh:u.refresh_token}))};
// Only artifact destination changes; all 14 assertions and test behavior remain
// byte-identical. Do not overwrite tracked screenshots or touch existing tests.
const source=readFileSync('app/scripts/test-lineups-ui-browser.mjs','utf8');
const original="const out = path.resolve('docs/ui/lineups-stage2b');";
assert.equal(source.split(original).length,2);
const copy=source.replace(original,"const out = path.resolve('.cache/live-backend/browser-shots');");
mkdirSync('app/.cache',{recursive:true});const runner=resolve('app/.cache/local-live-browser-runner.mjs');writeFileSync(runner,copy);
const result=spawnSync(process.execPath,[runner],{cwd:root,input:JSON.stringify(bootstrap),encoding:'utf8',timeout:300000});
if(result.stdout)process.stdout.write(result.stdout);
if(result.status!==0) {if(result.stderr)process.stderr.write(result.stderr);process.exit(result.status??1);}
assert(result.stdout.includes('UI_RESULT 14 PASS'));

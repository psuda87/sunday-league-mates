// Real local API only; own temporary fictional world. Credentials stay in RAM/stdin.
import {randomUUID,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {assertBranch,assertSafeConfig,management,server,url} from './accounts-admin-local.mjs';
import {cleanupScopedFixture} from './scoped-cleanup-local.mjs';
let api;const ids=[],groups=[];
async function call(action,body={},session){const r=await fetch(url+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({...body,action}),signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok)throw Error(action+' HTTP '+r.status);return data;}
const write=(action,body,session)=>call(action,{...body,request_id:randomUUID()},session);
try{
 assertBranch();assertSafeConfig(await management('/config/auth'));api=await server();
 const sessions=[];let email,password;
 for(let i=0;i<6;i++){
  const e=randomUUID()+'@fixture.invalid',p=randomBytes(24).toString('base64url')+'Aa1!';
  const u=await api.request('/auth/v1/admin/users','POST',{email:e,password:p,email_confirm:true});if(!u.ok)throw Error('Own fixture creation failed');ids.push(u.data.id);
  const s=await call('login',{identifier:e,password:p});sessions.push(s);
  await call('save_email_profile',{nickname:['TEST Aleksander','TEST Bartosz','TEST Cezary','TEST Damian','TEST Emil','TEST Filip'][i],phone:'',current_password:p},s);
  if(i===0){email=e;password=p;}
 }
 const owner=sessions[0],g=await write('groups_create',{name:'TEST Premium 3.20',description:'Tymczasowe dane do audytu wizualnego'},owner);groups.push(g.group_id);
 for(const s of sessions.slice(1)){
  await write('groups_invite',{group_id:g.group_id,user_id:s.user_id},owner);
  const invite=(await call('groups_inbox',{},s)).requests.find(r=>r.group_id===g.group_id);
  await write('groups_decide',{id:invite.id,accept:true},s);
 }
 const m=await write('matches_create',{group_id:g.group_id,name:'TEST Premium — mecz kontrolny',visibility:'private',date:'2099-10-19',time:'19:00',location:'TEST Boisko',duration_minutes:90,capacity:14,cost_cents:27000},owner);
 for(const s of sessions)await write('matches_join',{event_id:m.event_id},s);
 for(let i=1;i<=4;i++)await write('matches_guest',{event_id:m.event_id,guest_name:'TEST Gość '+i,guest_phone:'',list:'registered'},owner);
 await write('matches_guest',{event_id:m.event_id,guest_name:'TEST Rezerwa',guest_phone:'',list:'reserve'},owner);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const run=spawnSync(process.execPath,['scripts/live-ui-runner-local.mjs'],{env,input:JSON.stringify({slm_email:email,slm_password:password,slm_visual320:true}),encoding:'utf8',timeout:180000,stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024});
 const line=run.stdout?.split(/\r?\n/).findLast(s=>s.startsWith('SLM_LIVE_RESULT '));if(!line)throw Error('Sanitized browser result missing');
 const result=JSON.parse(line.slice(16));console.log('REAL PREMIUM320 VISUAL/API: '+result.passed+' PASS, '+result.failed+' FAIL');
 for(const failure of result.failures)console.log(failure);if(result.failed)process.exitCode=1;
}catch(e){console.log('FAIL '+e.message);process.exitCode=1;}
finally{await cleanupScopedFixture(api,ids,groups);}

import {randomUUID,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {assertBranch,assertSafeConfig,management,server} from './accounts-admin-local.mjs';
import {cleanupScopedFixture} from './scoped-cleanup-local.mjs';
let api;const ids=[],groups=[];
try{
 assertBranch();assertSafeConfig(await management('/config/auth'));api=await server();
 const email=randomUUID()+'@fixture.invalid',password=randomBytes(24).toString('base64url')+'Aa1!';
 const u=await api.request('/auth/v1/admin/users','POST',{email,password,email_confirm:true});
 if(!u.ok)throw new Error('Cannot create own fictional local fixture');ids.push(u.data.id);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const run=spawnSync(process.execPath,['scripts/live-ui-runner-local.mjs'],{env,input:JSON.stringify({slm_email:email,slm_password:password}),encoding:'utf8',timeout:180000,stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024});
 const line=run.stdout?.split(/\r?\n/).findLast(x=>x.startsWith('SLM_LIVE_RESULT '));
 if(!line)throw new Error('Local Cypress returned no sanitized report');
 const result=JSON.parse(line.slice(16));
 console.log('REAL BROWSER → LOCAL EDGE → POSTGRES: '+result.passed+' PASS, '+result.failed+' FAIL');
 for(const failure of result.failures)console.log(failure);
 if(result.failed)process.exitCode=1;
}catch(e){console.log('FAIL '+e.message);process.exitCode=1;}
finally{
 if(ids.length){const own=await api.request('/rest/v1/slm_groups?admin_id=eq.'+ids[0]+'&select=id');if(!own.ok)throw new Error('Cannot scope own fixture cleanup');groups.push(...own.data.map(g=>g.id));}
 await cleanupScopedFixture(api,ids,groups);
}

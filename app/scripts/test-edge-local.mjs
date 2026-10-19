// Local HTTP smoke tests; no production keys, SMTP, SMS or FCM traffic.
import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {assertBranch,assertSafeConfig,management,server,url} from './accounts-admin-local.mjs';
assertBranch();assertSafeConfig(await management('/config/auth'));
const api=await server();let count=0;
function check(value,name){if(!value)throw Error('FAIL '+name);count++;console.log('PASS '+name);}
const signup=await api.request('/auth/v1/signup','POST',{email:randomUUID()+'@fixture.invalid',password:randomBytes(24).toString('base64url')},null,false);
check(!signup.ok,'current local Auth rejects public signup (new email model not activated)');
const health=await api.request('/auth/v1/health','GET',undefined,null,false);check(health.ok,'Auth HTTP health');
const missing=await fetch(url+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'profile'})});
check(missing.status===401,'accounts HTTP rejects missing session');
const malformed=await fetch(url+'/functions/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+randomUUID()},body:JSON.stringify({action:'profile'})});
check(malformed.status===401,'accounts HTTP rejects invalid token');
const allowed=await fetch(url+'/functions/v1/accounts',{method:'OPTIONS',headers:{Origin:'http://localhost:5174'}});
check(allowed.ok&&['*','http://localhost:5174'].includes(allowed.headers.get('access-control-allow-origin')),'CORS allows the actual local UI origin');
const hostile=await fetch(url+'/functions/v1/accounts',{method:'OPTIONS',headers:{Origin:'https://untrusted.fixture.invalid'}});
check(hostile.status===403,'handler rejects untrusted origin despite local Kong CORS header');
const method=await fetch(url+'/functions/v1/accounts');check(method.status===405,'accounts HTTP rejects wrong method');
const denied=await fetch(url+'/functions/v1/push-worker',{method:'POST'});check(denied.status===403,'push worker requires its dedicated secret');
const env=readFileSync(new URL('../../.cache/http-edge/worker.env',import.meta.url),'utf8');
const secret=env.split(/\r?\n/).find(line=>line.startsWith('PUSH_WORKER_SECRET='))?.slice('PUSH_WORKER_SECRET='.length);
if(!secret)throw Error('Missing ignored local worker secret');
const worker=await fetch(url+'/functions/v1/push-worker',{method:'POST',headers:{Authorization:'Bearer '+secret}});
const data=await worker.json();check(worker.ok&&data.status==='fcm_unconfigured'&&data.claimed===0,'worker without FCM does not claim/send jobs');
console.log('RESULT '+count+' local HTTP checks PASS; real SMTP/FCM NOT TESTED');

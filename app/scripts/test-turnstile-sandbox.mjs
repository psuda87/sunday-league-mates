// Public provider-documented testing credentials ONLY; never an app activation/config.
import assert from 'node:assert/strict';
let count=0;
for(const prefix of ['1','2','3']){
 const secret=prefix+'x0000000000000000000000000000000AA';
 const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,response:'XXXX.DUMMY.TOKEN.XXXX'}),signal:AbortSignal.timeout(10000)});const data=await r.json();assert(r.ok);assert.equal(data.success,prefix==='1');if(prefix==='3')assert(data['error-codes'].includes('timeout-or-duplicate'));count++;console.log('PASS Cloudflare published sandbox case '+prefix);
}
console.log('TURNSTILE SANDBOX '+count+' PASS; public dummy credentials; production widget/WebView NOT TESTED.');

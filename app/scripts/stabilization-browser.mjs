import cypress from 'cypress';
import {readFileSync} from 'node:fs';
delete process.env.ELECTRON_RUN_AS_NODE;
const env=JSON.parse(readFileSync('.cache/behavior-fixture.json','utf8'));
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch('http://127.0.0.1:5196/',{signal:AbortSignal.timeout(500)})).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Isolated UI not ready');
 const r=await cypress.run({project:'app',browser:'chrome',quiet:true,config:{scrollBehavior:'center',baseUrl:'http://127.0.0.1:5196',video:false,trashAssetsBeforeRuns:false,screenshotOnRunFailure:false,screenshotsFolder:'../docs/ui/main-stabilization',e2e:{specPattern:'cypress/premium-behavior.cy.ts'}},env});
 const redact=s=>{s=String(s??'');for(const v of Object.values(env))if(typeof v==='string')s=s.split(v).join('[REDACTED]');return s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[TOKEN]');};
 console.log(JSON.stringify({passed:r.totalPassed,failed:r.totalFailed,message:redact(r.message),failures:(r.runs??[]).flatMap(x=>x.tests??[]).filter(x=>x.state==='failed').map(x=>redact(x.displayError))}));if(r.totalFailed||!r.totalTests)process.exitCode=1;
}catch{console.log('Browser failed; sensitive output withheld');process.exitCode=1;}

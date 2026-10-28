import cypress from 'cypress';
import {readFileSync} from 'node:fs';
delete process.env.ELECTRON_RUN_AS_NODE;
const text=readFileSync(process.env.TEMP+'/SLM-STAGE3-POCO.txt','utf8');
const records=[...text.matchAll(/Login: (.+)\r?\nHaslo: (.+)/g)];
if(records.length!==2)throw Error('Local credentials file missing');
const env={mode:process.argv[2]??'after',player_email:records[0][1].trim(),player_password:records[0][2].trim(),admin_email:records[1][1].trim(),admin_password:records[1][2].trim()};
try{
 const r=await cypress.run({project:'app',browser:'chrome',quiet:true,config:{trashAssetsBeforeRuns:false,baseUrl:'http://127.0.0.1:5186',video:false,screenshotOnRunFailure:false,screenshotsFolder:'../docs/ui/premium-ui-restore',e2e:{specPattern:'cypress/premium-ui-restore.cy.ts'}},env});
 const redact=s=>{s=String(s??'');for(const v of Object.values(env))s=s.split(v).join('[REDACTED]');return s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[TOKEN]');};
 console.log(JSON.stringify({message:redact(r.message),passed:r.totalPassed,failed:r.totalFailed,failures:(r.runs??[]).flatMap(x=>x.tests??[]).filter(x=>x.state==='failed').map(x=>redact(x.displayError))}));
 if(r.totalFailed||!r.totalTests)process.exitCode=1;
}catch{console.log('Browser runner failed; sensitive output withheld');process.exitCode=1;}

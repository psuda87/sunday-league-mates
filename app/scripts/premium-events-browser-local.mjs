// Credentials in stdin only; no real responses mocked and no secrets printed.
import cypress from 'cypress';
let input='';for await(const chunk of process.stdin)input+=chunk;
const env=JSON.parse(input);input='';
try{
 const result=await cypress.run({project:'app',browser:'chrome',quiet:true,config:{baseUrl:'http://127.0.0.1:5185',video:false,screenshotOnRunFailure:false,screenshotsFolder:'../docs/ui/premium-real-events',e2e:{specPattern:'cypress/premium-real-events.cy.ts'}},env});
 const redact=value=>{let s=String(value??'');for(const v of Object.values(env))if(typeof v==='string')s=s.split(v).join('[REDACTED]');return s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[TOKEN]');};
 console.log('PREMIUM_BROWSER_RESULT '+JSON.stringify({passed:result.totalPassed??0,failed:result.totalFailed??1,failures:[...(result.message?[redact(result.message)]:[]),...(result.runs??[]).flatMap(r=>r.tests??[]).filter(t=>t.state==='failed').map(t=>redact(t.displayError))]}));
}catch{console.log('PREMIUM_BROWSER_RESULT '+JSON.stringify({passed:0,failed:1,failures:['Local browser runner failed; sensitive output withheld']}));}

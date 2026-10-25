// Credentials only over stdin; no screenshots of login, videos or unredacted errors.
import cypress from 'cypress';
let input='';for await(const chunk of process.stdin)input+=chunk;const env=JSON.parse(input);input='';
try{
 const result=await cypress.run({browser:'chrome',quiet:true,config:{baseUrl:'http://127.0.0.1:5173',video:false,screenshotOnRunFailure:false,trashAssetsBeforeRuns:false,screenshotsFolder:'../.cache/b3/browser',e2e:{specPattern:'cypress/b3/groups.cy.ts'}},env});
 const sanitize=value=>{let s=String(value??'');for(const v of Object.values(env))s=s.split(v).join('[REDACTED]');return s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED_TOKEN]');};
 console.log('SLM_B3_RESULT '+JSON.stringify({passed:result.totalPassed??0,failed:result.totalFailed??1,failures:(result.runs??[]).flatMap(r=>r.tests??[]).filter(t=>t.state==='failed').map(t=>sanitize(t.displayError))}));
}catch{console.log('SLM_B3_RESULT '+JSON.stringify({passed:0,failed:1,failures:['Browser failed; sensitive output suppressed']}));}

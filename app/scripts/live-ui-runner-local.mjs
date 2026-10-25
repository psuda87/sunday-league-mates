// Credentials arrive over stdin, never command-line args or disk.
import cypress from 'cypress';
let input='';for await(const chunk of process.stdin)input+=chunk;
const env=JSON.parse(input);input='';
const localPort=process.env.SLM_LOCAL_UI_PORT??'5174';
if(!/^\d{4,5}$/.test(localPort)||Number(localPort)>65535)throw new Error('Invalid local preview port');
try{
 const result=await cypress.run({browser:'chrome',quiet:true,config:{baseUrl:'http://127.0.0.1:'+localPort,video:false,screenshotOnRunFailure:false,e2e:{specPattern:'cypress/live/scoped.cy.ts'}},env});
 const sanitize=value=>{let s=String(value??'');for(const v of Object.values(env))if(typeof v==='string'&&v)s=s.split(v).join('[REDACTED]');return s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED_TOKEN]');};
 console.log('SLM_LIVE_RESULT '+JSON.stringify({passed:result.totalPassed??0,failed:result.totalFailed??1,failures:(result.runs??[]).flatMap(r=>r.tests??[]).filter(t=>t.state==='failed').map(t=>sanitize(t.displayError))}));
}catch{console.log('SLM_LIVE_RESULT '+JSON.stringify({passed:0,failed:1,failures:['Cypress local runner failed; sensitive output suppressed']}));}

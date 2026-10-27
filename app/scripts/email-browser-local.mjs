// Private test input via stdin. Never print delivered links, passwords or Cypress traces.
import {readFileSync} from 'node:fs';
delete process.env.ELECTRON_RUN_AS_NODE;
const input=JSON.parse(readFileSync(0,'utf8'));
const cypress=(await import('cypress')).default;
const r=await cypress.run({project:'app',browser:'chrome',quiet:true,env:{slm_email_link:input.link,slm_email_kind:input.kind,slm_email_password:input.password??''},config:{baseUrl:'http://127.0.0.1:5182',video:false,screenshotOnRunFailure:false,e2e:{specPattern:'cypress/email-callback.cy.ts'}}});
console.log('EMAIL_BROWSER_RESULT '+JSON.stringify({passed:r.totalPassed,failed:r.totalFailed,errors:r.runs?.flatMap(run=>run.tests.filter(t=>t.state==='failed').map(t=>String(t.displayError).replace(/https?:\/\/[^\s'"<>]+/g,'[URL]').replace(/[a-f0-9]{64}/gi,'[TOKEN]').replaceAll(input.password??'__none__','[PASSWORD]')))}));process.exitCode=r.totalFailed?1:0;

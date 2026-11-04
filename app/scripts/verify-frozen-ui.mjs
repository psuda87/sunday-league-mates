import {verifyPremiumRuntime,MINIMUM_PHONE_SOURCE,AUTH_WEB_SOURCE,AUTH_WEB_PRESENTATION} from './premium-route-policy.mjs';
import {execFileSync} from 'node:child_process';
// Self-contained source checks: no sibling checkout, cache or fetched reference branch required.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const contract=JSON.parse(readFileSync(new URL('./premium318-contract.json',import.meta.url),'utf8'));
for(const [path,expected] of Object.entries(contract.files)){
 let value=readFileSync(repo+path);
 if(expected.text)value=Buffer.from(value.toString('utf8').replace(/\r\n/g,'\n'));
 const approved=path===AUTH_WEB_PRESENTATION?createHash('sha256').update(execFileSync('git',['show',AUTH_WEB_SOURCE+':'+path],{cwd:repo,encoding:'utf8'}).replace(/\r\n/g,'\n')).digest('hex'):path==='app/src/demo/EventForm.tsx'?createHash('sha256').update(execFileSync('git',['show',MINIMUM_PHONE_SOURCE+':'+path],{cwd:repo,encoding:'utf8'}).replace(/\r\n/g,'\n')).digest('hex'):expected.sha256;
 assert.equal(createHash('sha256').update(value).digest('hex'),approved,'Approved UI changed: '+path);
}
console.log(`PASS Premium source contract: ${Object.keys(contract.files).length} files; frozen 3.18 + accepted card 30772de + existing B1/B2 bindings + exact owner-approved real Auth binding.`);

const runtime=verifyPremiumRuntime(repo);console.log(`PASS approved entry/runtime: ${runtime.bindings} import boundaries, immutable approvals and candidate exclusion.`);

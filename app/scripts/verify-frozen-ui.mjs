import {verifyPremiumRuntime} from './premium-route-policy.mjs';
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
 assert.equal(createHash('sha256').update(value).digest('hex'),expected.sha256,'Approved UI changed: '+path);
}
console.log(`PASS Premium source contract: ${Object.keys(contract.files).length} files; frozen 3.18 + accepted card 30772de + existing B1/B2 bindings.`);

const runtime=verifyPremiumRuntime(repo);console.log(`PASS approved entry/runtime: ${runtime.bindings} import boundaries, immutable approvals and candidate exclusion.`);
